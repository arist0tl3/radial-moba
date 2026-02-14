import { Schema, type } from '@colyseus/schema';

export class Player extends Schema {
  @type('string') id: string = '';
  @type('string') sessionId: string = '';
  @type('number') teamIndex: number = -1;
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('number') targetX: number = 0;
  @type('number') targetY: number = 0;
  @type('number') hp: number = 0;
  @type('number') maxHp: number = 0;
  @type('number') attackCooldown: number = 0;
  @type('number') abilityCooldown: number = 0;
  @type('boolean') alive: boolean = true;
  @type('number') respawnTimer: number = 0;
  @type('number') deaths: number = 0;
  @type('boolean') isAttacking: boolean = false;
  @type('string') attackTargetId: string = '';
  @type('boolean') isBot: boolean = false;

  // Server-only (not synced to client) — bot decision cooldown timer
  botDecisionTimer: number = 0;
}
