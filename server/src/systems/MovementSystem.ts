import { GameState } from '../state/GameState';
import {
  PLAYER_SPEED,
  PLAYER_ATTACK_RANGE,
  OBJECTIVE_RADIUS,
  BASE_RADIUS,
} from '../shared/constants';

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

/**
 * Look up position + effective radius of an attack target entity.
 * Returns null if the target is dead/gone.
 */
function getAttackTargetPosition(
  state: GameState,
  targetId: string
): { x: number; y: number; radius: number } | null {
  if (targetId === 'objective') {
    if (state.objective.hp <= 0) return null;
    return { x: state.objective.x, y: state.objective.y, radius: OBJECTIVE_RADIUS };
  }

  if (targetId.startsWith('base_')) {
    const teamIndex = parseInt(targetId.replace('base_', ''), 10);
    const base = state.bases.get(String(teamIndex));
    if (!base || base.destroyed) return null;
    return { x: base.x, y: base.y, radius: BASE_RADIUS };
  }

  const player = state.players.get(targetId);
  if (player && player.alive) {
    return { x: player.x, y: player.y, radius: 0 };
  }

  const minion = state.minions.get(targetId);
  if (minion && minion.hp > 0) {
    return { x: minion.x, y: minion.y, radius: 0 };
  }

  return null;
}

export function updateMovement(state: GameState, dt: number) {
  // Move players toward their target positions
  state.players.forEach((player) => {
    if (!player.alive) return;

    // If we have an attack target, follow it instead of targetX/targetY
    if (player.attackTargetId) {
      const target = getAttackTargetPosition(state, player.attackTargetId);
      if (!target) {
        // Target dead/gone — clear and stop
        player.attackTargetId = '';
      } else {
        const dist = distance(player.x, player.y, target.x, target.y);
        const effectiveRange = PLAYER_ATTACK_RANGE + target.radius;

        if (dist > effectiveRange) {
          // Move toward target
          const speed = PLAYER_SPEED * dt;
          const dx = target.x - player.x;
          const dy = target.y - player.y;
          if (dist <= speed) {
            // Don't overshoot into the target
            const stopDist = Math.max(0, effectiveRange - 2);
            player.x = target.x - (dx / dist) * stopDist;
            player.y = target.y - (dy / dist) * stopDist;
          } else {
            player.x += (dx / dist) * speed;
            player.y += (dy / dist) * speed;
          }
        }
        // In range — stop moving, combat system will handle attack
        return;
      }
    }

    // Normal movement toward targetX/targetY (ground click)
    const dx = player.targetX - player.x;
    const dy = player.targetY - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 2) return; // Close enough

    const speed = PLAYER_SPEED * dt;
    if (dist <= speed) {
      player.x = player.targetX;
      player.y = player.targetY;
    } else {
      player.x += (dx / dist) * speed;
      player.y += (dy / dist) * speed;
    }
  });

  // Minion movement is handled in MinionAI (path-based)
}
