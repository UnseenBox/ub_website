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
 * THE WATCHER teaches the core rule. It barely hears you and it is slow to come
 * looking, but it is viciously sensitive to a cursor pointed its way.
 */
const WATCHER: EnemyDefinition = {
  kind: 'WATCHER',
  name: 'The Watcher',
  blurb: 'Hates being pointed at. Barely notices sound.',
  awareness: profile({
    awarenessRadius: 168,
    farRadius: 360,
    gazeAngle: 1.0,
    gazeBonus: 1.15,
    blindMultiplier: 0.38,
    proximityWeight: 0.75,
    pointWeight: 1.05,
    speedWeight: 0.16,
    dwellWeight: 0.3,
    noiseWeight: 0.4,
    reactionSpeed: 1.3,
    interestDecay: 0.38,
    memoryDuration: 5.5,
    calmSpeed: 22,
    investigationSpeed: 58,
    pursuitSpeed: 122,
    turnSpeed: 1.3,
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
 * THE HOUND does not care where you point. It cares how fast you moved. Panic
 * feeds it, which is the cruellest feedback loop in the game.
 */
const HOUND: EnemyDefinition = {
  kind: 'HOUND',
  name: 'The Hound',
  blurb: 'Reads panic. Fast cursors wake it, slow ones slide past.',
  awareness: profile({
    awarenessRadius: 215,
    farRadius: 420,
    gazeAngle: 2.6,
    gazeBonus: 1,
    blindMultiplier: 0.85,
    proximityWeight: 0.45,
    pointWeight: 0.12,
    speedWeight: 1.6,
    dwellWeight: 0.04,
    noiseWeight: 0.6,
    reactionSpeed: 1.6,
    interestDecay: 0.42,
    memoryDuration: 4,
    calmSpeed: 34,
    investigationSpeed: 82,
    pursuitSpeed: 158,
    turnSpeed: 3.2,
    requiresLineOfSight: false,
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
 * THE SLEEPER looks harmless. Clicks wake it, loitering wakes it, and sometimes
 * it was never asleep at all.
 */
const SLEEPER: EnemyDefinition = {
  kind: 'SLEEPER',
  name: 'The Sleeper',
  blurb: 'Sound and loitering wake it. Assume nothing about its eyes.',
  awareness: profile({
    awarenessRadius: 150,
    farRadius: 290,
    gazeAngle: 3.14,
    gazeBonus: 1,
    blindMultiplier: 1,
    proximityWeight: 0.3,
    pointWeight: 0.2,
    speedWeight: 0.1,
    dwellWeight: 1.3,
    noiseWeight: 1.6,
    reactionSpeed: 1.7,
    interestDecay: 0.55,
    memoryDuration: 4.5,
    calmSpeed: 0,
    investigationSpeed: 62,
    pursuitSpeed: 142,
    turnSpeed: 2.2,
    requiresLineOfSight: false,
    hearingScale: 1.5,
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
 * THE MIRROR never walks. It only turns, and it turns toward attention. Harmless
 * until it is facing you, lethal the moment it is.
 */
const MIRROR: EnemyDefinition = {
  kind: 'MIRROR',
  name: 'The Mirror',
  blurb: 'Never moves. Always turning toward whatever moved last.',
  awareness: profile({
    awarenessRadius: 260,
    farRadius: 470,
    gazeAngle: 0.42,
    gazeBonus: 2.6,
    blindMultiplier: 0.05,
    proximityWeight: 0.55,
    pointWeight: 0.5,
    speedWeight: 0.55,
    dwellWeight: 0.3,
    noiseWeight: 0.2,
    reactionSpeed: 1.5,
    interestDecay: 0.5,
    memoryDuration: 3,
    calmSpeed: 0,
    investigationSpeed: 0,
    pursuitSpeed: 0,
    turnSpeed: 0.85,
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
    awarenessRadius: 180,
    farRadius: 350,
    gazeAngle: 1.2,
    gazeBonus: 1.1,
    blindMultiplier: 0.55,
    proximityWeight: 0.7,
    pointWeight: 0.78,
    speedWeight: 0.4,
    dwellWeight: 0.3,
    noiseWeight: 0.5,
    reactionSpeed: 1.35,
    interestDecay: 0.3,
    memoryDuration: 7,
    calmSpeed: 30,
    investigationSpeed: 58,
    pursuitSpeed: 134,
    turnSpeed: 1.8,
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

/** THE SCOUT cannot hurt you. It fetches something that can. */
const SCOUT: EnemyDefinition = {
  kind: 'SCOUT',
  name: 'The Scout',
  blurb: 'Harmless alone. It does not catch you, it tells.',
  awareness: profile({
    awarenessRadius: 230,
    farRadius: 430,
    gazeAngle: 1.5,
    gazeBonus: 1.1,
    blindMultiplier: 0.7,
    proximityWeight: 0.65,
    pointWeight: 0.45,
    speedWeight: 0.6,
    dwellWeight: 0.3,
    noiseWeight: 0.85,
    reactionSpeed: 1.7,
    interestDecay: 0.46,
    memoryDuration: 6,
    calmSpeed: 46,
    investigationSpeed: 96,
    pursuitSpeed: 0,
    turnSpeed: 2.6,
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

/** THE MIMIC answers your fake cursors with fake cursors of its own. */
const MIMIC: EnemyDefinition = {
  kind: 'MIMIC',
  name: 'The Mimic',
  blurb: 'Makes cursors. One of the ones you can see is not yours.',
  awareness: profile({
    awarenessRadius: 190,
    farRadius: 380,
    gazeAngle: 1.3,
    gazeBonus: 1.1,
    blindMultiplier: 0.6,
    proximityWeight: 0.7,
    pointWeight: 0.7,
    speedWeight: 0.45,
    dwellWeight: 0.35,
    noiseWeight: 0.5,
    reactionSpeed: 1.5,
    interestDecay: 0.42,
    memoryDuration: 6,
    calmSpeed: 28,
    investigationSpeed: 64,
    pursuitSpeed: 140,
    turnSpeed: 2,
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

/** THE ANALYST keeps score of your habits and stops falling for them. */
const ANALYST: EnemyDefinition = {
  kind: 'ANALYST',
  name: 'The Analyst',
  blurb: 'Counts your tricks. The second time works less well than the first.',
  awareness: profile({
    awarenessRadius: 200,
    farRadius: 400,
    gazeAngle: 1.15,
    gazeBonus: 1.15,
    blindMultiplier: 0.5,
    proximityWeight: 0.7,
    pointWeight: 0.8,
    speedWeight: 0.45,
    dwellWeight: 0.4,
    noiseWeight: 0.55,
    reactionSpeed: 1.45,
    interestDecay: 0.26,
    memoryDuration: 9,
    calmSpeed: 30,
    investigationSpeed: 70,
    pursuitSpeed: 146,
    turnSpeed: 2,
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

/** THE PARASITE wants your attention. Withholding it is the provocation. */
const PARASITE: EnemyDefinition = {
  kind: 'PARASITE',
  name: 'The Parasite',
  blurb: 'Wants to be looked at. Ignoring it is the mistake.',
  awareness: profile({
    awarenessRadius: 210,
    farRadius: 380,
    gazeAngle: 2.2,
    gazeBonus: 1,
    blindMultiplier: 0.9,
    proximityWeight: 0.12,
    pointWeight: -0.55,
    speedWeight: 0.2,
    dwellWeight: 0,
    noiseWeight: 0.3,
    neglectWeight: 1.0,
    reactionSpeed: 1.3,
    interestDecay: 0.34,
    memoryDuration: 5,
    calmSpeed: 24,
    investigationSpeed: 60,
    pursuitSpeed: 136,
    turnSpeed: 1.6,
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
