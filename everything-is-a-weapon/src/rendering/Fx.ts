import type { SoundKind } from '../objects/Materials';

/** A comic-book impact burst: a spiky panel with a sound word in it. */
export interface Burst {
  word: string;
  x: number;
  y: number;
  life: number;
  max: number;
  size: number;
  color: string;
  tilt: number;
  seed: number;
}

/** An expanding shockwave ring on the floor. */
export interface Ring {
  x: number;
  y: number;
  from: number;
  to: number;
  life: number;
  max: number;
  color: string;
  width: number;
}

const IMPACT_WORDS: Readonly<Record<SoundKind, readonly string[]>> = {
  wood: ['THWACK!', 'WHACK!', 'CRACK!'],
  metal: ['CLANG!', 'BONG!', 'KLONK!'],
  glass: ['TINK!', 'KSSH!'],
  plastic: ['CLACK!', 'THUNK!'],
  rubber: ['BOING!', 'BOINK!'],
  paper: ['FWAP!', 'PAF!'],
  soft: ['BONK!', 'OOF!'],
};

export function impactWord(kind: SoundKind): string {
  const words = IMPACT_WORDS[kind];
  return words[Math.floor(Math.random() * words.length)]!;
}

const MAX_BURSTS = 6;
const MAX_RINGS = 24;
const BURST_GAP = 0.14;

/**
 * Screen-space-free visual feedback that is not a particle: sound-word bursts, shockwave
 * rings and full-screen flashes. Purely cosmetic and advanced in real time, so they keep
 * moving through slow motion and hit-stop.
 */
export class Fx {
  readonly bursts: Burst[] = [];
  readonly rings: Ring[] = [];
  flashAlpha = 0;
  flashColor = '#ffffff';
  private sinceBurst = 1;
  private lastWord = '';

  clear(): void {
    this.bursts.length = 0;
    this.rings.length = 0;
    this.flashAlpha = 0;
  }

  /** `size` is roughly 0.6 (a tap) to 1.6 (an explosion). Bursts are rate-limited so they stay special. */
  burst(word: string, x: number, y: number, size = 1, color = '#ffd23f', force = false): void {
    if (!force && (this.sinceBurst < BURST_GAP || (word === this.lastWord && this.sinceBurst < 0.5))) return;
    this.sinceBurst = 0;
    this.lastWord = word;
    if (this.bursts.length >= MAX_BURSTS) this.bursts.shift();
    const life = 0.5 + size * 0.22;
    this.bursts.push({
      word, x, y, life, max: life, size, color,
      tilt: (Math.random() - 0.5) * 0.5,
      seed: Math.random() * 100,
    });
  }

  ring(x: number, y: number, from: number, to: number, seconds = 0.35, color = 'rgba(255,255,255,0.8)', width = 3): void {
    if (this.rings.length >= MAX_RINGS) this.rings.shift();
    this.rings.push({ x, y, from, to, life: seconds, max: seconds, color, width });
  }

  flash(color: string, amount: number): void {
    if (amount < this.flashAlpha) return;
    this.flashColor = color;
    this.flashAlpha = amount;
  }

  update(dt: number): void {
    this.sinceBurst += dt;
    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.6);
    let write = 0;
    for (let i = 0; i < this.bursts.length; i++) {
      const b = this.bursts[i]!;
      b.life -= dt;
      if (b.life > 0) this.bursts[write++] = b;
    }
    this.bursts.length = write;
    write = 0;
    for (let i = 0; i < this.rings.length; i++) {
      const r = this.rings[i]!;
      r.life -= dt;
      if (r.life > 0) this.rings[write++] = r;
    }
    this.rings.length = write;
  }
}
