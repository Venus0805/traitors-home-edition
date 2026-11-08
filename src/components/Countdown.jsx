import { useEffect, useState } from 'react';

export function useCountdown(endsAt, offset = 0) {
  const calc = () => (endsAt ? Math.max(0, Math.ceil((new Date(endsAt).getTime() - (Date.now() + offset)) / 1000)) : 0);
  const [s, setS] = useState(calc);
  useEffect(() => {
    setS(calc());
    const iv = setInterval(() => setS(calc()), 200);
    return () => clearInterval(iv);
  }, [endsAt, offset]);
  return s;
}

export default function Countdown({ endsAt, offset, className = 'text-white' }) {
  const s = useCountdown(endsAt, offset);
  return <div key={s} className={`text-9xl font-black tabular-nums animate-pop ${className}`}>{s}</div>;
}
