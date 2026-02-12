import Phaser from 'phaser';
import { OBJECTIVE_RADIUS, TEAM_COLORS, NUM_TEAMS } from '../shared/constants';

export class ObjectiveSprite {
  private gfx: Phaser.GameObjects.Graphics;
  private hpBar: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;
  private x: number;
  private y: number;
  private pulseTime = 0;
  private alive = true;
  private updateHandler: (time: number, delta: number) => void;

  constructor(scene: Phaser.Scene, objectiveState: any) {
    this.scene = scene;
    this.x = objectiveState.x;
    this.y = objectiveState.y;

    this.gfx = scene.add.graphics();
    this.gfx.setDepth(3);

    this.hpBar = scene.add.graphics();
    this.hpBar.setDepth(4);

    // Animate the pulse
    this.updateHandler = (_time: number, delta: number) => {
      this.pulseTime += delta * 0.003;
      this.drawPortal(this.alive);
    };
    scene.events.on('update', this.updateHandler);

    this.drawPortal(true);
  }

  updateFromState(state: any) {
    this.alive = state.hp > 0;
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
  }

  private drawPortal(alive: boolean) {
    this.gfx.clear();
    const r = OBJECTIVE_RADIUS;
    const pulse = Math.sin(this.pulseTime) * 0.15 + 0.85; // 0.7–1.0

    if (!alive) {
      // Dead — dim gray ring
      this.gfx.lineStyle(3, 0x444444, 0.4);
      this.gfx.strokeCircle(this.x, this.y, r);
      return;
    }

    // Outer glow ring
    this.gfx.lineStyle(6, 0x9966ff, 0.2 * pulse);
    this.gfx.strokeCircle(this.x, this.y, r + 8);

    // Main ring
    this.gfx.lineStyle(4, 0xaa88ff, 0.8 * pulse);
    this.gfx.strokeCircle(this.x, this.y, r);

    // Inner fill
    this.gfx.fillStyle(0x6633cc, 0.25 * pulse);
    this.gfx.fillCircle(this.x, this.y, r);

    // Inner bright core
    this.gfx.fillStyle(0xddbbff, 0.3 * pulse);
    this.gfx.fillCircle(this.x, this.y, r * 0.3);
  }

  destroy() {
    this.scene.events.off('update', this.updateHandler);
    this.gfx.destroy();
    this.hpBar.destroy();
  }
}
