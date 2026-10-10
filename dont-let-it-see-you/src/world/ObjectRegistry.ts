import type { NoiseKind } from '../core/Events';

export type ObjectKind =
  | 'LIGHT_SWITCH'
  | 'BREAKER'
  | 'LAMP'
  | 'DOOR'
  | 'EXIT'
  | 'BUTTON'
  | 'METAL_SWITCH'
  | 'KEY'
  | 'DRAWER'
  | 'CABINET'
  | 'PHONE'
  | 'RADIO'
  | 'TELEVISION'
  | 'COMPUTER'
  | 'PROJECTOR'
  | 'MIRROR'
  | 'CLOCK'
  | 'FAN'
  | 'VENT'
  | 'LOCKER'
  | 'TABLE'
  | 'DESK'
  | 'SHELF'
  | 'BOX'
  | 'CHAIR'
  | 'BOTTLE'
  | 'CUP'
  | 'BOOK'
  | 'TOY'
  | 'ALARM';

/** Which draw routine the renderer uses. Separate from kind so props can share art. */
export type ObjectArt =
  | 'switch'
  | 'panel'
  | 'lamp'
  | 'door'
  | 'exit'
  | 'button'
  | 'key'
  | 'drawer'
  | 'phone'
  | 'radio'
  | 'screen'
  | 'projector'
  | 'mirror'
  | 'clock'
  | 'fan'
  | 'vent'
  | 'locker'
  | 'table'
  | 'block'
  | 'chair'
  | 'glass'
  | 'trinket'
  | 'alarm';

export interface LoopNoise {
  /** The state in which the object keeps making sound. */
  state: string;
  level: number;
  /** Seconds between emissions. */
  interval: number;
  kind: NoiseKind;
}

/**
 * Everything the game knows about a kind of prop, as data.
 *
 * Adding a prop means adding a row here plus, if it does something clever, one
 * behaviour function in InteractionSystem. No core file changes.
 */
export interface ObjectDefinition {
  readonly kind: ObjectKind;
  readonly label: string;
  readonly w: number;
  readonly h: number;
  readonly art: ObjectArt;

  readonly solid: boolean;
  /** Blocks line of sight. Tall furniture does; a rug does not. */
  readonly opaque: boolean;

  readonly interactable: boolean;
  readonly requiresProximity: boolean;
  /** Extra reach beyond the player's default, for things you can poke at range. */
  readonly reachBonus: number;
  /** Noise made by using it, in the brief's units: tick 1 ... alarm 25. */
  readonly clickNoise: number;
  readonly noiseKind: NoiseKind;
  /** Seconds the interaction takes. Anything above zero is a window of exposure. */
  readonly interactionTime: number;

  readonly states: readonly string[];
  readonly initialState: string;
  readonly loopNoise?: LoopNoise;

  readonly createsDistraction: boolean;
  readonly createsLight: boolean;
  readonly createsSound: boolean;
  readonly createsReflection: boolean;
  readonly createsDecoy: boolean;

  readonly hideSpot: boolean;
  readonly pickup: boolean;
  readonly isExit: boolean;
  readonly pushable: boolean;
  readonly breakable: boolean;

  /** -1 for unlimited. */
  readonly uses: number;
  readonly cooldown: number;
  /** A prop that is worth points but never required. */
  readonly secret: boolean;
}

function def(over: Partial<ObjectDefinition> & Pick<ObjectDefinition, 'kind' | 'label' | 'art'>): ObjectDefinition {
  return {
    w: 26,
    h: 26,
    solid: false,
    opaque: false,
    interactable: true,
    requiresProximity: true,
    reachBonus: 0,
    clickNoise: 2,
    noiseKind: 'object',
    interactionTime: 0,
    states: ['off', 'on'],
    initialState: 'off',
    createsDistraction: false,
    createsLight: false,
    createsSound: false,
    createsReflection: false,
    createsDecoy: false,
    hideSpot: false,
    pickup: false,
    isExit: false,
    pushable: false,
    breakable: false,
    uses: -1,
    cooldown: 0.35,
    secret: false,
    ...over,
  };
}

const DEFS: ObjectDefinition[] = [
  // --- light -----------------------------------------------------------------
  def({
    kind: 'LIGHT_SWITCH',
    label: 'Light Switch',
    art: 'switch',
    w: 16,
    h: 22,
    clickNoise: 5,
    noiseKind: 'switch',
    createsLight: true,
    initialState: 'on',
    cooldown: 0.5,
  }),
  def({
    kind: 'BREAKER',
    label: 'Breaker Panel',
    art: 'panel',
    w: 28,
    h: 38,
    clickNoise: 8,
    noiseKind: 'metal',
    createsLight: true,
    initialState: 'on',
    interactionTime: 0.7,
    cooldown: 1.2,
  }),
  def({
    kind: 'LAMP',
    label: 'Lamp',
    art: 'lamp',
    w: 20,
    h: 30,
    clickNoise: 2,
    noiseKind: 'switch',
    createsLight: true,
    initialState: 'on',
  }),

  // --- ways through ----------------------------------------------------------
  def({
    kind: 'DOOR',
    label: 'Door',
    art: 'door',
    w: 14,
    h: 62,
    solid: true,
    opaque: true,
    clickNoise: 6,
    noiseKind: 'door',
    states: ['closed', 'open'],
    initialState: 'closed',
    interactionTime: 0.45,
    cooldown: 0.6,
  }),
  def({
    kind: 'EXIT',
    label: 'Way Out',
    art: 'exit',
    w: 22,
    h: 66,
    isExit: true,
    clickNoise: 4,
    noiseKind: 'door',
    states: ['locked', 'open'],
    initialState: 'locked',
    interactionTime: 0.35,
  }),
  def({
    kind: 'VENT',
    label: 'Vent',
    art: 'vent',
    w: 30,
    h: 20,
    clickNoise: 4,
    noiseKind: 'metal',
    states: ['closed', 'open'],
    initialState: 'closed',
    interactionTime: 0.5,
  }),

  // --- controls --------------------------------------------------------------
  def({ kind: 'BUTTON', label: 'Button', art: 'button', w: 16, h: 16, clickNoise: 1 }),
  def({
    kind: 'METAL_SWITCH',
    label: 'Heavy Switch',
    art: 'switch',
    w: 20,
    h: 26,
    clickNoise: 5,
    noiseKind: 'metal',
    interactionTime: 0.4,
    cooldown: 0.8,
  }),
  def({
    kind: 'ALARM',
    label: 'Alarm',
    art: 'alarm',
    w: 22,
    h: 22,
    clickNoise: 25,
    noiseKind: 'alarm',
    createsDistraction: true,
    createsSound: true,
    loopNoise: { state: 'on', level: 20, interval: 0.5, kind: 'alarm' },
    uses: 1,
    cooldown: 2,
  }),

  // --- noisemakers, the real toolbox ---------------------------------------
  def({
    kind: 'PHONE',
    label: 'Phone',
    art: 'phone',
    w: 22,
    h: 16,
    clickNoise: 3,
    noiseKind: 'object',
    states: ['idle', 'ringing'],
    initialState: 'idle',
    createsDistraction: true,
    createsSound: true,
    loopNoise: { state: 'ringing', level: 18, interval: 0.85, kind: 'ring' },
    cooldown: 1.4,
  }),
  def({
    kind: 'RADIO',
    label: 'Radio',
    art: 'radio',
    w: 28,
    h: 20,
    clickNoise: 4,
    noiseKind: 'switch',
    createsDistraction: true,
    createsSound: true,
    loopNoise: { state: 'on', level: 7, interval: 0.7, kind: 'radio' },
    cooldown: 0.7,
  }),
  def({
    kind: 'CLOCK',
    label: 'Clock',
    art: 'clock',
    w: 22,
    h: 22,
    clickNoise: 2,
    createsDistraction: true,
    createsSound: true,
    loopNoise: { state: 'on', level: 3, interval: 1, kind: 'tick' },
    initialState: 'on',
  }),
  def({
    kind: 'FAN',
    label: 'Fan',
    art: 'fan',
    w: 26,
    h: 26,
    clickNoise: 3,
    createsSound: true,
    loopNoise: { state: 'on', level: 2, interval: 1.1, kind: 'radio' },
    initialState: 'off',
  }),
  def({
    kind: 'TELEVISION',
    label: 'Television',
    art: 'screen',
    w: 34,
    h: 26,
    clickNoise: 3,
    createsLight: true,
    createsSound: true,
    createsDistraction: true,
    loopNoise: { state: 'on', level: 5, interval: 0.9, kind: 'radio' },
  }),

  // --- screaming machines (cover noise + false echoes) ---------------------------
  def({
    kind: 'PROJECTOR',
    label: 'Projector',
    art: 'projector',
    w: 28,
    h: 20,
    clickNoise: 3,
    createsDecoy: true,
    createsLight: true,
    interactionTime: 0.5,
    cooldown: 2.5,
    uses: 3,
  }),
  def({
    kind: 'COMPUTER',
    label: 'Terminal',
    art: 'screen',
    w: 28,
    h: 24,
    clickNoise: 2,
    createsLight: true,
    createsDecoy: true,
    cooldown: 2,
    uses: 3,
  }),
  def({
    kind: 'MIRROR',
    label: 'Mirror',
    art: 'mirror',
    w: 14,
    h: 44,
    clickNoise: 2,
    createsReflection: true,
    createsDecoy: true,
    cooldown: 2,
    uses: 2,
  }),

  // --- containers and carryables --------------------------------------------
  def({
    kind: 'KEY',
    label: 'Key',
    art: 'key',
    w: 16,
    h: 12,
    clickNoise: 1,
    pickup: true,
    states: ['here', 'taken'],
    initialState: 'here',
  }),
  def({
    kind: 'DRAWER',
    label: 'Drawer',
    art: 'drawer',
    w: 34,
    h: 22,
    clickNoise: 3,
    noiseKind: 'drawer',
    states: ['closed', 'open'],
    initialState: 'closed',
    interactionTime: 0.4,
  }),
  def({
    kind: 'CABINET',
    label: 'Cabinet',
    art: 'locker',
    w: 30,
    h: 44,
    solid: true,
    opaque: true,
    clickNoise: 4,
    noiseKind: 'drawer',
    states: ['closed', 'open'],
    initialState: 'closed',
    interactionTime: 0.5,
  }),

  // --- furniture -------------------------------------------------------------
  def({
    kind: 'LOCKER',
    label: 'Locker',
    art: 'locker',
    w: 30,
    h: 50,
    solid: true,
    opaque: true,
    hideSpot: true,
    clickNoise: 5,
    noiseKind: 'metal',
    states: ['closed', 'open'],
    initialState: 'closed',
    interactionTime: 0.5,
  }),
  def({
    kind: 'TABLE',
    label: 'Table',
    art: 'table',
    w: 76,
    h: 44,
    solid: false,
    opaque: false,
    hideSpot: true,
    interactable: true,
    clickNoise: 2,
    states: ['clear', 'clear'],
    initialState: 'clear',
  }),
  def({
    kind: 'DESK',
    label: 'Desk',
    art: 'table',
    w: 92,
    h: 38,
    solid: true,
    opaque: false,
    interactable: false,
    clickNoise: 2,
  }),
  def({
    kind: 'SHELF',
    label: 'Shelving',
    art: 'block',
    w: 30,
    h: 86,
    solid: true,
    opaque: true,
    interactable: false,
  }),
  def({
    kind: 'BOX',
    label: 'Crate',
    art: 'block',
    w: 30,
    h: 30,
    solid: true,
    opaque: false,
    pushable: true,
    clickNoise: 3,
    interactable: true,
  }),
  def({
    kind: 'CHAIR',
    label: 'Chair',
    art: 'chair',
    w: 22,
    h: 22,
    pushable: true,
    clickNoise: 4,
    noiseKind: 'object',
    interactable: true,
  }),

  // --- fragile and flavour --------------------------------------------------
  def({
    kind: 'BOTTLE',
    label: 'Bottle',
    art: 'glass',
    w: 12,
    h: 20,
    breakable: true,
    clickNoise: 10,
    noiseKind: 'glass',
    states: ['whole', 'broken'],
    initialState: 'whole',
    createsDistraction: true,
    uses: 1,
  }),
  def({
    kind: 'CUP',
    label: 'Cup',
    art: 'glass',
    w: 12,
    h: 14,
    breakable: true,
    clickNoise: 8,
    noiseKind: 'glass',
    states: ['whole', 'broken'],
    initialState: 'whole',
    createsDistraction: true,
    uses: 1,
  }),
  def({
    kind: 'BOOK',
    label: 'Notebook',
    art: 'trinket',
    w: 16,
    h: 12,
    clickNoise: 1,
    pickup: true,
    secret: true,
    states: ['here', 'taken'],
    initialState: 'here',
  }),
  def({
    kind: 'TOY',
    label: 'Toy',
    art: 'trinket',
    w: 14,
    h: 14,
    clickNoise: 2,
    pickup: true,
    secret: true,
    states: ['here', 'taken'],
    initialState: 'here',
  }),
];

const BY_KIND = new Map<ObjectKind, ObjectDefinition>(DEFS.map((d) => [d.kind, d]));

export function getObjectDef(kind: ObjectKind): ObjectDefinition {
  const d = BY_KIND.get(kind);
  if (!d) throw new Error(`Unknown object kind: ${kind}`);
  return d;
}

export function allObjectDefs(): readonly ObjectDefinition[] {
  return DEFS;
}
