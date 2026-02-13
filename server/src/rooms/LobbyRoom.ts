import { Room, Client, matchMaker } from 'colyseus';
import { Schema, type, MapSchema, ArraySchema } from '@colyseus/schema';
import { NUM_TEAMS, PLAYERS_PER_TEAM, TEAM_COLORS } from '../shared/constants';

class LobbyPlayer extends Schema {
  @type('string') sessionId: string = '';
  @type('string') name: string = '';
  @type('number') teamIndex: number = -1;
  @type('boolean') ready: boolean = false;
}

class LobbyState extends Schema {
  @type({ map: LobbyPlayer }) players = new MapSchema<LobbyPlayer>();
  @type('number') numTeams: number = NUM_TEAMS;
  @type('boolean') started: boolean = false;
}

export class LobbyRoom extends Room<LobbyState> {
  maxClients = NUM_TEAMS * PLAYERS_PER_TEAM;

  onCreate() {
    this.setState(new LobbyState());

    this.onMessage('setTeam', (client, teamIndex: number) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      if (teamIndex < 0 || teamIndex >= this.state.numTeams) return;

      // Check if team is full
      let teamCount = 0;
      this.state.players.forEach((p) => {
        if (p.teamIndex === teamIndex) teamCount++;
      });
      if (teamCount >= PLAYERS_PER_TEAM) return;

      player.teamIndex = teamIndex;
      player.ready = false;
    });

    this.onMessage('ready', (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.teamIndex < 0) return;
      player.ready = !player.ready;

      this.checkAllReady();
    });

    this.onMessage('start', (client) => {
      // Only the first player (host) can force-start
      const players = Array.from(this.state.players.values());
      if (players.length === 0) return;
      if (players[0].sessionId !== client.sessionId) return;

      this.startGame();
    });
  }

  onJoin(client: Client) {
    const player = new LobbyPlayer();
    player.sessionId = client.sessionId;
    player.name = `Player ${this.state.players.size + 1}`;
    this.state.players.set(client.sessionId, player);

    // Auto-assign to the team with fewest players
    this.autoAssignTeam(player);
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
  }

  private autoAssignTeam(player: LobbyPlayer) {
    const teamCounts = new Array(this.state.numTeams).fill(0);
    this.state.players.forEach((p) => {
      if (p.teamIndex >= 0) teamCounts[p.teamIndex]++;
    });

    let minTeam = 0;
    for (let i = 1; i < teamCounts.length; i++) {
      if (teamCounts[i] < teamCounts[minTeam]) minTeam = i;
    }
    player.teamIndex = minTeam;
  }

  private checkAllReady() {
    let allReady = true;
    let playerCount = 0;
    this.state.players.forEach((p) => {
      playerCount++;
      if (!p.ready) allReady = false;
    });

    if (allReady && playerCount >= 1) {
      this.startGame();
    }
  }

  private async startGame() {
    this.state.started = true;

    // Build team assignments to send to clients
    const teamAssignments: Record<string, number> = {};
    this.state.players.forEach((p) => {
      teamAssignments[p.sessionId] = p.teamIndex;
    });

    // Create the GameRoom server-side so all clients join the SAME room
    const gameRoom = await matchMaker.createRoom('game', { teamAssignments });

    this.broadcast('gameStart', {
      teamAssignments,
      gameRoomId: gameRoom.roomId,
    });

    // Lock the lobby
    this.lock();
  }
}
