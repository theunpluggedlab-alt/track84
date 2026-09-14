# TRACK / 84

Portrait and landscape browser arcade game, in English. Solo Olympic tour (30 Games, 1896 Athens → 2024 Paris, 3 arcade lives, two disciplines — 110m hurdles and 500m single sculls) plus realtime multiplayer for up to 5 phones. No build step; the browser client has no runtime dependencies.

## Events

- **110m Hurdles** — the original arcade sprint. Alternate L ↔ R to run, press J when it lights up to clear 10 hurdles.
- **500m Single Sculls (rowing)** — the same L/R/J protocol on the water. Steady strokes near 6–7/s ride clean water (SWING), rowing above the sustainable rating burns crew stamina, three same-side strokes in a row catch a crab, J calls a POWER TEN twice a race, and stroking before the gun is an automatic false start. Pick the discipline on the start card (solo) or in the room lobby (host). Medals and the resume point are stored per event; tour progress and arcade lives are shared.

## Run

With Node.js 20 or later: `npm run dev`, then open `http://localhost:4173`. On the same Wi-Fi, open `http://<computer LAN address>:4173` from a phone if the host firewall permits it. A static web server can host the contents of `dist/` directly (solo tour only).

Enter your player name before the first race. Your name follows your athlete into the leaderboard and is retained for rematches during this session.

Controls: L / A / Left Arrow, R / D / Right Arrow, J / Space / Up Arrow. Touch buttons use immediate pointerdown, support multiple pointers, and suppress browser gestures only on those controls. Hardware touch sampling frequency is determined by the device/browser. P / Escape pauses; Enter starts. Leaving the page pauses the race. Rotation resizes only the renderer and preserves state.

## Multiplayer (up to 5 phones, realtime)

One phone (or PC) runs the authoritative host; the rest join with a 4-letter room code. Empty lanes race as CPU. The host picks the Games and starts; top of the lobby shows ping. If a phone drops, its lane falls back to AI, and rejoining with the same name reclaims the lane. Races with stragglers end by timeout (DNF sorts last).

With Node.js 20 or later: `cd server && npm install`, then from the repo root `npm run host` (or `node server/host.mjs`, `PORT=8080` to override). Phones on the same Wi-Fi open `http://<host LAN address>:4173`, tap 👥 Multiplayer, and either Create (host address is prefilled) or Join with the code.

Internet play needs a public host (static Netlify hosting cannot hold WebSockets). Deploy `server/Dockerfile` with `fly.toml` (Fly.io) or `render.yaml` (Render.com), then enter `wss://<your-host>/race` as the host address on each phone.

Trust model: LAN party — sequenced, rate-limited inputs but no authentication or anti-cheat. Do not expose an untrusted internet without adding auth in front of it.

## Structure

- `dist/engine.js`: deterministic 120 Hz simulation; cadence, speed, jump arc, interpolated hurdle/finish crossings, seeded AI, pause and snapshots. `reset(seed, humanIds)` and `setHuman(id, human)` support net hosts. `setEvent(id)` switches between `hurdles` and `rowing` (glide, stamina, swing, crab, power ten, false start) without touching the hurdles path.
- `dist/events.js`: event registry (110m Hurdles, 500m Single Sculls) and rowing tuning constants.
- `dist/session.js`: input routing, ordered commands, duplicate rejection and interchangeable transport. Arcade lives and tour progress.
- `dist/net.js`: browser WebSocket client, ping, and `NetView` — a renderer-compatible read of authoritative snapshots.
- `server/host.mjs` + `server/room.mjs`: authoritative host — rooms, lane assignment, input validation, 120 Hz sim, 20 Hz snapshots, AI backfill, DNF timeout.
- `dist/renderer.js`: responsive Canvas 2D stadium and animated pixel athletes.
- `dist/game.js`: DOM HUD, Pointer Events, keyboard, optional synthesized audio and supported-device haptics.
- `dist/style.css`: desktop, phone portrait and compact landscape layouts, safe area insets.

## Verification

`npm test` runs gameplay tests for cadence, duplicate input, jump timing, falling, full races, pause, snapshot/restart and frame-rate independence, plus rowing balance (rhythm beats force), stamina, swing, crab, power ten and false start, plus arcade lives and multiplayer room/input/snapshot/NetView rules.

Assets: original AI-generated stadium illustration. Press Start 2P by CodeMan38, distributed under SIL Open Font License; see `dist/assets/OFL.txt`.
