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

  // Leveling
  @type('number') level: number = 1;
  @type('number') xp: number = 0;
  @type('number') xpToNextLevel: number = 100;
  @type('number') bonusDamage: number = 0;
  @type('number') bonusMaxHp: number = 0;
  @type('number') bonusSpeed: number = 0;
  @type('number') bonusRegen: number = 0;
  @type('number') bonusDefense: number = 0;

  // Server-only (not synced to client) — bot decision cooldown timer
  botDecisionTimer: number = 0;
  // Server-only — level-up state
  pendingLevelUp: boolean = false;
  pendingLevelUpNotified: boolean = false;
  pendingChoices: [string, string] = ['', ''];
}
