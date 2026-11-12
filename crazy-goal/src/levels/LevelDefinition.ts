export interface Point {
  x: number;
  y: number;
}

/** The pitch itself: the rectangle the ball can roll on. House walls are built around it. */
export interface ArenaDef {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GoalDef {
  /** Centre of the mouth. */
  x: number;
  /** The goal line. Goals sit in the top wall, so this equals `arena.y`. */
  lineY: number;
  /** Clear opening between the posts. */
  width: number;
  depth: number;
}

/**
 * wall: low whitewashed wall. crate: orange crates, a dull bounce. car: the parked taxi, a
 * lively one. shutter: a roller shutter pulled across part of a goal (a duel trick).
 */
export type WallKind = 'wall' | 'crate' | 'car' | 'shutter' | 'hedge';

/** A solid block, placed by its centre. */
export interface WallDef {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Radians, clockwise on screen. */
  angle?: number;
  kind?: WallKind;
}

/**
 * What the street is paved with. This only changes how the ground looks: the ball rolls on
 * every one of them the same way, so a surface never lies about the physics.
 */
export type Surface =
  /** Worn tarmac, patched and oil-stained. */
  | 'asphalt'
  /** Poured concrete slabs with hairline cracks. */
  | 'concrete'
  /** The old ochre paving stones of the houma. */
  | 'paving'
  /** Market tiles, terracotta and cream. */
  | 'terracotta'
  /** Dry beach sand with ripples. */
  | 'sand'
  /** Broken cement with weeds pushing through. */
  | 'cracked'
  /** Roof screed with felt patches and a gravel edge. */
  | 'rooftop'
  /** Asphalt with pale concrete repair patches. */
  | 'patches'
  /** Street with a grid of iron manhole covers and drain grates. */
  | 'drains'
  /** Courtyard zellige tile, blue and white. */
  | 'tiles'
  /** Old cobblestones, worn smooth in the middle. */
  | 'cobble'
  /** A frozen street, pale and crazed. */
  | 'ice'
  /** Rain-slick asphalt, dark and reflective. */
  | 'wet'
  /** Mown turf with chalk lines: a stadium pitch. */
  | 'turf';

/**
 * A flat piece of street furniture painted on the ground. None of it is solid and none of it
 * stands in the ball's way: landmarks are for the eye, the puzzle is for the walls.
 */
export type DressingKind =
  /** Blue garage door set into a wall face. */
  | 'garage'
  /** Café frontage with two tables under an awning. */
  | 'cafe'
  /** A painted wall mural. */
  | 'mural'
  /** A little courtyard fountain. */
  | 'fountain'
  /** A stairway up to a doorway. */
  | 'stairs'
  /** A market stall: canopy over a trestle. */
  | 'stall'
  /** A washing line strung between two poles. */
  | 'washline'
  /** An iron manhole cover. */
  | 'manhole'
  /** A shallow puddle with a wet rim. */
  | 'puddle'
  /** Painted parking bays. */
  | 'parking'
  /** A red phone box. */
  | 'phonebox'
  /** A concrete planter with a shrub. */
  | 'planter'
  /** A street name sign on a post. */
  | 'signpost'
  /** A char grill with smoke stains. */
  | 'grill'
  /** An oil drum. */
  | 'barrel';

export interface DressingDef {
  kind: DressingKind;
  x: number;
  y: number;
  /** Radians, clockwise on screen. */
  angle?: number;
  /** Size hint. 1 is normal, 1.5 is large. */
  scale?: number;
}

/**
 * A boundary edge is usually a building wall, but the bottom of the street is a low kerb so
 * it never hides the ball.
 */
export type BoundaryKind = WallKind | 'kerb';

/**
 * The shape of the playable ground.
 *
 * `points` runs from the left goal post, down and around the street, to the right goal post.
 * The engine closes the loop at both ends against the top corners of the arena and leaves the
 * goal mouth as the only opening, so the ball can never leave the street.
 *
 * `kinds` gives the wall kind for each edge of the closed loop. Edge 0 is the closure at the
 * top-left corner and the last edge is the closure at the top-right corner; the edges between
 * are the street itself, in order.
 */
export interface BoundaryDef {
  points: readonly Point[];
  /** One kind per edge of the closed loop. `points.length + 1` entries. */
  kinds?: readonly BoundaryKind[];
  /** Thickness of the wall band. Defaults to the rail thickness. */
  thickness?: number;
}

/** Things in the alley that do more than stand there. Each `type` has one class in
 * src/mechanics and one drawing routine in src/rendering/MechanicArt.ts.
 */
export type MechanicDef =
  /** A stack of tyres: throws the ball back faster than it came. */
  | { type: 'tyre'; x: number; y: number }
  /** An open manhole. The ball drops in and comes out of the other one, same pace, same direction. */
  | { type: 'pipe'; x: number; y: number; outX: number; outY: number }
  /** A pile of builder's sand: the ball ploughs through and loses pace. */
  | { type: 'sand'; x: number; y: number; w: number; h: number }
  /** A stretch of street that runs downhill: the ball is pulled along `angle`. */
  | { type: 'slope'; x: number; y: number; w: number; h: number; angle: number; strength: number }
  /** A scooter riding back and forth between two points. */
  | { type: 'scooter'; x1: number; y1: number; x2: number; y2: number; speed: number }
  /** A pane of glass: a soft shot bounces off, a hard one goes through. */
  | { type: 'glass'; x: number; y: number; w: number; angle?: number }
  /** A doorbell. Hit it and the shutter rolls up for the rest of the shot. */
  | { type: 'bell'; x: number; y: number; gate: { x: number; y: number; w: number; h: number } }
  /** Ground that changes how the ball rolls: long grass and puddles slow it, ice lets it glide. */
  | { type: 'grass' | 'water' | 'ice'; x: number; y: number; w: number; h: number }
  /** A strip of arrows that flings the ball along `angle`. */
  | { type: 'boost'; x: number; y: number; w: number; h: number; angle: number }
  /** Mimi, the neighbourhood cat, guarding the goal. `speed` is how fast she can move. */
  | { type: 'cat'; speed: number }
  /** A round pinball bumper: kicks the ball away hard with a flash and a ring. */
  | { type: 'bumper'; x: number; y: number }
  /** A spinning bar that turns around its centre. `w` is its length, `speed` radians per second. */
  | { type: 'spinner'; x: number; y: number; w?: number; speed?: number }
  /** A fan blowing along `angle`: a gusty wind that pushes the ball while it is inside. */
  | { type: 'fan'; x: number; y: number; w: number; h: number; angle: number; strength?: number };

export type Theme = 'street' | 'pitch' | 'beach' | 'court' | 'clay' | 'roof' | 'snow' | 'sunset' | 'night';

/**
 * Everything that makes one challenge. Levels are plain data: gameplay code never names a
 * level, so adding one is a matter of writing another of these in data/levels.
 */
export interface LevelDefinition {
  id: string;
  name: string;
  /** One short line under the name. */
  hint: string;
  arena: ArenaDef;
  ballStart: Point;
  goal: GoalDef;
  walls: readonly WallDef[];
  mechanics: readonly MechanicDef[];
  /** What the ground is: paving when left out. Only the look changes. */
  theme?: Theme;
  /**
   * The shape of the playable ground. When it is left out the level gets the old rectangular
   * rails, which is what the duel streets use.
   */
  boundary?: BoundaryDef;
  /** What the street is paved with. `paving` when left out. Only the look changes. */
  surface?: Surface;
  /** Flat landmarks painted on the ground. */
  dressing?: readonly DressingDef[];
  /** Crazy Score needed for the second and third star. Any goal earns the first. */
  stars: readonly [number, number];
}
