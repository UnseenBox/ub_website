export type SoundName =
  | 'click'
  | 'switch'
  | 'metal'
  | 'glass'
  | 'ring'
  | 'door'
  | 'drawer'
  | 'footstep'
  | 'notice'
  | 'stinger'
  | 'heartbeat'
  | 'breath'
  | 'wake'
  | 'alarm'
  | 'success'
  | 'fail'
  | 'pickup'
  | 'decoy'
  | 'ui';

export interface PlayOptions {
  /** 0..1 */
  gain?: number;
  /** Semitone-ish detune, used so repeated sounds do not phase against each other. */
  pitch?: number;
  /** Stereo position, -1..1. Derived from where in the room the sound happened. */
  pan?: number;
}

/**
 * Every sound in the game is synthesised here. No audio files, no loading screen,
 * and the whole palette stays coherent because it is all built from three
 * ingredients: a noise burst, a sine body, and an envelope.
 */
export class SoundLibrary {
  private readonly noise: AudioBuffer;

  constructor(private readonly ctx: AudioContext) {
    const length = Math.floor(ctx.sampleRate * 1.2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Deterministic noise so the same sound is the same sound every session.
    let seed = 0x2f6e2b1;
    for (let i = 0; i < length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (seed / 0x3fffffff - 1) * 0.8;
    }
    this.noise = buffer;
  }

  play(name: SoundName, dest: AudioNode, opts: PlayOptions = {}): void {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const gain = opts.gain ?? 1;
    const pitch = opts.pitch ?? 1;

    const out = ctx.createGain();
    out.gain.value = gain;
    if (opts.pan !== undefined && typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, opts.pan));
      out.connect(panner);
      panner.connect(dest);
    } else {
      out.connect(dest);
    }

    switch (name) {
      case 'click':
        this.burst(out, t, 0.035, 2600 * pitch, 0.5, 'highpass');
        break;
      case 'ui':
        this.tone(out, t, 'sine', 880 * pitch, 0.05, 0.12);
        break;
      case 'switch':
        this.burst(out, t, 0.04, 1800 * pitch, 0.55, 'bandpass');
        this.tone(out, t + 0.02, 'triangle', 150 * pitch, 0.1, 0.25);
        break;
      case 'metal':
        this.burst(out, t, 0.09, 3200 * pitch, 0.4, 'bandpass');
        this.tone(out, t, 'square', 420 * pitch, 0.16, 0.12);
        this.tone(out, t + 0.01, 'sine', 1180 * pitch, 0.25, 0.08);
        break;
      case 'glass':
        this.burst(out, t, 0.14, 5200, 0.6, 'highpass');
        for (let i = 0; i < 5; i++) {
          this.tone(out, t + i * 0.012, 'sine', (2200 + i * 740) * pitch, 0.3 - i * 0.04, 0.09);
        }
        break;
      case 'ring':
        for (let i = 0; i < 4; i++) {
          const when = t + i * 0.1;
          this.tone(out, when, 'square', (i % 2 === 0 ? 920 : 760) * pitch, 0.08, 0.1);
        }
        break;
      case 'door':
        this.sweep(out, t, 220, 90, 0.45, 0.14, 'sawtooth');
        this.burst(out, t, 0.2, 700, 0.18, 'lowpass');
        break;
      case 'drawer':
        this.burst(out, t, 0.22, 900 * pitch, 0.26, 'bandpass');
        this.tone(out, t + 0.16, 'triangle', 110, 0.1, 0.2);
        break;
      case 'footstep':
        this.burst(out, t, 0.05, 420 * pitch, 0.25, 'lowpass');
        break;
      case 'pickup':
        this.tone(out, t, 'sine', 1180 * pitch, 0.1, 0.16);
        this.tone(out, t + 0.06, 'sine', 1560 * pitch, 0.12, 0.12);
        break;
      case 'decoy':
        this.sweep(out, t, 600, 1500, 0.3, 0.1, 'sine');
        this.burst(out, t, 0.18, 2400, 0.14, 'bandpass');
        break;
      case 'notice':
        // The sound of being seen: a single struck note and a held breath.
        this.tone(out, t, 'sine', 196, 0.9, 0.3);
        this.tone(out, t, 'sine', 294, 0.7, 0.14);
        this.burst(out, t, 0.5, 300, 0.1, 'lowpass');
        break;
      case 'stinger':
        this.sweep(out, t, 520, 70, 0.9, 0.3, 'sawtooth');
        this.burst(out, t, 0.6, 1800, 0.22, 'bandpass');
        break;
      case 'heartbeat':
        this.tone(out, t, 'sine', 62, 0.12, 0.85);
        this.tone(out, t + 0.16, 'sine', 54, 0.1, 0.5);
        break;
      case 'breath':
        this.burst(out, t, 0.55, 900, 0.1, 'bandpass');
        break;
      case 'wake':
        this.sweep(out, t, 90, 420, 0.5, 0.26, 'triangle');
        this.burst(out, t, 0.4, 2600, 0.18, 'highpass');
        break;
      case 'alarm':
        for (let i = 0; i < 3; i++) {
          this.tone(out, t + i * 0.18, 'square', i % 2 ? 660 : 880, 0.14, 0.18);
        }
        break;
      case 'success':
        [392, 523, 659].forEach((f, i) => {
          this.tone(out, t + i * 0.08, 'sine', f, 0.6, 0.14);
        });
        break;
      case 'fail':
        this.sweep(out, t, 180, 48, 1.4, 0.26, 'sawtooth');
        this.burst(out, t, 1, 240, 0.12, 'lowpass');
        break;
    }
  }

  private tone(
    dest: AudioNode,
    when: number,
    type: OscillatorType,
    freq: number,
    duration: number,
    peak: number,
  ): void {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(peak, when + Math.min(0.012, duration * 0.3));
    env.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(env);
    env.connect(dest);
    osc.start(when);
    osc.stop(when + duration + 0.05);
  }

  private sweep(
    dest: AudioNode,
    when: number,
    fromFreq: number,
    toFreq: number,
    duration: number,
    peak: number,
    type: OscillatorType,
  ): void {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    osc.type = type;
    osc.frequency.setValueAtTime(fromFreq, when);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, toFreq), when + duration);
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(peak, when + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(filter);
    filter.connect(env);
    env.connect(dest);
    osc.start(when);
    osc.stop(when + duration + 0.05);
  }

  private burst(
    dest: AudioNode,
    when: number,
    duration: number,
    cutoff: number,
    peak: number,
    filterType: BiquadFilterType,
  ): void {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 1;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = cutoff;
    filter.Q.value = filterType === 'bandpass' ? 1.6 : 0.7;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(peak, when + Math.min(0.008, duration * 0.25));
    env.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    src.connect(filter);
    filter.connect(env);
    env.connect(dest);
    src.start(when, Math.random() * 0.4);
    src.stop(when + duration + 0.02);
  }

  /** A sustained filtered-noise source, used for the radio and for room air. */
  createBed(cutoff: number, q: number): { input: GainNode; stop: () => void } {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = cutoff;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter);
    filter.connect(gain);
    src.start();
    return {
      input: gain,
      stop: () => {
        try {
          src.stop();
        } catch {
          // Already stopped. Nothing to do.
        }
      },
    };
  }
}
