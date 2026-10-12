import type { AudioManager } from './AudioManager';
import type { Synth } from './Synth';

/**
 * The pets' voices. Still synthesised — there are no audio files in the game — but built
 * the way the animals make them rather than as cartoon blips:
 *
 *  - a throat: a buzzy source whose pitch follows a contour (a meow rises and falls, a bark
 *    snaps up and drops);
 *  - a mouth: three resonances that move as it opens and closes (that movement is what
 *    turns a tone into "mi-a-ow");
 *  - breath mixed in through the same mouth, and roughness (fast amplitude flutter) for
 *    everything that growls, rasps or purrs.
 */

interface Formant {
  /** Centre frequency over the call, evenly spaced keyframes in Hz. */
  readonly f: readonly number[];
  readonly q: number;
  readonly level: number;
}

interface Call {
  /** Fundamental over the call, evenly spaced keyframes in Hz. */
  readonly pitch: readonly number[];
  readonly dur: number;
  readonly gain: number;
  readonly formants: readonly Formant[];
  readonly delay?: number;
  readonly wave?: OscillatorType;
  /** Loudness over the call, 0..1, evenly spaced. Default: quick in, hold, fade. */
  readonly shape?: readonly number[];
  /** Breath: noise through the same mouth, relative to the voiced part. */
  readonly breath?: number;
  /** Flutter in loudness: what makes a growl a growl. */
  readonly rough?: { readonly rate: number; readonly depth: number };
  readonly vibrato?: { readonly rate: number; readonly depth: number };
}

const DEFAULT_SHAPE = [0, 1, 0.9, 0.8, 0.45, 0] as const;
const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buffer);
  }
  return buffer;
}

/** A curve needs at least two points and every value above zero. */
function curve(values: readonly number[], scale = 1, floor = 0.0001): Float32Array {
  const points = values.length >= 2 ? values : [values[0] ?? 1, values[0] ?? 1];
  return Float32Array.from(points, (v) => Math.max(floor, v * scale));
}

function call(s: Synth, o: Call): void {
  const ctx = s.ctx;
  const t = s.now + (o.delay ?? 0) + 0.005;
  const end = t + o.dur;

  const osc = ctx.createOscillator();
  osc.type = o.wave ?? 'sawtooth';
  osc.frequency.setValueCurveAtTime(curve(o.pitch, 1, 20), t, o.dur);

  const throat = ctx.createGain();
  throat.gain.value = 1;
  osc.connect(throat);

  let breath: AudioBufferSourceNode | null = null;
  if (o.breath) {
    breath = ctx.createBufferSource();
    breath.buffer = noiseBuffer(ctx);
    breath.loop = true;
    const level = ctx.createGain();
    level.gain.value = o.breath;
    breath.connect(level);
    level.connect(throat);
  }

  const mouth = ctx.createGain();
  mouth.gain.value = 1;
  for (const formant of o.formants) {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = formant.q;
    band.frequency.setValueCurveAtTime(curve(formant.f, 1, 40), t, o.dur);
    const level = ctx.createGain();
    level.gain.value = formant.level;
    throat.connect(band);
    band.connect(level);
    level.connect(mouth);
  }

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, s.now);
  env.gain.setValueCurveAtTime(curve(o.shape ?? DEFAULT_SHAPE, o.gain), t, o.dur);
  mouth.connect(env);
  env.connect(s.out);

  const helpers: OscillatorNode[] = [];
  if (o.rough) {
    // mouth gain swings between (1 - depth) and 1
    mouth.gain.value = 1 - o.rough.depth / 2;
    const lfo = ctx.createOscillator();
    lfo.type = 'triangle';
    lfo.frequency.value = o.rough.rate;
    const depth = ctx.createGain();
    depth.gain.value = o.rough.depth / 2;
    lfo.connect(depth);
    depth.connect(mouth.gain);
    helpers.push(lfo);
  }
  if (o.vibrato) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = o.vibrato.rate;
    const depth = ctx.createGain();
    depth.gain.value = o.vibrato.depth;
    lfo.connect(depth);
    depth.connect(osc.frequency);
    helpers.push(lfo);
  }

  s.voices++;
  osc.onended = () => {
    s.voices--;
    env.disconnect();
  };
  osc.start(t);
  osc.stop(end + 0.03);
  for (const helper of helpers) {
    helper.start(t);
    helper.stop(end + 0.03);
  }
  if (breath) {
    breath.start(t, Math.random() * 0.5);
    breath.stop(end + 0.03);
  }
}

const vary = (spread: number): number => 1 - spread / 2 + Math.random() * spread;
const scaled = (values: readonly number[], k: number): number[] => values.map((v) => v * k);

// ───────────────────────── cat ─────────────────────────

export function meow(audio: AudioManager, mood: 'hello' | 'scared' | 'war' = 'hello'): void {
  // A real meow when one is decoded; the synth below is the offline fallback.
  if (mood === 'war') {
    if (audio.burstSamples('cat', 2, 0.35, { gain: 0.55, rate: 0.85 })) return;
  } else if (
    audio.sample('cat', { gain: 0.55, rate: (mood === 'scared' ? 1.2 : 1) * vary(0.1), key: `cat:${mood}`, gap: 0.3 })
  ) {
    return;
  }
  const s = audio.synth(`cat:${mood}`, 0.3);
  if (!s) return;
  const k = vary(0.14);
  if (mood === 'hello') {
    // "mi-a-ow": the pitch arches while the mouth opens wide and closes again
    call(s, {
      pitch: scaled([520, 690, 760, 700, 590, 470], k),
      dur: 0.5 + Math.random() * 0.18,
      gain: 0.46,
      shape: [0, 0.5, 1, 0.95, 0.6, 0.25, 0],
      breath: 0.04,
      vibrato: { rate: 6, depth: 9 },
      formants: [
        { f: [380, 700, 1100, 1000, 650, 420], q: 5, level: 1 },
        { f: [2500, 2200, 1800, 1500, 1200, 950], q: 7, level: 0.7 },
        { f: [3600, 3500, 3300, 3100], q: 8, level: 0.25 },
      ],
    });
  } else if (mood === 'scared') {
    // a screech: straight up, mouth wide, rasping
    call(s, {
      pitch: scaled([620, 980, 1250, 1300, 1150, 900], k),
      dur: 0.55,
      gain: 0.36,
      shape: [0, 1, 1, 0.9, 0.6, 0],
      breath: 0.12,
      rough: { rate: 38, depth: 0.5 },
      formants: [
        { f: [800, 1200, 1350, 1300, 1000], q: 5, level: 1 },
        { f: [2300, 2700, 2900, 2700, 2300], q: 6, level: 0.8 },
        { f: [3800, 4200, 4000], q: 8, level: 0.3 },
      ],
    });
  } else {
    // the long warning cats give before a fight: a growl that winds up into a yowl
    call(s, {
      pitch: scaled([210, 240, 300, 430, 600, 520, 300], k),
      dur: 1.05,
      gain: 0.46,
      shape: [0, 0.6, 0.8, 1, 1, 0.7, 0],
      breath: 0.1,
      rough: { rate: 27, depth: 0.65 },
      formants: [
        { f: [450, 550, 700, 950, 1050, 800, 500], q: 4, level: 1 },
        { f: [1100, 1300, 1600, 1900, 2000, 1500, 1000], q: 6, level: 0.7 },
        { f: [3000, 3200, 3400, 3000], q: 8, level: 0.2 },
      ],
    });
  }
}

export function hiss(audio: AudioManager): void {
  const s = audio.synth('cat:hiss', 0.25);
  if (!s) return;
  // the spit at the front, then air through teeth
  s.noise({ filter: 'bandpass', from: 2800, dur: 0.045, gain: 0.22, q: 1.4 });
  s.noise({ filter: 'bandpass', from: 6200, to: 4400, dur: 0.6, gain: 0.24, q: 0.7, attack: 0.05, delay: 0.02 });
  s.noise({ filter: 'highpass', from: 7500, dur: 0.5, gain: 0.1, attack: 0.06, delay: 0.02 });
}

export function scratch(audio: AudioManager): void {
  const s = audio.synth('cat:scratch', 0.07);
  if (!s) return;
  // claws on cardboard: three quick rips, each a little lower
  const f = 2200 + Math.random() * 1200;
  for (let i = 0; i < 3; i++) {
    s.noise({ filter: 'bandpass', from: f * (1.5 - i * 0.2), to: f * (0.8 - i * 0.1), dur: 0.035, gain: 0.2 - i * 0.03, q: 2.2, delay: i * 0.028 });
  }
}

export function purr(audio: AudioManager): void {
  const s = audio.synth('cat:purr', 1.6);
  if (!s) return;
  // about 26 pulses a second, louder on the breath in than the breath out
  call(s, {
    pitch: [26, 25, 27, 24, 26],
    dur: 1.5,
    gain: 0.34,
    shape: [0, 1, 0.75, 0.3, 0.85, 1, 0.5, 0],
    breath: 0.02,
    formants: [
      { f: [210, 240, 210], q: 1.2, level: 0.7 },
      { f: [460, 520, 460], q: 2, level: 1 },
      { f: [1100, 1100], q: 3, level: 0.3 },
    ],
  });
}

// ───────────────────────── dog ─────────────────────────

function yap(s: Synth, delay: number, k: number, gain: number): void {
  // a small dog: snaps up, drops, and half of it is air
  call(s, {
    pitch: scaled([430, 640, 560, 360], k),
    dur: 0.15,
    gain,
    delay,
    shape: [0, 1, 0.85, 0.4, 0],
    breath: 0.3,
    rough: { rate: 75, depth: 0.4 },
    formants: [
      { f: [650, 1100, 1000, 650], q: 3.5, level: 1 },
      { f: [1500, 2100, 1800, 1300], q: 5, level: 0.8 },
      { f: [3000, 3300, 2800], q: 6, level: 0.3 },
    ],
  });
  s.noise({ filter: 'lowpass', from: 420, to: 140, dur: 0.05, gain: gain * 0.25, delay });
}

export function bark(audio: AudioManager, growl: boolean): void {
  // A real bark when decoded (slowed down for a growl); synth fallback below.
  if (growl) {
    if (audio.sample('dog', { gain: 0.8, rate: 0.62, key: 'dog', gap: 0.12 })) return;
  } else {
    const k = vary(0.16);
    if (audio.sample('dog', { gain: 0.6, rate: k, key: 'dog', gap: 0.12 })) {
      if (Math.random() < 0.6) {
        audio.sample('dog', { gain: 0.5, rate: k * 0.94, delay: 0.19 + Math.random() * 0.04, key: 'dog:2' });
      }
      return;
    }
  }
  const s = audio.synth('dog', 0.12);
  if (!s) return;
  const k = vary(0.16);
  if (growl) {
    // low in the chest and rattling, then the snap
    call(s, {
      pitch: scaled([92, 104, 98, 116, 108, 96], k),
      dur: 0.75,
      gain: 0.5,
      shape: [0, 0.7, 1, 0.9, 1, 0.8, 0],
      breath: 0.16,
      rough: { rate: 23, depth: 0.8 },
      formants: [
        { f: [380, 460, 420, 520, 440], q: 3, level: 1 },
        { f: [950, 1150, 1050, 1300, 1000], q: 4, level: 0.7 },
        { f: [2400, 2600, 2400], q: 6, level: 0.2 },
      ],
    });
    yap(s, 0.78, k * 0.9, 0.6);
    return;
  }
  yap(s, 0, k, 0.6);
  if (Math.random() < 0.6) yap(s, 0.19 + Math.random() * 0.04, k * 0.94, 0.5);
}

// ───────────────────────── parrot ─────────────────────────

function screech(s: Synth, delay: number, k: number, dur: number, gain: number): void {
  call(s, {
    pitch: scaled([950, 1500, 1750, 1650, 1250], k),
    dur,
    gain,
    delay,
    shape: [0, 1, 1, 0.85, 0.5, 0],
    breath: 0.22,
    rough: { rate: 88, depth: 0.75 },
    formants: [
      { f: [1500, 2100, 2300, 2000, 1600], q: 4, level: 1 },
      { f: [2900, 3500, 3700, 3300, 2900], q: 5, level: 0.9 },
      { f: [5200, 5600, 5200], q: 6, level: 0.3 },
    ],
  });
}

export function squawk(audio: AudioManager): void {
  // A real tropical squawk when decoded (usually twice, like a macaw).
  const k = vary(0.16);
  if (audio.sample('parrot', { gain: 0.55, rate: k, key: 'parrot', gap: 0.3 })) {
    if (Math.random() < 0.55) {
      audio.sample('parrot', { gain: 0.45, rate: k * 1.06, delay: 0.36, key: 'parrot:2' });
    }
    return;
  }
  const s = audio.synth('parrot', 0.3);
  if (!s) return;
  // a macaw: loud, rasping, and usually twice
  screech(s, 0, k, 0.26 + Math.random() * 0.1, 0.34);
  if (Math.random() < 0.55) screech(s, 0.36, k * 1.06, 0.2, 0.28);
}

// ───────────────────────── hamster ─────────────────────────

export function hamsterSqueak(audio: AudioManager, alarm = false): void {
  // A real rodent squeak burst when decoded; an alarmed hamster does more, faster.
  if (audio.burstSamples('hamster', alarm ? 4 : 2 + Math.floor(Math.random() * 2), alarm ? 0.06 : 0.085, { gain: 0.5 })) {
    return;
  }
  const s = audio.synth('hamster', 0.15);
  if (!s) return;
  // tiny, very high chirps in a burst; an alarmed hamster does more of them, faster
  const count = alarm ? 4 : 2 + Math.floor(Math.random() * 2);
  const gap = alarm ? 0.06 : 0.085;
  for (let i = 0; i < count; i++) {
    const f = (3100 + Math.random() * 500) * (alarm ? 1.15 : 1);
    s.tone({ type: 'sine', from: f, to: f * 1.45, dur: 0.045, gain: 0.12, attack: 0.004, delay: i * gap });
    s.tone({ type: 'sine', from: f * 2, to: f * 2.9, dur: 0.04, gain: 0.03, attack: 0.004, delay: i * gap });
  }
}
