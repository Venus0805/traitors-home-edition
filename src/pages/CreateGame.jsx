import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { ensureSession } from '../services/supabase';
import { createRoom } from '../services/gameService';
import { primeSpeech } from '../hooks/useSpeech';

export default function CreateGame() {
  const nav = useNavigate();
  const [name, setName] = useState(localStorage.getItem('traitors:name') || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    primeSpeech();
    setBusy(true); setErr('');
    try {
      await ensureSession();
      const r = await createRoom(name);
      localStorage.setItem('traitors:name', name.trim());
      localStorage.setItem('traitors:lastRoom', r.room_code);
      nav(`/room/${r.room_code}`);
    } catch (e2) { setErr(e2.message); setBusy(false); }
  };

  return (
    <Screen>
      <h1 className="mb-6 text-4xl font-black">Create game</h1>
      <form onSubmit={submit} className="space-y-4">
        <input className="input" placeholder="Your name" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        {err && <p className="text-red-400">{err}</p>}
        <button className="btn btn-red" disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Create room'}</button>
        <button type="button" className="btn btn-ghost" onClick={() => nav('/')}>Back</button>
      </form>
    </Screen>
  );
}
