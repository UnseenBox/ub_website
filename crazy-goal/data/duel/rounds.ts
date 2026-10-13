import type { MechanicDef, Theme, WallDef } from '../../src/levels/LevelDefinition';

/**
 * One duel round: a street with everything already standing in it. Both players take their
 * one shot at the same street, so a round is always fair.
 *
 * Coordinates are the same strip as the solo alleys: x runs 450 to 1150, y runs 170 (the goal
 * line) to 1110 (the kerb). The ball starts near the bottom, at `ballX`.
 */
export interface DuelTemplate {
  id: string;
  name: string;
  /** One line under the name on the street plaque. */
  hint: string;
  /** Where the ball starts across the street; the middle (800) when left out. */
  ballX?: number;
  /** Centre of the goal mouth; the middle (800) when left out. */
  goalX?: number;
  /** Ground and sky for the street; the home paving when left out. */
  theme?: Theme;
  walls: readonly WallDef[];
  mechanics: readonly MechanicDef[];
}

/** A duel plays ten of these, shuffled by the duel's seed. */
export const DUEL_TEMPLATES: readonly DuelTemplate[] = [
  {
    id: 'open',
    name: 'OPEN STREET',
    hint: 'Mimi reads a straight shot. Go round her.',
    walls: [],
    mechanics: [
      { type: 'cat', speed: 130 },
      { type: 'tyre', x: 560, y: 500 },
    ],
  },
  {
    id: 'tyres',
    name: 'TYRE YARD',
    hint: 'The wall is in the way. The tyres are not.',
    walls: [{ x: 800, y: 560, w: 300, h: 38 }],
    mechanics: [
      { type: 'tyre', x: 540, y: 400 },
      { type: 'tyre', x: 1060, y: 400 },
      { type: 'tyre', x: 610, y: 780 },
    ],
  },
  {
    id: 'taxi',
    name: 'TAXI RANK',
    hint: 'Mind the taxi. Or use it.',
    walls: [{ x: 770, y: 580, w: 300, h: 132, angle: -0.28, kind: 'car' }],
    mechanics: [{ type: 'sand', x: 1010, y: 860, w: 200, h: 150 }],
  },
  {
    id: 'glazier',
    name: 'THE GLAZIER',
    hint: 'Glass stops a soft shot. Hit it hard.',
    goalX: 650,
    walls: [
      { x: 535, y: 480, w: 170, h: 38 },
      { x: 1065, y: 480, w: 170, h: 38 },
    ],
    mechanics: [{ type: 'glass', x: 800, y: 480, w: 360 }],
  },
  {
    id: 'back',
    name: 'BACK HOUMA',
    hint: 'Two walls, one way through. Find the bank.',
    walls: [
      { x: 600, y: 700, w: 300, h: 38 },
      { x: 1000, y: 430, w: 300, h: 38 },
    ],
    mechanics: [],
  },
  {
    id: 'hill',
    name: 'DOWNHILL',
    hint: 'The street leans. Aim uphill of the goal.',
    goalX: 660,
    walls: [{ x: 1010, y: 340, w: 150, h: 60, kind: 'crate' }],
    mechanics: [{ type: 'slope', x: 800, y: 640, w: 700, h: 440, angle: 0, strength: 950 }],
  },
  {
    id: 'drain',
    name: 'THE DRAIN',
    hint: 'The street is shut. The sewer is not.',
    walls: [{ x: 800, y: 540, w: 700, h: 40 }],
    mechanics: [{ type: 'pipe', x: 980, y: 820, outX: 620, outY: 380 }],
  },
  {
    id: 'delivery',
    name: 'DELIVERY',
    hint: 'He will not stop for you. Time it.',
    walls: [
      { x: 540, y: 400, w: 180, h: 38 },
      { x: 1060, y: 400, w: 180, h: 38 },
      { x: 800, y: 820, w: 150, h: 56, kind: 'crate' },
    ],
    mechanics: [{ type: 'scooter', x1: 540, y1: 620, x2: 1060, y2: 620, speed: 300 }],
  },
  {
    id: 'bell',
    name: 'DING DONG',
    hint: 'Ring the bell on the way. The shutter opens.',
    ballX: 700,
    walls: [
      { x: 555, y: 300, w: 210, h: 36 },
      { x: 1045, y: 300, w: 210, h: 36 },
    ],
    mechanics: [
      { type: 'bell', x: 800, y: 430, gate: { x: 800, y: 300, w: 280, h: 30 } },
      { type: 'tyre', x: 540, y: 520 },
      { type: 'tyre', x: 1060, y: 520 },
    ],
  },
  {
    id: 'market',
    name: 'FRUIT MARKET',
    hint: 'Crates kill the bounce. Walls keep it.',
    walls: [
      { x: 640, y: 760, w: 220, h: 60, kind: 'crate' },
      { x: 980, y: 600, w: 220, h: 60, kind: 'crate' },
      { x: 720, y: 420, w: 160, h: 56, kind: 'crate' },
    ],
    mechanics: [],
  },
  {
    id: 'pinball',
    name: 'PINBALL',
    hint: 'Five tyres. Nobody knows where it ends up.',
    walls: [{ x: 800, y: 330, w: 170, h: 34 }],
    mechanics: [
      { type: 'tyre', x: 800, y: 640 },
      { type: 'tyre', x: 620, y: 480 },
      { type: 'tyre', x: 980, y: 480 },
      { type: 'tyre', x: 540, y: 800 },
      { type: 'tyre', x: 1060, y: 800 },
    ],
  },
  {
    id: 'rush',
    name: 'RUSH HOUR',
    hint: 'A taxi, a scooter and two tyres. Pick your moment.',
    walls: [{ x: 790, y: 760, w: 240, h: 116, angle: -0.2, kind: 'car' }],
    mechanics: [
      { type: 'scooter', x1: 540, y1: 500, x2: 1060, y2: 500, speed: 280 },
      { type: 'tyre', x: 1060, y: 420 },
      { type: 'tyre', x: 540, y: 420 },
    ],
  },
  {
    id: 'funnel',
    name: 'THE FUNNEL',
    hint: 'One gap, dead centre, and a crate in front of it.',
    ballX: 620,
    walls: [
      { x: 560, y: 430, w: 240, h: 36, angle: 0.55 },
      { x: 1040, y: 430, w: 240, h: 36, angle: -0.55 },
      { x: 800, y: 700, w: 150, h: 56, kind: 'crate' },
    ],
    mechanics: [],
  },
  {
    id: 'site',
    name: 'BUILDING SITE',
    hint: 'Sand eats the shot. Go round, or go hard.',
    walls: [{ x: 800, y: 370, w: 180, h: 56, kind: 'crate' }],
    mechanics: [
      { type: 'sand', x: 800, y: 620, w: 460, h: 220 },
      { type: 'tyre', x: 520, y: 330 },
      { type: 'tyre', x: 1080, y: 330 },
    ],
  },
  {
    id: 'neon',
    name: 'NEON NIGHT',
    hint: 'Red bumpers under the lights. Split them.',
    theme: 'night',
    walls: [],
    mechanics: [
      { type: 'bumper', x: 660, y: 720 },
      { type: 'bumper', x: 940, y: 720 },
      { type: 'bumper', x: 800, y: 480 },
    ],
  },
  {
    id: 'turbo',
    name: 'TURBO CHARGE',
    hint: 'The arrows fly. Point them at the goal.',
    walls: [{ x: 700, y: 560, w: 340, h: 38 }],
    mechanics: [{ type: 'boost', x: 1060, y: 720, w: 110, h: 340, angle: -Math.PI / 2 }],
  },
  {
    id: 'turnstile',
    name: 'TURNSTILE',
    hint: 'The bar never stops. Time your shot.',
    walls: [
      { x: 545, y: 620, w: 190, h: 36 },
      { x: 1055, y: 620, w: 190, h: 36 },
    ],
    mechanics: [{ type: 'spinner', x: 800, y: 620, w: 240, speed: 1.2 }],
  },
  {
    id: 'crosswind',
    name: 'CROSSWIND',
    hint: 'The wind pushes east. Aim west.',
    goalX: 700,
    walls: [],
    mechanics: [{ type: 'fan', x: 800, y: 660, w: 400, h: 260, angle: 0, strength: 1300 }],
  },
  {
    id: 'hedges',
    name: 'HEDGE MAZE',
    hint: 'Soft hedges, hard choices. Zigzag.',
    walls: [
      { x: 620, y: 780, w: 240, h: 52, kind: 'hedge' },
      { x: 980, y: 600, w: 240, h: 52, kind: 'hedge' },
    ],
    mechanics: [{ type: 'tyre', x: 800, y: 420 }],
  },
  {
    id: 'frost',
    name: 'FROST',
    hint: 'Ice all the way up. Start it early.',
    theme: 'snow',
    walls: [{ x: 800, y: 400, w: 260, h: 38 }],
    mechanics: [{ type: 'ice', x: 800, y: 660, w: 620, h: 420 }],
  },
];
