import { Schema, type } from '@colyseus/schema';

export type MinionState = 'spawning' | 'walking' | 'attacking' | 'dead';

export class Minion extends Schema {
  @type('string') id: string = '';
  @type('string') minionType: string = 'melee';
  @type('number') teamIndex: number = -1;
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('number') hp: number = 0;
  @type('number') maxHp: number = 0;
  @type('string') state: MinionState = 'spawning';
  @type('string') targetId: string = ''; // ID of current attack target
  @type('number') attackCooldown: number = 0;
}
