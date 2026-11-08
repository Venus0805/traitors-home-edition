import { useState } from 'react';
import { Screen } from './Screen';

export default function RoleReveal({ role, isHost, busy, onBegin }) {
  const [shown, setShown] = useState(false);
  const imp = role?.role === 'IMPOSTER';
  return (
    <Screen tone={shown ? (imp ? 'red' : 'teal') : 'default'}>
      <p className="mb-4 text-white/60">Make sure nobody is peeking.</p>
      {!role ? (
        <p className="text-white/50">Loading your role…</p>
      ) : !shown ? (
        <button onClick={() => setShown(true)} className="card grid h-64 w-full place-items-center border-dashed text-2xl font-black animate-pop">
          🂠<br />Tap to reveal<br />your role
        </button>
      ) : (
        <button onClick={() => setShown(false)} className="w-full animate-pop">
          <p className="text-sm text-white/60">YOUR ROLE</p>
          <div className={`mt-2 text-5xl font-black ${imp ? 'text-red-500 animate-pulseRed' : 'text-teal-300'}`}>
            {imp ? 'IMPOSTER' : 'CITIZEN'}
          </div>
          <div className="my-6 text-8xl">{imp ? '😈' : '🛡️'}</div>
          <p className="text-white/70">
            {imp ? 'Stay hidden. Each night, kidnap a citizen.' : 'Find the imposter before they take everyone.'}
          </p>
          <p className="mt-4 text-xs text-white/40">Tap to hide</p>
        </button>
      )}
      <div className="mt-10">
        {isHost ? (
          <button className="btn btn-red" disabled={busy} onClick={onBegin}>Everyone has seen their role — begin night</button>
        ) : (
          <p className="text-white/50">Waiting for the host to begin the night…</p>
        )}
      </div>
    </Screen>
  );
}
