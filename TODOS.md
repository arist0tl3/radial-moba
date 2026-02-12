# TODOs

## Critical — Must fix before playable

- [x] **Lobby→Game handoff bug**: Fixed — LobbyRoom creates GameRoom server-side via `matchMaker.createRoom()`, clients join by ID
- [ ] **Colyseus schema registration**: Client-side state listeners use `any` types. Need to verify schema classes are properly registered on the client or use Colyseus schema codegen.

## Phase 1 — Walking Around Together

- [x] Fix lobby→game transition so all players join the same GameRoom
- [x] Verify click-to-move works with multiple players seeing each other
- [ ] Tune client-side interpolation (lerp factor, buffer server states)
- [x] Add camera zoom controls (scroll wheel)
- [x] Handle browser tab close / disconnect gracefully
- [x] Handle browser refresh reconnection (sessionStorage)

## Phase 2 — Central Objective

- [x] Verify auto-attack triggers when player walks into range of objective
- [x] Test damage tracking per team shows correctly on HUD
- [x] Implement segmented HP bar on objective
- [ ] Add victory screen with "Play Again" / "Return to Lobby" options
- [ ] Test win condition: objective destroyed → correct team wins

## Phase 3 — Bases & Elimination

- [ ] Test base destruction eliminates a team
- [ ] Test eliminated team's players can't respawn
- [ ] Test last-team-standing win condition
- [ ] Test both win conditions work together (edge cases)
- [ ] Visual feedback for base under attack

## Phase 4 — Minions

- [ ] Verify minion spawning every 30 seconds
- [ ] Test minion pathfinding (currently walks straight to center — no obstacle avoidance)
- [ ] Test minion aggro and target acquisition
- [ ] Test minion interaction with objective and bases
- [ ] Integrate pathfinding.js for proper grid-based pathing when map has walls

## Phase 5 — Hero Ability & Combat Feel

- [ ] Implement one active ability (skillshot or AOE)
- [ ] Cooldown system and HUD indicator
- [ ] Player death and respawn with increasing timers
- [ ] Health bars above all units
- [ ] Damage numbers (floating text)
- [ ] Death animations

## Phase 6 — Real Map & Art

- [ ] Design map slice in Tiled
- [ ] Implement map generation from slice template
- [ ] Replace placeholder circles with sprite art
- [ ] Minimap rendering
- [ ] Lobby UI polish

## Tech Debt / Improvements

- [ ] Replace `any` types in client state listeners with proper Colyseus schema types
- [x] Add error handling for WebSocket disconnects
- [x] Add reconnection support (network drops + browser refresh)
- [ ] Client-side prediction for local player movement
- [ ] Server-side validation of move targets (bounds checking, speed hacking prevention)
- [ ] Consider code-splitting Phaser to reduce bundle size (1.5MB)
