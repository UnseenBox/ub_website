import type { ArenaDef, BoundaryDef, BoundaryKind, GoalDef, Point } from '../../src/levels/LevelDefinition';

/**
 * The shapes of the street.
 *
 * Every builder returns the outline of the playable ground. The outline starts at the left
 * goal post, runs down the left wall, across the bottom, up the right wall, and ends at the
 * right goal post. The engine closes it against the top corners of the arena, so the goal
 * mouth is the only opening in the whole street.
 *
 * The point of this file is that no two levels should look like the same rectangle. Each
 * builder is a different piece of architecture: a dog-leg alley, a courtyard with a throat,
 * a stepped terrace, a harbour quay, a pinball hall shaped like a plus sign.
 */

type Pt = Point;

interface Frame {
  /** Left wall of the arena. */
  A: number;
  /** Right wall of the arena. */
  R: number;
  /** Top of the arena: the goal line. */
  T: number;
  /** Bottom of the arena: the kerb behind you. */
  B: number;
  /** Centre of the goal. */
  C: number;
  /** Half the mouth. */
  H: number;
}

const frame = (arena: ArenaDef, goal: GoalDef): Frame => ({
  A: arena.x,
  R: arena.x + arena.w,
  T: arena.y,
  B: arena.y + arena.h,
  C: goal.x,
  H: goal.width / 2,
});

/**
 * Joins the outline points to the kinds of the edges between them. The two closures at the
 * top corners stay plain walls; the very bottom of the street gets a low kerb, because a
 * kerb never hides the ball.
 */
const finish = (f: Frame, pts: Pt[], edgeKinds: readonly (BoundaryKind | undefined)[] = []): BoundaryDef => {
  const kinds: BoundaryKind[] = new Array(pts.length + 1).fill('wall');
  for (let i = 0; i < edgeKinds.length; i++) {
    const k = edgeKinds[i];
    if (k) kinds[i + 1] = k;
  }
  for (let i = 0; i < pts.length - 1; i++) {
    if (pts[i].y >= f.B - 3 && pts[i + 1].y >= f.B - 3) kinds[i + 1] = 'kerb';
  }
  return { points: pts, kinds };
};

/**
 * Joins the two walls and the bottom into one outline.
 * `left` runs from the top of the left wall down to the bottom; `right` runs from the bottom
 * of the right wall up to the top; `bottom` is any extra points along the bottom edge.
 */
const outline = (f: Frame, left: readonly Pt[], bottom: readonly Pt[], right: readonly Pt[]): Pt[] => [
  { x: f.C - f.H, y: f.T },
  ...left,
  ...bottom,
  ...right,
  { x: f.C + f.H, y: f.T },
];

/**
 * The untouched side of a bay shape. `left` runs from the goal line down to the kerb;
 * `right` runs from the kerb back up to the goal line, so the two orders are not the same.
 */
const flatLeft = (x: number, f: Frame): Pt[] => [
  { x, y: f.T + 90 },
  { x, y: f.B },
];
const flatRight = (x: number, f: Frame): Pt[] => [
  { x, y: f.B },
  { x, y: f.T + 90 },
];

/* ------------------------------------------------------------------ *
 *  The shapes
 * ------------------------------------------------------------------ */

/** A plain street with chamfered top corners. The oldest shape in the houma. */
export const rect = (arena: ArenaDef, goal: GoalDef, cut = 54): BoundaryDef => {
  const f = frame(arena, goal);
  return finish(
    f,
    outline(
      f,
      [
        { x: f.A, y: f.T + cut },
        { x: f.A, y: f.B },
      ],
      [],
      [
        { x: f.R, y: f.B },
        { x: f.R, y: f.T + cut },
      ],
    ),
  );
};

/**
 * A stadium pitch: a rectangle with rounded corners, the goal set in the middle of the top end. Four short
 * walls make each corner a smooth curve, so the ball rolls round it instead of dying in a square pocket.
 * It is the whole wall, post to post, with a low kerb along the near end.
 */
export const roundedRect = (arena: ArenaDef, goal: GoalDef, radius = 70, steps = 8): BoundaryDef => {
  const f = frame(arena, goal);
  const pts: Pt[] = [{ x: f.C - f.H, y: f.T }];
  // One corner: a quarter turn round (cx, cy), starting at angle `from` and running anticlockwise on the screen.
  const corner = (cx: number, cy: number, from: number): void => {
    for (let k = 0; k <= steps; k++) {
      const a = from - (k / steps) * (Math.PI / 2);
      pts.push({ x: Math.round(cx + Math.cos(a) * radius), y: Math.round(cy + Math.sin(a) * radius) });
    }
  };
  corner(f.A + radius, f.T + radius, Math.PI * 1.5); // top left: from the goal line round to the left wall
  corner(f.A + radius, f.B - radius, Math.PI); // bottom left
  corner(f.R - radius, f.B - radius, Math.PI / 2); // bottom right
  corner(f.R - radius, f.T + radius, 0); // top right: round to the goal line
  pts.push({ x: f.C + f.H, y: f.T });
  // The near end is a low kerb, so it never hides the ball; the rest is the boards.
  const kinds: BoundaryKind[] = [];
  for (let i = 0; i < pts.length - 1; i++) kinds.push(pts[i].y >= f.B - radius * 0.55 && pts[i + 1].y >= f.B - radius * 0.55 ? 'kerb' : 'wall');
  return { points: pts, kinds, explicit: true };
};

/** Every corner cut away: an octagonal courtyard. */
export const atrium = (arena: ArenaDef, goal: GoalDef, cut = 120): BoundaryDef => {
  const f = frame(arena, goal);
  return finish(
    f,
    outline(
      f,
      [
        { x: f.A + cut, y: f.T },
        { x: f.A, y: f.T + cut },
        { x: f.A, y: f.B - cut },
        { x: f.A + cut, y: f.B },
      ],
      [],
      [
        { x: f.R - cut, y: f.B },
        { x: f.R, y: f.B - cut },
        { x: f.R, y: f.T + cut },
        { x: f.R - cut, y: f.T },
      ],
    ),
  );
};

/** The alley bends: one side steps in and back out. */
export const dogleg = (arena: ArenaDef, goal: GoalDef, step = 170, side = 1): BoundaryDef => {
  const f = frame(arena, goal);
  const x = side < 0 ? f.A : f.R;
  const xi = side < 0 ? f.A + step : f.R - step;
  const other = side < 0 ? f.R : f.A;
  const stepped: Pt[] = [
    { x, y: f.T + 80 },
    { x: xi, y: f.T + 300 },
    { x: xi, y: f.B - 330 },
    { x, y: f.B - 180 },
    { x, y: f.B },
  ];
  const flat: Pt[] = side < 0 ? flatRight(other, f) : flatLeft(other, f);
  return finish(f, side < 0 ? outline(f, stepped, [], flat) : outline(f, flat, [], stepped.reverse()));
};

/** Bays cut alternately into each side: the workshop street. */
export const zigzag = (arena: ArenaDef, goal: GoalDef, depth = 150): BoundaryDef => {
  const f = frame(arena, goal);
  const q = (f.B - f.T) / 4;
  const left: Pt[] = [
    { x: f.A, y: f.T + 70 },
    { x: f.A + depth, y: f.T + q * 0.8 },
    { x: f.A, y: f.T + q * 1.6 },
    { x: f.A + depth, y: f.T + q * 2.4 },
    { x: f.A, y: f.T + q * 3.2 },
    { x: f.A, y: f.B },
  ];
  const right: Pt[] = [
    { x: f.R, y: f.B },
    { x: f.R, y: f.T + q * 3.2 },
    { x: f.R - depth, y: f.T + q * 2.4 },
    { x: f.R, y: f.T + q * 1.6 },
    { x: f.R - depth, y: f.T + q * 0.8 },
    { x: f.R, y: f.T + 70 },
  ];
  return finish(f, outline(f, left, [], right));
};

/** A wide courtyard with a narrow throat at the bottom and a tight mouth at the top. */
export const courtyard = (arena: ArenaDef, goal: GoalDef, throat = 250): BoundaryDef => {
  const f = frame(arena, goal);
  const left: Pt[] = [
    { x: f.C - throat / 2, y: f.T + 140 },
    { x: f.A, y: f.T + 340 },
    { x: f.A, y: f.B - 240 },
    { x: f.C - throat / 2, y: f.B },
  ];
  const right: Pt[] = [
    { x: f.C + throat / 2, y: f.B },
    { x: f.R, y: f.B - 240 },
    { x: f.R, y: f.T + 340 },
    { x: f.C + throat / 2, y: f.T + 140 },
  ];
  return finish(f, outline(f, left, [], right));
};

/** Wide at the bottom, tight at the top: the ball has to find the small mouth. */
export const fan = (arena: ArenaDef, goal: GoalDef, neck = 300): BoundaryDef => {
  const f = frame(arena, goal);
  const left: Pt[] = [
    { x: f.C - neck / 2, y: f.T + 230 },
    { x: f.A, y: f.B - 300 },
    { x: f.A, y: f.B },
  ];
  const right: Pt[] = [
    { x: f.R, y: f.B },
    { x: f.R, y: f.B - 300 },
    { x: f.C + neck / 2, y: f.T + 230 },
  ];
  return finish(f, outline(f, left, [], right));
};

/** Narrow at the bottom, wide at the top: the street opens out as you climb. */
export const tapers = (arena: ArenaDef, goal: GoalDef, neck = 320): BoundaryDef => {
  const f = frame(arena, goal);
  const left: Pt[] = [
    { x: f.A, y: f.T + 270 },
    { x: f.C - neck / 2, y: f.B },
  ];
  const right: Pt[] = [
    { x: f.C + neck / 2, y: f.B },
    { x: f.R, y: f.T + 270 },
  ];
  return finish(f, outline(f, left, [], right));
};

/** A deep bay cut into one side: somewhere for the ball to hide. */
export const alcove = (arena: ArenaDef, goal: GoalDef, side = 1, depth = 190, size = 260): BoundaryDef => {
  const f = frame(arena, goal);
  const x = side < 0 ? f.A : f.R;
  const xi = side < 0 ? f.A + depth : f.R - depth;
  const other = side < 0 ? f.R : f.A;
  const mid = f.T + (f.B - f.T) * 0.58;
  const jutting: Pt[] = [
    { x, y: f.T + 90 },
    { x, y: mid - size / 2 },
    { x: xi, y: mid - size / 2 },
    { x: xi, y: mid + size / 2 },
    { x, y: mid + size / 2 },
    { x, y: f.B },
  ];
  const flat: Pt[] = side < 0 ? flatRight(other, f) : flatLeft(other, f);
  return finish(f, side < 0 ? outline(f, jutting, [], flat) : outline(f, flat, [], jutting.reverse()));
};

/** A shallow bump of building jutting into the street. */
export const bulge = (arena: ArenaDef, goal: GoalDef, side = 1, depth = 150, size = 300): BoundaryDef => {
  const f = frame(arena, goal);
  const x = side < 0 ? f.A : f.R;
  const xi = side < 0 ? f.A + depth : f.R - depth;
  const other = side < 0 ? f.R : f.A;
  const mid = f.T + (f.B - f.T) * 0.46;
  const jutting: Pt[] = [
    { x, y: f.T + 90 },
    { x, y: mid - size },
    { x: xi, y: mid - size / 2 },
    { x: xi, y: mid + size / 2 },
    { x, y: mid + size },
    { x, y: f.B },
  ];
  const flat: Pt[] = side < 0 ? flatRight(other, f) : flatLeft(other, f);
  return finish(f, side < 0 ? outline(f, jutting, [], flat) : outline(f, flat, [], jutting.reverse()));
};

/** A hillside terrace: the sides step down in treads. */
export const terrace = (arena: ArenaDef, goal: GoalDef, steps = 4): BoundaryDef => {
  const f = frame(arena, goal);
  const span = (f.B - f.T - 200) / steps;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < steps; i++) {
    const y = f.T + 110 + span * i;
    const ins = i % 2 === 0 ? 120 : 0;
    left.push({ x: f.A + ins, y });
    left.push({ x: f.A + ins, y: y + span });
  }
  left.push({ x: f.A, y: f.B });
  right.push({ x: f.R, y: f.B });
  for (let i = steps - 1; i >= 0; i--) {
    const y = f.T + 110 + span * i;
    const ins = i % 2 === 0 ? 120 : 0;
    right.push({ x: f.R - ins, y: y + span });
    right.push({ x: f.R - ins, y });
  }
  return finish(f, outline(f, left, [], right));
};

/** A quay: the bottom of the street is cut away at an angle. */
export const harbour = (arena: ArenaDef, goal: GoalDef, slant = 260): BoundaryDef => {
  const f = frame(arena, goal);
  const left: Pt[] = [
    { x: f.A, y: f.T + 80 },
    { x: f.A, y: f.B - 250 },
  ];
  const bottom: Pt[] = [
    { x: f.A + slant, y: f.B },
    { x: f.R - slant, y: f.B },
  ];
  const right: Pt[] = [
    { x: f.R, y: f.B - 250 },
    { x: f.R, y: f.T + 80 },
  ];
  return finish(f, outline(f, left, bottom, right));
};

/** An hourglass: the middle is pinched and everything has to be threaded. */
export const pinch = (arena: ArenaDef, goal: GoalDef, waist = 280): BoundaryDef => {
  const f = frame(arena, goal);
  const mid = f.T + (f.B - f.T) * 0.5;
  const left: Pt[] = [
    { x: f.A, y: f.T + 120 },
    { x: f.C - waist / 2, y: mid },
    { x: f.A, y: f.B },
  ];
  const right: Pt[] = [
    { x: f.R, y: f.B },
    { x: f.C + waist / 2, y: mid },
    { x: f.R, y: f.T + 120 },
  ];
  return finish(f, outline(f, left, [], right));
};

/** Three bays cut into one side, like a row of workshop doors. */
export const comb = (arena: ArenaDef, goal: GoalDef, side = 1, depth = 170, bays = 3): BoundaryDef => {
  const f = frame(arena, goal);
  const x = side < 0 ? f.A : f.R;
  const xi = side < 0 ? f.A + depth : f.R - depth;
  const other = side < 0 ? f.R : f.A;
  const top = f.T + 130;
  const usable = f.B - top - 130;
  const bay = usable / (bays * 2 - 1);
  const jutting: Pt[] = [{ x, y: top }];
  for (let i = 0; i < bays; i++) {
    const y0 = top + bay * i * 2;
    jutting.push({ x, y: y0 });
    jutting.push({ x: xi, y: y0 });
    jutting.push({ x: xi, y: y0 + bay });
    jutting.push({ x, y: y0 + bay });
  }
  jutting.push({ x, y: f.B });
  const flat: Pt[] =
    side < 0
      ? [
          { x: other, y: f.B },
          { x: other, y: top },
        ]
      : [
          { x: other, y: top },
          { x: other, y: f.B },
        ];
  return finish(f, side < 0 ? outline(f, jutting, [], flat) : outline(f, flat, [], jutting.reverse()));
};

/** A plus sign: four arms around a central square. */
export const cross = (arena: ArenaDef, goal: GoalDef, arm = 210): BoundaryDef => {
  const f = frame(arena, goal);
  const mid = f.T + (f.B - f.T) * 0.5;
  const l = f.C - arm;
  const r = f.C + arm;
  const left: Pt[] = [
    { x: l, y: f.T + 140 },
    { x: l, y: mid - arm },
    { x: f.A, y: mid - arm },
    { x: f.A, y: mid + arm },
    { x: l, y: mid + arm },
    { x: l, y: f.B },
  ];
  const right: Pt[] = [
    { x: r, y: f.B },
    { x: r, y: mid + arm },
    { x: f.R, y: mid + arm },
    { x: f.R, y: mid - arm },
    { x: r, y: mid - arm },
    { x: r, y: f.T + 140 },
  ];
  return finish(f, outline(f, left, [], right));
};

/** One side flat, the other broken into notches. */
export const asym = (arena: ArenaDef, goal: GoalDef, side = 1, depth = 140): BoundaryDef => {
  const f = frame(arena, goal);
  const x = side < 0 ? f.A : f.R;
  const xi = side < 0 ? f.A + depth : f.R - depth;
  const other = side < 0 ? f.R : f.A;
  const q = (f.B - f.T) / 4;
  const jutting: Pt[] = [
    { x, y: f.T + 90 },
    { x: xi, y: f.T + q * 0.8 },
    { x, y: f.T + q * 1.6 },
    { x: xi, y: f.T + q * 2.4 },
    { x, y: f.T + q * 3.2 },
    { x, y: f.B },
  ];
  const flat: Pt[] = side < 0 ? flatRight(other, f) : flatLeft(other, f);
  return finish(f, side < 0 ? outline(f, jutting, [], flat) : outline(f, flat, [], jutting.reverse()));
};

/** An L: a block of buildings eats one of the bottom corners of the street. */
export const hook = (arena: ArenaDef, goal: GoalDef, side = 1, cut = 240): BoundaryDef => {
  const f = frame(arena, goal);
  const left: Pt[] =
    side < 0
      ? [
          { x: f.A, y: f.T + 90 },
          { x: f.A, y: f.B - 200 },
          { x: f.A + cut, y: f.B - 200 },
          { x: f.A + cut, y: f.B },
        ]
      : [
          { x: f.A, y: f.T + 90 },
          { x: f.A, y: f.B },
        ];
  const bottom: Pt[] = side < 0 ? [{ x: f.R, y: f.B }] : [{ x: f.R - cut, y: f.B }];
  const right: Pt[] =
    side < 0
      ? [
          { x: f.R, y: f.B },
          { x: f.R, y: f.T + 90 },
        ]
      : [
          { x: f.R - cut, y: f.B - 200 },
          { x: f.R, y: f.B - 200 },
          { x: f.R, y: f.T + 90 },
        ];
  return finish(f, outline(f, left, bottom, right));
};

/** A V: the street narrows towards the bottom. */
export const wedge = (arena: ArenaDef, goal: GoalDef, neck = 260): BoundaryDef => {
  const f = frame(arena, goal);
  const left: Pt[] = [
    { x: f.A, y: f.T + 120 },
    { x: f.C - neck / 2, y: f.B },
  ];
  const right: Pt[] = [
    { x: f.C + neck / 2, y: f.B },
    { x: f.R, y: f.T + 120 },
  ];
  return finish(f, outline(f, left, [], right));
};

/** A staircase of treads on both sides. */
export const stair = (arena: ArenaDef, goal: GoalDef, steps = 4, rise = 130): BoundaryDef => {
  const f = frame(arena, goal);
  const span = (f.B - f.T - 220) / steps;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < steps; i++) {
    const y = f.T + 130 + span * i;
    const ins = i % 2 === 0 ? rise : 0;
    left.push({ x: f.A + ins, y });
    left.push({ x: f.A + ins, y: y + span });
  }
  left.push({ x: f.A, y: f.B });
  right.push({ x: f.R, y: f.B });
  for (let i = steps - 1; i >= 0; i--) {
    const y = f.T + 130 + span * i;
    const ins = i % 2 === 0 ? rise : 0;
    right.push({ x: f.R - ins, y: y + span });
    right.push({ x: f.R - ins, y });
  }
  return finish(f, outline(f, left, [], right));
};

/** A wide square with a deep bay on each side. */
export const plaza = (arena: ArenaDef, goal: GoalDef, depth = 190, size = 300): BoundaryDef => {
  const f = frame(arena, goal);
  const mid = f.T + (f.B - f.T) * 0.52;
  const left: Pt[] = [
    { x: f.A, y: f.T + 80 },
    { x: f.A, y: mid - size / 2 },
    { x: f.A + depth, y: mid - size / 2 },
    { x: f.A + depth, y: mid + size / 2 },
    { x: f.A, y: mid + size / 2 },
    { x: f.A, y: f.B },
  ];
  const right: Pt[] = [
    { x: f.R, y: f.B },
    { x: f.R, y: mid + size / 2 },
    { x: f.R - depth, y: mid + size / 2 },
    { x: f.R - depth, y: mid - size / 2 },
    { x: f.R, y: mid - size / 2 },
    { x: f.R, y: f.T + 80 },
  ];
  return finish(f, outline(f, left, [], right));
};

/** A narrow alley between thick blocks: the classic houma lane. */
export const lane = (arena: ArenaDef, goal: GoalDef, width = 300): BoundaryDef => {
  const f = frame(arena, goal);
  const left: Pt[] = [
    { x: f.C - width / 2, y: f.T + 70 },
    { x: f.C - width / 2, y: f.B },
  ];
  const right: Pt[] = [
    { x: f.C + width / 2, y: f.B },
    { x: f.C + width / 2, y: f.T + 70 },
  ];
  return finish(f, outline(f, left, [], right));
};

/** A quay with two pontoons jutting up into the street. */
export const docks = (arena: ArenaDef, goal: GoalDef, reach = 130, height = 150): BoundaryDef => {
  const f = frame(arena, goal);
  const left: Pt[] = [
    { x: f.A, y: f.T + 90 },
    { x: f.A, y: f.B },
  ];
  const bottom: Pt[] = [
    { x: f.A + 140, y: f.B },
    { x: f.A + 140, y: f.B - height },
    { x: f.A + 140 + reach, y: f.B - height },
    { x: f.A + 140 + reach, y: f.B },
    { x: f.R - 140 - reach, y: f.B },
    { x: f.R - 140 - reach, y: f.B - height },
    { x: f.R - 140, y: f.B - height },
    { x: f.R - 140, y: f.B },
  ];
  const right: Pt[] = [
    { x: f.R, y: f.B },
    { x: f.R, y: f.T + 90 },
  ];
  return finish(f, outline(f, left, bottom, right));
};

/** Two deep bays cut into the same side, far apart. */
export const twin = (arena: ArenaDef, goal: GoalDef, side = 1, depth = 170, size = 220): BoundaryDef => {
  const f = frame(arena, goal);
  const x = side < 0 ? f.A : f.R;
  const xi = side < 0 ? f.A + depth : f.R - depth;
  const other = side < 0 ? f.R : f.A;
  const y1 = f.T + (f.B - f.T) * 0.3;
  const y2 = f.T + (f.B - f.T) * 0.72;
  const jutting: Pt[] = [
    { x, y: f.T + 90 },
    { x, y: y1 - size / 2 },
    { x: xi, y: y1 - size / 2 },
    { x: xi, y: y1 + size / 2 },
    { x, y: y1 + size / 2 },
    { x, y: y2 - size / 2 },
    { x: xi, y: y2 - size / 2 },
    { x: xi, y: y2 + size / 2 },
    { x, y: y2 + size / 2 },
    { x, y: f.B },
  ];
  const flat: Pt[] = side < 0 ? flatRight(other, f) : flatLeft(other, f);
  return finish(f, side < 0 ? outline(f, jutting, [], flat) : outline(f, flat, [], jutting.reverse()));
};

/** A courtyard whose bottom end is cut off by a diagonal, like a ramp down to the street. */
export const ramp = (arena: ArenaDef, goal: GoalDef, skew = 300): BoundaryDef => {
  const f = frame(arena, goal);
  const left: Pt[] = [
    { x: f.A, y: f.T + 90 },
    { x: f.A, y: f.B - skew },
  ];
  const bottom: Pt[] = [
    { x: f.A + skew, y: f.B },
    { x: f.R, y: f.B },
  ];
  const right: Pt[] = [
    { x: f.R, y: f.B },
    { x: f.R, y: f.T + 90 },
  ];
  return finish(f, outline(f, left, bottom, right));
};
