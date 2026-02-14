import Phaser from 'phaser';
import { networkClient } from '../network/ColyseusClient';
import {
  TEAM_COLOR_STRINGS,
  NUM_TEAMS,
  LEVEL_BONUS_DAMAGE,
  LEVEL_BONUS_MAX_HP,
  LEVEL_BONUS_SPEED,
  LEVEL_BONUS_REGEN,
  LEVEL_BONUS_DEFENSE,
} from '../shared/constants';

const UPGRADE_LABELS: Record<string, string> = {
  damage: `+${LEVEL_BONUS_DAMAGE} Attack Damage`,
  maxHp: `+${LEVEL_BONUS_MAX_HP} Max HP`,
  speed: `+${LEVEL_BONUS_SPEED} Move Speed`,
  regen: `+${LEVEL_BONUS_REGEN} HP Regen/s`,
  defense: `+${LEVEL_BONUS_DEFENSE} Defense`,
};

export class HUDScene extends Phaser.Scene {
  private hpText!: Phaser.GameObjects.Text;
  private objectiveHpText!: Phaser.GameObjects.Text;
  private damageTexts: Phaser.GameObjects.Text[] = [];
  private myTeamIndex: number = 0;

  // Level / XP
  private levelText!: Phaser.GameObjects.Text;
  private xpBarBg!: Phaser.GameObjects.Graphics;
  private xpBarFill!: Phaser.GameObjects.Graphics;

  // Level-up popup
  private levelUpContainer!: Phaser.GameObjects.Container;
  private levelUpActive: boolean = false;

  constructor() {
    super({ key: 'HUDScene' });
  }

  init(data: { teamIndex: number }) {
    this.myTeamIndex = data.teamIndex ?? 0;
  }

  create() {
    // Player HP
    this.hpText = this.add.text(20, 20, 'HP: ---', {
      fontSize: '20px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    });

    // Objective HP
    this.objectiveHpText = this.add.text(20, 50, 'Objective: ---', {
      fontSize: '18px',
      color: '#ffaa44',
      stroke: '#000000',
      strokeThickness: 3,
    });

    // Damage scoreboard
    for (let i = 0; i < NUM_TEAMS; i++) {
      const text = this.add.text(20, 80 + i * 24, `Team ${i + 1}: 0`, {
        fontSize: '14px',
        color: TEAM_COLOR_STRINGS[i],
        stroke: '#000000',
        strokeThickness: 2,
      });
      this.damageTexts.push(text);
    }

    // Level / XP display (bottom-left)
    this.levelText = this.add.text(20, this.scale.height - 50, 'Lv 1', {
      fontSize: '18px',
      color: '#ffdd44',
      stroke: '#000000',
      strokeThickness: 3,
    });

    this.xpBarBg = this.add.graphics();
    this.xpBarFill = this.add.graphics();
    this.drawXpBar(0, 1);

    // Level-up popup container (hidden initially)
    this.levelUpContainer = this.add.container(this.scale.width / 2, this.scale.height / 2);
    this.levelUpContainer.setVisible(false);
    this.levelUpContainer.setDepth(100);

    // Listen for level-up choices from server
    const room = networkClient.gameRoom;
    if (room) {
      room.onMessage('levelUpChoices', (data: { level: number; choices: string[] }) => {
        this.showLevelUpPopup(data.level, data.choices);
      });
    }

    // Handle resize
    this.scale.on('resize', () => {
      this.levelText.setPosition(20, this.scale.height - 50);
      this.drawXpBar(0, 1);
      this.levelUpContainer.setPosition(this.scale.width / 2, this.scale.height / 2);
    });
  }

  private drawXpBar(xp: number, xpToNext: number) {
    const barWidth = 120;
    const barHeight = 8;
    const x = 20;
    const y = this.scale.height - 28;

    this.xpBarBg.clear();
    this.xpBarBg.fillStyle(0x333333, 0.8);
    this.xpBarBg.fillRect(x, y, barWidth, barHeight);

    const pct = Math.min(1, xp / Math.max(1, xpToNext));
    this.xpBarFill.clear();
    this.xpBarFill.fillStyle(0xffdd44, 1);
    this.xpBarFill.fillRect(x, y, barWidth * pct, barHeight);
  }

  private showLevelUpPopup(level: number, choices: string[]) {
    if (this.levelUpActive) return;
    this.levelUpActive = true;

    // Clear previous children
    this.levelUpContainer.removeAll(true);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.85);
    bg.fillRoundedRect(-160, -80, 320, 160, 12);
    bg.lineStyle(2, 0xffdd44, 1);
    bg.strokeRoundedRect(-160, -80, 320, 160, 12);
    this.levelUpContainer.add(bg);

    // Title
    const title = this.add.text(0, -60, `Level ${level}!`, {
      fontSize: '22px',
      color: '#ffdd44',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.levelUpContainer.add(title);

    const subtitle = this.add.text(0, -36, 'Choose an upgrade:', {
      fontSize: '14px',
      color: '#cccccc',
    }).setOrigin(0.5);
    this.levelUpContainer.add(subtitle);

    // Buttons
    choices.forEach((choice, i) => {
      const btnY = -4 + i * 48;
      const label = UPGRADE_LABELS[choice] ?? choice;

      const btnBg = this.add.graphics();
      btnBg.fillStyle(0x444444, 1);
      btnBg.fillRoundedRect(-130, btnY - 16, 260, 36, 8);

      const btnText = this.add.text(0, btnY, label, {
        fontSize: '16px',
        color: '#ffffff',
      }).setOrigin(0.5, 0.3);

      // Hit area for the button
      const hitZone = this.add.zone(0, btnY + 2, 260, 36).setInteractive({ useHandCursor: true });

      hitZone.on('pointerover', () => {
        btnBg.clear();
        btnBg.fillStyle(0x666666, 1);
        btnBg.fillRoundedRect(-130, btnY - 16, 260, 36, 8);
      });

      hitZone.on('pointerout', () => {
        btnBg.clear();
        btnBg.fillStyle(0x444444, 1);
        btnBg.fillRoundedRect(-130, btnY - 16, 260, 36, 8);
      });

      hitZone.on('pointerdown', () => {
        networkClient.sendMessage('levelUpChoice', { choice });
        this.levelUpContainer.setVisible(false);
        this.levelUpActive = false;
      });

      this.levelUpContainer.add([btnBg, btnText, hitZone]);
    });

    this.levelUpContainer.setVisible(true);
  }

  update() {
    const room = networkClient.gameRoom;
    if (!room) return;

    // Stop updating HUD once the game is over
    if (room.state.phase === 'finished') return;

    // Update player HP
    const me = room.state.players.get(room.sessionId);
    if (me) {
      this.hpText.setText(`HP: ${Math.max(0, Math.round(me.hp))} / ${me.maxHp}`);
      if (!me.alive) {
        this.hpText.setText(`DEAD — Respawn: ${(me.respawnTimer / 1000).toFixed(1)}s`);
      }

      // Update level / XP
      this.levelText.setText(`Lv ${me.level}`);
      this.drawXpBar(me.xp, me.xpToNextLevel);
    }

    // Update objective HP
    const obj = room.state.objective;
    if (obj) {
      const pct = Math.max(0, (obj.hp / obj.maxHp) * 100);
      this.objectiveHpText.setText(`Objective: ${Math.round(obj.hp)} / ${obj.maxHp} (${pct.toFixed(0)}%)`);

      // Update damage scoreboard
      for (let i = 0; i < NUM_TEAMS; i++) {
        const dmg = obj.damageByTeam?.get(String(i)) ?? 0;
        const marker = i === this.myTeamIndex ? ' ◄' : '';
        this.damageTexts[i]?.setText(`Team ${i + 1}: ${Math.round(dmg)} dmg${marker}`);
      }
    }
  }
}
