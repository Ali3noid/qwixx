create extension if not exists pgcrypto;

create type public.room_status as enum ('lobby', 'in_game', 'finished');

create table public.rooms (
  id uuid primary key,
  code char(6) not null unique check (code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'),
  status public.room_status not null default 'lobby',
  host_participant_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_participants (
  id uuid primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  nickname varchar(24) not null check (char_length(trim(nickname)) between 1 and 24),
  seat smallint not null check (seat between 0 and 4),
  session_token_hash char(64) not null,
  joined_at timestamptz not null default now(),
  unique (room_id, seat)
);

create unique index room_participants_nickname_ci
  on public.room_participants (room_id, lower(nickname));

alter table public.rooms
  add constraint rooms_host_participant_fk
  foreign key (host_participant_id) references public.room_participants(id)
  deferrable initially deferred;

create table public.room_games (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  version bigint not null default 1 check (version > 0),
  state jsonb not null,
  updated_at timestamptz not null default now()
);

-- This is the only game-state table exposed to Realtime. It never contains decision payloads.
create table public.room_snapshots (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  version bigint not null check (version > 0),
  public_state jsonb not null check (not (public_state ? 'pendingWhiteDecisions')),
  updated_at timestamptz not null default now()
);

create or replace function public.is_room_member(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_participants
    where room_id = target_room_id and id = auth.uid()
  );
$$;

create or replace function public.create_room_with_host(
  p_room_id uuid,
  p_code text,
  p_host_id uuid,
  p_nickname text,
  p_token_hash text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  set constraints rooms_host_participant_fk deferred;
  insert into public.rooms (id, code, host_participant_id)
    values (p_room_id, p_code, p_host_id);
  insert into public.room_participants (id, room_id, nickname, seat, session_token_hash)
    values (p_host_id, p_room_id, p_nickname, 0, p_token_hash);
  return true;
exception when unique_violation then
  return false;
end;
$$;

create or replace function public.join_room(
  p_room_id uuid,
  p_participant_id uuid,
  p_nickname text,
  p_token_hash text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_room public.rooms%rowtype;
  participant_count integer;
begin
  select * into current_room from public.rooms where id = p_room_id for update;
  if not found or current_room.status <> 'lobby' then return 'started'; end if;
  select count(*) into participant_count from public.room_participants where room_id = p_room_id;
  if participant_count >= 5 then return 'full'; end if;
  if exists (
    select 1 from public.room_participants
    where room_id = p_room_id and lower(nickname) = lower(trim(p_nickname))
  ) then return 'nickname_taken'; end if;
  insert into public.room_participants (id, room_id, nickname, seat, session_token_hash)
    values (p_participant_id, p_room_id, trim(p_nickname), participant_count, p_token_hash);
  return 'joined';
end;
$$;

create or replace function public.start_room_game(
  p_room_id uuid,
  p_host_id uuid,
  p_state jsonb,
  p_public_state jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_room public.rooms%rowtype;
  current_player_ids uuid[];
  state_player_ids uuid[];
begin
  select * into current_room from public.rooms where id = p_room_id for update;
  if not found or current_room.status <> 'lobby' or current_room.host_participant_id <> p_host_id then
    return false;
  end if;
  if (select count(*) from public.room_participants where room_id = p_room_id) < 2 then
    return false;
  end if;
  select array_agg(id order by seat) into current_player_ids
    from public.room_participants where room_id = p_room_id;
  select array_agg((player ->> 'id')::uuid) into state_player_ids
    from jsonb_array_elements(p_state -> 'players') as player;
  if current_player_ids is distinct from state_player_ids then return false; end if;
  insert into public.room_games (room_id, version, state) values (p_room_id, 1, p_state);
  insert into public.room_snapshots (room_id, version, public_state) values (p_room_id, 1, p_public_state);
  update public.rooms set status = 'in_game', updated_at = now() where id = p_room_id;
  return true;
end;
$$;

create or replace function public.commit_room_game(
  p_room_id uuid,
  p_expected_version bigint,
  p_state jsonb,
  p_public_state jsonb,
  p_status public.room_status
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version bigint;
begin
  update public.room_games
    set version = version + 1, state = p_state, updated_at = now()
    where room_id = p_room_id and version = p_expected_version
    returning version into next_version;
  if next_version is null then return null; end if;
  update public.room_snapshots
    set version = next_version, public_state = p_public_state, updated_at = now()
    where room_id = p_room_id;
  update public.rooms set status = p_status, updated_at = now() where id = p_room_id;
  return next_version;
end;
$$;

revoke all on function public.create_room_with_host(uuid, text, uuid, text, text) from public;
revoke all on function public.join_room(uuid, uuid, text, text) from public;
revoke all on function public.start_room_game(uuid, uuid, jsonb, jsonb) from public;
revoke all on function public.commit_room_game(uuid, bigint, jsonb, jsonb, public.room_status) from public;
grant execute on function public.create_room_with_host(uuid, text, uuid, text, text) to service_role;
grant execute on function public.join_room(uuid, uuid, text, text) to service_role;
grant execute on function public.start_room_game(uuid, uuid, jsonb, jsonb) to service_role;
grant execute on function public.commit_room_game(uuid, bigint, jsonb, jsonb, public.room_status) to service_role;

alter table public.rooms enable row level security;
alter table public.room_participants enable row level security;
alter table public.room_games enable row level security;
alter table public.room_snapshots enable row level security;

create policy rooms_member_read on public.rooms for select to authenticated
  using (public.is_room_member(id));
create policy participants_member_read on public.room_participants for select to authenticated
  using (public.is_room_member(room_id));
create policy snapshots_member_read on public.room_snapshots for select to authenticated
  using (public.is_room_member(room_id));

revoke all on public.rooms, public.room_participants, public.room_games, public.room_snapshots from anon, authenticated;
grant select (id, code, status, host_participant_id, created_at, updated_at) on public.rooms to authenticated;
grant select (id, room_id, nickname, seat, joined_at) on public.room_participants to authenticated;
grant select (room_id, version, public_state, updated_at) on public.room_snapshots to authenticated;

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_participants;
alter publication supabase_realtime add table public.room_snapshots;
