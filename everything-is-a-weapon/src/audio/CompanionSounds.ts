import type { AudioManager } from './AudioManager';
import { VOWEL } from './Synth';

/**
 * The hero losing their temper, and the noises the pickups make. (The pets' own voices are
 * in PetVoices.ts.) Every sound prefers its recorded sample when one is loaded, and falls
 * back to the synth below in builds without samples.
 */

/** Tin lid peeling back: a bright steel whisk. */
export function tinOpen(audio: AudioManager): void {
  if (audio.sample('tin', { gain: 0.5, key: 'tin', gap: 0.2 })) return;
  const s = audio.synth('tin', 0.2);
  if (!s) return;
  s.noise({ filter: 'bandpass', from: 900, to: 3800, dur: 0.16, gain: 0.2, q: 4 });
  s.tone({ type: 'triangle', from: 1900, to: 2500, dur: 0.07, gain: 0.1, delay: 0.15 });
}

/** Biting into the pepper, a beat of silence, then the scream. */
export function rageStart(audio: AudioManager): void {
  // A recorded wail carries the rage; the formant cry below is the fallback.
  if (audio.sample('rage', { gain: 0.55, key: 'rage:start', gap: 0.5 })) return;
  const s = audio.synth('rage:start', 0.5);
  if (!s) return;
  s.noise({ filter: 'bandpass', from: 1500, to: 600, dur: 0.05, gain: 0.25, q: 2 });
  s.voice({ pitch: [210, 330, 520, 480], dur: 0.75, from: VOWEL.a, to: VOWEL.a, gain: 0.3, delay: 0.22, vibrato: { rate: 26, depth: 34 } });
  s.noise({ filter: 'highpass', from: 2200, to: 5200, dur: 0.6, gain: 0.1, attack: 0.1, delay: 0.3 });
}

export function rageShout(audio: AudioManager): void {
  if (audio.sample('shout', { gain: 0.45, rate: 1 + Math.random() * 0.1, key: 'rage:shout', gap: 0.6 })) return;
  const s = audio.synth('rage:shout', 0.6);
  if (!s) return;
  const b = 260 + Math.random() * 60;
  s.voice({ pitch: [b, b * 1.5, b * 1.2], dur: 0.3, from: VOWEL.a, to: VOWEL.e, gain: 0.24, vibrato: { rate: 28, depth: 26 } });
}

/** The kettle coming off the boil. */
export function rageEnd(audio: AudioManager): void {
  const s = audio.synth('rage:end', 0.5);
  if (!s) return;
  s.noise({ filter: 'highpass', from: 4200, to: 1500, dur: 0.7, gain: 0.14, attack: 0.02 });
  s.voice({ pitch: [300, 170], dur: 0.45, from: VOWEL.o, to: VOWEL.u, gain: 0.2, delay: 0.15 });
}

/** One bubble of bubble wrap: the plop sample, squeezed small. */
export function bubblePop(audio: AudioManager, level: number): void {
  if (audio.sample('plop', { gain: 0.3 * level, rate: 1.5 + Math.random() * 0.25, key: 'bubble', gap: 0.04 })) return;
  const s = audio.synth('bubble', 0.04);
  if (!s) return;
  s.tone({ from: 900, to: 180, dur: 0.035, gain: 0.3 * level });
  s.noise({ filter: 'highpass', from: 2400, dur: 0.02, gain: 0.2 * level });
  s.tone({ from: 1100, to: 220, dur: 0.035, gain: 0.22 * level, delay: 0.07 });
}

/** Two rising notes: the sound of a plaster going on. */
export function patchUp(audio: AudioManager): void {
  // The pack's clean interface tone walks up two steps.
  if (audio.sample('note', { gain: 0.2, rate: 0.667, key: 'heal', gap: 0.3 })) {
    audio.sample('note', { gain: 0.2, rate: 1, delay: 0.12, key: 'heal:2', gap: 0.3 });
    return;
  }
  const s = audio.synth('heal', 0.3);
  if (!s) return;
  s.tone({ type: 'triangle', from: 523, dur: 0.14, gain: 0.2 });
  s.tone({ type: 'triangle', from: 784, dur: 0.22, gain: 0.2, delay: 0.12 });
}

/** A music-box phrase winding down. */
export function snoozeChime(audio: AudioManager): void {
  // The same clean tone, stepping down like a music box losing its spring.
  const notes = [880, 698, 587, 440];
  if (audio.sample('note', { gain: 0.16, rate: notes[0]! / 783.99, key: 'snooze', gap: 0.5 })) {
    for (let i = 1; i < notes.length; i++) {
      audio.sample('note', { gain: 0.16, rate: notes[i]! / 783.99, delay: i * 0.16, key: `snooze:${i}`, gap: 0.5 });
    }
    return;
  }
  const s = audio.synth('snooze', 0.5);
  if (!s) return;
  [880, 698, 587, 440].forEach((f, i) => s.tone({ type: 'sine', from: f, to: f * 0.97, dur: 0.5, gain: 0.16, delay: i * 0.16 }));
}
