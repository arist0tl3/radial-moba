import Phaser from 'phaser';
import { networkClient } from '../network/ColyseusClient';
import { PlayerSprite } from '../entities/PlayerSprite';
import { MinionSprite } from '../entities/MinionSprite';
import { ObjectiveSprite } from '../entities/ObjectiveSprite';
import {
  MAP_RADIUS,
  TEAM_COLORS,
  TEAM_COLOR_STRINGS,
  NUM_TEAMS,
  BASE_RADIUS,
} from '../shared/constants';

export class GameScene extends Phaser.Scene {
  private playerSprites: Map<string, PlayerSprite> = new Map();
  private minionSprites: Map<string, MinionSprite> = new Map();
  private objectiveSprite: ObjectiveSprite | null = null;
  private baseSprites: Map<string, Phaser.GameObjects.Arc> = new Map();
  private myTeamIndex: number = 0;
  private gameRoomId: string = '';
  private mapBackground!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { teamIndex: number; gameRoomId: string }) {
    this.myTeamIndex = data.teamIndex ?? 0;
    this.gameRoomId = data.gameRoomId;
  }

  create() {
    // Set camera bounds to the map
    const mapSize = MAP_RADIUS * 2;
    this.cameras.main.setBounds(0, 0, mapSize, mapSize);

    this.drawMap();
    this.connectToGame();

    // Click-to-move input
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      networkClient.sendInput({
        type: 'move',
        x: worldPoint.x,
        y: worldPoint.y,
      });
    });
  }

  private drawMap() {
    this.mapBackground = this.add.graphics();
    const g = this.mapBackground;
    const cx = MAP_RADIUS;
    const cy = MAP_RADIUS;

    // Dark arena circle
    g.fillStyle(0x1a1a2e, 1);
    g.fillCircle(cx, cy, MAP_RADIUS);

    // Team slice dividers
    g.lineStyle(2, 0x333355, 0.5);
    for (let i = 0; i < NUM_TEAMS; i++) {
      const angle = (i / NUM_TEAMS) * Math.PI * 2 - Math.PI / 2;
      const edgeX = cx + Math.cos(angle) * MAP_RADIUS;
      const edgeY = cy + Math.sin(angle) * MAP_RADIUS;
      g.lineBetween(cx, cy, edgeX, edgeY);
    }

    // Arena border
    g.lineStyle(3, 0x555588, 1);
    g.strokeCircle(cx, cy, MAP_RADIUS);

    // Center zone indicator
    g.lineStyle(2, 0x888888, 0.3);
    g.strokeCircle(cx, cy, 100);
  }

  private async connectToGame() {
    try {
      const room = await networkClient.joinGame(this.gameRoomId, { teamIndex: this.myTeamIndex });

      // Listen for state changes
      room.state.players.onAdd((player: any, key: string) => {
        const isMe = key === room.sessionId;
        const sprite = new PlayerSprite(this, player, isMe);
        this.playerSprites.set(key, sprite);

        if (isMe) {
          this.cameras.main.startFollow(sprite.sprite, true, 0.1, 0.1);
        }
      });

      room.state.players.onRemove((_player: any, key: string) => {
        const sprite = this.playerSprites.get(key);
        sprite?.destroy();
        this.playerSprites.delete(key);
      });

      room.state.minions.onAdd((minion: any, key: string) => {
        const sprite = new MinionSprite(this, minion);
        this.minionSprites.set(key, sprite);
      });

      room.state.minions.onRemove((_minion: any, key: string) => {
        const sprite = this.minionSprites.get(key);
        sprite?.destroy();
        this.minionSprites.delete(key);
      });

      // Central objective
      room.state.listen('objective', (objective: any) => {
        if (!this.objectiveSprite) {
          this.objectiveSprite = new ObjectiveSprite(this, objective);
        }
      });

      // Bases
      room.state.bases.onAdd((base: any, key: string) => {
        const color = TEAM_COLORS[base.teamIndex] ?? 0x888888;
        const circle = this.add.circle(base.x, base.y, BASE_RADIUS, color, 0.6);
        circle.setStrokeStyle(2, color, 1);
        this.baseSprites.set(key, circle);
      });

      // Launch HUD scene on top
      this.scene.launch('HUDScene', { teamIndex: this.myTeamIndex });

      // Game over handler
      room.onMessage('gameOver', (data: { winnerTeam: number }) => {
        const winText = data.winnerTeam === this.myTeamIndex ? 'VICTORY!' : `Team ${data.winnerTeam + 1} Wins`;
        const color = data.winnerTeam === this.myTeamIndex ? '#44ff44' : '#ff4444';
        const text = this.add.text(MAP_RADIUS, MAP_RADIUS, winText, {
          fontSize: '64px',
          color,
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 4,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
      });
    } catch (err) {
      console.error('Failed to join game:', err);
    }
  }

  update() {
    // Update sprites from server state
    const room = networkClient.gameRoom;
    if (!room) return;

    room.state.players.forEach((player: any, key: string) => {
      const sprite = this.playerSprites.get(key);
      sprite?.updateFromState(player);
    });

    room.state.minions.forEach((minion: any, key: string) => {
      const sprite = this.minionSprites.get(key);
      sprite?.updateFromState(minion);
    });

    if (this.objectiveSprite && room.state.objective) {
      this.objectiveSprite.updateFromState(room.state.objective);
    }

    // Update base visuals (destroyed state)
    room.state.bases.forEach((base: any, key: string) => {
      const circle = this.baseSprites.get(key);
      if (circle && base.destroyed) {
        circle.setAlpha(0.2);
      }
    });
  }
}
