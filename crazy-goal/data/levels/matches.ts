import type { ArenaDef, GoalDef, GuideDef, LevelDefinition, WallDef } from '../../src/levels/LevelDefinition';
import { rect } from './shapes';

/**
 * The matches of CRAZY KORA: one stadium after another, each built and polished on its own.
 *
 * One gameplay style. MATCH 1 is the tutorial: five short lessons in one stadium, the ball always at
 * the bottom centre, each lesson teaching one move (straight, bend, air, bank, then all together).
 * Every match after it adds objects, areas and obstacles. The old hundred houmas and the Free Kicks
 * mode are kept in git (tag `kora-houmas-and-freekicks-v1`).
 *
 * Coordinates: x runs 450 to 1150, y runs 170 (the goal line) to 990 (behind the ball).
 */

const ARENA: ArenaDef = { x: 450, y: 170, w: 700, h: 820 };
const GOAL: GoalDef = { x: 800, lineY: 170, width: 220, depth: 64 };
/** Every lesson starts here: bottom centre, so "straight up" is straight at the goal. */
const BALL = { x: 800, y: 920 };

/** A wall of defenders straight in front of the ball: `men` of them, `distance` units up the pitch. */
function wallOf(distance: number, men: number): WallDef[] {
  const y = BALL.y - distance;
  const step = 62;
  return Array.from({ length: men }, (_, i) => ({ x: Math.round(BALL.x + (i - (men - 1) / 2) * step), y, w: 52, h: 34, angle: 0, kind: 'defender' as const }));
}

/** One lesson of the tutorial. */
function lesson(id: string, name: string, hint: string, walls: WallDef[], stars: readonly [number, number], guide: GuideDef): LevelDefinition {
  return {
    id,
    name,
    hint,
    arena: ARENA,
    ballStart: BALL,
    goal: GOAL,
    boundary: rect(ARENA, GOAL, 54),
    surface: 'turf',
    theme: 'stadium',
    dressing: [],
    walls,
    mechanics: [],
    stars,
    guide,
  };
}

export const LEVELS: readonly LevelDefinition[] = [
  // 1. Pull back, let go. Nothing in the way.
  lesson('match-01-straight', 'KICK OFF', 'Pull back, let go.', [], [1100, 1500], {
    move: 'straight',
    controls: { air: false, bend: false },
    show: { angle: -90, power: 0.5, air: false, bend: 0 },
  }),
  // 2. A wall in the way: curl it round.
  lesson('match-01-bend', 'CURL IT', 'Bend it round the wall.', wallOf(300, 2), [1700, 2600], {
    move: 'bend',
    controls: { air: false, bend: true },
    show: { angle: -123, power: 0.85, air: false, bend: 1 },
  }),
  // 3. A wall in the way: lift it over.
  lesson('match-01-air', 'LOB IT', 'Lift it over the wall.', wallOf(300, 3), [1700, 2500], {
    move: 'air',
    controls: { air: true, bend: false },
    show: { angle: -90, power: 0.26, air: true, bend: 0 },
  }),
  // 4. A block in the way: bank it off a board.
  lesson('match-01-bank', 'BANK IT', 'Off the board and in.', [{ x: 800, y: 540, w: 300, h: 40, kind: 'wall' }], [1490, 3220], {
    move: 'bank',
    controls: { air: false, bend: false },
    show: { angle: -131, power: 0.7, air: false, bend: 0 },
  }),
  // 5. The free kick: any of the moves will do.
  lesson('match-01-free', 'FREE KICK', 'Beat the wall your way.', wallOf(330, 3), [1700, 3000], {
    move: 'free',
    controls: { air: true, bend: true },
    show: { angle: -90, power: 0.26, air: true, bend: 0 },
  }),
];
