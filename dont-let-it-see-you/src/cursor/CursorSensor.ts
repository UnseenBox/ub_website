import { CURSOR, LIGHT, NOISE, VIEW } from '../core/Tuning';
import { approach, clamp, clamp01, dist, invLerp } from '../core/Mathx';
import type { PointerState } from '../input/InputManager';
import type { AttentionSource } from '../stealth/AttentionSystem';
import type { CursorHistorySample, CursorStateData } from './CursorState';

/**
 * Turns raw pointer events into the clean, smoothed aim signal the game reads.
 * The mouse aims the flashlight and picks interaction targets. Nothing hunts
 * it — it is a tool, never a liability.
 */
export class CursorSensor implements AttentionSource {
  readonly id = 'cursor';
  readonly isReal = true;
  potency = 1;

  readonly data: CursorStateData = {
    x: VIEW.width * 0.5,
    y: VIEW.height * 0.5,
    prevX: VIEW.width * 0.5,
    prevY: VIEW.height * 0.5,
    vx: 0,
    vy: 0,
    speed: 0,
    acceleration: 0,
    headingX: 0,
    headingY: -1,
    distanceMoved: 0,
    timeSinceMove: 0,
    dwellTime: 0,
    dwellAnchorX: VIEW.width * 0.5,
    dwellAnchorY: VIEW.height * 0.5,
    movementIntensity: 0,
    visibility: 1,
    noiseLevel: 0,
    clickCount: 0,
    timeSinceClick: 99,
    lost: false,
    lostTime: 0,
  };

  private readonly history: CursorHistorySample[] = [];
  private historyTimer = 0;
  private lastSpeed = 0;

  // AttentionSource surface. These mirror `data` so enemies read a stable shape.
  get x(): number {
    return this.data.x;
  }
  set x(v: number) {
    this.data.x = v;
  }
  get y(): number {
    return this.data.y;
  }
  set y(v: number) {
    this.data.y = v;
  }
  get speed(): number {
    return this.data.speed;
  }
  set speed(v: number) {
    this.data.speed = v;
  }
  get headingX(): number {
    return this.data.headingX;
  }
  set headingX(v: number) {
    this.data.headingX = v;
  }
  get headingY(): number {
    return this.data.headingY;
  }
  set headingY(v: number) {
    this.data.headingY = v;
  }
  get movementIntensity(): number {
    return this.data.movementIntensity;
  }
  set movementIntensity(v: number) {
    this.data.movementIntensity = v;
  }
  get dwellTime(): number {
    return this.data.dwellTime;
  }
  set dwellTime(v: number) {
    this.data.dwellTime = v;
  }
  get visibility(): number {
    return this.data.visibility;
  }
  set visibility(v: number) {
    this.data.visibility = v;
  }
  get noiseLevel(): number {
    return this.data.noiseLevel;
  }
  set noiseLevel(v: number) {
    this.data.noiseLevel = v;
  }

  reset(x: number, y: number): void {
    const d = this.data;
    d.x = x;
    d.y = y;
    d.prevX = x;
    d.prevY = y;
    d.vx = 0;
    d.vy = 0;
    d.speed = 0;
    d.acceleration = 0;
    d.headingX = 0;
    d.headingY = -1;
    d.distanceMoved = 0;
    d.timeSinceMove = 0;
    d.dwellTime = 0;
    d.dwellAnchorX = x;
    d.dwellAnchorY = y;
    d.movementIntensity = 0;
    d.visibility = 1;
    d.noiseLevel = 0;
    d.clickCount = 0;
    d.timeSinceClick = 99;
    d.lost = false;
    d.lostTime = 0;
    this.history.length = 0;
    this.historyTimer = 0;
    this.lastSpeed = 0;
  }

  update(
    dt: number,
    pointer: PointerState,
    roomTime: number,
    lightAt: (x: number, y: number) => number,
  ): void {
    const d = this.data;

    d.lost = !pointer.inside;
    d.lostTime = d.lost ? d.lostTime + dt : 0;

    d.prevX = d.x;
    d.prevY = d.y;

    if (!d.lost) {
      // Clamp into the play field so a cursor parked on the letterbox border
      // still has a defined, honest position.
      d.x = clamp(pointer.x, 0, VIEW.width);
      d.y = clamp(pointer.y, 0, VIEW.height);
    }

    const rawDx = d.x - d.prevX;
    const rawDy = d.y - d.prevY;
    const stepDistance = Math.hypot(rawDx, rawDy);
    d.distanceMoved += stepDistance;

    // Smooth the instantaneous velocity: raw per-event deltas are far too spiky
    // to drive an enemy's nerves with.
    const instVx = rawDx / dt;
    const instVy = rawDy / dt;
    d.vx = approach(d.vx, instVx, CURSOR.velocitySmoothing, dt);
    d.vy = approach(d.vy, instVy, CURSOR.velocitySmoothing, dt);

    const speed = Math.hypot(d.vx, d.vy);
    d.acceleration = (speed - this.lastSpeed) / dt;
    this.lastSpeed = speed;
    d.speed = speed;

    d.movementIntensity = clamp01(invLerp(CURSOR.stillSpeed, CURSOR.fastSpeed, speed));

    if (speed > CURSOR.stillSpeed) {
      d.timeSinceMove = 0;
      // Heading tracks the direction of travel and *persists* once you stop, so
      // a parked cursor is still aimed at whatever it was last swept toward.
      const inv = 1 / speed;
      const tx = d.vx * inv;
      const ty = d.vy * inv;
      d.headingX = approach(d.headingX, tx, CURSOR.headingSmoothing, dt);
      d.headingY = approach(d.headingY, ty, CURSOR.headingSmoothing, dt);
      const hl = Math.hypot(d.headingX, d.headingY) || 1;
      d.headingX /= hl;
      d.headingY /= hl;
    } else {
      d.timeSinceMove += dt;
    }

    // Dwell: how long the cursor has loitered inside a small circle. Reset the
    // anchor when it wanders out, so slow drifting does not count as holding still.
    if (dist(d.x, d.y, d.dwellAnchorX, d.dwellAnchorY) > CURSOR.dwellRadius) {
      d.dwellAnchorX = d.x;
      d.dwellAnchorY = d.y;
      d.dwellTime = 0;
    } else {
      d.dwellTime += dt;
    }

    const light = lightAt(d.x, d.y);
    d.visibility = LIGHT.minVisibility + (1 - LIGHT.minVisibility) * clamp01(light);

    d.noiseLevel = Math.max(0, d.noiseLevel - NOISE.cursorNoiseDecay * dt);
    d.timeSinceClick += dt;

    this.historyTimer += dt;
    if (this.historyTimer >= CURSOR.historyInterval) {
      this.historyTimer = 0;
      this.history.push({ x: d.x, y: d.y, t: roomTime, speed });
      if (this.history.length > CURSOR.historySamples) this.history.shift();
    }
  }

  registerClick(noise: number): void {
    const d = this.data;
    d.clickCount++;
    d.timeSinceClick = 0;
    d.noiseLevel = Math.max(d.noiseLevel, noise);
  }

  get path(): readonly CursorHistorySample[] {
    return this.history;
  }

  /**
   * The spot the cursor lingered longest in over the recent window. Enemies with
   * memory investigate this instead of where the cursor is *now*, which is what
   * makes laying a false trail work.
   */
  recentAttentionPoint(window: number, roomTime: number, out: { x: number; y: number }): boolean {
    let best = -1;
    let bx = 0;
    let by = 0;
    for (let i = this.history.length - 1; i >= 0; i--) {
      const s = this.history[i];
      if (roomTime - s.t > window) break;
      // Slow samples weigh more: attention is where the cursor hesitated.
      const weight = 1 / (1 + s.speed * 0.01);
      if (weight > best) {
        best = weight;
        bx = s.x;
        by = s.y;
      }
    }
    if (best < 0) return false;
    out.x = bx;
    out.y = by;
    return true;
  }
}
