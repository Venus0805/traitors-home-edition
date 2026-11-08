import { supabase } from './supabase';

async function rpc(fn, args = {}) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

export const createRoom = (name) => rpc('create_room', { p_name: name });
export const joinRoom = (code, name) => rpc('join_room', { p_code: code, p_name: name });
export const setReady = (room, ready) => rpc('set_ready', { p_room: room, p_ready: ready });
export const leaveRoom = (room) => rpc('leave_room', { p_room: room });
export const startGame = (room, n) => rpc('start_game', { p_room: room, p_imposters: n });
export const beginNight = (room) => rpc('begin_night', { p_room: room });
export const continueGame = (room) => rpc('continue_game', { p_room: room });
export const resetToLobby = (room) => rpc('reset_to_lobby', { p_room: room });
export const advanceIfDue = (room) => rpc('advance_if_due', { p_room: room });
export const kidnap = (room, target) => rpc('kidnap', { p_room: room, p_target: target });
export const castVote = (room, target) => rpc('cast_vote', { p_room: room, p_target: target });
export const forceEndVote = (room) => rpc('force_end_vote', { p_room: room });
export const getImposterInfo = (room) => rpc('imposter_info', { p_room: room });

export async function getServerOffset() {
  const t0 = Date.now();
  const ms = await rpc('server_now');
  const t1 = Date.now();
  return Number(ms) - (t0 + t1) / 2; // add to Date.now() to get server time
}

async function one(query) {
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export const fetchRoomByCode = (code) =>
  one(supabase.from('rooms').select('*').eq('room_code', code.toUpperCase()));
export const fetchRoomById = (id) => one(supabase.from('rooms').select('*').eq('id', id));

export async function fetchPlayers(roomId) {
  const { data, error } = await supabase.from('players').select('*').eq('room_id', roomId).order('joined_at');
  if (error) throw new Error(error.message);
  return data;
}

// RLS guarantees this only ever returns the caller's own row (until GAME_OVER).
export const fetchMyRole = (roomId, uid) =>
  one(supabase.from('player_roles').select('role,is_lead').eq('room_id', roomId).eq('user_id', uid));

export async function fetchAllRoles(roomId) {
  const { data, error } = await supabase.from('player_roles').select('player_id,role').eq('room_id', roomId);
  if (error) throw new Error(error.message);
  return Object.fromEntries(data.map((r) => [r.player_id, r.role]));
}

export const fetchMyVote = (roomId, round, ballot, uid) =>
  one(
    supabase.from('votes').select('target_player_id')
      .eq('room_id', roomId).eq('round_number', round).eq('ballot_no', ballot).eq('voter_user_id', uid)
  );
