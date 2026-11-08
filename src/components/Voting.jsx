import { useState } from 'react';
import { Screen } from './Screen';

export default function Voting({ candidates, players, myVote, votesIn, votesNeeded, canVote, tiebreak, isHost, busy, onVote, onForceEnd }) {
  const [sel, setSel] = useState(null);
  const voted = players.find((p) => p.id === myVote);
  return (
    <Screen tone="teal">
      <h1 className="text-3xl font-black text-teal-300">
        {tiebreak ? '⚖️ Re-vote between the tied players' : 'WHO DO YOU THINK IS THE IMPOSTER?'}
      </h1>

      {voted ? (
        <div className="card mt-8 border-teal-400/40 animate-pop">
          <p className="text-sm text-white/60">Vote locked</p>
          <p className="text-2xl font-black">You voted for {voted.name}</p>
        </div>
      ) : canVote ? (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {candidates.map((p) => (
              <button
                key={p.id}
                onClick={() => setSel(p.id)}
                className={`card min-h-[84px] text-lg font-bold transition active:scale-95 ${sel === p.id ? 'border-teal-300 bg-teal-500/20 ring-2 ring-teal-300' : ''}`}
              >
                {p.name}
              </button>
            ))}
          </div>
          <button className="btn btn-teal mt-5" disabled={!sel || busy} onClick={() => onVote(sel)}>
            {sel ? `Lock vote for ${candidates.find((c) => c.id === sel)?.name}` : 'Pick a player'}
          </button>
        </>
      ) : (
        <p className="mt-8 text-white/60">You can't vote this round.</p>
      )}

      <p className="mt-8 text-xl font-bold text-white/80">Votes received: {votesIn} / {votesNeeded}</p>
      <div className="mx-auto mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-teal-400 transition-all duration-500" style={{ width: `${votesNeeded ? (votesIn / votesNeeded) * 100 : 0}%` }} />
      </div>
      {isHost && votesIn > 0 && (
        <button className="mt-6 text-sm text-white/40 underline underline-offset-4" disabled={busy} onClick={onForceEnd}>
          Someone offline? End voting now
        </button>
      )}
    </Screen>
  );
}
