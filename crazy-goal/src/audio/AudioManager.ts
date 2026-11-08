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
  /** Maximum playback duration in seconds (useful to cut long recordings short). */
  duration?: number;
}

/** Where each recording sits in the sound sheet: [start, length] in seconds, per variant. */
export type SoundIndex = Readonly<Record<string, readonly (readonly number[])[]>>;

/** Global level trims so the mix isn't harsh. */
const MUSIC_LEVEL = 0.3;
const SFX_LEVEL = 0.45;

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
  /** Standalone samples (e.g. goal sting, bg music source) loaded outside the sheet. */
  private clips = new Map<string, AudioBuffer>();
  private clipData = new Map<string, ArrayBuffer>();
  private musicSrc: AudioBufferSourceNode | null = null;
  private musicLoop: { name: string; variant: number } | null = null;
  private active = new Map<string, Set<AudioBufferSourceNode>>();
  private musicBus: GainNode | null = null;
  soundVolume = 0.3;
  musicVolume = 0.2;
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
        this.startMusic();
      },
      () => {
        /* undecodable: stay quiet */
      },
    );
  }

  /** Loads a standalone sound file (e.g. a goal sting) playable by name via `play()`. */
  loadClip(name: string, url: string): void {
    fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('clip missing'))))
      .then((data) => {
        this.clipData.set(name, data);
        this.decodeClip(name);
      })
      .catch(() => {
        /* missing clip: stays silent */
      });
  }

  /** Trims leading (and, for non-looping clips, trailing) silence so playback starts on the sound. */
  private trimBuffer(buffer: AudioBuffer, name: string): AudioBuffer {
    const threshold = 0.004;
    const channels = buffer.numberOfChannels;
    const len = buffer.length;
    let start = 0;
    let end = len - 1;
    const scan = (from: number, step: number, limit: number): number => {
      for (let i = from; step > 0 ? i <= limit : i >= limit; i += step) {
        for (let c = 0; c < channels; c++) {
          if (Math.abs(buffer.getChannelData(c)[i]) > threshold) return i;
        }
      }
      return from;
    };
    start = scan(0, 1, len - 1);
    const preroll = Math.min(start, Math.floor(buffer.sampleRate * 0.003));
    start -= preroll;
    if (name !== '__music') {
      end = scan(len - 1, -1, start);
      end = Math.min(len - 1, end + Math.floor(buffer.sampleRate * 0.02));
    } else {
      end = len - 1;
    }
    if (start <= 0 && end >= len - 1) return buffer;
    const frames = Math.max(1, end - start + 1);
    const ctx = this.ctx;
    if (!ctx) return buffer;
    const out = ctx.createBuffer(channels, frames, buffer.sampleRate);
    for (let c = 0; c < channels; c++) {
      out.getChannelData(c).set(buffer.getChannelData(c).subarray(start, end + 1));
    }
    // Short fade-in to avoid a clipped attack after trimming.
    const rise = Math.min(frames, Math.floor(buffer.sampleRate * 0.004));
    if (rise > 1) {
      for (let c = 0; c < channels; c++) {
        const d = out.getChannelData(c);
        for (let i = 0; i < rise; i++) d[i] *= i / (rise - 1);
      }
    }
    return out;
  }

  private decodeClip(name: string): void {
    const ctx = this.ctx;
    const data = this.clipData.get(name);
    if (!ctx || !data || this.clips.has(name)) return;
    this.clipData.delete(name);
    ctx.decodeAudioData(data.slice(0)).then(
      (buffer) => {
        this.clips.set(name, this.trimBuffer(buffer, name));
        if (name === '__music') this.startMusic();
      },
      () => {
        /* undecodable */
      },
    );
  }

  /** Loads and loops a background music track on the music bus. */
  loadMusic(url: string): void {
    this.loadClip('__music', url);
  }

  /** Loops a named sound (from the sheet or a clip) on the music bus as background music. */
  loopMusic(name: string, variant = 0): void {
    this.musicLoop = { name, variant };
    this.startMusic();
  }

  private startMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus || this.musicSrc) return;
    // Prefer an external music track, else loop a configured sheet/clip sound.
    const ext = this.clips.get('__music');
    if (ext) {
      const src = ctx.createBufferSource();
      src.buffer = ext;
      src.loop = true;
      src.connect(this.musicBus);
      try { src.start(); this.musicSrc = src; } catch { /* can't start */ }
      return;
    }
    const loop = this.musicLoop;
    if (!loop) return;
    const clip = this.clips.get(loop.name);
    if (clip) {
      const src = ctx.createBufferSource();
      src.buffer = clip;
      src.loop = true;
      src.connect(this.musicBus);
      try { src.start(); this.musicSrc = src; } catch { /* can't start */ }
      return;
    }
    const variants = this.index[loop.name];
    if (!this.sheet || !variants || variants.length === 0) return;
    const pick = Math.min(loop.variant, variants.length - 1);
    const [start, length] = variants[pick];
    const src = ctx.createBufferSource();
    src.buffer = this.sheet;
    src.loop = true;
    src.loopStart = start;
    src.loopEnd = start + length;
    src.connect(this.musicBus);
    try { src.start(0, start); this.musicSrc = src; } catch { /* can't start */ }
  }

  /** Plays one recording of a named sound (from the sheet or a standalone clip). Returns false if it could not. */
  play(name: string, o: PlayOptions = {}): boolean {
    const ctx = this.live;
    if (!ctx || !this.master) return false;
    const clip = this.clips.get(name);
    if (clip) {
      const src = ctx.createBufferSource();
      src.buffer = clip;
      src.playbackRate.value = o.rate ?? 1;
      const amp = ctx.createGain();
      amp.gain.value = (o.gain ?? 1) * (o.music ? 1 : SFX_LEVEL);
      src.connect(amp).connect(o.music && this.musicBus ? this.musicBus : this.master);
      this.track(name, src);
      const when = ctx.currentTime + (o.at ?? 0);
      if (o.duration !== undefined) src.start(when, 0, Math.max(0.01, o.duration));
      else src.start(when);
      return true;
    }
    const variants = this.index[name];
    if (!this.sheet || !variants || variants.length === 0) return false;
    const pick = o.variant !== undefined ? o.variant % variants.length : Math.floor(Math.random() * variants.length);
    const [start, length] = variants[pick];
    const src = ctx.createBufferSource();
    src.buffer = this.sheet;
    src.playbackRate.value = o.rate ?? 1;
    const amp = ctx.createGain();
    amp.gain.value = (o.gain ?? 1) * (o.music ? 1 : SFX_LEVEL);
    src.connect(amp).connect(o.music && this.musicBus ? this.musicBus : this.master);
    this.track(name, src);
    const dur = o.duration !== undefined ? Math.min(length, Math.max(0.01, o.duration)) : length;
    src.start(ctx.currentTime + (o.at ?? 0), start, dur);
    return true;
  }

  private track(name: string, src: AudioBufferSourceNode): void {
    let set = this.active.get(name);
    if (!set) {
      set = new Set();
      this.active.set(name, set);
    }
    set.add(src);
    src.onended = () => {
      set.delete(src);
      if (set.size === 0) this.active.delete(name);
    };
  }

  /** Stops any currently playing instances of a named sound. */
  stop(name: string): void {
    const set = this.active.get(name);
    if (!set) return;
    for (const src of set) {
      try { src.stop(); } catch { /* already stopped */ }
      try { src.disconnect(); } catch { /* ignore */ }
    }
    this.active.delete(name);
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
        for (const name of Array.from(this.clipData.keys())) this.decodeClip(name);
        this.startMusic();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      this.startMusic();
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
    return this.live ? this.live.currentTime : -1;
  }

  private get live(): AudioContext | null {
    return this.ctx && this.master && !this.muted && this.ctx.state === 'running' ? this.ctx : null;
  }

  /** Synthetic SFX removed: assets only. */
  swell(_level: number, _brightness: number): void {}

  /** Synthetic SFX removed: assets only. */
  tone(_o: ToneOptions): void {}
}
