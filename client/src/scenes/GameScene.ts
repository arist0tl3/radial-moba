import Phaser from 'phaser';
import { networkClient } from '../network/ColyseusClient';
import { PlayerSprite } from '../entities/PlayerSprite';
import { MinionSprite } from '../entities/MinionSprite';
import { ObjectiveSprite } from '../entities/ObjectiveSprite';
import { ProjectileSprite } from '../entities/ProjectileSprite';
import {
  MAP_RADIUS,
  TEAM_COLORS,
  TEAM_COLOR_STRINGS,
  NUM_TEAMS,
  OBJECTIVE_RADIUS,
  BASE_RADIUS,
  TOWER_RADIUS,
} from '../shared/constants';

interface GameOverData {
  winnerTeam: number;
  damageByTeam: Record<string, number>;
}

export class GameScene extends Phaser.Scene {
  private playerSprites: Map<string, PlayerSprite> = new Map();
  private minionSprites: Map<string, MinionSprite> = new Map();
  private objectiveSprite: ObjectiveSprite | null = null;
  private baseSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private baseHpBars: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private towerGraphics: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private towerHpBars: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private myTeamIndex: number = 0;
  private gameRoomId: string = '';
  private mapBackground!: Phaser.GameObjects.Graphics;
  private disconnectOverlay: Phaser.GameObjects.Container | null = null;
  private gameOver: boolean = false;
  private projectileSprites: Map<string, ProjectileSprite> = new Map();
  private currentTargetId: string = '';
  private targetHighlight: Phaser.GameObjects.Graphics | null = null;
  private prevHp: Map<string, number> = new Map();
  private minimap!: Phaser.GameObjects.Graphics;
  private minimapBg!: Phaser.GameObjects.Graphics;
  private static readonly MINIMAP_SIZE = 160;
  private static readonly MINIMAP_PADDING = 10;

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
    this.cameras.main.setZoom(0.8);

    this.drawMap();
    this.connectToGame();

    // Set custom cursor and create target highlight graphic
    this.input.setDefaultCursor("url('/cursors/pointer.svg') 5 5, default");
    this.targetHighlight = this.add.graphics();
    this.targetHighlight.setDepth(100);

    this.createMinimap();

    // Click-to-move / click-to-attack input
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.gameOver) return;

      // Check if click is on minimap — convert to world coords
      const size = GameScene.MINIMAP_SIZE;
      const pad = GameScene.MINIMAP_PADDING;
      const mmRight = this.cameras.main.width - pad;
      const mmLeft = mmRight - size;
      const mmBottom = this.cameras.main.height - pad;
      const mmTop = mmBottom - size;

      if (pointer.x >= mmLeft && pointer.x <= mmRight && pointer.y >= mmTop && pointer.y <= mmBottom) {
        const mmCx = (mmLeft + mmRight) / 2;
        const mmCy = (mmTop + mmBottom) / 2;
        const mapSize = MAP_RADIUS * 2;
        const mapScale = mapSize / size;
        const worldX = MAP_RADIUS + (pointer.x - mmCx) * mapScale;
        const worldY = MAP_RADIUS + (pointer.y - mmCy) * mapScale;
        this.currentTargetId = '';
        networkClient.sendInput({ type: 'move', x: worldX, y: worldY });
        return;
      }

      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

      // Hit test entities — priority: enemy players > enemy minions > objective > enemy bases
      const targetId = this.hitTestEntities(worldPoint.x, worldPoint.y);

      if (targetId) {
        this.currentTargetId = targetId;
        networkClient.sendInput({ type: 'attack', targetId });
      } else {
        this.currentTargetId = '';
        networkClient.sendInput({
          type: 'move',
          x: worldPoint.x,
          y: worldPoint.y,
        });
      }
    });

    // Change cursor when hovering over attackable entities
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.gameOver) return;
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const hoverId = this.hitTestEntities(worldPoint.x, worldPoint.y);
      this.input.setDefaultCursor(
        hoverId
          ? "url('/cursors/sword.svg') 4 4, crosshair"
          : "url('/cursors/pointer.svg') 5 5, default"
      );
    });

    // Scroll wheel to zoom camera
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gos: any[], _dx: number, dy: number) => {
      const cam = this.cameras.main;
      const newZoom = Phaser.Math.Clamp(cam.zoom - dy * 0.001, 0.5, 1.5);
      cam.setZoom(newZoom);
    });
  }

  private spawnDamageNumber(x: number, y: number, amount: number, color: string = '#ffffff') {
    const text = this.add.text(x, y - 20, `-${Math.round(amount)}`, {
      fontSize: '16px',
      fontStyle: 'bold',
      color,
      stroke: '#000000',
      strokeThickness: 3,
    }).setDepth(50).setOrigin(0.5);

    this.tweens.add({
      targets: text,
      y: y - 50,
      alpha: 0,
      duration: 800,
      ease: 'Power1',
      onComplete: () => text.destroy(),
    });
  }

  private createMinimap() {
    const size = GameScene.MINIMAP_SIZE;
    const pad = GameScene.MINIMAP_PADDING;
    const x = this.cameras.main.width - size - pad;
    const y = this.cameras.main.height - size - pad;

    this.minimapBg = this.add.graphics();
    this.minimapBg.setScrollFactor(0);
    this.minimapBg.setDepth(90);
    this.minimapBg.fillStyle(0x111111, 0.7);
    this.minimapBg.fillCircle(x + size / 2, y + size / 2, size / 2);
    this.minimapBg.lineStyle(2, 0x555555, 0.8);
    this.minimapBg.strokeCircle(x + size / 2, y + size / 2, size / 2);

    this.minimap = this.add.graphics();
    this.minimap.setScrollFactor(0);
    this.minimap.setDepth(91);

    this.scale.on('resize', () => {
      this.minimapBg.clear();
      const rx = this.cameras.main.width - size - pad;
      const ry = this.cameras.main.height - size - pad;
      this.minimapBg.fillStyle(0x111111, 0.7);
      this.minimapBg.fillCircle(rx + size / 2, ry + size / 2, size / 2);
      this.minimapBg.lineStyle(2, 0x555555, 0.8);
      this.minimapBg.strokeCircle(rx + size / 2, ry + size / 2, size / 2);
    });
  }

  private updateMinimap() {
    const room = networkClient.gameRoom;
    if (!room) return;
    this.minimap.clear();

    const size = GameScene.MINIMAP_SIZE;
    const pad = GameScene.MINIMAP_PADDING;
    const cx = this.cameras.main.width - size / 2 - pad;
    const cy = this.cameras.main.height - size / 2 - pad;
    const mapSize = MAP_RADIUS * 2;
    const scale = size / mapSize;

    const toMiniX = (wx: number) => cx + (wx - MAP_RADIUS) * scale;
    const toMiniY = (wy: number) => cy + (wy - MAP_RADIUS) * scale;

    // Bases
    room.state.bases.forEach((base: any) => {
      if (base.destroyed && base.capturedByTeam < 0) return;
      const color = base.destroyed && base.capturedByTeam >= 0
        ? TEAM_COLORS[base.capturedByTeam] ?? 0x888888
        : TEAM_COLORS[base.teamIndex] ?? 0x888888;
      this.minimap.fillStyle(color, 0.9);
      this.minimap.fillRect(toMiniX(base.x) - 4, toMiniY(base.y) - 4, 8, 8);
    });

    // Towers
    room.state.towers.forEach((tower: any) => {
      if (tower.destroyed) return;
      this.minimap.fillStyle(0x888888, 0.8);
      this.minimap.fillCircle(toMiniX(tower.x), toMiniY(tower.y), 3);
    });

    // Objective
    if (room.state.objective && room.state.objective.hp > 0) {
      this.minimap.fillStyle(0xaa88ff, 0.9);
      this.minimap.fillCircle(toMiniX(room.state.objective.x), toMiniY(room.state.objective.y), 5);
    }

    // Minions
    room.state.minions.forEach((minion: any) => {
      if (minion.hp <= 0) return;
      const color = minion.teamIndex >= 0 ? (TEAM_COLORS[minion.teamIndex] ?? 0xffffff) : 0xff8800;
      this.minimap.fillStyle(color, 0.6);
      this.minimap.fillCircle(toMiniX(minion.x), toMiniY(minion.y), 2);
    });

    // Players
    room.state.players.forEach((player: any, key: string) => {
      if (!player.alive) return;
      const color = TEAM_COLORS[player.teamIndex] ?? 0xffffff;
      const isMe = key === room.sessionId;
      this.minimap.fillStyle(color, 1);
      this.minimap.fillCircle(toMiniX(player.x), toMiniY(player.y), isMe ? 4 : 3);
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
    g.strokeCircle(cx, cy, 175);

    // Tower position indicators (subtle dots at 50% radius on each lane)
    g.fillStyle(0x666666, 0.3);
    for (let i = 0; i < NUM_TEAMS; i++) {
      const angle = (i / NUM_TEAMS) * Math.PI * 2 - Math.PI / 2;
      const towerDist = MAP_RADIUS * 0.50;
      const ttx = cx + Math.cos(angle) * towerDist;
      const tty = cy + Math.sin(angle) * towerDist;
      g.fillCircle(ttx, tty, 10);
    }
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
        this.prevHp.delete(key);
      });

      room.state.minions.onAdd((minion: any, key: string) => {
        const sprite = new MinionSprite(this, minion);
        this.minionSprites.set(key, sprite);
      });

      room.state.minions.onRemove((_minion: any, key: string) => {
        const sprite = this.minionSprites.get(key);
        if (sprite) {
          sprite.playDeathAndDestroy();
        }
        this.minionSprites.delete(key);
        this.prevHp.delete(`m_${key}`);
      });

      // Projectiles
      room.state.projectiles.onAdd((projectile: any, key: string) => {
        const sprite = new ProjectileSprite(this, projectile);
        this.projectileSprites.set(key, sprite);
      });

      room.state.projectiles.onRemove((_projectile: any, key: string) => {
        const sprite = this.projectileSprites.get(key);
        sprite?.destroy();
        this.projectileSprites.delete(key);
      });

      // Central objective — create sprite immediately from initial state
      if (room.state.objective) {
        this.objectiveSprite = new ObjectiveSprite(this, room.state.objective);
      }

      // Bases
      room.state.bases.onAdd((base: any, key: string) => {
        const color = TEAM_COLORS[base.teamIndex] ?? 0x888888;
        const baseSprite = this.add.sprite(base.x, base.y, 'statue');
        baseSprite.setTint(color);
        baseSprite.setScale(4.0);
        baseSprite.setDepth(3);
        this.baseSprites.set(key, baseSprite);

        const hpBar = this.add.graphics();
        hpBar.setDepth(4);
        this.baseHpBars.set(key, hpBar);
      });

      // Towers
      room.state.towers.onAdd((tower: any, key: string) => {
        const gfx = this.add.graphics();
        gfx.setDepth(3);
        this.towerGraphics.set(key, gfx);

        const hpBar = this.add.graphics();
        hpBar.setDepth(4);
        this.towerHpBars.set(key, hpBar);
      });

      room.state.towers.onRemove((_tower: any, key: string) => {
        const gfx = this.towerGraphics.get(key);
        gfx?.destroy();
        this.towerGraphics.delete(key);

        const hpBar = this.towerHpBars.get(key);
        hpBar?.destroy();
        this.towerHpBars.delete(key);
      });

      // Launch HUD scene on top
      this.scene.launch('HUDScene', { teamIndex: this.myTeamIndex });

      // Disconnect / reconnect handling
      networkClient.onDisconnect = () => {
        this.showDisconnectOverlay();
      };
      networkClient.onReconnect = () => {
        this.hideDisconnectOverlay();
      };

      // Game over handler
      room.onMessage('gameOver', (data: GameOverData) => {
        networkClient.clearSession(); // Game is over, no need to reconnect
        this.showVictoryScreen(data);
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

      // Damage numbers
      const prevPlayerHp = this.prevHp.get(key) ?? player.hp;
      if (player.hp < prevPlayerHp && player.alive) {
        const amount = prevPlayerHp - player.hp;
        const isAlly = player.teamIndex === this.myTeamIndex;
        this.spawnDamageNumber(player.x, player.y, amount, isAlly ? '#ff4444' : '#ffffff');
      }
      this.prevHp.set(key, player.hp);
    });

    room.state.minions.forEach((minion: any, key: string) => {
      const sprite = this.minionSprites.get(key);
      sprite?.updateFromState(minion);

      // Damage numbers
      const minionKey = `m_${key}`;
      const prevMinionHp = this.prevHp.get(minionKey) ?? minion.hp;
      if (minion.hp < prevMinionHp) {
        const amount = prevMinionHp - minion.hp;
        this.spawnDamageNumber(minion.x, minion.y, amount, '#ffffff');
      }
      this.prevHp.set(minionKey, minion.hp);
    });

    room.state.projectiles.forEach((projectile: any, key: string) => {
      const sprite = this.projectileSprites.get(key);
      sprite?.updateFromState(projectile);
    });

    if (this.objectiveSprite && room.state.objective) {
      this.objectiveSprite.updateFromState(room.state.objective);

      // Damage numbers
      const prevObjHp = this.prevHp.get('objective') ?? room.state.objective.hp;
      if (room.state.objective.hp < prevObjHp) {
        const amount = prevObjHp - room.state.objective.hp;
        this.spawnDamageNumber(room.state.objective.x, room.state.objective.y, amount, '#ffaa44');
      }
      this.prevHp.set('objective', room.state.objective.hp);
    }

    // Draw target highlight ring
    this.drawTargetHighlight();

    // Update base visuals (HP bars + destroyed/captured state)
    room.state.bases.forEach((base: any, key: string) => {
      const baseSprite = this.baseSprites.get(key);
      const hpBar = this.baseHpBars.get(key);

      // Damage numbers
      const baseHpKey = `b_${key}`;
      const prevBaseHp = this.prevHp.get(baseHpKey) ?? base.hp;
      if (base.hp < prevBaseHp && !base.destroyed) {
        const amount = prevBaseHp - base.hp;
        this.spawnDamageNumber(base.x, base.y, amount, '#ffffff');
      }
      this.prevHp.set(baseHpKey, base.hp);

      // HP bar
      if (hpBar) {
        hpBar.clear();
        if (!base.destroyed) {
          const barWidth = 80;
          const barHeight = 5;
          const bx = base.x - barWidth / 2;
          const by = base.y - 70;
          const hpPct = Math.max(0, base.hp / base.maxHp);

          // Background
          hpBar.fillStyle(0x333333, 0.8);
          hpBar.fillRect(bx, by, barWidth, barHeight);

          // HP fill — team colored
          const color = TEAM_COLORS[base.teamIndex] ?? 0xffffff;
          hpBar.fillStyle(color, 1);
          hpBar.fillRect(bx, by, barWidth * hpPct, barHeight);

          // Border
          hpBar.lineStyle(1, 0xffffff, 0.5);
          hpBar.strokeRect(bx - 1, by - 1, barWidth + 2, barHeight + 2);
        }
      }

      // Tint changes on capture
      if (!baseSprite || !base.destroyed) return;

      if (base.capturedByTeam >= 0) {
        const captorColor = TEAM_COLORS[base.capturedByTeam] ?? 0x888888;
        baseSprite.setTint(captorColor);
        baseSprite.setAlpha(0.7);
      } else {
        baseSprite.setTint(0x444444);
        baseSprite.setAlpha(0.2);
      }
    });

    // Update tower visuals
    room.state.towers.forEach((tower: any, key: string) => {
      const gfx = this.towerGraphics.get(key);
      const hpBar = this.towerHpBars.get(key);
      if (!gfx) return;

      // Damage numbers
      const towerHpKey = `t_${key}`;
      const prevTowerHp = this.prevHp.get(towerHpKey) ?? tower.hp;
      if (tower.hp < prevTowerHp && !tower.destroyed) {
        const amount = prevTowerHp - tower.hp;
        this.spawnDamageNumber(tower.x, tower.y, amount, '#aaaaaa');
      }
      this.prevHp.set(towerHpKey, tower.hp);

      gfx.clear();
      if (!tower.destroyed) {
        // Tower body: neutral gray structure
        gfx.fillStyle(0x888888, 0.6);
        gfx.fillCircle(tower.x, tower.y, TOWER_RADIUS);
        gfx.lineStyle(3, 0xaaaaaa, 0.9);
        gfx.strokeCircle(tower.x, tower.y, TOWER_RADIUS);
        // Inner core
        gfx.fillStyle(0xcccccc, 0.4);
        gfx.fillCircle(tower.x, tower.y, TOWER_RADIUS * 0.4);
      } else {
        // Destroyed: dim rubble
        gfx.fillStyle(0x444444, 0.2);
        gfx.fillCircle(tower.x, tower.y, TOWER_RADIUS * 0.7);
      }

      // HP bar
      if (hpBar) {
        hpBar.clear();
        if (!tower.destroyed) {
          const barWidth = 65;
          const barHeight = 4;
          const bx = tower.x - barWidth / 2;
          const by = tower.y - TOWER_RADIUS - 18;
          const hpPct = Math.max(0, tower.hp / tower.maxHp);

          hpBar.fillStyle(0x333333, 0.8);
          hpBar.fillRect(bx, by, barWidth, barHeight);
          hpBar.fillStyle(0xaaaaaa, 1); // Neutral gray HP bar
          hpBar.fillRect(bx, by, barWidth * hpPct, barHeight);
          hpBar.lineStyle(1, 0xffffff, 0.5);
          hpBar.strokeRect(bx - 1, by - 1, barWidth + 2, barHeight + 2);
        }
      }
    });

    // Minimap
    this.updateMinimap();
  }

  /**
   * Hit test click position against enemy entities.
   * Returns entity ID if hit, or empty string if no target.
   */
  private hitTestEntities(wx: number, wy: number): string {
    const room = networkClient.gameRoom;
    if (!room) return '';

    const distSq = (ax: number, ay: number, bx: number, by: number) =>
      (ax - bx) ** 2 + (ay - by) ** 2;

    // 1. Enemy players (hit radius ~35px)
    const PLAYER_HIT_RADIUS = 35;
    let closestId = '';
    let closestDist = Infinity;

    room.state.players.forEach((player: any, key: string) => {
      if (!player.alive || player.teamIndex === this.myTeamIndex) return;
      const d = distSq(wx, wy, player.x, player.y);
      if (d <= PLAYER_HIT_RADIUS ** 2 && d < closestDist) {
        closestDist = d;
        closestId = key; // sessionId
      }
    });
    if (closestId) return closestId;

    // 2. Enemy minions (hit radius ~28px)
    const MINION_HIT_RADIUS = 28;
    closestDist = Infinity;

    room.state.minions.forEach((minion: any, key: string) => {
      if (minion.teamIndex === this.myTeamIndex || minion.hp <= 0) return;
      const d = distSq(wx, wy, minion.x, minion.y);
      if (d <= MINION_HIT_RADIUS ** 2 && d < closestDist) {
        closestDist = d;
        closestId = key; // e.g. "minion_0"
      }
    });
    if (closestId) return closestId;

    // 2.5. Towers (neutral — always attackable)
    const TOWER_HIT_RADIUS = TOWER_RADIUS + 16;
    closestDist = Infinity;

    room.state.towers.forEach((tower: any, key: string) => {
      if (tower.destroyed) return;
      const d = Math.sqrt(distSq(wx, wy, tower.x, tower.y));
      if (d <= TOWER_HIT_RADIUS && d < closestDist) {
        closestDist = d;
        closestId = `tower_${key}`;
      }
    });
    if (closestId) return closestId;

    // 3. Central objective
    if (room.state.objective && room.state.objective.hp > 0) {
      const d = Math.sqrt(distSq(wx, wy, room.state.objective.x, room.state.objective.y));
      if (d <= OBJECTIVE_RADIUS + 16) {
        return 'objective';
      }
    }

    // 4. Enemy bases
    room.state.bases.forEach((base: any, key: string) => {
      if (base.teamIndex === this.myTeamIndex || base.destroyed) return;
      const d = Math.sqrt(distSq(wx, wy, base.x, base.y));
      if (d <= BASE_RADIUS + 16 && d < closestDist) {
        closestDist = d;
        closestId = `base_${base.teamIndex}`;
      }
    });
    if (closestId) return closestId;

    return '';
  }

  /**
   * Draw a pulsing ring around the currently targeted entity.
   */
  private drawTargetHighlight() {
    if (!this.targetHighlight) return;
    this.targetHighlight.clear();

    if (!this.currentTargetId) return;

    const room = networkClient.gameRoom;
    if (!room) return;

    let tx = 0, ty = 0, radius = 16;
    let found = false;

    if (this.currentTargetId === 'objective') {
      if (room.state.objective && room.state.objective.hp > 0) {
        tx = room.state.objective.x;
        ty = room.state.objective.y;
        radius = OBJECTIVE_RADIUS + 6;
        found = true;
      }
    } else if (this.currentTargetId.startsWith('tower_')) {
      const towerKey = this.currentTargetId.replace('tower_', '');
      const tower = room.state.towers.get(towerKey);
      if (tower && !tower.destroyed) {
        tx = tower.x;
        ty = tower.y;
        radius = TOWER_RADIUS + 6;
        found = true;
      }
    } else if (this.currentTargetId.startsWith('base_')) {
      const teamIdx = this.currentTargetId.replace('base_', '');
      const base = room.state.bases.get(teamIdx);
      if (base && !base.destroyed) {
        tx = base.x;
        ty = base.y;
        radius = BASE_RADIUS + 6;
        found = true;
      }
    } else {
      // Could be a player or minion
      const player = room.state.players.get(this.currentTargetId);
      if (player && player.alive) {
        tx = player.x;
        ty = player.y;
        radius = 32;
        found = true;
      } else {
        const minion = room.state.minions.get(this.currentTargetId);
        if (minion && minion.hp > 0) {
          tx = minion.x;
          ty = minion.y;
          radius = 24;
          found = true;
        }
      }
    }

    if (!found) {
      // Target is dead/gone
      this.currentTargetId = '';
      return;
    }

    // Draw pulsing ring
    const pulse = 0.8 + Math.sin(this.time.now / 200) * 0.2;
    this.targetHighlight.lineStyle(2, 0xff6600, pulse);
    this.targetHighlight.strokeCircle(tx, ty, radius);
  }

  private showVictoryScreen(data: GameOverData) {
    this.gameOver = true;

    const camW = this.cameras.main.width;
    const camH = this.cameras.main.height;
    const cx = camW / 2;
    const cy = camH / 2;
    const depth = 150;

    // Semi-transparent backdrop
    this.add.rectangle(cx, cy, camW, camH, 0x000000, 0.75)
      .setScrollFactor(0).setDepth(depth);

    // Victory / Defeat heading
    const isWinner = data.winnerTeam === this.myTeamIndex;
    const headingText = isWinner ? 'VICTORY!' : 'DEFEAT';
    const headingColor = isWinner ? '#44ff44' : '#ff4444';
    this.add.text(cx, cy - 120, headingText, {
      fontSize: '64px',
      color: headingColor,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth);

    // Winning team label
    this.add.text(cx, cy - 60, `Team ${data.winnerTeam + 1} wins!`, {
      fontSize: '28px',
      color: TEAM_COLOR_STRINGS[data.winnerTeam] ?? '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth);

    // Damage scoreboard title
    this.add.text(cx, cy - 15, 'Damage to Objective', {
      fontSize: '18px',
      color: '#aaaaaa',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth);

    // Sort teams by damage (descending)
    const teamDamages: { teamIndex: number; damage: number }[] = [];
    for (let i = 0; i < NUM_TEAMS; i++) {
      teamDamages.push({
        teamIndex: i,
        damage: data.damageByTeam[String(i)] ?? 0,
      });
    }
    teamDamages.sort((a, b) => b.damage - a.damage);

    for (let i = 0; i < teamDamages.length; i++) {
      const { teamIndex, damage } = teamDamages[i];
      const marker = teamIndex === this.myTeamIndex ? ' ◄' : '';
      const crown = teamIndex === data.winnerTeam ? ' 👑' : '';
      this.add.text(cx, cy + 15 + i * 28, `Team ${teamIndex + 1}: ${Math.round(damage)} dmg${crown}${marker}`, {
        fontSize: '16px',
        color: TEAM_COLOR_STRINGS[teamIndex] ?? '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(depth);
    }

    // "Return to Lobby" button — placed directly on the scene (not in a container)
    const btnY = cy + 15 + teamDamages.length * 28 + 30;
    const btnBg = this.add.rectangle(cx, btnY, 240, 44, 0x333333, 0.9)
      .setScrollFactor(0).setDepth(depth);
    btnBg.setStrokeStyle(2, 0x44ff44, 1);
    this.add.text(cx, btnY, '[ RETURN TO LOBBY ]', {
      fontSize: '20px',
      color: '#44ff44',
      fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth);

    btnBg.setInteractive({ useHandCursor: true });
    btnBg.on('pointerover', () => { btnBg.setFillStyle(0x444444, 1); });
    btnBg.on('pointerout', () => { btnBg.setFillStyle(0x333333, 0.9); });
    btnBg.on('pointerdown', () => { this.returnToLobby(); });
  }

  private returnToLobby() {
    networkClient.leaveGame();
    this.scene.stop('HUDScene');
    this.scene.start('LobbyScene');
  }

  private showDisconnectOverlay() {
    if (this.disconnectOverlay) return;

    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height / 2;

    const bg = this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.6);
    const text = this.add.text(0, -20, 'Connection lost', {
      fontSize: '28px',
      color: '#ff4444',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const subText = this.add.text(0, 20, 'Reconnecting...', {
      fontSize: '18px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    this.disconnectOverlay = this.add.container(cx, cy, [bg, text, subText]);
    this.disconnectOverlay.setScrollFactor(0);
    this.disconnectOverlay.setDepth(200);
  }

  private hideDisconnectOverlay() {
    if (this.disconnectOverlay) {
      this.disconnectOverlay.destroy();
      this.disconnectOverlay = null;
    }
  }
}
