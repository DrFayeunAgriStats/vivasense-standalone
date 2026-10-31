create table public.analysis_journey_events (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 attempt_id uuid not null,
 analysis_run_id uuid references public.analysis_runs(id) on delete cascade,
 event_type text not null check (event_type in ('analysis_started','analysis_succeeded','analysis_partially_succeeded','analysis_failed','results_viewed','report_download_requested','report_download_initiated','report_download_failed')),
 design_type text check (design_type is null or length(design_type) <= 80),
 created_at timestamptz not null default now()
);
create index analysis_journey_events_user_time on public.analysis_journey_events(user_id,created_at desc);
create index analysis_journey_events_attempt on public.analysis_journey_events(attempt_id);
create index analysis_journey_events_run on public.analysis_journey_events(analysis_run_id) where analysis_run_id is not null;
alter table public.analysis_journey_events enable row level security;
revoke all on public.analysis_journey_events from anon, authenticated;
grant select, insert on public.analysis_journey_events to authenticated;
grant all on public.analysis_journey_events to service_role;
create policy journey_read_own on public.analysis_journey_events for select to authenticated using ((select auth.uid()) = user_id);
create policy journey_insert_own on public.analysis_journey_events for insert to authenticated with check (
 (select auth.uid()) = user_id and
 (analysis_run_id is null or exists (select 1 from public.analysis_runs r where r.id=analysis_run_id and r.user_id=(select auth.uid())))
);
comment on table public.analysis_journey_events is 'Best-effort client activity observations. Download initiated means browser handoff, not file opened; results viewed means rendered, not read. No research values or export tokens.';
