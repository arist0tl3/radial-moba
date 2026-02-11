import { GameState } from '../state/GameState';
import { PLAYER_SPEED, MINION_SPEED } from '../shared/constants';

export function updateMovement(state: GameState, dt: number) {
  // Move players toward their target positions
  state.players.forEach((player) => {
    if (!player.alive) return;

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
