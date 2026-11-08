export default function PlayerList({ players, online, hostUserId, uid, showReady = false }) {
  return (
    <ul className="space-y-2">
      {players.map((p) => {
        const on = online.has(p.user_id);
        return (
          <li key={p.id} className="card flex items-center gap-3 !py-3 text-left">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-fuchsia-700 to-indigo-700 font-black">
              {p.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">
                {p.name}{p.user_id === uid && <span className="ml-2 text-xs text-white/50">(you)</span>}
              </div>
              <div className="text-xs text-white/50">
                {p.user_id === hostUserId ? '👑 Host · ' : ''}{on ? 'Online' : 'Disconnected'}
              </div>
            </div>
            {showReady && (
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${p.is_ready ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/50'}`}>
                {p.is_ready ? 'Ready' : 'Not ready'}
              </span>
            )}
            <span className={`h-2.5 w-2.5 rounded-full ${on ? 'bg-emerald-400' : 'bg-red-500'}`} />
          </li>
        );
      })}
    </ul>
  );
}
