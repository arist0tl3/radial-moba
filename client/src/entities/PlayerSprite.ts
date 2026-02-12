import Phaser from 'phaser';
import { TEAM_COLORS } from '../shared/constants';

export class PlayerSprite {
  public sprite: Phaser.GameObjects.Sprite;
  private teamMarker: Phaser.GameObjects.Arc;
  private hpBar: Phaser.GameObjects.Graphics;
  private nameTag: Phaser.GameObjects.Text;
  private scene: Phaser.Scene;
  private prevX: number = 0;
  private prevY: number = 0;
  private currentAnim: string = '';
  private isDead: boolean = false;
  private isMe: boolean;

  constructor(scene: Phaser.Scene, playerState: any, isMe: boolean) {
    this.scene = scene;
    this.isMe = isMe;

    const color = TEAM_COLORS[playerState.teamIndex] ?? 0xffffff;

    // Team-colored circle underneath the sprite as a ground marker
    const markerRadius = isMe ? 28 : 24;
    this.teamMarker = scene.add.circle(playerState.x, playerState.y + 20, markerRadius, color, 0.35);
    this.teamMarker.setStrokeStyle(isMe ? 3 : 2, color, 0.8);
    this.teamMarker.setDepth(9);

    // Character sprite — no tint, natural colors
    this.sprite = scene.add.sprite(playerState.x, playerState.y, 'soldier-idle');
    this.sprite.setScale(isMe ? 3.0 : 2.7);
    this.sprite.setDepth(10);
    this.sprite.play('soldier-idle');

    this.prevX = playerState.x;
    this.prevY = playerState.y;

    this.hpBar = scene.add.graphics();
    this.hpBar.setDepth(11);

    const label = isMe ? 'YOU' : '';
    this.nameTag = scene.add.text(playerState.x, playerState.y - 120, label, {
      fontSize: '12px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(11);
  }

  updateFromState(state: any) {
    // Interpolate position for smoother rendering
    const lerpFactor = 0.3;
    const newX = Phaser.Math.Linear(this.sprite.x, state.x, lerpFactor);
    const newY = Phaser.Math.Linear(this.sprite.y, state.y, lerpFactor);

    // Determine movement for animation and facing
    const dx = newX - this.sprite.x;
    const isMoving = Math.abs(state.x - this.sprite.x) > 1 || Math.abs(state.y - this.sprite.y) > 1;

    this.sprite.x = newX;
    this.sprite.y = newY;
    this.teamMarker.setPosition(newX, newY + 20);

    // Flip sprite based on horizontal movement direction
    if (Math.abs(dx) > 0.1) {
      this.sprite.setFlipX(dx < 0);
    }

    // Handle visibility and animations
    if (!state.alive && !this.isDead) {
      // Just died — play death animation
      this.isDead = true;
      this.playAnim('soldier-death');
      this.sprite.once('animationcomplete', () => {
        this.sprite.setVisible(false);
        this.teamMarker.setVisible(false);
      });
      this.hpBar.setVisible(false);
      this.nameTag.setVisible(false);
      return;
    }

    if (state.alive && this.isDead) {
      // Respawned
      this.isDead = false;
      this.sprite.setVisible(true);
      this.teamMarker.setVisible(true);
      this.hpBar.setVisible(true);
      this.nameTag.setVisible(true);
    }

    if (!state.alive) {
      return;
    }

    // Choose animation based on state
    if (isMoving) {
      this.playAnim('soldier-walk');
    } else {
      this.playAnim('soldier-idle');
    }

    // Update HP bar
    this.hpBar.clear();
    const barWidth = 60;
    const barHeight = 6;
    const x = this.sprite.x - barWidth / 2;
    const y = this.sprite.y - 110;
    const hpPct = Math.max(0, state.hp / state.maxHp);

    // Background
    this.hpBar.fillStyle(0x333333, 0.8);
    this.hpBar.fillRect(x, y, barWidth, barHeight);

    // HP fill
    const hpColor = hpPct > 0.5 ? 0x44ff44 : hpPct > 0.25 ? 0xffaa44 : 0xff4444;
    this.hpBar.fillStyle(hpColor, 1);
    this.hpBar.fillRect(x, y, barWidth * hpPct, barHeight);

    // Update name tag position
    this.nameTag.setPosition(this.sprite.x, this.sprite.y - 120);

    this.prevX = this.sprite.x;
    this.prevY = this.sprite.y;
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
    this.nameTag.destroy();
  }
}
