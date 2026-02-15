# Radial MOBA

A free, browser-based multiplayer online battle arena where 2–9 teams spawn around the edges of a radial map and fight inward toward a central objective. No downloads, no installs — send a link, join a game.

## How it works

The map is a circle divided into equal slices. Each team gets a slice with a base at the outer edge and a lane pointing inward. A central objective sits in the middle with a large HP pool. The team that deals the most damage to it — or destroys all competing bases — wins.

## Tech stack

| Layer | Tool |
|-------|------|
| Game server | [Colyseus](https://colyseus.io/) (Node.js) |
| Client rendering | [Phaser 3](https://phaser.io/) |
| Client bundler | [Vite](https://vite.dev/) |
| Language | TypeScript |

## Getting started

```bash
# Install dependencies (--strict-ssl=false may be needed depending on your environment)
cd server && npm install
cd ../client && npm install

# Sync shared constants from server to client
cd .. && ./sync.sh

# Terminal 1 — start the server
cd server && npm run dev

# Terminal 2 — start the client
cd client && npm run dev
```

Server runs on `http://localhost:2567`, client on `http://localhost:3000`.

## Project structure

```
├── server/          # Colyseus game server
│   └── src/
│       ├── rooms/   # LobbyRoom, GameRoom
│       ├── state/   # Colyseus schema definitions
│       ├── systems/ # Movement, Combat, MinionAI, BotAI, Collision, WinCondition
│       └── shared/  # Constants (source of truth)
├── client/          # Phaser 3 + Vite client
│   └── src/
│       ├── scenes/  # Preload, Lobby, Game, HUD
│       ├── entities/# Player, Minion, Objective sprites
│       ├── network/ # Colyseus client wrapper
│       └── shared/  # Constants (synced copy)
└── sync.sh          # Copies shared/ from server to client
```

## Asset Acknowledgements

This project uses the following free asset packs:

- **[Tiny RPG Character Asset Pack](https://zerie.itch.io/tiny-rpg-character-asset-pack)** by Zerie — Soldier and Orc spritesheets used for player and minion animations
- **[Pixel Art Top Down - Basic](https://cainos.itch.io/pixel-art-top-down-basic)** by Cainos — Props and structure sprites used for bases and the central objective
- **[Cursor Pack](https://kenney-assets.itch.io/cursor-pack)** by Kenny Assets - Cursor sprites

## Status

Early MVP. See [TODOS.md](./TODOS.md) for the full task list and [CHANGELOG.md](./CHANGELOG.md) for what's been built so far.

## Screenshots

### Feb 11, 2026

<img width="780" height="551" alt="image" src="https://github.com/user-attachments/assets/a3866fe0-a637-435d-ad4f-2340dace4e00" />

### Feb 12, 2026

<img width="1440" height="708" alt="image" src="https://github.com/user-attachments/assets/d9828803-2c1e-4eed-8ca1-308cf9d9207e" />

### Feb 13, 2026

<img width="1436" height="694" alt="image" src="https://github.com/user-attachments/assets/50a10654-26c3-4ed5-9c8c-3a060193a328" />

### Feb 15, 2026

<img width="1437" height="697" alt="image" src="https://github.com/user-attachments/assets/c7566b59-de11-4f1d-ac1f-ff5469f891ae" />
