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
} from '../shared/constants';

let minionIdCounter = 0;

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

export function spawnMinionWave(state: GameState) {
  for (let teamIdx = 0; teamIdx < NUM_TEAMS; teamIdx++) {
    const team = state.teams[teamIdx];
    if (!team || team.eliminated) continue;

    const base = state.bases.get(String(teamIdx));
    if (!base || base.destroyed) continue;

    for (let i = 0; i < MINIONS_PER_WAVE; i++) {
      const minion = new Minion();
      minion.id = `minion_${minionIdCounter++}`;
      minion.teamIndex = teamIdx;
      // Spawn near the base with slight offset so they don't stack
      minion.x = base.x + (i - 1) * 20;
      minion.y = base.y + (i - 1) * 20;
      minion.hp = MINION_HP;
      minion.maxHp = MINION_HP;
      minion.state = 'walking';
      state.minions.set(minion.id, minion);
    }
  }
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
  // Simple: walk straight toward the center of the map
  const centerX = MAP_RADIUS;
  const centerY = MAP_RADIUS;

  const dx = centerX - minion.x;
  const dy = centerY - minion.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 5) return; // At center

  const speed = MINION_SPEED * dt;
  if (dist <= speed) {
    minion.x = centerX;
    minion.y = centerY;
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

  // If close to the objective, attack it
  if (!nearestId) {
    const objDist = distance(minion.x, minion.y, state.objective.x, state.objective.y);
    if (objDist < MINION_AGGRO_RANGE) {
      nearestId = 'objective';
      nearestDist = objDist;
    }
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
