-- ============================================================================
-- VivaSense — Research Analysis History (Phase 1)
-- Migration: create public.analysis_history
--
-- Frontend-only persistence. The Railway backend is unaware of this table.
-- Identity + isolation come from Supabase Auth + Row Level Security.
-- All features are free — this table contains no licensing/subscription state.
-- ============================================================================

create table if not exists public.analysis_history (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  session_id          uuid,                                   -- groups a Research Session (nullable now)
  created_at          timestamptz not null default now(),

  analysis_type       text not null,                          -- 'anova','genetic_parameters','correlation','regression','pca','cluster','blup','stability','path_analysis','selection_index'
  analysis_title      text,                                   -- human-friendly label, e.g. "ANOVA · maize.csv"
  study_name          text,                                   -- optional user-defined study/project grouping (future)
  design_type         text,                                   -- 'crd','rcbd','factorial','split_plot_rcbd', ...
  dataset_name        text,                                   -- DatasetContext.file.name
  dataset_token       text,                                   -- upload-preview token (natural session key)
  traits              text[],                                 -- trait column names

  analysis_status     text not null default 'success'
                        check (analysis_status in ('success')),-- only successes are inserted (relaxable later)
  execution_time_ms   integer,
  backend_endpoint    text,                                   -- e.g. '/genetics/analyze-upload?module=anova'
  backend_version     text,                                   -- only if backend returns one; never inferred
  frontend_version    text,                                   -- VivaSense standalone app version

  institution         text,                                   -- snapshot from profiles.institution
  country             text,                                   -- snapshot from profiles.country
  user_role           text,                                   -- snapshot from profiles.academic_track

  analysis_parameters jsonb not null default '{}'::jsonb,
  result_summary      jsonb not null default '{}'::jsonb,     -- {n_genotypes,n_reps,n_environments,n_traits,mode,failed_traits}
  notes               text,
  favorite            boolean not null default false,

  deleted_at          timestamptz                             -- reserved for future soft-delete (no logic yet)
);

create index if not exists analysis_history_user_created_idx
  on public.analysis_history (user_id, created_at desc);
create index if not exists analysis_history_session_idx
  on public.analysis_history (session_id);

-- ── Row Level Security: users may only touch their own rows ──────────────────
alter table public.analysis_history enable row level security;

drop policy if exists "analysis_history_own_select" on public.analysis_history;
create policy "analysis_history_own_select" on public.analysis_history
  for select using (auth.uid() = user_id);

drop policy if exists "analysis_history_own_insert" on public.analysis_history;
create policy "analysis_history_own_insert" on public.analysis_history
  for insert with check (auth.uid() = user_id);

drop policy if exists "analysis_history_own_update" on public.analysis_history;
create policy "analysis_history_own_update" on public.analysis_history
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "analysis_history_own_delete" on public.analysis_history;
create policy "analysis_history_own_delete" on public.analysis_history
  for delete using (auth.uid() = user_id);
