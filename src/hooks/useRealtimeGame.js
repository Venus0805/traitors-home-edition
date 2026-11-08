import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, ensureSession } from '../services/supabase';
import * as api from '../services/gameService';

/** Loads the room + players and keeps them live via Supabase Realtime (plus presence + a safety poll). */
export function useRealtimeGame(code) {
  const [uid, setUid] = useState(null);
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [online, setOnline] = useState(() => new Set());
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState('loading'); // loading | ready | not_member | gone | error
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const roomIdRef = useRef(null);

  const refreshRoom = useCallback(async () => {
    if (!roomIdRef.current) return;
    try {
      const r = await api.fetchRoomById(roomIdRef.current);
      if (!r) return setStatus('gone');
      setRoom((prev) => (!prev || r.phase_seq >= prev.phase_seq ? r : prev));
    } catch { /* transient */ }
  }, []);

  const refreshPlayers = useCallback(async () => {
    if (!roomIdRef.current) return;
    try { setPlayers(await api.fetchPlayers(roomIdRef.current)); } catch { /* transient */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let channel;
    let poll;
    const onVisible = () => {
      if (document.visibilityState === 'visible') { refreshRoom(); refreshPlayers(); }
    };

    (async () => {
      try {
        const user = await ensureSession();
        if (cancelled) return;
        setUid(user.id);
        const r = await api.fetchRoomByCode(code);
        if (cancelled) return;
        if (!r) return setStatus('not_member');
        roomIdRef.current = r.id;
        const [pl, off] = await Promise.all([api.fetchPlayers(r.id), api.getServerOffset().catch(() => 0)]);
        if (cancelled) return;
        setRoom(r); setPlayers(pl); setOffset(off); setStatus('ready');

        channel = supabase.channel(`room:${r.id}`, { config: { presence: { key: user.id } } })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${r.id}` },
            (p) => {
              if (p.eventType === 'DELETE') return setStatus('gone');
              setRoom((prev) => (!prev || p.new.phase_seq >= prev.phase_seq ? p.new : prev));
            })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${r.id}` },
            () => refreshPlayers())
          .on('presence', { event: 'sync' }, () => setOnline(new Set(Object.keys(channel.presenceState()))))
          .subscribe(async (s) => {
            setConnected(s === 'SUBSCRIBED');
            if (s === 'SUBSCRIBED') {
              await channel.track({ at: Date.now() });
              refreshRoom(); refreshPlayers(); // catch anything missed while (re)connecting
            }
          });

        poll = setInterval(refreshRoom, 5000);
        document.addEventListener('visibilitychange', onVisible);
      } catch (e) {
        if (!cancelled) { setError(e.message); setStatus('error'); }
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, [code, refreshRoom, refreshPlayers]);

  return { uid, room, players, online, offset, status, error, connected, refreshRoom, refreshPlayers };
}
