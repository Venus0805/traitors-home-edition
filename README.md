# 🗡️ Traitors: Home Edition

Real-time multiplayer party game. Everyone plays on their own phone in the same room.
**React + Vite · Tailwind · Supabase (Anonymous Auth, Realtime, RLS, SQL functions) · Netlify · Web Speech API**

## How it works
All game rules run **inside Postgres** (`supabase/schema.sql`) as `SECURITY DEFINER` functions. Clients can only *read*
what RLS allows and can only *act* through those functions, so nobody can cheat from dev tools.

| Secret | Where it lives | Who can read it |
|---|---|---|
| Your role | `player_roles` | Only you (RLS `user_id = auth.uid()`); everyone after `GAME_OVER` |
| Kidnap target | `room_secrets` (no policies) | Nobody directly. Revealed via `rooms.kidnapped_player_id` at reveal time; locked target shown to imposters via `imposter_info()` |
| Who voted for whom | `votes` | Only your own ballot. Public totals appear in `rooms.result` after voting ends |
| Lead imposter / fellow imposters | `player_roles.is_lead` | Imposters only, via `imposter_info()` |

**Phase machine** (`rooms.current_phase`): `LOBBY → ROLE_REVEAL → CLOSE_EYES(5s) → IMPOSTER_WAKE(3s) → KIDNAP_SELECTION → IMPOSTER_CLOSE_EYES(3s) → EVERYONE_WAKE(3s) → KIDNAPPED_REVEAL(5s) → VOTING → VOTE_RESULTS(6s) → [TIEBREAK(4s) → VOTING] → ROUND_RESULT | GAME_OVER`.
Timed phases store `phase_ends_at`; every client calls `advance_if_due()` when it passes, and the server only advances if its own clock agrees, so the game doesn't depend on the host's phone staying awake.
Voice lines play once per `phase_seq`, and never during `KIDNAP_SELECTION`.

## 1. Supabase setup
1. Create a project at supabase.com.
2. **Authentication → Sign In / Providers → enable "Anonymous Sign-Ins".**
3. **SQL Editor →** paste all of `supabase/schema.sql` → Run. (Re-running wipes game data.)
4. **Project Settings → API**: copy the Project URL and the `anon` public key.

Realtime is enabled for `rooms` and `players` by the SQL file (check Database → Publications → `supabase_realtime` if events don't arrive).

## 2. Local development
```bash
npm install
cp .env.example .env      # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev               # opens on your LAN too (--host); open it on several phones/tabs
```
Tip: each normal browser profile is one player. Use incognito windows or different browsers to test alone (min. 4 players).

## 3. Deploy to Netlify
1. Push this folder to GitHub → Netlify → *Add new site → Import from Git*.
2. Build command `npm run build`, publish directory `dist` (already in `netlify.toml`, which also adds the SPA redirect).
3. *Site settings → Environment variables*: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then redeploy.
(Or: `npm run build` and drag the `dist` folder into Netlify Drop, after setting `.env` locally.)

## Rules as implemented
- 4–20 players. Imposters: at least 1, and few enough that they're still outnumbered after the first kidnapping (`max = ceil((n-1)/2) - 1`; e.g. 4–5 players → 1, 6–7 → 2, 8–9 → 3). This is stricter than "less than total" so rounds can't end instantly.
- Each night a random active imposter is the **Lead Imposter** and picks the target; the others see who is lead and which target was locked.
- Kidnapped players are out: can't vote or be voted for (they spectate).
- Voting: one vote each, locked, no self-votes; ends automatically when everyone eligible has voted (host can force-end if someone is offline). Counts show live; who-voted-for-whom is never shown.
- Most votes is an imposter → **Citizens win** (with several imposters, catching any one wins, per the spec). Citizen → **Imposter wins the round**; that player is eliminated and the host chooses *Continue* (same imposters) or *Restart* (new roles). Imposters win outright when active citizens ≤ imposters.
- Tie → 4-second notice, then a re-vote between the tied players only. Still tied → random pick among them.
- Refresh/reconnect: identity is the persisted anonymous Supabase session; the room code is remembered ("Rejoin room"). Presence shows who's disconnected.

## Known limits
- If the **host** leaves the lobby the room is deleted. Mid-game the host role is not transferred.
- Voice uses each phone's own speech engine; all phones will speak at once. Use the 🔊 toggle to mute all but one device if the echo bothers you. iOS needs one tap to unlock audio (the amber button appears if needed).
- Anonymous users accumulate in Supabase Auth; clear them periodically in the dashboard.
