-- ============================================================================
-- VivaSense Standalone — 002 · Studies
--
-- Long-term research projects. Every downstream artifact (traits, plots,
-- observations, notes, photos, analyses) hangs off a study and is isolated to
-- the owning user by RLS. Columns consolidate the base table + the Data-Capture
-- extensions (researcher / location / experimental_design) into one clean DDL.
-- Idempotent (safe to re-run).
-- ============================================================================

create table if not exists public.studies (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  title               text not null,
  description         text,
  crop                text,
  research_area       text,
  year                integer,
  status              text not null default 'active',   -- active | completed | on_hold
  researcher          text,
  location            text,
  experimental_design text,                              -- rcbd | crd | factorial_rcbd | split_plot | ...
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.studies is 'Long-term research projects managed by a VivaSense user.';

create index if not exists studies_user_id_idx on public.studies (user_id);

drop trigger if exists studies_set_updated_at on public.studies;
create trigger studies_set_updated_at
  before update on public.studies
  for each row execute function public.set_updated_at();

-- ── Row Level Security — owner-only ──────────────────────────────────────────
alter table public.studies enable row level security;

drop policy if exists "studies_own_all" on public.studies;
create policy "studies_own_all" on public.studies
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
