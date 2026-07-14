-- ============================================================================
-- VivaSense — Research Analysis History (Phase 1) — STANDALONE SCRIPT
--
-- Run this in the Supabase SQL editor (or psql) to provision the history table.
-- Identical to supabase/migrations/20260714120000_create_analysis_history.sql.
--
-- Frontend-only persistence. The Railway backend is unaware of this table.
-- Identity + isolation come from Supabase Auth + Row Level Security.
-- All features are free — this table contains no licensing/subscription state.
-- Safe to re-run (idempotent): uses IF NOT EXISTS / DROP POLICY IF EXISTS.
-- ============================================================================

create table if not exists public.analysis_history (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  session_id          uuid,
  created_at          timestamptz not null default now(),

  analysis_type       text not null,
  analysis_title      text,
  study_name          text,
  design_type         text,
  dataset_name        text,
  dataset_token       text,
  traits              text[],

  analysis_status     text not null default 'success'
                        check (analysis_status in ('success')),
  execution_time_ms   integer,
  backend_endpoint    text,
  backend_version     text,
  frontend_version    text,

  institution         text,
  country             text,
  user_role           text,

  analysis_parameters jsonb not null default '{}'::jsonb,
  result_summary      jsonb not null default '{}'::jsonb,
  notes               text,
  favorite            boolean not null default false,

  deleted_at          timestamptz
);

create index if not exists analysis_history_user_created_idx
  on public.analysis_history (user_id, created_at desc);
create index if not exists analysis_history_session_idx
  on public.analysis_history (session_id);

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
