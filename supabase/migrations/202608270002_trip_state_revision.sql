alter table public.trip_states
  add column if not exists revision bigint not null default 0;

comment on column public.trip_states.revision is
  'Optimistic concurrency revision. Clients update only the revision they last loaded.';
