# Agents

This file describes the AI agents that have contributed to this project and their roles.

## Claude (Opus 4.6)

**Role**: Primary development agent for initial scaffolding, architecture, and feature implementation.

### Session 1 — Initial Scaffolding (2026-02-11)

- Read and analyzed the `RADIAL_MOBA_HANDOFF.md` design document
- Made architectural decisions with the human developer:
  - **Vite** for client build tooling
  - **Separate server/client** folders with a sync script for shared code (no monorepo workspaces)
  - **Hardcoded 4-team** radial map for MVP
  - **Basic lobby first**, then movement — minimal but testable
- Scaffolded the full project structure:
  - Colyseus server with WebSocketTransport, game loop, state schemas, and systems
  - Phaser 3 client with Vite, scenes, network layer, and entity rendering
  - Shared constants with a `sync.sh` script
- Identified a known bug: lobby-to-game handoff creates separate game rooms per client instead of a shared one

### Session 2 — Lobby→Game Handoff & Polish (2026-02-11)

- **Fixed lobby→game handoff**: LobbyRoom now creates the GameRoom server-side via `matchMaker.createRoom()` and broadcasts the room ID; clients join via `joinById()`
- **Copyable room link**: Replaced Phaser text with a DOM `<input>` + COPY button so room links can be selected and copied
- **Camera zoom**: Added scroll-wheel zoom (0.3x–2x) on GameScene
- **Objective sprite fix**: Changed from `room.state.listen('objective', ...)` to direct creation from `room.state.objective` after connect (initial state wasn't triggering the listen callback)
- **Objective HP bar improvement**: 200px wide, 12px tall, clearer segmented damage display with team colors
- **Disconnect handling**: Server allows 30s reconnection window via `allowReconnection()`; client detects abnormal disconnects, shows overlay, and retries 5 times
- **SessionStorage reconnection**: Stores reconnection token, game room ID, and team index in `sessionStorage` so browser refreshes can rejoin the game automatically

### Session 3 — Victory Screen & Win Condition (2026-02-12)

- **Victory screen overlay**: Replaced bare text with a full-screen overlay — dark backdrop, large VICTORY/DEFEAT heading, "Team X wins!" label in team color, per-team damage scoreboard sorted by damage (descending), 👑 for winner, ◄ for your team
- **Return to Lobby button**: Interactive button with hover effect that cleanly transitions back to LobbyScene (stops HUD, leaves game room, clears session)
- **Richer gameOver broadcast**: Server collects `damageByTeam` from the objective and includes it in the `gameOver` message
- **Game over input blocking**: Added `gameOver` flag to prevent click-to-move after the game ends
- **HUD freeze on finish**: HUDScene skips `update()` when `room.state.phase === 'finished'`
- **LobbyScene DOM fix**: Calls `destroyRoomLink()` before creating a new DOM container to prevent element stacking on re-entry
- **Objective HP reduced to 500** for faster testing (was 10,000)
- **Learned Phaser lesson**: Interactive objects inside Containers with `setScrollFactor(0)` have broken hit areas — placed victory UI elements directly on the scene instead

### Session 4 — Sprite Art, Collision, Combat Animations (2026-02-13)

- **Sprite art integration**: Replaced all placeholder circles with real sprites — soldier (idle/walk/attack/death) for players, orc for minions, statue for bases. Added PreloadScene for asset loading.
- **Collision detection**: Created `CollisionSystem.ts` — circle-circle separation for player↔player, player↔minion, minion↔minion. Mobile entities pushed away from static entities (bases, objective). Friendly bases and captured bases passable for owning/capturing team.
- **Auto-attack animations**: Added `isAttacking` boolean pulse to Player schema. Server sets true on damage tick, clears next tick. Client plays one-shot `soldier-attack` / `orc-attack` animation when flag is set.
- **Minion HP bars**: 30x3px colored bar (green/yellow/red) above each minion sprite.
- **Minion attack range tuned**: Reduced `MINION_ATTACK_RANGE` from 40 to 20 (aggro range stays 150).

### Session 5 — Base Capture, Click-to-Attack, Cursors, AI Bots (2026-02-13)

- **Base capture mechanic**: Destroying a base no longer eliminates the team immediately. Instead, the base is captured (`capturedByTeam`), the capturing team spawns minions from it, and the losing team can no longer respawn. Team is eliminated only when base destroyed AND all players dead.
- **Base HP bars**: 50x5px team-colored HP bars above each base.
- **Objective HP increased to 10,000** for longer games.
- **Click-to-attack targeting**: Added `attackTargetId` to Player schema. Click enemy entity → player walks toward it → attacks when in range. Hit testing on client (players > minions > objective > bases). Pulsing orange ring highlights selected target.
- **Custom SVG cursors**: Sci-fi pointer for normal navigation, sword cursor when hovering over attackable enemies.
- **AI bot players**: Server-side bots fill empty teams on game start. BotAI system runs each tick — finds nearest enemy (players > minions > bases > objective), sets `attackTargetId`, lets existing Movement/Combat systems handle the rest. Lobby allows solo start with bots filling remaining teams.
- **Teams reduced to 1 player each** for MVP testing with bots.

### Session 6 — Defensive Structure Projectiles (2026-02-13)

- **Structure attacks**: Bases and the central objective now fire traveling projectiles at enemies within range. Classic MOBA tower aggro — structures prioritize minions over players.
- **Projectile system**: Created `Projectile` schema (id, position, target, damage, speed, team), `StructureSystem.ts` with targeting + projectile movement/damage, `ProjectileSprite.ts` for client-side glowing orb visuals.
- **Constants**: `BASE_ATTACK_DAMAGE=40`, `BASE_ATTACK_RANGE=200`, `BASE_ATTACK_COOLDOWN=1500ms`, `OBJECTIVE_ATTACK_DAMAGE=50`, `OBJECTIVE_ATTACK_RANGE=250`, `OBJECTIVE_ATTACK_COOLDOWN=1000ms`, `PROJECTILE_SPEED=400`.
- Captured bases fire for the capturing team. Objective fires at all teams.

### Session 6 continued — Objective Minion Waves (2026-02-13)

- **Objective minion spawning**: Central objective spawns neutral minions (teamIndex -1) every 45 seconds. Each wave sends 2 minions per active base. Minions walk outward from center toward their target base, aggro on nearby enemies, and attack bases on arrival.
- Updated `walkTowardCenter` to support outward-bound pathing for neutral minions.
- Neutral minions skip objective aggro (they belong to it) but aggro on all team bases.

### What was NOT done (as of Session 6)

- No Colyseus schema codegen — client state listeners still use `any` types
- No tilemaps or Tiled integration
- No client-side prediction or interpolation tuning
- No ability system implementation
- No minion pathfinding improvements (still walks straight to destination)
- No hero leveling system

### Patterns and conventions established

- Server-authoritative model: clients send inputs, server validates and broadcasts state
- Fixed timestep game loop at 20 ticks/second
- Systems architecture: MovementSystem, CombatSystem, MinionAI, CollisionSystem, BotAI, WinCondition as pure functions operating on GameState
- Client sprites wrap Phaser game objects and update via `updateFromState()` from Colyseus state listeners
- Shared constants live in `server/src/shared/` and sync to `client/src/shared/` via `sync.sh`
- Reconnection uses `sessionStorage` for browser-refresh survival and in-memory tokens for network-drop recovery
