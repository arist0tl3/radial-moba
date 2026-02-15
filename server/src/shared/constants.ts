// Shared constants — source of truth lives in server/src/shared/
// Run `npm run sync` from the project root to copy to client/src/shared/

export const TICK_RATE = 20; // Server ticks per second
export const TICK_INTERVAL = 1000 / TICK_RATE;

// Map
export const MAP_RADIUS = 9000; // pixels from center to edge
export const TILE_SIZE = 32;
export const NUM_TEAMS = 4; // Hardcoded for MVP

// Central objective
export const OBJECTIVE_HP = 10000;
export const OBJECTIVE_RADIUS = 112;
export const OBJECTIVE_ATTACK_DAMAGE = 50;
export const OBJECTIVE_ATTACK_RANGE = 440;
export const OBJECTIVE_ATTACK_COOLDOWN = 1000; // ms

// Team bases
export const BASE_HP = 3000;
export const BASE_RADIUS = 84;
export const BASE_ATTACK_DAMAGE = 40;
export const BASE_ATTACK_RANGE = 350;
export const BASE_ATTACK_COOLDOWN = 1500; // ms

// Player
export const PLAYER_HP = 500;
export const PLAYER_SPEED = 130; // pixels per second
export const PLAYER_ATTACK_DAMAGE = 50;
export const PLAYER_ATTACK_RANGE = 105; // pixels
export const PLAYER_ATTACK_COOLDOWN = 1000; // ms
export const PLAYER_ABILITY_DAMAGE = 120;
export const PLAYER_ABILITY_RANGE = 350;
export const PLAYER_ABILITY_COOLDOWN = 5000; // ms
export const PLAYER_RESPAWN_BASE = 5000; // ms, increases with deaths
export const PLAYER_COLLISION_RADIUS = 24;
export const PLAYER_REGEN_PER_SEC = 2; // Baseline HP regen per second
export const PLAYER_BASE_REGEN_PER_SEC = 10; // Boosted regen when near own base
export const PLAYER_BASE_REGEN_RANGE = 350; // Distance from base center for boosted regen

// Minions
export const MINION_SPEED = 80;
export const MINION_AGGRO_RANGE = 260;
export const MINION_SPAWN_INTERVAL = 10000; // ms
export const MINION_COLLISION_RADIUS = 14;

// Melee minions
export const MELEE_MINION_HP = 250;
export const MELEE_MINION_ATTACK_DAMAGE = 20;
export const MELEE_MINION_ATTACK_RANGE = 35;
export const MELEE_MINION_ATTACK_COOLDOWN = 1500; // ms
export const MELEE_MINION_COLLISION_RADIUS = 14;
export const MELEE_MINIONS_PER_WAVE = 3;

// Caster minions
export const CASTER_MINION_HP = 150;
export const CASTER_MINION_ATTACK_DAMAGE = 30;
export const CASTER_MINION_ATTACK_RANGE = 200;
export const CASTER_MINION_ATTACK_COOLDOWN = 2000; // ms
export const CASTER_MINION_COLLISION_RADIUS = 12;
export const CASTER_MINION_PROJECTILE_SPEED = 350;
export const CASTER_MINIONS_PER_WAVE = 2;

// Teams
export const PLAYERS_PER_TEAM = 3;
export const TEAM_COLORS = [0xff4444, 0x4444ff, 0x44ff44, 0xffff44] as const;
export const TEAM_COLOR_STRINGS = ['#ff4444', '#4444ff', '#44ff44', '#ffff44'] as const;

// Objective minions
export const OBJECTIVE_MINION_SPAWN_INTERVAL = 45000; // ms — slightly slower than team minions
export const OBJECTIVE_MINIONS_PER_BASE = 3; // spawned per active base each wave

// Projectiles
export const PROJECTILE_SPEED = 400; // pixels per second

// Lane towers (neutral)
export const TOWER_HP = 2500;
export const TOWER_RADIUS = 56;
export const TOWER_ATTACK_DAMAGE = 80;
export const TOWER_ATTACK_RANGE = 350;
export const TOWER_ATTACK_COOLDOWN = 1000; // ms
export const TOWER_RADIUS_PERCENT = 0.50; // Position at 50% between base and center
export const TOWER_MINION_SPAWN_INTERVAL = 15000; // ms
export const TOWER_MINIONS_PER_WAVE = 4;

// Bots
export const BOT_SCAN_RANGE = 1200; // How far bots look for targets
export const BOT_RETREAT_HP_PERCENT = 0.3; // Retreat below 30% HP
export const BOT_STRUCTURE_SAFE_DIST = 120; // Extra buffer beyond structure attack range
export const BOT_MINION_ESCORT_RANGE = 700; // Friendly minions must be this close to structure
export const BOT_DECISION_INTERVAL = 2000; // ms — re-evaluate targets every 2 seconds
export const BOT_BASE_DEFEND_RANGE = 900; // How close enemies must be to own base to trigger defense

// Leveling
export const XP_PER_MINION_KILL = 30;
export const XP_PER_PLAYER_KILL = 100;
export const XP_PER_STRUCTURE_HIT = 5;
export const XP_PER_TOWER_KILL = 200;
export const XP_BASE = 80;
export const XP_PER_LEVEL = 50;
export const MAX_LEVEL = 10;
export const LEVEL_BONUS_DAMAGE = 15;
export const LEVEL_BONUS_MAX_HP = 75;
export const LEVEL_BONUS_SPEED = 10;
export const LEVEL_BONUS_REGEN = 2;
export const LEVEL_BONUS_DEFENSE = 8;

// Lobby
export const MAX_TEAMS = 4;
export const MIN_TEAMS = 2;
