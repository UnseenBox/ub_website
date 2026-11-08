import type { Boost, Trick } from '../abilities/Cards';
import type { MissKind } from '../goal/GoalDetector';
import type { MechEventKind } from '../mechanics/Mechanic';
import type { Surface } from '../physics/Collider';
import type { AudioManager } from './AudioManager';

/** A major pentatonic ladder. Each bounce of a shot plays the next rung. */
const LADDER = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];
/** Playback speed that raises a recording by the i-th rung of the ladder. */
const rung = (i: number): number => Math.pow(2, LADDER[Math.min(i, LADDER.length - 1)] / 12);
/** A little random detune, so the same recording never sounds identical twice running. */
const vary = (rate = 1, spread = 0.06): number => rate * (1 - spread + Math.random() * spread * 2);

/**
 * Every sound in the game uses asset recordings (assets/sfx / sfx sheet). No synthetic SFX.
 */
export class SoundLibrary {
  private lastBounce = -1;

  constructor(private readonly audio: AudioManager) {}

  /** Call every frame while aiming (no synthetic swell; assets only). */
  pull(power: number, dt: number): void {
    void power;
    void dt;
  }

  aimStart(): void {
    this.audio.play('power_up', { gain: 1 });
  }

  /** Letting go without shooting: the tension just slackens. */
  aimCancel(): void {
    this.audio.play('cloth', { gain: 0.45, rate: vary(0.9) });
  }

  private boom(_strength: number, _at = 0): void {
    /* synthetic SFX removed: assets only */
  }

  /** Boot on leather. */
  kick(power: number): void {
    const a = this.audio;
    if (!a.play('kick_ball', { gain: 0.7 + 0.3 * power, rate: vary(1.0 - 0.06 * power) })) {
      a.play(power > 0.5 ? 'kick' : 'kick_soft', { gain: 0.55 + 0.45 * power, rate: vary(1.05 - 0.12 * power) });
      a.play('thud_soft', { gain: 0.3 + 0.5 * power, rate: vary(0.9) });
      if (power > 0.9) a.play('grit', { gain: 0.22, rate: 0.55, at: 0.01 });
    }
    // The bigger the pull, the more the street shakes under the boot.
    this.boom(0.25 + 0.7 * power);
  }

  /** A soft tick for each step of the power ring. */
  aimStep(step: number): void {
    this.audio.play('tap', { gain: step >= 10 ? 0.34 : 0.13, rate: 1.5 + step * 0.07, variant: 0 });
    if (step >= 10) {
      this.audio.play('glass_tap', { gain: 0.26, rate: 1.8, variant: 0 });
    }
  }

  /** `strength` is 0 to 1. `bounce` is the running count for the pitch ladder (0 = uncounted). */
  bounce(surface: Surface, strength: number, bounce: number, now: number): void {
    // Two faces of a corner can report on the same frame; one sound is enough.
    if (now - this.lastBounce < 0.03) return;
    this.lastBounce = now;
    const a = this.audio;
    const s = strength;
    // The ball itself: every touch has the thump of an inflated ball in it.
    const ball = (gain: number): void => {
      a.play(s > 0.45 ? 'thud' : 'thud_soft', { gain: gain * (0.35 + 0.65 * s), rate: vary(1.25) });
    };

    switch (surface) {
      case 'net':
        a.play('net', { gain: 0.5 + 0.5 * s, rate: vary(0.8) });
        a.play('thud_soft', { gain: 0.25 + 0.3 * s, rate: 0.8 });
        return;
      case 'post':
        ball(0.5);
        a.play('post', { gain: 0.5 + 0.5 * s, rate: vary(0.95) });
        break;
      case 'gate':
        ball(0.6);
        a.play('tin', { gain: 0.5 + 0.5 * s, rate: vary(0.7) });
        break;
      case 'car':
        ball(0.7);
        a.play('metal', { gain: 0.45 + 0.5 * s, rate: vary(0.72) });
        a.play('tin', { gain: 0.2 + 0.3 * s, rate: vary(0.6) });
        break;
      case 'crate':
        ball(0.5);
        a.play('wood', { gain: 0.5 + 0.5 * s, rate: vary(0.95) });
        if (s > 0.5) a.play('plank', { gain: 0.3 * s, at: 0.02 });
        break;
      case 'cat':
        a.play('thud_soft', { gain: 0.5 + 0.4 * s, rate: vary(1.1) });
        this.meow();
        break;
      case 'tyre':
      case 'bumper':
      case 'spinner':
      case 'scooter':
      case 'glass':
      case 'bell':
        // These speak through their own mechanic sound; here only the ball's part.
        ball(0.5);
        break;
      case 'hedge':
        ball(0.5);
        a.play('sand', { gain: 0.3 + 0.3 * s, rate: vary(0.8) });
        break;
      default:
        // Plaster, stone and walls.
        ball(1);
        a.play('stone', { gain: 0.2 + 0.5 * s, rate: vary(0.95) });
        if (s > 0.6) a.play('grit', { gain: 0.25 * s, at: 0.03 });
    }
    // The musical part of a combo: every counted bounce climbs one note.
    if (bounce > 0) a.play('glass_tap', { gain: 0.3, rate: 0.6 * rung(bounce - 1), variant: 0, at: 0.01 });
  }



  /** What each mechanic sounds like when it does its thing. */
  mechanic(kind: MechEventKind, strength: number): void {
    const a = this.audio;
    const s = strength;
    switch (kind) {
      case 'boing':
        // Rubber: the ball's own thump, pitched up, twice in quick succession.
        a.play('thud', { gain: 0.8, rate: 1.7 });
        a.play('kick_soft', { gain: 0.5, rate: 1.45, at: 0.03 });
        break;
      case 'bumper':
        // Pinball: bright, springy, a third higher than a tyre.
        a.play('thud', { gain: 0.9, rate: 2.1 });
        a.play('glass_tap', { gain: 0.5, rate: 1.6, variant: 0, at: 0.02 });
        a.play('kick_soft', { gain: 0.5, rate: 1.8, at: 0.05 });
        this.boom(0.45, 0.005);
        break;
      case 'spin':
        a.play('tin', { gain: 0.7, rate: vary(1.2) });
        a.play('thud', { gain: 0.5, rate: 1.3, at: 0.02 });
        break;
      case 'wind':
        a.play('sand', { gain: 0.6, rate: vary(1.3) });
        a.play('cloth', { gain: 0.5, rate: 1.1, at: 0.04 });
        break;
      case 'pipe':
        // Down the hole, then out of the other one.
        a.play('drop', { gain: 0.8, rate: 0.6, variant: 1 });
        a.play('thud_soft', { gain: 0.5, rate: 0.6, at: 0.05 });
        a.play('kick_soft', { gain: 0.6, rate: 1.3, at: 0.22 });
        break;
      case 'sand':
        a.play('sand', { gain: 0.45 + 0.5 * s, rate: vary(0.9) });
        break;
      case 'smash':
        a.play('glass_break', { gain: 1 });
        a.play('glass_bits', { gain: 0.7, at: 0.05 });
        a.play('glass_tap', { gain: 0.5, at: 0.16, rate: 1.2 });
        a.play('glass_tap', { gain: 0.35, at: 0.27, rate: 1.5 });
        this.boom(0.75, 0.01);
        break;
      case 'clink':
        a.play('glass_tap', { gain: 0.4 + 0.4 * s, rate: vary(1) });
        break;
      case 'bell':
        // Ding, dong: the same bell struck twice, the second a tone lower. Then the shutter.
        a.play('bell', { gain: 0.75, rate: 1.5, variant: 0 });
        a.play('bell', { gain: 0.7, rate: 1.19, variant: 0, at: 0.3 });
        a.play('tin', { gain: 0.35, rate: 0.55, at: 0.15 });
        a.play('tin', { gain: 0.3, rate: 0.5, at: 0.32 });
        break;
      case 'save':
        a.play('thud_soft', { gain: 0.7, rate: 1 });
        this.boom(0.4, 0.005);
        this.meow();
        break;
      case 'burn':
        // Whatever it was, it comes apart: wood, tin and glass all at once, with weight under it.
        a.play('wood', { gain: 1, rate: 0.7 });
        a.play('plank', { gain: 0.8, rate: 0.8, at: 0.02 });
        a.play('metal', { gain: 0.6, rate: 0.5 });
        a.play('thud', { gain: 1, rate: 0.5 });
        a.play('glass_bits', { gain: 0.5, rate: 0.7, at: 0.06 });
        a.play('grit', { gain: 0.6, rate: 0.7, at: 0.12 });
        this.boom(1, 0);
        break;
      case 'magnet':
        a.play('post', { gain: 0.7, rate: 0.6 });
        a.play('bell', { gain: 0.22, rate: 2.2, variant: 0, at: 0.03 });
        break;
      case 'scooter':
        a.play('tin', { gain: 0.6, rate: vary(0.9) });
        a.play('metal', { gain: 0.35, rate: vary(1.1) });
        break;
    }
  }

  /** Mimi's voice (funny Meow.mp3 clip). */
  private meow(at = 0): void {
    this.audio.play('meow', { gain: 1, at });
  }

  /** A duel card picked up or put back. */
  card(on: boolean): void {
    this.audio.play('tap', { gain: 0.8, rate: on ? 1.25 : 0.9 });
    if (on) this.audio.play('click', { gain: 0.6, at: 0.04, variant: 0 });
  }

  /** A boost leaving the boot with the ball. */
  boost(kind: Boost): void {
    const a = this.audio;
    if (kind === 'fire') {
      if (!a.play('boost_fire', { gain: 1 })) {
        a.play('cloth', { gain: 1, rate: 0.5 });
        a.play('sand', { gain: 0.8, rate: 0.55, at: 0.02 });
      }
    } else if (kind === 'magnet') {
      if (!a.play('boost_magnet', { gain: 1 })) {
        a.play('post', { gain: 0.6, rate: 0.5 });
        a.play('bell', { gain: 0.25, rate: 2.5, variant: 0 });
      }
    } else {
      if (!a.play('boost_rubber', { gain: 1 })) {
        a.play('thud', { gain: 0.9, rate: 1.9 });
        a.play('kick_soft', { gain: 0.6, rate: 1.6, at: 0.04 });
      }
    }
  }

  /** A rubber ball landing: the bounce's own sound, with a rubbery pop on top. */
  rubber(): void {
    this.audio.play('thud', { gain: 0.55, rate: vary(1.85) });
    this.audio.play('kick_soft', { gain: 0.35, rate: vary(1.55), at: 0.03 });
  }

  /** A friend's trick turning up in your street. */
  trick(kind: Trick): void {
    const a = this.audio;
    if (kind === 'cat') {
      this.meow();
      this.meow(0.42);
    } else if (kind === 'shutter') {
      a.play('tin', { gain: 0.9, rate: 0.6 });
      a.play('tin', { gain: 0.7, rate: 0.5, at: 0.1 });
      a.play('metal', { gain: 0.6, rate: 0.6, at: 0.22 });
    } else {
      a.play('sand', { gain: 0.9, rate: 0.5 });
      a.play('cloth', { gain: 0.8, rate: 0.45, at: 0.08 });
    }
  }

  /**
   * The ball hits the net: play the goal sting (GOAL.mp3, loaded as the 'goal' clip).
   */
  goal(bounces: number, stars = 0, newBest = false): void {
    void bounces;
    void stars;
    void newBest;
    this.boom(0.55, 0);
    if (!this.audio.play('goal', { gain: 1 })) {
      // Fallback if the clip hasn't loaded: a simple net hit.
      this.audio.play('net', { gain: 0.8, rate: 0.7 });
      this.audio.play('thud_soft', { gain: 0.5, rate: 0.85 });
    }
  }

  /** One knock on wood per line of the score card, like chalking it up. */
  scoreLine(index: number, last: boolean): void {
    this.audio.play('tap', { gain: 0.6, rate: vary(1 + index * 0.05, 0.03) });
    if (last) this.audio.play('wood', { gain: 0.6, rate: 0.9, at: 0.06 });
  }

  /** One clink of glass per star earned, each higher than the last. */
  star(index: number): void {
    const rate = [1, 1.19, 1.41][Math.min(2, index)];
    this.audio.play('glass_tap', { gain: 0.75, rate, variant: 1 });
    this.audio.play('post', { gain: 0.3, rate: rate * 1.5, variant: 0 });
  }

  /** A Kora Coin punched out of the air: two bright taps a step and a half apart. */
  coin(): void {
    this.audio.play('glass_tap', { gain: 0.6, rate: 2.2, variant: 0 });
    this.audio.play('glass_tap', { gain: 0.7, rate: 3.1, at: 0.09, variant: 0 });
    this.audio.play('post', { gain: 0.35, rate: 3.6, at: 0.09, variant: 0 });
  }

  /** Your trap kept the ball out: a short round of applause. */
  saved(): void {
    this.audio.play('applause', { gain: 0.55 });
  }

  /** A duel won: the whole street. */
  win(): void {
    this.audio.play('cheer', { gain: 0.85, variant: 1 });
    this.audio.play('applause', { gain: 0.6, at: 0.4 });
    this.audio.play('cheer', { gain: 0.5, variant: 0, at: 1.1, rate: 0.96 });
  }

  /** A trap piece knocked into place. */
  place(index: number): void {
    this.audio.play('wood', { gain: 0.7, rate: vary(0.85 + index * 0.08, 0.03) });
    this.audio.play('thud_soft', { gain: 0.4, rate: 0.9 });
  }

  /** No jingle for a miss: the ball goes dead, and a wide one gets the whistle. */
  miss(kind: MissKind): void {
    const a = this.audio;
    a.play('thud_soft', { gain: 0.6, rate: 0.7 });
    a.play('thud_soft', { gain: 0.35, rate: 0.62, at: 0.17 });
    a.play('grit', { gain: 0.3, rate: 0.8, at: 0.3 });
    if (kind === 'miss') a.play('whistle', { gain: 0.35, at: 0.25, variant: 0 });
  }

  reset(): void {
    this.audio.play('switch', { gain: 0.4, variant: 1 });
  }

  ui(): void {
    this.audio.play('click', { gain: 0.7, variant: 0 });
  }

  /** Menu/UI button tap. */
  click(): void {
    this.audio.play('click', { gain: 0.85, variant: 0 });
  }
}
