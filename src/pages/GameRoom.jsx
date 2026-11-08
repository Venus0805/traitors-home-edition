import { useEffect, useRef } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useGameRoom } from '../hooks/useGameRoom';
import { useSpeech } from '../hooks/useSpeech';
import { Screen, Closed } from '../components/Screen';
import Countdown from '../components/Countdown';
import Lobby from '../components/Lobby';
import RoleReveal from '../components/RoleReveal';
import ImposterPhase from '../components/ImposterPhase';
import KidnapSelection from '../components/KidnapSelection';
import Voting from '../components/Voting';
import VoteResults from '../components/VoteResults';
import GameOver from '../components/GameOver';

// Voice lines. KIDNAP_SELECTION intentionally has none: silence while imposters choose.
const VOICE = {
  CLOSE_EYES: 'Close your eyes everyone.',
  IMPOSTER_WAKE: 'Open your eyes, imposter.',
  IMPOSTER_CLOSE_EYES: 'Close your eyes, imposter.',
  EVERYONE_WAKE: 'Open your eyes everyone.',
};

export default function GameRoom() {
  const { code } = useParams();
  const nav = useNavigate();
  const g = useGameRoom(code.toUpperCase());
  const speech = useSpeech();
  const { room, players, me, uid, online, offset, isHost, isImposter, myRole, info, allRoles, myVote, busy, toast, actions } = g;
  const firstSeq = useRef(null);

  // Speak once per phase change (keyed by phase_seq). Skip whatever phase we loaded into.
  useEffect(() => {
    if (!room) return;
    if (firstSeq.current === null) { firstSeq.current = room.phase_seq; return; }
    const line = VOICE[room.current_phase];
    if (line) speech.speak(line, `${room.id}:${room.phase_seq}`);
  }, [room?.id, room?.phase_seq]);

  useEffect(() => { if (g.status === 'ready') localStorage.setItem('traitors:lastRoom', code.toUpperCase()); }, [g.status, code]);

  const goHome = () => { localStorage.removeItem('traitors:lastRoom'); nav('/'); };
  const leave = async () => { try { await actions.leave(); } catch { /* ignore */ } goHome(); };

  if (g.status === 'loading') return <Screen><p className="animate-pulse text-white/60">Connecting…</p></Screen>;
  if (g.status === 'not_member') return <Navigate to={`/join?code=${code}`} replace />;
  if (g.status === 'gone' || g.status === 'error') {
    return (
      <Screen>
        <h1 className="mb-3 text-3xl font-black">{g.status === 'gone' ? 'This room is closed' : 'Something went wrong'}</h1>
        {g.error && <p className="mb-4 text-red-400">{g.error}</p>}
        <button className="btn btn-ghost" onClick={goHome}>Back to Home</button>
      </Screen>
    );
  }
  if (!room || !me) return <Screen><p className="animate-pulse text-white/60">Loading…</p></Screen>;

  const phase = room.current_phase;
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? 'Someone';
  const eliminated = me.is_eliminated;
  const night = ['CLOSE_EYES', 'IMPOSTER_WAKE', 'KIDNAP_SELECTION', 'IMPOSTER_CLOSE_EYES'].includes(phase);

  let view;
  switch (phase) {
    case 'LOBBY':
      view = <Lobby room={room} players={players} online={online} uid={uid} me={me} isHost={isHost} busy={busy} actions={actions} onLeave={leave} />;
      break;
    case 'ROLE_REVEAL':
      view = <RoleReveal role={myRole} isHost={isHost} busy={busy} onBegin={actions.beginNight} />;
      break;
    case 'CLOSE_EYES':
      view = (
        <Screen tone="night">
          <div className="mb-4 text-6xl">😴</div>
          <h1 className="mb-8 text-4xl font-black">CLOSE YOUR EYES EVERYONE</h1>
          <Countdown endsAt={room.phase_ends_at} offset={offset} />
        </Screen>
      );
      break;
    case 'IMPOSTER_WAKE':
      view = isImposter ? <ImposterPhase info={info} me={me} /> : <Closed />;
      break;
    case 'KIDNAP_SELECTION':
      view = isImposter
        ? <KidnapSelection players={players} me={me} info={info} isLead={!!myRole?.is_lead} busy={busy} onKidnap={actions.kidnap} />
        : <Closed />;
      break;
    case 'IMPOSTER_CLOSE_EYES':
      view = (
        <Screen tone="night">
          <h1 className="text-4xl font-black text-red-500">IMPOSTERS, CLOSE YOUR EYES</h1>
          {isImposter && info.target_id && <p className="mt-6 text-white/50">Target locked: {nameOf(info.target_id)}</p>}
        </Screen>
      );
      break;
    case 'EVERYONE_WAKE':
      view = (
        <Screen>
          <div className="mb-4 text-6xl">👀</div>
          <h1 className="mb-8 text-4xl font-black">OPEN YOUR EYES EVERYONE</h1>
          <Countdown endsAt={room.phase_ends_at} offset={offset} />
        </Screen>
      );
      break;
    case 'KIDNAPPED_REVEAL':
      view = (
        <Screen tone="red">
          <div className="text-8xl animate-shake">🚨</div>
          <h1 className="mt-6 break-words text-5xl font-black text-red-500 animate-pop">{nameOf(room.kidnapped_player_id)} is kidnapped!</h1>
          <p className="mt-6 text-white/60">
            {room.kidnapped_player_id === me.id ? 'You are out of the game. You can still watch.' : 'They can no longer vote or be voted for.'}
          </p>
        </Screen>
      );
      break;
    case 'VOTING': {
      const candidates = players.filter((p) => !p.is_eliminated && p.user_id !== uid && (!room.candidates || room.candidates.includes(p.id)));
      view = (
        <Voting
          candidates={candidates} players={players} myVote={myVote} votesIn={room.votes_in} votesNeeded={room.votes_needed}
          canVote={!eliminated} tiebreak={room.ballot_no > 1} isHost={isHost} busy={busy}
          onVote={actions.vote} onForceEnd={actions.forceEnd}
        />
      );
      break;
    }
    case 'VOTE_RESULTS':
      view = <VoteResults result={room.result} players={players} />;
      break;
    case 'TIEBREAK': {
      const tied = (room.candidates || []).map(nameOf);
      view = (
        <Screen>
          <div className="text-7xl animate-pop">⚖️</div>
          <h1 className="mt-4 text-5xl font-black text-amber-300">IT'S A TIE!</h1>
          <p className="mt-4 text-xl">Re-vote between <b>{tied.join(' and ')}</b></p>
          <div className="mt-6"><Countdown endsAt={room.phase_ends_at} offset={offset} className="text-amber-300 !text-7xl" /></div>
        </Screen>
      );
      break;
    }
    case 'ROUND_RESULT':
      view = (
        <Screen tone="red">
          <div className="text-7xl animate-pop">😈</div>
          <h1 className="mt-4 text-5xl font-black text-red-500 animate-pulseRed">IMPOSTER WINS!</h1>
          <p className="mt-4 text-xl font-bold">The citizens voted incorrectly!</p>
          <p className="mt-2 text-white/60">{nameOf(room.result?.picked)} was a citizen and is eliminated.</p>
          <div className="mt-8 space-y-3">
            {isHost ? (
              <>
                <button className="btn btn-red" disabled={busy} onClick={actions.continueGame}>Continue game (same imposters)</button>
                <button className="btn btn-ghost" disabled={busy} onClick={() => actions.start(room.imposter_count)}>Restart game (new roles)</button>
              </>
            ) : (
              <p className="text-white/50">Waiting for the host to choose…</p>
            )}
          </div>
        </Screen>
      );
      break;
    case 'GAME_OVER':
      view = <GameOver room={room} players={players} allRoles={allRoles} isHost={isHost} busy={busy} actions={actions} onHome={goHome} />;
      break;
    default:
      view = <Screen><p>Unknown phase: {phase}</p></Screen>;
  }

  return (
    <>
      {/* Top bar: dimmed during night so it doesn't light up closed eyes */}
      <div className={`fixed inset-x-0 top-0 z-30 flex items-center justify-between px-4 py-3 text-xs ${night ? 'opacity-30' : 'opacity-80'}`}>
        <span className="flex items-center gap-2 font-bold tracking-widest">
          <span className={`h-2 w-2 rounded-full ${g.connected ? 'bg-emerald-400' : 'bg-red-500 animate-pulse'}`} />
          {room.room_code}{eliminated && phase !== 'LOBBY' ? ' · OUT' : ''}
        </span>
        {speech.supported && (
          <button onClick={() => speech.setMuted(!speech.muted)} className="rounded-full bg-white/10 px-3 py-1">
            {speech.muted ? '🔇 Voice off' : '🔊 Voice on'}
          </button>
        )}
      </div>
      {speech.supported && !speech.ready && !speech.muted && (
        <button onClick={speech.enable} className="fixed inset-x-4 bottom-4 z-40 rounded-2xl bg-amber-400 px-4 py-4 text-lg font-black text-black shadow-xl">
          🔊 Tap to Enable Game Audio
        </button>
      )}
      {!g.connected && <div className="fixed inset-x-0 top-10 z-30 bg-red-600/80 py-1 text-center text-xs font-bold">Reconnecting…</div>}
      {toast && (
        <div onClick={() => g.setToast(null)} className="fixed inset-x-4 top-12 z-50 rounded-xl bg-red-600 px-4 py-3 text-center font-bold shadow-xl">{toast}</div>
      )}
      {view}
    </>
  );
}
