/** What gameplay sees each simulation tick. Device-agnostic and in world coordinates. */
export interface InputFrame {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  primaryDown: boolean;
  primaryPressed: boolean;
  primaryReleased: boolean;
  secondaryPressed: boolean;
  dodgePressed: boolean;
  /**
   * Fires a bought ability: 1..3 for that slot, -1 for the touch POWER button
   * (first ready ability), 0 for none.
   */
  abilitySlot: number;
  /** No cursor (touch / gamepad): pick the grab target automatically instead of under a pointer. */
  autoTarget: boolean;
  /** The player is not steering the aim right now, so gameplay may aim at the nearest intruder. */
  aimAssist: boolean;
}

export type InputAction = 'pause' | 'restart' | 'debug';

/** State a device adapter fills in. Pointer position is in CSS pixels relative to the canvas. */
export interface RawInput {
  moveX: number;
  moveY: number;
  pointerX: number;
  pointerY: number;
  primaryDown: boolean;
  /** Edge counters: adapters increment, the manager consumes. Quick taps between ticks are never lost. */
  primaryPresses: number;
  primaryReleases: number;
  secondaryPresses: number;
  dodgePresses: number;
  /** Ability slot pressed since the last tick (0 = none, -1 = touch POWER). */
  abilitySlot: number;
  /** True when aim comes from a stick direction rather than a pointer position. */
  directional: boolean;
  aimDirX: number;
  aimDirY: number;
  /** Directional mode only: the aim stick is idle. */
  aimIdle: boolean;
}

/**
 * A device adapter (keyboard+mouse, touch, gamepad...). Gameplay code never reads
 * devices directly; it only consumes InputFrame from the InputManager.
 */
export interface InputSource {
  attach(target: HTMLElement, raw: RawInput, emit: (action: InputAction) => void): void;
  detach(): void;
  /** Called once per tick for sources that need polling (gamepads). */
  poll?(raw: RawInput): void;
}

const AIM_STICK_REACH = 170;

export type ScreenToWorld = (x: number, y: number, out: { x: number; y: number }) => void;

export class InputManager {
  readonly raw: RawInput = {
    moveX: 0, moveY: 0, pointerX: 0, pointerY: 0, primaryDown: false,
    primaryPresses: 0, primaryReleases: 0, secondaryPresses: 0, dodgePresses: 0, abilitySlot: 0,
    directional: false, aimDirX: 1, aimDirY: 0, aimIdle: true,
  };
  private readonly frame: InputFrame = {
    moveX: 0, moveY: 0, aimX: 0, aimY: 0, primaryDown: false,
    primaryPressed: false, primaryReleased: false, secondaryPressed: false, dodgePressed: false,
    abilitySlot: 0,
    autoTarget: false, aimAssist: false,
  };
  private readonly sources: InputSource[] = [];
  private readonly listeners: Array<(action: InputAction) => void> = [];
  private readonly world = { x: 0, y: 0 };
  /** Set while a menu is open so held keys do not leak into the room behind it. */
  enabled = true;

  /** True while the player is using touch controls (drives hint text and on-screen buttons). */
  get touch(): boolean {
    return this.raw.directional;
  }

  constructor(private readonly target: HTMLElement) {}

  addSource(source: InputSource): void {
    this.sources.push(source);
    source.attach(this.target, this.raw, (action) => {
      for (const listener of this.listeners) listener(action);
    });
  }

  onAction(listener: (action: InputAction) => void): void {
    this.listeners.push(listener);
  }

  /** Throws away pending edges, e.g. the click that closed a menu. */
  flush(): void {
    const raw = this.raw;
    raw.primaryPresses = raw.primaryReleases = raw.secondaryPresses = raw.dodgePresses = 0;
    raw.abilitySlot = 0;
    raw.primaryDown = false;
  }

  /** Produces the frame for one simulation tick and consumes the pending edges. */
  sample(screenToWorld: ScreenToWorld, originX = 0, originY = 0): InputFrame {
    const raw = this.raw;
    const frame = this.frame;
    for (const source of this.sources) source.poll?.(raw);

    if (raw.directional) {
      // A stick only gives a direction, so the aim point is projected out from the player.
      frame.aimX = originX + raw.aimDirX * AIM_STICK_REACH;
      frame.aimY = originY + raw.aimDirY * AIM_STICK_REACH;
    } else {
      screenToWorld(raw.pointerX, raw.pointerY, this.world);
      frame.aimX = this.world.x;
      frame.aimY = this.world.y;
    }
    frame.autoTarget = raw.directional;
    frame.aimAssist = raw.directional && raw.aimIdle;

    if (!this.enabled) {
      frame.moveX = frame.moveY = 0;
      frame.primaryDown = frame.primaryPressed = frame.primaryReleased = false;
      frame.secondaryPressed = frame.dodgePressed = false;
      frame.abilitySlot = 0;
      this.flush();
      return frame;
    }

    frame.moveX = raw.moveX;
    frame.moveY = raw.moveY;
    frame.primaryPressed = raw.primaryPresses > 0;
    frame.primaryReleased = raw.primaryReleases > 0;
    // A press and release inside one tick still counts as "was down" for that tick.
    frame.primaryDown = raw.primaryDown || (frame.primaryPressed && !frame.primaryReleased);
    frame.secondaryPressed = raw.secondaryPresses > 0;
    frame.dodgePressed = raw.dodgePresses > 0;
    frame.abilitySlot = raw.abilitySlot;
    raw.primaryPresses = raw.primaryReleases = raw.secondaryPresses = raw.dodgePresses = 0;
    raw.abilitySlot = 0;
    return frame;
  }
}
