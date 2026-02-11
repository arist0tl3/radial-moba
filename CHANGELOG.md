# Changelog

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

- Lobby→game handoff creates separate game rooms per client (players can't see each other)
- Client state listeners use `any` types instead of proper Colyseus schema types
- No obstacle avoidance for minion pathfinding (walks straight to center)
- No reconnection handling on disconnect
