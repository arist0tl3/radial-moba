import { GameState } from '../state/GameState';

/**
 * Returns the winning team index, or null if the game is still going.
 *
 * Win conditions:
 * 1. Central objective destroyed → team with most damage wins
 * 2. Last team standing → that team wins
 * 3. Tiebreaker: if simultaneous base destruction, highest objective damage wins
 */
export function checkWinConditions(state: GameState): number | null {
  // Win condition 1: central objective destroyed
  if (state.objective.hp <= 0) {
    return teamWithMostObjectiveDamage(state);
  }

  // Win condition 2: last team standing
  const survivingTeams: number[] = [];
  for (let i = 0; i < state.teams.length; i++) {
    const team = state.teams[i];
    if (team && !team.eliminated) {
      survivingTeams.push(i);
    }
  }

  if (survivingTeams.length === 1) {
    return survivingTeams[0];
  }

  if (survivingTeams.length === 0) {
    // Edge case: all teams eliminated simultaneously — fallback to damage
    return teamWithMostObjectiveDamage(state);
  }

  return null; // Game continues
}

function teamWithMostObjectiveDamage(state: GameState): number {
  let bestTeam = 0;
  let bestDamage = 0;

  state.objective.damageByTeam.forEach((dmg, teamIndexStr) => {
    if (dmg > bestDamage) {
      bestDamage = dmg;
      bestTeam = parseInt(teamIndexStr, 10);
    }
  });

  return bestTeam;
}
