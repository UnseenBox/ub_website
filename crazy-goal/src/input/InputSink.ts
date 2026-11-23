export type Command = 'restart' | 'pause' | 'mute' | 'debug' | 'confirm' | 'air' | 'bendLeft' | 'bendRight';

/** What the device-specific listeners report. Only InputManager implements it. */
export interface InputSink {
  pointerDown(x: number, y: number, touch: boolean): void;
  pointerMove(x: number, y: number): void;
  pointerUp(x: number, y: number): void;
  pointerCancel(): void;
  command(c: Command): void;
  gesture(): void;
}
