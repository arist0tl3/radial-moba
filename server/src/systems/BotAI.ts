import { GameState } from '../state/GameState';
import { Player } from '../state/Player';
import {
  BOT_SCAN_RANGE,
  BOT_RETREAT_HP_PERCENT,
  BOT_STRUCTURE_SAFE_DIST,
  BOT_MINION_ESCORT_RANGE,
  BOT_DECISION_INTERVAL,
  BOT_BASE_DEFEND_RANGE,
  PLAYER_ATTACK_RANGE,
  OBJECTIVE_RADIUS,
  OBJECTIVE_ATTACK_RANGE,
  BASE_RADIUS,
  BASE_ATTACK_RANGE,
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
 * Check if an enemy (player or minion) is near the bot's own base.
 * Returns the ID of the nearest threat, or empty string.
 */
function findBaseDefenseTarget(state: GameState, bot: Player): string {
  const base = state.bases.get(String(bot.teamIndex));
  if (!base || base.destroyed) return '';

  let nearestId = '';
  let nearestDist = BOT_BASE_DEFEND_RANGE;

  // Check enemy players near our base
  state.players.forEach((other, key) => {
    if (!other.alive || other.teamIndex === bot.teamIndex) return;
    const dist = distance(base.x, base.y, other.x, other.y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestId = key;
    }
  });

  // Check enemy minions near our base
  state.minions.forEach((minion, key) => {
    if (minion.teamIndex === bot.teamIndex || minion.hp <= 0) return;
    const dist = distance(base.x, base.y, minion.x, minion.y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestId = key;
    }
  });

  return nearestId;
}

/**
 * Check if there are friendly minions near a position.
 */
function hasFriendlyMinionsNear(
  state: GameState,
  teamIndex: number,
  x: number,
  y: number,
  range: number
): boolean {
  let found = false;
  state.minions.forEach((minion) => {
    if (found) return;
    if (minion.teamIndex !== teamIndex || minion.hp <= 0) return;
    if (distance(minion.x, minion.y, x, y) < range) {
      found = true;
    }
  });
  return found;
}

/**
 * Get the position and safe standoff distance for a structure target.
 * Returns null if target is not a structure.
 */
function getStructureInfo(
  state: GameState,
  targetId: string
): { x: number; y: number; safeRange: number } | null {
  if (targetId === 'objective') {
    if (state.objective.hp <= 0) return null;
    return {
      x: state.objective.x,
      y: state.objective.y,
      safeRange: OBJECTIVE_ATTACK_RANGE + OBJECTIVE_RADIUS + BOT_STRUCTURE_SAFE_DIST,
    };
  }

  if (targetId.startsWith('base_')) {
    const teamIndex = parseInt(targetId.replace('base_', ''), 10);
    const base = state.bases.get(String(teamIndex));
    if (!base || base.destroyed) return null;
    return {
      x: base.x,
      y: base.y,
      safeRange: BASE_ATTACK_RANGE + BASE_RADIUS + BOT_STRUCTURE_SAFE_DIST,
    };
  }

  return null; // Not a structure
}

/**
 * Find the best target for a bot to attack.
 * Priority: enemy players > enemy minions > enemy bases > objective
 * For structures, only target them if friendly minions are nearby to tank.
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

  // 3. Nearest enemy base (any distance) — but only if minions are escorting
  nearestDist = Infinity;
  let bestBaseId = '';
  state.bases.forEach((base) => {
    if (base.teamIndex === bot.teamIndex || base.destroyed) return;
    // Also skip bases captured by our team
    if (base.capturedByTeam === bot.teamIndex) return;
    const dist = distance(bot.x, bot.y, base.x, base.y);
    if (dist < nearestDist) {
      nearestDist = dist;
      bestBaseId = `base_${base.teamIndex}`;
    }
  });
  if (bestBaseId) {
    const info = getStructureInfo(state, bestBaseId);
    if (info && hasFriendlyMinionsNear(state, bot.teamIndex, info.x, info.y, BOT_MINION_ESCORT_RANGE)) {
      return bestBaseId;
    }
    // No minion escort — still set as target but bot will hold back (handled in main loop)
    return bestBaseId;
  }

  // 4. Central objective (always available as fallback)
  if (state.objective.hp > 0) {
    return 'objective';
  }

  return '';
}

export function updateBotAI(state: GameState, dt: number) {
  const dtMs = dt * 1000;

  state.players.forEach((player) => {
    if (!player.isBot || !player.alive) return;

    // Tick down decision timer
    player.botDecisionTimer = Math.max(0, player.botDecisionTimer - dtMs);

    // --- PRIORITY 1: Retreat when low HP ---
    if (player.hp < player.maxHp * BOT_RETREAT_HP_PERCENT) {
      const base = state.bases.get(String(player.teamIndex));
      if (base && !base.destroyed) {
        // Run to base
        player.attackTargetId = '';
        player.targetX = base.x;
        player.targetY = base.y;
        return;
      }
      // Base destroyed — no retreat option, keep fighting
    }

    // --- PRIORITY 2: Defend own base ---
    const defenseTarget = findBaseDefenseTarget(state, player);
    if (defenseTarget) {
      // Check if we're already targeting a threat at our base
      const currentIsDefense =
        player.attackTargetId === defenseTarget ||
        (player.attackTargetId && isTargetNearBase(state, player, player.attackTargetId));

      if (!currentIsDefense) {
        player.attackTargetId = defenseTarget;
        player.botDecisionTimer = BOT_DECISION_INTERVAL;
        return;
      }
    }

    // --- PRIORITY 3: Keep current target if valid and timer hasn't expired ---
    if (player.attackTargetId && isTargetValid(state, player.attackTargetId) && player.botDecisionTimer > 0) {
      // Check structure safety: if targeting a structure without minion escort, hold back
      const structInfo = getStructureInfo(state, player.attackTargetId);
      if (structInfo) {
        if (!hasFriendlyMinionsNear(state, player.teamIndex, structInfo.x, structInfo.y, BOT_MINION_ESCORT_RANGE)) {
          // No minion escort — hold at safe distance
          player.attackTargetId = '';
          const dist = distance(player.x, player.y, structInfo.x, structInfo.y);
          if (dist < structInfo.safeRange) {
            // Too close — back off: move to a point on the line from structure to bot, at safe range
            const dx = player.x - structInfo.x;
            const dy = player.y - structInfo.y;
            const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            player.targetX = structInfo.x + (dx / d) * structInfo.safeRange;
            player.targetY = structInfo.y + (dy / d) * structInfo.safeRange;
          }
          // else: already at safe distance, just wait
          return;
        }
      }
      // Target is valid and either non-structure or has minion escort — keep it
      return;
    }

    // --- PRIORITY 4: Find new target (timer expired or no valid target) ---
    player.attackTargetId = findBotTarget(state, player);
    player.botDecisionTimer = BOT_DECISION_INTERVAL;

    // If we picked a structure target, check safety immediately
    if (player.attackTargetId) {
      const structInfo = getStructureInfo(state, player.attackTargetId);
      if (structInfo) {
        if (!hasFriendlyMinionsNear(state, player.teamIndex, structInfo.x, structInfo.y, BOT_MINION_ESCORT_RANGE)) {
          // Hold at safe distance
          const holdTarget = player.attackTargetId; // Remember what we want to attack
          player.attackTargetId = '';
          const dist = distance(player.x, player.y, structInfo.x, structInfo.y);
          if (dist > structInfo.safeRange) {
            // Walk toward the structure but stop at safe range
            const dx = structInfo.x - player.x;
            const dy = structInfo.y - player.y;
            const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            player.targetX = structInfo.x - (dx / d) * structInfo.safeRange;
            player.targetY = structInfo.y - (dy / d) * structInfo.safeRange;
          }
          // Re-check on next decision cycle
          void holdTarget; // lint: intentionally unused, we clear attackTargetId to hold position
        }
      }
    }
  });
}

/**
 * Check if the bot's current target is near the bot's own base (i.e., already defending).
 */
function isTargetNearBase(state: GameState, bot: Player, targetId: string): boolean {
  const base = state.bases.get(String(bot.teamIndex));
  if (!base || base.destroyed) return false;

  const player = state.players.get(targetId);
  if (player && player.alive) {
    return distance(base.x, base.y, player.x, player.y) < BOT_BASE_DEFEND_RANGE;
  }

  const minion = state.minions.get(targetId);
  if (minion && minion.hp > 0) {
    return distance(base.x, base.y, minion.x, minion.y) < BOT_BASE_DEFEND_RANGE;
  }

  return false;
}
