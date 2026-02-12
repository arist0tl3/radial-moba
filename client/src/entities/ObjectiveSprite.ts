import Phaser from 'phaser';
import { OBJECTIVE_RADIUS, TEAM_COLORS, NUM_TEAMS } from '../shared/constants';

export class ObjectiveSprite {
  private sprite: Phaser.GameObjects.Arc;
  private hpBar: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, objectiveState: any) {
    this.scene = scene;

    this.sprite = scene.add.circle(
      objectiveState.x,
      objectiveState.y,
      OBJECTIVE_RADIUS,
      0xdddddd,
      0.3
    );
    this.sprite.setStrokeStyle(3, 0xffffff, 0.8);
    this.sprite.setDepth(3);

    this.hpBar = scene.add.graphics();
    this.hpBar.setDepth(4);
  }

  updateFromState(state: any) {
    this.hpBar.clear();

    const barWidth = 200;
    const barHeight = 12;
    const x = state.x - barWidth / 2;
    const y = state.y - OBJECTIVE_RADIUS - 24;
    const hpPct = Math.max(0, state.hp / state.maxHp);

    // Background (full bar, dark)
    this.hpBar.fillStyle(0x111111, 0.9);
    this.hpBar.fillRect(x - 1, y - 1, barWidth + 2, barHeight + 2);

    // Remaining HP (white portion on the right)
    const hpWidth = barWidth * hpPct;
    this.hpBar.fillStyle(0x888888, 0.6);
    this.hpBar.fillRect(x, y, hpWidth, barHeight);

    // Damage segments (fill from the left, showing who dealt what)
    let offsetX = 0;
    for (let i = 0; i < NUM_TEAMS; i++) {
      const dmg = state.damageByTeam?.get(String(i)) ?? 0;
      const dmgPct = dmg / state.maxHp;
      const segWidth = barWidth * dmgPct;
      if (segWidth > 0.5) {
        this.hpBar.fillStyle(TEAM_COLORS[i], 1);
        this.hpBar.fillRect(x + offsetX, y, segWidth, barHeight);
        offsetX += segWidth;
      }
    }

    // Border
    this.hpBar.lineStyle(1, 0xffffff, 0.5);
    this.hpBar.strokeRect(x - 1, y - 1, barWidth + 2, barHeight + 2);

    // HP text
    this.hpBar.fillStyle(0xffffff, 1);
  }

  destroy() {
    this.sprite.destroy();
    this.hpBar.destroy();
  }
}
