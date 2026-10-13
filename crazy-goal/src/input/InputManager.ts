import type { Command, InputSink } from './InputSink';
import { KeyboardInput } from './KeyboardInput';
import { PointerInput } from './PointerInput';
import { TouchInput } from './TouchInput';

export type { Command } from './InputSink';

export interface PointerSnapshot {
  /** CSS pixels relative to the canvas. */
  x: number;
  y: number;
  down: boolean;
  /** Edges: true for the one frame in which they happened. */
  pressed: boolean;
  released: boolean;
  cancelled: boolean;
  touch: boolean;
}

/**
 * The only place gameplay reads input from. Browser events are folded into a per-frame
 * snapshot, so a press and release that land between two frames are both still seen.
 */
export class InputManager implements InputSink {
  readonly pointer: PointerSnapshot = { x: 0, y: 0, down: false, pressed: false, released: false, cancelled: false, touch: false };
  /** Where the press happened, kept separately because the pointer may move before the frame runs. */
  pressX = 0;
  pressY = 0;
  /** Called on every user gesture; audio uses it to unlock. */
  onGesture: (() => void) | null = null;

  private readonly commands = new Set<Command>();
  private readonly pointerInput: PointerInput;
  private readonly keyboard: KeyboardInput;
  private readonly touch: TouchInput;

  constructor(target: HTMLElement) {
    this.pointerInput = new PointerInput(target, this);
    this.keyboard = new KeyboardInput(this);
    this.touch = new TouchInput(target);
  }

  dispose(): void {
    this.pointerInput.dispose();
    this.keyboard.dispose();
    this.touch.dispose();
  }

  /** True once per key press. */
  consume(command: Command): boolean {
    return this.commands.delete(command);
  }

  endFrame(): void {
    const p = this.pointer;
    p.pressed = false;
    p.released = false;
    p.cancelled = false;
    this.commands.clear();
  }

  pointerDown(x: number, y: number, touch: boolean): void {
    const p = this.pointer;
    p.x = x;
    p.y = y;
    this.pressX = x;
    this.pressY = y;
    p.down = true;
    p.pressed = true;
    p.touch = touch;
  }

  pointerMove(x: number, y: number): void {
    this.pointer.x = x;
    this.pointer.y = y;
  }

  pointerUp(x: number, y: number): void {
    const p = this.pointer;
    p.x = x;
    p.y = y;
    p.down = false;
    p.released = true;
  }

  pointerCancel(): void {
    this.pointer.down = false;
    this.pointer.cancelled = true;
  }

  command(c: Command): void {
    this.commands.add(c);
  }

  gesture(): void {
    this.onGesture?.();
  }
}
