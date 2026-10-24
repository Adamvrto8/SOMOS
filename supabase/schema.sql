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

-- ---------------------------------------------------------------------------------------------------------
-- Live duels, 1 on 1 (docs/duel-spec.md). Times are server ms (epoch), so both phones run the same schedule.

create or replace function public.now_ms() returns bigint
language sql stable set search_path = '' as $$ select (extract(epoch from clock_timestamp()) * 1000)::bigint $$;

-- The name a player is shown under; the e-mail is never shown to anyone.
create table if not exists public.profiles (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  nickname text not null check (char_length(nickname) between 3 and 20)
);
create unique index if not exists profiles_nickname on public.profiles (lower(nickname));

alter table public.profiles enable row level security;
drop policy if exists "nicknames are seen by players" on public.profiles;
create policy "nicknames are seen by players" on public.profiles for select to authenticated using (true);
drop policy if exists "own nickname" on public.profiles;
create policy "own nickname" on public.profiles for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "own nickname changes" on public.profiles;
create policy "own nickname changes" on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update on public.profiles to authenticated;

create table if not exists public.duels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host uuid not null references auth.users on delete cascade,
  guest uuid references auth.users on delete cascade,
  level text not null,
  seed integer not null,
  rounds jsonb not null,             -- [{ type, seconds, items: [itemId…] }]
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  started_at bigint,                 -- when the countdown began
  created_at bigint not null default public.now_ms(),
  rematch text                       -- the code of the next room for the same two
);

alter table public.duels enable row level security;
drop policy if exists "players see their duels" on public.duels;
create policy "players see their duels" on public.duels for select to authenticated
  using ((select auth.uid()) in (host, guest));
grant select on public.duels to authenticated; -- changes only through the functions below

create table if not exists public.duel_answers (
  duel_id uuid not null references public.duels on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  task smallint not null check (task between 0 and 14),
  result text not null check (result in ('right', 'almost', 'wrong')),
  ms integer not null check (ms >= 0),
  at bigint not null default public.now_ms(),
  primary key (duel_id, user_id, task)
);

alter table public.duel_answers enable row level security;
drop policy if exists "players see the answers of their duels" on public.duel_answers;
create policy "players see the answers of their duels" on public.duel_answers for select to authenticated
  using (exists (select 1 from public.duels d where d.id = duel_id and (select auth.uid()) in (d.host, d.guest)));
grant select on public.duel_answers to authenticated;

-- Both players get rooms and answers the moment they change (Supabase Realtime).
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'duels') then
    alter publication supabase_realtime add table public.duels;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'duel_answers') then
    alter publication supabase_realtime add table public.duel_answers;
  end if;
end $$;

-- What a room may be: the app builds the rounds (lib/duel/match.ts), the server checks their shape.
create or replace function public.valid_duel(p_code text, p_level text, p_rounds jsonb) returns boolean
language sql immutable set search_path = '' as $$
  -- Anything missing (NULL) makes the room invalid, never valid.
  select coalesce(upper(p_code) ~ '^[A-Z0-9]{6}$'
    and p_level in ('A1', 'A2', 'B1')
    and jsonb_typeof(p_rounds) = 'array'
    and jsonb_array_length(p_rounds) = 3
    and length(p_rounds::text) < 4000
    and not exists (
      select 1 from jsonb_array_elements(p_rounds) as r
      where jsonb_typeof(r->'items') is distinct from 'array'
         or jsonb_array_length(r->'items') <> 5
         or exists (select 1 from jsonb_array_elements(r->'items') as i where jsonb_typeof(i) <> 'string' or length(i #>> '{}') > 60)
         or jsonb_typeof(r->'seconds') is distinct from 'number'
         or (select count(*) from jsonb_object_keys(r)) <> 3 -- type, seconds, items and nothing else
         or coalesce((r->>'type', (r->>'seconds')::numeric) not in (('choice', 10), ('conjugation', 15), ('vocab', 15), ('builder', 25)), true)
    ), false);
$$;

-- The guest takes a seat only through join_duel (or rematch_duel, for the opponent of the last match).
drop function if exists public.create_duel(text, text, integer, jsonb, uuid);
create or replace function public.create_duel(p_code text, p_level text, p_seed integer, p_rounds jsonb)
returns public.duels language plpgsql security definer set search_path = '' as $$
declare room public.duels;
begin
  if not public.valid_duel(p_code, p_level, p_rounds) then raise exception 'invalid'; end if;
  insert into public.duels (code, host, level, seed, rounds)
  values (upper(p_code), (select auth.uid()), p_level, p_seed, p_rounds)
  returning * into room;
  return room;
end $$;

-- The guest takes the free seat; a player of the room opening the link again just gets it.
create or replace function public.join_duel(p_code text) returns public.duels
language plpgsql security definer set search_path = '' as $$
declare room public.duels;
begin
  select * into room from public.duels where code = upper(p_code);
  if not found then raise exception 'not-found'; end if;
  if (select auth.uid()) in (room.host, room.guest) then return room; end if;
  if room.guest is not null or room.status <> 'lobby' then raise exception 'full'; end if;
  update public.duels set guest = (select auth.uid()) where id = room.id returning * into room;
  return room;
end $$;

create or replace function public.start_duel(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.duels set status = 'playing', started_at = public.now_ms()
  where id = p_id and host = (select auth.uid()) and guest is not null and status = 'lobby';
$$;

-- The first answer of a player to a task counts; the server stamps the time it arrived.
-- Right or wrong and how long it took come from the app (it checks the answer); for friends that is enough,
-- before a public release the server should check them (docs/duel-spec.md, 4).
create or replace function public.answer_duel(p_id uuid, p_task integer, p_result text, p_ms integer) returns void
language sql security definer set search_path = '' as $$
  insert into public.duel_answers (duel_id, user_id, task, result, ms)
  select p_id, (select auth.uid()), p_task, p_result, p_ms
  from public.duels d where d.id = p_id and d.status = 'playing' and (select auth.uid()) in (d.host, d.guest)
    and p_task between 0 and 14 and p_ms between 0 and 25000 -- no task has more time than 25 s
  on conflict do nothing;
$$;

create or replace function public.finish_duel(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.duels set status = 'finished'
  where id = p_id and status = 'playing' and (select auth.uid()) in (host, guest);
$$;

-- Odveta: a new room for the same two (once; the second asking gets the same room).
create or replace function public.rematch_duel(p_id uuid, p_code text, p_seed integer, p_rounds jsonb) returns public.duels
language plpgsql security definer set search_path = '' as $$
declare old public.duels; room public.duels;
begin
  select * into old from public.duels where id = p_id and (select auth.uid()) in (host, guest) for update;
  if not found then raise exception 'not-found'; end if;
  if old.rematch is not null then
    select * into room from public.duels where code = old.rematch;
    return room;
  end if;
  if not public.valid_duel(p_code, old.level, p_rounds) then raise exception 'invalid'; end if;
  insert into public.duels (code, host, guest, level, seed, rounds)
  values (upper(p_code), (select auth.uid()), case when old.host = (select auth.uid()) then old.guest else old.host end, old.level, p_seed, p_rounds)
  returning * into room;
  update public.duels set rematch = room.code where id = old.id;
  return room;
end $$;

revoke execute on function public.create_duel(text, text, integer, jsonb), public.join_duel(text), public.start_duel(uuid),
  public.answer_duel(uuid, integer, text, integer), public.finish_duel(uuid), public.rematch_duel(uuid, text, integer, jsonb) from public, anon;
grant execute on function public.create_duel(text, text, integer, jsonb), public.join_duel(text), public.start_duel(uuid),
  public.answer_duel(uuid, integer, text, integer), public.finish_duel(uuid), public.rematch_duel(uuid, text, integer, jsonb),
  public.now_ms() to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Practice reminders, one row per device (docs/superpowers/specs/2026-10-24-reminders-for-everyone-design.md).
-- Only api/reminder.ts reads and writes these, with the service role key: no policies, nothing for users.

create table if not exists public.push_devices (
  device text primary key,                 -- the app's own id: outlives a rotated subscription
  user_id uuid references auth.users on delete cascade, -- the account signed in on the device, or null
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  time text not null check (time ~ '^([01]\d|2[0-3]):[0-5]\d$'), -- "19:00", device-local
  time_zone text not null,                 -- IANA zone from the device
  language text not null default 'sk' check (language in ('sk', 'en')),
  receipts boolean not null default false, -- its service worker confirms what it receives
  progress jsonb,                          -- ReminderProgress, as the device last reported it
  handled_day text,                        -- local day the reminder was sent or skipped because the goal was met
  sent_day text,                           -- local day of the last reminder sent
  delivery jsonb,                          -- the last message handed to the push service, and the receipt
  last_decision jsonb,                     -- { at, reason }: the tick's last word on this device
  test_at timestamptz,                     -- last test notification: at most one a minute
  test_later boolean not null default false,
  created_at timestamptz not null default now(),
  seen_at timestamptz not null default now() -- last subscribe or progress report
);
create index if not exists push_devices_user on public.push_devices (user_id) where user_id is not null;

-- Endpoints the push service dropped (404/410): subscribing one again gets 410, so the app makes a new one.
create table if not exists public.push_gone (endpoint text primary key, at timestamptz not null default now());

-- The cron's last call, for "Stav pripomienky".
create table if not exists public.push_ticks (
  id smallint primary key default 1 check (id = 1),
  at timestamptz not null,
  reason text not null,
  sent integer not null default 0
);

-- New devices per IP address (hashed) and hour.
create table if not exists public.push_rate (key text primary key, hour timestamptz not null, count integer not null);

alter table public.push_devices enable row level security;
alter table public.push_gone enable row level security;
alter table public.push_ticks enable row level security;
alter table public.push_rate enable row level security;
revoke all on public.push_devices, public.push_gone, public.push_ticks, public.push_rate from anon, authenticated;
grant select, insert, update, delete on public.push_devices, public.push_gone, public.push_ticks, public.push_rate to service_role;

-- The wall-clock time in a zone; null for a zone Postgres does not know (the device then drops out of
-- reminders_due instead of failing it for everyone).
create or replace function public.push_local_time(p_now timestamptz, p_zone text) returns timestamp
language plpgsql stable set search_path = '' as $$
begin
  return p_now at time zone p_zone;
exception when others then
  return null;
end $$;

-- Devices inside their window [time, min(time + 2 h, 23:59)] that were not handled today, and every test
-- asked for later. Minutes of the day, not time + interval (that wraps past midnight). The devices the tick
-- looked at longest ago come first: one it has just tried (and failed) waits behind the rest.
create or replace function public.reminders_due(p_now timestamptz, p_limit integer)
returns setof public.push_devices language sql stable set search_path = '' as $$
  select d.* from public.push_devices d
  cross join lateral (select public.push_local_time(p_now, d.time_zone) as t) l
  cross join lateral (select
      extract(hour from l.t)::int * 60 + extract(minute from l.t)::int as minutes,
      to_char(l.t, 'YYYY-MM-DD') as day,
      split_part(d.time, ':', 1)::int * 60 + split_part(d.time, ':', 2)::int as start) m
  where d.test_later
     or (m.minutes between m.start and least(m.start + 120, 1439) and d.handled_day is distinct from m.day)
  order by d.last_decision->>'at' nulls first, d.device
  limit p_limit;
$$;

-- The last reports of every device of these accounts, as one JSON array: a list of ids in the body instead of
-- the URL (too long for hundreds of accounts), and one value, so PostgREST's row limit cannot cut it short.
create or replace function public.push_reports(p_users uuid[]) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('device', d.device, 'user_id', d.user_id, 'progress', d.progress)), '[]'::jsonb)
  from public.push_devices d
  where d.user_id = any(p_users) and d.progress is not null;
$$;

-- One more new device from this key this hour: true while under the limit.
create or replace function public.push_rate_hit(p_key text, p_limit integer) returns boolean
language plpgsql set search_path = '' as $$
declare
  this_hour timestamptz := date_trunc('hour', now());
  n integer;
begin
  insert into public.push_rate as r (key, hour, count) values (p_key, this_hour, 1)
  on conflict (key) do update set count = case when r.hour = this_hour then r.count + 1 else 1 end, hour = this_hour
  returning count into n;
  return n <= p_limit;
end $$;

-- Once a day from the tick: devices silent for 60 days, old dropped endpoints and rate rows.
create or replace function public.push_cleanup() returns void
language sql set search_path = '' as $$
  delete from public.push_devices where seen_at < now() - interval '60 days';
  delete from public.push_gone where at < now() - interval '30 days';
  delete from public.push_rate where hour < now() - interval '1 day';
$$;

revoke execute on function public.push_local_time(timestamptz, text), public.reminders_due(timestamptz, integer),
  public.push_reports(uuid[]), public.push_rate_hit(text, integer), public.push_cleanup() from public, anon, authenticated;
grant execute on function public.push_local_time(timestamptz, text), public.reminders_due(timestamptz, integer),
  public.push_reports(uuid[]), public.push_rate_hit(text, integer), public.push_cleanup() to service_role;
