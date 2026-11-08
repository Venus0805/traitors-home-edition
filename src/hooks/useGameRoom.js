import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRealtimeGame } from './useRealtimeGame';
import * as api from '../services/gameService';

/** Game-level state: my private role, imposter info, my vote, phase timers and host/player actions. */
export function useGameRoom(code) {
  const g = useRealtimeGame(code);
  const { room, players, uid, offset, refreshRoom } = g;
  const [myRole, setMyRole] = useState(null);
  const [info, setInfo] = useState({ mates: [], target_id: null });
  const [allRoles, setAllRoles] = useState({});
  const [myVote, setMyVote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const roomId = room?.id;
  const phase = room?.current_phase;
  const seq = room?.phase_seq;
  const isImposter = myRole?.role === 'IMPOSTER';

  // Private role (RLS: only my own row is returned)
  useEffect(() => {
    if (!roomId || !uid) return;
    if (phase === 'LOBBY') { setMyRole(null); setInfo({ mates: [], target_id: null }); setAllRoles({}); return; }
    let stale = false;
    api.fetchMyRole(roomId, uid).then((r) => !stale && setMyRole(r)).catch(() => {});
    return () => { stale = true; };
  }, [roomId, uid, seq]);

  // Imposters only: fellow imposters / lead / locked target
  useEffect(() => {
    if (!roomId || !isImposter) return;
    let stale = false;
    api.getImposterInfo(roomId).then((i) => !stale && i && setInfo(i)).catch(() => {});
    return () => { stale = true; };
  }, [roomId, isImposter, seq]);

  // Everyone's roles become readable only at GAME_OVER
  useEffect(() => {
    if (!roomId || phase !== 'GAME_OVER') return;
    api.fetchAllRoles(roomId).then(setAllRoles).catch(() => {});
  }, [roomId, phase]);

  // My own ballot (persists across refresh)
  useEffect(() => {
    if (!roomId || !uid) return;
    if (phase !== 'VOTING') { setMyVote(null); return; }
    let stale = false;
    api.fetchMyVote(roomId, room.round_number, room.ballot_no, uid)
      .then((v) => !stale && setMyVote(v?.target_player_id ?? null)).catch(() => {});
    return () => { stale = true; };
  }, [roomId, uid, phase, room?.round_number, room?.ballot_no]);

  // Timed phases: every client schedules a (server-validated) advance; jitter avoids a stampede.
  useEffect(() => {
    if (!roomId || !room?.phase_ends_at) return;
    const endMs = new Date(room.phase_ends_at).getTime();
    const delay = Math.max(0, endMs - (Date.now() + offset)) + 200 + Math.random() * 500;
    let iv;
    const advance = () => api.advanceIfDue(roomId).then(refreshRoom).catch(() => {});
    const t = setTimeout(() => { advance(); iv = setInterval(advance, 2500); }, delay);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [roomId, seq, room?.phase_ends_at, offset, refreshRoom]);

  const run = useCallback(async (fn) => {
    setBusy(true); setToast(null);
    try { await fn(); await refreshRoom(); await g.refreshPlayers(); }
    catch (e) { setToast(e.message); }
    finally { setBusy(false); }
  }, [refreshRoom, g.refreshPlayers]);

  const me = useMemo(() => players.find((p) => p.user_id === uid) || null, [players, uid]);
  const isHost = !!room && room.host_user_id === uid;

  const actions = {
    ready: (v) => run(() => api.setReady(roomId, v)),
    start: (n) => run(() => api.startGame(roomId, n)),
    beginNight: () => run(() => api.beginNight(roomId)),
    kidnap: (id) => run(() => api.kidnap(roomId, id)),
    vote: (id) => run(async () => { await api.castVote(roomId, id); setMyVote(id); }),
    forceEnd: () => run(() => api.forceEndVote(roomId)),
    continueGame: () => run(() => api.continueGame(roomId)),
    playAgain: () => run(() => api.resetToLobby(roomId)),
    leave: async () => { await api.leaveRoom(roomId); },
  };

  return { ...g, me, isHost, myRole, isImposter, info, allRoles, myVote, busy, toast, setToast, actions };
}
