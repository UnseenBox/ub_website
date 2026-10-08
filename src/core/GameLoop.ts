/**
 * Fixed-timestep loop. Simulation always advances in equal slices so that
 * awareness, decay and detection never depend on the render frame rate; the
 * renderer gets the leftover fraction for interpolation.
 */

export const FIXED_DT = 1 / 60;
const MAX_FRAME_TIME = 0.25; // Clamp tab-switch spikes instead of fast-forwarding.
const MAX_STEPS_PER_FRAME = 5;

export interface LoopStats {
  fps: number;
  simStepsLastFrame: number;
  frameMs: number;
}

export class GameLoop {
  private rafId = 0;
  private lastTime = 0;
  private accumulator = 0;
  private running = false;
  private fpsAccum = 0;
  private fpsFrames = 0;

  readonly stats: LoopStats = { fps: 0, simStepsLastFrame: 0, frameMs: 0 };

  constructor(
    private readonly step: (dt: number) => void,
    private readonly render: (alpha: number, frameDt: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);

    const frameStart = now;
    let frameDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (!Number.isFinite(frameDt) || frameDt < 0) frameDt = FIXED_DT;
    if (frameDt > MAX_FRAME_TIME) frameDt = MAX_FRAME_TIME;

    this.accumulator += frameDt;

    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      this.step(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) {
      // We are behind; drop the backlog rather than letting it snowball.
      this.accumulator = 0;
    }
    this.stats.simStepsLastFrame = steps;

    this.render(this.accumulator / FIXED_DT, frameDt);

    this.fpsAccum += frameDt;
    this.fpsFrames++;
    if (this.fpsAccum >= 0.5) {
      this.stats.fps = this.fpsFrames / this.fpsAccum;
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }
    this.stats.frameMs = performance.now() - frameStart;
  };
}
