import { FEEL, VIEW } from '../core/Tuning';
import { clamp01 } from '../core/Mathx';
import type { Settings } from '../save/SaveManager';
import { SoundLibrary, type PlayOptions, type SoundName } from './SoundLibrary';

/**
 * Audio, built so that silence is the default state.
 *
 * There is no music. There is a room tone that breathes with how worked up the
 * creatures are, a heartbeat that only exists near real danger, and short
 * synthesised events. Everything respects the browser's autoplay rules: nothing
 * is created until the player has interacted with the page.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private library: SoundLibrary | null = null;

  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private ambienceBus: GainNode | null = null;

  private droneA: OscillatorNode | null = null;
  private droneB: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private airBed: { input: GainNode; stop: () => void } | null = null;
  private radioBed: { input: GainNode; stop: () => void } | null = null;

  private heartTimer = 0;
  private breathTimer = 4;
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
    filter.frequency.value = 220;
    filter.Q.value = 2;
    this.droneFilter = filter;

    const gain = ctx.createGain();
    gain.gain.value = 0.1;
    this.droneGain = gain;

    // Two oscillators a few cents apart: a low hum that will not sit still.
    const a = ctx.createOscillator();
    a.type = 'sine';
    a.frequency.value = 54;
    const b = ctx.createOscillator();
    b.type = 'sine';
    b.frequency.value = 54.9;

    a.connect(filter);
    b.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    a.start();
    b.start();
    this.droneA = a;
    this.droneB = b;

    this.airBed = lib.createBed(680, 0.6);
    this.airBed.input.gain.value = 0.035;
    this.airBed.input.connect(bus);
  }

  /**
   * Called every simulation step. Tension shapes the room tone; the heartbeat
   * only exists above the danger threshold, and it leaves as quietly as it came.
   */
  update(dt: number, tension: number, danger: number, radioOn: boolean): void {
    if (!this.ctx || !this.droneGain || !this.droneFilter) return;
    this.tension += (clamp01(tension) - this.tension) * Math.min(1, dt * 1.6);

    // The room tone opens up as things get worse. Never loud, only closer.
    const target = 0.08 + this.tension * 0.14;
    this.droneGain.gain.value += (target - this.droneGain.gain.value) * Math.min(1, dt * 2);
    const cutoff = 200 + this.tension * 520;
    this.droneFilter.frequency.value += (cutoff - this.droneFilter.frequency.value) * Math.min(1, dt * 2);
    if (this.droneA && this.droneB) {
      this.droneB.frequency.value = 54.9 + this.tension * 2.4;
    }

    if (this.airBed) {
      const air = 0.03 + this.tension * 0.03;
      this.airBed.input.gain.value += (air - this.airBed.input.gain.value) * Math.min(1, dt * 2);
    }

    this.setRadio(radioOn);

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

    // A held breath in the quiet. Rare, and only while something is interested.
    this.breathTimer -= dt;
    if (this.breathTimer <= 0) {
      this.breathTimer = 7 + Math.random() * 9;
      if (this.tension > 0.22 && this.tension < 0.7) {
        this.play('breath', { gain: 0.1 + this.tension * 0.12 });
      }
    }
  }

  private setRadio(on: boolean): void {
    const ctx = this.ctx;
    const lib = this.library;
    const bus = this.ambienceBus;
    if (!ctx || !lib || !bus) return;
    if (on && !this.radioBed) {
      this.radioBed = lib.createBed(1400, 0.9);
      this.radioBed.input.connect(bus);
    }
    if (!this.radioBed) return;
    const target = on ? 0.07 : 0;
    const g = this.radioBed.input.gain;
    g.value += (target - g.value) * 0.08;
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
    this.setRadio(false);
  }

  dispose(): void {
    this.airBed?.stop();
    this.radioBed?.stop();
    try {
      this.droneA?.stop();
      this.droneB?.stop();
    } catch {
      // Already stopped.
    }
    void this.ctx?.close();
    this.ctx = null;
  }
}
