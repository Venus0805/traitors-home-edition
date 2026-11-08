const TONES = {
  default: 'from-[#14091f] via-[#0a0a14] to-black',
  red: 'from-[#3d0606] via-[#160303] to-black',
  teal: 'from-[#04251f] via-[#06100f] to-black',
  night: 'from-black via-black to-black',
};

export function Screen({ tone = 'default', className = '', children }) {
  return (
    <div className={`min-h-[100dvh] w-full bg-gradient-to-b ${TONES[tone]} flex flex-col items-center justify-center px-5 py-16 text-center ${className}`}>
      <div className="w-full max-w-md animate-fade">{children}</div>
    </div>
  );
}

export function Closed({ children }) {
  return (
    <Screen tone="night">
      <div className="text-7xl mb-6 opacity-60">🙈</div>
      <h1 className="text-3xl font-black text-white/60">Keep your eyes closed.</h1>
      {children}
    </Screen>
  );
}
