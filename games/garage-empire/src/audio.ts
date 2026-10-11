// Procedural WebAudio: no assets, tiny footprint, mutable. All sounds are
// synthesized (noise buffers + oscillators) and respect autoplay policies by
// initializing on the first user gesture.

type SfxName = 'wash' | 'wrench' | 'cash' | 'buy' | 'deny' | 'click' | 'done' | 'horn' | 'sell' | 'paint'

class AudioBus {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private washNodes: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null
  muted = false

  /** Must be called from a user gesture at least once. Safe to call often. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.5
      this.master.connect(this.ctx.destination)
    } catch {
      this.ctx = null
    }
  }

  setMuted(m: boolean): void {
    this.muted = m
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.02)
    }
  }

  private noiseBuffer(len = 1): AudioBuffer | null {
    if (!this.ctx) return null
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    return buf
  }

  private blip(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.5, when = 0, slide = 0): void {
    if (!this.ctx || !this.master || this.muted) return
    const t = this.ctx.currentTime + when
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slide !== 0) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(this.master)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  play(name: SfxName): void {
    if (!this.ctx || this.muted) return
    switch (name) {
      case 'click': this.blip(660, 0.07, 'triangle', 0.3); break
      case 'deny': this.blip(160, 0.18, 'square', 0.25); break
      case 'cash':
        this.blip(880, 0.09, 'sine', 0.5)
        this.blip(1320, 0.16, 'sine', 0.5, 0.08)
        break
      case 'sell':
        this.blip(523, 0.1, 'triangle', 0.5)
        this.blip(659, 0.1, 'triangle', 0.5, 0.09)
        this.blip(784, 0.22, 'triangle', 0.55, 0.18)
        break
      case 'buy': this.blip(392, 0.12, 'triangle', 0.5); this.blip(523, 0.2, 'triangle', 0.5, 0.1); break
      case 'done':
        this.blip(659, 0.12, 'sine', 0.5)
        this.blip(880, 0.2, 'sine', 0.5, 0.11)
        break
      case 'horn': this.blip(330, 0.28, 'sawtooth', 0.22, 0, -60); break
      case 'wrench':
        this.blip(220 + Math.random() * 120, 0.06, 'square', 0.16)
        this.blip(440 + Math.random() * 200, 0.05, 'square', 0.1, 0.07)
        break
      case 'paint':
        this.startWash(900, 0.25, 0.5)
        window.setTimeout(() => this.stopWash(), 450)
        break
      case 'wash': break // wash uses the loop below
    }
  }

  /** Looping spray noise while washing / detailing. Call stopWash() when done. */
  startWash(freq = 2400, q = 0.4, vol = 0.35): void {
    if (!this.ctx || !this.master || this.muted || this.washNodes) return
    const buf = this.noiseBuffer(1)
    if (!buf) return
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = freq
    filter.Q.value = q
    const gain = this.ctx.createGain()
    gain.gain.value = 0.0001
    gain.gain.setTargetAtTime(vol * 0.6, this.ctx.currentTime, 0.1)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    src.start()
    this.washNodes = { src, gain, filter }
  }

  stopWash(): void {
    if (!this.ctx || !this.washNodes) return
    const { src, gain } = this.washNodes
    this.washNodes = null
    gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08)
    window.setTimeout(() => {
      try { src.stop() } catch { /* already stopped */ }
    }, 350)
  }

  /** Short impact thud for purchases / unlocks. */
  thud(): void {
    this.blip(120, 0.22, 'sine', 0.7, 0, -50)
  }
}

export const audio = new AudioBus()
