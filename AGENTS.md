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

### What was NOT done (as of Session 2)

- No Colyseus schema codegen — client state listeners still use `any` types
- No real art, tilemaps, or Tiled integration
- No client-side prediction or interpolation tuning
- No ability system implementation
- No minion pathfinding improvements (still walks straight to center)

### Patterns and conventions established

- Server-authoritative model: clients send inputs, server validates and broadcasts state
- Fixed timestep game loop at 20 ticks/second
- Systems architecture: MovementSystem, CombatSystem, MinionAI, WinCondition as pure functions operating on GameState
- Client sprites wrap Phaser game objects and update via `updateFromState()` from Colyseus state listeners
- Shared constants live in `server/src/shared/` and sync to `client/src/shared/` via `sync.sh`
- Reconnection uses `sessionStorage` for browser-refresh survival and in-memory tokens for network-drop recovery
