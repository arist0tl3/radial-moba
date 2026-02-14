import Phaser from 'phaser';
import { TEAM_COLORS } from '../shared/constants';

export class ProjectileSprite {
  private graphics: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;

  // Current display position (lerped)
  private displayX: number = 0;
  private displayY: number = 0;

  constructor(scene: Phaser.Scene, state: any) {
    this.scene = scene;
    this.displayX = state.x;
    this.displayY = state.y;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(5); // Between ground and player sprites
    this.draw(state.sourceTeamIndex);
  }

  private draw(teamIndex: number) {
    const color = teamIndex >= 0 ? (TEAM_COLORS[teamIndex] ?? 0xffffff) : 0xff8800;
    this.graphics.clear();

    // Glowing orb effect
    this.graphics.fillStyle(color, 0.3);
    this.graphics.fillCircle(0, 0, 7);
    this.graphics.fillStyle(color, 0.7);
    this.graphics.fillCircle(0, 0, 4);
    this.graphics.fillStyle(0xffffff, 0.9);
    this.graphics.fillCircle(0, 0, 2);
  }

  updateFromState(state: any) {
    // Lerp toward server position for smooth movement
    const lerpFactor = 0.4;
    this.displayX += (state.x - this.displayX) * lerpFactor;
    this.displayY += (state.y - this.displayY) * lerpFactor;
    this.graphics.setPosition(this.displayX, this.displayY);
  }

  destroy() {
    this.graphics.destroy();
  }
}
