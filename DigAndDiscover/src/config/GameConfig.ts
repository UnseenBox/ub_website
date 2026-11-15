/**
 * Central tuning values. Every gameplay number lives here so balancing
 * never requires hunting through scene code.
 *
 * Per-layer hardness / discovery odds live in data/layers.ts and the starter
 * shovel's stats live in data/tools.ts - both are data, not code.
 */
export const GAME_CONFIG = {
  stamina: {
    /** The protagonist is an ordinary man: small tank, slow recovery. */
    max: 100,
    /** Base cost of one swing. Layers multiply it (see LayerDef.staminaMult). */
    digCost: 7,
    regenPerSecond: 7,
    /** Regeneration starts after the player stops digging for this long. */
    regenDelayMs: 800,
  },
  clock: {
    startHour: 7,
    endHour: 17,
    /**
     * Real seconds per in-game hour. A working day lasts
     * (endHour - startHour) * secondsPerHour real seconds. Short on purpose so
     * the prototype is easy to test. Override with ?secondsPerHour=3 in the URL.
     */
    secondsPerHour: 24,
    /** Clock display granularity in in-game minutes. */
    displayStepMinutes: 5,
  },
  day: {
    /**
     * At closing time no new digging starts and every rock still in the bag has
     * to be cut and sold. Once the bag is empty, the summary opens after this pause.
     */
    closingMinMs: 1300,
    /** Safety net: once the bag is empty, the summary opens after this long even if an animation hangs. */
    closingMaxMs: 12000,
    /** At closing time the player is walked to the workshop this long after "Time's up!" shows. */
    closingTripDelayMs: 1000,
  },
  dig: {
    /** A tap on dirt that is not diggable snaps to diggable ground within this reach (field units). */
    aimAssist: 80,
    /** Extra reach (field units) around an embedded rock that still counts as a direct hit. */
    nearHitPadding: 110,
    /** Embedded rocks that may be waiting to be freed at the same time. */
    maxEmbeddedRocks: 2,
    pebbleChance: 0.3,
    /** Rocks stay at the bottom of the shaft until freed; how far above the floor their centre sits. */
    rockSinkFactor: 0.35,
  },
  inventory: {
    slots: 5,
    rocksToUnlockWorkshop: 3,
  },
  /** The excavation site: a side-view cross-section dug from the top down. */
  world: {
    /** Width of the diggable cross-section in field units. */
    width: 1200,
    /** Field y of the grass line. Leaves room above for grass blades. */
    surfaceY: 40,
    /** Solid bedrock below the last layer that can't be dug (for now). */
    bedrockHeight: 280,
    /** How many field units make one metre on the depth gauge. */
    unitsPerMeter: 80,
    /** Width of one heightmap column. */
    columnWidth: 10,
    /** The camera tries to keep the digging point this far down the view (0..1). */
    cameraFocus: 0.46,
    /** The grass line sits this far down the view at the very start (0..1). */
    startSurfaceFraction: 0.4,
    /** Comfortable view height in field units; the scale is derived from it. */
    viewHeight: 540,
    minVisibleWidth: 480,
    maxScale: 1.5,
  },
  rock: {
    /** Radius of a size-1.0 rock in field units. */
    baseRadius: 58,
    minSize: 0.82,
    maxSize: 1.22,
    /** How much larger rocks are drawn on the workshop bench. */
    workshopScale: 1.6,
  },
  cutting: {
    cutDurationMs: 1000,
  },
  economy: {
    startingMoney: 0,
  },
} as const;
