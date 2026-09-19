# LumenLoop

**Flow. Grow. Outplay.**

LumenLoop is a mobile-first arena arcade game: you pilot a small glowing
energy creature (a *Lumen*) through a neon bioluminescent arena, collecting
energy to grow, using momentum-based movement (Flow / Surge / Drift) to
outmaneuver opponents, and surviving as long as you can. It's built from
scratch with an original identity — no snake/worm visuals, its own
movement model, ability kit, progression system, and UI language.

This repo is a **complete, playable client**: pure HTML/CSS/JS, no build
step, no external binary assets (all art is drawn on `<canvas>`, all audio
is synthesized with the WebAudio API). Open `index.html` through a local
server and it runs.

## Running it

```
npm run dev
```

then open `http://localhost:8080` on your phone or desktop browser. (Any
static file server works — `npx serve`, `python3 -m http.server`, etc. — a
server is required because the game loads ES modules, which browsers block
over `file://`.)

## Android build (APK)

The game is also wrapped as a native Android app via
[Capacitor](https://capacitorjs.com) — a thin WebView shell around the exact
same `index.html`/`src`/`styles` used in the browser. No game code is
different between the two; `android/` just packages it.

Requirements: JDK 17+, and the Android SDK (`platform-tools`,
`platforms;android-36`, `build-tools;36.0.0`) with `ANDROID_HOME` set.

```
npm install                 # pulls in @capacitor/core, @capacitor/cli, @capacitor/android
npm run android:sync        # copies index.html/styles/src/public into www/, syncs into android/
```

To build a release APK you need a signing keystore (one isn't committed —
see below), referenced via `android/keystore.properties`:

```
# android/keystore.properties (gitignored — create your own)
storeFile=lumenloop-release.keystore
storePassword=<your password>
keyAlias=lumenloop
keyPassword=<your password>
```

```
keytool -genkeypair -v -keystore android/app/lumenloop-release.keystore \
  -alias lumenloop -keyalg RSA -keysize 2048 -validity 10950

cd android && ./gradlew assembleRelease
# -> android/app/build/outputs/apk/release/app-release.apk
```

The release build has `minifyEnabled`/`shrinkResources` on — safe here since
the game never calls into the Capacitor plugin bridge (it only uses standard
web APIs: Canvas, WebAudio, `navigator.vibrate`, `localStorage`), so there's
no native reflection path that shrinking could break.

The app icon and splash screen (every legacy + adaptive-icon density) are
generated from `public/icon.svg`, not the Capacitor template defaults.

**A note on testing the APK**: it was verified by building, signing, and
zip-aligning correctly (`apksigner verify`, `zipalign -c`), and by extracting
its bundled assets to confirm they match the latest source. The game logic
inside it was exhaustively tested in a real Chromium browser (the same
rendering engine family Android's WebView uses) — every screen, every
button, both joystick modes, every settings toggle. It was **not** booted on
an actual Android device or emulator in this environment, which has no KVM
support to run one. Do a quick real-device install as a sanity check before
relying on it.

## Controls

- **Move**: drag anywhere on screen. Your Lumen always flows forward; you
  steer the direction.
- **Speed / turning**: how far you drag from the touch point selects your
  movement state — light drag = **Drift** (slow, sharp turns), mid drag =
  **Flow** (balanced), far drag = **Surge** (fast, wide turns, drains a
  stamina meter that recharges when you're not surging).
- **Ability**: tap the button in the corner to use your equipped ability
  (Pulse Dash / Phase Shift / Magnet Core / Energy Shield — more unlock as
  you level up). It's on a cooldown, so it can't be spammed.
- Desktop fallback: WASD/arrows to steer, Shift to Surge, Ctrl to Drift,
  Space for your ability.
- Settings has floating vs. fixed joystick, left-handed layout, reduced
  motion/VFX, high-contrast UI, and a color-blind-friendly palette option
  (energy types are already distinguished by shape, not just color).

## What's real vs. what's simulated

This is an honest prototype, not a live commercial service, so it's worth
being explicit about the seam between "runs entirely in your browser" and
"would need a real backend to ship":

**Fully implemented, running live in this build:**
- Core gameplay loop, momentum movement model, arena zones (Gravity Wells,
  Pulse Gardens, Void Pockets, Aurora Zones), five energy types, combo
  system, the Overcharge risk/reward meter, four abilities with cooldowns,
  trail/core collision rules, an optional Void Titan boss event.
- Four playable modes (Classic, Rush, Duel, Hunter) with real config
  differences (arena size, timers, energy density, bot counts).
- A full progression stack: XP/levels, currency, a cosmetic catalog across
  8 categories with 6 rarity tiers, daily challenges, achievements, a
  local leaderboard, seasons metadata — all persisted to `localStorage`.
- Mobile-first touch controls (floating/fixed joystick), haptics, dynamic
  camera, adaptive-quality rendering (Low/Medium/High/Ultra), procedural
  audio and music that intensifies with player size.
- A full onboarding tutorial, accessibility options, and premium glass UI
  across Home / Mode Select / Customize / Missions / Leaderboard /
  Settings / Matchmaking / in-match HUD / Elimination / Victory.

**Simulated / stubbed, by necessity:**
- **"Multiplayer" is AI bots**, not other real players. There's no
  deployed game server in this repo, and standing one up (with matching
  players in real time) is outside what a static client repo can do.
  The bots (`src/game/bots.js`) have six distinct personalities, imperfect
  decision-making, and drive the exact same `Lumen` physics as the player,
  so the moment-to-moment feel is representative of what real opponents
  would feel like. `Match` (`src/game/match.js`) is written so a real
  transport layer could replace the bot-input path without touching game
  logic — the client already treats "other Lumens" as opaque input
  streams, not something wired to a specific source.
- **No server-authoritative state, anti-cheat, or matchmaking service.**
  Everything (including "your" score) runs client-side, which is fine for
  a solo demo but would need a real backend before it could be trusted in
  a live multiplayer game — client input is never a source of truth in a
  real deployment.
- **No accounts, cloud sync, friends, or monetization backend.** Profile
  data lives in `localStorage` on one device. The Leaderboard and Friends
  screens say so plainly rather than pretending to be connected.
- **Ability roster**: the spec's full list (Pulse Dash, Phase Shift,
  Magnet Core, Energy Shield, Gravity Knot, Echo Trail, Overcharge burst)
  is designed as a one-ability mobile loadout so controls stay one-hand
  friendly; four are implemented and equippable, the rest are natural
  follow-ups using the same `src/game/abilities.js` pattern.
- **Relay, Team Pulse, and Void Event modes** are listed as "Coming Soon"
  on the mode select screen rather than faked with a placeholder — they
  need team/objective systems this pass didn't build.

None of this is hidden in the UI: the Leaderboard and Friends screens
say directly that they're an offline, local-device demo.

## Architecture

```
index.html            All screens' DOM skeletons; content is filled in by JS.
styles/main.css        Glass-panel design system, one file, CSS variables for theming.
src/
  core/                Framework-free utilities: vector math, save/profile
                       schema, cosmetic catalog, procedural audio engine,
                       haptics, achievement checks.
  game/                Pure simulation, no DOM/canvas references:
                       arena.js, energy.js, lumen.js, abilities.js, bots.js,
                       titan.js, camera.js, match.js (the orchestrator).
  input/controller.js  Pointer-events-based joystick + keyboard fallback.
  render/renderer.js   All canvas drawing; reads simulation state, never
                       mutates it.
  ui/                  DOM screen population + the in-match HUD.
  main.js              Wires everything: screen navigation, the match
                       lifecycle (matchmaking → countdown → play → result),
                       and reward/XP/achievement bookkeeping after a match.
server.js              Zero-dependency static file server for local dev.
scripts/build-www.js   Copies the static files into www/ for Capacitor.
www/                   Build output (gitignored) — what Capacitor packages.
android/               Generated Capacitor native project (the APK wrapper).
capacitor.config.json  Capacitor app id/name/web-dir config.
```

The simulation (`src/game`) never touches the DOM or canvas, and the
renderer never mutates simulation state — that boundary is what would let
a real networked build swap the local `Match` loop for a server-driven one
without rewriting rendering, input, or UI.

## Design notes

- **Not a snake.** The Lumen's body is rendered as a chain of separate
  floating orbs connected by faint energy links (see
  `Renderer._drawLumen`), with per-segment wobble — a deliberate visual
  and structural break from continuous-body "worm" games.
- **Growth costs control.** Bigger Lumens move a little slower and turn
  more widely, and high Overcharge shaves a little off turn precision —
  size is an advantage in a bump, not a free win.
- **Combat has two tiers.** Bumping another Lumen's *core* costs the
  smaller one a slice of energy (survivable). Crossing another Lumen's
  *trail* is lethal and bursts them into collectible energy. Energy
  Shield and Phase Shift interact with both.
