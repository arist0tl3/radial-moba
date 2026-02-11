import { Client, Room } from 'colyseus.js';

const SERVER_URL = `ws://${window.location.hostname}:2567`;

class NetworkClient {
  private client: Client;
  private _lobbyRoom: Room | null = null;
  private _gameRoom: Room | null = null;

  constructor() {
    this.client = new Client(SERVER_URL);
  }

  get lobbyRoom(): Room | null {
    return this._lobbyRoom;
  }

  get gameRoom(): Room | null {
    return this._gameRoom;
  }

  async createLobby(): Promise<Room> {
    this._lobbyRoom = await this.client.create('lobby');
    return this._lobbyRoom;
  }

  async joinLobby(roomId: string): Promise<Room> {
    this._lobbyRoom = await this.client.joinById(roomId);
    return this._lobbyRoom;
  }

  async joinGame(options: { teamIndex: number }): Promise<Room> {
    this._gameRoom = await this.client.create('game', options);
    return this._gameRoom;
  }

  async joinGameById(roomId: string, options: { teamIndex: number }): Promise<Room> {
    this._gameRoom = await this.client.joinById(roomId, options);
    return this._gameRoom;
  }

  leaveLobby() {
    this._lobbyRoom?.leave();
    this._lobbyRoom = null;
  }

  leaveGame() {
    this._gameRoom?.leave();
    this._gameRoom = null;
  }

  sendInput(input: { type: string; [key: string]: unknown }) {
    this._gameRoom?.send('input', input);
  }
}

// Singleton
export const networkClient = new NetworkClient();
