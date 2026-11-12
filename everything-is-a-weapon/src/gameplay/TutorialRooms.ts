import type { EnemyTypeId } from '../entities/EnemyTypes';
import type { RoomDefinition } from './Room';

/**
 * The opening is a short run of tiny rooms, one idea each, before the campaign proper.
 * Each is nearly empty on purpose: the hero, the one or two things the lesson needs, and
 * whoever is about to find out. Clearing one walks straight into the next (no results
 * screen); the last one hands over to campaign room 1.
 *
 * Adding a lesson is adding an entry here and a `case` in gameplay/Tutorial.ts.
 */
export type Lesson = 'throw' | 'zap' | 'dash' | 'power' | 'pet';

export interface TutorialRoom {
  readonly id: Lesson;
  /** Shown on the lesson card. */
  readonly title: string;
  readonly def: RoomDefinition;
  /** A mover already standing in the room, asleep until the lesson wakes it. */
  readonly sleeper?: { readonly type: EnemyTypeId; readonly x: number; readonly y: number };
}

export const TUTORIAL_ROOMS: readonly TutorialRoom[] = [
  // 1 — the first thing anyone sees: an empty room, a frying pan, one sleeping box.
  {
    id: 'throw',
    title: 'PICK UP, THROW',
    sleeper: { type: 'basic', x: 440, y: 170 },
    def: {
      id: 'lesson-throw', name: 'LESSON 1', theme: 'bedroom', width: 560, height: 340, seed: 9101, tutorial: true,
      playerStart: { x: 110, y: 180 },
      entrance: { side: 'top', pos: 440 },
      exit: { side: 'left', pos: 170 },
      objects: [{ type: 'pan', x: 220, y: 200, angle: 0.4 }],
      zones: [],
      enemies: [],
    },
  },

  // 2 — water and electricity. The socket sits beside the door, so whoever walks in
  // walks into the puddle.
  {
    id: 'zap',
    title: 'WATER + ELECTRICITY',
    def: {
      id: 'lesson-zap', name: 'LESSON 2', theme: 'bathroom', width: 600, height: 340, seed: 9102, tutorial: true,
      playerStart: { x: 150, y: 230 },
      entrance: { side: 'top', pos: 490 },
      exit: { side: 'left', pos: 230 },
      objects: [{ type: 'bottle', x: 235, y: 250, angle: 0.3 }],
      zones: [{ kind: 'electric', x: 440, y: 12, r: 18, outlet: true }],
      enemies: [
        { type: 'basic', delay: 1 },
        { type: 'basic', delay: 1.7 },
      ],
    },
  },

  // 3 — dashing. One mover who runs at you; a chair for afterwards.
  {
    id: 'dash',
    title: 'DASH',
    def: {
      id: 'lesson-dash', name: 'LESSON 3', theme: 'garage', width: 560, height: 340, seed: 9103, tutorial: true,
      playerStart: { x: 150, y: 170 },
      entrance: { side: 'right', pos: 170 },
      exit: { side: 'left', pos: 170 },
      objects: [
        { type: 'chair', x: 280, y: 270 },
        { type: 'shoe', x: 250, y: 70, angle: 0.5 },
      ],
      zones: [],
      enemies: [{ type: 'basic', delay: 1.2 }],
    },
  },

  // 4 — the BIG RED BUTTON. A crowd arrives together: no object is going to answer that.
  {
    id: 'power',
    title: 'YOUR POWER',
    def: {
      id: 'lesson-power', name: 'LESSON 4', theme: 'living', width: 640, height: 360, seed: 9104, tutorial: true,
      playerStart: { x: 140, y: 190 },
      entrance: { side: 'right', pos: 190 },
      exit: { side: 'left', pos: 190 },
      // A way out if the Power is wasted: the lesson cannot soft-lock.
      objects: [{ type: 'chair', x: 250, y: 280 }, { type: 'pan', x: 260, y: 90 }],
      zones: [],
      enemies: [
        { type: 'basic', delay: 0.8 },
        { type: 'basic', delay: 1.1 },
        { type: 'basic', delay: 1.4 },
        { type: 'basic', delay: 1.7 },
        { type: 'basic', delay: 2 },
      ],
    },
  },

  // 5 — the pet. Its food is on the floor; whoever picks it up sets it off.
  {
    id: 'pet',
    title: 'YOUR PET',
    def: {
      id: 'lesson-pet', name: 'LESSON 5', theme: 'kitchen', width: 600, height: 340, seed: 9105, tutorial: true,
      playerStart: { x: 170, y: 180 },
      entrance: { side: 'right', pos: 180 },
      exit: { side: 'left', pos: 180 },
      objects: [{ type: 'chair', x: 330, y: 260 }],
      zones: [],
      enemies: [
        { type: 'basic', delay: 1 },
        { type: 'basic', delay: 2 },
      ],
    },
  },
];

export const LESSONS: readonly Lesson[] = TUTORIAL_ROOMS.map((room) => room.id);

export function tutorialRoom(id: Lesson): TutorialRoom {
  return TUTORIAL_ROOMS.find((room) => room.id === id) ?? TUTORIAL_ROOMS[0]!;
}

/** The lesson after this one, or null when it was the last. */
export function nextLesson(id: Lesson): Lesson | null {
  const i = LESSONS.indexOf(id);
  return i >= 0 ? LESSONS[i + 1] ?? null : null;
}

/** A saved progress string as a lesson. Anything old or unknown starts from the top. */
export function toLesson(saved: string): Lesson {
  return LESSONS.find((id) => id === saved) ?? 'throw';
}
