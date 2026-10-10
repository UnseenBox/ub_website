import { FIXED_DT, MAX_FRAME_DT, MAX_STEPS_PER_FRAME } from './constants';

export interface LoopCallbacks {
  /** One fixed simulation step. */
  tick(dt: number): void;
  /** Called once per display frame; alpha is the interpolation factor between the last two ticks. */
  render(alpha: number, frameDt: number): void;
  /** Simulation speed multiplier (slow motion, hit stop). */
  timeScale(): number;
}

/**
 * requestAnimationFrame driver with a fixed-timestep accumulator, so the simulation
 * behaves identically at 30, 60 or 120 FPS.
 */
export class GameLoop {
  fps = 60;
  ticksLastFrame = 0;

  private accumulator = 0;
  private last = 0;
  private running = false;
  private rafId = 0;
  private fpsFrames = 0;
  private fpsTime = 0;
  /** Consecutive simulation errors; the loop gives up only when the sim is truly wedged. */
  private consecutiveErrors = 0;

  constructor(private readonly callbacks: LoopCallbacks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.frame);

    let frameDt = (now - this.last) / 1000;
    this.last = now;
    if (!(frameDt > 0)) frameDt = 0;
    if (frameDt > MAX_FRAME_DT) frameDt = MAX_FRAME_DT;

    this.fpsFrames++;
    this.fpsTime += frameDt;
    if (this.fpsTime >= 0.5) {
      this.fps = this.fpsFrames / this.fpsTime;
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }

    this.accumulator += frameDt * this.callbacks.timeScale();
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      try {
        this.callbacks.tick(FIXED_DT);
        this.consecutiveErrors = 0;
      } catch (error) {
        // One bad tick (a transient interaction edge, a just-removed body) must not
        // freeze the game: skip it and keep the loop alive so the player can continue.
        // Errors are still loud in the console; a wedged sim stops instead of spinning.
        this.consecutiveErrors++;
        console.error(`[loop] simulation tick failed (${this.consecutiveErrors} in a row)`, error);
        if (this.consecutiveErrors > 60) {
          this.stop();
          throw error;
        }
      }
      this.accumulator -= FIXED_DT;
      steps++;
    }
    // Drop the backlog instead of spiralling when the tab was stalled.
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
    this.ticksLastFrame = steps;

    this.callbacks.render(this.accumulator / FIXED_DT, frameDt);
  };
}
