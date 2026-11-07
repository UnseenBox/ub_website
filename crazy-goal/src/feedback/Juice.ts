import { damp } from '../core/math';
import type { MechEventKind } from '../mechanics/Mechanic';
import type { Surface } from '../physics/Collider';
import { C } from '../rendering/Palette';

/** Words for the thing the ball just did. Kept short so they read at a glance. */
const TRICK_TEXT: Readonly<Partial<Record<MechEventKind, string>>> = {
  boing: 'BOING!',
  bumper: 'PING!',
  spin: 'WHIZZ!',
  wind: 'WHOOSH!',
  pipe: 'PIPE!',
  smash: 'SMASH!',
  bell: 'DING DONG!',
  save: 'MIAOU!',
  scooter: 'BEEP BEEP!',
  burn: 'BOOM!',
  magnet: 'MAGNET!',
  sand: 'SAND!',
};

/** A surface can shout too, when the hit was hard enough. */
const SURFACE_TEXT: Readonly<Partial<Record<Surface, string>>> = {
  car: 'TAXI!',
  crate: 'CRATE!',
  hedge: 'HEDGE!',
  post: 'POST!',
  gate: 'CLANG!',
  wall: 'BAM!',
  kerb: 'BONK!',
  rail: 'CLANK!',
};

/**
 * The running state of the spectacle: screen flash, speed lines, the live combo, the last trick,
 * and the cinematic goal rush. Feedback writes to it; the renderer and HUD read from it.
 */
export class Juice {
  /** Colour and strength of the full-screen flash. */
  flashColor: string = C.white;
  flashAlpha = 0;
  private flashPeak = 0;
  private flashLeft = 0;
  private flashDur = 0.12;

  /** 0 to 1: how much radial speed energy is on screen. */
  speedLines = 0;
  /** 0 to 1: coloured glow around the frame at high combo. */
  edgeGlow = 0;
  /** Live combo count, including the goal: one bounce is x2. */
  combo = 0;
  /** 1 right after the combo goes up, then decaying. Drives the HUD pulse. */
  comboPulse = 0;
  /** The last trick the street performed, and how long ago. */
  trickText = '';
  trickColor: string = C.sun;
  trickT = 99;
  /** 0 to 1: the goal celebration wave. */
  goalRush = 0;
  /** 0 to 1: how far the cinematic goal bars are in. */
  cinematic = 0;
  /** 1 right after a score line lands. The total punches with it. */
  scorePulse = 0;
  /** Per-star pop, for the three stars on the result card. */
  readonly starPulse = [0, 0, 0];
  /** Reduced effects: fewer flashes and shorter shakes. */
  reduced = false;

  reset(): void {
    this.flashAlpha = 0;
    this.flashPeak = 0;
    this.flashLeft = 0;
    this.speedLines = 0;
    this.edgeGlow = 0;
    this.combo = 0;
    this.comboPulse = 0;
    this.trickText = '';
    this.trickT = 99;
    this.goalRush = 0;
    this.cinematic = 0;
    this.scorePulse = 0;
    this.starPulse[0] = this.starPulse[1] = this.starPulse[2] = 0;
  }

  /** The boot lands. Everything gets loud at once. */
  launch(power: number): void {
    this.combo = 0;
    this.trickT = 99;
    this.speedLines = 0.35 + 0.65 * power;
    this.edgeGlow = 0.25 + 0.45 * power;
    this.flashScreen(C.white, 0.05 + 0.08 * power, 0.12);
  }

  /** A counted bounce. `bounce` is the running count from the analyzer. */
  impact(surface: Surface, strength: number, bounce: number, colour: string = C.white): void {
    if (strength > 0.25) this.speedLines = Math.max(this.speedLines, 0.2 + 0.65 * strength);
    if (strength > 0.45) this.edgeGlow = Math.max(this.edgeGlow, 0.2 + 0.6 * strength);
    if (strength > 0.58 && !this.reduced) this.flashScreen(colour, 0.035 + 0.09 * (strength - 0.58), 0.09);
    if (bounce > 0) {
      this.combo = Math.max(this.combo, bounce + 1);
      this.comboPulse = 1;
      const word = SURFACE_TEXT[surface];
      if (word) this.setTrick(word, colour);
    }
  }

  /** The street did something worth naming. */
  mechanic(kind: MechEventKind, strength: number, colour: string = C.sun): void {
    const word = TRICK_TEXT[kind];
    if (word) this.setTrick(word, colour);
    const loud = kind === 'smash' || kind === 'burn' || kind === 'bumper' || kind === 'save';
    if (loud && !this.reduced) this.flashScreen(colour, kind === 'burn' ? 0.14 : 0.09, 0.1);
    this.speedLines = Math.max(this.speedLines, 0.25 + 0.5 * strength);
    this.edgeGlow = Math.max(this.edgeGlow, 0.3 + 0.5 * strength);
  }

  /** The ball is in. This is the loudest the game gets. */
  goal(stars: number, bounces: number): void {
    this.combo = Math.max(this.combo, bounces + 1);
    this.comboPulse = 1;
    this.goalRush = 1;
    this.cinematic = 1;
    this.speedLines = 1;
    this.edgeGlow = 1;
    this.flashScreen(stars >= 3 ? C.sun : C.white, stars >= 3 ? 0.24 : 0.16, 0.2);
  }

  /** A miss does not get fireworks, but a near one still gets a hard camera. */
  miss(near: boolean): void {
    this.speedLines = near ? 0.45 : 0.25;
    this.edgeGlow = 0;
    if (near && !this.reduced) this.flashScreen(C.white, 0.06, 0.08);
  }

  /** Starts the short cinematic push as the ball closes on the goal mouth. */
  approach(): void {
    this.speedLines = Math.max(this.speedLines, 0.5);
    this.edgeGlow = Math.max(this.edgeGlow, 0.4);
  }

  lineLanded(): void {
    this.scorePulse = 1;
  }

  starLanded(index: number): void {
    if (index >= 0 && index < 3) this.starPulse[index] = 1;
  }

  setTrick(text: string, colour: string): void {
    this.trickText = text;
    this.trickColor = colour;
    this.trickT = 0;
  }

  /** `seconds` is how long the flash takes to fade out. */
  flashScreen(colour: string, alpha: number, seconds = 0.12): void {
    if (this.reduced) alpha *= 0.35;
    if (alpha < this.flashAlpha) return;
    this.flashColor = colour;
    this.flashPeak = Math.min(0.35, alpha);
    this.flashAlpha = this.flashPeak;
    this.flashDur = Math.max(0.04, seconds);
    this.flashLeft = this.flashDur;
  }

  /** The colour of the live combo, getting hotter as it climbs. */
  comboColor(): string {
    if (this.combo >= 7) return '#ff4a2f';
    if (this.combo >= 5) return C.terra;
    if (this.combo >= 3) return C.orange;
    return C.sun;
  }

  update(realDt: number): void {
    if (this.flashLeft > 0) {
      this.flashLeft = Math.max(0, this.flashLeft - realDt);
      this.flashAlpha = this.flashPeak * (this.flashLeft / this.flashDur);
    } else {
      this.flashAlpha = 0;
    }
    this.speedLines = damp(this.speedLines, 0, 2.6, realDt);
    this.edgeGlow = damp(this.edgeGlow, 0, 1.8, realDt);
    this.comboPulse = damp(this.comboPulse, 0, 7, realDt);
    this.scorePulse = damp(this.scorePulse, 0, 6, realDt);
    for (let i = 0; i < 3; i++) this.starPulse[i] = damp(this.starPulse[i], 0, 6, realDt);
    this.trickT += realDt;
    this.goalRush = damp(this.goalRush, 0, 1.15, realDt);
    this.cinematic = Math.max(0, this.cinematic - realDt * 0.72);
  }
}
