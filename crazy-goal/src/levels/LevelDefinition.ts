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
export type WallKind = 'wall' | 'crate' | 'car' | 'shutter' | 'hedge' | 'defender' | 'adboard';

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
  /**
   * The points are the whole wall, post to post: the engine does not close them against the top corners
   * of the arena, and a vertex where the wall only bends a little (a rounded corner) gets no pillar cap.
   */
  explicit?: boolean;
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

/**
 * A lesson: the level teaches one move and says so. While the lesson runs (until its first goal) only
 * the controls it names are shown, the ghost hand and a dotted path show the shot, and the coach card
 * at the top of the screen shows the move as a picture.
 */
export interface GuideDef {
  move: 'straight' | 'bend' | 'air' | 'bank' | 'free' | 'coin' | 'fire' | 'magnet' | 'rubber';
  /** Lessons in one series share the progress pips on the coach card; the first five (the tutorial) have none. */
  series?: string;
  /** An ability lesson: this boost is already on the ball (for free) and a ghost shows what it does. */
  boost?: 'fire' | 'magnet' | 'rubber';
  /** Which free-kick controls the lesson shows. */
  controls: { air: boolean; bend: boolean };
  /** The shot the ghost shows: angle in degrees (-90 is straight up), pull power 0 to 1, and how it is struck. */
  show: { angle: number; power: number; air: boolean; bend: number };
}

export type Theme = 'street' | 'pitch' | 'stadium' | 'beach' | 'court' | 'clay' | 'roof' | 'snow' | 'sunset' | 'night';

/**
 * Everything that makes one challenge. Levels are plain data: gameplay code never names a
 * level, so adding one is a matter of writing another of these in data/levels.
 */
export interface LevelDefinition {
  id: string;
  name: string;
  /** The group of matches it is listed under in the stadium list. */
  world?: string;
  /** One short line under the name. */
  hint: string;
  arena: ArenaDef;
  ballStart: Point;
  goal: GoalDef;
  walls: readonly WallDef[];
  mechanics: readonly MechanicDef[];
  /** The stadium's mood: its colours, the time of day and the weather. Only the look changes. */
  theme?: Theme;
  /**
   * The shape of the playable ground. When it is left out the level gets the old rectangular
   * rails, which is what the duel streets use.
   */
  boundary?: BoundaryDef;
  /** Set on the tutorial levels. */
  guide?: GuideDef;
  /** Where the level's coin hangs. When left out it is strung along the ball-to-goal line (see coinPlacement). */
  coin?: Point;
  /** Crazy Score needed for the second and third star. Any goal earns the first. */
  stars: readonly [number, number];
}
