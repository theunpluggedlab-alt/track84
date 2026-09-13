# TRACK / 84

Portrait and landscape browser arcade game, in English. One human and four seeded CPU runners race 110 metres over ten hurdles. No build or runtime dependencies.

## Run

With Node.js 20 or later: `npm run dev`, then open `http://localhost:4173`. On the same Wi-Fi, open `http://<computer LAN address>:4173` from a phone if the host firewall permits it. This serves the solo game to each device; it is not multiplayer. A static web server can host the contents of `dist/` directly.

Enter your player name before the first race. Your name follows your athlete into the leaderboard and is retained for rematches during this session.

Controls: L / A / Left Arrow, R / D / Right Arrow, J / Space / Up Arrow. Touch buttons use immediate pointerdown, support multiple pointers, and suppress browser gestures only on those controls. Hardware touch sampling frequency is determined by the device/browser. P / Escape pauses; Enter starts. Leaving the page pauses the race. Rotation resizes only the renderer and preserves state.

## Structure

- `dist/engine.js`: deterministic 120 Hz simulation; cadence, speed, jump arc, interpolated hurdle/finish crossings, seeded AI, pause and snapshots.
- `dist/session.js`: input routing, ordered commands, duplicate rejection and interchangeable transport.
- `dist/renderer.js`: responsive Canvas 2D stadium and animated pixel athletes.
- `dist/game.js`: DOM HUD, Pointer Events, keyboard, optional synthesized audio and supported-device haptics.
- `dist/style.css`: desktop, phone portrait and compact landscape layouts, safe area insets.

## Wi-Fi multiplayer extension

Multiplayer is deliberately not active yet. `RaceSession` accepts a transport implementing `onInput(handler)`, `send(command)` and `close()`. Current `LocalTransport` dispatches synchronously without opening sockets. Commands contain `{ protocol: 1, playerId, sequence, tick, action }`. `RaceEngine.snapshot()` and `restore()` support full state transfer.

To implement LAN rooms, introduce a WebSocket host (or WebRTC data channels with signaling), room discovery/join UI, authenticated player-to-lane assignment, validated host input scheduling, authoritative 120 Hz simulation, tick/latency synchronization and snapshot broadcasts at 15–30 Hz. Switch joined lanes from AI to human; run AI only for vacant lanes on the host. Clients should interpolate host snapshots rather than run independent collision decisions. Bound input queues, handle stale/out-of-order commands and disconnects, and validate sender identity at the network boundary. The current sequence check is not network authentication.

## Verification

`npm test` runs gameplay tests for cadence, duplicate input, jump timing, falling, full races, pause, snapshot/restart and frame-rate independence.

Assets: original AI-generated stadium illustration. Press Start 2P by CodeMan38, distributed under SIL Open Font License; see `dist/assets/OFL.txt`.
