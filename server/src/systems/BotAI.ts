import { GameState } from '../state/GameState';
import { Player } from '../state/Player';
import {
  BOT_SCAN_RANGE,
  PLAYER_ATTACK_RANGE,
  OBJECTIVE_RADIUS,
  BASE_RADIUS,
} from '../shared/constants';

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

/**
 * Check whether the bot's current attack target is still valid (alive/exists).
 */
function isTargetValid(state: GameState, targetId: string): boolean {
  if (targetId === 'objective') {
    return state.objective.hp > 0;
  }

  if (targetId.startsWith('base_')) {
    const teamIndex = parseInt(targetId.replace('base_', ''), 10);
    const base = state.bases.get(String(teamIndex));
    return !!base && !base.destroyed;
  }

  const player = state.players.get(targetId);
  if (player && player.alive) return true;

  const minion = state.minions.get(targetId);
  if (minion && minion.hp > 0) return true;

  return false;
}

/**
 * Find the best target for a bot to attack.
 * Priority: enemy players > enemy minions > enemy bases > objective
 */
function findBotTarget(state: GameState, bot: Player): string {
  let nearestId = '';
  let nearestDist = Infinity;

  // 1. Nearest enemy player within scan range
  state.players.forEach((other, key) => {
    if (!other.alive || other.teamIndex === bot.teamIndex) return;
    const dist = distance(bot.x, bot.y, other.x, other.y);
    if (dist < BOT_SCAN_RANGE && dist < nearestDist) {
      nearestDist = dist;
      nearestId = key;
    }
  });
  if (nearestId) return nearestId;

  // 2. Nearest enemy minion within scan range
  nearestDist = Infinity;
  state.minions.forEach((minion, key) => {
    if (minion.teamIndex === bot.teamIndex || minion.hp <= 0) return;
    const dist = distance(bot.x, bot.y, minion.x, minion.y);
    if (dist < BOT_SCAN_RANGE && dist < nearestDist) {
      nearestDist = dist;
      nearestId = key;
    }
  });
  if (nearestId) return nearestId;

  // 3. Nearest enemy base (any distance — strategic target)
  nearestDist = Infinity;
  state.bases.forEach((base) => {
    if (base.teamIndex === bot.teamIndex || base.destroyed) return;
    const dist = distance(bot.x, bot.y, base.x, base.y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestId = `base_${base.teamIndex}`;
    }
  });
  if (nearestId) return nearestId;

  // 4. Central objective (always available as fallback)
  if (state.objective.hp > 0) {
    return 'objective';
  }

  return '';
}

export function updateBotAI(state: GameState, dt: number) {
  state.players.forEach((player) => {
    if (!player.isBot || !player.alive) return;

    // If current target is still valid, keep chasing it
    if (player.attackTargetId && isTargetValid(state, player.attackTargetId)) {
      // Check if a nearby enemy player appeared (higher priority interrupt)
      // Only re-evaluate if current target is NOT a player
      if (!state.players.has(player.attackTargetId)) {
        let nearbyEnemy = false;
        state.players.forEach((other) => {
          if (!other.alive || other.teamIndex === player.teamIndex) return;
          const dist = distance(player.x, player.y, other.x, other.y);
          if (dist < PLAYER_ATTACK_RANGE * 2) {
            nearbyEnemy = true;
          }
        });

        // If an enemy player is very close, re-evaluate targets
        if (nearbyEnemy) {
          player.attackTargetId = findBotTarget(state, player);
        }
      }
      return;
    }

    // Find a new target
    player.attackTargetId = findBotTarget(state, player);
  });
}
