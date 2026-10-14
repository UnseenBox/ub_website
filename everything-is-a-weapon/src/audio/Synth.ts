/** Formant pairs (F1, F2) that make a filtered buzz read as a vowel. */
export const VOWEL = {
  a: [800, 1250],
  ah: [700, 1100],
  o: [480, 850],
  u: [330, 750],
  e: [520, 1850],
  i: [300, 2300],
} as const;
export type Vowel = readonly [number, number];

export interface ToneOptions {
  type?: OscillatorType;
  from: number;
  to?: number;
  dur: number;
  gain: number;
  delay?: number;
  attack?: number;
  vibrato?: { rate: number; depth: number };
}

export interface NoiseOptions {
  filter?: BiquadFilterType;
  from: number;
  to?: number;
  dur: number;
  gain: number;
  q?: number;
  delay?: number;
  attack?: number;
}

export interface VoiceOptions {
  /** Pitch contour in Hz, spread evenly over the duration. */
  pitch: readonly number[];
  dur: number;
  from: Vowel;
  to?: Vowel;
  gain: number;
  delay?: number;
  vibrato?: { rate: number; depth: number };
}

/** One resonant mode of a struck object: frequency ratio, decay time, relative level. */
export type Partial = readonly [ratio: number, decay: number, level: number];

const SILENT = 0.0001;

/**
 * The building blocks every sound in the game is made from. Three ideas do most of the work:
 *  - `modal`  — a struck object rings at a handful of inharmonic frequencies; the ratios and
 *               decay times are what make wood sound like wood and a bin sound like a bin.
 *  - `voice`  — a buzzy source through two moving band-pass filters reads as a mouth shape,
 *               which is how the intruders (and the tenant) get to grunt, yelp and groan.
 *  - `noise`/`tone` — whooshes, thumps, clicks and everything in between.
 */
export class Synth {
  voices = 0;

  constructor(
    readonly ctx: AudioContext,
    readonly out: AudioNode,
    private readonly noiseBuffer: AudioBuffer,
  ) {}

  get now(): number {
    return this.ctx.currentTime;
  }

  private envelope(t: number, attack: number, dur: number, gain: number, dest: AudioNode = this.out): GainNode {
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(SILENT, t);
    env.gain.exponentialRampToValueAtTime(Math.max(SILENT * 2, gain), t + attack);
    env.gain.exponentialRampToValueAtTime(SILENT, t + Math.max(attack + 0.01, dur));
    env.connect(dest);
    return env;
  }

  private release(source: AudioScheduledSourceNode, tail: AudioNode, counted = true): void {
    if (counted) this.voices++;
    source.onended = () => {
      if (counted) this.voices--;
      tail.disconnect();
    };
  }

  tone(o: ToneOptions): void {
    const t = this.now + (o.delay ?? 0);
    const osc = this.ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(Math.max(20, o.from), t);
    if (o.to !== undefined && o.to !== o.from) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + o.dur);
    }
    const env = this.envelope(t, o.attack ?? 0.005, o.dur, o.gain);
    osc.connect(env);
    if (o.vibrato) {
      const lfo = this.ctx.createOscillator();
      const depth = this.ctx.createGain();
      lfo.frequency.value = o.vibrato.rate;
      depth.gain.value = o.vibrato.depth;
      lfo.connect(depth);
      depth.connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + o.dur + 0.03);
    }
    this.release(osc, env);
    osc.start(t);
    osc.stop(t + o.dur + 0.03);
  }

  noise(o: NoiseOptions): void {
    const t = this.now + (o.delay ?? 0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = o.filter ?? 'bandpass';
    filter.Q.value = o.q ?? 1;
    filter.frequency.setValueAtTime(Math.max(30, o.from), t);
    if (o.to !== undefined && o.to !== o.from) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(30, o.to), t + o.dur);
    }
    const env = this.envelope(t, o.attack ?? 0.004, o.dur, o.gain);
    src.connect(filter);
    filter.connect(env);
    this.release(src, env);
    src.start(t, Math.random() * 0.8, o.dur + 0.05);
  }

  /** A struck object: several sine modes, each with its own decay. Counts as one voice. */
  modal(f0: number, partials: readonly Partial[], gain: number, delay = 0, stretch = 1): void {
    const t = this.now + delay;
    for (let i = 0; i < partials.length; i++) {
      const [ratio, decay, level] = partials[i]!;
      const freq = f0 * ratio;
      if (freq > 14000) continue;
      const osc = this.ctx.createOscillator();
      osc.frequency.value = freq;
      const dur = decay * stretch;
      const env = this.envelope(t, 0.002, dur, gain * level);
      osc.connect(env);
      this.release(osc, env, i === 0);
      osc.start(t);
      osc.stop(t + dur + 0.03);
    }
  }

  /** A buzz shaped by two formant filters that can glide between vowels: grunts, yelps, groans. */
  voice(o: VoiceOptions): void {
    const t = this.now + (o.delay ?? 0);
    const to = o.to ?? o.from;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    const steps = o.pitch.length;
    osc.frequency.setValueAtTime(Math.max(30, o.pitch[0] ?? 150), t);
    for (let i = 1; i < steps; i++) {
      osc.frequency.linearRampToValueAtTime(Math.max(30, o.pitch[i]!), t + (o.dur * i) / (steps - 1));
    }
    if (o.vibrato) {
      const lfo = this.ctx.createOscillator();
      const depth = this.ctx.createGain();
      lfo.frequency.value = o.vibrato.rate;
      depth.gain.value = o.vibrato.depth;
      lfo.connect(depth);
      depth.connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + o.dur + 0.03);
    }
    const env = this.envelope(t, 0.012, o.dur, o.gain);
    for (let f = 0; f < 2; f++) {
      const band = this.ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.Q.value = 7;
      band.frequency.setValueAtTime(o.from[f]!, t);
      band.frequency.linearRampToValueAtTime(to[f]!, t + o.dur * 0.85);
      const level = this.ctx.createGain();
      level.gain.value = f === 0 ? 1 : 0.55;
      osc.connect(band);
      band.connect(level);
      level.connect(env);
    }
    this.release(osc, env);
    osc.start(t);
    osc.stop(t + o.dur + 0.03);
  }
}
