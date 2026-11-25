// Original synthesized sound effects. Every sound is generated from noise and
// oscillators at boot — no recorded or third-party audio is used. To replace a
// sound with a licensed recording, register an AudioBuffer under the same key
// (see AudioManager.loadOverride and docs/AUDIO_MANIFEST.md).

import { Dsp } from './dsp';

export interface BankEntry { data: Float32Array; rate: number }
export type Bank = Map<string, BankEntry>;

const LOW_RATE = 22050;

interface ShotParams {
  crack: number;
  bodyF: number;
  bodyQ: number;
  bodyTau: number;
  bodyLP: number;
  bodyGain: number;
  thump0: number;
  thump1: number;
  thumpTau: number;
  thumpGain: number;
  tailTau: number;
  tailLP: number;
  tailGain: number;
  echoDelay: number;
  echoGain: number;
  mechAt: number;
  mechF: number;
  mechGain: number;
  drive: number;
  length: number;
}

function shot(d: Dsp, p: ShotParams): Float32Array {
  const out = d.buf(p.length);
  // supersonic crack / muzzle blast transient
  if (p.crack > 0) {
    const c = d.highpass(d.noise(0.02), 1800);
    d.decay(c, 0.0016, 0, 0.0001);
    d.mixIn(out, c, 0, p.crack);
  }
  // blast body
  const body = d.lowpass(d.bandpass(d.noise(0.25), p.bodyF, p.bodyQ), p.bodyLP);
  d.decay(body, p.bodyTau, 0, 0.0004);
  d.mixIn(out, d.gain(body, 6), 0, p.bodyGain);
  const wide = d.lowpass(d.noise(0.2), p.bodyLP * 0.8);
  d.decay(wide, p.bodyTau * 0.7, 0, 0.0003);
  d.mixIn(out, wide, 0, p.bodyGain * 0.6);
  // low-frequency punch
  const th = d.sweep(0.4, p.thump0, p.thump1, 0.07);
  d.decay(th, p.thumpTau, 0, 0.0008);
  d.mixIn(out, th, 0, p.thumpGain);
  // rumbling tail
  const tail = d.lowpass(d.brown(p.length), p.tailLP);
  d.decay(tail, p.tailTau, 0.004, 0.01);
  d.mixIn(out, tail, 0, p.tailGain);
  // action cycling
  if (p.mechGain > 0) {
    const m = d.bandpass(d.noise(0.05), p.mechF, 6);
    d.decay(m, 0.006, 0, 0.0002);
    d.mixIn(out, d.gain(m, 5), p.mechAt, p.mechGain);
    const ping = d.tone(0.06, p.mechF * 0.73);
    d.decay(ping, 0.012);
    d.mixIn(out, ping, p.mechAt, p.mechGain * 0.25);
  }
  d.saturate(out, p.drive);
  const e = d.echo(out, p.echoDelay, p.echoGain, 700, 2);
  return d.fade(d.normalize(e, 0.95), 0.0002, 0.05);
}

function click(d: Dsp, f: number, tau: number, gain = 1): Float32Array {
  const c = d.bandpass(d.noise(0.08), f, 4);
  d.decay(c, tau, 0, 0.0002);
  const p = d.tone(0.08, f * 0.62);
  d.decay(p, tau * 1.5);
  return d.mixIn(d.gain(c, 4 * gain), p, 0, 0.4 * gain);
}

function scrape(d: Dsp, len: number, f0: number, f1: number, gain = 1): Float32Array {
  const s = d.bandpass(d.noise(len), (t) => f0 + (f1 - f0) * (t / len), 3);
  d.envelope(s, [[0, 0], [len * 0.2, 1], [len * 0.8, 0.7], [len, 0]]);
  return d.gain(s, 3 * gain);
}

function clack(d: Dsp, f: number, gain = 1): Float32Array {
  const out = click(d, f, 0.01, gain);
  const th = d.sweep(0.08, 220, 90, 0.03);
  d.decay(th, 0.02);
  return d.mixIn(out, th, 0, 0.5 * gain);
}

type Ev = [number, Float32Array, number];

function sequence(d: Dsp, len: number, events: Ev[]): Float32Array {
  const out = d.buf(len);
  for (const [t, s, g] of events) d.mixIn(out, s, t, g);
  return d.fade(d.normalize(d.reverb(out, 0.6, 0.12), 0.8));
}

function voice(d: Dsp, len: number, f0: (t: number) => number, formants: [number, number, number][], breath: number, rasp: number, env: [number, number][]): Float32Array {
  // glottal pulse train with jitter
  const src = d.buf(len);
  let ph = 0;
  for (let i = 0; i < src.length; i++) {
    const t = i / d.sr;
    const f = f0(t) * (1 + (d.rand() - 0.5) * 0.04);
    ph += f / d.sr;
    const p = ph - Math.floor(ph);
    const pulse = p < 0.35 ? Math.sin((p / 0.35) * Math.PI) : 0;
    const am = 1 - rasp * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 31));
    src[i] = (pulse * 0.9 + d.noiseSample() * breath) * am;
  }
  const out = d.buf(len);
  for (const [f, q, g] of formants) d.mixIn(out, d.bandpass(Float32Array.from(src), f, q), 0, g);
  d.envelope(out, env);
  return d.fade(d.normalize(d.saturate(out, 1.6), 0.85), 0.01, 0.05);
}

function explosion(d: Dsp, len: number, size: number): Float32Array {
  const out = d.buf(len);
  const blast = d.lowpass(d.noise(len), (t) => 200 + 3800 * Math.exp(-t / (0.12 * size)));
  d.decay(blast, 0.35 * size, 0, 0.001);
  d.mixIn(out, d.gain(blast, 2.2), 0, 1);
  const sub = d.sweep(len, 70, 22, 0.6 * size);
  d.decay(sub, 0.5 * size, 0, 0.002);
  d.mixIn(out, sub, 0, 1.3);
  const rumble = d.lowpass(d.brown(len), 220);
  d.decay(rumble, 0.9 * size, 0.05, 0.08);
  d.mixIn(out, rumble, 0, 1.1);
  // debris crackle
  for (let i = 0; i < 40 * size; i++) {
    const t = 0.05 + d.rand() * len * 0.7;
    d.mixIn(out, click(d, 1200 + d.rand() * 2500, 0.004, 0.15), t, Math.exp(-t / (0.6 * size)));
  }
  d.saturate(out, 2.2);
  return d.fade(d.normalize(d.echo(out, 0.42, 0.3, 400, 2), 0.95), 0.0005, 0.3);
}

export function buildSoundBank(sampleRate = 44100): Bank {
  const d = new Dsp(sampleRate);
  const bank: Bank = new Map();
  // Low-frequency material (rumbles, loops, drones) is rendered at half rate.
  const lo = new Dsp(LOW_RATE);
  const put = (k: string, b: Float32Array) => bank.set(k, { data: b, rate: d.sr });
  const putLo = (k: string, b: Float32Array) => bank.set(k, { data: b, rate: lo.sr });

  // --------------------------------------------------------- firearms
  put('shot_service', shot(d, {
    crack: 1.1, bodyF: 1150, bodyQ: 0.8, bodyTau: 0.03, bodyLP: 3200, bodyGain: 0.9,
    thump0: 150, thump1: 42, thumpTau: 0.075, thumpGain: 1.1, tailTau: 0.42, tailLP: 700, tailGain: 0.45,
    echoDelay: 0.34, echoGain: 0.32, mechAt: 0.085, mechF: 2600, mechGain: 0.35, drive: 2.4, length: 1.3,
  }));
  put('shot_m4', shot(d, {
    crack: 1.2, bodyF: 1900, bodyQ: 0.9, bodyTau: 0.018, bodyLP: 5200, bodyGain: 0.85,
    thump0: 180, thump1: 62, thumpTau: 0.04, thumpGain: 0.65, tailTau: 0.24, tailLP: 900, tailGain: 0.28,
    echoDelay: 0.3, echoGain: 0.22, mechAt: 0.035, mechF: 3400, mechGain: 0.18, drive: 2.0, length: 0.75,
  }));
  put('shot_m249', shot(d, {
    crack: 0.85, bodyF: 880, bodyQ: 0.7, bodyTau: 0.028, bodyLP: 2600, bodyGain: 1.0,
    thump0: 118, thump1: 38, thumpTau: 0.06, thumpGain: 1.25, tailTau: 0.32, tailLP: 600, tailGain: 0.4,
    echoDelay: 0.36, echoGain: 0.3, mechAt: 0.03, mechF: 2100, mechGain: 0.3, drive: 3.0, length: 0.9,
  }));
  {
    // 40mm launcher: hollow tube "thoomp" with cylinder ratchet afterwards
    const base = shot(d, {
      crack: 0, bodyF: 320, bodyQ: 1.2, bodyTau: 0.045, bodyLP: 900, bodyGain: 1.0,
      thump0: 95, thump1: 34, thumpTau: 0.11, thumpGain: 1.4, tailTau: 0.25, tailLP: 380, tailGain: 0.35,
      echoDelay: 0.32, echoGain: 0.2, mechAt: 0.0, mechF: 1000, mechGain: 0, drive: 1.8, length: 0.9,
    });
    const tube = d.bandpass(d.noise(0.3), 185, 5);
    d.decay(tube, 0.11, 0, 0.002);
    d.mixIn(base, d.gain(tube, 6), 0, 0.6);
    d.mixIn(base, click(d, 2300, 0.006, 0.4), 0.28, 1);
    d.mixIn(base, click(d, 1900, 0.006, 0.3), 0.33, 1);
    put('shot_m32', d.normalize(base, 0.95));
  }
  {
    // 12 gauge: a wide, deep boom, then the pump racked back and forward.
    const base = shot(d, {
      crack: 0.9, bodyF: 620, bodyQ: 0.6, bodyTau: 0.05, bodyLP: 2200, bodyGain: 1.1,
      thump0: 110, thump1: 36, thumpTau: 0.09, thumpGain: 1.5, tailTau: 0.5, tailLP: 650, tailGain: 0.5,
      echoDelay: 0.36, echoGain: 0.3, mechAt: 0, mechF: 2000, mechGain: 0, drive: 3.2, length: 1.2,
    });
    d.mixIn(base, scrape(d, 0.07, 1500, 900, 0.7), 0.42, 0.5);
    d.mixIn(base, clack(d, 1700, 1.1), 0.5, 0.7);
    d.mixIn(base, scrape(d, 0.06, 900, 1600, 0.7), 0.58, 0.45);
    d.mixIn(base, clack(d, 2100, 1.2), 0.65, 0.8);
    put('shot_shotgun', d.normalize(base, 0.95));
  }
  // .50 anti-materiel rifle: a huge supersonic crack and a long rolling tail.
  put('shot_m82', shot(d, {
    crack: 1.6, bodyF: 760, bodyQ: 0.6, bodyTau: 0.05, bodyLP: 2600, bodyGain: 1.2,
    thump0: 90, thump1: 30, thumpTau: 0.12, thumpGain: 1.7, tailTau: 0.8, tailLP: 520, tailGain: 0.6,
    echoDelay: 0.45, echoGain: 0.4, mechAt: 0.32, mechF: 1800, mechGain: 0.4, drive: 3.4, length: 1.8,
  }));
  {
    // Rocket launcher: a hollow back-blast whoosh with a low punch.
    const whoosh = d.bandpass(d.noise(0.9), (t) => 900 - t * 600, 0.7);
    d.envelope(whoosh, [[0, 0], [0.02, 1], [0.25, 0.6], [0.9, 0]]);
    const punch = shot(d, {
      crack: 0.4, bodyF: 260, bodyQ: 0.8, bodyTau: 0.06, bodyLP: 800, bodyGain: 1.0,
      thump0: 80, thump1: 28, thumpTau: 0.14, thumpGain: 1.6, tailTau: 0.4, tailLP: 420, tailGain: 0.5,
      echoDelay: 0.4, echoGain: 0.3, mechAt: 0, mechF: 1000, mechGain: 0, drive: 2.2, length: 1.2,
    });
    d.mixIn(punch, d.gain(whoosh, 1.4), 0, 0.8);
    put('shot_rpg', d.normalize(punch, 0.95));
    // Railgun: a rising capacitor whine, then an electric snap and a hard crack.
    const out = d.buf(1.4);
    const whine = d.tone(0.18, (t) => 1800 + t * 9000);
    d.envelope(whine, [[0, 0], [0.15, 0.6], [0.18, 0]]);
    d.mixIn(out, whine, 0, 0.4);
    const crack = shot(d, {
      crack: 1.8, bodyF: 2400, bodyQ: 0.9, bodyTau: 0.02, bodyLP: 7000, bodyGain: 0.9,
      thump0: 120, thump1: 40, thumpTau: 0.08, thumpGain: 1.2, tailTau: 0.6, tailLP: 900, tailGain: 0.45,
      echoDelay: 0.4, echoGain: 0.35, mechAt: 0, mechF: 1000, mechGain: 0, drive: 2.8, length: 1.2,
    });
    d.mixIn(out, crack, 0.17, 1);
    for (let k = 0; k < 12; k++) d.mixIn(out, click(d, 4000 + d.rand() * 3000, 0.002, 0.5), 0.17 + d.rand() * 0.1, 0.4);
    put('shot_rail', d.normalize(out, 0.95));
    // Tesla: a crackling electric snap, buzzing at mains hum with a bright click on top.
    const zap = d.buf(0.45);
    const buzz = d.tone(0.35, (t) => 120 + Math.sin(t * 90) * 40, 'square');
    d.envelope(buzz, [[0, 0], [0.01, 1], [0.12, 0.5], [0.35, 0]]);
    d.mixIn(zap, d.lowpass(buzz, 2600), 0, 0.5);
    const hiss = d.highpass(d.noise(0.3), 3000);
    d.decay(hiss, 0.08);
    d.mixIn(zap, hiss, 0, 0.8);
    for (let k = 0; k < 10; k++) d.mixIn(zap, click(d, 3000 + d.rand() * 5000, 0.002, 0.6), d.rand() * 0.25, 0.5);
    put('shot_tesla', d.normalize(zap, 0.85));
  }
  {
    // Flamethrower: a short roaring gout of burning gas, played on every tick of the stream.
    const roar = d.lowpass(d.noise(0.22), 1400);
    d.mixIn(roar, d.gain(d.bandpass(d.noise(0.22), 300, 0.8), 1.5));
    d.envelope(roar, [[0, 0], [0.03, 1], [0.15, 0.7], [0.22, 0]]);
    put('shot_flame', d.normalize(roar, 0.7));
  }
  {
    // Acid spit: wet launch (falling noise sweep); splash: sizzle plus a soft thud.
    const spit = d.bandpass(d.noise(0.35), (t) => 1800 - t * 3600, 2);
    d.envelope(spit, [[0, 0], [0.02, 1], [0.35, 0]]);
    put('acid_spit', d.normalize(spit, 0.8));
    const sizzle = d.highpass(d.noise(0.9), 2500);
    d.decay(sizzle, 0.35);
    d.mixIn(sizzle, d.decay(d.tone(0.25, (t) => 120 - t * 200), 0.08), 0, 1.2);
    put('acid_splash', d.normalize(sizzle, 0.8));
  }
  {
    // Howl: a long rising scream with reverb.
    const howl = d.tone(1.4, (t) => 380 + t * 520 + Math.sin(t * 30) * 18, 'saw');
    d.lowpass(howl, 2400);
    d.envelope(howl, [[0, 0], [0.15, 0.8], [1.1, 1], [1.4, 0]]);
    put('howl', d.normalize(d.reverb(howl, 0.5, 0.35), 0.85));
    // Sapper charge: a short high electronic chirp.
    const beep = d.tone(0.07, 2600, 'square');
    d.envelope(beep, [[0, 0], [0.005, 1], [0.06, 1], [0.07, 0]]);
    put('sapper_beep', d.normalize(beep, 0.5));
    // Focus: time slowing down (falling sweep) and back up.
    put('focus_in', d.normalize(d.fade(d.envelope(d.sweep(0.6, 900, 140, 0.4), [[0, 0], [0.05, 1], [0.6, 0]])), 0.7));
    put('focus_out', d.normalize(d.fade(d.envelope(d.sweep(0.4, 160, 800, 0.3), [[0, 0], [0.05, 1], [0.4, 0]])), 0.6));
  }
  put('reload_shotgun', sequence(d, 2.8, [
    ...Array.from({ length: 6 }, (_, i): Ev => [0.15 + i * 0.36, clack(d, 1500 + (i % 2) * 200, 0.8), 0.75]),
    [2.35, scrape(d, 0.08, 1500, 900, 0.7), 0.6], [2.45, clack(d, 1700, 1.1), 0.9],
    [2.55, scrape(d, 0.07, 900, 1600, 0.7), 0.5], [2.62, clack(d, 2100, 1.2), 1],
  ]));
  put('shot_chain', shot(d, {
    crack: 0.7, bodyF: 700, bodyQ: 0.7, bodyTau: 0.02, bodyLP: 2400, bodyGain: 1,
    thump0: 130, thump1: 50, thumpTau: 0.035, thumpGain: 1.0, tailTau: 0.12, tailLP: 500, tailGain: 0.3,
    echoDelay: 0.25, echoGain: 0.15, mechAt: 0, mechF: 2000, mechGain: 0, drive: 2.5, length: 0.4,
  }));

  put('empty_light', d.fade(d.normalize(click(d, 3200, 0.004), 0.6)));
  put('empty_heavy', d.fade(d.normalize(d.mixIn(click(d, 1800, 0.006), click(d, 2600, 0.003), 0.03, 0.6), 0.65)));

  // --------------------------------------------------------- reloads (timed to weapons.ts reloadTime)
  put('reload_service', sequence(d, 1.8, [
    [0.12, click(d, 2800, 0.005), 0.7], [0.3, scrape(d, 0.16, 1400, 2400), 0.6], [0.95, clack(d, 2000), 1],
    [1.38, scrape(d, 0.08, 2500, 1600), 0.5], [1.5, clack(d, 2600, 1.2), 1],
  ]));
  put('reload_m4', sequence(d, 2.1, [
    [0.15, click(d, 3000, 0.004), 0.7], [0.32, scrape(d, 0.14, 1800, 2800), 0.6], [1.15, scrape(d, 0.1, 2200, 1500), 0.5],
    [1.28, clack(d, 2300), 1], [1.75, click(d, 3600, 0.006, 1.3), 1], [1.8, clack(d, 2800, 0.8), 0.8],
  ]));
  put('reload_m249', sequence(d, 4.5, [
    [0.2, click(d, 2200, 0.008), 0.8], [0.45, clack(d, 1500), 0.9], [1.2, scrape(d, 0.5, 900, 1800, 0.8), 0.6],
    ...Array.from({ length: 10 }, (_, i): Ev => [1.6 + i * 0.07, click(d, 2600 + (i % 3) * 300, 0.003, 0.4), 0.6]),
    [3.3, clack(d, 1300, 1.3), 1], [3.9, scrape(d, 0.12, 1500, 2600), 0.6], [4.08, clack(d, 2500, 1.1), 1],
  ]));
  put('reload_m32', sequence(d, 3.7, [
    [0.2, click(d, 2000, 0.008), 0.8], [0.5, scrape(d, 0.4, 600, 1200, 0.6), 0.5],
    ...Array.from({ length: 6 }, (_, i): Ev => [1.0 + i * 0.35, clack(d, 1400 + i * 40, 0.8), 0.8]),
    ...Array.from({ length: 6 }, (_, i): Ev => [3.1 + i * 0.045, click(d, 2400, 0.003, 0.5), 0.7]),
    [3.45, clack(d, 1700, 1.2), 1],
  ]));
  put('switch_weapon', sequence(d, 0.5, [
    [0, scrape(d, 0.18, 300, 800, 0.4), 0.5], [0.12, click(d, 1900, 0.008), 0.6], [0.3, clack(d, 2200, 0.7), 0.6],
  ]));

  // --------------------------------------------------------- impacts
  for (let i = 0; i < 3; i++) {
    const out = d.buf(0.35);
    const sq = d.lowpass(d.noise(0.3), 700 + i * 150);
    d.decay(sq, 0.04 + i * 0.01, 0, 0.001);
    d.mixIn(out, d.gain(sq, 2), 0, 1);
    const thud = d.sweep(0.2, 140, 60, 0.05);
    d.decay(thud, 0.035);
    d.mixIn(out, thud, 0, 0.7);
    for (let k = 0; k < 6; k++) d.mixIn(out, click(d, 600 + d.rand() * 900, 0.004, 0.25), 0.01 + d.rand() * 0.08, 0.5);
    put(`hit_flesh_${i}`, d.fade(d.normalize(out, 0.8)));
  }
  {
    const out = d.buf(0.4);
    const crunch = d.bandpass(d.noise(0.2), 1600, 1.2);
    d.decay(crunch, 0.022, 0, 0.0005);
    d.mixIn(out, d.gain(crunch, 4), 0, 1);
    d.mixIn(out, click(d, 3800, 0.003, 1.2), 0, 1);
    const sq = d.lowpass(d.noise(0.35), 900);
    d.decay(sq, 0.07, 0.01);
    d.mixIn(out, d.gain(sq, 2), 0, 0.9);
    put('hit_head', d.fade(d.normalize(d.saturate(out, 1.6), 0.9)));
  }
  {
    const out = d.buf(0.6);
    for (const [f, g] of [[2637, 1], [3951, 0.55], [5274, 0.25]] as [number, number][]) {
      const t = d.tone(0.6, f);
      d.decay(t, 0.16, 0, 0.001);
      d.mixIn(out, t, 0.02, g);
    }
    put('headshot_confirm', d.fade(d.normalize(out, 0.55)));
  }
  {
    const out = d.buf(0.5);
    const p = d.sweep(0.5, 4200, 2300, 0.3);
    d.decay(p, 0.09, 0, 0.0005);
    d.mixIn(out, p, 0, 0.6);
    d.mixIn(out, click(d, 3000, 0.004, 1.2), 0, 1);
    const w = d.bandpass(d.noise(0.5), (t) => 5000 - t * 4000, 8);
    d.decay(w, 0.12);
    d.mixIn(out, d.gain(w, 4), 0.01, 0.4);
    put('ricochet', d.fade(d.normalize(out, 0.7)));
  }
  {
    const out = d.buf(0.3);
    const th = d.lowpass(d.noise(0.3), 900);
    d.decay(th, 0.03);
    d.mixIn(out, d.gain(th, 2), 0, 1);
    for (let k = 0; k < 8; k++) d.mixIn(out, click(d, 1500 + d.rand() * 2500, 0.002, 0.3), 0.02 + d.rand() * 0.15, 0.5);
    put('hit_dirt', d.fade(d.normalize(out, 0.55)));
  }
  {
    const out = d.buf(0.25);
    const th = d.lowpass(d.noise(0.25), 500);
    d.decay(th, 0.03);
    d.mixIn(out, d.gain(th, 2), 0, 1);
    put('hit_sandbag', d.fade(d.normalize(out, 0.6)));
  }
  for (let i = 0; i < 2; i++) {
    const out = d.buf(0.7);
    const th = d.sweep(0.5, 110 - i * 15, 45, 0.08);
    d.decay(th, 0.09, 0, 0.002);
    d.mixIn(out, th, 0, 1.2);
    const n = d.lowpass(d.noise(0.6), 1200);
    d.decay(n, 0.06);
    d.mixIn(out, d.gain(n, 2), 0, 0.8);
    for (let k = 0; k < 10; k++) d.mixIn(out, click(d, 800 + d.rand() * 2000, 0.003, 0.3), 0.04 + d.rand() * 0.3, 0.5);
    put(`bunker_hit_${i}`, d.fade(d.normalize(d.saturate(out, 1.8), 0.85)));
  }
  {
    const out = d.buf(1.2);
    for (const [f, g, tau] of [[310, 1, 0.4], [868, 0.6, 0.25], [1420, 0.4, 0.18], [2210, 0.2, 0.1]] as [number, number, number][]) {
      const t = d.tone(1.2, f);
      d.decay(t, tau, 0, 0.0005);
      d.mixIn(out, t, 0, g);
    }
    d.mixIn(out, click(d, 2500, 0.004, 1.5), 0, 1);
    put('shutter_hit', d.fade(d.normalize(out, 0.7)));
  }

  // --------------------------------------------------------- explosions and strikes
  putLo('explosion_small', explosion(lo, 1.6, 0.8));
  bank.set('rocket_impact', bank.get('explosion_small')!);
  putLo('explosion', explosion(lo, 2.6, 1.3));
  {
    const out = d.buf(1.0);
    const rise = d.tone(1.0, (t) => 300 + 1900 * Math.pow(t / 1.0, 2), 'saw');
    d.lowpass(rise, 3000);
    d.envelope(rise, [[0, 0], [0.1, 0.4], [0.8, 1], [0.95, 0]]);
    d.mixIn(out, rise, 0, 0.5);
    for (let k = 0; k < 30; k++) d.mixIn(out, click(d, 3000 + d.rand() * 4000, 0.002, 0.4), d.rand() * 0.9, 0.4);
    put('orbital_charge', d.fade(d.normalize(out, 0.6)));
  }
  {
    const ex = explosion(lo, 3.0, 1.5);
    lo.mixIn(ex, click(lo, 4000, 0.004, 2), 0, 1);
    putLo('orbital_blast', lo.normalize(ex, 0.95));
  }
  putLo('nuke', explosion(lo, 6.0, 3.2));
  {
    // air-raid style warning for the nuke
    const s = d.tone(2.2, (t) => 420 + 260 * Math.sin(Math.min(1, t / 1.1) * Math.PI * 0.5) - (t > 1.4 ? (t - 1.4) * 300 : 0), 'saw');
    d.lowpass(s, 1800);
    d.envelope(s, [[0, 0], [0.3, 0.8], [1.6, 0.8], [2.2, 0]]);
    put('siren', d.fade(d.normalize(d.reverb(s, 1.2, 0.3), 0.55)));
  }

  // --------------------------------------------------------- loops
  {
    // gunship rotor: blade slap train at 19 Hz + turbine whine
    const len = 2.0;
    const b = lo.buf(len + 0.2);
    for (let i = 0; i < b.length; i++) {
      const t = i / lo.sr;
      const p = (t * 19) % 1;
      const slap = Math.exp(-p * 9);
      b[i] = lo.noiseSample() * slap * 0.9;
    }
    lo.lowpass(b, 500);
    const whine = lo.tone(len + 0.2, (t) => 1180 + Math.sin(t * Math.PI) * 6);
    lo.mixIn(b, whine, 0, 0.04);
    const hum = lo.tone(len + 0.2, 76);
    lo.mixIn(b, hum, 0, 0.12);
    putLo('heli_loop', lo.normalize(lo.loopify(b, 0.2), 0.8));
  }
  {
    const len = 8;
    const b = lo.brown(len + 1);
    lo.lowpass(b, (t) => 350 + 250 * Math.sin((t / len) * Math.PI * 2));
    const g = lo.highpass(lo.noise(len + 1), 2000);
    lo.lowpass(g, 4000);
    lo.envelope(g, [[0, 0.02], [3, 0.06], [6, 0.015], [9, 0.02]]);
    lo.mixIn(b, g, 0, 0.6);
    putLo('wind_loop', lo.normalize(lo.loopify(b, 1), 0.6));
  }
  {
    // ominous drone bed for the music bus — frequencies chosen to complete whole cycles in 12 s
    const len = 12;
    const b = lo.buf(len);
    const notes: [number, number][] = [[660 / 12, 0.5], [990 / 12, 0.3], [1570 / 12, 0.18], [1321 / 12, 0.12]];
    for (const [f, g] of notes) {
      for (const det of [-0.12, 0.12]) {
        const t = lo.tone(len, f + (det > 0 ? 1 / 12 : -1 / 12), 'saw');
        lo.mixIn(b, t, 0, g * 0.5);
      }
    }
    lo.lowpass(b, (t) => 260 + 180 * Math.sin((t / len) * Math.PI * 2 * 2));
    const swell = new Float32Array(b.length);
    for (let i = 0; i < b.length; i++) swell[i] = 0.65 + 0.35 * Math.sin((i / b.length) * Math.PI * 2 * 4 - Math.PI / 2);
    for (let i = 0; i < b.length; i++) b[i] *= swell[i];
    // distant metallic hits
    for (let k = 0; k < 4; k++) {
      const hit = lo.tone(3, 97 + k * 13);
      lo.decay(hit, 1.1, 0, 0.01);
      lo.mixIn(b, lo.reverb(hit, 2, 0.6), 0.5 + k * 3, 0.35);
    }
    putLo('drone_loop', lo.normalize(b, 0.55));
  }

  // --------------------------------------------------------- zombie voices
  const vowelOO: [number, number, number][] = [[420, 5, 1], [900, 6, 0.5], [2400, 8, 0.15]];
  const vowelAH: [number, number, number][] = [[700, 5, 1], [1150, 6, 0.6], [2500, 8, 0.2]];
  const vowelEE: [number, number, number][] = [[350, 6, 0.8], [2100, 7, 0.7], [2900, 8, 0.4]];
  for (let i = 0; i < 3; i++) {
    const len = 1.3 + i * 0.25;
    const base = 82 + i * 9;
    put(`groan_shambler_${i}`, voice(d, len, (t) => base + Math.sin(t * 3.1 + i) * 9 - t * 10, i === 1 ? vowelAH : vowelOO, 0.35, 0.5,
      [[0, 0], [0.25, 0.8], [len * 0.6, 1], [len, 0]]));
  }
  for (let i = 0; i < 2; i++) {
    const len = 0.7;
    put(`groan_runner_${i}`, voice(d, len, (t) => 230 + i * 40 + Math.sin(t * 22) * 25 + t * 80, vowelEE, 0.8, 0.35,
      [[0, 0], [0.05, 1], [0.5, 0.8], [len, 0]]));
  }
  for (let i = 0; i < 2; i++) {
    const len = 1.5;
    const v = voice(d, len, (t) => 64 + i * 6 + Math.sin(t * 2) * 5, vowelOO, 0.3, 0.7, [[0, 0], [0.4, 1], [1.1, 0.9], [len, 0]]);
    put(`groan_plated_${i}`, d.normalize(d.reverb(d.lowpass(v, 1300), 0.4, 0.35), 0.8));
  }
  {
    const len = 1.6;
    const v = voice(d, len, (t) => 58 + Math.sin(t * 5) * 8, vowelAH, 0.4, 0.8, [[0, 0], [0.3, 1], [1.2, 0.8], [len, 0]]);
    for (let k = 0; k < 18; k++) {
      const bub = d.sweep(0.05, 300 + d.rand() * 300, 600 + d.rand() * 400, 0.04);
      d.decay(bub, 0.015);
      d.mixIn(v, bub, d.rand() * 1.4, 0.25);
    }
    put('groan_carrier_0', d.normalize(v, 0.85));
  }
  {
    const len = 0.6;
    const h = d.bandpass(d.noise(len), 2600, 2);
    d.envelope(h, [[0, 0], [0.05, 1], [0.4, 0.6], [len, 0]]);
    const v = voice(d, len, (t) => 160 + t * 60, vowelEE, 0.9, 0.6, [[0, 0], [0.05, 0.6], [len, 0]]);
    put('groan_crawler_0', d.fade(d.normalize(d.mixIn(v, d.gain(h, 2), 0, 0.6), 0.75)));
  }
  for (let i = 0; i < 3; i++) {
    const len = 0.9;
    const v = voice(d, len, (t) => (100 + i * 30) * Math.pow(0.45, t / len), i === 2 ? vowelEE : vowelAH, 0.5, 0.4,
      [[0, 0], [0.03, 1], [0.5, 0.5], [len, 0]]);
    put(`death_${i}`, v);
  }
  {
    const out = d.buf(0.8);
    const s = d.lowpass(d.noise(0.6), 1100);
    d.decay(s, 0.08);
    d.mixIn(out, d.gain(s, 2.5), 0, 1);
    for (let k = 0; k < 14; k++) {
      const bub = d.sweep(0.06, 200 + d.rand() * 200, 500 + d.rand() * 300, 0.05);
      d.decay(bub, 0.02);
      d.mixIn(out, bub, 0.05 + d.rand() * 0.5, 0.35);
    }
    put('carrier_burst', d.fade(d.normalize(out, 0.9)));
  }
  put('claw', d.fade(d.normalize(scrape(d, 0.25, 900, 2600, 1), 0.5)));

  // --------------------------------------------------------- cues and UI
  {
    const len = 2.4;
    const b = d.buf(len);
    for (const [f, t0, dur] of [[110, 0, 0.9], [82.4, 0.95, 1.4]] as [number, number, number][]) {
      const horn = d.tone(dur, f, 'saw');
      const h2 = d.tone(dur, f * 1.5, 'saw');
      d.mixIn(horn, h2, 0, 0.45);
      d.lowpass(horn, (t) => 300 + 1200 * Math.min(1, t * 5) * Math.exp(-t * 1.2));
      d.envelope(horn, [[0, 0], [0.06, 1], [dur - 0.2, 0.8], [dur, 0]]);
      d.mixIn(b, horn, t0, 0.7);
    }
    const sq = d.bandpass(d.noise(0.18), 1800, 1.5);
    d.decay(sq, 0.06);
    d.mixIn(b, d.gain(sq, 2), 0, 0.5);
    put('wave_start', d.fade(d.normalize(d.reverb(b, 1.5, 0.35), 0.7)));
  }
  {
    const len = 1.4;
    const b = d.buf(len);
    const sq = d.bandpass(d.noise(0.15), 2000, 1.5);
    d.decay(sq, 0.05);
    d.mixIn(b, d.gain(sq, 2), 0, 0.6);
    for (const [f, t0] of [[392, 0.12], [523, 0.32], [659, 0.52]] as [number, number][]) {
      const t = d.tone(0.8, f, 'tri');
      d.envelope(t, [[0, 0], [0.02, 1], [0.6, 0.4], [0.8, 0]]);
      d.mixIn(b, t, t0, 0.35);
    }
    put('wave_clear', d.fade(d.normalize(d.reverb(b, 1, 0.3), 0.6)));
  }
  put('radio', (() => {
    const s = d.bandpass(d.noise(0.25), 2200, 1.2);
    d.envelope(s, [[0, 0], [0.01, 1], [0.2, 0.6], [0.25, 0]]);
    return d.fade(d.normalize(s, 0.4));
  })());
  put('shop_open', sequence(d, 0.6, [[0, scrape(d, 0.3, 400, 1100, 0.6), 0.6], [0.28, clack(d, 900, 1), 0.9]]));
  put('shop_close', sequence(d, 0.5, [[0, clack(d, 800, 1), 0.9], [0.06, scrape(d, 0.2, 900, 400, 0.4), 0.4]]));
  put('buy', sequence(d, 0.7, [[0, clack(d, 1600, 1), 0.9], [0.08, click(d, 2600, 0.006), 0.7], [0.18, (() => {
    const t = d.tone(0.4, 1568);
    d.decay(t, 0.12);
    return d.mixIn(t, d.decay(d.tone(0.4, 2093), 0.1), 0.05, 0.6);
  })(), 0.4]]));
  put('deny', (() => {
    const t = d.tone(0.28, 98, 'square');
    d.lowpass(t, 700);
    d.envelope(t, [[0, 0], [0.01, 1], [0.24, 0.8], [0.28, 0]]);
    return d.fade(d.normalize(t, 0.45));
  })());
  put('ui_tick', d.fade(d.normalize(click(d, 2400, 0.003, 0.5), 0.3)));
  put('mod_on', sequence(d, 0.6, [[0, click(d, 2600, 0.004), 0.8], [0.06, (() => {
    const t = d.tone(0.4, (tt) => 600 + tt * 1800, 'tri');
    d.envelope(t, [[0, 0], [0.03, 1], [0.35, 0.3], [0.4, 0]]);
    return t;
  })(), 0.4], [0.32, clack(d, 2200), 0.8]]));
  put('shutters_up', sequence(d, 1.4, [
    [0, scrape(d, 0.7, 200, 700, 1), 0.7], [0.68, clack(d, 600, 1.6), 1],
    [0.7, (() => { const s = d.highpass(d.noise(0.6), 3000); d.decay(s, 0.2); return s; })(), 0.25],
  ]));
  put('repair', sequence(d, 1.4, [
    ...Array.from({ length: 4 }, (_, i): Ev => [i * 0.24, clack(d, 1200 + i * 80, 1.1), 0.9]),
    ...Array.from({ length: 6 }, (_, i): Ev => [1.0 + i * 0.04, click(d, 3000, 0.003, 0.4), 0.6]),
  ]));

  return bank;
}
