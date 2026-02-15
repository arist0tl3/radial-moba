import { GameState } from '../state/GameState';
import { Projectile } from '../state/Projectile';
import {
  BASE_ATTACK_DAMAGE,
  BASE_ATTACK_RANGE,
  BASE_ATTACK_COOLDOWN,
  BASE_RADIUS,
  OBJECTIVE_ATTACK_DAMAGE,
  OBJECTIVE_ATTACK_RANGE,
  OBJECTIVE_ATTACK_COOLDOWN,
  OBJECTIVE_RADIUS,
  PROJECTILE_SPEED,
  TOWER_ATTACK_DAMAGE,
  TOWER_ATTACK_RANGE,
  TOWER_ATTACK_COOLDOWN,
  TOWER_RADIUS,
} from '../shared/constants';

let projectileIdCounter = 0;

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

/**
 * Find the nearest enemy target for a structure.
 * Priority: enemy minions first, then enemy players (classic tower aggro).
 * Returns the target's entity ID or empty string.
 */
function findStructureTarget(
  state: GameState,
  x: number,
  y: number,
  range: number,
  ownerTeamIndex: number // -1 for objective (attacks everyone)
): string {
  let nearestId = '';
  let nearestDist = Infinity;

  // 1. Enemy minions first (towers prioritize minions)
  state.minions.forEach((minion, key) => {
    if (minion.hp <= 0) return;
    if (ownerTeamIndex >= 0 && minion.teamIndex === ownerTeamIndex) return;
    const dist = distance(x, y, minion.x, minion.y);
    if (dist <= range && dist < nearestDist) {
      nearestDist = dist;
      nearestId = key;
    }
  });
  if (nearestId) return nearestId;

  // 2. Enemy players
  nearestDist = Infinity;
  state.players.forEach((player, key) => {
    if (!player.alive) return;
    if (ownerTeamIndex >= 0 && player.teamIndex === ownerTeamIndex) return;
    const dist = distance(x, y, player.x, player.y);
    if (dist <= range && dist < nearestDist) {
      nearestDist = dist;
      nearestId = key;
    }
  });

  return nearestId;
}

export function spawnProjectile(
  state: GameState,
  fromX: number,
  fromY: number,
  targetId: string,
  damage: number,
  sourceTeamIndex: number,
  speed: number = PROJECTILE_SPEED
) {
  const proj = new Projectile();
  proj.id = `proj_${projectileIdCounter++}`;
  proj.fromX = fromX;
  proj.fromY = fromY;
  proj.x = fromX;
  proj.y = fromY;
  proj.targetId = targetId;
  proj.damage = damage;
  proj.speed = speed;
  proj.sourceTeamIndex = sourceTeamIndex;
  state.projectiles.set(proj.id, proj);
}

/**
 * Structures (bases + objective) find targets and fire projectiles.
 */
export function updateStructureAttacks(state: GameState, dt: number) {
  const dtMs = dt * 1000;

  // Bases fire at enemies
  state.bases.forEach((base) => {
    if (base.destroyed) return;

    // Reduce cooldown
    if (base.attackCooldown > 0) {
      base.attackCooldown = Math.max(0, base.attackCooldown - dtMs);
      return;
    }

    // Determine who this base fires at
    // If captured, the capturing team owns it now
    const ownerTeam = base.capturedByTeam >= 0 ? base.capturedByTeam : base.teamIndex;

    const targetId = findStructureTarget(
      state,
      base.x,
      base.y,
      BASE_ATTACK_RANGE + BASE_RADIUS,
      ownerTeam
    );

    if (targetId) {
      spawnProjectile(state, base.x, base.y, targetId, BASE_ATTACK_DAMAGE, ownerTeam);
      base.attackCooldown = BASE_ATTACK_COOLDOWN;
    }
  });

  // Objective fires at enemies (attacks all teams)
  if (state.objective.hp > 0) {
    if (state.objective.attackCooldown > 0) {
      state.objective.attackCooldown = Math.max(0, state.objective.attackCooldown - dtMs);
    } else {
      const targetId = findStructureTarget(
        state,
        state.objective.x,
        state.objective.y,
        OBJECTIVE_ATTACK_RANGE + OBJECTIVE_RADIUS,
        -1 // attacks everyone
      );

      if (targetId) {
        spawnProjectile(
          state,
          state.objective.x,
          state.objective.y,
          targetId,
          OBJECTIVE_ATTACK_DAMAGE,
          -1
        );
        state.objective.attackCooldown = OBJECTIVE_ATTACK_COOLDOWN;
      }
    }
  }

  // Towers fire at enemies (neutral — attacks all teams)
  state.towers.forEach((tower) => {
    if (tower.destroyed) return;

    if (tower.attackCooldown > 0) {
      tower.attackCooldown = Math.max(0, tower.attackCooldown - dtMs);
      return;
    }

    const targetId = findStructureTarget(
      state,
      tower.x,
      tower.y,
      TOWER_ATTACK_RANGE + TOWER_RADIUS,
      -1 // Neutral — attacks everyone
    );

    if (targetId) {
      spawnProjectile(state, tower.x, tower.y, targetId, TOWER_ATTACK_DAMAGE, -1);
      tower.attackCooldown = TOWER_ATTACK_COOLDOWN;
    }
  });
}

/**
 * Move projectiles toward their targets, apply damage on arrival, clean up.
 */
export function updateProjectiles(state: GameState, dt: number) {
  const toRemove: string[] = [];

  state.projectiles.forEach((proj, key) => {
    // Resolve target position
    let tx = 0, ty = 0;
    let targetAlive = false;

    const player = state.players.get(proj.targetId);
    if (player && player.alive) {
      tx = player.x;
      ty = player.y;
      targetAlive = true;
    } else {
      const minion = state.minions.get(proj.targetId);
      if (minion && minion.hp > 0) {
        tx = minion.x;
        ty = minion.y;
        targetAlive = true;
      }
    }

    if (!targetAlive) {
      // Target died — remove projectile
      toRemove.push(key);
      return;
    }

    // Move toward target
    const dx = tx - proj.x;
    const dy = ty - proj.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const moveSpeed = proj.speed * dt;

    if (dist <= moveSpeed + 5) {
      // Arrived — apply damage and remove
      if (player && player.alive) {
        const effectiveDamage = Math.max(1, proj.damage - player.bonusDefense);
        player.hp -= effectiveDamage;
        if (player.hp <= 0) {
          player.alive = false;
          player.deaths++;
          player.respawnTimer = 5000 + player.deaths * 1000;
        }
      } else {
        const minion = state.minions.get(proj.targetId);
        if (minion && minion.hp > 0) {
          minion.hp -= proj.damage;
        }
      }
      toRemove.push(key);
    } else {
      // Move projectile
      proj.x += (dx / dist) * moveSpeed;
      proj.y += (dy / dist) * moveSpeed;
    }
  });

  for (const key of toRemove) {
    state.projectiles.delete(key);
  }
}
