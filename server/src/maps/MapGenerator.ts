import { MAP_RADIUS, NUM_TEAMS } from '../shared/constants';

/**
 * Hardcoded 4-team radial map layout.
 *
 * The map is a circle with radius MAP_RADIUS, centered at (MAP_RADIUS, MAP_RADIUS).
 * Teams are arranged evenly around the circle:
 *   Team 0: Top (12 o'clock)
 *   Team 1: Right (3 o'clock)
 *   Team 2: Bottom (6 o'clock)
 *   Team 3: Left (9 o'clock)
 *
 * Each team has:
 *   - A base at 85% of the radius from center
 *   - A spawn point at 75% of the radius
 *   - A lane running straight from their base to the center
 *
 * For MVP, the map is just open space — no walls or terrain yet.
 * The positions are computed on the server and sent to clients via state.
 */

export interface MapLayout {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  teamAngles: number[];
}

export function getMapLayout(): MapLayout {
  const teamAngles: number[] = [];
  for (let i = 0; i < NUM_TEAMS; i++) {
    teamAngles.push((i / NUM_TEAMS) * Math.PI * 2 - Math.PI / 2);
  }

  return {
    width: MAP_RADIUS * 2,
    height: MAP_RADIUS * 2,
    centerX: MAP_RADIUS,
    centerY: MAP_RADIUS,
    teamAngles,
  };
}
