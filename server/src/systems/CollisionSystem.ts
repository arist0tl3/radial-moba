import { GameState } from '../state/GameState';
import {
  PLAYER_COLLISION_RADIUS,
  MINION_COLLISION_RADIUS,
  OBJECTIVE_RADIUS,
  BASE_RADIUS,
} from '../shared/constants';

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

/**
 * Push two mobile entities apart equally along their connecting axis.
 */
function separatePair(
  a: { x: number; y: number },
  b: { x: number; y: number },
  radiusA: number,
  radiusB: number
) {
  const dist = distance(a.x, a.y, b.x, b.y);
  const minDist = radiusA + radiusB;
  if (dist >= minDist || dist === 0) return;

  const overlap = minDist - dist;
  const nx = (b.x - a.x) / dist;
  const ny = (b.y - a.y) / dist;
  const half = overlap / 2;

  a.x -= nx * half;
  a.y -= ny * half;
  b.x += nx * half;
  b.y += ny * half;
}

/**
 * Push a mobile entity away from a static object.
 */
function separateFromStatic(
  mobile: { x: number; y: number },
  staticObj: { x: number; y: number },
  mobileRadius: number,
  staticRadius: number
) {
  const dist = distance(mobile.x, mobile.y, staticObj.x, staticObj.y);
  const minDist = mobileRadius + staticRadius;
  if (dist >= minDist || dist === 0) return;

  const overlap = minDist - dist;
  const nx = (mobile.x - staticObj.x) / dist;
  const ny = (mobile.y - staticObj.y) / dist;

  mobile.x += nx * overlap;
  mobile.y += ny * overlap;
}

export function updateCollisions(state: GameState) {
  const players = Array.from(state.players.values()).filter((p) => p.alive);
  const minions = Array.from(state.minions.values()).filter((m) => m.hp > 0);

  // Player ↔ Player
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      separatePair(players[i], players[j], PLAYER_COLLISION_RADIUS, PLAYER_COLLISION_RADIUS);
    }
  }

  // Player ↔ Minion
  for (const player of players) {
    for (const minion of minions) {
      separatePair(player, minion, PLAYER_COLLISION_RADIUS, MINION_COLLISION_RADIUS);
    }
  }

  // Minion ↔ Minion
  for (let i = 0; i < minions.length; i++) {
    for (let j = i + 1; j < minions.length; j++) {
      separatePair(minions[i], minions[j], MINION_COLLISION_RADIUS, MINION_COLLISION_RADIUS);
    }
  }

  // Player ↔ Objective (static)
  if (state.objective.hp > 0) {
    for (const player of players) {
      separateFromStatic(player, state.objective, PLAYER_COLLISION_RADIUS, OBJECTIVE_RADIUS);
    }
  }

  // Minion ↔ Objective (static)
  if (state.objective.hp > 0) {
    for (const minion of minions) {
      separateFromStatic(minion, state.objective, MINION_COLLISION_RADIUS, OBJECTIVE_RADIUS);
    }
  }

  // Player ↔ Enemy Bases (static, skip own team's base)
  state.bases.forEach((base) => {
    if (base.destroyed) return;
    for (const player of players) {
      if (player.teamIndex === base.teamIndex) continue;
      separateFromStatic(player, base, PLAYER_COLLISION_RADIUS, BASE_RADIUS);
    }
  });

  // Minion ↔ Enemy Bases (static, skip own team's base)
  state.bases.forEach((base) => {
    if (base.destroyed) return;
    for (const minion of minions) {
      if (minion.teamIndex === base.teamIndex) continue;
      separateFromStatic(minion, base, MINION_COLLISION_RADIUS, BASE_RADIUS);
    }
  });
}
