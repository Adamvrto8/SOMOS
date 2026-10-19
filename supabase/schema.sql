-- SOMOS accounts: every learner's records, synced record by record (src/lib/sync).
-- Run once in the Supabase SQL editor (docs/accounts-setup.md). Safe to run again.

create sequence if not exists public.records_rev;

create table if not exists public.records (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null,                -- customWord, saved, card, attempt, mistake, lesson, test, settings
  key text not null,
  data jsonb,                        -- the row as the app stores it; null for a deletion
  deleted boolean not null default false,
  changed_at bigint not null,        -- device time of the change (ms): the newer one wins
  rev bigint not null default nextval('public.records_rev'), -- the pull cursor
  primary key (user_id, kind, key)
);

create index if not exists records_user_rev on public.records (user_id, rev);

alter table public.records enable row level security;

drop policy if exists "own records" on public.records;
create policy "own records" on public.records
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.records to authenticated;
grant usage on sequence public.records_rev to authenticated;

-- Stores a batch. On the same key the newer change wins, except lessons and tests: the device has merged
-- them by the better result already. Every write takes a new rev, so the other devices pull it.
create or replace function public.push_records(items jsonb) returns void
language sql security invoker set search_path = '' as $$
  insert into public.records (user_id, kind, key, data, deleted, changed_at)
  select (select auth.uid()), i->>'kind', i->>'key', i->'data', coalesce((i->>'deleted')::boolean, false), (i->>'changedAt')::bigint
  from jsonb_array_elements(items) as i
  on conflict (user_id, kind, key) do update
    set data = excluded.data,
        deleted = excluded.deleted,
        changed_at = excluded.changed_at,
        rev = nextval('public.records_rev')
    where public.records.changed_at <= excluded.changed_at
       or excluded.kind in ('lesson', 'test');
$$;

revoke execute on function public.push_records(jsonb) from public, anon;
grant execute on function public.push_records(jsonb) to authenticated;

-- "Zmazať účet": the account and, through the foreign key, all its records.
create or replace function public.delete_my_account() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = (select auth.uid());
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
