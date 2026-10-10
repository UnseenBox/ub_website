import type { ActionState, PointerState } from '../input/InputManager';

const BIT_SNEAK = 1;
const BIT_INTERACT = 2;
const BIT_HIDE = 4;
const BIT_PRIMARY = 8;
const BIT_SECONDARY = 16;
const BIT_INSIDE = 32;

export interface ReplayFrame {
  /** Pointer position, quantised to whole logical pixels. */
  px: number;
  py: number;
  /** Movement axes, quantised to hundredths. */
  mx: number;
  my: number;
  bits: number;
}

export interface ReplayRecording {
  version: 1;
  roomId: string;
  seed: number;
  modifiers: readonly string[];
  frames: readonly ReplayFrame[];
  /** Fixed timestep the recording was made at, so playback can refuse a mismatch. */
  dt: number;
}

/**
 * Input recording, kept deliberately small: a seed plus one compact frame per
 * simulation step. Because simulation is fixed-step and the only nondeterminism
 * is seeded, replaying the frames reproduces the run.
 *
 * Version 1 records and exports. Playback is wired (`driveFrom`) but there is no
 * share or export-to-video feature yet, which is the next sensible step.
 */
export class ReplaySystem {
  private frames: ReplayFrame[] = [];
  private roomId = '';
  private seed = 0;
  private modifiers: readonly string[] = [];
  private readonly fixedDt: number;
  recording = false;

  constructor(fixedDt: number) {
    this.fixedDt = fixedDt;
  }

  begin(roomId: string, seed: number, modifiers: readonly string[]): void {
    this.frames = [];
    this.roomId = roomId;
    this.seed = seed;
    this.modifiers = modifiers;
    this.recording = true;
  }

  capture(actions: ActionState, pointer: PointerState): void {
    if (!this.recording) return;
    // A couple of minutes of play is a few thousand tiny objects. Cap it so a
    // player who parks the game for an hour cannot grow this without bound.
    if (this.frames.length > 60 * 60 * 6) return;
    let bits = 0;
    if (actions.sneak) bits |= BIT_SNEAK;
    if (actions.interact) bits |= BIT_INTERACT;
    if (actions.hide) bits |= BIT_HIDE;
    if (pointer.primaryDown) bits |= BIT_PRIMARY;
    if (pointer.secondaryDown) bits |= BIT_SECONDARY;
    if (pointer.inside) bits |= BIT_INSIDE;
    this.frames.push({
      px: Math.round(pointer.x),
      py: Math.round(pointer.y),
      mx: Math.round(actions.moveX * 100) / 100,
      my: Math.round(actions.moveY * 100) / 100,
      bits,
    });
  }

  end(): ReplayRecording {
    this.recording = false;
    return this.snapshot();
  }

  snapshot(): ReplayRecording {
    return {
      version: 1,
      roomId: this.roomId,
      seed: this.seed,
      modifiers: this.modifiers,
      frames: this.frames,
      dt: this.fixedDt,
    };
  }

  get frameCount(): number {
    return this.frames.length;
  }

  /** Feed a recorded frame back into the live input records. */
  static driveFrom(
    recording: ReplayRecording,
    frameIndex: number,
    actions: ActionState,
    pointer: PointerState,
  ): boolean {
    const f = recording.frames[frameIndex];
    if (!f) return false;
    actions.moveX = f.mx;
    actions.moveY = f.my;
    actions.sneak = (f.bits & BIT_SNEAK) !== 0;
    actions.interact = (f.bits & BIT_INTERACT) !== 0;
    actions.hide = (f.bits & BIT_HIDE) !== 0;
    pointer.x = f.px;
    pointer.y = f.py;
    pointer.inside = (f.bits & BIT_INSIDE) !== 0;
    pointer.primaryDown = (f.bits & BIT_PRIMARY) !== 0;
    pointer.secondaryDown = (f.bits & BIT_SECONDARY) !== 0;
    return true;
  }
}
