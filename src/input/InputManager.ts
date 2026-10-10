import { KeyboardMouseInput } from './KeyboardMouseInput';
import { TouchInput } from './TouchInput';

/**
 * Abstract actions. Gameplay code never asks "is W down" or "where is the
 * mouse" directly; it asks the manager. That is what lets a touch backend be
 * dropped in later without touching a single gameplay file.
 */
export interface ActionState {
  moveX: number;
  moveY: number;
  sneak: boolean;
  sprint: boolean;
  /** Edge-triggered: true for exactly one simulation step. */
  interact: boolean;
  hide: boolean;
  flashlight: boolean;
  throwBottle: boolean;
  pause: boolean;
  restart: boolean;
  toggleDebug: boolean;
  primary: boolean;
  secondary: boolean;
}

export interface PointerState {
  /** Position in logical game units. */
  x: number;
  y: number;
  /** False when the pointer left the play surface: the CURSOR_LOST case. */
  inside: boolean;
  /** Set on the step a button went down. */
  primaryDown: boolean;
  secondaryDown: boolean;
  primaryHeld: boolean;
  /** True when the device has no hoverable pointer at all (pure touch). */
  coarse: boolean;
}

export interface LogicalPoint {
  x: number;
  y: number;
  inside: boolean;
}

export type PointerMapper = (clientX: number, clientY: number) => LogicalPoint;

export interface InputBackend {
  attach(): void;
  detach(): void;
  /** Fold raw device state into the shared action/pointer records. */
  gather(actions: ActionState, pointer: PointerState): void;
  /** Called after a simulation step so the backend can clear its own edges. */
  endStep(): void;
}

export class InputManager {
  readonly actions: ActionState = {
    moveX: 0,
    moveY: 0,
    sneak: false,
    sprint: false,
    interact: false,
    hide: false,
    flashlight: false,
    throwBottle: false,
    pause: false,
    restart: false,
    toggleDebug: false,
    primary: false,
    secondary: false,
  };

  readonly pointer: PointerState = {
    x: 0,
    y: 0,
    inside: false,
    primaryDown: false,
    secondaryDown: false,
    primaryHeld: false,
    coarse: false,
  };

  private readonly backends: InputBackend[] = [];
  private readonly keyboardMouse: KeyboardMouseInput;

  constructor(
    private readonly surface: HTMLElement,
    mapper: PointerMapper,
  ) {
    this.keyboardMouse = new KeyboardMouseInput(this.surface, mapper);
    this.backends.push(this.keyboardMouse);
    // Touch is attached but intentionally inert on desktop. It exists so the
    // mobile port is a matter of implementing one class.
    this.backends.push(new TouchInput(this.surface, mapper));

    this.pointer.coarse =
      typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  }

  attach(): void {
    for (const b of this.backends) b.attach();
  }

  detach(): void {
    for (const b of this.backends) b.detach();
  }

  /** Collect device state into actions. Call once at the top of a sim step. */
  beginStep(): void {
    const a = this.actions;
    a.moveX = 0;
    a.moveY = 0;
    a.sneak = false;
    a.sprint = false;
    a.interact = false;
    a.hide = false;
    a.flashlight = false;
    a.throwBottle = false;
    a.pause = false;
    a.restart = false;
    a.toggleDebug = false;
    a.primary = false;
    a.secondary = false;

    const p = this.pointer;
    p.primaryDown = false;
    p.secondaryDown = false;

    for (const b of this.backends) b.gather(a, p);

    // Normalise diagonals so a diagonal walk is not faster than a straight one.
    const len = Math.hypot(a.moveX, a.moveY);
    if (len > 1) {
      a.moveX /= len;
      a.moveY /= len;
    }
  }

  endStep(): void {
    for (const b of this.backends) b.endStep();
  }

  /** Used by the pause screen to drop stuck keys when focus is lost. */
  releaseAll(): void {
    this.keyboardMouse.releaseAll();
  }
}
