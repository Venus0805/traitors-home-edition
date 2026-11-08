import { Screen } from './Screen';
import Confetti from './Confetti';

export default function GameOver({ room, players, allRoles, isHost, busy, actions, onHome }) {
  const citizens = room.winner === 'CITIZENS';
  const picked = players.find((p) => p.id === room.result?.picked);
  const imposters = players.filter((p) => allRoles[p.id] === 'IMPOSTER');
  const reason = room.result?.outcome === 'IMPOSTER_WINS_ROUND'
    ? 'The citizens voted incorrectly, and too few citizens remain.'
    : 'Too few citizens remain.';

  return (
    <Screen tone={citizens ? 'teal' : 'red'}>
      {citizens && <Confetti />}
      <div className="text-7xl animate-pop">{citizens ? '🎉' : '😈'}</div>
      <h1 className={`mt-4 text-5xl font-black ${citizens ? 'text-teal-300' : 'text-red-500 animate-pulseRed'}`}>
        {citizens ? 'CITIZENS WIN!' : 'IMPOSTER WINS!'}
      </h1>
      <p className="mt-4 text-xl font-bold">
        {citizens ? `${picked?.name ?? 'The player'} was an Imposter!` : reason}
      </p>
      <p className="mt-1 text-white/60">{citizens ? 'The Citizens successfully identified the Imposter.' : 'Darkness falls over the village.'}</p>

      <div className="card mt-6">
        <p className="mb-2 text-sm text-white/50">The imposter{imposters.length > 1 ? 's were' : ' was'}</p>
        <p className="text-2xl font-black text-red-400">{imposters.map((p) => p.name).join(', ') || '…'}</p>
      </div>

      <div className="mt-8 space-y-3">
        {isHost ? (
          <button className="btn btn-teal" disabled={busy} onClick={actions.playAgain}>🔄 Play Again</button>
        ) : (
          <p className="text-white/50">Waiting for the host to play again…</p>
        )}
        <button className="btn btn-ghost" onClick={onHome}>🏠 Back to Home</button>
      </div>
    </Screen>
  );
}
