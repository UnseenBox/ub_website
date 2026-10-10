import { FEEL, VIEW } from '../core/Tuning';
import { clamp01 } from '../core/Mathx';
import type { Settings } from '../save/SaveManager';
import { SoundLibrary, type PlayOptions, type SoundName } from './SoundLibrary';

/**
 * Audio, built so that dread is the default state.
 *
 * The background score is generative dark ambient: a low D-minor drone that
 * breathes through a wandering filter, with distant chapel bells surfacing
 * every few bars — sparser when calm, closer together when hunted. A heartbeat
 * only exists near real danger. Everything respects the browser's autoplay
 * rules: nothing is created until the player has interacted with the page.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private library: SoundLibrary | null = null;

  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private ambienceBus: GainNode | null = null;

  private droneRoot: OscillatorNode | null = null;
  private droneBeating: OscillatorNode | null = null;
  private extraDrones: OscillatorNode[] = [];
  private droneGain: GainNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private airBed: { input: GainNode; stop: () => void } | null = null;
  private radioBed: { input: GainNode; stop: () => void } | null = null;

  private heartTimer = 0;
  private breathTimer = 4;
  private hymnTimer = 6;
  private lfoPhase = 0;
  private tension = 0;
  private available = true;

  private settings: Settings;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  applySettings(settings: Settings): void {
    this.settings = settings;
    if (!this.master || !this.sfxBus || !this.ambienceBus) return;
    this.master.gain.value = settings.masterVolume;
    this.sfxBus.gain.value = settings.effectsVolume;
    this.ambienceBus.gain.value = settings.ambienceVolume;
  }

  /** Must be called from a real user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (this.ctx || !this.available) return;
    try {
      const Ctor: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        this.available = false;
        return;
      }
      const ctx = new Ctor();
      this.ctx = ctx;
      this.library = new SoundLibrary(ctx);

      this.master = ctx.createGain();
      this.master.gain.value = this.settings.masterVolume;
      this.master.connect(ctx.destination);

      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = this.settings.effectsVolume;
      this.sfxBus.connect(this.master);

      this.ambienceBus = ctx.createGain();
      this.ambienceBus.gain.value = this.settings.ambienceVolume;
      this.ambienceBus.connect(this.master);

      this.buildAmbience();
    } catch (err) {
      // No audio is a degraded experience, not a broken one.
      console.warn('[audio] unavailable', err);
      this.available = false;
      this.ctx = null;
    }
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  get ready(): boolean {
    return this.ctx !== null;
  }

  private buildAmbience(): void {
    const ctx = this.ctx;
    const bus = this.ambienceBus;
    const lib = this.library;
    if (!ctx || !bus || !lib) return;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    filter.Q.value = 1.2;
    this.droneFilter = filter;

    const gain = ctx.createGain();
    gain.gain.value = 0.07;
    this.droneGain = gain;

    // D minor weight: root D2, a beating detuned twin, a quiet fifth A2,
    // and a sub D1 you feel more than hear.
    const root = ctx.createOscillator();
    root.type = 'sine';
    root.frequency.value = 73.42;
    const beating = ctx.createOscillator();
    beating.type = 'sine';
    beating.frequency.value = 73.9;
    const fifthGain = ctx.createGain();
    fifthGain.gain.value = 0.32;
    const fifth = ctx.createOscillator();
    fifth.type = 'triangle';
    fifth.frequency.value = 110;
    fifth.connect(fifthGain);
    fifthGain.connect(filter);
    const subGain = ctx.createGain();
    subGain.gain.value = 0.5;
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 36.71;
    sub.connect(subGain);
    subGain.connect(filter);

    root.connect(filter);
    beating.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    root.start();
    beating.start();
    fifth.start();
    sub.start();
    this.droneRoot = root;
    this.droneBeating = beating;
    this.extraDrones = [fifth, sub];

    this.airBed = lib.createBed(320, 0.5);
    this.airBed.input.gain.value = 0.02;
    this.airBed.input.connect(bus);
  }

  /**
   * Called every simulation step. Tension shapes the room tone; the heartbeat
   * only exists above the danger threshold, and it leaves as quietly as it came.
   */
  update(dt: number, tension: number, danger: number, radioOn: boolean): void {
    if (!this.ctx || !this.droneGain || !this.droneFilter) return;
    this.tension += (clamp01(tension) - this.tension) * Math.min(1, dt * 1.6);

    // The drone breathes: gain swells with tension, filter opens and closes on a
    // slow LFO (0.08 Hz) so the room never feels static.
    const target = 0.06 + this.tension * 0.16;
    this.droneGain.gain.value += (target - this.droneGain.gain.value) * Math.min(1, dt * 1.8);
    this.lfoPhase += dt * 0.08 * Math.PI * 2;
    const lfo = Math.sin(this.lfoPhase) * (0.06 + this.tension * 0.1);
    const baseCutoff = 180 + this.tension * 480;
    const cutoff = baseCutoff + lfo * 320;
    this.droneFilter.frequency.value += (cutoff - this.droneFilter.frequency.value) * Math.min(1, dt * 2);

    // The beating twin drifts slightly with tension — a heart that won't settle.
    if (this.droneRoot && this.droneBeating) {
      const beat = 73.9 + this.tension * 1.8;
      this.droneBeating.frequency.value = beat;
    }

    if (this.airBed) {
      const air = 0.018 + this.tension * 0.028;
      this.airBed.input.gain.value += (air - this.airBed.input.gain.value) * Math.min(1, dt * 2);
    }

    // A broken broadcast replaces the radio: eerie, not static.
    this.setBroadcast(radioOn);

    // The generative score: a slow hymn every 18..30 seconds.
    this.hymnTimer -= dt;
    if (this.hymnTimer <= 0) {
      this.hymnTimer = 18 + Math.random() * 12;
      const vol = 0.06 + this.tension * 0.08;
      this.play('hymn', { gain: vol });
    }

    const d = clamp01(danger);
    if (d >= FEEL.heartbeatThreshold) {
      const tempo = 1.05 - (d - FEEL.heartbeatThreshold) * 1.05;
      this.heartTimer -= dt;
      if (this.heartTimer <= 0) {
        this.heartTimer = Math.max(0.32, tempo);
        this.play('heartbeat', { gain: 0.25 + d * 0.45 });
      }
    } else {
      this.heartTimer = 0;
    }

    this.breathTimer -= dt;
    if (this.breathTimer <= 0) {
      this.breathTimer = 7 + Math.random() * 9;
      if (this.tension > 0.18 && this.tension < 0.65) {
        this.play('breath', { gain: 0.08 + this.tension * 0.1 });
      }
    }
  }

  private setBroadcast(on: boolean): void {
    const ctx = this.ctx;
    const lib = this.library;
    const bus = this.ambienceBus;
    if (!ctx || !lib || !bus) return;
    if (on && !this.radioBed) {
      this.radioBed = lib.createBroadcast();
      this.radioBed.input.connect(bus);
    }
    if (!this.radioBed) return;
    const target = on ? 0.05 : 0;
    const g = this.radioBed.input.gain;
    g.value += (target - g.value) * 0.06;
    if (!on && g.value < 0.002) {
      g.value = 0;
    }
  }

  play(name: SoundName, opts: PlayOptions = {}): void {
    if (!this.library || !this.sfxBus) return;
    try {
      this.library.play(name, this.sfxBus, opts);
    } catch (err) {
      console.warn('[audio] failed to play', name, err);
    }
  }

  /** Pan a sound by where in the room it happened. */
  playAt(name: SoundName, x: number, opts: PlayOptions = {}): void {
    const pan = Math.max(-1, Math.min(1, (x / VIEW.width - 0.5) * 1.5));
    this.play(name, { ...opts, pan });
  }

  /** Called when a room ends so held beds do not leak between rooms. */
  reset(): void {
    this.heartTimer = 0;
    this.breathTimer = 4;
    this.hymnTimer = 6;
    this.lfoPhase = 0;
    this.setBroadcast(false);
  }

  dispose(): void {
    this.airBed?.stop();
    this.radioBed?.stop();
    try {
      this.droneRoot?.stop();
      this.droneBeating?.stop();
      for (const o of this.extraDrones) o.stop();
    } catch {
      // Already stopped.
    }
    void this.ctx?.close();
    this.ctx = null;
  }
}
