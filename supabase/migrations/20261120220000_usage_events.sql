create table public.usage_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  module text not null check (module ~ '^[a-z_]{1,40}$'),
  event text not null check (event in ('visit','request_started','response_received','request_failed')),
  created_at timestamptz not null default now(),
  primary key(user_id, operation_id, event)
);
create index usage_events_created_idx on public.usage_events(created_at desc, user_id);
alter table public.usage_events enable row level security;
revoke all on public.usage_events from anon, authenticated;
grant select on public.usage_events to authenticated;
create policy usage_events_own_read on public.usage_events for select to authenticated using (user_id=auth.uid());
create function public.record_usage_event(p_operation_id uuid,p_module text,p_event text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.usage_events(user_id,operation_id,module,event)
    values(auth.uid(),p_operation_id,p_module,p_event)
    on conflict(user_id,operation_id,event) do nothing;
end;
$$;
revoke all on function public.record_usage_event(uuid,text,text) from public,anon;
grant execute on function public.record_usage_event(uuid,text,text) to authenticated;
comment on table public.usage_events is 'Client-observed usage metadata. response_received indicates HTTP success, not validated scientific completion. No research payloads.';
