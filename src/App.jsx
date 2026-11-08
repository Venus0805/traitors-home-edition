import { Navigate, Route, Routes } from 'react-router-dom';
import { configured } from './services/supabase';
import { Screen } from './components/Screen';
import Home from './pages/Home';
import CreateGame from './pages/CreateGame';
import JoinGame from './pages/JoinGame';
import GameRoom from './pages/GameRoom';

export default function App() {
  if (!configured) {
    return (
      <Screen>
        <h1 className="mb-3 text-3xl font-black text-red-500">Supabase isn't configured</h1>
        <p className="text-white/70">
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (see <code>.env.example</code>), then restart.
        </p>
      </Screen>
    );
  }
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/create" element={<CreateGame />} />
      <Route path="/join" element={<JoinGame />} />
      <Route path="/room/:code" element={<GameRoom />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
