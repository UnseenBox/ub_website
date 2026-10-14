import type { Partial, Synth } from './Synth';

const BPM = 78;
const SIXTEENTH = 60 / BPM / 4;
const SWING = SIXTEENTH * 0.34;
const STEPS_PER_BAR = 16;
const LOOKAHEAD = 0.25;

interface Chord {
  /** Bass note, Hz. */
  root: number;
  /** Four-note voicing around middle C, Hz. */
  notes: readonly number[];
}

const F_MAJ7: Chord = { root: 87.31, notes: [174.61, 220, 261.63, 329.63] };
const E_MIN7: Chord = { root: 82.41, notes: [164.81, 196, 246.94, 293.66] };
const D_MIN7: Chord = { root: 73.42, notes: [174.61, 220, 261.63, 293.66] };
const C_MAJ7: Chord = { root: 65.41, notes: [164.81, 196, 246.94, 261.63] };
const A_MIN7: Chord = { root: 110, notes: [196, 220, 261.63, 329.63] };
const G_SIX: Chord = { root: 98, notes: [196, 246.94, 293.66, 329.63] };

/** Four-bar phrases; the score strings them together in a different order each time round. */
const PHRASES: readonly (readonly Chord[])[] = [
  [F_MAJ7, E_MIN7, D_MIN7, C_MAJ7],
  [A_MIN7, F_MAJ7, C_MAJ7, G_SIX],
  [D_MIN7, G_SIX, C_MAJ7, A_MIN7],
  [F_MAJ7, G_SIX, E_MIN7, A_MIN7],
];

/** C major pentatonic across two octaves: any of these sits happily over every chord above. */
const MELODY_SCALE = [392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5];

const KEYS: readonly Partial[] = [
  [1, 1.9, 1],
  [2, 0.7, 0.16],
  [3, 0.3, 0.05],
];
const KALIMBA: readonly Partial[] = [
  [1, 0.55, 1],
  [3.9, 0.14, 0.16],
];

/**
 * The score: slow, soft, late-night lo-fi, written fresh every few bars rather than looped.
 * Warm electric-piano chords, a round bass, brushed drums that only join once the movers
 * arrive, and a sparse kalimba line that is improvised from a pentatonic scale — a phrase is
 * invented, answered once with a small change, then thrown away. Everything runs through a
 * low-pass filter (in AudioManager) so nothing is bright or sharp.
 *
 * Layers by intensity:
 *   -1 silent (paused)
 *    0 chords and the odd kalimba note (menus, empty room)
 *    1 + bass and drums (movers in the room)
 *    2 + the kalimba line (a crowd, or a combo going)
 *    3 + busier hats and an echo on the melody (big combo)
 */
export class Music {
  intensity = 0;
  private timer = 0;
  private step = 0;
  private bar = 0;
  private nextTime = 0;
  private phrase: readonly Chord[] = PHRASES[0]!;
  private motif: number[] = [];
  private motifNote = 3;
  private rehit = 6;
  private dropDrums = false;

  constructor(private readonly synth: Synth) {
    this.newMotif();
  }

  start(): void {
    if (this.timer) return;
    this.nextTime = this.synth.now + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 60);
  }

  stop(): void {
    if (!this.timer) return;
    window.clearInterval(this.timer);
    this.timer = 0;
  }

  private schedule(): void {
    const synth = this.synth;
    if (synth.ctx.state !== 'running') return;
    const now = synth.now;
    // After a stall (hidden tab) resume from "now" instead of rattling through the backlog.
    if (this.nextTime < now - 0.1) this.nextTime = now + 0.05;
    while (this.nextTime < now + LOOKAHEAD) {
      const swing = this.step % 4 === 2 ? SWING : 0;
      if (this.intensity >= 0) this.playStep(this.step, Math.max(0, this.nextTime + swing - now));
      this.nextTime += SIXTEENTH;
      this.step++;
      if (this.step === STEPS_PER_BAR) {
        this.step = 0;
        this.nextBar();
      }
    }
  }

  private nextBar(): void {
    this.bar++;
    this.rehit = Math.random() < 0.5 ? 6 : 10;
    // every phrase ends with a bar where the drums sit out, so it breathes
    this.dropDrums = this.bar % 4 === 3 && Math.random() < 0.6;
    if (this.bar % 4 === 0) {
      this.phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)]!;
      this.newMotif();
    } else if (this.bar % 2 === 0) {
      this.varyMotif();
    }
  }

  /** Two bars of eighth notes; -1 is a rest. A random walk, so it sings rather than jumps. */
  private newMotif(): void {
    this.motif = [];
    for (let i = 0; i < 16; i++) {
      if (Math.random() < (i % 4 === 0 ? 0.55 : 0.3)) {
        const stride = Math.random() < 0.7 ? 1 : 2;
        this.motifNote += Math.random() < 0.5 ? -stride : stride;
        this.motifNote = Math.max(0, Math.min(MELODY_SCALE.length - 1, this.motifNote));
        this.motif.push(this.motifNote);
      } else {
        this.motif.push(-1);
      }
    }
  }

  /** The answer to the phrase: the same shape with its ending changed. */
  private varyMotif(): void {
    for (let i = 11; i < 16; i++) {
      this.motif[i] = Math.random() < 0.35 ? Math.floor(Math.random() * MELODY_SCALE.length) : -1;
    }
  }

  private playStep(step: number, delay: number): void {
    const synth = this.synth;
    const level = this.intensity;
    const chord = this.phrase[this.bar % 4]!;

    // ── electric piano ──
    if (step === 0) {
      chord.notes.forEach((f, i) => {
        // strummed slightly, low note first, with a slow tape wobble
        synth.modal(f, KEYS, 0.05, delay + i * 0.022);
        synth.tone({ from: f, dur: 1.5, gain: 0.018, delay: delay + i * 0.022, attack: 0.03, vibrato: { rate: 0.8, depth: f * 0.004 } });
      });
    } else if (step === this.rehit) {
      for (let i = 1; i < chord.notes.length; i++) synth.modal(chord.notes[i]!, KEYS, 0.026, delay + i * 0.015, 0.7);
    }

    // ── vinyl crackle ──
    if (Math.random() < 0.4) {
      synth.noise({ filter: 'highpass', from: 4200, dur: 0.004, gain: 0.006 + Math.random() * 0.012, delay: delay + Math.random() * SIXTEENTH });
    }

    // ── bass and drums come in with the movers ──
    if (level >= 1) {
      if (step === 0) {
        synth.tone({ from: chord.root, dur: 0.55, gain: 0.2, delay, attack: 0.012 });
      } else if (step === 10 && Math.random() < 0.75) {
        synth.tone({ from: chord.root * (Math.random() < 0.5 ? 1.5 : 1), dur: 0.3, gain: 0.13, delay, attack: 0.012 });
      }
      if (!this.dropDrums) {
        if (step === 0 || step === 10 || (step === 7 && Math.random() < 0.3)) {
          synth.tone({ from: 104, to: 42, dur: 0.17, gain: 0.26, delay });
        }
        if (step === 4 || step === 12) {
          // brushed snare: mostly air
          synth.noise({ filter: 'bandpass', from: 1700, dur: 0.13, gain: 0.07, q: 0.8, delay });
          synth.tone({ type: 'triangle', from: 190, to: 150, dur: 0.05, gain: 0.035, delay });
        }
        const hat = level >= 3 ? true : step % 2 === 0;
        if (hat && Math.random() < 0.85) {
          synth.noise({ filter: 'highpass', from: 6500, dur: 0.022, gain: 0.008 + Math.random() * 0.012, delay });
        }
      }
    }

    // ── kalimba ──
    if (step % 2 === 0) {
      const slot = ((this.bar % 2) * 16 + step) / 2;
      const note = this.motif[slot] ?? -1;
      const play = level >= 2 ? note >= 0 : note >= 0 && Math.random() < 0.22;
      if (play) {
        const f = MELODY_SCALE[note]!;
        synth.modal(f, KALIMBA, level >= 2 ? 0.075 : 0.05, delay);
        if (level >= 3) synth.modal(f, KALIMBA, 0.028, delay + SIXTEENTH * 3);
      }
    }
  }
}
