import Phaser from 'phaser';
import { TEAM_COLORS } from '../shared/constants';

export class MinionSprite {
  private sprite: Phaser.GameObjects.Sprite;
  private teamMarker: Phaser.GameObjects.Arc;
  private hpBar: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;
  private prevX: number = 0;
  private currentAnim: string = '';
  private isPlayingAttack: boolean = false;

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

    this.hpBar = scene.add.graphics();
    this.hpBar.setDepth(6);

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
    this.hpBar.setVisible(alive);

    // Draw HP bar
    this.hpBar.clear();
    if (alive) {
      const barWidth = 30;
      const barHeight = 3;
      const bx = this.sprite.x - barWidth / 2;
      const by = this.sprite.y - 30;
      const hpPct = Math.max(0, state.hp / state.maxHp);

      // Background
      this.hpBar.fillStyle(0x333333, 0.8);
      this.hpBar.fillRect(bx, by, barWidth, barHeight);

      // HP fill
      const hpColor = hpPct > 0.5 ? 0x44ff44 : hpPct > 0.25 ? 0xffaa44 : 0xff4444;
      this.hpBar.fillStyle(hpColor, 1);
      this.hpBar.fillRect(bx, by, barWidth * hpPct, barHeight);
    }

    if (alive) {
      if (state.state === 'attacking' && !this.isPlayingAttack) {
        this.isPlayingAttack = true;
        this.currentAnim = 'orc-attack';
        this.sprite.play('orc-attack', true);
        this.sprite.once('animationcomplete', () => {
          this.isPlayingAttack = false;
        });
      } else if (!this.isPlayingAttack) {
        if (isMoving) {
          this.playAnim('orc-walk');
        } else {
          this.playAnim('orc-idle');
        }
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
    this.hpBar.destroy();
  }
}
