import { Client, Room } from 'colyseus.js';

const SERVER_URL = `ws://${window.location.hostname}:2567`;

const SESSION_KEY = 'radial_moba_session';

export interface SessionData {
  reconnectionToken: string;
  gameRoomId: string;
  teamIndex: number;
}

export type DisconnectHandler = (code: number) => void;
export type ReconnectHandler = () => void;

class NetworkClient {
  private client: Client;
  private _lobbyRoom: Room | null = null;
  private _gameRoom: Room | null = null;
  private _onDisconnect: DisconnectHandler | null = null;
  private _onReconnect: ReconnectHandler | null = null;
  private _reconnectionToken: string = '';

  constructor() {
    this.client = new Client(SERVER_URL);
  }

  get lobbyRoom(): Room | null {
    return this._lobbyRoom;
  }

  get gameRoom(): Room | null {
    return this._gameRoom;
  }

  set onDisconnect(handler: DisconnectHandler | null) {
    this._onDisconnect = handler;
  }

  set onReconnect(handler: ReconnectHandler | null) {
    this._onReconnect = handler;
  }

  async createLobby(): Promise<Room> {
    this._lobbyRoom = await this.client.create('lobby');
    return this._lobbyRoom;
  }

  async joinLobby(roomId: string): Promise<Room> {
    this._lobbyRoom = await this.client.joinById(roomId);
    return this._lobbyRoom;
  }

  async joinGame(gameRoomId: string, options: { teamIndex: number }): Promise<Room> {
    this._gameRoom = await this.client.joinById(gameRoomId, options);
    this.storeReconnectionToken();
    this.saveSession(gameRoomId, options.teamIndex);
    this.setupGameRoomListeners();
    return this._gameRoom;
  }

  /**
   * Attempt to reconnect using session data saved in sessionStorage.
   * Returns the session data (with teamIndex) on success, or null on failure.
   */
  async tryReconnectFromStorage(): Promise<SessionData | null> {
    const session = this.loadSession();
    if (!session) return null;

    try {
      console.log('Attempting reconnect from sessionStorage...');
      this._gameRoom = await this.client.reconnect(session.reconnectionToken);
      this._reconnectionToken = (this._gameRoom as any).reconnectionToken ?? '';
      this.saveSession(session.gameRoomId, session.teamIndex);
      this.setupGameRoomListeners();
      console.log('Reconnected from sessionStorage successfully');
      return session;
    } catch (err) {
      console.log('SessionStorage reconnect failed:', err);
      this.clearSession();
      return null;
    }
  }

  private storeReconnectionToken() {
    if (this._gameRoom) {
      // The reconnection token is available after joining
      this._reconnectionToken = (this._gameRoom as any).reconnectionToken ?? '';
    }
  }

  /** Persist session data so we can reconnect after a browser refresh. */
  private saveSession(gameRoomId: string, teamIndex: number) {
    if (!this._reconnectionToken) return;
    const data: SessionData = {
      reconnectionToken: this._reconnectionToken,
      gameRoomId,
      teamIndex,
    };
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch {
      // sessionStorage may be unavailable in some contexts
    }
  }

  /** Load session data from sessionStorage. */
  loadSession(): SessionData | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as SessionData;
    } catch {
      return null;
    }
  }

  /** Clear stored session data (on intentional leave or game over). */
  clearSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }

  private setupGameRoomListeners() {
    if (!this._gameRoom) return;

    this._gameRoom.onLeave((code: number) => {
      // code 1000 = normal close (intentional leave)
      // code 1006 = abnormal close (disconnect)
      if (code !== 1000) {
        this._onDisconnect?.(code);
        this.attemptReconnect();
      }
    });
  }

  private async attemptReconnect() {
    const maxAttempts = 5;
    const delayMs = 2000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await new Promise((resolve) => setTimeout(resolve, delayMs));

        if (!this._reconnectionToken) break;

        this._gameRoom = await this.client.reconnect(this._reconnectionToken);
        this.storeReconnectionToken();
        // Update sessionStorage with the new token
        const session = this.loadSession();
        if (session) {
          this.saveSession(session.gameRoomId, session.teamIndex);
        }
        this.setupGameRoomListeners();
        this._onReconnect?.();
        return;
      } catch {
        console.log(`Reconnect attempt ${attempt}/${maxAttempts} failed`);
      }
    }

    // All attempts failed — give up
    console.log('Reconnection failed after all attempts');
    this._gameRoom = null;
    this.clearSession();
  }

  leaveLobby() {
    this._lobbyRoom?.leave();
    this._lobbyRoom = null;
  }

  leaveGame() {
    this._gameRoom?.leave();
    this._gameRoom = null;
    this.clearSession();
  }

  sendInput(input: { type: string; [key: string]: unknown }) {
    this._gameRoom?.send('input', input);
  }
}

// Singleton
export const networkClient = new NetworkClient();
