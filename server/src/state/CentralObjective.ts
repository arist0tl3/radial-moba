import { Schema, type, MapSchema } from '@colyseus/schema';

export class CentralObjective extends Schema {
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('number') hp: number = 0;
  @type('number') maxHp: number = 0;
  @type({ map: 'number' }) damageByTeam = new MapSchema<number>();
}
