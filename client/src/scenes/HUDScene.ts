import Phaser from 'phaser';
import { networkClient } from '../network/ColyseusClient';
import { TEAM_COLOR_STRINGS, NUM_TEAMS } from '../shared/constants';

export class HUDScene extends Phaser.Scene {
  private hpText!: Phaser.GameObjects.Text;
  private objectiveHpText!: Phaser.GameObjects.Text;
  private damageTexts: Phaser.GameObjects.Text[] = [];
  private myTeamIndex: number = 0;

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
