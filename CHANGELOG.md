# Changelog

## [0.5.0] - 2026-02-13

### Added

- **AI bot players**: Server-side bots fill empty teams when the game starts. BotAI system runs each tick — finds nearest enemy target and sets `attackTargetId`. Existing Movement and Combat systems handle the rest. Solo players can start a full 4-team game.
- **Click-to-attack targeting**: Click an enemy player, minion, base, or the objective to walk toward and attack it. Pulsing orange ring highlights the selected target. Ground click cancels the attack.
- **Custom SVG cursors**: Sci-fi pointer for default navigation, sword cursor when hovering over attackable enemies.

### Changed

- **Teams reduced to 1 player each** (`PLAYERS_PER_TEAM = 1`) for MVP testing with bots.
- **Lobby allows solo start**: `checkAllReady()` now requires only 1 player (bots fill the rest).

## [0.4.0] - 2026-02-13

### Added

- **Sprite art**: Replaced placeholder circles with real sprites — soldier spritesheets (idle/walk/attack/death) for players, orc spritesheets for minions, statue sprite for bases. Added `PreloadScene` for asset loading.
- **Collision detection**: New `CollisionSystem` with circle-circle separation — players block each other, minions block each other, both pushed away from bases and objective.
- **Auto-attack animations**: `isAttacking` boolean pulse on Player schema triggers one-shot attack animations on client.
- **Minion HP bars**: Small colored bar (green/yellow/red) above each minion.
- **Base capture mechanic**: Destroying a base captures it instead of eliminating the team. Capturing team spawns minions from the captured base. Losing team can no longer respawn but stays alive until killed.
- **Base HP bars**: Team-colored HP bars above each base.

### Changed

- **Minion attack range reduced** from 40 to 20 (aggro range stays 150).
- **Objective HP increased to 10,000** for longer games.

## [0.3.0] - 2026-02-12

### Added

- **Victory screen**: Full overlay on game over with VICTORY/DEFEAT heading, winning team label, per-team damage scoreboard sorted by contribution (with 👑 for winner), and a "Return to Lobby" button.
- **Return to lobby flow**: After game over, players can click "Return to Lobby" to cleanly transition back to the lobby and start a new game.
- **Richer gameOver broadcast**: Server now sends per-team damage stats alongside the winning team index.

### Changed

- **Objective HP reduced to 500** (from 10,000) for faster testing.
- **HUD freezes on game over**: HUDScene stops updating once the game phase is `'finished'`.
- **Click-to-move disabled after game over**: Prevents movement inputs while the victory screen is showing.

### Fixed

- **LobbyScene DOM stacking**: Room link container is cleaned up before re-creation when returning from a game, preventing duplicate DOM elements.

## [0.2.0] - 2026-02-11

### Fixed

- **Lobby→Game handoff**: All lobby players now join the same GameRoom. LobbyRoom creates the game server-side via `matchMaker.createRoom()` and broadcasts the `gameRoomId` to clients, who join via `joinById()`.
- **Objective sprite not rendering**: Changed from `room.state.listen('objective', ...)` to direct creation from `room.state.objective` after connecting, since the listen callback wasn't firing for initial state.
- **Room link not copyable**: Replaced Phaser text with a DOM `<input>` + COPY button overlay so room links can be selected, copied, and pasted.

### Added

- **Camera zoom**: Scroll wheel to zoom in/out (0.3x–2x) on GameScene.
- **Improved objective HP bar**: 200px wide, 12px tall with team-colored damage segments, dark background, and white border.
- **Disconnect handling (network drop)**: Server allows 30-second reconnection window via `allowReconnection(client, 30)`. Client detects abnormal disconnects (`onLeave` code !== 1000), shows a "Connection lost / Reconnecting..." overlay, and retries up to 5 times using the Colyseus reconnection token.
- **Disconnect handling (browser refresh)**: Stores `reconnectionToken`, `gameRoomId`, and `teamIndex` in `sessionStorage`. On page load, LobbyScene checks for stored session data and attempts to reconnect — if successful, skips the lobby and goes straight to GameScene. Session data is cleared on intentional leave or game over.

### Changed

- `ColyseusClient.joinGame()` now takes a `gameRoomId` parameter and uses `joinById()` instead of `create()`.
- `GameScene.init()` now receives `gameRoomId` from LobbyScene data.
- `LobbyScene` passes team assignment and game room ID through to GameScene on game start.

## [0.1.0] - 2026-02-11

### Added

- **Project scaffolding**: Full monorepo structure with `server/` (Colyseus + TypeScript) and `client/` (Phaser 3 + Vite + TypeScript)
- **Server**:
  - Colyseus server with WebSocketTransport on port 2567
  - `LobbyRoom`: create/join rooms, auto team assignment, ready-up, host can force-start
  - `GameRoom`: fixed timestep game loop at 20 ticks/sec, input queuing, map initialization
  - State schemas: `GameState`, `Player`, `Minion`, `Team`, `Base`, `CentralObjective`
  - `MovementSystem`: player move-to-target with speed-limited interpolation
  - `CombatSystem`: auto-attack nearest enemy in range, damage application, player death/respawn, base destruction, team elimination
  - `MinionAI`: spawn waves on timer, walk→aggro→attack state machine, target prioritization
  - `WinCondition`: objective destroyed (most damage wins) or last team standing
  - `MapGenerator`: hardcoded 4-team radial layout with computed positions
- **Client**:
  - Phaser 3 game with Arcade Physics
  - `LobbyScene`: create/join room UI, player list by team, ready/start buttons, shareable link via URL params
  - `GameScene`: radial map rendering (circle with team slice dividers), entity management from Colyseus state, click-to-move input, camera follow
  - `HUDScene`: player HP, objective HP with percentage, per-team damage scoreboard
  - `PlayerSprite`: colored circle with HP bar and "YOU" tag, position interpolation
  - `MinionSprite`: small colored circle with interpolation
  - `ObjectiveSprite`: large circle with segmented HP bar by team color
  - `ColyseusClient`: singleton network manager for lobby and game room connections
- **Shared**: constants file (`server/src/shared/constants.ts`) with `sync.sh` to copy to client
- **Config**: `.gitignore`, TypeScript configs for both server and client

### Known Issues

- Client state listeners use `any` types instead of proper Colyseus schema types
- No obstacle avoidance for minion pathfinding (walks straight to center)
