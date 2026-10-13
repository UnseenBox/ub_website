export interface ToneOptions {
  freq: number;
  type?: OscillatorType;
  /** Seconds from now. */
  at?: number;
  attack?: number;
  decay: number;
  gain: number;
  /** Frequency to slide to over `glideTime`. */
  glide?: number;
  glideTime?: number;
  /** Low-pass cutoff; leave out for an unfiltered voice. */
  lowpass?: number;
}

export interface PlayOptions {
  /** 0 to 1 and a little beyond. */
  gain?: number;
  /** Playback speed: 2 is an octave up, 0.5 an octave down. */
  rate?: number;
  /** Seconds from now. */
  at?: number;
  /** Which recording of the sound to use; left out, one is picked at random. */
  variant?: number;
  /** Play on the music bus, which has its own volume. */
  music?: boolean;
}

/** Where each recording sits in the sound sheet: [start, length] in seconds, per variant. */
export type SoundIndex = Readonly<Record<string, readonly (readonly number[])[]>>;

/** Music sits under the effects even with its slider at full. */
const MUSIC_LEVEL = 0.55;

/**
 * Owns the AudioContext. Nearly every sound is a recording, cut out of one sound sheet that
 * is downloaded once. A few things that really are electronic (a car alarm, a scooter horn)
 * are still made from an oscillator, and the pull-back is a steered rush of air. If audio is unavailable every call is a no-op.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private failed = false;
  private sheet: AudioBuffer | null = null;
  private sheetData: ArrayBuffer | null = null;
  private index: SoundIndex = {};
  private musicBus: GainNode | null = null;
  soundVolume = 0.8;
  musicVolume = 0.5;
  private swellAmp: GainNode | null = null;
  private swellTone: BiquadFilterNode | null = null;
  muted = false;

  /**
   * Starts downloading the sound sheet. It is decoded later, once the browser allows audio.
   * A failed download just leaves the game quiet.
   */
  loadSheet(url: string, index: SoundIndex): void {
    this.index = index;
    fetch(url)
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error('sound sheet missing'))))
      .then((data) => {
        this.sheetData = data;
        this.decodeSheet();
      })
      .catch(() => {
        /* no recordings: the game plays on without them */
      });
  }

  private decodeSheet(): void {
    const ctx = this.ctx;
    const data = this.sheetData;
    if (!ctx || !data || this.sheet) return;
    this.sheetData = null;
    ctx.decodeAudioData(data).then(
      (buffer) => {
        this.sheet = buffer;
      },
      () => {
        /* undecodable: stay quiet */
      },
    );
  }

  /** Plays one recording of a named sound. Returns false if it could not (not loaded yet, muted). */
  play(name: string, o: PlayOptions = {}): boolean {
    const ctx = this.live;
    const variants = this.index[name];
    if (!ctx || !this.master || !this.sheet || !variants || variants.length === 0) return false;
    const pick = o.variant !== undefined ? o.variant % variants.length : Math.floor(Math.random() * variants.length);
    const [start, length] = variants[pick];
    const src = ctx.createBufferSource();
    src.buffer = this.sheet;
    src.playbackRate.value = o.rate ?? 1;
    const amp = ctx.createGain();
    amp.gain.value = o.gain ?? 1;
    src.connect(amp).connect(o.music && this.musicBus ? this.musicBus : this.master);
    src.start(ctx.currentTime + (o.at ?? 0), start, length);
    return true;
  }

  /** Browsers only allow sound after a user gesture; call this from one. */
  unlock(): void {
    if (this.failed) return;
    try {
      if (!this.ctx) {
        const ctx = new AudioContext();
        const master = ctx.createGain();
        master.gain.value = this.muted ? 0 : this.soundVolume;
        const musicBus = ctx.createGain();
        musicBus.gain.value = this.muted ? 0 : this.musicVolume * MUSIC_LEVEL;
        // A gentle limiter so stacked impacts never clip.
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -14;
        limiter.knee.value = 12;
        limiter.ratio.value = 6;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.18;
        master.connect(limiter).connect(ctx.destination);
        musicBus.connect(limiter);
        this.musicBus = musicBus;

        this.ctx = ctx;
        this.master = master;
        this.decodeSheet();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.failed = true;
      this.ctx = null;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.setVolumes(this.soundVolume, this.musicVolume);
  }

  /** Both 0 to 1. */
  setVolumes(sound: number, music: number): void {
    this.soundVolume = sound;
    this.musicVolume = music;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.master?.gain.setTargetAtTime(this.muted ? 0 : sound, now, 0.02);
    this.musicBus?.gain.setTargetAtTime(this.muted ? 0 : music * MUSIC_LEVEL, now, 0.02);
  }

  /** The audio clock in seconds, or -1 while sound cannot play. */
  get now(): number {
    return this.live && this.sheet ? this.live.currentTime : -1;
  }

  private get live(): AudioContext | null {
    return this.ctx && this.master && !this.muted && this.ctx.state === 'running' ? this.ctx : null;
  }

  /**
   * A soft rush of air that is steered rather than triggered: call it every frame with how
   * loud (0 to 1) and how bright (0 to 1) it should be. It glides there, and fades out by
   * itself as soon as the calls stop.
   */
  swell(level: number, brightness: number): void {
    const ctx = this.live;
    if (!ctx || !this.master) return;
    if (!this.swellAmp || !this.swellTone) {
      // Two seconds of soft noise, looped: with no pitch of its own the loop cannot be heard.
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        last = last * 0.94 + (Math.random() * 2 - 1) * 0.06;
        data[i] = last * 6;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const tone = ctx.createBiquadFilter();
      tone.type = 'bandpass';
      tone.Q.value = 0.7;
      const amp = ctx.createGain();
      amp.gain.value = 0;
      src.connect(tone).connect(amp).connect(this.master);
      src.start();
      this.swellAmp = amp;
      this.swellTone = tone;
    }
    const now = ctx.currentTime;
    const gain = this.swellAmp.gain;
    gain.cancelScheduledValues(now);
    gain.setTargetAtTime(level, now, 0.06);
    gain.setTargetAtTime(0, now + 0.1, 0.09);
    this.swellTone.frequency.setTargetAtTime(350 + 1100 * brightness, now, 0.08);
  }

  tone(o: ToneOptions): void {
    const ctx = this.live;
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + (o.at ?? 0);
    const attack = o.attack ?? 0.004;
    const end = t0 + attack + o.decay;

    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.glide !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.glide), t0 + (o.glideTime ?? o.decay));

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.linearRampToValueAtTime(o.gain, t0 + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, end);

    if (o.lowpass !== undefined) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = o.lowpass;
      osc.connect(lp).connect(amp);
    } else {
      osc.connect(amp);
    }
    amp.connect(this.master);
    osc.start(t0);
    osc.stop(end + 0.03);
  }
}
