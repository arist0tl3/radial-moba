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
  TOWER_ATTACK_RANGE,
  TOWER_RADIUS,
  MAP_RADIUS,
  NUM_TEAMS,
} from '../shared/constants';

/** Half-width of the lane wedge in radians (~55° each side of the lane axis). */
const LANE_HALF_ANGLE = Math.PI / (NUM_TEAMS * 0.8); // ~0.78 rad for 4 teams

/** Get the base angle for a team's lane (pointing outward from center). */
function getLaneAngle(teamIndex: number): number {
  return (teamIndex / NUM_TEAMS) * Math.PI * 2 - Math.PI / 2;
}

/**
 * Check if a world position is within a team's lane wedge.
 * The lane is a pie-slice centered on the angle from map center to the team's base.
 */
function isInLane(teamIndex: number, x: number, y: number): boolean {
  const laneAngle = getLaneAngle(teamIndex);
  const posAngle = Math.atan2(y - MAP_RADIUS, x - MAP_RADIUS);
  let diff = posAngle - laneAngle;
  // Normalize to [-PI, PI]
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) <= LANE_HALF_ANGLE;
}

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

  if (targetId.startsWith('tower_')) {
    const key = targetId.replace('tower_', '');
    const tower = state.towers.get(key);
    return !!tower && !tower.destroyed;
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

  if (targetId.startsWith('tower_')) {
    const key = targetId.replace('tower_', '');
    const tower = state.towers.get(key);
    if (!tower || tower.destroyed) return null;
    return {
      x: tower.x,
      y: tower.y,
      safeRange: TOWER_ATTACK_RANGE + TOWER_RADIUS + BOT_STRUCTURE_SAFE_DIST,
    };
  }

  return null; // Not a structure
}

/**
 * Find the best target for a bot to attack.
 * Bots strongly prefer targets in their own lane (the wedge from base toward center).
 * Priority: enemy players > enemy minions > own lane tower > enemy bases > objective
 */
function findBotTarget(state: GameState, bot: Player): string {
  let nearestId = '';
  let nearestDist = Infinity;

  // 1. Nearest enemy player in scan range — prefer in-lane, fall back to any
  let lanePlayerId = '';
  let lanePlayerDist = Infinity;
  let anyPlayerId = '';
  let anyPlayerDist = Infinity;
  state.players.forEach((other, key) => {
    if (!other.alive || other.teamIndex === bot.teamIndex) return;
    const dist = distance(bot.x, bot.y, other.x, other.y);
    if (dist >= BOT_SCAN_RANGE) return;
    if (isInLane(bot.teamIndex, other.x, other.y)) {
      if (dist < lanePlayerDist) { lanePlayerDist = dist; lanePlayerId = key; }
    }
    if (dist < anyPlayerDist) { anyPlayerDist = dist; anyPlayerId = key; }
  });
  // Always fight players who are very close (within attack range), regardless of lane
  if (anyPlayerId && anyPlayerDist < PLAYER_ATTACK_RANGE * 3) return anyPlayerId;
  if (lanePlayerId) return lanePlayerId;

  // 2. Nearest enemy minion in scan range — prefer in-lane
  let laneMinionId = '';
  let laneMinionDist = Infinity;
  state.minions.forEach((minion, key) => {
    if (minion.teamIndex === bot.teamIndex || minion.hp <= 0) return;
    const dist = distance(bot.x, bot.y, minion.x, minion.y);
    if (dist >= BOT_SCAN_RANGE) return;
    if (isInLane(bot.teamIndex, minion.x, minion.y) && dist < laneMinionDist) {
      laneMinionDist = dist;
      laneMinionId = key;
    }
  });
  if (laneMinionId) return laneMinionId;

  // 3. Own lane tower (neutral structure blocking path to center)
  const ownLaneTower = state.towers.get(String(bot.teamIndex));
  if (ownLaneTower && !ownLaneTower.destroyed) {
    return `tower_${bot.teamIndex}`;
  }

  // 4. Walk toward center along lane if tower is down but no other target
  //    (bot stays in lane instead of wandering to another base)
  //    Find the lane's forward position (halfway between tower pos and center)
  const laneAngle = getLaneAngle(bot.teamIndex);
  const forwardDist = MAP_RADIUS * 0.25; // 25% radius — between tower and center
  const forwardX = MAP_RADIUS + Math.cos(laneAngle) * forwardDist;
  const forwardY = MAP_RADIUS + Math.sin(laneAngle) * forwardDist;
  const distToForward = distance(bot.x, bot.y, forwardX, forwardY);

  // If far from forward position, walk there first (stay in lane)
  if (distToForward > 300) {
    bot.targetX = forwardX;
    bot.targetY = forwardY;
    return ''; // No attack target — just move
  }

  // 5. Central objective (if close enough after walking forward)
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
