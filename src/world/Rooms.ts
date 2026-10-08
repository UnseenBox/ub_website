import type { Rect } from '../core/Mathx';
import type { RoomDefinition } from './Room';

const W = 960;
const H = 540;
const T = 28; // Wall thickness, and the inset of the play field.

/** The outer shell every room shares. */
function frame(): Rect[] {
  return [
    { x: 0, y: 0, w: W, h: T },
    { x: 0, y: H - T, w: W, h: T },
    { x: 0, y: 0, w: T, h: H },
    { x: W - T, y: 0, w: T, h: H },
  ];
}

function wall(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h };
}

const DOWN = Math.PI * 0.5;
const UP = -Math.PI * 0.5;
const LEFT = Math.PI;
const RIGHT = 0;

/**
 * ROOM 1 - the first room.
 *
 * Teaches the only rule that matters, and teaches it by letting the player walk
 * right past the creature untouched before they ever move the cursor near it.
 * The key sits inside the Watcher's awareness radius but behind its gaze, so
 * there are at least three honest answers: reach for it blind with E, ring the
 * phone first, or kill the lights.
 */
const ROOM_1: RoomDefinition = {
  id: 'room-01',
  name: 'Room With One Door',
  teaches: 'Attention is what it hunts.',
  brief: 'TAKE THE KEY. GET OUT.',
  ambient: 0.2,
  parTime: 45,
  intro: ['IT CANNOT SEE YOU.', 'NOT YOUR FACE.', 'NOT YOUR BODY.', 'YOUR ATTENTION.'],
  playerSpawn: { x: 92, y: 462 },
  walls: [...frame(), wall(300, T, 18, 118), wall(620, 394, 18, 118)],
  lights: [
    { id: 'main', x: 470, y: 170, radius: 440, intensity: 0.62, tint: '#cfe3ff', flicker: 0.015 },
    { id: 'lamp-1', x: 702, y: 452, radius: 150, intensity: 0.5, tint: '#ffc889' },
  ],
  objects: [
    { kind: 'EXIT', id: 'exit-1', x: 905, y: 270, requires: 'key', hint: 'LOCKED' },
    { kind: 'KEY', id: 'key-1', x: 560, y: 196 },
    { kind: 'PHONE', id: 'phone-1', x: 300, y: 150, hint: 'IT RINGS' },
    { kind: 'LIGHT_SWITCH', id: 'switch-1', x: 50, y: 300, lights: ['main'] },
    { kind: 'TABLE', id: 'table-1', x: 232, y: 428 },
    { kind: 'LAMP', id: 'lamp-obj-1', x: 702, y: 452, lights: ['lamp-1'] },
    { kind: 'DESK', id: 'desk-1', x: 520, y: 300 },
    { kind: 'BOTTLE', id: 'bottle-1', x: 366, y: 300 },
    { kind: 'BOOK', id: 'book-1', x: 500, y: 86 },
    { kind: 'CHAIR', id: 'chair-1', x: 566, y: 362 },
  ],
  enemies: [{ kind: 'WATCHER', x: 690, y: 232, facing: LEFT, tag: 'watcher' }],
  objective: {
    kind: 'STEAL_AND_EXIT',
    label: 'TAKE THE KEY',
    items: ['key'],
    exitId: 'exit-1',
  },
  secrets: ['book-1'],
};

/**
 * ROOM 2 - the desk.
 *
 * The body can walk the whole room freely. The cursor cannot: the only short
 * path crosses the Watcher's gaze, and the lesson is that going round is cheap.
 */
const ROOM_2: RoomDefinition = {
  id: 'room-02',
  name: 'The Desk',
  teaches: 'Where you point matters more than how close you are.',
  brief: 'GET TO THE OTHER SIDE.',
  ambient: 0.24,
  parTime: 38,
  intro: ['IT IS FACING THE DOOR.', 'SO DO NOT GO THROUGH THE DOOR WITH YOUR EYES.'],
  playerSpawn: { x: 92, y: 110 },
  walls: [...frame(), wall(318, T, 18, 196), wall(318, 348, 18, 164), wall(600, 120, 18, 300)],
  lights: [
    { id: 'main', x: 200, y: 270, radius: 360, intensity: 0.55, tint: '#cfe3ff' },
    { id: 'desk-lamp', x: 700, y: 268, radius: 190, intensity: 0.55, tint: '#ffd09a', flicker: 0.04 },
  ],
  objects: [
    { kind: 'EXIT', id: 'exit-1', x: 905, y: 452 },
    { kind: 'DESK', id: 'desk-1', x: 700, y: 318 },
    { kind: 'LAMP', id: 'lamp-obj-1', x: 760, y: 250, lights: ['desk-lamp'] },
    { kind: 'LIGHT_SWITCH', id: 'switch-1', x: 50, y: 180, lights: ['main'] },
    { kind: 'TABLE', id: 'table-1', x: 430, y: 440 },
    { kind: 'SHELF', id: 'shelf-1', x: 460, y: 110 },
    { kind: 'CUP', id: 'cup-1', x: 700, y: 262 },
    { kind: 'BOOK', id: 'book-1', x: 860, y: 90 },
  ],
  enemies: [{ kind: 'WATCHER', x: 700, y: 268, facing: LEFT, tag: 'watcher' }],
  objective: { kind: 'REACH_EXIT', label: 'GET OUT', exitId: 'exit-1' },
  secrets: ['book-1'],
};

/**
 * ROOM 3 - the lock.
 *
 * The switch that opens the way out is a heavy one, mounted close enough to the
 * Watcher that it will hear the throw. The phone is the answer, and it is placed
 * just inside the range where a ring will actually pull the creature.
 */
const ROOM_3: RoomDefinition = {
  id: 'room-03',
  name: 'The Lock',
  teaches: 'Using something makes a sound where it stands.',
  brief: 'THROW THE SWITCH. GET OUT.',
  ambient: 0.2,
  parTime: 50,
  intro: ['THE SWITCH IS LOUD.', 'IT IS STANDING RIGHT NEXT TO IT.'],
  playerSpawn: { x: 92, y: 470 },
  walls: [...frame(), wall(T, 250, 230, 18), wall(430, 120, 18, 240), wall(600, 392, 300, 18)],
  lights: [
    { id: 'main', x: 480, y: 250, radius: 430, intensity: 0.58, tint: '#cfe3ff' },
    { id: 'hall', x: 760, y: 160, radius: 200, intensity: 0.5, tint: '#ffd09a', flicker: 0.05 },
  ],
  objects: [
    { kind: 'EXIT', id: 'exit-1', x: 905, y: 470 },
    { kind: 'METAL_SWITCH', id: 'sw-1', x: 700, y: 300, targets: ['exit-1'], hint: 'HEAVY' },
    { kind: 'PHONE', id: 'phone-1', x: 520, y: 390 },
    { kind: 'LIGHT_SWITCH', id: 'switch-1', x: 50, y: 160, lights: ['main'] },
    { kind: 'LOCKER', id: 'locker-1', x: 300, y: 320 },
    { kind: 'DESK', id: 'desk-1', x: 760, y: 220 },
    { kind: 'SHELF', id: 'shelf-1', x: 560, y: 110 },
    { kind: 'BOTTLE', id: 'bottle-1', x: 120, y: 120 },
    { kind: 'TOY', id: 'toy-1', x: 220, y: 470 },
  ],
  enemies: [{ kind: 'WATCHER', x: 700, y: 180, facing: DOWN, tag: 'watcher' }],
  objective: { kind: 'REACH_EXIT', label: 'OPEN THE WAY OUT', exitId: 'exit-1' },
  secrets: ['toy-1'],
};

/**
 * ROOM 4 - kennel.
 *
 * The Hound does not care where you point and it does not need line of sight.
 * It only reads how fast your hand moved, which means the room is a lesson in
 * not flinching.
 */
const ROOM_4: RoomDefinition = {
  id: 'room-04',
  name: 'Kennel',
  teaches: 'Some of them only read how fast you moved.',
  brief: 'TAKE THE KEY. SLOWLY.',
  ambient: 0.18,
  parTime: 55,
  intro: ['THIS ONE DOES NOT WATCH.', 'IT LISTENS TO YOUR HAND.'],
  playerSpawn: { x: 92, y: 474 },
  walls: [...frame(), wall(240, T, 18, 170), wall(240, 330, 18, 182), wall(690, 170, 18, 200)],
  lights: [
    { id: 'main', x: 480, y: 270, radius: 420, intensity: 0.5, tint: '#bcd6f5' },
    { id: 'cage', x: 820, y: 130, radius: 190, intensity: 0.55, tint: '#ffc889', flicker: 0.07 },
  ],
  objects: [
    { kind: 'EXIT', id: 'exit-1', x: 905, y: 452, requires: 'key' },
    { kind: 'KEY', id: 'key-1', x: 862, y: 122 },
    { kind: 'BOTTLE', id: 'bottle-1', x: 140, y: 120, hint: 'FRAGILE' },
    { kind: 'FAN', id: 'fan-1', x: 150, y: 270 },
    { kind: 'TABLE', id: 'table-1', x: 420, y: 452 },
    { kind: 'BOX', id: 'box-1', x: 540, y: 150 },
    { kind: 'BOX', id: 'box-2', x: 576, y: 186 },
    { kind: 'LIGHT_SWITCH', id: 'switch-1', x: 50, y: 360, lights: ['main'] },
    { kind: 'BOOK', id: 'book-1', x: 330, y: 240 },
  ],
  enemies: [
    {
      kind: 'HOUND',
      x: 520,
      y: 282,
      facing: RIGHT,
      tag: 'hound',
      patrol: [
        { x: 380, y: 282, pause: 1.2 },
        { x: 640, y: 282, pause: 1.4 },
      ],
    },
  ],
  objective: { kind: 'STEAL_AND_EXIT', label: 'TAKE THE KEY', items: ['key'], exitId: 'exit-1' },
  secrets: ['book-1'],
};

/**
 * ROOM 5 - do not wake it.
 *
 * The key is on the sleeper's own table. Hovering is what kills you here, not
 * proximity, so the clean answer is to stand beside it and reach without looking.
 */
const ROOM_5: RoomDefinition = {
  id: 'room-05',
  name: 'Do Not Wake It',
  teaches: 'Holding still is not the same as being safe.',
  brief: 'TAKE THE KEY OFF ITS TABLE.',
  ambient: 0.14,
  parTime: 50,
  intro: ['IT IS ASLEEP.', 'PROBABLY.'],
  playerSpawn: { x: 92, y: 430 },
  walls: [...frame(), wall(T, 160, 190, 18), wall(740, 160, 192, 18), wall(470, 360, 18, 152)],
  lights: [
    { id: 'main', x: 480, y: 290, radius: 330, intensity: 0.42, tint: '#b9cfe8' },
    { id: 'desk-lamp', x: 230, y: 130, radius: 150, intensity: 0.55, tint: '#ffc889' },
  ],
  objects: [
    { kind: 'EXIT', id: 'exit-1', x: 905, y: 290, requires: 'key' },
    { kind: 'TABLE', id: 'table-1', x: 480, y: 300 },
    { kind: 'KEY', id: 'key-1', x: 480, y: 212 },
    { kind: 'DRAWER', id: 'drawer-1', x: 230, y: 120 },
    { kind: 'BOOK', id: 'book-1', x: 230, y: 120, hiddenIn: 'drawer-1' },
    { kind: 'FAN', id: 'fan-1', x: 820, y: 110 },
    { kind: 'LAMP', id: 'lamp-obj-1', x: 180, y: 130, lights: ['desk-lamp'] },
    { kind: 'LOCKER', id: 'locker-1', x: 700, y: 440 },
    { kind: 'CUP', id: 'cup-1', x: 380, y: 120 },
  ],
  enemies: [{ kind: 'SLEEPER', x: 480, y: 318, facing: UP, tag: 'sleeper' }],
  objective: { kind: 'STEAL_AND_EXIT', label: 'TAKE THE KEY', items: ['key'], exitId: 'exit-1' },
  events: [
    {
      kind: 'MOVE_OBJECT',
      targetId: 'cup-1',
      at: 18,
      a: 26,
      b: 10,
      text: 'IT WAS NOT THERE BEFORE',
    },
  ],
  secrets: ['book-1'],
};

/**
 * ROOM 6 - two of them.
 *
 * The Scout cannot hurt you. It walks a long patrol, finds your attention, and
 * tells the Watcher, which is the first time one mistake costs two creatures.
 */
const ROOM_6: RoomDefinition = {
  id: 'room-06',
  name: 'Two Of Them',
  teaches: 'One of them does not catch you. It tells.',
  brief: 'FIND THE KEY. GET OUT.',
  ambient: 0.2,
  parTime: 70,
  intro: ['THE SMALL ONE CANNOT HURT YOU.', 'IT DOES NOT HAVE TO.'],
  playerSpawn: { x: 92, y: 470 },
  walls: [
    ...frame(),
    wall(200, 200, 18, 180),
    wall(430, T, 18, 150),
    wall(430, 330, 18, 182),
    wall(660, 200, 220, 18),
  ],
  lights: [
    { id: 'main', x: 400, y: 280, radius: 420, intensity: 0.5, tint: '#c4daf5' },
    { id: 'back', x: 790, y: 410, radius: 210, intensity: 0.5, tint: '#ffc889', flicker: 0.05 },
  ],
  objects: [
    { kind: 'EXIT', id: 'exit-1', x: 905, y: 470, requires: 'key' },
    { kind: 'CABINET', id: 'cabinet-1', x: 560, y: 108 },
    { kind: 'KEY', id: 'key-1', x: 560, y: 108, hiddenIn: 'cabinet-1' },
    { kind: 'RADIO', id: 'radio-1', x: 170, y: 470 },
    { kind: 'LIGHT_SWITCH', id: 'switch-1', x: 50, y: 110, lights: ['main'] },
    { kind: 'TABLE', id: 'table-1', x: 320, y: 450 },
    { kind: 'DESK', id: 'desk-1', x: 790, y: 330 },
    { kind: 'SHELF', id: 'shelf-1', x: 248, y: 110 },
    { kind: 'BOTTLE', id: 'bottle-1', x: 620, y: 300 },
    { kind: 'TOY', id: 'toy-1', x: 120, y: 120 },
  ],
  enemies: [
    {
      kind: 'SCOUT',
      x: 300,
      y: 140,
      facing: DOWN,
      tag: 'scout',
      patrol: [
        { x: 300, y: 150, pause: 0.9 },
        { x: 300, y: 430, pause: 1.1 },
      ],
    },
    { kind: 'WATCHER', x: 770, y: 420, facing: LEFT, tag: 'watcher' },
  ],
  objective: { kind: 'STEAL_AND_EXIT', label: 'FIND THE KEY', items: ['key'], exitId: 'exit-1' },
  secrets: ['toy-1'],
};

/**
 * ROOM 7 - lights.
 *
 * Killing the power halves how legible your attention is, and the Mirror has a
 * gaze like a razor. The catch is that the dark also hides the room from you.
 */
const ROOM_7: RoomDefinition = {
  id: 'room-07',
  name: 'Lights',
  teaches: 'The dark does not hide you. It only blurs you.',
  brief: 'CUT THE POWER. GET OUT.',
  ambient: 0.16,
  parTime: 65,
  intro: ['SOMETHING HERE ONLY TURNS.', 'IT IS VERY GOOD AT IT.'],
  playerSpawn: { x: 92, y: 470 },
  walls: [...frame(), wall(260, 140, 18, 240), wall(420, T, 18, 120), wall(620, 300, 240, 18)],
  lights: [
    { id: 'main', x: 480, y: 220, radius: 440, intensity: 0.6, tint: '#cfe3ff' },
    { id: 'strip', x: 760, y: 440, radius: 220, intensity: 0.5, tint: '#ffc889' },
    { id: 'cold', x: 180, y: 180, radius: 200, intensity: 0.42, tint: '#9fd8ff', flicker: 0.1 },
  ],
  objects: [
    { kind: 'EXIT', id: 'exit-1', x: 905, y: 170 },
    { kind: 'BREAKER', id: 'breaker-1', x: 70, y: 300, hint: 'EVERYTHING AT ONCE' },
    { kind: 'LIGHT_SWITCH', id: 'switch-1', x: 320, y: 110, lights: ['main'] },
    { kind: 'LAMP', id: 'lamp-obj-1', x: 760, y: 450, lights: ['strip'] },
    { kind: 'LOCKER', id: 'locker-1', x: 160, y: 430 },
    { kind: 'DESK', id: 'desk-1', x: 540, y: 420 },
    { kind: 'MIRROR', id: 'mirror-1', x: 880, y: 420 },
    { kind: 'CUP', id: 'cup-1', x: 540, y: 404 },
    { kind: 'BOOK', id: 'book-1', x: 690, y: 110 },
  ],
  enemies: [
    { kind: 'MIRROR', x: 500, y: 90, facing: DOWN, tag: 'mirror' },
    { kind: 'WATCHER', x: 740, y: 230, facing: LEFT, tag: 'watcher' },
  ],
  objective: { kind: 'POWER_OFF', label: 'CUT THE POWER', exitId: 'exit-1' },
  events: [{ kind: 'WHISPER', at: 12, text: 'IT KNOWS YOU ARE LOOKING FOR THE SWITCH' }],
  secrets: ['book-1'],
};

/**
 * ROOM 8 - static.
 *
 * Two heavy switches behind two doors, a Watcher and a Hound between you and
 * them, and a radio you have to decide whether to leave running.
 */
const ROOM_8: RoomDefinition = {
  id: 'room-08',
  name: 'Static',
  teaches: 'Noise you control is still noise.',
  brief: 'THROW BOTH SWITCHES. GET OUT.',
  ambient: 0.19,
  parTime: 85,
  intro: ['TWO SWITCHES.', 'TWO OF THEM.'],
  playerSpawn: { x: 92, y: 270 },
  walls: [
    ...frame(),
    wall(790, T, 18, 212),
    wall(790, 300, 18, 212),
    wall(866, T, 18, 212),
    wall(866, 300, 18, 212),
    wall(260, 150, 18, 240),
    wall(520, T, 18, 140),
    wall(520, 400, 18, 112),
  ],
  lights: [
    { id: 'main', x: 420, y: 270, radius: 450, intensity: 0.52, tint: '#c4daf5' },
    { id: 'hall', x: 830, y: 270, radius: 160, intensity: 0.5, tint: '#ffc889', flicker: 0.08 },
  ],
  objects: [
    { kind: 'EXIT', id: 'exit-1', x: 910, y: 270 },
    { kind: 'DOOR', id: 'door-a', x: 799, y: 270 },
    { kind: 'DOOR', id: 'door-b', x: 875, y: 270 },
    { kind: 'METAL_SWITCH', id: 'sw-a', x: 320, y: 110, targets: ['door-a'] },
    { kind: 'METAL_SWITCH', id: 'sw-b', x: 320, y: 450, targets: ['door-b'] },
    { kind: 'RADIO', id: 'radio-1', x: 480, y: 270 },
    { kind: 'FAN', id: 'fan-1', x: 120, y: 120 },
    { kind: 'TABLE', id: 'table-1', x: 640, y: 440 },
    { kind: 'LOCKER', id: 'locker-1', x: 640, y: 110 },
    { kind: 'LIGHT_SWITCH', id: 'switch-1', x: 50, y: 400, lights: ['main'] },
    { kind: 'BOTTLE', id: 'bottle-1', x: 180, y: 470 },
    { kind: 'TOY', id: 'toy-1', x: 700, y: 270 },
  ],
  enemies: [
    {
      kind: 'WATCHER',
      x: 400,
      y: 170,
      facing: DOWN,
      tag: 'watcher',
      patrol: [
        { x: 360, y: 170, pause: 1.3 },
        { x: 440, y: 400, pause: 1.5 },
      ],
    },
    {
      kind: 'HOUND',
      x: 660,
      y: 290,
      facing: LEFT,
      tag: 'hound',
      patrol: [
        { x: 600, y: 200, pause: 0.8 },
        { x: 700, y: 380, pause: 0.9 },
      ],
    },
  ],
  objective: {
    kind: 'ACTIVATE_SWITCHES',
    label: 'THROW BOTH SWITCHES',
    switches: ['sw-a', 'sw-b'],
    exitId: 'exit-1',
  },
  secrets: ['toy-1'],
};

/**
 * ROOM 9 - the projection.
 *
 * The key is sitting in the Watcher's gaze with a Mirror covering the approach.
 * The projector makes attention that is not yours, and that is the whole answer.
 */
const ROOM_9: RoomDefinition = {
  id: 'room-09',
  name: 'The Projection',
  teaches: 'Attention does not have to be yours.',
  brief: 'TAKE THE KEY. GET OUT.',
  ambient: 0.17,
  parTime: 80,
  intro: ['YOU CAN MAKE ONE OF THESE TOO.'],
  playerSpawn: { x: 92, y: 270 },
  walls: [...frame(), wall(300, T, 18, 160), wall(300, 356, 18, 156), wall(560, 160, 18, 220)],
  lights: [
    { id: 'main', x: 420, y: 270, radius: 420, intensity: 0.48, tint: '#c4daf5' },
    { id: 'spot', x: 840, y: 290, radius: 190, intensity: 0.6, tint: '#ffd09a' },
    { id: 'proj', x: 200, y: 460, radius: 120, intensity: 0.35, tint: '#9fd8ff' },
  ],
  objects: [
    { kind: 'EXIT', id: 'exit-1', x: 905, y: 470, requires: 'key' },
    { kind: 'KEY', id: 'key-1', x: 862, y: 180 },
    { kind: 'PROJECTOR', id: 'proj-1', x: 200, y: 466, lights: ['proj'], hint: 'THROWS A CURSOR' },
    { kind: 'COMPUTER', id: 'pc-1', x: 150, y: 120 },
    { kind: 'MIRROR', id: 'mirror-1', x: 620, y: 466 },
    { kind: 'DESK', id: 'desk-1', x: 760, y: 120 },
    { kind: 'TABLE', id: 'table-1', x: 420, y: 460 },
    { kind: 'LOCKER', id: 'locker-1', x: 430, y: 110 },
    { kind: 'BOOK', id: 'book-1', x: 620, y: 300 },
  ],
  enemies: [
    { kind: 'WATCHER', x: 760, y: 300, facing: UP, tag: 'watcher' },
    { kind: 'MIRROR', x: 480, y: 270, facing: LEFT, tag: 'mirror' },
  ],
  objective: { kind: 'STEAL_AND_EXIT', label: 'TAKE THE KEY', items: ['key'], exitId: 'exit-1' },
  secrets: ['book-1'],
};

/**
 * ROOM 10 - everything.
 *
 * All four early creatures, every tool, and one of them is only pretending to be
 * asleep. The lights go out on their own partway through.
 */
const ROOM_10: RoomDefinition = {
  id: 'room-10',
  name: 'Everything',
  teaches: 'You know the language now.',
  brief: 'KEY. DOOR. OUT.',
  ambient: 0.15,
  parTime: 110,
  intro: ['YOU KNOW HOW THIS WORKS NOW.', 'THEY KNOW THAT YOU KNOW.'],
  playerSpawn: { x: 92, y: 480 },
  walls: [
    ...frame(),
    wall(230, 120, 18, 200),
    wall(400, 360, 18, 152),
    wall(400, T, 18, 150),
    wall(640, 220, 220, 18),
    wall(640, 220, 18, 180),
  ],
  lights: [
    { id: 'main', x: 440, y: 230, radius: 440, intensity: 0.5, tint: '#c4daf5' },
    { id: 'warm', x: 780, y: 440, radius: 200, intensity: 0.5, tint: '#ffc889', flicker: 0.06 },
    { id: 'cold', x: 150, y: 160, radius: 180, intensity: 0.4, tint: '#9fd8ff' },
  ],
  objects: [
    { kind: 'EXIT', id: 'exit-1', x: 905, y: 110, requires: 'key' },
    { kind: 'DRAWER', id: 'drawer-1', x: 540, y: 300 },
    { kind: 'KEY', id: 'key-1', x: 540, y: 300, hiddenIn: 'drawer-1' },
    { kind: 'RADIO', id: 'radio-1', x: 120, y: 300 },
    { kind: 'PROJECTOR', id: 'proj-1', x: 330, y: 470 },
    { kind: 'PHONE', id: 'phone-1', x: 700, y: 470 },
    { kind: 'BREAKER', id: 'breaker-1', x: 70, y: 110 },
    { kind: 'LIGHT_SWITCH', id: 'switch-1', x: 300, y: 350, lights: ['main'] },
    { kind: 'LAMP', id: 'lamp-obj-1', x: 790, y: 452, lights: ['warm'] },
    { kind: 'LOCKER', id: 'locker-1', x: 480, y: 110 },
    { kind: 'TABLE', id: 'table-1', x: 200, y: 450 },
    { kind: 'DESK', id: 'desk-1', x: 760, y: 300 },
    { kind: 'BOTTLE', id: 'bottle-1', x: 620, y: 470 },
    { kind: 'BOOK', id: 'book-1', x: 880, y: 300 },
  ],
  enemies: [
    { kind: 'WATCHER', x: 700, y: 140, facing: LEFT, tag: 'watcher' },
    {
      kind: 'HOUND',
      x: 480,
      y: 240,
      facing: RIGHT,
      tag: 'hound',
      patrol: [
        { x: 320, y: 240, pause: 1 },
        { x: 560, y: 180, pause: 1.2 },
      ],
    },
    { kind: 'SLEEPER', x: 300, y: 250, facing: DOWN, tag: 'sleeper', fakeAsleep: true },
  ],
  objective: { kind: 'STEAL_AND_EXIT', label: 'FIND THE KEY', items: ['key'], exitId: 'exit-1' },
  events: [
    { kind: 'LIGHTS_OUT', at: 42, a: 6, text: 'SOMETHING TURNED THE LIGHTS OFF' },
    { kind: 'WHISPER', at: 20, text: 'ONE OF THEM IS NOT ASLEEP' },
  ],
  secrets: ['book-1'],
};

/**
 * ROOM 11 - the analyst.
 *
 * It walks to where your attention lingered rather than where it is, and it
 * counts your habits. The second phone call works noticeably worse than the first.
 */
const ROOM_11: RoomDefinition = {
  id: 'room-11',
  name: 'The Analyst',
  teaches: 'It is keeping score of your habits.',
  brief: 'THREE SWITCHES. THEN OUT.',
  ambient: 0.18,
  parTime: 100,
  intro: ['IT HAS SEEN YOUR TRICKS.', 'ALL OF THEM.'],
  playerSpawn: { x: 92, y: 270 },
  walls: [
    ...frame(),
    wall(250, T, 18, 170),
    wall(250, 350, 18, 162),
    wall(500, 170, 18, 200),
    wall(700, T, 18, 170),
    wall(700, 350, 18, 162),
  ],
  lights: [
    { id: 'main', x: 480, y: 270, radius: 470, intensity: 0.5, tint: '#c4daf5' },
    { id: 'warm', x: 840, y: 430, radius: 180, intensity: 0.45, tint: '#ffc889' },
  ],
  objects: [
    { kind: 'EXIT', id: 'exit-1', x: 905, y: 110 },
    { kind: 'BUTTON', id: 'btn-a', x: 150, y: 110 },
    { kind: 'BUTTON', id: 'btn-b', x: 620, y: 470 },
    { kind: 'BUTTON', id: 'btn-c', x: 840, y: 270 },
    { kind: 'PHONE', id: 'phone-1', x: 400, y: 110 },
    { kind: 'PHONE', id: 'phone-2', x: 400, y: 450 },
    { kind: 'COMPUTER', id: 'pc-1', x: 150, y: 450 },
    { kind: 'TABLE', id: 'table-1', x: 580, y: 270 },
    { kind: 'LOCKER', id: 'locker-1', x: 780, y: 110 },
    { kind: 'DESK', id: 'desk-1', x: 350, y: 270 },
    { kind: 'BOOK', id: 'book-1', x: 880, y: 470 },
  ],
  enemies: [
    { kind: 'ANALYST', x: 620, y: 200, facing: LEFT, tag: 'analyst' },
    {
      kind: 'SCOUT',
      x: 210,
      y: 200,
      facing: RIGHT,
      tag: 'scout',
      patrol: [
        { x: 200, y: 160, pause: 0.7 },
        { x: 220, y: 420, pause: 0.7 },
      ],
    },
  ],
  objective: {
    kind: 'ACTIVATE_SWITCHES',
    label: 'PRESS ALL THREE',
    switches: ['btn-a', 'btn-b', 'btn-c'],
    exitId: 'exit-1',
  },
  secrets: ['book-1'],
};

/**
 * ROOM 12 - it wants to be seen.
 *
 * The Parasite is provoked by being ignored and soothed by being looked at,
 * which inverts everything learned so far, and the Mimic is throwing cursors
 * that are not yours.
 */
const ROOM_12: RoomDefinition = {
  id: 'room-12',
  name: 'It Wants To Be Seen',
  teaches: 'Some of them are offended by being ignored.',
  brief: 'TAKE THE KEY. GET OUT.',
  ambient: 0.14,
  parTime: 95,
  intro: ['ONE OF THEM WANTS YOUR ATTENTION.', 'GIVE IT.'],
  playerSpawn: { x: 92, y: 470 },
  walls: [...frame(), wall(300, 200, 18, 312), wall(560, T, 18, 240), wall(700, 330, 232, 18)],
  lights: [
    { id: 'main', x: 440, y: 260, radius: 430, intensity: 0.46, tint: '#bcd6f5' },
    { id: 'red', x: 820, y: 170, radius: 200, intensity: 0.45, tint: '#ffb0a0', flicker: 0.12 },
  ],
  objects: [
    { kind: 'EXIT', id: 'exit-1', x: 905, y: 450, requires: 'key' },
    { kind: 'KEY', id: 'key-1', x: 840, y: 120 },
    { kind: 'PROJECTOR', id: 'proj-1', x: 150, y: 120 },
    { kind: 'TELEVISION', id: 'tv-1', x: 430, y: 460 },
    { kind: 'MIRROR', id: 'mirror-1', x: 320, y: 120 },
    { kind: 'LOCKER', id: 'locker-1', x: 620, y: 450 },
    { kind: 'DESK', id: 'desk-1', x: 760, y: 250 },
    { kind: 'TABLE', id: 'table-1', x: 180, y: 300 },
    { kind: 'ALARM', id: 'alarm-1', x: 480, y: 110, hint: 'DO NOT' },
    { kind: 'TOY', id: 'toy-1', x: 420, y: 300 },
  ],
  enemies: [
    { kind: 'PARASITE', x: 420, y: 220, facing: DOWN, tag: 'parasite' },
    { kind: 'MIMIC', x: 780, y: 420, facing: UP, tag: 'mimic' },
  ],
  objective: { kind: 'STEAL_AND_EXIT', label: 'TAKE THE KEY', items: ['key'], exitId: 'exit-1' },
  events: [{ kind: 'SECOND_CURSOR', at: 14, a: 7, text: 'THERE ARE TWO NOW' }],
  secrets: ['toy-1'],
};

export const ROOMS: readonly RoomDefinition[] = [
  ROOM_1,
  ROOM_2,
  ROOM_3,
  ROOM_4,
  ROOM_5,
  ROOM_6,
  ROOM_7,
  ROOM_8,
  ROOM_9,
  ROOM_10,
  ROOM_11,
  ROOM_12,
];

export function roomByIndex(index: number): RoomDefinition {
  return ROOMS[Math.max(0, Math.min(ROOMS.length - 1, index))];
}

export function roomById(id: string): RoomDefinition | undefined {
  return ROOMS.find((r) => r.id === id);
}
