# Radial MOBA — Agent Handoff Document

## What We're Building

A free, browser-based multiplayer online battle arena (MOBA) with a core twist: instead of two teams pushing lanes against each other, **2–9 teams of 3–5 players spawn around the edges of a radial map and fight inward toward a central objective**. The team that deals the most damage to the central objective — or destroys all competing bases — wins.

The game runs entirely in the browser. No downloads, no installs. Send a link, join a game.

---

## Core Differentiator — Never Lose Sight of This

The game's identity is **"MOBA but everyone fights toward the middle."**

Every design and architecture decision should reinforce this. The radial map, the central objective, the variable team count — these aren't features, they're the game. If a decision makes this feel more like a traditional two-team lane MOBA, it's the wrong decision.

What this creates that traditional MOBAs don't:

- **Emergent diplomacy**: Do you rush center? Attack a neighbor? Two weak teams implicitly gang up on a strong one. No diplomacy system needed — it emerges from the structure.
- **Natural game clock**: The central objective is always taking damage from everyone. Games end.
- **Flexible player count**: 2 teams of 5 plays competitive. 9 teams of 3 plays chaotic Friday-night energy. The map just divides into more or fewer slices.
- **One-sentence pitch**: Anyone can understand the game in 5 seconds.

---

## MVP Scope — Brutally Simple

The goal of the MVP is to **prove that two things work**:

1. **The central objective race** — multiple teams can see each other's damage, it feels tense, and there's a clear winner.
2. **Base destruction as an alternative win condition** — a team can choose to attack a neighbor's base instead of the center, and eliminating a team works correctly.

### What's IN the MVP

- **1 hero type**: Everyone plays the same character. Melee auto-attack + 1 active ability (a simple skillshot or AOE). No hero selection screen, no balance concerns.
- **1 minion type**: Basic melee minion that spawns from each team's base and walks inward toward the center objective. Simple state machine: spawn → walk toward center → attack nearest enemy or objective → die.
- **2–4 teams** (expand to 9 later, but start with fewer for easier testing).
- **3 players per team** (hardcoded for MVP).
- **Radial map**: A circle divided into equal slices. Each team gets a slice with a base at the outer edge. Central objective in the middle. Walls or terrain creating a single lane per team pointing inward.
- **Central objective**: A big thing in the middle with a large HP pool. Tracks damage-per-team. Displays a scoreboard or health bar segmented by team color.
- **Team bases**: Destructible. When destroyed, that team is eliminated. Their minions stop spawning.
- **Win conditions**: (a) Central objective destroyed → team with most damage wins, or (b) Last team standing.
- **Basic HUD**: Health bar, ability cooldown, minimap showing team positions, damage scoreboard for the central objective.
- **Lobby system**: Create a room, get a shareable link, friends join, host starts the game.

### What's NOT in the MVP

- Multiple hero types or hero selection
- Items, gold, or a shop
- Jungle, neutral monsters, or buffs
- Fog of war
- Multiple minion types
- Chat or ping system
- Matchmaking or ranking
- Persistence, accounts, or progression
- Sound or music
- Polish, particles, screen shake (add later, it matters, but not now)

---

## Tech Stack — Borrow Everything

The guiding principle: **never re-invent something that already exists.** Use established libraries for every hard problem. Write custom code only for game-specific logic that doesn't exist elsewhere.

### Core Stack

| Layer | Tool | Why |
|-------|------|-----|
| **Game server** | [Colyseus](https://colyseus.io/) (Node.js) | Handles rooms, state sync, player lifecycle, reconnection. Solves the hardest multiplayer problems out of the box. |
| **Client rendering** | [Phaser 3](https://phaser.io/) | Mature HTML5 game framework. Handles rendering, input, camera, tilemaps. Huge community and plugin ecosystem. |
| **Map editor** | [Tiled](https://www.mapeditor.org/) | Free visual tilemap editor. Phaser has native Tiled import. Design the map visually, not in code. |
| **Pathfinding** | [pathfinding.js](https://github.com/qiao/PathFinding.js) | A*, jump point search, grid-based. Drop-in solution for minion and hero movement on the tilemap. |
| **Collision** | Phaser Arcade Physics | Built into Phaser. Good enough for a top-down MOBA. Don't need SAT.js unless you have complex shapes. |
| **Client-server transport** | Colyseus client SDK | WebSocket-based, pairs with Colyseus server. Don't use raw Socket.io — Colyseus wraps it with state sync. |
| **Art assets** | [Kenney.nl](https://kenney.nl/), [OpenGameArt.org](https://opengameart.org/), [itch.io asset packs](https://itch.io/game-assets) | Free, high-quality, commercially usable. Top-down RPG/fantasy packs work great. |

### What NOT to use

- **Don't use raw Socket.io** — Colyseus gives you state synchronization, room management, and reconnection for free. Socket.io is a transport layer; Colyseus is a game server.
- **Don't use a database for MVP** — All game state lives in memory on the Colyseus server. No persistence needed yet.
- **Don't build your own ECS** — Colyseus schemas handle entity state. If you outgrow them later, adopt bitECS. Don't start there.
- **Don't write your own physics** — Phaser Arcade Physics is fine. You're making a MOBA, not a physics sim.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   Browser Client                 │
│                                                  │
│  Phaser 3 (rendering, input, camera, tilemaps)   │
│  Colyseus Client SDK (state sync, messages)      │
│  pathfinding.js (client-side prediction)         │
└──────────────────────┬──────────────────────────┘
                       │ WebSocket
┌──────────────────────┴──────────────────────────┐
│                 Colyseus Server                   │
│                                                  │
│  Room: GameRoom                                  │
│  ├── State: GameState (schema)                   │
│  │   ├── players: MapSchema<Player>              │
│  │   ├── minions: MapSchema<Minion>              │
│  │   ├── teams: MapSchema<Team>                  │
│  │   ├── centralObjective: CentralObjective      │
│  │   └── bases: MapSchema<Base>                  │
│  ├── Game loop (fixed timestep, e.g. 20 ticks/s)│
│  ├── pathfinding.js (authoritative movement)     │
│  └── Collision detection (server-authoritative)  │
│                                                  │
│  Room: LobbyRoom                                 │
│  └── Pre-game team assignment, ready-up, start   │
└──────────────────────────────────────────────────┘
```

### Server-Authoritative Model

The server owns all game state. Clients send **inputs** (move commands, ability activations), not state updates. The server validates inputs, simulates the game, and broadcasts state.

This prevents cheating and ensures consistency across clients. It's the only sane model for a competitive multiplayer game.

### Fixed Timestep Game Loop

The server runs a fixed-rate game loop (recommend 20 ticks/second to start). Every tick:

1. Process queued player inputs
2. Update minion AI (move, acquire target, attack)
3. Resolve combat (damage, deaths)
4. Check win conditions
5. Colyseus auto-broadcasts state delta to clients

### Client-Side Prediction (Solve Later, But Plan For It)

For MVP, the client can just render the server state with interpolation. It'll feel slightly laggy but playable for friends on decent connections.

Later, add client-side prediction for the local player's movement: immediately move the player on input, then reconcile when the server confirms. Colyseus doesn't have this built in (unlike Lance.gg), so you'll need to implement it. But **don't do this in MVP** — it's a major complexity increase. Get the game working first.

---

## Hard Problems & How to Solve Them

### 1. Radial Map Generation

**Problem**: The map needs to be rotationally symmetric with a variable number of team slices.

**Approach**: Design a single "slice" template in Tiled — one team's lane from their base to the center. At room creation time, generate the full map by rotating and tiling N copies of the slice. This means:

- Design one slice in Tiled (base → lane → center approach)
- Write a map generator that takes N (number of teams) and produces the full tilemap by rotating the slice
- The center area is shared and static — place it once
- Walls between slices create natural lanes and prevent easy flanking early

Start with a hardcoded 4-team map if procedural generation feels too complex for MVP. You can always make it dynamic later.

### 2. Netcode & State Synchronization

**Problem**: Multiple players seeing a consistent game world in real-time.

**Solution**: Colyseus handles this. Define your state as Colyseus schemas, mutate state on the server, and Colyseus automatically computes and sends deltas to clients.

Key decisions:
- **Tick rate**: 20/s is a good starting point. Higher = smoother but more bandwidth.
- **Interpolation**: Clients should interpolate between received states to smooth rendering. Phaser doesn't do this natively, but it's straightforward — buffer the last 2 server states and lerp positions between them.
- **Input handling**: Clients send `{ type: "move", x, y }` or `{ type: "ability", targetX, targetY }` messages. Server validates and processes them on the next tick.

### 3. Minion AI

**Problem**: Minions need to spawn, path toward the center, and fight.

**Solution**: Simple finite state machine, run on the server:

```
SPAWNING → WALKING → ATTACKING → DEAD
```

- **SPAWNING**: Created at base, brief invulnerability
- **WALKING**: Use pathfinding.js to navigate toward the center objective. Recalculate path periodically (not every tick — expensive).
- **ATTACKING**: When an enemy (player, minion, or objective) enters aggro range, switch to attacking. Priority: enemy players > enemy minions > central objective. Melee range, fixed damage per tick.
- **DEAD**: Remove from state after death animation delay.

Spawn waves on a timer (every 30–45 seconds). Each team spawns the same number.

### 4. Central Objective Damage Tracking

**Problem**: Multiple teams damaging one thing; need to track who did how much.

**Solution**: The `CentralObjective` schema holds:

```
{
  hp: number,
  maxHp: number,
  damageByTeam: MapSchema<number>  // teamId → total damage dealt
}
```

Every time damage is dealt, increment both `hp` reduction and the dealing team's `damageByTeam` entry. Broadcast this — clients render it as a segmented health bar or scoreboard.

### 5. Win Condition Resolution

Two win conditions, checked every tick:

1. **Central objective destroyed**: `hp <= 0` → team with highest `damageByTeam` wins.
2. **Last team standing**: If only one team has a surviving base → that team wins.

Edge case: What if the last two teams destroy each other's bases on the same tick? Resolve by damage dealt to central objective as tiebreaker.

---

## Project Structure

```
radial-moba/
├── server/
│   ├── src/
│   │   ├── index.ts              # Colyseus server setup
│   │   ├── rooms/
│   │   │   ├── GameRoom.ts       # Main game room logic + game loop
│   │   │   └── LobbyRoom.ts     # Pre-game lobby
│   │   ├── state/
│   │   │   ├── GameState.ts      # Colyseus schema definitions
│   │   │   ├── Player.ts
│   │   │   ├── Minion.ts
│   │   │   ├── Team.ts
│   │   │   ├── Base.ts
│   │   │   └── CentralObjective.ts
│   │   ├── systems/
│   │   │   ├── CombatSystem.ts   # Damage resolution
│   │   │   ├── MinionAI.ts       # Minion state machine
│   │   │   ├── MovementSystem.ts # Pathfinding + movement
│   │   │   └── WinCondition.ts   # Victory checks
│   │   └── maps/
│   │       └── MapGenerator.ts   # Radial map assembly
│   └── package.json
├── client/
│   ├── src/
│   │   ├── index.ts              # Entry point
│   │   ├── scenes/
│   │   │   ├── LobbyScene.ts     # Room join UI
│   │   │   ├── GameScene.ts      # Main game rendering
│   │   │   └── HUDScene.ts       # Overlay: HP, minimap, scores
│   │   ├── network/
│   │   │   └── ColyseusClient.ts # Server connection + state listeners
│   │   └── entities/
│   │       ├── PlayerSprite.ts   # Player rendering + input
│   │       ├── MinionSprite.ts   # Minion rendering
│   │       └── ObjectiveSprite.ts
│   ├── assets/                   # Tilesets, sprites (from Kenney/OpenGameArt)
│   └── package.json
├── shared/
│   └── constants.ts              # Shared config: tick rate, speeds, damage values
└── maps/
    └── slice.tmx                 # Tiled map template for one team's slice
```

---

## Implementation Order

Build in this order. Each step should be playable/testable before moving to the next.

### Phase 1: Walking Around Together
1. Scaffold Colyseus server + Phaser client
2. Implement LobbyRoom: create room → get link → friends join → assign teams
3. Implement basic GameRoom: players connect, spawn at positions
4. Render a placeholder map (colored rectangles, no tilemap yet)
5. Player movement: click-to-move input → server validates → broadcasts position
6. Client interpolation: smooth movement between server updates

**Milestone**: Multiple browser windows showing players moving on the same map.

### Phase 2: The Central Objective
7. Add CentralObjective to the center of the map with an HP pool
8. Players can attack it (walk into melee range, auto-attack)
9. Damage tracking per team
10. HUD: Show objective HP bar segmented by team color
11. Win condition: objective dies → highest damage team wins → show victory screen

**Milestone**: Two teams can race to damage the center thing. A winner is declared.

### Phase 3: Bases & Elimination
12. Add team bases at the outer edge
13. Bases are attackable and destructible
14. When a base dies, that team is eliminated (players removed, minions stop)
15. Win condition: last team standing
16. Both win conditions work together

**Milestone**: Teams can choose to attack the center OR attack each other's bases.

### Phase 4: Minions
17. Spawn minion waves on a timer from each base
18. Minions path toward center using pathfinding.js
19. Minion combat AI (attack enemies in range, then resume pathing)
20. Minions interact with central objective (they attack it too)
21. Minions interact with bases (they attack enemy bases they encounter)

**Milestone**: The map feels alive. Minion waves create natural frontlines.

### Phase 5: Hero Ability & Combat Feel
22. Add one active ability (e.g., a skillshot projectile or AOE slam)
23. Cooldown system
24. Player death and respawn (with increasing respawn timers)
25. Basic combat feel: health bars above units, damage numbers, death animations

**Milestone**: It feels like a game, not a tech demo.

### Phase 6: Real Map & Art
26. Design the map slice in Tiled with real tileset art
27. Implement map generation (rotate slices based on team count)
28. Replace placeholder sprites with real art assets
29. Minimap rendering
30. Polish the lobby UI

**Milestone**: It looks like a game. You'd show it to someone.

---

## Key Technical Decisions to Make Early

1. **TypeScript vs JavaScript**: Use TypeScript. The Colyseus schema system benefits enormously from types, and the codebase will grow. Worth the setup cost.

2. **Monorepo structure**: Keep server, client, and shared code in one repo. Use a `shared/` directory for constants, types, and any logic used by both (e.g., damage formulas, movement speed values).

3. **Tick rate**: Start at 20/s. Easy to adjust later. Don't optimize prematurely.

4. **Map coordinate system**: Use a grid-based system that aligns with the tilemap. Pathfinding.js works on grids. Don't use continuous coordinates for pathfinding — convert to grid, pathfind, convert back.

5. **Entity IDs**: Colyseus MapSchema keys are strings. Use UUIDs or auto-incrementing IDs for players and minions. Don't use player names or session IDs as entity keys.

---

## Reference Projects to Study

- **[Colyseus examples](https://github.com/colyseus/colyseus-examples)** — Official example rooms, including a basic game room with state sync.
- **[Phaser 3 examples](https://phaser.io/examples)** — Hundreds of examples for every Phaser feature.
- **[BrowserQuest](https://github.com/mozilla/BrowserQuest)** — Mozilla's open-source multiplayer HTML5 game. The client-server architecture is a clean reference.
- **[Adversator](https://www.adversator.com/)** — A live browser MOBA. Play it. Note what works and what doesn't.
- **Search GitHub for "colyseus phaser"** — Multiple starter templates and small games combining these two.
- **[Lance.gg](https://lance.gg/)** — Study the client-side prediction and server reconciliation code even if you don't use the framework.

---

## Hosting (For When You're Ready)

The MVP needs a Node.js server with WebSocket support. Options:

- **[Fly.io](https://fly.io/)** — Free tier available, good WebSocket support, easy deploys. Start here.
- **[Railway](https://railway.app/)** — Similar to Fly, simple Node.js hosting.
- **[Hetzner](https://www.hetzner.com/)** — Cheap VPS (~€4/mo) if you want more control.
- **Localhost** — For development and friend testing, just run the server locally and use a tool like ngrok or Tailscale to let friends connect.

Don't worry about hosting until Phase 2 is complete. Develop locally.

---

## Things the Original Designer Wants You to Know

- **This is a game for playing with friends, not a competitive esport.** Optimize for fun and accessibility over balance and depth. It should be easy to join, fast to start, and chaotic to play.
- **The radial/multi-team design IS the game.** Every decision should reinforce the feeling of converging on the center. If something feels like a standard two-team MOBA, rethink it.
- **Keep it simple until it's fun.** One hero, one minion, one ability. If the core loop of "race to the center while defending your base" is fun with rectangles and circles, the game will be great with real art. If it's not fun with rectangles and circles, more content won't save it.
- **Solve the hard problems well.** Netcode that feels responsive. State sync that never desyncs. A game loop that's deterministic. These are the foundations everything else is built on. Don't rush them.
