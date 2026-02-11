import Phaser from 'phaser';
import { TEAM_COLORS } from '../shared/constants';

export class MinionSprite {
  private sprite: Phaser.GameObjects.Arc;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, minionState: any) {
    this.scene = scene;

    const color = TEAM_COLORS[minionState.teamIndex] ?? 0xffffff;
    this.sprite = scene.add.circle(minionState.x, minionState.y, 8, color, 0.7);
    this.sprite.setStrokeStyle(1, color, 1);
    this.sprite.setDepth(5);
  }

  updateFromState(state: any) {
    const lerpFactor = 0.3;
    this.sprite.x = Phaser.Math.Linear(this.sprite.x, state.x, lerpFactor);
    this.sprite.y = Phaser.Math.Linear(this.sprite.y, state.y, lerpFactor);

    this.sprite.setVisible(state.hp > 0);
  }

  destroy() {
    this.sprite.destroy();
  }
}
