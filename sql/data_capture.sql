-- ============================================================================
-- VivaSense — Data Capture (VivaCollect) schema
--
-- Run this in the Supabase SQL editor. Idempotent (safe to re-run).
-- Provides the tables + RLS + Storage the Data Capture frontend connects to.
-- Everything is per-study and isolated by Row Level Security to the study owner.
-- Also (re)creates the `studies` table in case it was never applied.
-- ============================================================================

-- ── generic updated_at trigger ───────────────────────────────────────────────
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ── studies (create if missing; extend with Data Capture columns) ────────────
create table if not exists public.studies (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  description   text,
  crop          text,
  research_area text,
  year          integer,
  status        text not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.studies add column if not exists researcher          text;
alter table public.studies add column if not exists location            text;
alter table public.studies add column if not exists experimental_design text; -- 'rcbd','crd','factorial_rcbd','split_plot', ...

create index if not exists studies_user_id_idx on public.studies (user_id);

-- ── link analysis_history → studies (used by Study Management to count analyses
--    per study; the deployed StudyService selects analysis_history.study_id) ──
alter table public.analysis_history add column if not exists study_id uuid;
do $link$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'analysis_history_study_id_fkey'
  ) then
    alter table public.analysis_history
      add constraint analysis_history_study_id_fkey
      foreign key (study_id) references public.studies(id) on delete set null;
  end if;
end $link$;

-- ── trait_definitions (dynamic form metadata per study) ──────────────────────
create table if not exists public.trait_definitions (
  id             uuid primary key default gen_random_uuid(),
  study_id       uuid not null references public.studies(id) on delete cascade,
  name           text not null,                 -- machine key, unique within study
  label          text not null,                 -- display label
  trait_type     text not null default 'numeric'
                   check (trait_type in ('numeric','integer','decimal','dropdown','text','boolean','date','photo','gps')),
  unit           text,
  min_value      numeric,
  max_value      numeric,
  allow_negative boolean not null default false,
  required       boolean not null default false,
  options        jsonb,                          -- dropdown choices, e.g. ["0","1","2","3","4","5"]
  position       integer not null default 0,
  created_at     timestamptz not null default now(),
  unique (study_id, name)
);
create index if not exists trait_definitions_study_idx on public.trait_definitions (study_id, position);

-- ── plots (the fieldbook rows) ───────────────────────────────────────────────
create table if not exists public.plots (
  id            uuid primary key default gen_random_uuid(),
  study_id      uuid not null references public.studies(id) on delete cascade,
  plot_number   integer not null,
  replication   integer,
  block         integer,
  row_index     integer,
  col_index     integer,
  treatment     text,
  genotype      text,
  factors       jsonb,                            -- factorial / split-plot factor levels
  status        text not null default 'not_started'
                  check (status in ('not_started','in_progress','completed')),
  observer_id   uuid references auth.users(id) on delete set null,
  observer_name text,
  latitude      numeric,
  longitude     numeric,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (study_id, plot_number)
);
create index if not exists plots_study_idx on public.plots (study_id, plot_number);
drop trigger if exists plots_set_updated_at on public.plots;
create trigger plots_set_updated_at before update on public.plots
  for each row execute function public.set_updated_at();

-- ── observations (one row per plot × trait — granular autosave target) ───────
create table if not exists public.observations (
  id          uuid primary key default gen_random_uuid(),
  plot_id     uuid not null references public.plots(id) on delete cascade,
  study_id    uuid not null references public.studies(id) on delete cascade,
  trait_id    uuid not null references public.trait_definitions(id) on delete cascade,
  value       jsonb,                              -- number | string | boolean | date-string
  observer_id uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (plot_id, trait_id)
);
create index if not exists observations_plot_idx on public.observations (plot_id);
create index if not exists observations_study_idx on public.observations (study_id);
drop trigger if exists observations_set_updated_at on public.observations;
create trigger observations_set_updated_at before update on public.observations
  for each row execute function public.set_updated_at();

-- ── plot_notes (research notebook: multiple timestamped, authored notes) ─────
create table if not exists public.plot_notes (
  id          uuid primary key default gen_random_uuid(),
  plot_id     uuid not null references public.plots(id) on delete cascade,
  study_id    uuid not null references public.studies(id) on delete cascade,
  body        text not null,
  author_id   uuid references auth.users(id) on delete set null,
  author_name text,
  created_at  timestamptz not null default now()
);
create index if not exists plot_notes_plot_idx on public.plot_notes (plot_id, created_at desc);

-- ── plot_photos (gallery; file bytes live in Storage) ────────────────────────
create table if not exists public.plot_photos (
  id           uuid primary key default gen_random_uuid(),
  plot_id      uuid not null references public.plots(id) on delete cascade,
  study_id     uuid not null references public.studies(id) on delete cascade,
  storage_path text not null,
  caption      text,
  latitude     numeric,
  longitude    numeric,
  uploaded_by  uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists plot_photos_plot_idx on public.plot_photos (plot_id, created_at desc);

-- ── Row Level Security — every row is reachable only by the study owner ──────
alter table public.studies            enable row level security;
alter table public.trait_definitions  enable row level security;
alter table public.plots              enable row level security;
alter table public.observations       enable row level security;
alter table public.plot_notes         enable row level security;
alter table public.plot_photos        enable row level security;

-- studies: owner-only
drop policy if exists "studies_own_all" on public.studies;
create policy "studies_own_all" on public.studies
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- child tables: owner-of-parent-study via study_id
do $$
declare t text;
begin
  foreach t in array array['trait_definitions','plots','observations','plot_notes','plot_photos'] loop
    execute format('drop policy if exists %I on public.%I', t || '_own_all', t);
    execute format($f$
      create policy %I on public.%I for all
      using (exists (select 1 from public.studies s where s.id = %I.study_id and s.user_id = auth.uid()))
      with check (exists (select 1 from public.studies s where s.id = %I.study_id and s.user_id = auth.uid()))
    $f$, t || '_own_all', t, t, t);
  end loop;
end $$;

-- ── Storage bucket for plot photos (private) + owner-scoped policies ─────────
insert into storage.buckets (id, name, public)
  values ('plot-photos', 'plot-photos', false)
  on conflict (id) do nothing;

drop policy if exists "plot_photos_insert_own" on storage.objects;
create policy "plot_photos_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'plot-photos' and owner = auth.uid());

drop policy if exists "plot_photos_select_own" on storage.objects;
create policy "plot_photos_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'plot-photos' and owner = auth.uid());

drop policy if exists "plot_photos_delete_own" on storage.objects;
create policy "plot_photos_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'plot-photos' and owner = auth.uid());
