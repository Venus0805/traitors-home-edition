import { Screen } from './Screen';

export default function VoteResults({ result, players }) {
  const tally = result?.tally || {};
  const rows = Object.entries(tally)
    .map(([id, n]) => ({ id, n, name: players.find((p) => p.id === id)?.name ?? '?' }))
    .sort((a, b) => b.n - a.n);
  const max = rows[0]?.n || 1;
  return (
    <Screen>
      <h1 className="mb-6 text-3xl font-black">VOTING RESULTS</h1>
      <div className="space-y-3 text-left">
        {rows.map((r, i) => (
          <div key={r.id} className="card animate-fade" style={{ animationDelay: `${i * 250}ms` }}>
            <div className="mb-2 flex justify-between font-bold">
              <span>{r.name}</span><span>{r.n} vote{r.n > 1 ? 's' : ''}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className={`h-full animate-grow ${r.n === max ? 'bg-red-500' : 'bg-indigo-400'}`} style={{ width: `${(r.n / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      {result?.outcome === 'TIE' && <p className="mt-6 animate-pop text-2xl font-black text-amber-300">⚖️ IT'S A TIE!</p>}
    </Screen>
  );
}
