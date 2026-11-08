import { useEffect, useState } from 'react';
import { Screen } from './Screen';
import PlayerList from './PlayerList';

export const maxImposters = (n) => Math.max(1, Math.ceil((n - 1) / 2) - 1);

export default function Lobby({ room, players, online, uid, me, isHost, busy, actions, onLeave }) {
  const n = players.length;
  const max = maxImposters(n);
  const [count, setCount] = useState(room.imposter_count || 1);
  const [copied, setCopied] = useState(false);
  useEffect(() => setCount((c) => Math.min(Math.max(1, c), max)), [max]);

  const link = `${window.location.origin}/join?code=${room.room_code}`;
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'Traitors: Home Edition', text: `Join my game! Code: ${room.room_code}`, url: link }); return; } catch { /* cancelled */ }
    }
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  return (
    <Screen>
      <p className="text-sm text-white/50">Room code</p>
      <div className="mb-1 text-6xl font-black tracking-[0.2em] text-teal-300">{room.room_code}</div>
      <button onClick={share} className="mb-6 text-sm text-teal-300 underline underline-offset-4">
        {copied ? 'Link copied!' : 'Share invite link'}
      </button>

      <div className="mb-2 flex items-baseline justify-between text-left">
        <h2 className="text-xl font-bold">Players</h2>
        <span className="text-white/60">{n} joined · {players.filter((p) => p.is_ready).length} ready</span>
      </div>
      <PlayerList players={players} online={online} hostUserId={room.host_user_id} uid={uid} showReady />

      <button
        disabled={busy}
        onClick={() => actions.ready(!me?.is_ready)}
        className={`btn mt-4 ${me?.is_ready ? 'btn-ghost' : 'btn-teal'}`}
      >
        {me?.is_ready ? 'Not ready' : "I'm ready"}
      </button>

      {isHost ? (
        <div className="card mt-4 text-left">
          <div className="mb-3 text-sm text-white/60">Number of imposters</div>
          <div className="flex items-center justify-between">
            <button className="btn btn-ghost !w-16 !px-0" disabled={count <= 1} onClick={() => setCount(count - 1)}>−</button>
            <div className="text-5xl font-black text-red-400">{count}</div>
            <button className="btn btn-ghost !w-16 !px-0" disabled={count >= max} onClick={() => setCount(count + 1)}>+</button>
          </div>
          <p className="mt-3 text-xs text-white/40">
            {n < 4 ? 'Need at least 4 players to start.' : `With ${n} players you can have 1–${max} imposter${max > 1 ? 's' : ''}.`}
          </p>
          <button className="btn btn-red mt-4" disabled={busy || n < 4} onClick={() => actions.start(count)}>
            Start game
          </button>
        </div>
      ) : (
        <p className="mt-6 text-white/60">Waiting for the host to start…</p>
      )}
      <button onClick={onLeave} className="mt-6 text-sm text-white/40 underline underline-offset-4">Leave room</button>
    </Screen>
  );
}
