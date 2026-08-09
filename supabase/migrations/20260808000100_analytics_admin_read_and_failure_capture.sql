-- ============================================================================
-- VivaSense Standalone — 007 · Pilot metrics: admin read path + failure capture
--
-- Two gaps blocked counting real pilot usage:
--
--   1. Every RLS policy on analysis_history and profiles was `auth.uid() = ...`,
--      so no one — including an admin — could read across users. Pilot-wide
--      totals were obtainable only via the service key.
--
--   2. analysis_history.analysis_status was CHECK-constrained to ('success'),
--      making a failed analysis structurally impossible to record. Failures
--      therefore left no trace at all, so "nobody used it" and "everybody tried
--      and it failed" were indistinguishable in the data.
--
-- This migration is additive. Existing per-user policies are untouched: a
-- non-admin still sees exactly their own rows and nothing else.
--
-- Depends on: 20260714120000_create_analysis_history, 20260801000100_profiles.
-- Idempotent (safe to re-run).
-- ============================================================================

-- ── Admin predicate ─────────────────────────────────────────────────────────
-- Mirrors the has_role() idiom already used for the "Admins can read all"
-- policies on audit_logs / ai_usage_logs / profiles in the FIA project:
-- SQL, STABLE, SECURITY DEFINER, fixed search_path.
--
-- SECURITY DEFINER is load-bearing here, not stylistic. This function is used
-- inside a policy ON public.profiles and itself reads public.profiles; without
-- SECURITY DEFINER the policy would re-enter itself and error with infinite
-- recursion. Running as owner bypasses RLS for this lookup and breaks the cycle.
--
-- Gated on profiles.is_admin because the standalone project deliberately does
-- NOT use FIA's user_roles model (see 20260801000100_profiles.sql). is_admin is
-- already protected against self-escalation by protect_profile_privileges().
create or replace function public.is_platform_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = _user_id
      and is_admin = true
  )
$$;

comment on function public.is_platform_admin(uuid) is
  'True when the given user has profiles.is_admin. SECURITY DEFINER so it can be '
  'used inside policies on public.profiles without recursing.';

-- ── Admin read: analysis_history ────────────────────────────────────────────
-- Additive. "analysis_history_own_select" still governs non-admins; Postgres
-- ORs multiple permissive SELECT policies together.
drop policy if exists "analysis_history_admin_select" on public.analysis_history;
create policy "analysis_history_admin_select" on public.analysis_history
  for select to authenticated
  using (public.is_platform_admin(auth.uid()));

-- ── Admin read: profiles ────────────────────────────────────────────────────
-- Needed for registration counts (created_at, login_count, last_login) across
-- all users, not just the caller's own row.
drop policy if exists "profiles_admin_select" on public.profiles;
create policy "profiles_admin_select" on public.profiles
  for select to authenticated
  using (public.is_platform_admin(auth.uid()));

-- ── Failure capture ─────────────────────────────────────────────────────────
-- Relax the status CHECK from ('success') to ('success','failure').
-- The original constraint was declared inline, so its name is server-generated;
-- drop whichever check constraint governs analysis_status, then re-add a named
-- one. Written this way so the migration is re-runnable.
do $status$
declare
  v_conname text;
begin
  for v_conname in
    select conname
    from pg_constraint
    where conrelid = 'public.analysis_history'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%analysis_status%'
  loop
    execute format('alter table public.analysis_history drop constraint %I', v_conname);
  end loop;
end $status$;

alter table public.analysis_history
  add constraint analysis_history_analysis_status_check
  check (analysis_status in ('success', 'failure'));

comment on column public.analysis_history.analysis_status is
  'success | failure. Failures are recorded from analysis catch branches so the '
  'completion rate can be computed; before 2026-08-08 only successes existed.';

-- Supports the pilot metric queries, which filter by status over a date window.
create index if not exists analysis_history_status_created_idx
  on public.analysis_history (analysis_status, created_at desc);
