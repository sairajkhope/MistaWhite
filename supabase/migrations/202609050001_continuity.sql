-- Apply once through Supabase migrations. Browser roles are read-only for scientific state.
create table public.account_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision integer not null default 0 check (revision >= 0),
  snapshot jsonb,
  updated_at timestamptz not null default now()
);
create table public.turns (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  input jsonb not null,
  response jsonb not null,
  revision integer not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, revision)
);
create table public.domain_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  turn_id uuid not null,
  revision integer not null,
  ordinal integer not null,
  event jsonb not null,
  primary key (user_id, id),
  foreign key (user_id, turn_id) references public.turns(user_id, id),
  unique (user_id, revision, ordinal)
);
create table public.recordings (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  path text not null unique,
  mime_type text not null,
  byte_size integer not null check (byte_size > 0 and byte_size <= 26214400),
  duration_seconds integer not null check (duration_seconds between 0 and 300),
  status text not null default 'pending' check (status in ('pending', 'stored')),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.account_state enable row level security;
alter table public.turns enable row level security;
alter table public.domain_events enable row level security;
alter table public.recordings enable row level security;
revoke all on public.account_state, public.turns, public.domain_events, public.recordings from anon, authenticated;
grant select on public.account_state, public.turns, public.domain_events, public.recordings to authenticated;
grant all on public.account_state, public.turns, public.domain_events, public.recordings to service_role;
create policy own_state on public.account_state for select to authenticated using ((select auth.uid()) = user_id);
create policy own_turns on public.turns for select to authenticated using ((select auth.uid()) = user_id);
create policy own_events on public.domain_events for select to authenticated using ((select auth.uid()) = user_id);
create policy own_recordings on public.recordings for select to authenticated using ((select auth.uid()) = user_id);

-- Only the trusted backend can call this transaction. The account ID comes from verified Auth.
create function public.commit_turn(
  p_user_id uuid, p_id uuid, p_expected_revision integer,
  p_input jsonb, p_response jsonb, p_snapshot jsonb, p_events jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  current_revision integer;
  previous public.turns%rowtype;
begin
  insert into public.account_state(user_id) values (p_user_id) on conflict do nothing;
  select revision into current_revision from public.account_state where user_id = p_user_id for update;
  select * into previous from public.turns where user_id = p_user_id and id = p_id;
  if found then
    if previous.input <> p_input then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return previous.response;
  end if;
  if current_revision <> p_expected_revision then raise exception 'REVISION_CONFLICT'; end if;
  if p_snapshot #>> '{kernel,userId}' <> p_user_id::text then raise exception 'ACCOUNT_MISMATCH'; end if;
  insert into public.turns(user_id, id, input, response, revision)
    values (p_user_id, p_id, p_input, p_response, current_revision + 1);
  insert into public.domain_events(user_id, id, turn_id, revision, ordinal, event)
    select p_user_id, (value->>'id')::uuid, p_id, current_revision + 1, ordinality::integer, value
    from jsonb_array_elements(p_events) with ordinality;
  update public.account_state set revision = current_revision + 1, snapshot = p_snapshot, updated_at = now()
    where user_id = p_user_id;
  return p_response;
end;
$$;
revoke all on function public.commit_turn(uuid, uuid, integer, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.commit_turn(uuid, uuid, integer, jsonb, jsonb, jsonb, jsonb) to service_role;

-- No public URLs or browser write policy. Uploads receive backend-authorized signed tokens.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('field-audio', 'field-audio', false, 26214400, array['audio/webm','audio/mp4','audio/ogg','audio/wav','audio/mpeg']);
