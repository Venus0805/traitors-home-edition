import { useState } from 'react';
import { Screen } from './Screen';

export default function KidnapSelection({ players, me, info, isLead, busy, onKidnap }) {
  const [sel, setSel] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const mateIds = new Set(info.mates.map((m) => m.id));
  const others = players.filter((p) => !p.is_eliminated && p.id !== me.id);
  const lead = info.mates.find((m) => m.is_lead);
  const target = others.find((p) => p.id === sel);

  return (
    <Screen tone="red">
      <h1 className="text-3xl font-black text-red-500 animate-pulseRed">IMPOSTERS ARE AWAKE</h1>
      {isLead ? (
        <p className="mb-1 mt-3 font-bold text-white">You are the Lead Imposter. Choose the kidnapping target.</p>
      ) : (
        <p className="mb-1 mt-3 text-white/80">{lead?.name ?? 'The lead imposter'} is the Lead Imposter and is choosing the target.</p>
      )}
      <p className="mb-5 text-sm text-white/50">Choose one player to kidnap</p>

      <div className="grid grid-cols-2 gap-3">
        {others.map((p) => {
          const mate = mateIds.has(p.id);
          const disabled = mate || !isLead;
          return (
            <button
              key={p.id}
              disabled={disabled}
              onClick={() => { setSel(p.id); setConfirm(true); }}
              className={`card min-h-[84px] font-bold transition active:scale-95 ${
                sel === p.id ? 'border-red-500 bg-red-600/30 ring-2 ring-red-500' : ''
              } ${mate ? 'opacity-40' : ''}`}
            >
              {p.name}
              {mate && <div className="text-xs font-normal text-red-300">😈 imposter</div>}
            </button>
          );
        })}
      </div>

      {confirm && target && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/80 p-6">
          <div className="card w-full max-w-sm border-red-500/50 bg-[#1a0606] animate-pop">
            <p className="text-2xl font-black">Kidnap {target.name}?</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button className="btn btn-ghost" disabled={busy} onClick={() => { setConfirm(false); setSel(null); }}>Cancel</button>
              <button className="btn btn-red" disabled={busy} onClick={() => onKidnap(target.id)}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}
