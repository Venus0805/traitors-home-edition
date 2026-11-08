-- =====================================================================
--  Traitors: Home Edition  -  Supabase schema, game logic and RLS
--  Run this whole file in Supabase > SQL Editor. Safe to re-run (it wipes game data).
--  Also enable: Authentication > Sign In / Providers > "Anonymous Sign-Ins".
-- =====================================================================
create extension if not exists pgcrypto;

drop table if exists votes, game_rounds, room_secrets, player_roles, players, rooms cascade;

-- ---------- TABLES ----------
create table rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null,
  host_user_id uuid not null,
  status text not null default 'LOBBY',            -- LOBBY | PLAYING | FINISHED
  imposter_count int not null default 1,
  current_phase text not null default 'LOBBY',
  phase_seq int not null default 0,                -- increments on every phase change (clients use it to dedupe voice)
  phase_ends_at timestamptz,                       -- timed phases; any client may call advance_if_due()
  round_number int not null default 1,
  ballot_no int not null default 1,                -- 1 = normal vote, 2 = tie-break re-vote
  kidnapped_player_id uuid,                        -- only filled at reveal time
  candidates uuid[],                               -- non-null during a tie-break vote
  votes_in int not null default 0,
  votes_needed int not null default 0,
  result jsonb,                                    -- public tally/outcome of the last vote
  winner text,                                     -- CITIZENS | IMPOSTERS
  created_at timestamptz not null default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  user_id uuid not null,                           -- auth.uid() (anonymous auth)
  name text not null,
  is_ready boolean not null default false,
  is_eliminated boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);

-- PRIVATE: roles live in their own table with their own RLS.
create table player_roles (
  player_id uuid primary key references players(id) on delete cascade,
  room_id uuid not null references rooms(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('IMPOSTER','CITIZEN')),
  is_lead boolean not null default false
);

-- PRIVATE: no policies at all -> unreadable by clients.
create table room_secrets (
  room_id uuid primary key references rooms(id) on delete cascade,
  kidnap_target uuid
);

create table votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  round_number int not null,
  ballot_no int not null,
  voter_player_id uuid not null references players(id) on delete cascade,
  voter_user_id uuid not null,
  target_player_id uuid not null references players(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (room_id, round_number, ballot_no, voter_player_id)
);

create table game_rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  round_number int not null,
  kidnapped_player_id uuid,
  eliminated_player_id uuid,
  status text not null default 'NIGHT',
  created_at timestamptz not null default now(),
  unique (room_id, round_number)
);

-- ---------- RLS ----------
create or replace function is_room_member(p_room uuid) returns boolean
language sql security definer stable set search_path = public as
$$ select exists (select 1 from players where room_id = p_room and user_id = auth.uid()) $$;

create or replace function room_phase(p_room uuid) returns text
language sql security definer stable set search_path = public as
$$ select current_phase from rooms where id = p_room $$;

alter table rooms         enable row level security;
alter table players       enable row level security;
alter table player_roles  enable row level security;
alter table room_secrets  enable row level security;
alter table votes         enable row level security;
alter table game_rounds   enable row level security;

create policy rooms_select   on rooms       for select to authenticated using (is_room_member(id));
create policy players_select on players     for select to authenticated using (is_room_member(room_id));
create policy rounds_select  on game_rounds for select to authenticated using (is_room_member(room_id));
-- A player sees ONLY their own role. Everyone may see all roles once the game is over.
create policy roles_select on player_roles for select to authenticated using (
  user_id = auth.uid() or (room_phase(room_id) = 'GAME_OVER' and is_room_member(room_id))
);
-- Votes: you can only read your own ballot. Totals are published in rooms.result after voting ends.
create policy votes_select on votes for select to authenticated using (voter_user_id = auth.uid());
-- No insert/update/delete policies: every write goes through the SECURITY DEFINER functions below.

-- ---------- INTERNAL HELPERS ----------
create or replace function _set_phase(p_room uuid, p_phase text, p_seconds numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  update rooms set current_phase = p_phase,
         phase_seq = phase_seq + 1,
         phase_ends_at = case when p_seconds is null then null else now() + make_interval(secs => p_seconds) end
   where id = p_room;
end $$;

create or replace function _imposters_win(p_room uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare c int; i int;
begin
  select count(*) filter (where pr.role = 'CITIZEN'), count(*) filter (where pr.role = 'IMPOSTER')
    into c, i
    from player_roles pr join players p on p.id = pr.player_id
   where pr.room_id = p_room and not p.is_eliminated;
  return c <= i;
end $$;

create or replace function _finish(p_room uuid, p_winner text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update rooms set status = 'FINISHED', winner = p_winner where id = p_room;
  perform _set_phase(p_room, 'GAME_OVER', null);
end $$;

create or replace function _start_night(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_round int; v_lead uuid;
begin
  select round_number into v_round from rooms where id = p_room;
  update player_roles set is_lead = false where room_id = p_room;
  select pr.player_id into v_lead
    from player_roles pr join players p on p.id = pr.player_id
   where pr.room_id = p_room and pr.role = 'IMPOSTER' and not p.is_eliminated
   order by random() limit 1;
  update player_roles set is_lead = true where player_id = v_lead;
  delete from room_secrets where room_id = p_room;
  insert into game_rounds(room_id, round_number, status) values (p_room, v_round, 'NIGHT')
    on conflict (room_id, round_number) do nothing;
  update rooms set kidnapped_player_id = null, candidates = null, votes_in = 0 where id = p_room;
  perform _set_phase(p_room, 'CLOSE_EYES', 5);
end $$;

create or replace function _begin_vote(p_room uuid, p_candidates uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  update rooms set candidates = p_candidates, votes_in = 0,
         votes_needed = (select count(*) from players where room_id = p_room and not is_eliminated)
   where id = p_room;
  perform _set_phase(p_room, 'VOTING', null);
end $$;

create or replace function _resolve_votes(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r rooms%rowtype; v_tally jsonb; v_max int; v_top uuid[]; v_pick uuid;
  v_outcome text; v_random boolean := false; v_role text;
begin
  select * into r from rooms where id = p_room;
  select coalesce(jsonb_object_agg(target_player_id::text, cnt), '{}'::jsonb), max(cnt)
    into v_tally, v_max
    from (select target_player_id, count(*) cnt from votes
           where room_id = p_room and round_number = r.round_number and ballot_no = r.ballot_no
           group by target_player_id) s;
  select array_agg(target_player_id) into v_top from (
    select target_player_id from votes
     where room_id = p_room and round_number = r.round_number and ballot_no = r.ballot_no
     group by target_player_id having count(*) = v_max) t;

  if array_length(v_top, 1) > 1 and r.ballot_no = 1 then
    v_outcome := 'TIE';
  else
    if array_length(v_top, 1) > 1 then
      v_pick := v_top[1 + floor(random() * array_length(v_top, 1))::int];
      v_random := true;                       -- still tied after the re-vote: random pick
    else
      v_pick := v_top[1];
    end if;
    select role into v_role from player_roles where player_id = v_pick;
    v_outcome := case when v_role = 'IMPOSTER' then 'CITIZENS_WIN' else 'IMPOSTER_WINS_ROUND' end;
  end if;

  update rooms set result = jsonb_build_object(
      'tally', v_tally, 'top', to_jsonb(v_top), 'outcome', v_outcome,
      'picked', v_pick, 'random_pick', v_random, 'ballot', r.ballot_no)
   where id = p_room;
  perform _set_phase(p_room, 'VOTE_RESULTS', 6);
end $$;

-- ---------- PUBLIC API (called with supabase.rpc) ----------
create or replace function create_room(p_name text) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_code text; v_room uuid; v_player uuid; i int;
  v_alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  p_name := btrim(coalesce(p_name, ''));
  if length(p_name) < 1 or length(p_name) > 20 then raise exception 'Name must be 1-20 characters'; end if;
  loop
    v_code := '';
    for i in 1..6 loop v_code := v_code || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1); end loop;
    exit when not exists (select 1 from rooms where room_code = v_code);
  end loop;
  insert into rooms(room_code, host_user_id) values (v_code, v_uid) returning id into v_room;
  insert into players(room_id, user_id, name) values (v_room, v_uid, p_name) returning id into v_player;
  return json_build_object('room_id', v_room, 'room_code', v_code, 'player_id', v_player);
end $$;

create or replace function join_room(p_code text, p_name text) returns json
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r rooms%rowtype; v_player uuid;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  select * into r from rooms where room_code = upper(btrim(coalesce(p_code, '')));
  if not found then raise exception 'Room not found. Check the code.'; end if;
  select id into v_player from players where room_id = r.id and user_id = v_uid;
  if found then   -- reconnect after refresh
    return json_build_object('room_id', r.id, 'room_code', r.room_code, 'player_id', v_player);
  end if;
  if r.current_phase <> 'LOBBY' then raise exception 'That game has already started.'; end if;
  p_name := btrim(coalesce(p_name, ''));
  if length(p_name) < 1 or length(p_name) > 20 then raise exception 'Name must be 1-20 characters'; end if;
  if exists (select 1 from players where room_id = r.id and lower(name) = lower(p_name)) then
    raise exception 'That name is taken in this room.';
  end if;
  if (select count(*) from players where room_id = r.id) >= 20 then raise exception 'Room is full (20 players).'; end if;
  insert into players(room_id, user_id, name) values (r.id, v_uid, p_name) returning id into v_player;
  return json_build_object('room_id', r.id, 'room_code', r.room_code, 'player_id', v_player);
end $$;

create or replace function set_ready(p_room uuid, p_ready boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update players set is_ready = p_ready
   where room_id = p_room and user_id = auth.uid()
     and (select current_phase from rooms where id = p_room) = 'LOBBY';
end $$;

create or replace function leave_room(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype;
begin
  select * into r from rooms where id = p_room for update;
  if not found then return; end if;
  if r.current_phase <> 'LOBBY' then raise exception 'You cannot leave a game in progress.'; end if;
  if r.host_user_id = auth.uid() then delete from rooms where id = p_room;
  else delete from players where room_id = p_room and user_id = auth.uid(); end if;
end $$;

create or replace function start_game(p_room uuid, p_imposters int) returns void
language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype; n int; v_max int; v_imps uuid[];
begin
  select * into r from rooms where id = p_room for update;
  if not found or r.host_user_id <> auth.uid() then raise exception 'Only the host can do that.'; end if;
  if r.current_phase not in ('LOBBY', 'ROUND_RESULT', 'GAME_OVER') then raise exception 'Game is already running.'; end if;
  select count(*) into n from players where room_id = p_room;
  if n < 4 then raise exception 'You need at least 4 players.'; end if;
  v_max := ceil((n - 1) / 2.0)::int - 1;   -- imposters must stay outnumbered after the first kidnapping
  if p_imposters < 1 or p_imposters > v_max then
    raise exception 'With % players you can have 1 to % imposter(s).', n, v_max;
  end if;

  delete from votes where room_id = p_room;
  delete from player_roles where room_id = p_room;
  delete from room_secrets where room_id = p_room;
  delete from game_rounds where room_id = p_room;
  update players set is_eliminated = false where room_id = p_room;

  select array_agg(id) into v_imps from (
    select id from players where room_id = p_room order by random() limit p_imposters) s;
  insert into player_roles(player_id, room_id, user_id, role)
    select id, room_id, user_id, case when id = any(v_imps) then 'IMPOSTER' else 'CITIZEN' end
      from players where room_id = p_room;

  update rooms set status = 'PLAYING', imposter_count = p_imposters, round_number = 1, ballot_no = 1,
         kidnapped_player_id = null, candidates = null, votes_in = 0, votes_needed = 0,
         result = null, winner = null
   where id = p_room;
  perform _set_phase(p_room, 'ROLE_REVEAL', null);
end $$;

create or replace function begin_night(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype;
begin
  select * into r from rooms where id = p_room for update;
  if not found or r.host_user_id <> auth.uid() then raise exception 'Only the host can do that.'; end if;
  if r.current_phase <> 'ROLE_REVEAL' then return; end if;
  perform _start_night(p_room);
end $$;

create or replace function continue_game(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype;
begin
  select * into r from rooms where id = p_room for update;
  if not found or r.host_user_id <> auth.uid() then raise exception 'Only the host can do that.'; end if;
  if r.current_phase <> 'ROUND_RESULT' then return; end if;
  update rooms set round_number = round_number + 1, ballot_no = 1, result = null where id = p_room;
  perform _start_night(p_room);
end $$;

create or replace function reset_to_lobby(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype;
begin
  select * into r from rooms where id = p_room for update;
  if not found or r.host_user_id <> auth.uid() then raise exception 'Only the host can do that.'; end if;
  delete from votes where room_id = p_room;
  delete from player_roles where room_id = p_room;
  delete from room_secrets where room_id = p_room;
  delete from game_rounds where room_id = p_room;
  update players set is_eliminated = false, is_ready = false where room_id = p_room;
  update rooms set status = 'LOBBY', round_number = 1, ballot_no = 1, kidnapped_player_id = null,
         candidates = null, votes_in = 0, votes_needed = 0, result = null, winner = null
   where id = p_room;
  perform _set_phase(p_room, 'LOBBY', null);
end $$;

-- Any room member may call this; it only acts when a timed phase is really due (server clock).
create or replace function advance_if_due(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype; tgt uuid; v_pick uuid;
begin
  if not is_room_member(p_room) then raise exception 'Not in this room'; end if;
  select * into r from rooms where id = p_room for update;
  if not found or r.phase_ends_at is null or now() < r.phase_ends_at then return; end if;

  case r.current_phase
    when 'CLOSE_EYES'          then perform _set_phase(p_room, 'IMPOSTER_WAKE', 3);
    when 'IMPOSTER_WAKE'       then perform _set_phase(p_room, 'KIDNAP_SELECTION', null);
    when 'IMPOSTER_CLOSE_EYES' then perform _set_phase(p_room, 'EVERYONE_WAKE', 3);
    when 'EVERYONE_WAKE' then
      select kidnap_target into tgt from room_secrets where room_id = p_room;
      if tgt is not null then
        update players set is_eliminated = true where id = tgt;
        update game_rounds set kidnapped_player_id = tgt, status = 'KIDNAPPED'
         where room_id = p_room and round_number = r.round_number;
      end if;
      update rooms set kidnapped_player_id = tgt where id = p_room;
      perform _set_phase(p_room, 'KIDNAPPED_REVEAL', 5);
    when 'KIDNAPPED_REVEAL' then
      if _imposters_win(p_room) then perform _finish(p_room, 'IMPOSTERS');
      else perform _begin_vote(p_room, null); end if;
    when 'VOTE_RESULTS' then
      if r.result->>'outcome' = 'TIE' then
        update rooms set ballot_no = ballot_no + 1,
               candidates = (select array_agg(x::uuid) from jsonb_array_elements_text(r.result->'top') x)
         where id = p_room;
        perform _set_phase(p_room, 'TIEBREAK', 4);
      elsif r.result->>'outcome' = 'CITIZENS_WIN' then
        perform _finish(p_room, 'CITIZENS');
      else
        v_pick := (r.result->>'picked')::uuid;
        update players set is_eliminated = true where id = v_pick;
        update game_rounds set eliminated_player_id = v_pick, status = 'VOTED'
         where room_id = p_room and round_number = r.round_number;
        if _imposters_win(p_room) then perform _finish(p_room, 'IMPOSTERS');
        else perform _set_phase(p_room, 'ROUND_RESULT', null); end if;
      end if;
    when 'TIEBREAK' then perform _begin_vote(p_room, r.candidates);
    else null;
  end case;
end $$;

create or replace function kidnap(p_room uuid, p_target uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype;
begin
  select * into r from rooms where id = p_room for update;
  if not found or r.current_phase <> 'KIDNAP_SELECTION' then raise exception 'Not the kidnapping phase.'; end if;
  if not exists (select 1 from player_roles where room_id = p_room and user_id = auth.uid()
                  and role = 'IMPOSTER' and is_lead) then
    raise exception 'Only the Lead Imposter can choose the target.';
  end if;
  if not exists (select 1 from player_roles pr join players p on p.id = pr.player_id
                  where pr.player_id = p_target and pr.room_id = p_room
                    and pr.role = 'CITIZEN' and not p.is_eliminated) then
    raise exception 'Invalid target.';
  end if;
  insert into room_secrets(room_id, kidnap_target) values (p_room, p_target)
    on conflict (room_id) do update set kidnap_target = excluded.kidnap_target;
  perform _set_phase(p_room, 'IMPOSTER_CLOSE_EYES', 3);
end $$;

create or replace function cast_vote(p_room uuid, p_target uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype; me players%rowtype; v_in int;
begin
  select * into r from rooms where id = p_room for update;
  if not found or r.current_phase <> 'VOTING' then raise exception 'Voting is not open.'; end if;
  select * into me from players where room_id = p_room and user_id = auth.uid();
  if not found then raise exception 'Not in this room.'; end if;
  if me.is_eliminated then raise exception 'Eliminated players cannot vote.'; end if;
  if p_target = me.id then raise exception 'You cannot vote for yourself.'; end if;
  if not exists (select 1 from players where id = p_target and room_id = p_room and not is_eliminated) then
    raise exception 'Invalid choice.';
  end if;
  if r.candidates is not null and not (p_target = any(r.candidates)) then
    raise exception 'You can only vote for a tied player.';
  end if;
  if exists (select 1 from votes where room_id = p_room and round_number = r.round_number
                and ballot_no = r.ballot_no and voter_player_id = me.id) then
    raise exception 'You already voted.';
  end if;
  insert into votes(room_id, round_number, ballot_no, voter_player_id, voter_user_id, target_player_id)
    values (p_room, r.round_number, r.ballot_no, me.id, auth.uid(), p_target);
  update rooms set votes_in = votes_in + 1 where id = p_room returning votes_in into v_in;
  if v_in >= r.votes_needed then perform _resolve_votes(p_room); end if;
end $$;

-- Host safety valve if someone has gone offline mid-vote.
create or replace function force_end_vote(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype;
begin
  select * into r from rooms where id = p_room for update;
  if not found or r.host_user_id <> auth.uid() then raise exception 'Only the host can do that.'; end if;
  if r.current_phase <> 'VOTING' then return; end if;
  if r.votes_in < 1 then raise exception 'Wait for at least one vote.'; end if;
  perform _resolve_votes(p_room);
end $$;

-- Imposters only: fellow imposters, who is lead, and the locked kidnap target.
create or replace function imposter_info(p_room uuid) returns json
language plpgsql security definer stable set search_path = public as $$
begin
  if not exists (select 1 from player_roles where room_id = p_room and user_id = auth.uid() and role = 'IMPOSTER') then
    return null;
  end if;
  return json_build_object(
    'mates', coalesce((select json_agg(json_build_object('id', pr.player_id, 'name', p.name, 'is_lead', pr.is_lead))
                         from player_roles pr join players p on p.id = pr.player_id
                        where pr.room_id = p_room and pr.role = 'IMPOSTER' and not p.is_eliminated), '[]'::json),
    'target_id', (select kidnap_target from room_secrets where room_id = p_room));
end $$;

create or replace function server_now() returns bigint
language sql stable as $$ select (extract(epoch from clock_timestamp()) * 1000)::bigint $$;

-- ---------- PERMISSIONS ----------
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function
  create_room(text), join_room(text, text), set_ready(uuid, boolean), leave_room(uuid),
  start_game(uuid, int), begin_night(uuid), continue_game(uuid), reset_to_lobby(uuid),
  advance_if_due(uuid), kidnap(uuid, uuid), cast_vote(uuid, uuid), force_end_vote(uuid),
  imposter_info(uuid), server_now(), is_room_member(uuid), room_phase(uuid)
  to authenticated;
grant usage on schema public to authenticated;
grant select on rooms, players, player_roles, votes, game_rounds to authenticated;

-- ---------- REALTIME ----------
do $$ begin
  begin alter publication supabase_realtime add table public.rooms;   exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.players; exception when duplicate_object then null; end;
end $$;
