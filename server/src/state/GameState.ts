import { Schema, type, MapSchema, ArraySchema } from '@colyseus/schema';
import { Player } from './Player';
import { Minion } from './Minion';
import { Team } from './Team';
import { Base } from './Base';
import { CentralObjective } from './CentralObjective';

export type GamePhase = 'waiting' | 'playing' | 'finished';

export class GameState extends Schema {
  @type('string') phase: GamePhase = 'waiting';
  @type('string') winnerTeam: string = ''; // team index as string, or '' if no winner
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Minion }) minions = new MapSchema<Minion>();
  @type([Team]) teams = new ArraySchema<Team>();
  @type({ map: Base }) bases = new MapSchema<Base>();
  @type(CentralObjective) objective = new CentralObjective();
  @type('number') tick: number = 0;
}
