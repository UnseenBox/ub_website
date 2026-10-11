// Layered procedural shop audio: no assets, everything synthesized.
// Water is a low body + spray hiss + droplet plinks; tools are ratchet clicks
// with pitch jitter; UI is soft ticks and chimes. A voice cap and short,
// quiet voices keep repetition from turning irritating.

export type SfxName =
  | 'wrench' | 'cash' | 'buy' | 'deny' | 'click' | 'done'
  | 'horn' | 'sell' | 'paint' | 'engine'

class AudioBus {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private sfxBus: GainNode | null = null
  private ambBus: GainNode | null = null
  private white: AudioBuffer | null = null
  private brown: AudioBuffer | null = null
  private washNodes: { stop: () => void } | null = null
  private ambienceOn = false
  private clankTimer = 0
  private voices = 0
  muted = false
  volume = 0.8

  /** Must be called from a user gesture at least once. Safe to call often. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      this.startAmbience()
      return
    }
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : this.volume
      this.master.connect(this.ctx.destination)
      this.sfxBus = this.ctx.createGain()
      this.sfxBus.gain.value = 0.9
      this.sfxBus.connect(this.master)
      this.ambBus = this.ctx.createGain()
      this.ambBus.gain.value = 0.5
      this.ambBus.connect(this.master)
      this.white = this.makeNoise(false)
      this.brown = this.makeNoise(true)
      this.startAmbience()
    } catch {
      this.ctx = null
    }
  }

  setMuted(m: boolean): void {
    this.muted = m
    this.applyLevel()
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v))
    this.applyLevel()
  }

  private applyLevel(): void {
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.03)
    }
  }

  private makeNoise(brown: boolean): AudioBuffer | null {
    if (!this.ctx) return null
    const len = this.ctx.sampleRate * 2
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const d = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      if (brown) {
        last = (last + 0.02 * w) / 1.02
        d[i] = last * 3.2
      } else {
        d[i] = w
      }
    }
    return buf
  }

  /** Guards polyphony: returns false when too many voices are already playing. */
  private takeVoice(dur: number): boolean {
    if (!this.ctx || this.muted || this.voices > 7) return false
    this.voices++
    window.setTimeout(() => {
      this.voices = Math.max(0, this.voices - 1)
    }, Math.max(60, dur * 1000))
    return true
  }

  private tone(opts: {
    type: OscillatorType; from: number; to?: number; dur: number; vol: number;
    at?: number; lowpass?: number; bus?: GainNode | null
  }): void {
    if (!this.ctx || !this.sfxBus || !this.takeVoice(opts.dur)) return
    const t = this.ctx.currentTime + (opts.at ?? 0)
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.type = opts.type
    o.frequency.setValueAtTime(Math.max(25, opts.from), t)
    if (opts.to !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(25, opts.to), t + opts.dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(opts.vol, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur)
    o.connect(g)
    if (opts.lowpass) {
      const f = this.ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = opts.lowpass
      g.connect(f)
      f.connect(opts.bus ?? this.sfxBus)
    } else {
      g.connect(opts.bus ?? this.sfxBus)
    }
    o.start(t)
    o.stop(t + opts.dur + 0.05)
  }

  private noise(opts: {
    dur: number; vol: number; at?: number; type: BiquadFilterType;
    freq: number; q?: number; brown?: boolean; bus?: GainNode | null
  }): void {
    if (!this.ctx || !this.sfxBus || !this.takeVoice(opts.dur)) return
    const buf = opts.brown ? this.brown : this.white
    if (!buf) return
    const t = this.ctx.currentTime + (opts.at ?? 0)
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    src.playbackRate.value = 0.9 + Math.random() * 0.2
    const f = this.ctx.createBiquadFilter()
    f.type = opts.type
    f.frequency.value = opts.freq
    f.Q.value = opts.q ?? 0.8
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(opts.vol, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur)
    src.connect(f)
    f.connect(g)
    g.connect(opts.bus ?? this.sfxBus)
    src.start(t, Math.random() * 1.5)
    src.stop(t + opts.dur + 0.05)
  }

  private jitter(amt = 0.08): number {
    return 1 + (Math.random() * 2 - 1) * amt
  }

  play(name: SfxName): void {
    if (!this.ctx || this.muted) return
    switch (name) {
      case 'click':
        this.tone({ type: 'triangle', from: 1250 * this.jitter(0.05), dur: 0.035, vol: 0.1, lowpass: 3200 })
        break
      case 'deny':
        this.tone({ type: 'sine', from: 175, to: 140, dur: 0.16, vol: 0.2 })
        break
      case 'cash':
        this.tone({ type: 'sine', from: 1568, dur: 0.12, vol: 0.2 })
        this.tone({ type: 'sine', from: 2093, dur: 0.2, vol: 0.14, at: 0.05 })
        this.noise({ dur: 0.05, vol: 0.06, type: 'highpass', freq: 5000 })
        break
      case 'sell':
        this.tone({ type: 'sine', from: 1568, dur: 0.1, vol: 0.2 })
        this.tone({ type: 'triangle', from: 659, dur: 0.12, vol: 0.2, at: 0.08 })
        this.tone({ type: 'triangle', from: 784, dur: 0.22, vol: 0.22, at: 0.16 })
        break
      case 'done':
        this.tone({ type: 'sine', from: 880, dur: 0.14, vol: 0.18 })
        this.tone({ type: 'sine', from: 1318, dur: 0.24, vol: 0.15, at: 0.1 })
        break
      case 'engine':
        for (let i = 0; i < 3; i++) {
          this.tone({ type: 'square', from: 58 * this.jitter(), dur: 0.09, vol: 0.22, at: i * 0.13, lowpass: 420 })
        }
        this.tone({ type: 'sawtooth', from: 110, to: 165, dur: 0.4, vol: 0.06, at: 0.4, lowpass: 700 })
        break
      case 'buy':
        this.tone({ type: 'sine', from: 150, to: 75, dur: 0.18, vol: 0.45 })
        this.tone({ type: 'triangle', from: 392, dur: 0.12, vol: 0.16, at: 0.06 })
        this.tone({ type: 'triangle', from: 523, dur: 0.2, vol: 0.16, at: 0.13 })
        break
      case 'horn': {
        const base = 400 * this.jitter(0.06)
        this.tone({ type: 'sawtooth', from: base, dur: 0.32, vol: 0.1, lowpass: 1500 })
        this.tone({ type: 'sawtooth', from: base * 1.25, dur: 0.32, vol: 0.08, lowpass: 1500 })
        break
      }
      case 'wrench':
        // ratchet clicks + metallic tick, timing and pitch vary every hit
        {
          const n = 2 + Math.floor(Math.random() * 3)
          for (let i = 0; i < n; i++) {
            this.noise({ dur: 0.03, vol: 0.1, at: i * 0.045, type: 'highpass', freq: 2600 * this.jitter() })
          }
          this.tone({ type: 'triangle', from: 720 * this.jitter(), to: 420, dur: 0.05, vol: 0.06, at: 0.01 })
        }
        break
      case 'paint':
        this.noise({ dur: 0.5, vol: 0.16, type: 'bandpass', freq: 5200, q: 1.1 })
        break
    }
  }

  /** Layered water loop: low body + spray hiss (LFO) + droplet plinks. */
  startWash(): void {
    if (!this.ctx || !this.sfxBus || !this.white || !this.brown || this.muted || this.washNodes) return
    const ctx = this.ctx
    const mk = (buf: AudioBuffer, type: BiquadFilterType, freq: number, q: number, vol: number) => {
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      const f = ctx.createBiquadFilter()
      f.type = type
      f.frequency.value = freq
      f.Q.value = q
      const g = ctx.createGain()
      g.gain.value = 0.0001
      g.gain.setTargetAtTime(vol, ctx.currentTime, 0.15)
      src.connect(f)
      f.connect(g)
      g.connect(this.sfxBus as GainNode)
      src.start()
      return { src, gain: g }
    }
    const body = mk(this.brown, 'lowpass', 480, 0.6, 0.2)
    const spray = mk(this.white, 'bandpass', 2700, 0.7, 0.2)
    // slow hand-movement swell on the spray
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    lfo.frequency.value = 1.1
    lfoGain.gain.value = 0.06
    lfo.connect(lfoGain)
    lfoGain.connect(spray.gain.gain)
    lfo.start()
    // droplets
    const drops = window.setInterval(() => {
      if (this.muted || !this.washNodes) return
      if (Math.random() < 0.55) {
        this.tone({ type: 'sine', from: 1500 + Math.random() * 1800, dur: 0.06, vol: 0.035 })
      }
    }, 130)
    this.washNodes = {
      stop: () => {
        window.clearInterval(drops)
        try { lfo.stop() } catch { /* stopped */ }
        for (const { src, gain } of [body, spray]) {
          gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.1)
          window.setTimeout(() => {
            try { src.stop() } catch { /* stopped */ }
          }, 450)
        }
      },
    }
  }

  stopWash(): void {
    const w = this.washNodes
    this.washNodes = null
    if (w) {
      try {
        w.stop()
      } catch { /* ignore */ }
    }
  }

  /** Quiet workshop bed: airy room tone + hum + rare distant clank. */
  private startAmbience(): void {
    if (!this.ctx || !this.ambBus || !this.brown || this.ambienceOn) return
    this.ambienceOn = true
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = this.brown
    src.loop = true
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 220
    const g = ctx.createGain()
    g.gain.value = 0.05
    src.connect(f)
    f.connect(g)
    g.connect(this.ambBus)
    src.start()
    const hum = ctx.createOscillator()
    hum.type = 'sine'
    hum.frequency.value = 48
    const hg = ctx.createGain()
    hg.gain.value = 0.012
    hum.connect(hg)
    hg.connect(this.ambBus)
    hum.start()
    const clank = () => {
      this.clankTimer = window.setTimeout(() => {
        if (!this.muted) {
          this.tone({ type: 'triangle', from: 620 * this.jitter(0.15), to: 300, dur: 0.14, vol: 0.022, bus: this.ambBus })
        }
        clank()
      }, 9000 + Math.random() * 12000)
    }
    clank()
    void this.clankTimer
  }

  /** Short impact thud for purchases / unlocks. */
  thud(): void {
    this.tone({ type: 'sine', from: 120, to: 65, dur: 0.22, vol: 0.55 })
  }
}

export const audio = new AudioBus()
