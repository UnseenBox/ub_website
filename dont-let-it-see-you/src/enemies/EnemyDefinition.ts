import type { NoiseKind } from '../core/Events';

export type EnemyKind =
  | 'WATCHER'
  | 'HOUND'
  | 'SLEEPER'
  | 'MIRROR'
  | 'LIAR'
  | 'SCOUT'
  | 'MIMIC'
  | 'ANALYST'
  | 'PARASITE';

/**
 * The tunable half of a creature: what it notices and how hard.
 *
 * Every weight is a contribution to one weighted sum, so a new creature is a new
 * set of numbers rather than new code. There is no "if distance < X" anywhere.
 */
export interface AwarenessProfile {
  /** Inside this radius, proximity alone starts to register. */
  awarenessRadius: number;
  /** Outer limit: beyond this the creature cannot be provoked by attention at all. */
  farRadius: number;
  /** Half-angle of the creature's own gaze cone, radians. */
  gazeAngle: number;
  /** Multiplier applied while attention sits inside that cone. */
  gazeBonus: number;
  /** Multiplier applied while it does not. Low means "it has to be facing you". */
  blindMultiplier: number;

  proximityWeight: number;
  /** How much it cares that the cursor is *aimed* at it. The gaze mechanic. */
  pointWeight: number;
  speedWeight: number;
  dwellWeight: number;
  noiseWeight: number;
  /** Parasite trait: grows agitated when attention pointedly avoids it. */
  neglectWeight: number;

  /** Multiplier on rising awareness. High means twitchy. */
  reactionSpeed: number;
  /** Awareness lost per second with nothing to look at. */
  interestDecay: number;
  /** How long a last-known attention point stays worth walking to. */
  memoryDuration: number;

  calmSpeed: number;
  investigationSpeed: number;
  pursuitSpeed: number;
  /** Head turn rate, radians per second, while calm. Alert states turn faster. */
  turnSpeed: number;

  requiresLineOfSight: boolean;
  /** True for late-game creatures that are not fooled by a fake cursor. */
  seesThroughDecoys: boolean;
  /** Multiplier on how far it hears a noise. */
  hearingScale: number;
  /** Physical size, also the radius inside which the cursor counts as "on" it. */
  bodyRadius: number;

  /** Reads the cursor's recent path rather than only where it is now. */
  readsTrail: boolean;
  trailWindow: number;
}

export interface EnemyDefinition {
  readonly kind: EnemyKind;
  readonly name: string;
  /** One line shown in the discovery book. */
  readonly blurb: string;
  readonly awareness: AwarenessProfile;
  /** Visual height in logical units. */
  readonly height: number;
  /** Starts the room asleep. The Sleeper's whole premise. */
  readonly startsAsleep: boolean;
  /** False for support creatures that raise an alarm instead of killing. */
  readonly canPursue: boolean;
  /** Broadcasts what it finds to other creatures in the room. */
  readonly alertsPeers: boolean;
  /** Its outward tells do not match its real state. */
  readonly deceptive: boolean;
  /** Counts the player's repeated tricks and stops falling for them. */
  readonly learns: boolean;
  /** Emits fake cursors of its own. */
  readonly spawnsDecoys: boolean;
  /** Noise kinds this creature is extra sensitive to. */
  readonly keenOn: readonly NoiseKind[];
}

function profile(over: Partial<AwarenessProfile>): AwarenessProfile {
  return {
    awarenessRadius: 160,
    farRadius: 330,
    gazeAngle: 1.05,
    gazeBonus: 1,
    blindMultiplier: 0.42,
    proximityWeight: 0.7,
    pointWeight: 0.75,
    speedWeight: 0.3,
    dwellWeight: 0.2,
    noiseWeight: 0.5,
    neglectWeight: 0,
    reactionSpeed: 1.4,
    interestDecay: 0.42,
    memoryDuration: 5,
    calmSpeed: 26,
    investigationSpeed: 52,
    pursuitSpeed: 128,
    turnSpeed: 1.5,
    requiresLineOfSight: true,
    seesThroughDecoys: false,
    hearingScale: 1,
    bodyRadius: 15,
    readsTrail: false,
    trailWindow: 2.5,
    ...over,
  };
}

/**
 * THE WATCHER teaches the core rule. It sees bodies in its gaze cone from far
 * away, especially lit or sprinting ones. Sneak behind it or kill the lights.
 */
const WATCHER: EnemyDefinition = {
  kind: 'WATCHER',
  name: 'The Watcher',
  blurb: 'Sees bodies in its gaze. Light and sprinting betray you.',
  awareness: profile({
    awarenessRadius: 200,
    farRadius: 420,
    gazeAngle: 0.85,
    gazeBonus: 1.5,
    blindMultiplier: 0.25,
    proximityWeight: 0.85,
    pointWeight: 1.15,
    speedWeight: 0.55,
    dwellWeight: 0.35,
    noiseWeight: 0.4,
    reactionSpeed: 1.35,
    interestDecay: 0.38,
    memoryDuration: 5.5,
    calmSpeed: 22,
    investigationSpeed: 62,
    pursuitSpeed: 132,
    turnSpeed: 1.5,
  }),
  height: 64,
  startsAsleep: false,
  canPursue: true,
  alertsPeers: true,
  deceptive: false,
  learns: false,
  spawnsDecoys: false,
  keenOn: [],
};

/**
 * THE HOUND does not need to see you. It hears footsteps and chases motion.
 * Sprinting feeds it; sneaking starves it. The cruellest feedback loop remains.
 */
const HOUND: EnemyDefinition = {
  kind: 'HOUND',
  name: 'The Hound',
  blurb: 'Hunts motion and footsteps. Sprint and it will find you.',
  awareness: profile({
    awarenessRadius: 235,
    farRadius: 460,
    gazeAngle: 2.6,
    gazeBonus: 1,
    blindMultiplier: 0.85,
    proximityWeight: 0.55,
    pointWeight: 0.3,
    speedWeight: 1.7,
    dwellWeight: 0.05,
    noiseWeight: 1.1,
    reactionSpeed: 1.65,
    interestDecay: 0.42,
    memoryDuration: 4.5,
    calmSpeed: 36,
    investigationSpeed: 88,
    pursuitSpeed: 168,
    turnSpeed: 3.4,
    requiresLineOfSight: false,
    hearingScale: 1.35,
    bodyRadius: 17,
  }),
  height: 38,
  startsAsleep: false,
  canPursue: true,
  alertsPeers: true,
  deceptive: false,
  learns: false,
  spawnsDecoys: false,
  keenOn: ['glass', 'metal'],
};

/**
 * THE SLEEPER looks harmless. Footsteps wake it, loitering wakes it, light
 * wakes it, and sometimes it was never asleep at all.
 */
const SLEEPER: EnemyDefinition = {
  kind: 'SLEEPER',
  name: 'The Sleeper',
  blurb: 'Footsteps and loitering wake it. Assume nothing about its eyes.',
  awareness: profile({
    awarenessRadius: 170,
    farRadius: 320,
    gazeAngle: 3.14,
    gazeBonus: 1,
    blindMultiplier: 1,
    proximityWeight: 0.55,
    pointWeight: 0.5,
    speedWeight: 0.7,
    dwellWeight: 1.4,
    noiseWeight: 1.7,
    reactionSpeed: 1.7,
    interestDecay: 0.55,
    memoryDuration: 4.5,
    calmSpeed: 0,
    investigationSpeed: 66,
    pursuitSpeed: 148,
    turnSpeed: 2.4,
    requiresLineOfSight: false,
    hearingScale: 1.6,
    bodyRadius: 19,
  }),
  height: 34,
  startsAsleep: true,
  canPursue: true,
  alertsPeers: true,
  deceptive: true,
  learns: false,
  spawnsDecoys: false,
  keenOn: ['tick', 'switch', 'metal', 'glass', 'ring'],
};

/**
 * THE MIRROR never walks. It only turns, and its razor gaze catches any lit
 * body crossing it. Cross behind it, kill the lights, or sneak through shadow.
 */
const MIRROR: EnemyDefinition = {
  kind: 'MIRROR',
  name: 'The Mirror',
  blurb: 'Never moves. Its gaze catches any lit body crossing it.',
  awareness: profile({
    awarenessRadius: 280,
    farRadius: 500,
    gazeAngle: 0.38,
    gazeBonus: 2.8,
    blindMultiplier: 0.04,
    proximityWeight: 0.6,
    pointWeight: 0.9,
    speedWeight: 0.7,
    dwellWeight: 0.4,
    noiseWeight: 0.25,
    reactionSpeed: 1.55,
    interestDecay: 0.5,
    memoryDuration: 3,
    calmSpeed: 0,
    investigationSpeed: 0,
    pursuitSpeed: 0,
    turnSpeed: 0.9,
    bodyRadius: 13,
  }),
  height: 72,
  startsAsleep: false,
  canPursue: false,
  alertsPeers: true,
  deceptive: false,
  learns: false,
  spawnsDecoys: false,
  keenOn: [],
};

/** THE LIAR performs the wrong state on purpose. Watch what it does, not how it looks. */
const LIAR: EnemyDefinition = {
  kind: 'LIAR',
  name: 'The Liar',
  blurb: 'Its posture is a performance. Only its feet tell the truth.',
  awareness: profile({
    awarenessRadius: 200,
    farRadius: 380,
    gazeAngle: 1.1,
    gazeBonus: 1.25,
    blindMultiplier: 0.45,
    proximityWeight: 0.8,
    pointWeight: 0.9,
    speedWeight: 0.6,
    dwellWeight: 0.35,
    noiseWeight: 0.55,
    reactionSpeed: 1.4,
    interestDecay: 0.3,
    memoryDuration: 7,
    calmSpeed: 32,
    investigationSpeed: 64,
    pursuitSpeed: 142,
    turnSpeed: 2,
  }),
  height: 60,
  startsAsleep: false,
  canPursue: true,
  alertsPeers: true,
  deceptive: true,
  learns: false,
  spawnsDecoys: false,
  keenOn: [],
};

/** THE SCOUT cannot hurt you. It spots your body and fetches something that can. */
const SCOUT: EnemyDefinition = {
  kind: 'SCOUT',
  name: 'The Scout',
  blurb: 'Harmless alone. It spots you and screams for the others.',
  awareness: profile({
    awarenessRadius: 250,
    farRadius: 460,
    gazeAngle: 1.4,
    gazeBonus: 1.2,
    blindMultiplier: 0.6,
    proximityWeight: 0.75,
    pointWeight: 0.6,
    speedWeight: 0.8,
    dwellWeight: 0.35,
    noiseWeight: 0.9,
    reactionSpeed: 1.75,
    interestDecay: 0.46,
    memoryDuration: 6,
    calmSpeed: 50,
    investigationSpeed: 102,
    pursuitSpeed: 0,
    turnSpeed: 2.8,
    bodyRadius: 12,
  }),
  height: 44,
  startsAsleep: false,
  canPursue: false,
  alertsPeers: true,
  deceptive: false,
  learns: false,
  spawnsDecoys: false,
  keenOn: ['ring', 'radio', 'alarm'],
};

/** THE MIMIC answers your noise with noise of its own: phantom footsteps that pull you the wrong way. */
const MIMIC: EnemyDefinition = {
  kind: 'MIMIC',
  name: 'The Mimic',
  blurb: 'Fakes footsteps and echoes. Do not follow sounds blindly.',
  awareness: profile({
    awarenessRadius: 210,
    farRadius: 410,
    gazeAngle: 1.2,
    gazeBonus: 1.2,
    blindMultiplier: 0.5,
    proximityWeight: 0.8,
    pointWeight: 0.85,
    speedWeight: 0.6,
    dwellWeight: 0.4,
    noiseWeight: 0.6,
    reactionSpeed: 1.55,
    interestDecay: 0.42,
    memoryDuration: 6,
    calmSpeed: 30,
    investigationSpeed: 70,
    pursuitSpeed: 148,
    turnSpeed: 2.2,
    seesThroughDecoys: true,
  }),
  height: 58,
  startsAsleep: false,
  canPursue: true,
  alertsPeers: true,
  deceptive: true,
  learns: false,
  spawnsDecoys: true,
  keenOn: [],
};

/** THE ANALYST remembers where bodies linger and which tricks you reuse. Vary your route. */
const ANALYST: EnemyDefinition = {
  kind: 'ANALYST',
  name: 'The Analyst',
  blurb: 'Remembers your routes. The second time works worse.',
  awareness: profile({
    awarenessRadius: 220,
    farRadius: 430,
    gazeAngle: 1.1,
    gazeBonus: 1.25,
    blindMultiplier: 0.45,
    proximityWeight: 0.8,
    pointWeight: 0.9,
    speedWeight: 0.6,
    dwellWeight: 0.5,
    noiseWeight: 0.6,
    reactionSpeed: 1.5,
    interestDecay: 0.26,
    memoryDuration: 9,
    calmSpeed: 32,
    investigationSpeed: 76,
    pursuitSpeed: 152,
    turnSpeed: 2.2,
    seesThroughDecoys: false,
    readsTrail: true,
    trailWindow: 3.2,
  }),
  height: 66,
  startsAsleep: false,
  canPursue: true,
  alertsPeers: true,
  deceptive: false,
  learns: true,
  spawnsDecoys: false,
  keenOn: [],
};

/** THE PARASITE starves in the light and gorges in the dark. It hunts bodies hiding in shadow; the beam soothes it, darkness provokes it. */
const PARASITE: EnemyDefinition = {
  kind: 'PARASITE',
  name: 'The Parasite',
  blurb: 'Hunts the dark. Hiding in shadow provokes it; light soothes it.',
  awareness: profile({
    awarenessRadius: 230,
    farRadius: 410,
    gazeAngle: 2.2,
    gazeBonus: 1,
    blindMultiplier: 0.9,
    proximityWeight: 0.5,
    pointWeight: -0.6,
    speedWeight: 0.4,
    dwellWeight: 0.2,
    noiseWeight: 0.35,
    neglectWeight: 1.1,
    reactionSpeed: 1.35,
    interestDecay: 0.34,
    memoryDuration: 5,
    calmSpeed: 26,
    investigationSpeed: 66,
    pursuitSpeed: 142,
    turnSpeed: 1.8,
    requiresLineOfSight: false,
  }),
  height: 52,
  startsAsleep: false,
  canPursue: true,
  alertsPeers: false,
  deceptive: false,
  learns: false,
  spawnsDecoys: false,
  keenOn: [],
};

export const ENEMY_DEFS: Readonly<Record<EnemyKind, EnemyDefinition>> = {
  WATCHER,
  HOUND,
  SLEEPER,
  MIRROR,
  LIAR,
  SCOUT,
  MIMIC,
  ANALYST,
  PARASITE,
};

export const ENEMY_ORDER: readonly EnemyKind[] = [
  'WATCHER',
  'HOUND',
  'SLEEPER',
  'MIRROR',
  'SCOUT',
  'LIAR',
  'MIMIC',
  'ANALYST',
  'PARASITE',
];
