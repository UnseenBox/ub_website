import type { ArenaDef, GoalDef, LevelDefinition, WallDef } from '../../src/levels/LevelDefinition';
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

/**
 * A wall of defenders between the ball and the goal, square to the line of the kick: `men` of them,
 * `distance` units in front of the ball, each a little wider than a man with a gap a ball cannot use.
 */
function wallOf(ball: { x: number; y: number }, goal: GoalDef, distance: number, men: number): WallDef[] {
  const dx = goal.x - ball.x;
  const dy = goal.lineY - ball.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const cx = ball.x + ux * distance;
  const cy = ball.y + uy * distance;
  // Along the wall, at right angles to the kick.
  const angle = Math.atan2(uy, ux) + Math.PI / 2;
  const sx = Math.cos(angle);
  const sy = Math.sin(angle);
  const step = 62;
  const out: WallDef[] = [];
  for (let i = 0; i < men; i++) {
    const k = (i - (men - 1) / 2) * step;
    out.push({ x: Math.round(cx + sx * k), y: Math.round(cy + sy * k), w: 52, h: 34, angle, kind: 'defender' });
  }
  return out;
}

/** The free kick: outside the box and off to one side, as a free kick is. */
const FREE_KICK = { x: 960, y: 720 };

export const LEVELS: readonly LevelDefinition[] = [
  {
    id: 'match-01',
    name: 'OPENING NIGHT',
    hint: 'Beat the wall: bend it round, or lift it over.',
    arena: ARENA,
    ballStart: FREE_KICK,
    goal: GOAL,
    boundary: rect(ARENA, GOAL, 54),
    surface: 'turf',
    theme: 'stadium',
    dressing: [],
    walls: wallOf(FREE_KICK, GOAL, 260, 3),
    mechanics: [],
    stars: [2500, 4400],
  },
];
