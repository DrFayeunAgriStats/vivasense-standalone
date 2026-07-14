-- ============================================================================
-- VivaSense — Phase 3: Study Management — STANDALONE SCRIPT
--
-- Run this in the Supabase SQL editor to provision the new tables for
-- Study Management.
--
-- This script should be run AFTER the initial analysis_history table is set up.
-- ============================================================================

-- Part 1: Create the 'studies' table for long-term research projects
-- ============================================================================

create table if not exists public.studies (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  title               text not null,
  description         text,
  crop                text,
  research_area       text,
  year                integer,
  status              text not null default 'active', -- e.g., active, completed, on_hold
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.studies is 'Long-term research projects or studies managed by users.';

create index if not exists studies_user_id_idx on public.studies (user_id);

-- Enable Row Level Security for the 'studies' table
alter table public.studies enable row level security;

-- Policies for 'studies' table
drop policy if exists "Users can view their own studies." on public.studies;
create policy "Users can view their own studies." on public.studies
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own studies." on public.studies;
create policy "Users can insert their own studies." on public.studies
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own studies." on public.studies;
create policy "Users can update their own studies." on public.studies
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own studies." on public.studies;
create policy "Users can delete their own studies." on public.studies
  for delete using (auth.uid() = user_id);


-- Part 2: Link 'analysis_history' to 'studies'
-- ============================================================================
-- This adds a nullable 'study_id' to the existing 'analysis_history' table.
-- This allows analyses to exist without being part of a study.

-- Add the column if it doesn't exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analysis_history' AND column_name = 'study_id'
  ) THEN
    ALTER TABLE public.analysis_history ADD COLUMN study_id uuid;
  END IF;
END;
$$;

-- Remove any old foreign key constraint to avoid errors on re-run.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'analysis_history_study_id_fkey' AND
          conrelid = 'public.analysis_history'::regclass
  ) THEN
    ALTER TABLE public.analysis_history DROP CONSTRAINT analysis_history_study_id_fkey;
  END IF;
END;
$$;

-- Add the new foreign key constraint. If a study is deleted,
-- we set the study_id to NULL to preserve the analysis history record.
alter table public.analysis_history
  add constraint analysis_history_study_id_fkey
  foreign key (study_id)
  references public.studies(id)
  on delete set null;