-- ============================================================================
-- VivaSense Standalone — 004 · Link analysis_history → studies
--
-- analysis_history is created (with its own RLS) in
-- 20260714120000_create_analysis_history.sql. This migration adds the optional
-- study_id linkage so Study Management can count analyses per study. An analysis
-- may exist without a study (study_id is nullable); deleting a study nulls the
-- link rather than deleting the history record.
--
-- Depends on: 20260714120000_create_analysis_history, 002_studies.
-- Idempotent (safe to re-run).
-- ============================================================================

alter table public.analysis_history
  add column if not exists study_id uuid;

do $link$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'analysis_history_study_id_fkey'
      and conrelid = 'public.analysis_history'::regclass
  ) then
    alter table public.analysis_history
      add constraint analysis_history_study_id_fkey
      foreign key (study_id) references public.studies(id) on delete set null;
  end if;
end $link$;

create index if not exists analysis_history_study_idx
  on public.analysis_history (study_id);
