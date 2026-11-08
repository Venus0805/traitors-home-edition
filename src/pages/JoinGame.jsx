import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { ensureSession } from '../services/supabase';
import { joinRoom } from '../services/gameService';
import { primeSpeech } from '../hooks/useSpeech';

export default function JoinGame() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [code, setCode] = useState((params.get('code') || '').toUpperCase());
  const [name, setName] = useState(localStorage.getItem('traitors:name') || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    primeSpeech();
    setBusy(true); setErr('');
    try {
      await ensureSession();
      const r = await joinRoom(code, name);
      localStorage.setItem('traitors:name', name.trim());
      localStorage.setItem('traitors:lastRoom', r.room_code);
      nav(`/room/${r.room_code}`);
    } catch (e2) { setErr(e2.message); setBusy(false); }
  };

  return (
    <Screen>
      <h1 className="mb-6 text-4xl font-black">Join game</h1>
      <form onSubmit={submit} className="space-y-4">
        <input
          className="input text-center text-3xl font-black uppercase tracking-[0.3em]"
          placeholder="ROOM CODE" maxLength={6} value={code} autoCapitalize="characters" autoComplete="off"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <input className="input" placeholder="Your name" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} />
        {err && <p className="text-red-400">{err}</p>}
        <button className="btn btn-teal" disabled={busy || code.length < 6 || !name.trim()}>{busy ? 'Joining…' : 'Join room'}</button>
        <button type="button" className="btn btn-ghost" onClick={() => nav('/')}>Back</button>
      </form>
    </Screen>
  );
}
