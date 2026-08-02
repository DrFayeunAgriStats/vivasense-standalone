-- ============================================================================
-- VivaSense Standalone — 003 · Data Capture (VivaCollect)
--
-- Per-study field-data-collection schema: dynamic trait definitions, plots
-- (the fieldbook rows), granular observations, research notes, and photo
-- metadata (bytes live in the plot-photos Storage bucket — see migration 005).
--
-- Every child row is reachable only by the owner of its parent study (RLS).
-- Depends on: 002_studies (studies), 001_profiles (set_updated_at).
-- Idempotent (safe to re-run).
-- ============================================================================

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
  options        jsonb,                          -- dropdown choices, e.g. ["0","1","2","3"]
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
create index if not exists observations_plot_idx  on public.observations (plot_id);
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

-- ── Row Level Security — every child row reachable only by the study owner ───
alter table public.trait_definitions enable row level security;
alter table public.plots             enable row level security;
alter table public.observations      enable row level security;
alter table public.plot_notes        enable row level security;
alter table public.plot_photos       enable row level security;

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
