import { Screen } from './Screen';

export default function ImposterPhase({ info, me }) {
  const others = info.mates.filter((m) => m.id !== me?.id);
  return (
    <Screen tone="red">
      <div className="mb-4 text-7xl animate-pop">😈</div>
      <h1 className="text-4xl font-black text-red-500 animate-pulseRed">IMPOSTERS ARE AWAKE</h1>
      <div className="card mt-8 border-red-500/30 bg-red-950/30">
        {others.length ? (
          <>
            <p className="text-sm text-red-200/70">Your fellow imposter{others.length > 1 ? 's' : ''}</p>
            <p className="mt-1 text-2xl font-bold">{others.map((m) => m.name).join(', ')}</p>
          </>
        ) : (
          <p className="text-red-100/80">You are the only imposter.</p>
        )}
      </div>
      <p className="mt-6 text-white/60">Get ready to choose your target…</p>
    </Screen>
  );
}
