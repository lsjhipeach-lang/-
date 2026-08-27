create table if not exists public.places_cache (
  query_key text primary key,
  data jsonb,
  updated_at timestamptz not null default now()
);

alter table public.places_cache enable row level security;

create table if not exists public.places_api_usage (
  period text primary key,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.places_api_usage enable row level security;

create or replace function public.consume_places_quota(p_period text, p_count integer, p_limit integer default 500)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare next_count integer;
begin
  if p_count < 1 or p_count > 20 or p_limit > 500 then return false; end if;
  insert into public.places_api_usage(period, request_count)
  values (p_period, p_count)
  on conflict (period) do update
    set request_count = public.places_api_usage.request_count + excluded.request_count,
        updated_at = now()
  where public.places_api_usage.request_count + excluded.request_count <= p_limit
  returning request_count into next_count;
  return next_count is not null and next_count <= p_limit;
end;
$$;

revoke all on function public.consume_places_quota(text, integer, integer) from public, anon, authenticated;
