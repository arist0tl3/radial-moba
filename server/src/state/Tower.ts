import { Schema, type } from '@colyseus/schema';

export class Tower extends Schema {
  @type('string') id: string = '';
  @type('number') teamIndex: number = -1;
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('number') hp: number = 0;
  @type('number') maxHp: number = 0;
  @type('boolean') destroyed: boolean = false;
  @type('number') attackCooldown: number = 0;
  @type('number') laneTeamIndex: number = -1; // Which team's lane this tower sits in
}
