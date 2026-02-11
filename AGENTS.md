# Agents

This file describes the AI agents that have contributed to this project and their roles.

## Claude (Opus 4.6)

**Role**: Primary development agent for initial scaffolding and architecture.

### What was done

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

### What was NOT done

- No actual gameplay testing with multiple connected clients
- No bug fixes beyond type errors caught by `tsc`
- No real art, tilemaps, or Tiled integration
- No client-side prediction or interpolation tuning

### Patterns and conventions established

- Server-authoritative model: clients send inputs, server validates and broadcasts state
- Fixed timestep game loop at 20 ticks/second
- Systems architecture: MovementSystem, CombatSystem, MinionAI, WinCondition as pure functions operating on GameState
- Client sprites wrap Phaser game objects and update via `updateFromState()` from Colyseus state listeners
- Shared constants live in `server/src/shared/` and sync to `client/src/shared/` via `sync.sh`
