/** requestAnimationFrame driver. `advance` lets tests step the game without waiting for frames. */
export class GameLoop {
  private last = 0;
  private handle = 0;
  private running = false;
  /** Smoothed frames per second, for the debug overlay. */
  fps = 60;

  constructor(
    private readonly frame: (dt: number) => void,
    private readonly render: () => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.handle = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.handle);
  }

  /** Runs `seconds` of game time in 60 Hz frames, then draws once. */
  advance(seconds: number): void {
    const frames = Math.max(1, Math.round(seconds * 60));
    for (let i = 0; i < frames; i++) this.frame(1 / 60);
    this.render();
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    // A tab that was hidden comes back with a huge gap; never simulate more than 50 ms of it.
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    if (dt > 0) {
      this.fps += (1 / dt - this.fps) * 0.08;
      this.frame(dt);
      this.render();
    }
    this.handle = requestAnimationFrame(this.tick);
  };
}
