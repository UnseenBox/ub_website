import type { RigidBody } from '../physics/RigidBody';

/** What a mechanic can announce. Scoring, sound and particles all hang off these. */
/** The last two are duel boosts at work: a burning ball going through something, the magnet taking hold. */
export type MechEventKind = 'boing' | 'bumper' | 'spin' | 'wind' | 'pipe' | 'sand' | 'smash' | 'clink' | 'bell' | 'save' | 'scooter' | 'burn' | 'magnet';

export interface MechEvent {
  kind: MechEventKind;
  x: number;
  y: number;
  /** 0 to 1. */
  strength: number;
}

export type MechSink = (e: MechEvent) => void;

/** Facts about the physics step in progress that a mechanic may need. */
export interface StepInfo {
  /** Ball velocity before this step, for mechanics that undo a bounce (glass). */
  preVX: number;
  preVY: number;
}

/**
 * Base class for everything in a level that has behaviour. A mechanic owns its physics
 * bodies and its state; it never draws and never plays a sound. Override only what you need.
 */
export abstract class Mechanic {
  /** Bodies this mechanic put in the world; contacts with them are routed to `contact`. */
  readonly bodies: RigidBody[] = [];
  /**
   * Where it stands for draw order, as the y of its base. Null means it lies flat on the
   * ground and is drawn under everything.
   */
  sortY: number | null = null;

  /** Back to how it was before the shot. */
  reset(): void {}
  /** Every physics step, before the ball moves. `live` is false while the ball waits on its spot. */
  move(_dt: number, _ball: RigidBody, _live: boolean, _sink: MechSink | null): void {}
  /** The ball struck one of this mechanic's bodies. */
  contact(_other: RigidBody, _impact: number, _ball: RigidBody, _sink: MechSink | null): void {}
  /** Every physics step of a live ball, after it has moved and bounced. */
  after(_ball: RigidBody, _info: StepInfo, _sink: MechSink | null): void {}
  /** Once per frame, for animation timers. */
  tick(_dt: number): void {}
  /** Whether a burning ball (the HARISSA card) destroys `body`, one of this mechanic's own. */
  burnable(_body: RigidBody): boolean {
    return false;
  }
  /** Takes `body` out of the street for the rest of the shot. */
  burn(_body: RigidBody): void {}
}
