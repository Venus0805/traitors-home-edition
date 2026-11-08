import { useNavigate } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { primeSpeech } from '../hooks/useSpeech';

export default function Home() {
  const nav = useNavigate();
  const last = localStorage.getItem('traitors:lastRoom');
  const go = (to) => { primeSpeech(); nav(to); };
  return (
    <Screen>
      <div className="mb-4 text-7xl animate-pop">🗡️</div>
      <h1 className="text-6xl font-black leading-none tracking-tight text-red-500 animate-pulseRed">TRAITORS</h1>
      <p className="mb-10 mt-2 text-xl tracking-widest text-white/60">Home Edition</p>
      <div className="space-y-3">
        <button className="btn btn-red" onClick={() => go('/create')}>Create Game</button>
        <button className="btn btn-ghost" onClick={() => go('/join')}>Join Game</button>
        {last && <button className="btn btn-ghost !text-teal-300" onClick={() => go(`/room/${last}`)}>Rejoin room {last}</button>}
      </div>
      <p className="mt-10 text-sm text-white/40">4+ players · one phone each · no one is safe</p>
    </Screen>
  );
}
