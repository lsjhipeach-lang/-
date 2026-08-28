create table if not exists public.trip_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);

comment on table public.trip_members is
  'Allowlist snapshot of the two authenticated users who may access the shared trip.';

alter table public.trip_members enable row level security;
revoke all on table public.trip_members from anon, authenticated;

do $$
declare
  authenticated_user_count integer;
begin
  select count(*)
    into authenticated_user_count
    from auth.users;

  if authenticated_user_count <> 2 then
    raise exception
      'Expected exactly 2 authenticated users before locking the trip, but found %.',
      authenticated_user_count;
  end if;

  insert into public.trip_members (user_id)
  select id
    from auth.users
  on conflict (user_id) do nothing;
end
$$;

create or replace function public.is_trip_member()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.trip_members
     where user_id = auth.uid()
  );
$$;

revoke all on function public.is_trip_member() from public;
grant execute on function public.is_trip_member() to authenticated;

alter table public.trip_states enable row level security;
revoke all on table public.trip_states from anon;
grant select, insert, update on table public.trip_states to authenticated;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
      from pg_policies
     where schemaname = 'public'
       and tablename = 'trip_states'
  loop
    execute format(
      'drop policy if exists %I on public.trip_states',
      existing_policy.policyname
    );
  end loop;
end
$$;

create policy "trip members can read trip state"
  on public.trip_states
  for select
  to authenticated
  using (public.is_trip_member());

create policy "trip members can create trip state"
  on public.trip_states
  for insert
  to authenticated
  with check (public.is_trip_member());

create policy "trip members can update trip state"
  on public.trip_states
  for update
  to authenticated
  using (public.is_trip_member())
  with check (public.is_trip_member());
