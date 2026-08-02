-- ============================================================================
-- VivaSense Standalone — 006 · profiles.onboarding_dismissed
--
-- Per-user persistence for the dashboard's dismissible onboarding module cards
-- (Workspace V3). Additive, backward-compatible; covered by the existing
-- profiles RLS (a user reads/updates only their own row). Idempotent.
-- ============================================================================

alter table public.profiles
  add column if not exists onboarding_dismissed boolean not null default false;

comment on column public.profiles.onboarding_dismissed is
  'Workspace onboarding module cards dismissed by this user (V3 dashboard).';
