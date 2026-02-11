import Phaser from 'phaser';
import { TEAM_COLORS } from '../shared/constants';

export class PlayerSprite {
  public sprite: Phaser.GameObjects.Arc;
  private hpBar: Phaser.GameObjects.Graphics;
  private nameTag: Phaser.GameObjects.Text;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, playerState: any, isMe: boolean) {
    this.scene = scene;

    const color = TEAM_COLORS[playerState.teamIndex] ?? 0xffffff;
    const radius = isMe ? 16 : 14;

    this.sprite = scene.add.circle(playerState.x, playerState.y, radius, color);
    this.sprite.setStrokeStyle(isMe ? 3 : 2, 0xffffff, isMe ? 1 : 0.5);
    this.sprite.setDepth(10);

    this.hpBar = scene.add.graphics();
    this.hpBar.setDepth(11);

    const label = isMe ? 'YOU' : '';
    this.nameTag = scene.add.text(playerState.x, playerState.y - 28, label, {
      fontSize: '12px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(11);
  }

  updateFromState(state: any) {
    // Interpolate position for smoother rendering
    const lerpFactor = 0.3;
    this.sprite.x = Phaser.Math.Linear(this.sprite.x, state.x, lerpFactor);
    this.sprite.y = Phaser.Math.Linear(this.sprite.y, state.y, lerpFactor);

    this.sprite.setVisible(state.alive);
    this.hpBar.setVisible(state.alive);
    this.nameTag.setVisible(state.alive);

    // Update HP bar
    this.hpBar.clear();
    if (state.alive) {
      const barWidth = 30;
      const barHeight = 4;
      const x = this.sprite.x - barWidth / 2;
      const y = this.sprite.y - 22;
      const hpPct = Math.max(0, state.hp / state.maxHp);

      // Background
      this.hpBar.fillStyle(0x333333, 0.8);
      this.hpBar.fillRect(x, y, barWidth, barHeight);

      // HP fill
      const hpColor = hpPct > 0.5 ? 0x44ff44 : hpPct > 0.25 ? 0xffaa44 : 0xff4444;
      this.hpBar.fillStyle(hpColor, 1);
      this.hpBar.fillRect(x, y, barWidth * hpPct, barHeight);
    }

    // Update name tag position
    this.nameTag.setPosition(this.sprite.x, this.sprite.y - 28);
  }

  destroy() {
    this.sprite.destroy();
    this.hpBar.destroy();
    this.nameTag.destroy();
  }
}
