// Procedural Web Audio SFX — no assets. Lazy AudioContext, master gain, sound toggle.
let ctx = null, master = null, enabled = true;
try { enabled = JSON.parse(localStorage.getItem('ktd_sound') ?? 'true'); } catch { enabled = true; }

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function isSoundOn() { return enabled; }
export function setSoundOn(v) {
  enabled = !!v;
  try { localStorage.setItem('ktd_sound', JSON.stringify(enabled)); } catch {}
  if (master) master.gain.value = enabled ? 0.5 : 0;
}

function env(g, t0, peak, dur) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
}

function tone(freq, dur, type = 'sine', vol = 0.3, slide = 0) {
  if (!enabled) return;
  try {
    const c = ac(), t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    env(g, t, vol, dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  } catch {}
}

function noise(dur, vol = 0.3, filterFreq = 1200, q = 0.8, slideTo = 0) {
  if (!enabled) return;
  try {
    const c = ac(), t = c.currentTime;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(filterFreq, t); f.Q.value = q;
    if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = c.createGain(); env(g, t, vol, dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  } catch {}
}

const lastPlay = {};
function throttle(key, ms) {
  const n = performance.now();
  if (lastPlay[key] && n - lastPlay[key] < ms) return true;
  lastPlay[key] = n; return false;
}

export const sfx = {
  unlock() { try { ac(); } catch {} },
  launch(power = 1) {
    if (throttle('launch', 120)) return;
    noise(0.28, 0.25, 900, 0.7, 2600);
    tone(220 + power * 160, 0.22, 'triangle', 0.18, 220);
  },
  impact(speed = 400, heavy = false) {
    if (throttle('impact', 70)) return;
    const v = Math.min(0.5, 0.1 + speed / 2200);
    noise(0.12, v, heavy ? 320 : 700, 0.9);
    tone(heavy ? 95 : 150, 0.12, 'sine', v * 0.9, -40);
  },
  wood(speed = 400) {
    if (throttle('wood', 90)) return;
    const v = Math.min(0.45, 0.08 + speed / 2400);
    noise(0.1, v, 1400, 1.4);
    tone(300 + Math.random() * 120, 0.09, 'triangle', v * 0.7, -80);
  },
  stone(speed = 500) {
    if (throttle('stone', 90)) return;
    const v = Math.min(0.5, 0.1 + speed / 2000);
    noise(0.14, v, 380, 1.0);
    tone(110 + Math.random() * 30, 0.14, 'sine', v, -30);
  },
  glass() {
    if (throttle('glass', 90)) return;
    noise(0.22, 0.32, 4200, 2.2, 6400);
    tone(1900 + Math.random() * 700, 0.16, 'square', 0.06, 900);
    tone(2600 + Math.random() * 600, 0.12, 'sine', 0.1, -600);
  },
  pop() {
    if (throttle('pop', 120)) return;
    tone(520, 0.12, 'square', 0.14, 320);
    tone(880, 0.16, 'sine', 0.2, 240);
  },
  split() {
    if (throttle('split', 150)) return;
    noise(0.18, 0.3, 2200, 1.2, 800);
    tone(600, 0.14, 'sawtooth', 0.12, -250);
  },
  collapse() {
    if (throttle('collapse', 600)) return;
    noise(0.6, 0.4, 500, 0.7, 150);
    tone(80, 0.5, 'sine', 0.35, -25);
  },
  win() {
    if (throttle('win', 800)) return;
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.28, 'triangle', 0.25), i * 110));
  },
  lose() {
    if (throttle('lose', 800)) return;
    [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.2), i * 150));
  },
  click() { tone(700, 0.06, 'sine', 0.12); },
  stretch(p = 0) { if (!throttle('stretch', 120)) tone(180 + p * 300, 0.07, 'sine', 0.06); },
};
