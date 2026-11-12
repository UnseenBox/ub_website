import type { ArenaDef, GoalDef, GuideDef, LevelDefinition, MechanicDef, WallDef } from '../../src/levels/LevelDefinition';
import { CAMPAIGN } from './campaign';
import { roundedRect } from './shapes';

/**
 * The matches of CRAZY KORA: one stadium after another, each built and polished on its own.
 *
 * One gameplay style. MATCH 1 is the tutorial: five short lessons in one stadium, the ball always at
 * the bottom centre, each lesson teaching one move (straight, bend, air, bank, then all together).
 * MATCH 2 has a single obstacle and a coin: dodge it and grab the coin. MATCH 3 is a pinball table.
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

/** One level in the stadium: the arena, the ball at the bottom centre, and what is in the way. */
function level(id: string, name: string, hint: string, o: { walls?: WallDef[]; mechanics?: MechanicDef[]; coin?: { x: number; y: number }; stars: readonly [number, number]; guide?: GuideDef }): LevelDefinition {
  return {
    id,
    name,
    hint,
    arena: ARENA,
    ballStart: BALL,
    goal: GOAL,
    boundary: roundedRect(ARENA, GOAL),
    surface: 'turf',
    theme: 'stadium',
    dressing: [],
    walls: o.walls ?? [],
    mechanics: o.mechanics ?? [],
    coin: o.coin,
    stars: o.stars,
    guide: o.guide,
  };
}

/** One lesson of the tutorial. */
const lesson = (id: string, name: string, hint: string, walls: WallDef[], stars: readonly [number, number], guide: GuideDef): LevelDefinition => level(id, name, hint, { walls, stars, guide });

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

  // 6-8. The abilities, one lesson each. The ability is already on the ball and a ghost on the pitch plays the
  // same shot twice: without it, then with it. A board across the goal; a shot that would miss wide; a bank with no energy.
  level('ability-fire', 'HARISSA', 'Burn through it.', {
    walls: [{ x: 800, y: 520, w: 320, h: 36, kind: 'adboard' }],
    stars: [1400, 2400],
    guide: { move: 'fire', series: 'abilities', boost: 'fire', controls: { air: false, bend: false }, show: { angle: -90, power: 0.6, air: false, bend: 0 } },
  }),
  level('ability-magnet', 'MAGNET', 'Let the goal pull it in.', {
    stars: [2200, 4500],
    guide: { move: 'magnet', series: 'abilities', boost: 'magnet', controls: { air: false, bend: false }, show: { angle: -74, power: 0.5, air: false, bend: 0 } },
  }),
  level('ability-rubber', 'RUBBER', 'Keep the bounce.', {
    stars: [2200, 4500],
    guide: { move: 'rubber', series: 'abilities', boost: 'rubber', controls: { air: false, bend: false }, show: { angle: -131, power: 0.3, air: false, bend: 0 } },
  }),

  // MATCH 2: one obstacle, one coin. The board covers the right of the goal: go round it, through the coin.
  level('match-02-dodge', 'DODGE IT', 'Go round it. Grab the coin.', {
    walls: [{ x: 880, y: 600, w: 160, h: 36, kind: 'adboard' }],
    coin: { x: 757, y: 520 },
    stars: [1100, 1700],
    guide: { move: 'coin', series: 'dodge', controls: { air: true, bend: true }, show: { angle: -95, power: 0.55, air: false, bend: 0 } },
  }),

  // MATCH 3: a pinball table. Two bumpers, a spinning bar, the coin in the gap between them.
  level('match-03-pinball', 'PINBALL', 'Let the bumpers do the work.', {
    mechanics: [
      { type: 'bumper', x: 680, y: 480 },
      { type: 'bumper', x: 920, y: 480 },
      { type: 'spinner', x: 800, y: 640, w: 200, speed: 1.2 },
    ],
    coin: { x: 800, y: 500 },
    stars: [2500, 6000],
  }),

  ...CAMPAIGN,
];
