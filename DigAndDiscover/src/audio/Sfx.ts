/**
 * Tiny synthesized sound effects (Web Audio). No audio files to download,
 * nothing copyrighted. Every call is a silent no-op when audio is muted,
 * unsupported, or still locked by the browser's autoplay policy.
 */

const MASTER_VOLUME = 0.5;
const MUTE_KEY = 'dig-discover-muted';

interface ToneOptions {
  f: number;
  f2?: number;
  type?: OscillatorType;
  dur: number;
  vol: number;
  at?: number;
  attack?: number;
}

interface NoiseOptions {
  dur: number;
  vol: number;
  filter: BiquadFilterType;
  f: number;
  f2?: number;
  q?: number;
  at?: number;
}

export interface SawHandle {
  grind(on: boolean): void;
  stop(): void;
}

const SILENT_SAW: SawHandle = { grind: () => undefined, stop: () => undefined };

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

class SoundFx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private mutedFlag = readMuted();
  private lastDig = 0;
  private readonly unlockHandler = () => this.unlock();

  constructor() {
    window.addEventListener('pointerdown', this.unlockHandler);
    window.addEventListener('keydown', this.unlockHandler);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend().catch(() => undefined);
      else this.ctx.resume().catch(() => undefined);
    });
  }

  get muted(): boolean {
    return this.mutedFlag;
  }

  setMuted(muted: boolean): void {
    this.mutedFlag = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      /* storage unavailable: keep the in-memory setting */
    }
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, this.ctx.currentTime, 0.02);
    }
  }

  /** Must run inside a user gesture for browsers to allow audio. */
  private unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.mutedFlag ? 0 : MASTER_VOLUME;
      this.master.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 1);
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined);
    if (this.ctx.state === 'running') {
      window.removeEventListener('pointerdown', this.unlockHandler);
      window.removeEventListener('keydown', this.unlockHandler);
    }
  }

  private ready(): AudioContext | null {
    if (!this.ctx || !this.master || this.mutedFlag || this.ctx.state !== 'running') return null;
    return this.ctx;
  }

  private envelope(ctx: AudioContext, t0: number, attack: number, dur: number, vol: number): GainNode {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(this.master!);
    return g;
  }

  private tone(o: ToneOptions): void {
    const ctx = this.ready();
    if (!ctx) return;
    const t0 = ctx.currentTime + (o.at ?? 0);
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.dur);
    osc.connect(this.envelope(ctx, t0, o.attack ?? 0.008, o.dur, o.vol));
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.02);
  }

  private noise(o: NoiseOptions): void {
    const ctx = this.ready();
    if (!ctx || !this.noiseBuffer) return;
    const t0 = ctx.currentTime + (o.at ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = o.filter;
    filter.frequency.setValueAtTime(o.f, t0);
    if (o.f2) filter.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.dur);
    filter.Q.value = o.q ?? 0.8;
    src.connect(filter);
    filter.connect(this.envelope(ctx, t0, 0.005, o.dur, o.vol));
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + o.dur + 0.02);
  }

  dig(hitRock: boolean, clang = 0): void {
    const now = performance.now();
    if (now - this.lastDig < 60) return;
    this.lastDig = now;
    const v = 0.85 + Math.random() * 0.3;
    // Harder ground: duller, shorter thud plus a metallic tick. Soft soil stays a soft crunch.
    const hard = Math.max(0, Math.min(1, clang));
    this.noise({ dur: 0.16 - 0.05 * hard, vol: 0.55, filter: 'lowpass', f: (1500 + 1400 * hard) * v, f2: 350 });
    this.tone({ f: (150 + 60 * hard) * v, f2: 55, dur: 0.13, vol: 0.45 });
    if (hard > 0.15) this.tone({ f: (900 + 1700 * hard) * v, dur: 0.05, vol: 0.14 * hard, at: 0.005, type: 'square' });
    if (hitRock) this.tone({ f: 520 * v, f2: 380, type: 'triangle', dur: 0.08, vol: 0.14, at: 0.01 });
  }

  timesUp(): void {
    this.tone({ f: 523, f2: 392, type: 'triangle', dur: 0.25, vol: 0.3, at: 0 });
    this.tone({ f: 392, f2: 262, type: 'triangle', dur: 0.35, vol: 0.25, at: 0.25 });
  }

  newDay(): void {
    this.tone({ f: 523, type: 'triangle', dur: 0.15, vol: 0.22, at: 0 });
    this.tone({ f: 659, type: 'triangle', dur: 0.15, vol: 0.22, at: 0.1 });
    this.tone({ f: 784, type: 'triangle', dur: 0.2, vol: 0.22, at: 0.2 });
    this.tone({ f: 1047, type: 'triangle', dur: 0.3, vol: 0.25, at: 0.35 });
  }

  dayEnd(): void {
    this.tone({ f: 523, type: 'triangle', dur: 0.25, vol: 0.2, at: 0 });
    this.tone({ f: 659, type: 'triangle', dur: 0.25, vol: 0.2, at: 0.15 });
    this.tone({ f: 784, type: 'triangle', dur: 0.4, vol: 0.22, at: 0.3 });
  }

  layerEnter(): void {
    this.noise({ dur: 0.3, vol: 0.25, filter: 'lowpass', f: 200, f2: 60 });
    this.tone({ f: 180, f2: 320, type: 'sine', dur: 0.2, vol: 0.18, at: 0.1 });
  }

  tired(): void {
    this.tone({ f: 230, f2: 150, type: 'triangle', dur: 0.16, vol: 0.18 });
    this.tone({ f: 190, f2: 115, type: 'triangle', dur: 0.2, vol: 0.16, at: 0.1 });
  }

  discover(): void {
    this.noise({ dur: 0.25, vol: 0.45, filter: 'lowpass', f: 1200, f2: 300 });
    this.tone({ f: 523, type: 'triangle', dur: 0.22, vol: 0.2, at: 0.05 });
    this.tone({ f: 784, type: 'triangle', dur: 0.3, vol: 0.2, at: 0.13 });
  }

  collect(): void {
    this.tone({ f: 600, f2: 1250, dur: 0.1, vol: 0.2 });
    this.tone({ f: 1250, dur: 0.14, vol: 0.09, at: 0.06 });
  }

  place(): void {
    this.tone({ f: 140, f2: 70, dur: 0.14, vol: 0.4 });
    this.noise({ dur: 0.09, vol: 0.2, filter: 'lowpass', f: 700 });
  }

  click(): void {
    this.tone({ f: 880, f2: 660, type: 'triangle', dur: 0.06, vol: 0.12 });
  }

  denied(): void {
    this.tone({ f: 200, f2: 160, type: 'triangle', dur: 0.12, vol: 0.12 });
  }

  startSaw(): SawHandle {
    const ctx = this.ready();
    if (!ctx || !this.noiseBuffer) return SILENT_SAW;
    const t0 = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(1, t0 + 0.15);
    out.connect(this.master!);

    const motor = ctx.createOscillator();
    motor.type = 'sawtooth';
    motor.frequency.setValueAtTime(55, t0);
    motor.frequency.exponentialRampToValueAtTime(115, t0 + 0.4);
    const motorFilter = ctx.createBiquadFilter();
    motorFilter.type = 'lowpass';
    motorFilter.frequency.value = 800;
    const motorGain = ctx.createGain();
    motorGain.gain.value = 0.1;
    motor.connect(motorFilter).connect(motorGain).connect(out);

    const grindSrc = ctx.createBufferSource();
    grindSrc.buffer = this.noiseBuffer;
    grindSrc.loop = true;
    const grindFilter = ctx.createBiquadFilter();
    grindFilter.type = 'bandpass';
    grindFilter.frequency.value = 3200;
    grindFilter.Q.value = 1.4;
    const grindGain = ctx.createGain();
    grindGain.gain.value = 0;
    grindSrc.connect(grindFilter).connect(grindGain).connect(out);

    motor.start(t0);
    grindSrc.start(t0);
    let stopped = false;
    return {
      grind: (on: boolean) => {
        if (stopped) return;
        const t = ctx.currentTime;
        grindGain.gain.setTargetAtTime(on ? 0.3 : 0, t, 0.04);
        motor.frequency.setTargetAtTime(on ? 92 : 115, t, 0.08);
      },
      stop: () => {
        if (stopped) return;
        stopped = true;
        const t = ctx.currentTime;
        out.gain.setTargetAtTime(0.0001, t, 0.07);
        motor.stop(t + 0.4);
        grindSrc.stop(t + 0.4);
      },
    };
  }

  reveal(tier: number, dud: boolean): void {
    if (dud) {
      this.tone({ f: 392, f2: 370, type: 'triangle', dur: 0.22, vol: 0.18 });
      this.tone({ f: 311, f2: 260, type: 'triangle', dur: 0.4, vol: 0.18, at: 0.2 });
      return;
    }
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568];
    const count = Math.min(notes.length, 2 + tier);
    for (let i = 0; i < count; i++) {
      this.tone({ f: notes[i], type: 'triangle', dur: 0.35 + (i === count - 1 ? 0.3 : 0), vol: 0.17, at: i * 0.07 });
    }
    if (tier >= 2) this.noise({ dur: 0.7, vol: 0.07, filter: 'highpass', f: 6000, at: 0.05 });
    if (tier >= 3) this.tone({ f: 95, f2: 45, dur: 0.45, vol: 0.4 });
    if (tier >= 4) {
      const t = count * 0.07 + 0.05;
      for (const f of [1046.5, 1318.5, 1568, 2093]) this.tone({ f, type: 'triangle', dur: 1.1, vol: 0.09, at: t, attack: 0.03 });
    }
  }

  sell(): void {
    this.tone({ f: 1568, type: 'square', dur: 0.07, vol: 0.06 });
    this.tone({ f: 2093, type: 'square', dur: 0.22, vol: 0.06, at: 0.07 });
    this.noise({ dur: 0.12, vol: 0.06, filter: 'highpass', f: 5000, at: 0.06 });
  }

  coin(): void {
    this.tone({ f: 1700 + Math.random() * 500, dur: 0.06, vol: 0.06 });
  }
}

export const sfx = new SoundFx();
