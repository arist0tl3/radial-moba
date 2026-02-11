import { Schema, type, ArraySchema } from '@colyseus/schema';

export class Team extends Schema {
  @type('number') index: number = -1;
  @type('number') color: number = 0;
  @type('boolean') eliminated: boolean = false;
  @type(['string']) playerIds = new ArraySchema<string>();
}
