import { lerp } from './math';

/** Turns real frame time into game time: hit-stop freezes it, slow motion stretches it. */
export class Time {
  private freeze = 0;
  private slowLeft = 0;
  private slowTotal = 1;
  private slowScale = 1;
  /** Real seconds since boot; drives idle animation that should not freeze. */
  elapsed = 0;
  scale = 1;

  hitStop(seconds: number): void {
    if (seconds > this.freeze) this.freeze = seconds;
  }

  slowMo(scale: number, seconds: number): void {
    this.slowScale = scale;
    this.slowLeft = seconds;
    this.slowTotal = seconds;
  }

  clear(): void {
    this.freeze = 0;
    this.slowLeft = 0;
    this.scale = 1;
  }

  step(realDt: number): number {
    this.elapsed += realDt;
    if (this.freeze > 0) {
      this.freeze -= realDt;
      this.scale = 0;
      return 0;
    }
    if (this.slowLeft > 0) {
      this.slowLeft -= realDt;
      // Hold the slow speed, then ease back to full speed over the last 40%.
      const left = Math.max(0, this.slowLeft) / this.slowTotal;
      this.scale = left > 0.4 ? this.slowScale : lerp(1, this.slowScale, left / 0.4);
    } else {
      this.scale = 1;
    }
    return realDt * this.scale;
  }
}
