import type { SoundKind } from '../objects/Materials';
import type { EnemyTypeId } from '../entities/EnemyTypes';
import { Music } from './Music';
import { SAMPLE_FILES, SampleBank, samplesEnabled, type SampleName, type SampleOptions } from './Samples';
import { Synth, VOWEL, type Partial, type Vowel } from './Synth';

export type SoundName =
  | 'pickup' | 'drop' | 'throw' | 'whistle' | 'chargeFull' | 'dash' | 'swipe' | 'hurt'
  | 'poof' | 'glassBreak' | 'zap' | 'ignite' | 'hiss' | 'splash' | 'explosion'
  | 'discovery' | 'paper' | 'stamp' | 'roomClear' | 'fail' | 'door' | 'knock' | 'bossWalk' | 'yawn'
  | 'slide' | 'squeak' | 'gong' | 'alarm' | 'plop' | 'scream'
  | 'chomp' | 'click' | 'fuse' | 'boombox' | 'snap' | 'kettle' | 'crackle' | 'boing';

export type VoiceKind = 'oof' | 'yelp' | 'panic' | 'defeat' | 'alert' | 'attack' | 'ow' | 'hup';

/** Which recorded sample replaces a named sound. Most named sounds still have
 *  a recording; anything the packs had no good match for (`hiss`, `kettle`,
 *  `slide`, `squeak`) and the single-file portal builds fall back to the synth
 *  recipes below. Sound sources under `public/sfx/`: the RPG Sound Pack
 *  (`assets/sfx/rpg_sound_pack/`), Kenney/Mixkit oddballs, the "New Added"
 *  replacement set, the 400 Sounds Pack and JDSherbert's UI pack, and the
 *  jute-dh RPG pack / "hits and punches" pack for fire, fall and flesh. Mapping:
 *  throw->swing, dash->swing2, swipe->swing3, snap->sword-unsheathe2,
 *  tin->sword-unsheathe5, click->interface1, discovery->interface2,
 *  chargeFull->interface3, note->interface4, bell->the chime, pickup->coin,
 *  roomClear->coin2, drop->wood-small raps, knock->door hammering, bossWalk->heavy marching,
 *  gong->metal-ringing,
 *  plop->bubble, poof->magic1, crackle->random1, glassBreak->chainmail2,
 *  zap->an electric bzzt, glass->a clean glass tink, plastic->a dry plastic
 *  knock, paper->a UI click, page->page rustle, punch->a flesh thump,
 *  hurt->a body hit, scream->shade14, rage->shade8 (CompanionSounds),
 *  shout->mnstr6, fail->fall, yawn->giant5, oof->ogre5, hup->ogre3,
 *  door->the world door, chomp->the beetle bite. Intruder voices, boss roars
 *  and mom borrow the pack's creature voices (CRY_BY_TYPE); combo/chain/
 *  boombox play pack tones via `note`. */
const SAMPLE_FOR: { [K in SoundName]?: { file: SampleName; gain?: number; rate?: number; rateFromPitch?: boolean; burst?: number } } = {
  pickup: { file: 'pickup' },
  drop: { file: 'wood-small' },
  throw: { file: 'throw' },
  whistle: { file: 'whistle' },
  chargeFull: { file: 'charge-full', gain: 0.55 },
  dash: { file: 'dash' },
  swipe: { file: 'swipe' },
  hurt: { file: 'hurt', gain: 0.65 },
  poof: { file: 'poof', gain: 0.45, rate: 1.25 },
  glassBreak: { file: 'impact-glass-big' },
  zap: { file: 'zap', gain: 0.6 },
  ignite: { file: 'ignite', gain: 0.6 },
  splash: { file: 'splash' },
  explosion: { file: 'boom', gain: 0.9 },
  discovery: { file: 'discovery', gain: 0.6 },
  paper: { file: 'impact-paper-page', gain: 0.8 },
  stamp: { file: 'stamp', gain: 0.9 },
  roomClear: { file: 'room-clear', gain: 0.55 },
  fail: { file: 'fail', gain: 0.6, rate: 0.95 },
  door: { file: 'door-open' },
  knock: { file: 'knock-knock', gain: 0.85 },
  bossWalk: { file: 'boss-walk', gain: 0.9 },
  yawn: { file: 'yawn', gain: 0.45, rate: 0.8 },
  gong: { file: 'metal-ringing', rateFromPitch: true },
  alarm: { file: 'alarm' },
  plop: { file: 'plop' },
  scream: { file: 'scream', gain: 0.5, rate: 0.75 },
  click: { file: 'click', gain: 0.5 },
  fuse: { file: 'fuse', gain: 0.5, rate: 1.35 },
  snap: { file: 'snap' },
  crackle: { file: 'crackle', gain: 0.6 },
  boing: { file: 'boing', rateFromPitch: true },
  chomp: { file: 'bite2', gain: 0.6 },
};

/** Recorded thud per material for `impact()`. Mass still picks the pitch, via rate. */
const IMPACT_SAMPLE: Record<SoundKind, SampleName> = {
  wood: 'wood-small',
  metal: 'metal-small',
  glass: 'impact-glass',
  plastic: 'plastic',
  rubber: 'boing',
  paper: 'impact-paper',
  soft: 'cloth',
};

type AudioContextCtor = typeof AudioContext;

const MIN_GAP_SECONDS = 0.045;
const MAX_VOICES = 34;

/** How each material rings when struck: [frequency ratio, decay seconds, level]. */
const WOOD: readonly Partial[] = [[1, 0.11, 1], [2.57, 0.07, 0.5], [4.3, 0.04, 0.25]];
const METAL: readonly Partial[] = [[1, 0.55, 1], [1.58, 0.42, 0.7], [2.76, 0.34, 0.5], [4.21, 0.22, 0.32], [5.4, 0.14, 0.2]];
const GLASS: readonly Partial[] = [[1, 0.16, 1], [1.47, 0.12, 0.6], [2.31, 0.09, 0.4], [3.4, 0.06, 0.22]];
const PLASTIC: readonly Partial[] = [[1, 0.055, 1], [1.9, 0.035, 0.45]];
const MARIMBA: readonly Partial[] = [[1, 0.38, 1], [3.93, 0.12, 0.3], [9.2, 0.05, 0.1]];
const BELL: readonly Partial[] = [[1, 0.5, 1], [2.01, 0.35, 0.5], [3.03, 0.2, 0.25]];

/** C major pentatonic from C5: combos and chains always land in key. */
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];

/**
 * Sound for the whole game: recorded samples where they exist — RPG-pack
 * swings, clinks, chimes, door and creature voices, Kenney/Mixkit and
 * "New Added" odds and ends, and the jute-dh/hits fire, fall and flesh
 * sounds — and the synth everywhere else. Objects ring according to their
 * material and mass,
 * intruders have little formant voices with recorded cries on top, combos
 * play notes of a scale, and a four-layer score follows how busy the room is.
 * Every call is a safe no-op until the browser allows audio, or if Web Audio
 * is missing.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfx: Synth | null = null;
  private music: Music | null = null;

  private volume = 0.7;
  private muted = false;
  private ducked = false;
  private portalMuted = false;
  private musicEnabled = true;
  private readonly lastPlayed = new Map<string, number>();

  private charge: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private hum: GainNode | null = null;
  private rumble: GainNode | null = null;
  private sfxOut: GainNode | null = null;
  private bank: SampleBank | null = null;
  private sampleMusic: { source: AudioBufferSourceNode; trim: GainNode } | null = null;
  private currentMusicName: SampleName = 'music-night';
  private musicLevel = 0;

  /**
   * Start downloading recorded sounds. Safe before any AudioContext exists;
   * call once at boot so they are (usually) decoded by the first gesture.
   * No-op in builds without sample files (CrazyGames single-file).
   */
  prefetchSamples(): void {
    if (!samplesEnabled() || this.bank) return;
    try {
      const base = new URL('sfx/', document.baseURI).href;
      this.bank = new SampleBank(base);
      this.bank.prefetch(SAMPLE_FILES);
    } catch {
      this.bank = null;
    }
  }

  /** How many recorded sounds are decoded and ready (dev visibility). */
  sampleCount(): number {
    return this.bank ? this.bank.count() : 0;
  }

  /** Must be called from a user gesture (click / key / touch) at least once. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
      const Ctor = w.AudioContext ?? w.webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();

      const master = ctx.createGain();
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -16;
      limiter.ratio.value = 6;
      limiter.attack.value = 0.004;
      limiter.release.value = 0.18;
      master.connect(limiter);
      limiter.connect(ctx.destination);

      const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.5), ctx.sampleRate);
      const samples = noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

      // A short synthetic impulse response: everything happens in the same small room.
      const tail = Math.floor(ctx.sampleRate * 0.5);
      const impulse = ctx.createBuffer(2, tail, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const data = impulse.getChannelData(c);
        for (let i = 0; i < tail; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / tail, 2.8);
      }
      const reverb = ctx.createConvolver();
      reverb.buffer = impulse;
      const wet = ctx.createGain();
      wet.gain.value = 0.2;
      reverb.connect(wet);
      wet.connect(master);

      const sfxBus = ctx.createGain();
      sfxBus.connect(master);
      sfxBus.connect(reverb);

      const musicBus = ctx.createGain();
      musicBus.gain.value = 0;
      const warmth = ctx.createBiquadFilter();
      warmth.type = 'lowpass';
      warmth.frequency.value = 2600;
      warmth.Q.value = 0.4;
      musicBus.connect(warmth);
      warmth.connect(master);
      const musicSend = ctx.createGain();
      musicSend.gain.value = 0.35;
      warmth.connect(musicSend);
      musicSend.connect(reverb);

      this.ctx = ctx;
      this.noiseBuffer = noise;
      this.master = master;
      this.musicBus = musicBus;
      this.sfx = new Synth(ctx, sfxBus, noise);
      this.sfxOut = sfxBus;
      if (samplesEnabled()) {
        // Recorded sounds + music loop; anything missing stays synthesised.
        if (!this.bank) this.prefetchSamples();
        const bank = this.bank;
        if (bank) {
          void bank.attach(ctx, SAMPLE_FILES).then(() => this.startSampleMusic());
        }
      } else {
        this.music = new Music(new Synth(ctx, musicBus, noise));
        this.music.start();
      }
      this.applyVolume();
    } catch (error) {
      console.warn('[audio] Web Audio unavailable; continuing silently.', error);
      this.ctx = null;
    }
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    this.applyVolume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolume();
  }

  setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    this.applyVolume();
  }

  /** Temporarily silences the game (ads, hidden tab) without touching the user's setting. */
  setDucked(ducked: boolean): void {
    this.ducked = ducked;
    this.applyVolume();
  }

  /** The host page's own mute switch. It wins over the in-game setting: unmuting in game cannot override it. */
  setPortalMuted(muted: boolean): void {
    this.portalMuted = muted;
    this.applyVolume();
  }

  /** 0..3 picks how many layers of the score play; -1 holds it silent (paused). */
  setMusicIntensity(level: number): void {
    this.musicLevel = level;
    if (this.sampleMusic && this.ctx) {
      const gain = level < 0 ? 0 : level === 0 ? 0.5 : Math.min(1, 0.65 + level * 0.12);
      this.sampleMusic.trim.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.4);
    } else if (this.music) {
      this.music.intensity = level;
    }
  }

  /** Starts the recorded music loop once its buffer arrives (replaces the score). */
  private startSampleMusic(name?: SampleName): void {
    const track = name ?? this.currentMusicName;
    const ctx = this.ctx;
    const bank = this.bank;
    const musicBus = this.musicBus;
    if (!ctx || !bank || !musicBus || !bank.has(track)) return;
    // Stop any track already playing before starting the new one.
    if (this.sampleMusic) {
      try { this.sampleMusic.source.stop(); } catch { /* already stopped */ }
      try { this.sampleMusic.source.disconnect(); } catch { /* ignore */ }
      try { this.sampleMusic.trim.disconnect(); } catch { /* ignore */ }
      this.sampleMusic = null;
    }
    try {
      const buffer = bank.get(track);
      if (!buffer) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const trim = ctx.createGain();
      trim.gain.value = 0;
      source.connect(trim);
      trim.connect(musicBus);
      source.start();
      this.sampleMusic = { source, trim };
      this.currentMusicName = track;
      this.setMusicIntensity(this.musicLevel);
    } catch {
      this.sampleMusic = null;
    }
  }

  /** Switches the looping background track (e.g. normal score vs boss theme). */
  setMusicTrack(name: SampleName): void {
    if (name === this.currentMusicName && this.sampleMusic) return;
    this.currentMusicName = name;
    if (this.ctx && this.bank && this.musicBus) {
      this.startSampleMusic(name);
    }
  }

  /** Convenience: true plays the boss theme, false returns to the normal score. */
  setBossMusic(active: boolean): void {
    this.setMusicTrack(active ? 'boss-bg-music' : 'music-night');
  }

  private applyVolume(): void {
    if (!this.master || !this.ctx || !this.musicBus) return;
    const silent = this.muted || this.ducked || this.portalMuted;
    this.master.gain.setTargetAtTime(silent ? 0 : this.volume * 0.9, this.ctx.currentTime, 0.02);
    this.musicBus.gain.setTargetAtTime(this.musicEnabled ? 0.62 : 0, this.ctx.currentTime, 0.1);
  }

  /** Returns false when a sound keyed `key` must stay silent right now. */
  private allow(key: string, gap = MIN_GAP_SECONDS): boolean {
    const ctx = this.ctx;
    const sfx = this.sfx;
    if (!ctx || !sfx || ctx.state !== 'running' || this.muted || this.ducked || this.portalMuted) return false;
    const last = this.lastPlayed.get(key) ?? -1;
    if (ctx.currentTime - last < gap || sfx.voices >= MAX_VOICES) return false;
    this.lastPlayed.set(key, ctx.currentTime);
    return true;
  }

  /** Returns the synth if a sound keyed `key` may start right now. */
  private begin(key: string, gap = MIN_GAP_SECONDS): Synth | null {
    return this.allow(key, gap) ? this.sfx : null;
  }

  /**
   * Plays a recorded sound. Returns false (caller falls back to the
   * synthesiser) when audio is off, rate-limited, or the file never arrived.
   */
  sample(name: SampleName, options: SampleOptions & { key?: string; gap?: number } = {}): boolean {
    const ctx = this.ctx;
    const bank = this.bank;
    const out = this.sfxOut;
    if (!ctx || !bank || !out || !bank.has(name)) return false;
    if (!this.allow(options.key ?? `sample:${name}`, options.gap)) return false;
    bank.play(ctx, out, name, options);
    return true;
  }

  /**
   * One rate-limit check for a burst of the same sample (knocks, chirps):
   * every repeat plays, spaced by `gap` seconds.
   */
  burstSamples(name: SampleName, count: number, gap: number, options: SampleOptions = {}): boolean {
    const ctx = this.ctx;
    const bank = this.bank;
    const out = this.sfxOut;
    if (!ctx || !bank || !out || !bank.has(name)) return false;
    if (!this.allow(`burst:${name}`)) return false;
    const at = options.delay ?? 0;
    for (let i = 0; i < count; i++) {
      bank.play(ctx, out, name, { ...options, delay: at + i * gap });
    }
    return true;
  }

  /** Flesh thump layered under a material hit when something smacks an intruder. */
  impactFlesh(damage: number): void {
    this.sample('impact-punch', {
      gain: Math.min(0.85, 0.25 + damage / 70),
      rate: 0.92 + Math.random() * 0.16,
      key: 'flesh',
      gap: 0.06,
    });
  }

  /** For sound sets that live in their own file (audio/CompanionSounds.ts). Same rate limiting as the rest. */
  synth(key: string, gap?: number): Synth | null {
    return this.begin(key, gap);
  }

  /**
   * Something hit something. Recorded thud when available (mass still picks the
   * pitch, via rate: a table thuds, a bottle tinks); otherwise the synth.
   */
  impact(kind: SoundKind, intensity: number, mass = 5): void {
    const i = Math.min(1, Math.max(0.05, intensity));
    if (
      this.sample(IMPACT_SAMPLE[kind], {
        gain: 0.25 + i * 0.55,
        rate: Math.min(1.3, Math.max(0.55, 1.75 - Math.log2(1 + mass) * 0.24)) * (0.94 + Math.random() * 0.12),
        key: `impact:${kind}`,
      })
    ) {
      return;
    }
    const s = this.begin(`impact:${kind}`);
    if (!s) return;
    const g = 0.1 + i * 0.42;
    const size = Math.min(1.7, Math.max(0.5, 1.75 - Math.log2(1 + mass) * 0.24));
    const vary = 0.94 + Math.random() * 0.12;
    const stretch = 0.6 + i * 0.7;
    switch (kind) {
      case 'wood':
        s.modal(205 * size * vary, WOOD, g, 0, stretch);
        s.noise({ filter: 'lowpass', from: 1700, to: 350, dur: 0.035 + i * 0.03, gain: g * 0.55 });
        if (i > 0.6) s.tone({ from: 95 * size, to: 48, dur: 0.14, gain: g * 0.5 });
        break;
      case 'metal':
        s.modal(360 * size * vary, METAL, g * 0.5, 0, stretch);
        s.noise({ filter: 'bandpass', from: 3200, to: 1400, dur: 0.03, gain: g * 0.45, q: 2 });
        break;
      case 'glass':
        s.modal(1850 * size * vary, GLASS, g * 0.42, 0, stretch);
        s.noise({ filter: 'highpass', from: 5000, dur: 0.012, gain: g * 0.3 });
        break;
      case 'plastic':
        s.modal(330 * size * vary, PLASTIC, g * 0.85, 0, stretch);
        s.noise({ filter: 'bandpass', from: 950 * size, dur: 0.035, gain: g * 0.6, q: 2.5 });
        break;
      case 'rubber': {
        // boing: the pitch springs up, sags and wobbles
        const f = 150 * size * vary;
        s.tone({ from: f, to: f * 1.9, dur: 0.07, gain: g * 0.9 });
        s.tone({ from: f * 1.9, to: f * 0.9, dur: 0.22 + i * 0.1, gain: g * 0.7, delay: 0.06, vibrato: { rate: 24, depth: f * 0.22 } });
        break;
      }
      case 'paper':
        s.noise({ filter: 'bandpass', from: 2600, dur: 0.028, gain: g * 0.5, q: 1.2 });
        s.noise({ filter: 'bandpass', from: 1900, dur: 0.035, gain: g * 0.35, q: 1.2, delay: 0.045 });
        break;
      case 'soft':
        // bonk
        s.tone({ from: 210 * size * vary, to: 75, dur: 0.11, gain: g });
        s.noise({ filter: 'lowpass', from: 600, to: 160, dur: 0.06, gain: g * 0.5 });
        break;
    }
  }

  /** Each boss talks funny: its mouth shape and wobble, matched to its personality. */
  private static readonly BOSS_MOUTH: { [K in EnemyTypeId]?: { from: Vowel; to: Vowel; wob: number } } = {
    chairman: { from: VOWEL.ah, to: VOWEL.o, wob: 0.5 },
    flusher: { from: VOWEL.o, to: VOWEL.u, wob: 2.2 },
    kraken: { from: VOWEL.u, to: VOWEL.o, wob: 0.6 },
    fridgezilla: { from: VOWEL.i, to: VOWEL.i, wob: 2.8 },
    piano: { from: VOWEL.e, to: VOWEL.a, wob: 1.6 },
    mower: { from: VOWEL.a, to: VOWEL.o, wob: 2.5 },
    mom: { from: VOWEL.a, to: VOWEL.a, wob: 0.7 },
    vacuumasaurus: { from: VOWEL.o, to: VOWEL.u, wob: 1.2 },
    hydra: { from: VOWEL.ah, to: VOWEL.e, wob: 1 },
    fan: { from: VOWEL.e, to: VOWEL.i, wob: 1.8 },
    popcorn: { from: VOWEL.i, to: VOWEL.e, wob: 3 },
    cables: { from: VOWEL.e, to: VOWEL.i, wob: 2.6 },
    cooker: { from: VOWEL.a, to: VOWEL.o, wob: 1.4 },
    train: { from: VOWEL.o, to: VOWEL.a, wob: 0.8 },
    junk: { from: VOWEL.a, to: VOWEL.e, wob: 2 },
    house: { from: VOWEL.u, to: VOWEL.o, wob: 0.4 },
    clock: { from: VOWEL.i, to: VOWEL.i, wob: 3.2 },
    toybox: { from: VOWEL.e, to: VOWEL.a, wob: 2.2 },
    dishwasher: { from: VOWEL.o, to: VOWEL.a, wob: 1.7 },
    cardboard: { from: VOWEL.a, to: VOWEL.a, wob: 1.1 },
  };

  /**
   * The NPC creature each intruder borrows its recorded cry from (RPG Sound
   * Pack, `public/sfx/`): scamps chirp and gurgle with beetle and slime
   * voices, boxes grunt with ogres and giants, bosses roar and wail with the
   * big families, and mom wails with the shades. Any build without the
   * samples falls back to the formant voices below.
   */
  private static readonly CRY_BY_TYPE: { [K in EnemyTypeId]?: readonly SampleName[] } = {
    // Scamps.
    fast: ['bite1', 'bite2'],
    gnat: ['bite3', 'bite2'],
    mini: ['bite2', 'bite3'],
    nested: ['bite1', 'bite3'],
    fragile: ['slime2', 'slime6', 'slime9'],
    electric: ['shade2'],
    // Boxes.
    basic: ['ogre5', 'ogre1'],
    helmet: ['ogre5', 'ogre2'],
    shield: ['ogre1', 'ogre2'],
    trolley: ['ogre1', 'ogre5'],
    hurler: ['ogre2', 'mnstr1'],
    heavy: ['ogre2', 'giant4'],
    bulwark: ['giant4', 'ogre2'],
    kaboom: ['mnstr1'],
    // Bosses.
    chairman: ['ogre1', 'ogre2', 'ogre5'],
    flusher: ['slime2', 'slime6', 'slime8', 'slime9'],
    kraken: ['mnstr1', 'mnstr7', 'mnstr14'],
    fridgezilla: ['giant1', 'giant2', 'giant4'],
    piano: ['shade2', 'shade6', 'shade12'],
    mower: ['wolfman'],
    vacuumasaurus: ['giant1', 'giant2', 'giant4'],
    hydra: ['mnstr1', 'mnstr7', 'mnstr14'],
    fan: ['shade2', 'shade6', 'shade12'],
    popcorn: ['bite1', 'bite2', 'bite3'],
    cables: ['mnstr1', 'mnstr7', 'mnstr14'],
    cooker: ['ogre1', 'ogre2', 'ogre5'],
    train: ['giant1', 'giant2', 'giant4'],
    junk: ['mnstr1', 'mnstr7', 'mnstr14'],
    house: ['giant1', 'giant2', 'giant4'],
    clock: ['shade2', 'shade6', 'shade12'],
    toybox: ['bite1', 'bite2', 'bite3'],
    dishwasher: ['slime2', 'slime6', 'slime8', 'slime9'],
    cardboard: ['ogre1', 'ogre2', 'ogre5'],
    // The final boss: a mother's wail, borrowed from the shades.
    mom: ['shade12'],
  };

  /** Rate for a recorded cry so the creature sits at the speaker's pitch. */
  private cryRate(pitch: number, down = false): number {
    const base = Math.min(1.6, Math.max(0.5, pitch / 140));
    return base * (down ? 0.62 : 1) * (0.97 + Math.random() * 0.06);
  }

  /**
   * A little formant voice, `pitch` being the speaker's base pitch in Hz.
   * Reaction kinds play the speaker's recorded creature cry when it exists,
   * and the frequent 'oof'/'hup' stings are the pack's short ogre grunts;
   * builds without samples stay on the synthesiser. A boss's defeat cry comes
   * from bossRoar (same creature), so it is skipped here rather than doubled.
   */
  voice(kind: VoiceKind, pitch: number, id?: EnemyTypeId): void {
    if (kind === 'oof' || kind === 'hup') {
      const sting: SampleName = kind === 'oof' ? 'oof' : 'hup';
      if (this.sample(sting, { gain: 0.32, rate: this.cryRate(pitch), key: `voice:${kind}`, gap: 0.12 })) {
        return;
      }
    }
    const cries = id !== undefined && kind !== 'oof' && kind !== 'hup' ? AudioManager.CRY_BY_TYPE[id] : undefined;
    const bossDefeat = kind === 'defeat' && id !== undefined && AudioManager.BOSS_MOUTH[id] !== undefined;
    if (cries && cries.length > 0 && !bossDefeat) {
      const pick = cries[(Math.random() * cries.length) | 0]!;
      if (this.sample(pick, { gain: kind === 'defeat' ? 0.5 : 0.4, rate: this.cryRate(pitch), key: `voice:${kind}`, gap: 0.14 })) {
        return;
      }
    }
    const s = this.begin(`voice:${kind}`, kind === 'oof' ? 0.09 : 0.14);
    if (!s) return;
    const b = pitch * (0.94 + Math.random() * 0.12);
    const mouth = id ? AudioManager.BOSS_MOUTH[id] : undefined;
    const wob = mouth?.wob ?? 1;
    const vowel = (from: Vowel, to: Vowel): { from: Vowel; to: Vowel } => ({
      from: mouth?.from ?? from,
      to: mouth?.to ?? to,
    });
    switch (kind) {
      case 'oof': {
        const v = vowel(VOWEL.o, VOWEL.u);
        s.voice({ pitch: [b * 1.2, b * 0.78], dur: 0.16, from: v.from, to: v.to, gain: 0.3 });
        break;
      }
      case 'yelp': {
        const v = vowel(VOWEL.i, VOWEL.e);
        s.voice({ pitch: [b * 1.6, b * 2.3, b * 1.8], dur: 0.32, from: v.from, to: v.to, gain: 0.24, vibrato: { rate: 30, depth: b * 0.3 * wob } });
        break;
      }
      case 'panic': {
        const v = vowel(VOWEL.a, VOWEL.e);
        s.voice({ pitch: [b * 1.4, b * 2, b * 1.5, b * 2.1], dur: 0.44, from: v.from, to: v.to, gain: 0.22, vibrato: { rate: 9, depth: b * 0.12 * wob } });
        break;
      }
      case 'defeat': {
        const v = vowel(VOWEL.u, VOWEL.a);
        const w = vowel(VOWEL.o, VOWEL.u);
        s.voice({ pitch: [b * 1.35, b * 0.95], dur: 0.15, from: v.from, to: v.to, gain: 0.3 });
        s.voice({ pitch: [b, b * 0.5], dur: 0.4, from: w.from, to: w.to, gain: 0.3, delay: 0.17, vibrato: { rate: 7, depth: b * 0.05 * wob } });
        break;
      }
      case 'alert': {
        const v = vowel(VOWEL.ah, VOWEL.e);
        s.voice({ pitch: [b * 0.9, b * 1.55], dur: 0.2, from: v.from, to: v.to, gain: 0.2 });
        break;
      }
      case 'attack': {
        const v = vowel(VOWEL.i, VOWEL.a);
        s.voice({ pitch: [b * 1.3, b * 1.75, b * 1.15], dur: 0.2, from: v.from, to: v.to, gain: 0.24 });
        break;
      }
      case 'ow': {
        const v = vowel(VOWEL.a, VOWEL.u);
        s.voice({ pitch: [b * 1.55, b], dur: 0.26, from: v.from, to: v.to, gain: 0.3 });
        break;
      }
      case 'hup': {
        const v = vowel(VOWEL.e, VOWEL.a);
        s.voice({ pitch: [b, b * 1.45], dur: 0.12, from: v.from, to: v.to, gain: 0.22 });
        break;
      }
    }
  }

  /** One chime per combo level, climbing with the streak: the pack's `bell`
   *  when decoded, otherwise a marimba note. */
  combo(level: number): void {
    // Recorded chime first (pitch climbs with the combo); sample builds stop
    // here, and the marimba below is the fallback for those without files.
    if (
      this.sample('bell', {
        gain: 0.45,
        rate: Math.min(1.6, Math.max(0.7, 0.9 + level * 0.06)),
        key: 'combo:chime',
      })
    ) {
      return;
    }
    const s = this.begin('combo');
    if (!s) return;
    const note = SCALE[Math.min(SCALE.length - 1, Math.max(0, level - 1))]!;
    s.modal(note, MARIMBA, 0.22);
    s.noise({ filter: 'bandpass', from: 2400, dur: 0.012, gain: 0.08, q: 2 });
  }

  /** A run up the scale, one note per link of the chain reaction: the pack's
   *  `note` tone when decoded, otherwise the marimba. */
  chain(length: number): void {
    const run = Math.min(length + 1, 8);
    if (this.bank?.has('note') && this.allow('chain', 0.4)) {
      for (let i = 0; i < run; i++) {
        this.sample('note', {
          gain: 0.3,
          rate: SCALE[i]! / 783.99,
          delay: i * 0.075,
          key: `chain:${i}`,
          gap: 0,
        });
      }
      this.sample('bell', { gain: 0.18, rate: 1.25, delay: run * 0.075, key: 'chain:top', gap: 0 });
      return;
    }
    const s = this.begin('chain', 0.4);
    if (!s) return;
    for (let i = 0; i < run; i++) s.modal(SCALE[i]!, MARIMBA, 0.2, i * 0.075);
    s.modal(SCALE[run]! * 2, BELL, 0.1, run * 0.075);
  }

  /**
   * Each boss announces itself (and its defeat, with `down`) with its own cry:
   * one of the pack's NPC creature sounds (see CRY_BY_TYPE), slowed for the
   * defeat. Once the file has decoded, the cry is the whole roar; the synth
   * layers below cover single-file portals and still-decoding builds.
   */
  bossRoar(id: EnemyTypeId, pitch: number, down = false): void {
    // The creature cry opens the roar; separate rate-limit key so it can never
    // suppress the synth bed.
    const cries = AudioManager.CRY_BY_TYPE[id];
    if (cries && cries.length > 0) {
      const pick = cries[(Math.random() * cries.length) | 0]!;
      if (
        this.sample(pick, {
          gain: down ? 0.6 : 0.55,
          rate: this.cryRate(pitch, down),
          key: `boss-cry:${id}`,
          gap: 0.8,
        })
      ) {
        return;
      }
    }
    const s = this.begin(`boss:${id}`, 0.8);
    if (!s) return;
    const b = Math.max(30, pitch * (down ? 0.55 : 1) * (0.96 + Math.random() * 0.08));
    const t = down ? 0.7 : 1;
    // Shared bed: a sliding growl plus weight underneath, scaled by pitch.
    if (b <= 95) {
      s.tone({ type: 'sawtooth', from: b * 2.2, to: b * 0.6, dur: 0.8 * t, gain: 0.3 });
      s.noise({ filter: 'lowpass', from: 500, to: 90, dur: 0.8 * t, gain: 0.4 });
      s.tone({ from: b * 0.5, to: 28, dur: 0.5 * t, gain: 0.4, delay: 0.1 });
    } else if (b <= 200) {
      s.tone({ type: 'square', from: b * 1.5, to: b * 0.8, dur: 0.55 * t, gain: 0.16, vibrato: { rate: 11, depth: b * 0.2 } });
      s.noise({ filter: 'bandpass', from: b * 6, to: b * 2, dur: 0.5 * t, gain: 0.3, q: 1.5 });
      s.tone({ from: b * 0.5, to: 30, dur: 0.4 * t, gain: 0.35, delay: 0.08 });
    } else {
      s.voice({ pitch: [b * 1.1, b * 1.7, b * 1.2], dur: 0.5 * t, from: VOWEL.i, to: VOWEL.e, gain: 0.26, vibrato: { rate: 13, depth: b * 0.1 } });
      s.tone({ from: b * 4, to: b * 5, dur: 0.3 * t, gain: 0.06 });
      s.tone({ from: b * 0.4, to: 32, dur: 0.35 * t, gain: 0.3, delay: 0.06 });
    }
    // One signature gesture per boss.
    switch (id) {
      case 'chairman':
        for (let i = 0; i < 3; i++) {
          s.modal(220, METAL, 0.3, i * 0.22);
          s.tone({ from: 130, to: 50, dur: 0.12, gain: 0.4, delay: i * 0.22 });
        }
        break;
      case 'flusher':
        s.noise({ filter: 'bandpass', from: 900, to: 200, dur: 0.7 * t, gain: 0.35, q: 1.2, delay: 0.1 });
        for (let i = 0; i < 3; i++) s.tone({ from: 120 + i * 60, to: 220 + i * 60, dur: 0.12, gain: 0.2, delay: 0.15 + i * 0.14 });
        break;
      case 'kraken':
        s.tone({ from: 70, to: 55, dur: 0.9 * t, gain: 0.35, vibrato: { rate: 6, depth: 18 }, delay: 0.05 });
        s.tone({ from: 300, to: 500, dur: 0.08, gain: 0.15, delay: 0.3 });
        s.tone({ from: 500, to: 260, dur: 0.1, gain: 0.15, delay: 0.45 });
        break;
      case 'fridgezilla':
        s.tone({ type: 'sawtooth', from: 55, to: 52, dur: 0.8 * t, gain: 0.2, delay: 0.05 });
        for (let i = 0; i < 4; i++) s.modal(2800 + Math.random() * 2000, [[1, 0.04, 1]], 0.12, 0.2 + i * 0.13);
        break;
      case 'piano':
        s.modal(220, BELL, 0.25, 0.1, 2);
        s.modal(233, BELL, 0.25, 0.12, 2);
        s.modal(247, BELL, 0.25, 0.14, 2);
        break;
      case 'mower':
        for (let i = 0; i < 5; i++) {
          s.tone({ type: 'square', from: 72, to: 45, dur: 0.09, gain: 0.3, delay: 0.1 + i * 0.13 });
          s.noise({ filter: 'lowpass', from: 700, dur: 0.06, gain: 0.2, delay: 0.1 + i * 0.13 });
        }
        break;
      case 'mom':
        for (let i = 0; i < 3; i++) {
          s.voice({ pitch: [b * (1 - i * 0.08), b * (0.85 - i * 0.08)], dur: 0.14, from: VOWEL.a, to: VOWEL.a, gain: 0.32, delay: 0.1 + i * 0.17 });
        }
        break;
      case 'vacuumasaurus':
        s.noise({ filter: 'lowpass', from: 2000, to: 120, dur: 0.9 * t, gain: 0.4, attack: 0.1, delay: 0.05 });
        s.tone({ type: 'square', from: 65, to: 58, dur: 0.8 * t, gain: 0.14, vibrato: { rate: 25, depth: 12 }, delay: 0.05 });
        break;
      case 'hydra':
        s.voice({ pitch: [b, b * 1.3], dur: 0.4 * t, from: VOWEL.ah, to: VOWEL.e, gain: 0.22, delay: 0.05 });
        s.voice({ pitch: [b * 1.25, b * 1.5], dur: 0.4 * t, from: VOWEL.ah, to: VOWEL.e, gain: 0.2, delay: 0.15 });
        s.voice({ pitch: [b * 0.8, b], dur: 0.4 * t, from: VOWEL.o, to: VOWEL.e, gain: 0.2, delay: 0.25 });
        break;
      case 'fan':
        s.noise({ filter: 'bandpass', from: 400, to: 2400, dur: 0.8 * t, gain: 0.32, q: 2, attack: 0.15, delay: 0.05 });
        s.tone({ from: b, to: b * 2.5, dur: 0.8 * t, gain: 0.1, delay: 0.05 });
        break;
      case 'popcorn':
        for (let i = 0; i < 6; i++) {
          const when = 0.1 + Math.random() * 0.6;
          s.noise({ filter: 'highpass', from: 2500, dur: 0.03, gain: 0.3, delay: when });
          s.tone({ from: 500 + Math.random() * 900, to: 900 + Math.random() * 900, dur: 0.04, gain: 0.12, delay: when });
        }
        break;
      case 'cables':
        s.tone({ type: 'sawtooth', from: 120, to: 110, dur: 0.4 * t, gain: 0.2, vibrato: { rate: 55, depth: 40 } });
        for (let i = 0; i < 8; i++) s.noise({ filter: 'highpass', from: 4200, dur: 0.01, gain: 0.22, delay: Math.random() * 0.4 });
        break;
      case 'cooker':
        s.noise({ filter: 'highpass', from: 2000, to: 5000, dur: 0.5 * t, gain: 0.25, attack: 0.2, delay: 0.05 });
        s.tone({ from: 200, to: 340, dur: 0.5 * t, gain: 0.12, vibrato: { rate: 18, depth: 30 }, delay: 0.05 });
        s.noise({ filter: 'bandpass', from: 1200, dur: 0.06, gain: 0.4, q: 1, delay: 0.55 * t });
        break;
      case 'train':
        s.tone({ from: 600, to: 920, dur: 0.9 * t, gain: 0.16, attack: 0.08, vibrato: { rate: 6, depth: 12 } });
        for (let i = 0; i < 3; i++) s.noise({ filter: 'lowpass', from: 500, dur: 0.08, gain: 0.3, delay: i * 0.16 });
        break;
      case 'junk':
        for (let i = 0; i < 5; i++) {
          const when = 0.1 + i * 0.12 + Math.random() * 0.04;
          if (i % 2 === 0) s.modal(160 + Math.random() * 200, WOOD, 0.22, when);
          else s.modal(500 + Math.random() * 900, METAL, 0.1, when, 0.5);
        }
        break;
      case 'house':
        s.tone({ from: 46, to: 27, dur: 1 * t, gain: 0.5, attack: 0.02 });
        s.tone({ from: 92, to: 58, dur: 0.9 * t, gain: 0.2, vibrato: { rate: 3, depth: 8 }, delay: 0.05 });
        break;
      case 'clock':
        for (let i = 0; i < 4; i++) s.tone({ type: 'square', from: i % 2 === 0 ? 1250 : 880, dur: 0.04, gain: 0.16, delay: 0.08 + i * 0.16 });
        s.tone({ from: 1800, to: 2600, dur: 0.4 * t, gain: 0.05, delay: 0.1 });
        break;
      case 'toybox':
        for (let i = 0; i < 4; i++) s.modal([880, 1046.5, 1318.5, 880]![i]!, BELL, 0.16, 0.1 + i * 0.14);
        s.tone({ from: 200, to: 700, dur: 0.18, gain: 0.1, delay: 0.6 * t });
        break;
      case 'dishwasher':
        s.noise({ filter: 'bandpass', from: 800, to: 300, dur: 0.5 * t, gain: 0.35, q: 0.8, delay: 0.05 });
        s.noise({ filter: 'highpass', from: 2600, dur: 0.35, gain: 0.14, attack: 0.1, delay: 0.2 });
        s.modal(640, METAL, 0.2, 0.45);
        break;
      case 'cardboard':
        for (let i = 0; i < 3; i++) s.noise({ filter: 'bandpass', from: 900, to: 400, dur: 0.09, gain: 0.3, q: 1, delay: 0.08 + i * 0.16 });
        s.modal(300, WOOD, 0.25, 0.5);
        break;
    }
    if (down) s.tone({ from: 90, to: 30, dur: 0.5, gain: 0.5, delay: 0.25 });
  }

  /**
   * Winding up a throw. No drone: just a breath of air drawing in under the notes that
   * `chargeStep` plays as the throw gets stronger.
   */
  chargeStart(seconds: number): void {
    const ctx = this.ctx;
    const s = this.begin('charge', 0.02);
    this.chargeStop();
    if (!ctx || !s || !this.noiseBuffer) return;
    const t = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(380, t);
    filter.frequency.exponentialRampToValueAtTime(1500, t + seconds);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.05, t + seconds);
    gain.gain.linearRampToValueAtTime(0.018, t + seconds + 0.4);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(s.out);
    source.start(t);
    this.charge = { source, gain };
  }

  /** One plucked note per quarter of charge, climbing the scale: you can hear how hard the throw will be. */
  chargeStep(index: number): void {
    const s = this.begin(`charge:${index}`, 0.02);
    if (!s) return;
    s.modal(SCALE[Math.min(index, 4)]! / 2, MARIMBA, 0.13 + index * 0.02, 0, 0.6);
  }

  chargeStop(): void {
    const charge = this.charge;
    const ctx = this.ctx;
    if (!charge || !ctx) return;
    this.charge = null;
    const t = ctx.currentTime;
    charge.gain.gain.cancelScheduledValues(t);
    charge.gain.gain.setTargetAtTime(0, t, 0.02);
    charge.source.stop(t + 0.12);
    charge.source.onended = () => charge.gain.disconnect();
  }

  /**
   * Room tone for live hazards: an electrical hum while anything is energised and a crackling
   * bed while anything burns. Called every frame with how much of each there is.
   */
  ambience(fire: number, electric: number, dt: number): void {
    const ctx = this.ctx;
    const s = this.sfx;
    if (!ctx || !s || ctx.state !== 'running') return;
    if (!this.hum) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 50;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 420;
      filter.Q.value = 1.2;
      const flutter = ctx.createOscillator();
      flutter.frequency.value = 23;
      const flutterDepth = ctx.createGain();
      flutterDepth.gain.value = 0.5;
      const tremolo = ctx.createGain();
      tremolo.gain.value = 0.6;
      flutter.connect(flutterDepth);
      flutterDepth.connect(tremolo.gain);
      this.hum = ctx.createGain();
      this.hum.gain.value = 0;
      osc.connect(filter);
      filter.connect(tremolo);
      tremolo.connect(this.hum);
      this.hum.connect(s.out);
      osc.start();
      flutter.start();

      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = src.buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      src.loop = true;
      const low = ctx.createBiquadFilter();
      low.type = 'lowpass';
      low.frequency.value = 380;
      this.rumble = ctx.createGain();
      this.rumble.gain.value = 0;
      src.connect(low);
      low.connect(this.rumble);
      this.rumble.connect(s.out);
      src.start();
    }
    const silent = this.muted || this.ducked;
    const t = ctx.currentTime;
    this.hum.gain.setTargetAtTime(silent ? 0 : Math.min(1, electric) * 0.05, t, 0.08);
    this.rumble!.gain.setTargetAtTime(silent ? 0 : Math.min(1, fire / 3) * 0.09, t, 0.15);
    if (!silent && fire > 0 && Math.random() < Math.min(3, fire) * dt * 9 && s.voices < MAX_VOICES) {
      s.noise({ filter: 'bandpass', from: 1400 + Math.random() * 2600, dur: 0.012, gain: 0.05 + Math.random() * 0.07, q: 3 });
    }
  }

  /**
   * The boombox's tinny groove, sampled: one pack tone per note, a wooden kick
   * on the beat and a plastic tick off it. Returns false until the files have
   * decoded, and the synth bar further down covers those builds.
   */
  private sampledBoombox(beat: number): boolean {
    const bank = this.bank;
    if (!bank || !bank.has('note') || !bank.has('wood-small') || !bank.has('plastic')) return false;
    if (!this.allow('boombox', 0.06)) return false;
    const step = Math.floor(beat) % 8;
    const riff = [0, -1, 2, 0, 3, -1, 2, 4][step]!;
    if (riff >= 0) {
      this.sample('note', { gain: 0.24, rate: (SCALE[riff]! * 2) / 783.99, key: `boombox:n${step}`, gap: 0 });
    }
    if (step % 2 === 0) {
      this.sample('wood-small', { gain: 0.5, rate: 0.5, key: `boombox:k${step}`, gap: 0 });
    } else {
      this.sample('plastic', { gain: 0.2, rate: 1.5, key: `boombox:t${step}`, gap: 0 });
    }
    return true;
  }

  play(name: SoundName, intensity = 1, pitch = 1): void {
    const g = Math.min(1, Math.max(0.05, intensity));
    if (name === 'boombox' && this.sampledBoombox(pitch)) return;
    const mapped = SAMPLE_FOR[name];
    if (mapped) {
      const options = {
        gain: (mapped.gain ?? 0.6) * g,
        rate: mapped.rateFromPitch ? Math.min(1.6, Math.max(0.5, pitch)) : mapped.rate,
        key: name,
      };
      // A burst is one rate-limit check for several spaced shots (door raps).
      const burst = mapped.burst ?? 1;
      const played =
        burst > 1 ? this.burstSamples(mapped.file, burst, 0.15, options) : this.sample(mapped.file, options);
      if (played) {
        return;
      } else if (this.bank && this.bank.has(mapped.file)) {
        return;
      }
    }
    const s = this.begin(name);
    if (!s) return;
    switch (name) {
      case 'pickup':
        // a mouth "pop"
        s.tone({ from: 260 * pitch, to: 900 * pitch, dur: 0.05, gain: 0.26 * g });
        s.noise({ filter: 'bandpass', from: 1800, dur: 0.015, gain: 0.08 * g, q: 2 });
        break;
      case 'drop':
        s.tone({ from: 640, to: 210, dur: 0.07, gain: 0.18 * g });
        break;
      case 'throw':
        s.noise({ filter: 'bandpass', from: 420 * pitch, to: (1500 + 1700 * g) * pitch, dur: 0.1 + g * 0.06, gain: 0.3 * g, q: 0.9 });
        s.noise({ filter: 'bandpass', from: (1500 + 1700 * g) * pitch, to: 500 * pitch, dur: 0.14, gain: 0.22 * g, q: 0.9, delay: 0.09 + g * 0.05 });
        break;
      case 'whistle':
        // slide whistle for ridiculous projectiles
        s.tone({ from: 520, to: 1250 + 500 * g, dur: 0.26, gain: 0.1, vibrato: { rate: 13, depth: 18 } });
        break;
      case 'chargeFull':
        // the top of the scale, with a little shimmer: ready
        s.modal(SCALE[5]! / 2, MARIMBA, 0.2);
        s.modal(SCALE[5]!, BELL, 0.07, 0.05);
        break;
      case 'dash':
        s.noise({ filter: 'bandpass', from: 2400, to: 500, dur: 0.13, gain: 0.3 * g, q: 0.8 });
        s.tone({ from: 620, to: 260, dur: 0.09, gain: 0.08 * g });
        break;
      case 'swipe':
        s.noise({ filter: 'bandpass', from: 700, to: 2600, dur: 0.11, gain: 0.26 * g, q: 1.4 });
        break;
      case 'hurt':
        s.tone({ from: 150, to: 55, dur: 0.16, gain: 0.4 * g });
        s.noise({ filter: 'lowpass', from: 900, to: 180, dur: 0.1, gain: 0.3 * g });
        break;
      case 'poof':
        s.noise({ filter: 'lowpass', from: 1500, to: 220, dur: 0.22, gain: 0.28 * g });
        s.tone({ from: 760, to: 190, dur: 0.07, gain: 0.2 * g });
        break;
      case 'glassBreak': {
        // a crack, then the shards settle one by one
        s.noise({ filter: 'highpass', from: 3200, to: 6500, dur: 0.07, gain: 0.5 * g });
        s.tone({ from: 240, to: 80, dur: 0.06, gain: 0.25 * g });
        for (let i = 0; i < 11; i++) {
          const when = Math.pow(Math.random(), 1.8) * 0.42;
          const f = 2100 + Math.random() * 4600;
          s.modal(f, [[1, 0.05 + Math.random() * 0.13, 1], [1.51, 0.04, 0.4]], 0.11 * g * (1 - when), when);
        }
        break;
      }
      case 'zap': {
        // mains buzz chopped by a fast gate, plus arcing clicks
        s.tone({ type: 'sawtooth', from: 104, to: 96, dur: 0.3, gain: 0.16 * g, vibrato: { rate: 50, depth: 30 } });
        s.tone({ type: 'square', from: 1700, to: 420, dur: 0.09, gain: 0.07 * g });
        s.noise({ filter: 'bandpass', from: 3600, to: 1300, dur: 0.24, gain: 0.3 * g, q: 5 });
        for (let i = 0; i < 6; i++) {
          s.noise({ filter: 'highpass', from: 4500, dur: 0.008, gain: 0.26 * g, delay: Math.random() * 0.28 });
        }
        break;
      }
      case 'ignite':
        s.noise({ filter: 'lowpass', from: 220, to: 1700, dur: 0.5, gain: 0.42 * g, attack: 0.14 });
        s.tone({ from: 78, to: 44, dur: 0.3, gain: 0.3 * g, attack: 0.05 });
        break;
      case 'hiss':
        s.noise({ filter: 'highpass', from: 2400, to: 4200, dur: 0.5, gain: 0.26 * g, attack: 0.02 });
        s.noise({ filter: 'bandpass', from: 5200, dur: 0.3, gain: 0.1 * g, q: 6 });
        break;
      case 'splash':
        s.noise({ filter: 'bandpass', from: 1300, to: 380, dur: 0.24, gain: 0.42 * g, q: 0.7 });
        for (let i = 0; i < 4; i++) {
          const f = 260 + Math.random() * 420;
          s.tone({ from: f, to: f * 2.1, dur: 0.045, gain: 0.12 * g, delay: 0.06 + Math.random() * 0.22 });
        }
        break;
      case 'explosion':
        s.tone({ from: 125, to: 27, dur: 0.95, gain: 0.85 * g });
        s.noise({ filter: 'lowpass', from: 1500, to: 70, dur: 0.95, gain: 0.85 * g });
        s.noise({ filter: 'bandpass', from: 2600, to: 600, dur: 0.14, gain: 0.5 * g, q: 0.7 });
        // debris coming back down
        for (let i = 0; i < 9; i++) {
          const when = 0.22 + Math.random() * 0.8;
          if (i % 2 === 0) s.modal(170 + Math.random() * 190, WOOD, 0.1, when);
          else s.modal(420 + Math.random() * 700, METAL, 0.04, when, 0.5);
        }
        // the ringing in your ears
        s.tone({ from: 3150, to: 3100, dur: 1.5, gain: 0.022, attack: 0.25 });
        break;
      case 'discovery':
        // camera shutter, then a sparkle
        s.noise({ filter: 'bandpass', from: 3400, dur: 0.012, gain: 0.3, q: 2 });
        s.noise({ filter: 'bandpass', from: 1700, dur: 0.02, gain: 0.26, q: 2, delay: 0.07 });
        s.modal(SCALE[2]!, MARIMBA, 0.16, 0.14);
        s.modal(SCALE[4]!, MARIMBA, 0.16, 0.21);
        s.modal(SCALE[5]!, MARIMBA, 0.16, 0.28);
        s.modal(SCALE[7]!, BELL, 0.1, 0.36);
        break;
      case 'paper':
        // a scrap being picked up
        s.noise({ filter: 'bandpass', from: 3800 * pitch, to: 2600 * pitch, dur: 0.035, gain: 0.14 * g, q: 1.1 });
        s.noise({ filter: 'bandpass', from: 5200 * pitch, dur: 0.02, gain: 0.08 * g, q: 1.5, delay: 0.035 });
        break;
      case 'stamp':
        // rubber stamp: a thud on the desk and the slap of paper
        s.tone({ from: 120, to: 46, dur: 0.16, gain: 0.6 * g });
        s.noise({ filter: 'lowpass', from: 1300, to: 240, dur: 0.07, gain: 0.5 * g });
        s.noise({ filter: 'bandpass', from: 3000, dur: 0.03, gain: 0.12 * g, q: 1.2, delay: 0.05 });
        break;
      case 'roomClear': {
        // a warm major swell: soft sine pad tones arriving one by one over a
        // breath of air, resolving on a high shimmer. Nothing plucky.
        const pad: Array<[freq: number, delay: number]> = [
          [261.63, 0],
          [329.63, 0.14],
          [392.0, 0.28],
          [523.25, 0.42],
        ];
        for (const [freq, delay] of pad) {
          s.tone({ from: freq, dur: 1.9, gain: 0.11 * g, delay, attack: 0.32 });
          s.tone({ type: 'triangle', from: freq / 2, dur: 1.9, gain: 0.05 * g, delay, attack: 0.4 });
        }
        s.tone({ from: 130.81, dur: 2.1, gain: 0.12 * g, delay: 0.1, attack: 0.35 });
        s.noise({ filter: 'lowpass', from: 500, to: 2600, dur: 1.5, gain: 0.045 * g, attack: 0.55 });
        s.tone({ from: 783.99, dur: 1.3, gain: 0.05 * g, delay: 0.55, attack: 0.45 });
        s.tone({ from: 1046.5, dur: 1.5, gain: 0.04 * g, delay: 0.7, attack: 0.5 });
        break;
      }
      case 'fail': {
        // a gentle descent: three legato tones settling onto a low tonic with
        // a soft vibrato, under a slow downward sigh. No trombone.
        s.tone({ from: 329.63, dur: 0.75, gain: 0.13 * g, attack: 0.28 });
        s.tone({ from: 293.66, dur: 0.75, gain: 0.13 * g, delay: 0.55, attack: 0.28 });
        s.tone({ from: 261.63, dur: 1.5, gain: 0.15 * g, delay: 1.1, attack: 0.3, vibrato: { rate: 5, depth: 3 } });
        s.tone({ from: 110, dur: 1.7, gain: 0.09 * g, delay: 1.1, attack: 0.4 });
        s.noise({ filter: 'lowpass', from: 1200, to: 300, dur: 1.7, gain: 0.045 * g, attack: 0.45 });
        break;
      }
      case 'scream': {
        // the moment the tenant goes down: a soft exhale and a low drop, no scream.
        s.noise({ filter: 'lowpass', from: 900, to: 200, dur: 0.5, gain: 0.22 * g, attack: 0.03 });
        s.tone({ from: 200, to: 70, dur: 0.5, gain: 0.28 * g, attack: 0.02 });
        break;
      }
      case 'door':
        s.modal(105, WOOD, 0.5, 0, 1.6);
        s.noise({ filter: 'lowpass', from: 900, to: 150, dur: 0.14, gain: 0.4 * g });
        s.noise({ filter: 'bandpass', from: 2400, dur: 0.02, gain: 0.14 * g, q: 2, delay: 0.02 });
        break;
      case 'knock':
        for (let i = 0; i < 3; i++) {
          s.modal(168 + i * 4, WOOD, 0.34 * g, i * 0.15, 1.1);
          s.noise({ filter: 'lowpass', from: 800, to: 260, dur: 0.03, gain: 0.16 * g, delay: i * 0.15 });
        }
        break;
      case 'bossWalk':
        // something huge tramping to the door: four slow, heavy footfalls
        for (let i = 0; i < 4; i++) {
          s.modal(66 - i * 2, WOOD, 0.5 * g, i * 1.1, 0.5);
          s.noise({ filter: 'lowpass', from: 420, to: 120, dur: 0.18, gain: 0.3 * g, delay: i * 1.1 });
        }
        break;
      case 'slide':
        // falling slide whistle: someone's feet have gone
        s.tone({ from: 1500 * pitch, to: 380 * pitch, dur: 0.32, gain: 0.12, vibrato: { rate: 14, depth: 22 } });
        break;
      case 'squeak':
        s.tone({ from: 950, to: 1900, dur: 0.05, gain: 0.16 * g });
        s.tone({ from: 1900, to: 1250, dur: 0.09, gain: 0.13 * g, delay: 0.05 });
        break;
      case 'gong':
        // a frying pan connecting with something
        s.modal(300 * pitch, [[1, 0.9, 1], [2.32, 0.6, 0.55], [3.9, 0.35, 0.3], [5.6, 0.2, 0.18]], 0.3 * g);
        s.noise({ filter: 'bandpass', from: 2400, dur: 0.02, gain: 0.2 * g, q: 1.5 });
        break;
      case 'alarm':
        // twin-bell alarm clock: the hammer rattling between two bells
        for (let i = 0; i < 7; i++) {
          s.modal(i % 2 === 0 ? 2350 : 2790, [[1, 0.07, 1], [2.6, 0.04, 0.3]], 0.08, i * 0.045);
        }
        break;
      case 'plop':
        s.tone({ from: 420, to: 110, dur: 0.09, gain: 0.3 * g });
        s.noise({ filter: 'lowpass', from: 900, to: 200, dur: 0.05, gain: 0.2 * g });
        break;
      case 'chomp':
        // clockwork teeth: two quick wooden clacks
        s.modal(900, PLASTIC, 0.22 * g);
        s.modal(760, PLASTIC, 0.2 * g, 0.06);
        break;
      case 'click':
        // a spring being set
        s.modal(1500, PLASTIC, 0.12 * g);
        s.noise({ filter: 'bandpass', from: 3200, dur: 0.01, gain: 0.06 * g, q: 2 });
        break;
      case 'fuse':
        // a match being struck, then a quiet fizz
        s.noise({ filter: 'bandpass', from: 2600, to: 5200, dur: 0.09, gain: 0.16 * g, q: 1.2 });
        s.noise({ filter: 'highpass', from: 4200, dur: 0.5, gain: 0.05 * g, attack: 0.08, delay: 0.08 });
        break;
      case 'boombox': {
        // a tinny little groove; `pitch` is the step of the bar
        const step = Math.floor(pitch) % 8;
        const riff = [0, -1, 2, 0, 3, -1, 2, 4][step]!;
        if (riff >= 0) s.modal(SCALE[riff]! / 2, MARIMBA, 0.11);
        if (step % 2 === 0) s.tone({ from: 110, to: 52, dur: 0.09, gain: 0.16 });
        else s.noise({ filter: 'bandpass', from: 1900, dur: 0.035, gain: 0.07, q: 1.4 });
        break;
      }
      case 'snap':
        // a sprung bar coming down on wood
        s.modal(210, WOOD, 0.5 * g);
        s.modal(1250, [[1, 0.09, 1], [2.4, 0.05, 0.4]], 0.14 * g);
        s.noise({ filter: 'bandpass', from: 2800, dur: 0.018, gain: 0.2 * g, q: 1.5 });
        break;
      case 'kettle':
        // steam finding its way out: breathy, wavering, getting higher
        s.tone({ from: 1180 * pitch, to: 1420 * pitch, dur: 0.36, gain: 0.035, attack: 0.08, vibrato: { rate: 9, depth: 14 } });
        s.noise({ filter: 'bandpass', from: 2300, to: 3000, dur: 0.36, gain: 0.07, q: 5, attack: 0.06 });
        break;
      case 'crackle':
        // a firework: a scatter of small pops and falling glitter
        for (let i = 0; i < 14; i++) {
          const when = 0.05 + Math.random() * 0.75;
          s.noise({ filter: 'bandpass', from: 1800 + Math.random() * 3600, dur: 0.02, gain: 0.16 * (1 - when * 0.7), q: 2.5, delay: when });
        }
        for (let i = 0; i < 5; i++) s.modal(SCALE[4 + i]!, BELL, 0.035, 0.12 + i * 0.09);
        break;
      case 'boing':
        // rubber coming back off a wall
        s.tone({ from: 190 * pitch, to: 520 * pitch, dur: 0.13, gain: 0.2 * g, vibrato: { rate: 26, depth: 40 } });
        break;
      case 'yawn':
        s.voice({ pitch: [210, 320, 170], dur: 1, from: VOWEL.a, to: VOWEL.o, gain: 0.1 });
        break;
    }
  }
}
