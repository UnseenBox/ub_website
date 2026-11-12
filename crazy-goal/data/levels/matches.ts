import type { ArenaDef, GoalDef, LevelDefinition } from '../../src/levels/LevelDefinition';
import { rect } from './shapes';

/**
 * The matches of CRAZY KORA: one stadium after another, each built and polished on its own.
 *
 * One gameplay style. The first match is a plain stadium with a goal. Every match after it adds
 * something: objects, areas, obstacles, and the moves (air, bend) the player can use against them.
 * The old hundred houmas and the Free Kicks mode are kept in git (tag `kora-houmas-and-freekicks-v1`).
 *
 * Coordinates: x runs 450 to 1150, y runs 170 (the goal line) to 1110 (behind the ball).
 */

const ARENA: ArenaDef = { x: 450, y: 170, w: 700, h: 940 };
const GOAL: GoalDef = { x: 800, lineY: 170, width: 220, depth: 64 };

export const LEVELS: readonly LevelDefinition[] = [
  {
    id: 'match-01',
    name: 'OPENING NIGHT',
    hint: 'Drag back, let go. Then try it off the boards.',
    arena: ARENA,
    ballStart: { x: 800, y: 1000 },
    goal: GOAL,
    boundary: rect(ARENA, GOAL, 54),
    surface: 'turf',
    theme: 'stadium',
    dressing: [],
    walls: [],
    mechanics: [],
    stars: [1400, 2600],
  },
];
