// Shared constants — source of truth lives in server/src/shared/
// Run `npm run sync` from the project root to copy to client/src/shared/

export const TICK_RATE = 20; // Server ticks per second
export const TICK_INTERVAL = 1000 / TICK_RATE;

// Map
export const MAP_RADIUS = 2000; // pixels from center to edge
export const TILE_SIZE = 32;
export const NUM_TEAMS = 4; // Hardcoded for MVP

// Central objective
export const OBJECTIVE_HP = 10000;
export const OBJECTIVE_RADIUS = 64;

// Team bases
export const BASE_HP = 3000;
export const BASE_RADIUS = 48;

// Player
export const PLAYER_HP = 500;
export const PLAYER_SPEED = 150; // pixels per second
export const PLAYER_ATTACK_DAMAGE = 50;
export const PLAYER_ATTACK_RANGE = 60; // pixels
export const PLAYER_ATTACK_COOLDOWN = 1000; // ms
export const PLAYER_ABILITY_DAMAGE = 120;
export const PLAYER_ABILITY_RANGE = 200;
export const PLAYER_ABILITY_COOLDOWN = 5000; // ms
export const PLAYER_RESPAWN_BASE = 5000; // ms, increases with deaths

// Minions
export const MINION_HP = 200;
export const MINION_SPEED = 80;
export const MINION_ATTACK_DAMAGE = 20;
export const MINION_ATTACK_RANGE = 40;
export const MINION_ATTACK_COOLDOWN = 1500; // ms
export const MINION_AGGRO_RANGE = 150;
export const MINION_SPAWN_INTERVAL = 30000; // ms
export const MINIONS_PER_WAVE = 3;

// Teams
export const PLAYERS_PER_TEAM = 3;
export const TEAM_COLORS = [0xff4444, 0x4444ff, 0x44ff44, 0xffff44] as const;
export const TEAM_COLOR_STRINGS = ['#ff4444', '#4444ff', '#44ff44', '#ffff44'] as const;

// Lobby
export const MAX_TEAMS = 4;
export const MIN_TEAMS = 2;
