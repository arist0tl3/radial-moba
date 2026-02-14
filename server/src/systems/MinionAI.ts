import { GameState } from '../state/GameState';
import { Minion } from '../state/Minion';
import {
  MINION_HP,
  MINION_SPEED,
  MINION_AGGRO_RANGE,
  MINION_ATTACK_RANGE,
  MINIONS_PER_WAVE,
  MAP_RADIUS,
  NUM_TEAMS,
  OBJECTIVE_MINIONS_PER_BASE,
} from '../shared/constants';

let minionIdCounter = 0;

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

function spawnMinionsAtBase(
  state: GameState,
  teamIndex: number,
  baseX: number,
  baseY: number
) {
  const team = state.teams[teamIndex];
  if (!team || team.eliminated) return;

  for (let i = 0; i < MINIONS_PER_WAVE; i++) {
    const minion = new Minion();
    minion.id = `minion_${minionIdCounter++}`;
    minion.teamIndex = teamIndex;
    // Spawn near the base with slight offset so they don't stack
    minion.x = baseX + (i - 1) * 20;
    minion.y = baseY + (i - 1) * 20;
    minion.hp = MINION_HP;
    minion.maxHp = MINION_HP;
    minion.state = 'walking';
    state.minions.set(minion.id, minion);
  }
}

export function spawnMinionWave(state: GameState) {
  state.bases.forEach((base) => {
    if (!base.destroyed) {
      // Active base — spawn minions for the owning team
      spawnMinionsAtBase(state, base.teamIndex, base.x, base.y);
    } else if (base.capturedByTeam >= 0) {
      // Captured base — spawn minions for the capturing team
      spawnMinionsAtBase(state, base.capturedByTeam, base.x, base.y);
    }
  });
}

/**
 * Spawn neutral minions from the objective heading toward each active base.
 */
export function spawnObjectiveMinionWave(state: GameState) {
  if (state.objective.hp <= 0) return;

  const cx = state.objective.x;
  const cy = state.objective.y;

  state.bases.forEach((base) => {
    if (base.destroyed) return;

    for (let i = 0; i < OBJECTIVE_MINIONS_PER_BASE; i++) {
      const minion = new Minion();
      minion.id = `minion_${minionIdCounter++}`;
      minion.teamIndex = -1; // Neutral — hostile to all teams
      // Spawn near center with slight offset
      minion.x = cx + (i - 0.5) * 15;
      minion.y = cy + (i - 0.5) * 15;
      minion.hp = MINION_HP;
      minion.maxHp = MINION_HP;
      minion.state = 'walking';
      minion.targetId = `base_${base.teamIndex}`; // Walk toward this base
      state.minions.set(minion.id, minion);
    }
  });
}

export function updateMinionAI(state: GameState, dt: number) {
  state.minions.forEach((minion) => {
    switch (minion.state) {
      case 'spawning':
        minion.state = 'walking';
        break;

      case 'walking':
        walkTowardCenter(state, minion, dt);
        checkForAggroTargets(state, minion);
        break;

      case 'attacking':
        updateAttacking(state, minion, dt);
        break;

      case 'dead':
        // Will be cleaned up by combat system
        break;
    }
  });
}

function walkTowardCenter(state: GameState, minion: Minion, dt: number) {
  let goalX = MAP_RADIUS;
  let goalY = MAP_RADIUS;

  // Objective minions (teamIndex -1) walk toward their assigned base instead of center
  if (minion.teamIndex === -1 && minion.targetId.startsWith('base_')) {
    const pos = getTargetPosition(state, minion.targetId);
    if (pos) {
      goalX = pos.x;
      goalY = pos.y;
    } else {
      // Base destroyed — clear target, switch to aggro scan
      minion.targetId = '';
      return;
    }
  }

  const dx = goalX - minion.x;
  const dy = goalY - minion.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 5) return; // At destination

  const speed = MINION_SPEED * dt;
  if (dist <= speed) {
    minion.x = goalX;
    minion.y = goalY;
  } else {
    minion.x += (dx / dist) * speed;
    minion.y += (dy / dist) * speed;
  }
}

function checkForAggroTargets(state: GameState, minion: Minion) {
  let nearestId = '';
  let nearestDist = MINION_AGGRO_RANGE;

  // Priority: enemy players > enemy minions > central objective
  state.players.forEach((player) => {
    if (!player.alive || player.teamIndex === minion.teamIndex) return;
    const dist = distance(minion.x, minion.y, player.x, player.y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestId = player.id;
    }
  });

  if (!nearestId) {
    state.minions.forEach((other) => {
      if (other.id === minion.id || other.teamIndex === minion.teamIndex || other.hp <= 0) return;
      const dist = distance(minion.x, minion.y, other.x, other.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestId = other.id;
      }
    });
  }

  // If close to the objective, attack it (team minions only, not objective's own minions)
  if (!nearestId && minion.teamIndex >= 0) {
    const objDist = distance(minion.x, minion.y, state.objective.x, state.objective.y);
    if (objDist < MINION_AGGRO_RANGE) {
      nearestId = 'objective';
      nearestDist = objDist;
    }
  }

  // Objective minions: attack nearby enemy bases
  if (!nearestId && minion.teamIndex === -1) {
    state.bases.forEach((base) => {
      if (base.destroyed) return;
      const dist = distance(minion.x, minion.y, base.x, base.y);
      if (dist < MINION_AGGRO_RANGE && dist < nearestDist) {
        nearestDist = dist;
        nearestId = `base_${base.teamIndex}`;
      }
    });
  }

  if (nearestId) {
    minion.state = 'attacking';
    minion.targetId = nearestId;
  }
}

function updateAttacking(state: GameState, minion: Minion, dt: number) {
  if (!minion.targetId) {
    minion.state = 'walking';
    return;
  }

  // Find target position
  const targetPos = getTargetPosition(state, minion.targetId);
  if (!targetPos) {
    // Target is gone
    minion.state = 'walking';
    minion.targetId = '';
    return;
  }

  const dist = distance(minion.x, minion.y, targetPos.x, targetPos.y);

  if (dist > MINION_AGGRO_RANGE * 1.5) {
    // Target moved too far away, disengage
    minion.state = 'walking';
    minion.targetId = '';
    return;
  }

  if (dist > MINION_ATTACK_RANGE) {
    // Walk toward target
    const dx = targetPos.x - minion.x;
    const dy = targetPos.y - minion.y;
    const speed = MINION_SPEED * dt;
    minion.x += (dx / dist) * speed;
    minion.y += (dy / dist) * speed;
  }
  // Actual damage dealing is handled by CombatSystem
}

function getTargetPosition(
  state: GameState,
  targetId: string
): { x: number; y: number } | null {
  if (targetId === 'objective') {
    return { x: state.objective.x, y: state.objective.y };
  }

  if (targetId.startsWith('base_')) {
    const teamIndex = parseInt(targetId.replace('base_', ''), 10);
    const base = state.bases.get(String(teamIndex));
    if (base && !base.destroyed) return { x: base.x, y: base.y };
    return null;
  }

  const player = state.players.get(targetId);
  if (player && player.alive) return { x: player.x, y: player.y };

  const minion = state.minions.get(targetId);
  if (minion && minion.hp > 0) return { x: minion.x, y: minion.y };

  return null;
}
