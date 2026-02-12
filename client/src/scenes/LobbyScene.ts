import Phaser from 'phaser';
import { networkClient } from '../network/ColyseusClient';
import { TEAM_COLOR_STRINGS, NUM_TEAMS } from '../shared/constants';

export class LobbyScene extends Phaser.Scene {
  private playerListTexts: Phaser.GameObjects.Text[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private roomLinkContainer: HTMLDivElement | null = null;

  constructor() {
    super({ key: 'LobbyScene' });
  }

  create() {
    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;

    this.add.text(cx, 60, 'RADIAL MOBA', {
      fontSize: '48px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.statusText = this.add.text(cx, 120, 'Click CREATE to host, or JOIN with a room ID', {
      fontSize: '18px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    // Room link container (DOM element so it's selectable/copyable)
    this.roomLinkContainer = document.createElement('div');
    this.roomLinkContainer.style.cssText =
      'position:fixed; top:140px; left:50%; transform:translateX(-50%); ' +
      'display:none; text-align:center; z-index:10;';
    this.roomLinkContainer.innerHTML =
      '<input id="room-link" readonly style="' +
      'background:#222; color:#66aaff; border:1px solid #444; padding:6px 12px; ' +
      'font-size:14px; font-family:monospace; width:350px; text-align:center; ' +
      'border-radius:4px; cursor:text;" />' +
      '<button id="copy-link" style="' +
      'background:#333; color:#44ff44; border:1px solid #444; padding:6px 12px; ' +
      'font-size:14px; margin-left:8px; cursor:pointer; border-radius:4px;">' +
      'COPY</button>';
    document.body.appendChild(this.roomLinkContainer);

    document.getElementById('copy-link')?.addEventListener('click', () => {
      const input = document.getElementById('room-link') as HTMLInputElement;
      if (input) {
        navigator.clipboard.writeText(input.value);
        const btn = document.getElementById('copy-link')!;
        btn.textContent = 'COPIED!';
        setTimeout(() => { btn.textContent = 'COPY'; }, 1500);
      }
    });

    // Create button
    const createBtn = this.add.text(cx - 100, 220, '[ CREATE ROOM ]', {
      fontSize: '20px',
      color: '#44ff44',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    createBtn.on('pointerdown', () => this.createRoom());

    // Join button
    const joinBtn = this.add.text(cx + 100, 220, '[ JOIN ROOM ]', {
      fontSize: '20px',
      color: '#ffaa44',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    joinBtn.on('pointerdown', () => this.promptJoinRoom());

    // Ready button
    const readyBtn = this.add.text(cx - 100, 280, '[ READY ]', {
      fontSize: '20px',
      color: '#44aaff',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    readyBtn.on('pointerdown', () => {
      networkClient.lobbyRoom?.send('ready');
    });

    // Start button (host only)
    const startBtn = this.add.text(cx + 100, 280, '[ START ]', {
      fontSize: '20px',
      color: '#ff4444',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    startBtn.on('pointerdown', () => {
      networkClient.lobbyRoom?.send('start');
    });

    // Team labels
    for (let i = 0; i < NUM_TEAMS; i++) {
      this.add.text(100 + i * 200, 340, `Team ${i + 1}`, {
        fontSize: '16px',
        color: TEAM_COLOR_STRINGS[i],
        fontStyle: 'bold',
      });
    }

    // Check URL for room ID to auto-join
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('room');
    if (roomId) {
      this.joinRoom(roomId);
    }
  }

  private async createRoom() {
    try {
      const room = await networkClient.createLobby();
      this.statusText.setText('Room created! Share this link:');
      const link = `${window.location.origin}?room=${room.id}`;
      this.showRoomLink(link);
      this.setupLobbyListeners();
    } catch (err) {
      this.statusText.setText(`Error: ${err}`);
    }
  }

  private promptJoinRoom() {
    const roomId = prompt('Enter room ID:');
    if (roomId) {
      this.joinRoom(roomId);
    }
  }

  private async joinRoom(roomId: string) {
    try {
      await networkClient.joinLobby(roomId);
      this.statusText.setText('Joined room!');
      this.showRoomLink(`Room: ${roomId}`);
      this.setupLobbyListeners();
    } catch (err) {
      this.statusText.setText(`Error joining: ${err}`);
    }
  }

  private setupLobbyListeners() {
    const room = networkClient.lobbyRoom;
    if (!room) return;

    room.state.players.onAdd((player: any, key: string) => {
      this.updatePlayerList();
    });

    room.state.players.onRemove(() => {
      this.updatePlayerList();
    });

    room.state.players.onChange(() => {
      this.updatePlayerList();
    });

    room.onMessage('gameStart', (data: { teamAssignments: Record<string, number>; gameRoomId: string }) => {
      const myTeam = data.teamAssignments[room.sessionId];
      networkClient.leaveLobby();
      this.destroyRoomLink();
      this.scene.start('GameScene', { teamIndex: myTeam, gameRoomId: data.gameRoomId });
    });
  }

  private showRoomLink(link: string) {
    if (this.roomLinkContainer) {
      this.roomLinkContainer.style.display = 'block';
      const input = document.getElementById('room-link') as HTMLInputElement;
      if (input) input.value = link;
    }
  }

  private destroyRoomLink() {
    if (this.roomLinkContainer) {
      this.roomLinkContainer.remove();
      this.roomLinkContainer = null;
    }
  }

  private updatePlayerList() {
    const room = networkClient.lobbyRoom;
    if (!room) return;

    // Clear old text
    this.playerListTexts.forEach((t) => t.destroy());
    this.playerListTexts = [];

    const playersByTeam: Record<number, any[]> = {};
    room.state.players.forEach((player: any) => {
      const team = player.teamIndex;
      if (!playersByTeam[team]) playersByTeam[team] = [];
      playersByTeam[team].push(player);
    });

    for (let teamIdx = 0; teamIdx < NUM_TEAMS; teamIdx++) {
      const players = playersByTeam[teamIdx] ?? [];
      players.forEach((p: any, i: number) => {
        const readyMark = p.ready ? ' ✓' : '';
        const isMe = p.sessionId === room.sessionId ? ' (you)' : '';
        const text = this.add.text(
          100 + teamIdx * 200,
          370 + i * 24,
          `${p.name}${isMe}${readyMark}`,
          {
            fontSize: '14px',
            color: p.ready ? '#44ff44' : '#cccccc',
          }
        );
        this.playerListTexts.push(text);
      });
    }
  }
}
