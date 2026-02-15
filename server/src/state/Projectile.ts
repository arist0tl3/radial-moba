import { Schema, type } from '@colyseus/schema';

export class Projectile extends Schema {
  @type('string') id: string = '';
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('number') fromX: number = 0;
  @type('number') fromY: number = 0;
  @type('string') targetId: string = '';
  @type('number') damage: number = 0;
  @type('number') speed: number = 0;
  @type('number') sourceTeamIndex: number = -1;
}
