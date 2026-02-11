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

    const barWidth = OBJECTIVE_RADIUS * 2;
    const barHeight = 8;
    const x = state.x - barWidth / 2;
    const y = state.y - OBJECTIVE_RADIUS - 16;
    const hpPct = Math.max(0, state.hp / state.maxHp);

    // Background
    this.hpBar.fillStyle(0x333333, 0.8);
    this.hpBar.fillRect(x, y, barWidth, barHeight);

    // Segmented HP bar showing damage by team
    let offsetX = 0;
    for (let i = 0; i < NUM_TEAMS; i++) {
      const dmg = state.damageByTeam?.get(String(i)) ?? 0;
      const dmgPct = dmg / state.maxHp;
      const segWidth = barWidth * dmgPct;
      if (segWidth > 0) {
        this.hpBar.fillStyle(TEAM_COLORS[i], 0.8);
        this.hpBar.fillRect(x + offsetX, y, segWidth, barHeight);
        offsetX += segWidth;
      }
    }

    // Remaining HP overlay (white, on the right side)
    const remainingWidth = barWidth * hpPct;
    this.hpBar.fillStyle(0xffffff, 0.3);
    this.hpBar.fillRect(x + barWidth - remainingWidth, y, remainingWidth, barHeight);
  }

  destroy() {
    this.sprite.destroy();
    this.hpBar.destroy();
  }
}
