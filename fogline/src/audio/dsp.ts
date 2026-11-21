// Tiny offline DSP toolkit used to synthesize every sound in the game at boot.
// All functions work on Float32Array sample buffers at a fixed sample rate.

export class Dsp {
  private seed = 1234567;
  constructor(readonly sr: number) {}

  rand(): number {
    // xorshift — deterministic so every boot sounds identical
    let x = this.seed;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.seed = x >>> 0;
    return this.seed / 4294967296;
  }
  noiseSample(): number {
    return this.rand() * 2 - 1;
  }

  buf(seconds: number): Float32Array {
    return new Float32Array(Math.max(1, Math.ceil(seconds * this.sr)));
  }

  noise(seconds: number): Float32Array {
    const b = this.buf(seconds);
    for (let i = 0; i < b.length; i++) b[i] = this.noiseSample();
    return b;
  }

  /** Brown-ish noise for rumble/wind. */
  brown(seconds: number): Float32Array {
    const b = this.buf(seconds);
    let v = 0;
    for (let i = 0; i < b.length; i++) {
      v = (v + 0.02 * this.noiseSample()) / 1.02;
      b[i] = v * 3.5;
    }
    return b;
  }

  lowpass(b: Float32Array, cutoff: number | ((t: number) => number)): Float32Array {
    let y = 0;
    const f = typeof cutoff === 'function' ? cutoff : () => cutoff;
    for (let i = 0; i < b.length; i++) {
      const fc = f(i / this.sr);
      const a = 1 - Math.exp((-2 * Math.PI * fc) / this.sr);
      y += a * (b[i] - y);
      b[i] = y;
    }
    return b;
  }

  highpass(b: Float32Array, cutoff: number): Float32Array {
    const a = Math.exp((-2 * Math.PI * cutoff) / this.sr);
    let y = 0, xp = 0;
    for (let i = 0; i < b.length; i++) {
      const x = b[i];
      y = a * (y + x - xp);
      xp = x;
      b[i] = y;
    }
    return b;
  }

  /** RBJ biquad band-pass (constant peak gain). */
  bandpass(b: Float32Array, freq: number | ((t: number) => number), q: number): Float32Array {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    const ff = typeof freq === 'function' ? freq : () => freq;
    let lastF = -1, b0 = 0, b2 = 0, a1 = 0, a2 = 0;
    for (let i = 0; i < b.length; i++) {
      const f = ff(i / this.sr);
      if (Math.abs(f - lastF) > 0.5) {
        lastF = f;
        const w = (2 * Math.PI * Math.min(f, this.sr * 0.45)) / this.sr;
        const alpha = Math.sin(w) / (2 * q);
        const a0 = 1 + alpha;
        b0 = alpha / a0; b2 = -alpha / a0; a1 = (-2 * Math.cos(w)) / a0; a2 = (1 - alpha) / a0;
      }
      const x = b[i];
      const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      b[i] = y;
    }
    return b;
  }

  /** Multiply by an exponential decay envelope starting at `start` seconds. */
  decay(b: Float32Array, tau: number, start = 0, attack = 0.0005): Float32Array {
    const s0 = Math.floor(start * this.sr);
    for (let i = 0; i < b.length; i++) {
      if (i < s0) { b[i] = 0; continue; }
      const t = (i - s0) / this.sr;
      const a = t < attack ? t / attack : 1;
      b[i] *= a * Math.exp(-t / tau);
    }
    return b;
  }

  envelope(b: Float32Array, points: [number, number][]): Float32Array {
    for (let i = 0; i < b.length; i++) {
      const t = i / this.sr;
      let v = points[points.length - 1][1];
      for (let k = 0; k < points.length - 1; k++) {
        const [t0, v0] = points[k], [t1, v1] = points[k + 1];
        if (t >= t0 && t <= t1) { v = v0 + ((v1 - v0) * (t - t0)) / (t1 - t0 || 1); break; }
        if (t < points[0][0]) { v = points[0][1]; break; }
      }
      b[i] *= v;
    }
    return b;
  }

  /** Sine with a pitch envelope (exponential glide f0→f1 over `glide` seconds). */
  sweep(seconds: number, f0: number, f1: number, glide: number, wave: 'sine' | 'saw' | 'square' = 'sine'): Float32Array {
    const b = this.buf(seconds);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / this.sr;
      const k = Math.min(1, t / glide);
      const f = f0 * Math.pow(f1 / f0, k);
      ph += f / this.sr;
      const p = ph % 1;
      b[i] = wave === 'sine' ? Math.sin(p * Math.PI * 2) : wave === 'saw' ? p * 2 - 1 : p < 0.5 ? 1 : -1;
    }
    return b;
  }

  tone(seconds: number, f: number | ((t: number) => number), wave: 'sine' | 'saw' | 'square' | 'tri' = 'sine', phase = 0): Float32Array {
    const b = this.buf(seconds);
    const ff = typeof f === 'function' ? f : () => f;
    let ph = phase;
    for (let i = 0; i < b.length; i++) {
      ph += ff(i / this.sr) / this.sr;
      const p = ph - Math.floor(ph);
      b[i] = wave === 'sine' ? Math.sin(p * Math.PI * 2) : wave === 'saw' ? p * 2 - 1 : wave === 'square' ? (p < 0.5 ? 1 : -1) : 1 - 4 * Math.abs(p - 0.5);
    }
    return b;
  }

  /** Mix `src` into `dst` at offset seconds with gain. */
  mixIn(dst: Float32Array, src: Float32Array, offset = 0, gain = 1): Float32Array {
    const o = Math.floor(offset * this.sr);
    for (let i = 0; i < src.length && i + o < dst.length; i++) if (i + o >= 0) dst[i + o] += src[i] * gain;
    return dst;
  }

  gain(b: Float32Array, g: number): Float32Array {
    for (let i = 0; i < b.length; i++) b[i] *= g;
    return b;
  }

  saturate(b: Float32Array, drive: number): Float32Array {
    const n = Math.tanh(drive);
    for (let i = 0; i < b.length; i++) b[i] = Math.tanh(b[i] * drive) / n;
    return b;
  }

  /** Feedback-delay echo (outdoor slap-back off terrain). */
  echo(b: Float32Array, delay: number, feedback: number, lp: number, taps = 3): Float32Array {
    const d = Math.floor(delay * this.sr);
    const out = new Float32Array(b.length);
    out.set(b);
    let src: Float32Array = Float32Array.from(b);
    let g = 1;
    for (let k = 1; k <= taps; k++) {
      g *= feedback;
      src = this.lowpass(Float32Array.from(src), lp / k);
      for (let i = 0; i + d * k < out.length; i++) out[i + d * k] += src[i] * g;
    }
    return out;
  }

  /** Small Schroeder reverb for interior / metallic ambience. */
  reverb(b: Float32Array, size: number, mix: number): Float32Array {
    const combs = [0.0297, 0.0371, 0.0411, 0.0437].map((t) => Math.floor(t * size * this.sr));
    const out = new Float32Array(b.length);
    for (const len of combs) {
      const line = new Float32Array(len);
      let idx = 0;
      for (let i = 0; i < b.length; i++) {
        const y = line[idx];
        line[idx] = b[i] + y * 0.78;
        idx = (idx + 1) % len;
        out[i] += y * 0.25;
      }
    }
    for (let i = 0; i < b.length; i++) out[i] = b[i] * (1 - mix) + out[i] * mix;
    return out;
  }

  normalize(b: Float32Array, peak = 0.9): Float32Array {
    let m = 0;
    for (let i = 0; i < b.length; i++) m = Math.max(m, Math.abs(b[i]));
    if (m > 0) this.gain(b, peak / m);
    return b;
  }

  /** Short fade-in/out to avoid clicks; for loops, crossfade tail into head. */
  fade(b: Float32Array, inS = 0.002, outS = 0.01): Float32Array {
    const ni = Math.floor(inS * this.sr), no = Math.floor(outS * this.sr);
    for (let i = 0; i < ni && i < b.length; i++) b[i] *= i / ni;
    for (let i = 0; i < no && i < b.length; i++) b[b.length - 1 - i] *= i / no;
    return b;
  }

  loopify(b: Float32Array, xfade: number): Float32Array {
    const n = Math.floor(xfade * this.sr);
    const out = b.slice(0, b.length - n);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      out[i] = out[i] * t + b[b.length - n + i] * (1 - t);
    }
    return out;
  }
}
