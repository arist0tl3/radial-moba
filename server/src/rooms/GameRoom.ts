import { Room, Client } from 'colyseus';
import { GameState } from '../state/GameState';
import { Player } from '../state/Player';
import { Team } from '../state/Team';
import { Base } from '../state/Base';
import { CentralObjective } from '../state/CentralObjective';
import { updateMovement } from '../systems/MovementSystem';
import { updateCombat, checkTeamElimination } from '../systems/CombatSystem';
import { updateMinionAI, spawnMinionWave } from '../systems/MinionAI';
import { updateCollisions } from '../systems/CollisionSystem';
import { checkWinConditions } from '../systems/WinCondition';
import {
  TICK_INTERVAL,
  NUM_TEAMS,
  TEAM_COLORS,
  PLAYER_HP,
  MAP_RADIUS,
  OBJECTIVE_HP,
  BASE_HP,
} from '../shared/constants';

interface MoveInput {
  type: 'move';
  x: number;
  y: number;
}

interface AbilityInput {
  type: 'ability';
  targetX: number;
  targetY: number;
}

interface AttackInput {
  type: 'attack';
  targetId: string;
}

interface StopInput {
  type: 'stop';
}

type PlayerInput = MoveInput | AbilityInput | AttackInput | StopInput;

export class GameRoom extends Room<GameState> {
  private gameLoopInterval: ReturnType<typeof setInterval> | null = null;
  private minionSpawnTimer: number = 0;
  private inputQueue: Map<string, PlayerInput[]> = new Map();
  private expectedPlayers: number = 0;
  private teamAssignments: Record<string, number> = {};

  onCreate(options: { teamAssignments?: Record<string, number> }) {
    this.setState(new GameState());
    this.initializeMap();

    // Store team assignments from the lobby so we know who to expect
    if (options.teamAssignments) {
      this.teamAssignments = options.teamAssignments;
      this.expectedPlayers = Object.keys(options.teamAssignments).length;
    }

    this.onMessage('input', (client, input: PlayerInput) => {
      if (this.state.phase !== 'playing') return;
      const queue = this.inputQueue.get(client.sessionId) ?? [];
      queue.push(input);
      this.inputQueue.set(client.sessionId, queue);
    });
  }

  onJoin(client: Client, options: { teamIndex?: number }) {
    const teamIndex = options.teamIndex ?? this.assignTeam();
    const player = new Player();
    player.id = client.sessionId;
    player.sessionId = client.sessionId;
    player.teamIndex = teamIndex;
    player.hp = PLAYER_HP;
    player.maxHp = PLAYER_HP;

    // Spawn at team's base position
    const spawn = this.getTeamSpawnPosition(teamIndex);
    player.x = spawn.x;
    player.y = spawn.y;
    player.targetX = spawn.x;
    player.targetY = spawn.y;
    player.alive = true;

    this.state.players.set(client.sessionId, player);

    // Add to team roster
    const team = this.state.teams[teamIndex];
    if (team) {
      team.playerIds.push(client.sessionId);
    }

    this.inputQueue.set(client.sessionId, []);

    // Auto-start when all expected players have joined
    if (this.expectedPlayers > 0 && this.state.players.size >= this.expectedPlayers) {
      this.startGame();
    }
  }

  async onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId);

    // If the player intentionally left, don't wait for reconnection
    if (consented || this.state.phase === 'finished') {
      if (player) player.alive = false;
      this.inputQueue.delete(client.sessionId);
      return;
    }

    // Allow 30 seconds for reconnection (tab refresh, brief network drop)
    try {
      if (player) player.alive = false;

      const reconnection = this.allowReconnection(client, 30);
      const reconnectedClient = await reconnection;

      // Player reconnected — restore them
      if (player) {
        player.alive = true;
        // If they died while disconnected and respawned, they'll be at base
        // If not, they resume where they were
        this.inputQueue.set(reconnectedClient.sessionId, []);
      }
    } catch {
      // Reconnection timed out — player is gone for good
      this.inputQueue.delete(client.sessionId);
    }
  }

  private initializeMap() {
    // Create teams
    for (let i = 0; i < NUM_TEAMS; i++) {
      const team = new Team();
      team.index = i;
      team.color = TEAM_COLORS[i];
      this.state.teams.push(team);
    }

    // Create bases at the outer ring, evenly spaced around the circle
    for (let i = 0; i < NUM_TEAMS; i++) {
      const angle = (i / NUM_TEAMS) * Math.PI * 2 - Math.PI / 2; // start from top
      const base = new Base();
      base.teamIndex = i;
      base.x = MAP_RADIUS + Math.cos(angle) * (MAP_RADIUS * 0.85);
      base.y = MAP_RADIUS + Math.sin(angle) * (MAP_RADIUS * 0.85);
      base.hp = BASE_HP;
      base.maxHp = BASE_HP;
      this.state.bases.set(String(i), base);
    }

    // Create central objective
    this.state.objective.x = MAP_RADIUS;
    this.state.objective.y = MAP_RADIUS;
    this.state.objective.hp = OBJECTIVE_HP;
    this.state.objective.maxHp = OBJECTIVE_HP;

    // Initialize damage tracking per team
    for (let i = 0; i < NUM_TEAMS; i++) {
      this.state.objective.damageByTeam.set(String(i), 0);
    }
  }

  private getTeamSpawnPosition(teamIndex: number): { x: number; y: number } {
    const angle = (teamIndex / NUM_TEAMS) * Math.PI * 2 - Math.PI / 2;
    const spawnRadius = MAP_RADIUS * 0.75;
    return {
      x: MAP_RADIUS + Math.cos(angle) * spawnRadius,
      y: MAP_RADIUS + Math.sin(angle) * spawnRadius,
    };
  }

  private assignTeam(): number {
    // Assign to the team with the fewest players
    const counts = new Array(NUM_TEAMS).fill(0);
    this.state.players.forEach((p) => {
      if (p.teamIndex >= 0) counts[p.teamIndex]++;
    });
    let min = 0;
    for (let i = 1; i < counts.length; i++) {
      if (counts[i] < counts[min]) min = i;
    }
    return min;
  }

  private startGame() {
    this.state.phase = 'playing';

    this.gameLoopInterval = setInterval(() => {
      this.gameTick();
    }, TICK_INTERVAL);
  }

  private gameTick() {
    if (this.state.phase !== 'playing') return;

    const dt = TICK_INTERVAL / 1000; // delta time in seconds

    // 1. Process inputs
    this.processInputs();

    // 2. Update movement
    updateMovement(this.state, dt);

    // 3. Update minion AI
    updateMinionAI(this.state, dt);

    // 4. Resolve collisions
    updateCollisions(this.state);

    // 5. Resolve combat
    updateCombat(this.state, dt);

    // 6. Check team elimination (base destroyed + all players dead)
    checkTeamElimination(this.state);

    // 7. Spawn minions on timer
    this.minionSpawnTimer += TICK_INTERVAL;
    if (this.minionSpawnTimer >= 30000) { // every 30 seconds
      spawnMinionWave(this.state);
      this.minionSpawnTimer = 0;
    }

    // 8. Check win conditions
    const winner = checkWinConditions(this.state);
    if (winner !== null) {
      this.state.phase = 'finished';
      this.state.winnerTeam = String(winner);

      // Collect per-team damage stats for the victory screen
      const damageByTeam: Record<string, number> = {};
      this.state.objective.damageByTeam.forEach((dmg, teamIdx) => {
        damageByTeam[teamIdx] = dmg;
      });

      this.broadcast('gameOver', { winnerTeam: winner, damageByTeam });
      if (this.gameLoopInterval) {
        clearInterval(this.gameLoopInterval);
        this.gameLoopInterval = null;
      }
    }

    this.state.tick++;
  }

  private processInputs() {
    this.inputQueue.forEach((inputs, sessionId) => {
      const player = this.state.players.get(sessionId);
      if (!player || !player.alive) return;

      for (const input of inputs) {
        switch (input.type) {
          case 'move':
            player.targetX = input.x;
            player.targetY = input.y;
            player.attackTargetId = ''; // Cancel attack target on ground click
            break;
          case 'attack':
            player.attackTargetId = input.targetId;
            // Stop current move — movement will be driven by following the target
            player.targetX = player.x;
            player.targetY = player.y;
            break;
          case 'ability':
            // TODO: Phase 5 — ability system
            break;
          case 'stop':
            player.targetX = player.x;
            player.targetY = player.y;
            player.attackTargetId = '';
            break;
        }
      }
    });

    // Clear all input queues
    this.inputQueue.forEach((_, key) => {
      this.inputQueue.set(key, []);
    });
  }

  onDispose() {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
    }
  }
}
