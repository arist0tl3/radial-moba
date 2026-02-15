import { GameState } from '../state/GameState';
import { Player } from '../state/Player';
import { Minion } from '../state/Minion';
import {
  PLAYER_ATTACK_DAMAGE,
  PLAYER_ATTACK_RANGE,
  PLAYER_ATTACK_COOLDOWN,
  PLAYER_RESPAWN_BASE,
  PLAYER_REGEN_PER_SEC,
  PLAYER_BASE_REGEN_PER_SEC,
  PLAYER_BASE_REGEN_RANGE,
  MELEE_MINION_ATTACK_DAMAGE,
  MELEE_MINION_ATTACK_RANGE,
  MELEE_MINION_ATTACK_COOLDOWN,
  CASTER_MINION_ATTACK_DAMAGE,
  CASTER_MINION_ATTACK_RANGE,
  CASTER_MINION_ATTACK_COOLDOWN,
  CASTER_MINION_PROJECTILE_SPEED,
  OBJECTIVE_RADIUS,
  BASE_RADIUS,
  TOWER_RADIUS,
  XP_PER_MINION_KILL,
  XP_PER_PLAYER_KILL,
  XP_PER_STRUCTURE_HIT,
  XP_BASE,
  XP_PER_LEVEL,
  MAX_LEVEL,
  LEVEL_BONUS_DAMAGE,
  LEVEL_BONUS_MAX_HP,
  LEVEL_BONUS_SPEED,
  LEVEL_BONUS_REGEN,
  LEVEL_BONUS_DEFENSE,
} from '../shared/constants';
import { spawnProjectile } from './StructureSystem';

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

// --- Leveling ---

export type UpgradeType = 'damage' | 'maxHp' | 'speed' | 'regen' | 'defense';

const ALL_UPGRADES: UpgradeType[] = ['damage', 'maxHp', 'speed', 'regen', 'defense'];

function generateUpgradeChoices(): [UpgradeType, UpgradeType] {
  const shuffled = [...ALL_UPGRADES].sort(() => Math.random() - 0.5);
  return [shuffled[0], shuffled[1]];
}

export function applyUpgrade(player: Player, choice: UpgradeType) {
  switch (choice) {
    case 'damage':
      player.bonusDamage += LEVEL_BONUS_DAMAGE;
      break;
    case 'maxHp':
      player.bonusMaxHp += LEVEL_BONUS_MAX_HP;
      player.maxHp += LEVEL_BONUS_MAX_HP;
      player.hp += LEVEL_BONUS_MAX_HP;
      break;
    case 'speed':
      player.bonusSpeed += LEVEL_BONUS_SPEED;
      break;
    case 'regen':
      player.bonusRegen += LEVEL_BONUS_REGEN;
      break;
    case 'defense':
      player.bonusDefense += LEVEL_BONUS_DEFENSE;
      break;
  }
  player.pendingLevelUp = false;
  player.pendingLevelUpNotified = false;
}

function awardXP(player: Player, amount: number) {
  if (player.level >= MAX_LEVEL) return;

  player.xp += amount;
  while (player.xp >= player.xpToNextLevel && player.level < MAX_LEVEL) {
    player.xp -= player.xpToNextLevel;
    player.level++;
    player.xpToNextLevel = XP_BASE + (player.level - 1) * XP_PER_LEVEL;

    const choices = generateUpgradeChoices();
    if (!player.isBot) {
      player.pendingLevelUp = true;
      player.pendingLevelUpNotified = false;
      player.pendingChoices = choices;
    } else {
      // Bots auto-pick randomly
      const pick = choices[Math.floor(Math.random() * choices.length)];
      applyUpgrade(player, pick);
    }
  }
}

// --- Main combat update ---

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

  // HP regeneration for all alive players
  state.players.forEach((player) => {
    if (!player.alive || player.hp >= player.maxHp) return;

    // Check if near own base for boosted regen
    const base = state.bases.get(String(player.teamIndex));
    let regenRate = PLAYER_REGEN_PER_SEC + player.bonusRegen;
    if (base && !base.destroyed) {
      const distToBase = distance(player.x, player.y, base.x, base.y);
      if (distToBase <= PLAYER_BASE_REGEN_RANGE) {
        regenRate = PLAYER_BASE_REGEN_PER_SEC + player.bonusRegen;
      }
    }

    player.hp = Math.min(player.maxHp, player.hp + regenRate * dt);
  });

  // Clear attack flags from previous tick
  state.players.forEach((player) => {
    player.isAttacking = false;
  });

  // Player auto-attacks: prioritize click target, else attack nearest enemy in range
  state.players.forEach((player) => {
    if (!player.alive || player.attackCooldown > 0) return;

    let target: CombatTarget | null = null;

    // If player has a specific attack target, try that first
    if (player.attackTargetId) {
      const chosen = findEntityById(state, player.attackTargetId);
      if (chosen) {
        // Check range to the chosen target
        const targetPos = getTargetPosition(state, chosen);
        if (targetPos) {
          const dist = distance(player.x, player.y, targetPos.x, targetPos.y);
          if (dist <= PLAYER_ATTACK_RANGE + targetPos.radius) {
            target = chosen;
          }
          // else: not in range yet — movement system is bringing us closer
        }
      } else {
        // Target dead/gone — clear it
        player.attackTargetId = '';
      }
    }

    // Fall back to auto-attack nearest enemy if no specific target (or target out of range)
    if (!target && !player.attackTargetId) {
      target = findNearestEnemyInRange(state, player, PLAYER_ATTACK_RANGE);
    }

    if (!target) return;

    const effectiveDamage = PLAYER_ATTACK_DAMAGE + player.bonusDamage;
    applyDamage(state, player, target, effectiveDamage);
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

    const isCaster = minion.minionType === 'caster';
    const attackDamage = isCaster ? CASTER_MINION_ATTACK_DAMAGE : MELEE_MINION_ATTACK_DAMAGE;
    const attackRange = isCaster ? CASTER_MINION_ATTACK_RANGE : MELEE_MINION_ATTACK_RANGE;
    const attackCooldown = isCaster ? CASTER_MINION_ATTACK_COOLDOWN : MELEE_MINION_ATTACK_COOLDOWN;

    // Check range before attacking
    const targetPos = getTargetPosition(state, targetEntity);
    if (!targetPos) return;
    const dist = distance(minion.x, minion.y, targetPos.x, targetPos.y);
    if (dist > attackRange + targetPos.radius) return;

    if (isCaster) {
      // Casters fire projectiles — only target players and minions (not structures)
      if (targetEntity.kind === 'player' || targetEntity.kind === 'minion') {
        const targetId = targetEntity.kind === 'player' ? targetEntity.entity.id : targetEntity.entity.id;
        spawnProjectile(state, minion.x, minion.y, targetId, attackDamage, minion.teamIndex, CASTER_MINION_PROJECTILE_SPEED);
      } else {
        // Casters attacking structures deal instant damage like melee
        applyDamageFromMinion(state, minion, targetEntity, attackDamage);
      }
    } else {
      // Melee deal instant damage
      applyDamageFromMinion(state, minion, targetEntity, attackDamage);
    }
    minion.attackCooldown = attackCooldown;
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
  | { kind: 'base'; teamIndex: number }
  | { kind: 'tower'; towerKey: string };

function getTargetPosition(
  state: GameState,
  target: CombatTarget
): { x: number; y: number; radius: number } | null {
  switch (target.kind) {
    case 'player':
      return { x: target.entity.x, y: target.entity.y, radius: 0 };
    case 'minion':
      return { x: target.entity.x, y: target.entity.y, radius: 0 };
    case 'objective':
      return { x: state.objective.x, y: state.objective.y, radius: OBJECTIVE_RADIUS };
    case 'base': {
      const base = state.bases.get(String(target.teamIndex));
      if (!base) return null;
      return { x: base.x, y: base.y, radius: BASE_RADIUS };
    }
    case 'tower': {
      const tower = state.towers.get(target.towerKey);
      if (!tower) return null;
      return { x: tower.x, y: tower.y, radius: TOWER_RADIUS };
    }
  }
}

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

  // Check towers (neutral — always enemies)
  state.towers.forEach((tower, key) => {
    if (tower.destroyed) return;
    const dist = distance(attacker.x, attacker.y, tower.x, tower.y);
    if (dist <= range + TOWER_RADIUS && dist < nearestDist) {
      nearestDist = dist;
      nearest = { kind: 'tower', towerKey: key };
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
    case 'player': {
      const effectiveDamage = Math.max(1, damage - target.entity.bonusDefense);
      target.entity.hp -= effectiveDamage;
      if (target.entity.hp <= 0) {
        killPlayer(state, target.entity);
        awardXP(attacker, XP_PER_PLAYER_KILL);
      }
      break;
    }
    case 'minion':
      target.entity.hp -= damage;
      if (target.entity.hp <= 0) {
        awardXP(attacker, XP_PER_MINION_KILL);
      }
      break;
    case 'objective':
      state.objective.hp -= damage;
      const current = state.objective.damageByTeam.get(String(attacker.teamIndex)) ?? 0;
      state.objective.damageByTeam.set(String(attacker.teamIndex), current + damage);
      awardXP(attacker, XP_PER_STRUCTURE_HIT);
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
      awardXP(attacker, XP_PER_STRUCTURE_HIT);
      break;
    }
    case 'tower': {
      const tower = state.towers.get(target.towerKey);
      if (tower) {
        tower.hp -= damage;
        if (tower.hp <= 0) {
          tower.hp = 0;
          tower.destroyed = true;
        }
      }
      awardXP(attacker, XP_PER_STRUCTURE_HIT);
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
    case 'player': {
      const effectiveDamage = Math.max(1, damage - target.entity.bonusDefense);
      target.entity.hp -= effectiveDamage;
      if (target.entity.hp <= 0) {
        killPlayer(state, target.entity);
      }
      break;
    }
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
    case 'tower': {
      const tower = state.towers.get(target.towerKey);
      if (tower) {
        tower.hp -= damage;
        if (tower.hp <= 0) {
          tower.hp = 0;
          tower.destroyed = true;
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

  if (id.startsWith('tower_')) {
    const key = id.replace('tower_', '');
    const tower = state.towers.get(key);
    if (tower && !tower.destroyed) return { kind: 'tower', towerKey: key };
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

  // Respawn at base with random offset to prevent stacking
  const offsetX = (Math.random() - 0.5) * 60;
  const offsetY = (Math.random() - 0.5) * 60;
  player.x = base.x + offsetX;
  player.y = base.y + offsetY;
  player.targetX = player.x;
  player.targetY = player.y;
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
