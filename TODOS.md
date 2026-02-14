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
- [x] Add victory screen with "Return to Lobby" option
- [x] Test win condition: objective destroyed → correct team wins

## Phase 3 — Bases & Elimination

- [x] Base destruction captures base (sets `capturedByTeam`)
- [x] Captured base spawns minions for the capturing team
- [x] Team eliminated only when base destroyed AND all players dead
- [x] Base HP bars with team-colored fill
- [ ] Visual feedback for base under attack (shake, particles, etc.)

## Phase 4 — Minions

- [x] Verify minion spawning on timer
- [ ] Test minion pathfinding (currently walks straight to center — no obstacle avoidance)
- [x] Minion aggro and target acquisition working
- [x] Minion HP bars
- [x] Minion attack animations (orc-attack spritesheet)
- [ ] Integrate pathfinding.js for proper grid-based pathing when map has walls

## Phase 5 — Combat Polish

- [x] Collision detection (body blocking between all entities)
- [x] Auto-attack animations (soldier-attack, orc-attack)
- [x] Click-to-attack targeting with follow behavior
- [x] Custom cursors (pointer + sword for attack hover)
- [x] Damage numbers (floating text)
- [x] Death animations (minion orc-death animation)

## Phase 6 — AI & Gameplay

- [x] AI bot players fill empty teams on game start
- [x] Bot AI: target selection (players > minions > bases > objective)
- [x] Smarter bot AI: objective-based decision making (wait for minions, retreat when low HP, defend base, decision cooldown)
- [x] HP regeneration: baseline 2 HP/sec, boosted 10 HP/sec near own base
- [x] Defensive structures: bases and objective fire projectiles at attackers
- [x] Objective spawns minions that push toward bases
- [x] Neutral lane towers: 4 aggressive towers (1 per lane) at 50% radius, attack all teams, spawn hostile minions outward
- [x] Bot lane progression: bots clear own lane tower before pushing to bases/objective
- [x] Team minions aggro towers while walking to center
- [x] Hero level-up system (XP from kills, stat scaling, level-up choices)

## Phase 7 — Hero Ability & Combat Feel

- [ ] Implement one active ability (skillshot or AOE)
- [ ] Cooldown system and HUD indicator
- [ ] Health bars above all units (players done, minions done, bases done)

## Phase 8 — Real Map & Art

- [ ] Design map slice in Tiled
- [ ] Implement map generation from slice template
- [x] Replace placeholder circles with sprite art
- [x] Minimap rendering (with click-to-move)
- [ ] Lobby UI polish

## Next Priority — Fog of War

- [ ] Server-side vision system: each player/team only sees entities within their vision radius
- [ ] Client-side fog rendering: darken unseen areas, hide enemy entities outside vision
- [ ] Bot AI uses fog of war (can only target what they "see")

## Tech Debt / Improvements

- [ ] Replace `any` types in client state listeners with proper Colyseus schema types
- [x] Add error handling for WebSocket disconnects
- [x] Add reconnection support (network drops + browser refresh)
- [ ] Client-side prediction for local player movement
- [ ] Server-side validation of move targets (bounds checking, speed hacking prevention)
- [ ] Consider code-splitting Phaser to reduce bundle size (1.5MB)
