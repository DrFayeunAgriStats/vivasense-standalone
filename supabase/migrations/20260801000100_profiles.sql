-- ============================================================================
-- VivaSense Standalone — 001 · Profiles + shared functions
--
-- A minimal, VivaSense-only user profile. Deliberately excludes every field
-- that belonged to the shared FIA schema (platform_source, academic_track,
-- cohort, registration_source, access_status, diagnostic_*, onboarding_*).
--
-- Access control is a single `is_admin` boolean (FIA's user_roles model is NOT
-- ported). A privilege-guard trigger prevents end users from escalating their
-- own is_admin via the auto-generated PostgREST update endpoint.
--
-- Identity + isolation come from Supabase Auth + Row Level Security.
-- Idempotent (safe to re-run).
-- ============================================================================

-- ── shared: generic updated_at trigger function (used by several tables) ─────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── profiles ─────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  full_name     text,
  institution   text,
  position      text,
  research_area text,
  country       text,
  login_count   integer     not null default 0,
  last_login    timestamptz,
  is_admin      boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is 'VivaSense researcher profile. One row per auth.users id. No FIA/course fields.';

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── auto-provision a profile row on signup ───────────────────────────────────
-- Registration passes full_name / institution / position / research_area via
-- auth signUp options.data (→ raw_user_meta_data). SECURITY DEFINER so the
-- insert runs regardless of RLS.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, institution, position, research_area)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'institution', ''),
    nullif(new.raw_user_meta_data ->> 'position', ''),
    nullif(new.raw_user_meta_data ->> 'research_area', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── privilege guard: end users may not change their own is_admin ─────────────
-- PostgREST requests carry role 'authenticated'/'anon'; service role and direct
-- SQL do not (claims unset → treated as service_role). Only the latter may flip
-- is_admin, so admins are granted out-of-band (dashboard / service key).
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
as $$
declare
  v_role text := coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', 'service_role');
begin
  if new.is_admin is distinct from old.is_admin and v_role in ('authenticated', 'anon') then
    new.is_admin := old.is_admin;   -- silently ignore self-escalation attempts
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_privileges on public.profiles;
create trigger profiles_protect_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- ── Row Level Security — a user may see/edit only their own profile ──────────
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
