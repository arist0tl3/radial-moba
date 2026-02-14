import { Schema, type } from '@colyseus/schema';

export class Base extends Schema {
  @type('number') teamIndex: number = -1;
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('number') hp: number = 0;
  @type('number') maxHp: number = 0;
  @type('boolean') destroyed: boolean = false;
  @type('number') capturedByTeam: number = -1;
  @type('number') attackCooldown: number = 0;
}
