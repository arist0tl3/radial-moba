import { GameState } from '../state/GameState';
import { Player } from '../state/Player';
import { Minion } from '../state/Minion';
import {
  PLAYER_ATTACK_DAMAGE,
  PLAYER_ATTACK_RANGE,
  PLAYER_ATTACK_COOLDOWN,
  PLAYER_RESPAWN_BASE,
  MINION_ATTACK_DAMAGE,
  MINION_ATTACK_RANGE,
  MINION_ATTACK_COOLDOWN,
  OBJECTIVE_RADIUS,
  BASE_RADIUS,
} from '../shared/constants';

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

export function updateCombat(state: GameState, dt: number) {
  const dtMs = dt * 1000;

  // Reduce player attack cooldowns
  state.players.forEach((player) => {
    if (player.attackCooldown > 0) {
      player.attackCooldown = Math.max(0, player.attackCooldown - dtMs);
    }
    if (player.abilityCooldown > 0) {
      player.abilityCooldown = Math.max(0, player.abilityCooldown - dtMs);
    }
  });

  // Clear attack flags from previous tick
  state.players.forEach((player) => {
    player.isAttacking = false;
  });

  // Player auto-attacks: attack nearest enemy in range
  state.players.forEach((player) => {
    if (!player.alive || player.attackCooldown > 0) return;

    const target = findNearestEnemyInRange(state, player, PLAYER_ATTACK_RANGE);
    if (!target) return;

    applyDamage(state, player, target, PLAYER_ATTACK_DAMAGE);
    player.attackCooldown = PLAYER_ATTACK_COOLDOWN;
    player.isAttacking = true;
  });

  // Handle player respawning
  state.players.forEach((player) => {
    if (player.alive) return;
    if (player.respawnTimer > 0) {
      player.respawnTimer = Math.max(0, player.respawnTimer - dtMs);
      if (player.respawnTimer <= 0) {
        respawnPlayer(state, player);
      }
    }
  });

  // Minion combat is handled via MinionAI state machine
  // (minions in 'attacking' state deal damage here)
  state.minions.forEach((minion) => {
    if (minion.state !== 'attacking' || minion.attackCooldown > 0) return;
    if (minion.attackCooldown > 0) {
      minion.attackCooldown = Math.max(0, minion.attackCooldown - dtMs);
      return;
    }

    if (!minion.targetId) return;

    // Find the target and deal damage
    const targetEntity = findEntityById(state, minion.targetId);
    if (!targetEntity) {
      minion.state = 'walking';
      minion.targetId = '';
      return;
    }

    applyDamageFromMinion(state, minion, targetEntity, MINION_ATTACK_DAMAGE);
    minion.attackCooldown = MINION_ATTACK_COOLDOWN;
  });

  // Reduce minion cooldowns
  state.minions.forEach((minion) => {
    if (minion.attackCooldown > 0) {
      minion.attackCooldown = Math.max(0, minion.attackCooldown - dtMs);
    }
  });

  // Remove dead minions
  const deadMinions: string[] = [];
  state.minions.forEach((minion, key) => {
    if (minion.hp <= 0) {
      deadMinions.push(key);
    }
  });
  for (const key of deadMinions) {
    state.minions.delete(key);
  }
}

type CombatTarget =
  | { kind: 'player'; entity: Player }
  | { kind: 'minion'; entity: Minion }
  | { kind: 'objective' }
  | { kind: 'base'; teamIndex: number };

function findNearestEnemyInRange(
  state: GameState,
  attacker: Player,
  range: number
): CombatTarget | null {
  let nearest: CombatTarget | null = null;
  let nearestDist = Infinity;

  // Check enemy players
  state.players.forEach((other) => {
    if (!other.alive || other.teamIndex === attacker.teamIndex) return;
    const dist = distance(attacker.x, attacker.y, other.x, other.y);
    if (dist <= range && dist < nearestDist) {
      nearestDist = dist;
      nearest = { kind: 'player', entity: other };
    }
  });

  // Check enemy minions
  state.minions.forEach((minion) => {
    if (minion.teamIndex === attacker.teamIndex || minion.hp <= 0) return;
    const dist = distance(attacker.x, attacker.y, minion.x, minion.y);
    if (dist <= range && dist < nearestDist) {
      nearestDist = dist;
      nearest = { kind: 'minion', entity: minion };
    }
  });

  // Check central objective
  const objDist = distance(attacker.x, attacker.y, state.objective.x, state.objective.y);
  if (objDist <= range + OBJECTIVE_RADIUS && objDist < nearestDist) {
    nearestDist = objDist;
    nearest = { kind: 'objective' };
  }

  // Check enemy bases
  state.bases.forEach((base) => {
    if (base.teamIndex === attacker.teamIndex || base.destroyed) return;
    const dist = distance(attacker.x, attacker.y, base.x, base.y);
    if (dist <= range + BASE_RADIUS && dist < nearestDist) {
      nearestDist = dist;
      nearest = { kind: 'base', teamIndex: base.teamIndex };
    }
  });

  return nearest;
}

function applyDamage(
  state: GameState,
  attacker: Player,
  target: CombatTarget,
  damage: number
) {
  switch (target.kind) {
    case 'player':
      target.entity.hp -= damage;
      if (target.entity.hp <= 0) {
        killPlayer(state, target.entity);
      }
      break;
    case 'minion':
      target.entity.hp -= damage;
      break;
    case 'objective':
      state.objective.hp -= damage;
      const current = state.objective.damageByTeam.get(String(attacker.teamIndex)) ?? 0;
      state.objective.damageByTeam.set(String(attacker.teamIndex), current + damage);
      break;
    case 'base': {
      const base = state.bases.get(String(target.teamIndex));
      if (base) {
        base.hp -= damage;
        if (base.hp <= 0) {
          base.destroyed = true;
          base.capturedByTeam = attacker.teamIndex;
        }
      }
      break;
    }
  }
}

function applyDamageFromMinion(
  state: GameState,
  minion: Minion,
  target: CombatTarget,
  damage: number
) {
  switch (target.kind) {
    case 'player':
      target.entity.hp -= damage;
      if (target.entity.hp <= 0) {
        killPlayer(state, target.entity);
      }
      break;
    case 'minion':
      target.entity.hp -= damage;
      break;
    case 'objective':
      state.objective.hp -= damage;
      const current = state.objective.damageByTeam.get(String(minion.teamIndex)) ?? 0;
      state.objective.damageByTeam.set(String(minion.teamIndex), current + damage);
      break;
    case 'base': {
      const base = state.bases.get(String(target.teamIndex));
      if (base) {
        base.hp -= damage;
        if (base.hp <= 0) {
          base.destroyed = true;
          base.capturedByTeam = minion.teamIndex;
        }
      }
      break;
    }
  }
}

function findEntityById(state: GameState, id: string): CombatTarget | null {
  if (id === 'objective') return { kind: 'objective' };
  if (id.startsWith('base_')) {
    const teamIndex = parseInt(id.replace('base_', ''), 10);
    const base = state.bases.get(String(teamIndex));
    if (base && !base.destroyed) return { kind: 'base', teamIndex };
    return null;
  }

  const player = state.players.get(id);
  if (player && player.alive) return { kind: 'player', entity: player };

  const minion = state.minions.get(id);
  if (minion && minion.hp > 0) return { kind: 'minion', entity: minion };

  return null;
}

function killPlayer(state: GameState, player: Player) {
  player.alive = false;
  player.deaths++;
  player.respawnTimer = PLAYER_RESPAWN_BASE + player.deaths * 1000;
}

function respawnPlayer(state: GameState, player: Player) {
  // Can't respawn if your base is destroyed
  const base = state.bases.get(String(player.teamIndex));
  if (!base || base.destroyed) return;

  player.alive = true;
  player.hp = player.maxHp;

  // Respawn at base
  player.x = base.x;
  player.y = base.y;
  player.targetX = base.x;
  player.targetY = base.y;
}

/**
 * Check if a team is fully eliminated (base destroyed + all players dead).
 * If so, mark them eliminated and clean up their minions.
 */
export function checkTeamElimination(state: GameState) {
  for (let i = 0; i < state.teams.length; i++) {
    const team = state.teams[i];
    if (!team || team.eliminated) continue;

    const base = state.bases.get(String(i));
    if (!base || !base.destroyed) continue; // Base still standing — not eliminated

    // Base is destroyed — check if any players are still alive
    let hasAlivePlayer = false;
    state.players.forEach((player) => {
      if (player.teamIndex === i && player.alive) {
        hasAlivePlayer = true;
      }
    });

    if (!hasAlivePlayer) {
      team.eliminated = true;

      // Remove all minions belonging to this team
      const toRemove: string[] = [];
      state.minions.forEach((minion, key) => {
        if (minion.teamIndex === i) {
          toRemove.push(key);
        }
      });
      for (const key of toRemove) {
        state.minions.delete(key);
      }
    }
  }
}
