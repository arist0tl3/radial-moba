import Phaser from 'phaser';
import { TEAM_COLORS } from '../shared/constants';

export class MinionSprite {
  private sprite: Phaser.GameObjects.Sprite;
  private teamMarker: Phaser.GameObjects.Arc;
  private scene: Phaser.Scene;
  private prevX: number = 0;
  private currentAnim: string = '';

  constructor(scene: Phaser.Scene, minionState: any) {
    this.scene = scene;

    const color = TEAM_COLORS[minionState.teamIndex] ?? 0xffffff;

    // Team-colored circle underneath
    this.teamMarker = scene.add.circle(minionState.x, minionState.y + 12, 16, color, 0.35);
    this.teamMarker.setStrokeStyle(2, color, 0.8);
    this.teamMarker.setDepth(4);

    // Character sprite — no tint, natural colors
    this.sprite = scene.add.sprite(minionState.x, minionState.y, 'orc-idle');
    this.sprite.setScale(2.0);
    this.sprite.setDepth(5);
    this.sprite.play('orc-idle');

    this.prevX = minionState.x;
  }

  updateFromState(state: any) {
    const lerpFactor = 0.3;
    const newX = Phaser.Math.Linear(this.sprite.x, state.x, lerpFactor);
    const newY = Phaser.Math.Linear(this.sprite.y, state.y, lerpFactor);

    const dx = newX - this.sprite.x;
    const isMoving = Math.abs(state.x - this.sprite.x) > 1 || Math.abs(state.y - this.sprite.y) > 1;

    this.sprite.x = newX;
    this.sprite.y = newY;
    this.teamMarker.setPosition(newX, newY + 12);

    // Flip based on horizontal movement
    if (Math.abs(dx) > 0.1) {
      this.sprite.setFlipX(dx < 0);
    }

    const alive = state.hp > 0;
    this.sprite.setVisible(alive);
    this.teamMarker.setVisible(alive);

    if (alive) {
      if (isMoving) {
        this.playAnim('orc-walk');
      } else {
        this.playAnim('orc-idle');
      }
    }

    this.prevX = this.sprite.x;
  }

  private playAnim(key: string) {
    if (this.currentAnim !== key) {
      this.currentAnim = key;
      this.sprite.play(key, true);
    }
  }

  destroy() {
    this.sprite.destroy();
    this.teamMarker.destroy();
  }
}
