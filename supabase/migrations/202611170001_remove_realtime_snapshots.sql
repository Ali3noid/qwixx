-- Room state is now read only by the SvelteKit server. The public Realtime projection
-- is no longer consumed, so stop maintaining it and remove its direct-access surface.
create function public.start_room_game(
  p_room_id uuid,
  p_host_id uuid,
  p_state jsonb
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
  update public.rooms set status = 'in_game', updated_at = now() where id = p_room_id;
  return true;
end;
$$;

create function public.commit_room_game(
  p_room_id uuid,
  p_expected_version bigint,
  p_state jsonb,
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
  update public.rooms set status = p_status, updated_at = now() where id = p_room_id;
  return next_version;
end;
$$;

grant execute on function public.start_room_game(uuid, uuid, jsonb) to service_role;
grant execute on function public.commit_room_game(uuid, bigint, jsonb, public.room_status) to service_role;

-- Keep the former RPC signatures usable while an older deployment drains. They no
-- longer write a public projection, allowing the snapshot table to be removed.
create or replace function public.start_room_game(
  p_room_id uuid,
  p_host_id uuid,
  p_state jsonb,
  p_public_state jsonb
) returns boolean
language sql
security definer
set search_path = public
as $$
  select public.start_room_game(p_room_id, p_host_id, p_state);
$$;

create or replace function public.commit_room_game(
  p_room_id uuid,
  p_expected_version bigint,
  p_state jsonb,
  p_public_state jsonb,
  p_status public.room_status
) returns bigint
language sql
security definer
set search_path = public
as $$
  select public.commit_room_game(p_room_id, p_expected_version, p_state, p_status);
$$;

grant execute on function public.start_room_game(uuid, uuid, jsonb, jsonb) to service_role;
grant execute on function public.commit_room_game(uuid, bigint, jsonb, jsonb, public.room_status) to service_role;

alter publication supabase_realtime drop table public.room_snapshots;
drop table public.room_snapshots;
