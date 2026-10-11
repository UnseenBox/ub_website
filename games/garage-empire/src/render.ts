// Isometric software renderer: stylized low-poly look, all procedural.
// Camera follows the player; static ground is cached per unlock-signature.

import { SERVICES, STATIONS, UNLOCKS, carValue, offerPrice, type StationId } from './config'
import type { Car, Game, Worker } from './sim'
import { DECOR, ENTRANCE, GARAGE_BUILDING, HIRE_BOARD, MAP_W, PARKING_BASE, PARKING_EXTRA, STATION_RECTS } from './world'

interface Particle {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  max: number
  color: string
  size: number
}

const WORKER_COLORS: Record<string, string> = {
  washer: '#38bdf8',
  mechanic: '#fb923c',
  detailer: '#2dd4bf',
  seller: '#a78bfa',
}

export class Renderer {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  cam = { x: 12.5, y: 10 }
  tw = 56
  private ground: HTMLCanvasElement | null = null
  private groundKey = ''
  particles: Particle[] = []
  bursts: { x: number; y: number; t: number }[] = []

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    this.ctx = ctx
  }

  resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = this.canvas.clientWidth || window.innerWidth
    const h = this.canvas.clientHeight || window.innerHeight
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.tw = Math.max(30, Math.min(64, Math.min(w, h) / 13))
  }

  get w(): number {
    return this.canvas.width
  }
  get h(): number {
    return this.canvas.height
  }

  burst(x: number, y: number): void {
    this.bursts.push({ x, y, t: 0 })
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2
      this.particles.push({
        x, y, z: 0.5,
        vx: Math.cos(a) * (1 + Math.random() * 2.5),
        vy: Math.sin(a) * (1 + Math.random() * 2.5),
        vz: 2 + Math.random() * 3,
        life: 0, max: 0.7 + Math.random() * 0.5,
        color: ['#facc15', '#4ade80', '#38bdf8', '#f472b6'][i % 4],
        size: 3 + Math.random() * 4,
      })
    }
  }

  private spawnWorkFx(car: Car): void {
    if (!car.work) return
    const s = car.work.service
    const n = s === 'wash' ? 3 : 2
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 320) return
      const palette =
        s === 'wash' ? ['#7dd3fc', '#e0f2fe', '#ffffff']
        : s === 'paint' ? ['#f472b6', '#facc15', '#a78bfa']
        : s === 'detail' ? ['#ffffff', '#fef9c3', '#5eead4']
        : ['#fdba74', '#e5e7eb', '#facc15']
      this.particles.push({
        x: car.x + (Math.random() - 0.5) * 1.8,
        y: car.y + (Math.random() - 0.5) * 1.4,
        z: 0.2 + Math.random() * 0.5,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        vz: 1 + Math.random() * 1.5,
        life: 0, max: 0.5 + Math.random() * 0.4,
        color: palette[Math.floor(Math.random() * palette.length)],
        size: 2 + Math.random() * (s === 'wash' ? 5 : 3),
      })
    }
    // dust while driving
    if (car.path.length > 0 && Math.random() < 0.35) {
      this.particles.push({
        x: car.x, y: car.y, z: 0.1,
        vx: (Math.random() - 0.5), vy: (Math.random() - 0.5), vz: 0.8,
        life: 0, max: 0.6, color: '#d6c9a8', size: 4,
      })
    }
  }

  // ---- projection ----

  private get th(): number {
    return this.tw / 2
  }

  sx(x: number, y: number): number {
    return ((x - this.cam.x - (y - this.cam.y)) * this.tw) / 2 + this.w / 2
  }
  sy(x: number, y: number, z = 0): number {
    return (((x - this.cam.x + (y - this.cam.y)) * this.th) / 2 + this.h / 2 - z * this.tw) + this.tw * 0.4
  }

  screenToWorld(px: number, py: number): { x: number; y: number } {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const sx = px * dpr
    const sy = py * dpr
    const a = (sx - this.w / 2) / (this.tw / 2)
    const b = (sy - this.h / 2 - this.tw * 0.4) / (this.th / 2)
    return { x: this.cam.x + (a + b) / 2, y: this.cam.y + (b - a) / 2 }
  }

  // ---- ground cache ----

  private signature(game: Game): string {
    return `${this.w}x${this.h}x${this.tw.toFixed(1)}|${game.save.unlocks.join(',')}`
  }

  private buildGround(game: Game): void {
    const g = document.createElement('canvas')
    g.width = this.w
    g.height = this.h
    const c = g.getContext('2d')
    if (!c) return
    // grass base
    const grad = c.createLinearGradient(0, 0, 0, this.h)
    grad.addColorStop(0, '#8fd07a')
    grad.addColorStop(1, '#6fb457')
    c.fillStyle = grad
    c.fillRect(0, 0, this.w, this.h)
    const tile = (x: number, y: number, w: number, h: number, fill: string, alt?: string) => {
      const x0 = this.sx(x, y)
      const x1 = this.sx(x + w, y)
      const x2 = this.sx(x + w, y + h)
      const x3 = this.sx(x, y + h)
      const y0 = this.sy(x, y)
      const y1 = this.sy(x + w, y)
      const y2 = this.sy(x + w, y + h)
      const y3 = this.sy(x, y + h)
      c.beginPath()
      c.moveTo(x0, y0)
      c.lineTo(x1, y1)
      c.lineTo(x2, y2)
      c.lineTo(x3, y3)
      c.closePath()
      c.fillStyle = (alt && (Math.round(x + y) % 2 === 0)) ? alt : fill
      c.fill()
    }
    // concrete yard
    for (let x = 1; x < MAP_W - 1; x++) {
      for (let y = 1; y < 19; y++) {
        tile(x, y, 1, 1, '#d3ccbe', '#cdc5b5')
      }
    }
    // zone tints
    const tint = (x: number, y: number, w: number, h: number, col: string) => {
      const x0 = this.sx(x, y)
      const x2 = this.sx(x + w, y + h)
      void x0
      void x2
      tile(x, y, w, h, col)
    }
    tint(10.6, 1.6, 8.6, 4.2, 'rgba(56,189,248,0.20)') // wash row
    tint(2.6, 7.6, 23.4, 4.4, 'rgba(251,146,60,0.13)') // repair row
    tint(23.6, 1.6, 5.4, 6.4, 'rgba(250,204,21,0.16)') // used lot
    tint(23.6, 8.6, 5, 3.6, 'rgba(167,139,250,0.14)') // sale
    tint(23.2, 13.2, 6, 4.4, 'rgba(241,245,249,0.55)') // showroom
    // road
    for (let x = 0; x < MAP_W; x++) {
      tile(x, 19, 1, 1, '#525b69')
      tile(x, 20, 1, 1, '#4b5361')
      tile(x, 21, 1, 1, '#525b69')
    }
    // lane dashes
    c.fillStyle = '#fbbf24'
    for (let x = 0; x < MAP_W; x += 2) {
      const dx = this.sx(x + 0.3, 20.4)
      const dy = this.sy(x + 0.3, 20.4)
      c.save()
      c.translate(dx, dy)
      c.rotate(Math.atan2(this.th, this.tw))
      c.fillRect(-this.tw * 0.28, -2, this.tw * 0.56, 4)
      c.restore()
    }
    // driveway
    tile(12.4, 17.6, 2.2, 1.6, '#b9b0a0')
    // parking slot outlines
    c.lineWidth = 2
    for (const p of [...PARKING_BASE, ...PARKING_EXTRA]) {
      const cx = this.sx(p.x, p.y)
      const cy = this.sy(p.x, p.y)
      c.strokeStyle = 'rgba(255,255,255,0.75)'
      c.beginPath()
      c.ellipse(cx, cy, this.tw * 1.05, this.tw * 0.55, 0, 0, Math.PI * 2)
      c.stroke()
    }
    this.ground = g
    this.groundKey = this.signature(game)
  }

  // ---- frame ----

  render(game: Game, time: number, dt: number): void {
    const { ctx } = this
    // smooth camera
    this.cam.x += (game.player.x - this.cam.x) * Math.min(1, dt * 4)
    this.cam.y += (game.player.y - 1.2 - this.cam.y) * Math.min(1, dt * 4)
    if (this.signature(game) !== this.groundKey || !this.ground) this.buildGround(game)
    ctx.clearRect(0, 0, this.w, this.h)
    if (this.ground) ctx.drawImage(this.ground, 0, 0)

    // update particles
    for (const p of this.particles) {
      p.life += dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      p.vz -= 4 * dt
      if (p.z < 0) {
        p.z = 0
        p.vz = 0
      }
    }
    this.particles = this.particles.filter((p) => p.life < p.max)
    for (const b of this.bursts) b.t += dt
    this.bursts = this.bursts.filter((b) => b.t < 0.9)

    // collect drawables, painter's order by depth
    interface Item {
      d: number
      f: () => void
    }
    const items: Item[] = []
    const depth = (x: number, y: number) => x + y

    // entrance arch
    items.push({ d: depth(ENTRANCE.x, 19) - 0.5, f: () => this.drawArch() })
    // buildings
    items.push({ d: depth(3, 5) + 2, f: () => this.drawGarage(game) })
    if (game.hasUnlock('showroom')) items.push({ d: depth(26, 17.4), f: () => this.drawShowroom() })
    // stations
    for (const id of Object.keys(STATION_RECTS) as StationId[]) {
      const locked = !game.stationUnlocked(id)
      items.push({
        d: depth(STATION_RECTS[id].x + 1.5, STATION_RECTS[id].y + 3),
        f: () => this.drawStation(game, id, locked, time),
      })
    }
    // pressure tank prop
    if (game.hasUnlock('pressure')) items.push({ d: depth(10, 4.8), f: () => this.drawTank() })
    // expansion purchase pads (non-station unlocks): dashed claim + price tag
    for (const pd of game.pads()) {
      const def = UNLOCKS.find((u) => u.id === pd.unlockId)
      if (def) {
        items.push({
          d: depth(pd.cx, pd.cy) - 0.1,
          f: () => {
            const { ctx } = this
            const x0 = this.sx(pd.x, pd.y)
            const x1 = this.sx(pd.x + pd.w, pd.y)
            const x2 = this.sx(pd.x + pd.w, pd.y + pd.h)
            const x3 = this.sx(pd.x, pd.y + pd.h)
            const y0 = this.sy(pd.x, pd.y)
            const y1 = this.sy(pd.x + pd.w, pd.y)
            const y2 = this.sy(pd.x + pd.w, pd.y + pd.h)
            const y3 = this.sy(pd.x, pd.y + pd.h)
            ctx.save()
            ctx.strokeStyle = 'rgba(250,204,21,0.85)'
            ctx.lineWidth = 2.5
            ctx.setLineDash([8, 6])
            ctx.beginPath()
            ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3)
            ctx.closePath()
            ctx.stroke()
            ctx.restore()
            this.label(`${def.icon} $${def.cost}`, pd.cx, pd.cy, 1.2, { bg: '#713f12', fg: '#fde68a', size: 12 })
          },
        })
      }
    }
    // billboard
    if (game.hasUnlock('billboard')) items.push({ d: depth(19.3, 16), f: () => this.drawBillboard() })
    // hire board
    items.push({ d: depth(HIRE_BOARD.x, HIRE_BOARD.y), f: () => this.drawHireBoard() })
    // decor
    for (const p of DECOR) items.push({ d: depth(p.x, p.y), f: () => this.drawDecor(p.kind, p.x, p.y, p.s, time) })
    // sale / showroom back walls drawn in ground; price tags drawn with cars

    // cars
    for (const car of game.cars) {
      this.spawnWorkFx(car)
      items.push({ d: depth(car.x, car.y) + 0.05, f: () => this.drawCar(game, car, time) })
    }
    // characters: workers then player
    for (const w of game.workers) items.push({ d: depth(w.x, w.y) + 0.1, f: () => this.drawWorker(w, time) })
    items.push({
      d: depth(game.player.x, game.player.y) + 0.12,
      f: () => this.drawPlayer(game, time),
    })

    items.sort((a, b) => a.d - b.d)
    for (const it of items) it.f()

    // particles on top
    for (const p of this.particles) {
      const a = 1 - p.life / p.max
      ctx.globalAlpha = Math.max(0, a)
      ctx.fillStyle = p.color
      const px = this.sx(p.x, p.y)
      const py = this.sy(p.x, p.y, p.z)
      const s = (p.size * this.tw) / 56
      ctx.beginPath()
      ctx.arc(px, py, s, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    // unlock bursts
    for (const b of this.bursts) {
      const px = this.sx(b.x, b.y)
      const py = this.sy(b.x, b.y, 0.4)
      ctx.strokeStyle = `rgba(250,204,21,${1 - b.t})`
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(px, py, b.t * this.tw * 3, 0, Math.PI * 2)
      ctx.stroke()
    }

    this.drawVignette()
  }

  private drawVignette(): void {
    const { ctx } = this
    const g = ctx.createRadialGradient(
      this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.45,
      this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75,
    )
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(10,15,30,0.28)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, this.w, this.h)
  }

  // ---- pieces ----

  private shadow(x: number, y: number, rx: number, ry: number): void {
    const { ctx } = this
    ctx.fillStyle = 'rgba(20,25,40,0.22)'
    ctx.beginPath()
    ctx.ellipse(this.sx(x, y), this.sy(x, y) + 2, rx * this.tw, ry * this.tw, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  private box3d(x: number, y: number, w: number, h: number, z: number, top: string, left: string, right: string, base = 0): void {
    // an isometric box: footprint w x h at tile (x,y), bottom at elevation
    // `base`, height z (all in tiles)
    const { ctx } = this
    const p = (wx: number, wy: number, wz: number) => ({ x: this.sx(wx, wy), y: this.sy(wx, wy, wz + base) })
    const a = p(x, y, 0)
    const b = p(x + w, y, 0)
    const cc = p(x + w, y + h, 0)
    const d = p(x, y + h, 0)
    const a2 = p(x, y, z)
    const b2 = p(x + w, y, z)
    const c2 = p(x + w, y + h, z)
    const d2 = p(x, y + h, z)
    ctx.fillStyle = left
    ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(cc.x, cc.y); ctx.lineTo(c2.x, c2.y); ctx.lineTo(d2.x, d2.y); ctx.closePath(); ctx.fill()
    ctx.fillStyle = right
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(cc.x, cc.y); ctx.lineTo(c2.x, c2.y); ctx.lineTo(b2.x, b2.y); ctx.closePath(); ctx.fill()
    ctx.fillStyle = top
    ctx.beginPath(); ctx.moveTo(a2.x, a2.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(c2.x, c2.y); ctx.lineTo(d2.x, d2.y); ctx.closePath(); ctx.fill()
    void a
  }

  private label(text: string, x: number, y: number, z: number, opts?: { bg?: string; fg?: string; size?: number }): void {
    const { ctx } = this
    const size = ((opts?.size ?? 13) * this.tw) / 56
    ctx.font = `700 ${size}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const px = this.sx(x, y)
    const py = this.sy(x, y, z)
    const w = ctx.measureText(text).width + size * 0.9
    ctx.fillStyle = opts?.bg ?? 'rgba(15,23,42,0.85)'
    ctx.beginPath()
    ctx.roundRect(px - w / 2, py - size * 0.85, w, size * 1.7, size * 0.8)
    ctx.fill()
    ctx.fillStyle = opts?.fg ?? '#fff'
    ctx.fillText(text, px, py)
  }

  private drawArch(): void {
    // two posts + hanging sign (label positions the sign, no ctx needed here)
    this.box3d(ENTRANCE.x - 2.3, 20.2, 0.35, 0.35, 1.9, '#f97316', '#c2410c', '#ea580c')
    this.box3d(ENTRANCE.x + 2, 20.2, 0.35, 0.35, 1.9, '#f97316', '#c2410c', '#ea580c')
    this.label('GARAGE EMPIRE', ENTRANCE.x, 20.35, 2.15, { bg: '#0f172a', fg: '#fbbf24', size: 15 })
  }

  private drawGarage(game: Game): void {
    const b = GARAGE_BUILDING
    // floor slab + low cutaway walls (high enough to read as a building,
    // low enough to see over) with a rooftop sign on posts
    this.box3d(b.x, b.y, b.w, 0.5, 1.5, '#e2e8f0', '#94a3b8', '#cbd5e1')
    this.box3d(b.x, b.y + b.h - 0.5, b.w, 0.5, 0.9, '#14b8a6', '#0f766e', '#0d9488')
    this.box3d(b.x, b.y, 0.5, b.h, 1.3, '#f1f5f9', '#94a3b8', '#cbd5e1')
    // sign posts + thin rooftop sign panel
    this.box3d(b.x + 1.2, b.y + 0.5, 0.28, 0.28, 1.5, '#0369a1', '#075985', '#0284c7')
    this.box3d(b.x + 4.5, b.y + 0.5, 0.28, 0.28, 1.5, '#0369a1', '#075985', '#0284c7')
    this.box3d(b.x + 0.9, b.y + 0.35, 4.2, 0.55, 0.62, '#0ea5e9', '#075985', '#0284c7', 1.5)
    this.label('🔧 GARAGE', b.x + 3, b.y + 0.62, 2.32, { bg: 'rgba(12,74,110,0.95)', fg: '#fff', size: 14 })
    // door + window
    void game
    const { ctx } = this
    const dx = this.sx(b.x + 2.4, b.y + b.h)
    const dy = this.sy(b.x + 2.4, b.y + b.h, 0)
    ctx.fillStyle = '#334155'
    ctx.fillRect(dx - this.tw * 0.35, dy - this.tw * 0.75, this.tw * 0.7, this.tw * 0.75)
  }

  private drawShowroom(): void {
    // glass pavilion
    this.box3d(23.4, 13.4, 5.6, 0.4, 1.7, 'rgba(191,219,254,0.9)', 'rgba(147,197,253,0.9)', 'rgba(191,219,254,0.9)')
    this.box3d(23.4, 13.4, 0.4, 4, 1.7, 'rgba(191,219,253,0.9)', 'rgba(147,197,253,0.9)', 'rgba(219,234,254,0.9)')
    this.box3d(23.4, 13.2, 5.8, 4.4, 0.12, '#f8fafc', '#e2e8f0', '#e2e8f0')
    this.label('🏆 SHOWROOM', 26.2, 13.6, 2.0, { bg: '#78350f', fg: '#fde68a', size: 14 })
  }

  private drawStation(game: Game, id: StationId, locked: boolean, time: number): void {
    const r = STATION_RECTS[id]
    const st = STATIONS[id]
    const { ctx } = this
    if (locked) {
      // ghost pad: dashed outline + silhouette + price sign
      const cx = this.sx(r.cx, r.cy)
      const cy = this.sy(r.cx, r.cy)
      ctx.save()
      ctx.strokeStyle = 'rgba(250,204,21,0.9)'
      ctx.lineWidth = 3
      ctx.setLineDash([10, 7])
      ctx.beginPath()
      ctx.ellipse(cx, cy, this.tw * 1.15, this.tw * 0.6, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
      ctx.globalAlpha = 0.35 + Math.sin(time * 3) * 0.06
      ctx.font = `${this.tw * 0.9}px system-ui`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const icons: Record<StationId, string> = { wash1: '🧼', wash2: '🧼', repair1: '🔧', lift: '🏗️', tire: '🛞', detail: '✨', paint: '🎨' }
      ctx.fillText(icons[id], cx, cy - this.tw * 0.4)
      ctx.globalAlpha = 1
      const def = UNLOCKS.find((u) => u.id === st.unlock)
      if (def) this.label(`${def.icon} $${def.cost}`, r.cx, r.cy, 1.5, { bg: '#713f12', fg: '#fde68a' })
      return
    }
    // active pad
    const cx = this.sx(r.cx, r.cy)
    const cy = this.sy(r.cx, r.cy)
    ctx.fillStyle = st.color + '33'
    ctx.beginPath()
    ctx.ellipse(cx, cy, this.tw * 1.3, this.tw * 0.68, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = st.color
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.ellipse(cx, cy, this.tw * 1.3, this.tw * 0.68, 0, 0, Math.PI * 2)
    ctx.stroke()

    switch (id) {
      case 'wash1':
      case 'wash2': {
        // gantry arch over the bay
        this.box3d(r.x + 0.3, r.y + 0.2, 0.25, 3, 1.05, '#0284c7', '#075985', '#0369a1')
        this.box3d(r.x + 2.45, r.y + 0.2, 0.25, 3, 1.05, '#0284c7', '#075985', '#0369a1')
        this.box3d(r.x + 0.3, r.y + 0.2, 2.4, 0.28, 0.3, '#38bdf8', '#0284c7', '#0ea5e9', 1.05)
        // brushes spin when a car is being washed
        const busy = game.cars.some((cc) => cc.bay === id && cc.work && cc.work.service === 'wash')
        if (busy) {
          const bx = this.sx(r.cx, r.cy)
          const by = this.sy(r.cx, r.cy, 0.9)
          ctx.save()
          ctx.translate(bx, by)
          ctx.rotate(time * 6)
          ctx.fillStyle = '#bae6fd'
          ctx.fillRect(-this.tw * 0.5, -3, this.tw, 6)
          ctx.restore()
        }
        break
      }
      case 'repair1': {
        this.box3d(r.x + 0.2, r.y + 2.6, 1.4, 0.5, 0.55, '#fdba74', '#9a3412', '#c2410c')
        // tool wall
        this.box3d(r.x + 1.9, r.y + 2.7, 0.9, 0.35, 0.9, '#475569', '#1e293b', '#334155')
        ctx.font = `${this.tw * 0.45}px system-ui`
        ctx.textAlign = 'center'
        ctx.fillText('🔧🧰', this.sx(r.x + 2.35, r.y + 2.9), this.sy(r.x + 2.35, r.y + 2.9, 1.0))
        break
      }
      case 'lift': {
        this.box3d(r.x + 0.3, r.y + 0.4, 0.3, 2.6, 1.3, '#f472b6', '#9d174d', '#be185d')
        this.box3d(r.x + 2.4, r.y + 0.4, 0.3, 2.6, 1.3, '#f472b6', '#9d174d', '#be185d')
        break
      }
      case 'tire': {
        // tire stacks
        for (const [ox, oy] of [[0.3, 2.5], [0.9, 2.7], [2.0, 2.5]] as const) {
          const tx = this.sx(r.x + ox, r.y + oy)
          const ty = this.sy(r.x + ox, r.y + oy, 0.35)
          ctx.fillStyle = '#1f2937'
          ctx.beginPath(); ctx.arc(tx, ty, this.tw * 0.22, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = '#9ca3af'
          ctx.beginPath(); ctx.arc(tx, ty, this.tw * 0.1, 0, Math.PI * 2); ctx.fill()
        }
        break
      }
      case 'detail': {
        this.box3d(r.x + 0.3, r.y + 2.5, 0.5, 0.5, 1.1, '#2dd4bf', '#0f766e', '#14b8a6')
        const ux = this.sx(r.cx, r.cy)
        const uy = this.sy(r.cx, r.cy, 1.3)
        ctx.font = `${this.tw * 0.5}px system-ui`
        ctx.textAlign = 'center'
        ctx.fillText('✨', ux + Math.sin(time * 2) * 4, uy)
        break
      }
      case 'paint': {
        // booth: low translucent walls + vent so the car stays visible
        this.box3d(r.x, r.y + 3, 3.4, 0.3, 1.0, 'rgba(250,204,21,0.75)', 'rgba(161,98,7,0.75)', 'rgba(202,138,4,0.75)')
        this.box3d(r.x + 3.1, r.y, 0.3, 3.3, 1.0, 'rgba(250,204,21,0.55)', 'rgba(161,98,7,0.55)', 'rgba(202,138,4,0.55)')
        break
      }
    }
    void game
  }

  private drawTank(): void {
    this.box3d(9.6, 2.4, 1.1, 1.6, 1.0, '#7dd3fc', '#075985', '#0284c7')
    this.label('💦 PRO', 10.15, 3.2, 1.25, { size: 11 })
  }

  private drawBillboard(): void {
    const { ctx } = this
    this.box3d(18.9, 14.6, 0.3, 0.3, 1.6, '#475569', '#1e293b', '#334155')
    const cx = this.sx(19.05, 14.75)
    const cy = this.sy(19.05, 14.75, 1.9)
    ctx.fillStyle = '#f59e0b'
    const w = this.tw * 1.5
    const h = this.tw * 0.6
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h)
    ctx.fillStyle = '#7c2d12'
    ctx.font = `700 ${this.tw * 0.28}px system-ui`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('📣 WASH • FIX • FLIP', cx, cy)
  }

  private drawHireBoard(): void {
    this.box3d(HIRE_BOARD.x - 0.4, HIRE_BOARD.y - 0.15, 0.25, 0.3, 1.1, '#92400e', '#451a03', '#78350f')
    this.label('🧑‍🔧 STAFF', HIRE_BOARD.x, HIRE_BOARD.y, 1.35, { bg: '#1e3a8a', fg: '#bfdbfe' })
  }

  private drawDecor(kind: string, x: number, y: number, s: number, time: number): void {
    const { ctx } = this
    this.shadow(x, y, 0.3 * s, 0.15 * s)
    if (kind === 'tree') {
      this.box3d(x - 0.12, y - 0.12, 0.24, 0.24, 0.5, '#92400e', '#451a03', '#78350f')
      const cx = this.sx(x, y)
      const cy = this.sy(x, y, 0.9 * s)
      ctx.fillStyle = '#16a34a'
      ctx.beginPath(); ctx.arc(cx, cy, this.tw * 0.42 * s, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#22c55e'
      ctx.beginPath(); ctx.arc(cx - this.tw * 0.12, cy - this.tw * 0.12, this.tw * 0.26 * s, 0, Math.PI * 2); ctx.fill()
    } else if (kind === 'lamp') {
      this.box3d(x - 0.08, y - 0.08, 0.16, 0.16, 1.6, '#475569', '#1e293b', '#334155')
      const cx = this.sx(x, y)
      const cy = this.sy(x, y, 1.65)
      ctx.fillStyle = '#fef9c3'
      ctx.beginPath(); ctx.arc(cx, cy, this.tw * 0.12, 0, Math.PI * 2); ctx.fill()
    } else if (kind === 'cone') {
      const cx = this.sx(x, y)
      const cy = this.sy(x, y, 0)
      ctx.fillStyle = '#f97316'
      ctx.beginPath()
      ctx.moveTo(cx, cy - this.tw * 0.35)
      ctx.lineTo(cx + this.tw * 0.18, cy)
      ctx.lineTo(cx - this.tw * 0.18, cy)
      ctx.closePath(); ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.fillRect(cx - this.tw * 0.11, cy - this.tw * 0.16, this.tw * 0.22, this.tw * 0.08)
    } else if (kind === 'crate') {
      this.box3d(x - 0.3, y - 0.3, 0.6, 0.6, 0.5, '#d6a35c', '#8a5a2b', '#a9743b')
    } else if (kind === 'tire') {
      const cx = this.sx(x, y)
      const cy = this.sy(x, y, 0.2)
      ctx.fillStyle = '#1f2937'
      ctx.beginPath(); ctx.arc(cx, cy, this.tw * 0.26, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#6b7280'
      ctx.beginPath(); ctx.arc(cx, cy, this.tw * 0.12, 0, Math.PI * 2); ctx.fill()
    } else if (kind === 'bench') {
      this.box3d(x - 0.7, y - 0.25, 1.4, 0.5, 0.3, '#b45309', '#451a03', '#92400e')
    } else {
      const cx = this.sx(x, y)
      const cy = this.sy(x, y, 0.15)
      ctx.fillStyle = '#22c55e'
      ctx.beginPath(); ctx.arc(cx, cy + Math.sin(time * 2 + x) * 1.5, this.tw * 0.2, 0, Math.PI * 2); ctx.fill()
    }
  }

  // ---- cars ----

  private drawCar(game: Game, car: Car, time: number): void {
    const { ctx } = this
    // offer pads
    if (car.phase === 'offer') {
      const cx = this.sx(car.x, car.y)
      const cy = this.sy(car.x, car.y)
      ctx.strokeStyle = 'rgba(250,204,21,0.8)'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 5])
      ctx.beginPath()
      ctx.ellipse(cx, cy, this.tw * 1.1, this.tw * 0.58, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }
    this.shadow(car.x, car.y, car.type.length * 0.52, 0.3)
    const px = this.sx(car.x, car.y)
    const py = this.sy(car.x, car.y, 0.12)
    // screen-space rotation: iso heading -> screen angle approx
    const sa = Math.atan2(Math.sin(car.angle) * 0.5, Math.cos(car.angle))
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(sa)
    const L = car.type.length * this.tw * 0.92
    const W = this.tw * 0.62 * (car.type.width + 0.55)
    const liftH = car.bay === 'lift' && car.phase === 'inBay' ? 8 : 0
    ctx.translate(0, -liftH)
    // wheels
    ctx.fillStyle = car.cond.tires < 55 ? '#7c2d12' : '#111827'
    const wy = W / 2 - 1
    const wx = L * 0.32
    for (const [ox, oy] of [[-wx, -wy], [wx, -wy], [-wx, wy], [wx, wy]] as const) {
      ctx.beginPath()
      ctx.arc(ox, oy, this.tw * 0.11, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#9ca3af'
      ctx.beginPath()
      ctx.arc(ox, oy, this.tw * 0.05, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = car.cond.tires < 55 ? '#7c2d12' : '#111827'
    }
    // body
    const bodyGrad = ctx.createLinearGradient(0, -W / 2, 0, W / 2)
    bodyGrad.addColorStop(0, car.color)
    bodyGrad.addColorStop(1, shade(car.color, -28))
    ctx.fillStyle = bodyGrad
    ctx.beginPath()
    ctx.roundRect(-L / 2, -W / 2, L, W, this.tw * 0.16)
    ctx.fill()
    // hood/trunk shading
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.beginPath()
    ctx.roundRect(-L / 2 + 3, -W / 2 + 3, L * 0.2, W - 6, this.tw * 0.1)
    ctx.fill()
    // cabin
    ctx.fillStyle = shade(car.color, -45)
    ctx.beginPath()
    ctx.roundRect(-L * 0.18, -W * 0.36, L * 0.4, W * 0.72, this.tw * 0.08)
    ctx.fill()
    ctx.fillStyle = 'rgba(186,230,253,0.9)'
    ctx.beginPath()
    ctx.roundRect(-L * 0.14, -W * 0.3, L * 0.32, W * 0.6, this.tw * 0.06)
    ctx.fill()
    // damage: dents
    if (car.cond.body < 92) {
      ctx.fillStyle = 'rgba(60,40,20,0.45)'
      const n = car.cond.body < 55 ? 3 : 1
      for (let i = 0; i < n; i++) {
        const dx = Math.sin(car.seed + i * 2.3) * L * 0.3
        const dy = Math.cos(car.seed + i * 1.7) * W * 0.3
        ctx.beginPath()
        ctx.arc(dx, dy, this.tw * 0.09, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    // dirt overlay
    const dirt = 1 - car.cond.clean / 100
    if (dirt > 0.03) {
      ctx.fillStyle = `rgba(120,84,50,${0.55 * dirt})`
      for (let i = 0; i < 7; i++) {
        const dx = Math.sin(car.seed * 3 + i * 1.9) * L * 0.42
        const dy = Math.cos(car.seed * 2 + i * 2.4) * W * 0.42
        ctx.beginPath()
        ctx.arc(dx, dy, this.tw * (0.08 + 0.1 * ((i * 37) % 10) / 10), 0, Math.PI * 2)
        ctx.fill()
      }
    }
    // shine sparkles
    if (car.cond.shine > 80) {
      ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.sin(time * 4 + car.seed) * 0.3})`
      ctx.font = `${this.tw * 0.3}px system-ui`
      ctx.fillText('✦', -L * 0.3, -W * 0.3)
    }
    ctx.restore()

    // engine smoke
    if (car.cond.mech < 50 && car.phase !== 'leaving' && Math.random() < 0.12) {
      this.particles.push({
        x: car.x + 0.6, y: car.y, z: 0.5, vx: 0.2, vy: -0.2, vz: 1.2,
        life: 0, max: 0.9, color: 'rgba(100,100,110,0.7)', size: 5,
      })
    }

    // status bubble
    const bx = car.x
    const by = car.y
    if (car.phase === 'inBay' && !car.done && car.needs.length > 0) {
      const svc = car.needs[0]
      const icon = car.work ? (car.work.by === 'player' ? '⏳' : '🧑‍🔧') : (SERVICES[svc].icon ?? '❗')
      this.label(icon, bx, by, 1.35, { size: 13 })
      if (car.work) this.progressBar(bx, by, 1.05, car.work.progress, '#4ade80')
    } else if (car.phase === 'forSale') {
      const inShow = car.parkIdx >= 100
      const price = carValue(car.type, car.cond, { showroom: inShow })
      this.label(`💰 $${price}`, bx, by, 1.35, { bg: '#14532d', fg: '#bbf7d0' })
      if (car.sellerBy !== null) this.progressBar(bx, by, 1.0, Math.min(1, car.sellT / 5), '#a78bfa')
    } else if (car.phase === 'offer') {
      const buy = offerPrice(car.type, car.cond)
      this.label(`🏷️ $${buy}`, bx, by, 1.35, { bg: '#713f12', fg: '#fde68a' })
    } else if (car.phase === 'queued' && car.owner === 'player') {
      this.label('🔧 project', bx, by, 1.3, { size: 11 })
    }
    // completion flash ring
    if (car.flash > 0) {
      ctx.strokeStyle = `rgba(74,222,128,${car.flash})`
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.ellipse(px, py, this.tw * 1.2 * (1.4 - car.flash * 0.4), this.tw * 0.62 * (1.4 - car.flash * 0.4), 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    void game
  }

  private progressBar(x: number, y: number, z: number, p: number, color: string): void {
    const { ctx } = this
    const px = this.sx(x, y)
    const py = this.sy(x, y, z)
    const w = this.tw * 1.1
    ctx.fillStyle = 'rgba(15,23,42,0.8)'
    ctx.beginPath()
    ctx.roundRect(px - w / 2, py - 5, w, 10, 5)
    ctx.fill()
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(px - w / 2 + 1.5, py - 3.5, Math.max(0, (w - 3) * Math.min(1, p)), 7, 3.5)
    ctx.fill()
  }

  // ---- characters ----

  private drawPerson(x: number, y: number, angle: number, moving: boolean, time: number, seed: number, colors: { shirt: string; pants: string; skin: string; cap: string }): void {
    const { ctx } = this
    this.shadow(x, y, 0.32, 0.15)
    const px = this.sx(x, y)
    const py = this.sy(x, y, 0)
    const s = this.tw / 56
    const wob = moving ? Math.sin(time * 12 + seed) * 2 * s : Math.sin(time * 2 + seed) * 0.8 * s
    // legs
    ctx.strokeStyle = colors.pants
    ctx.lineWidth = 5 * s
    ctx.lineCap = 'round'
    const step = moving ? Math.sin(time * 12 + seed) * 5 * s : 0
    ctx.beginPath(); ctx.moveTo(px, py - 10 * s); ctx.lineTo(px - 4 * s, py + step * 0.4); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(px, py - 10 * s); ctx.lineTo(px + 4 * s, py - step * 0.4); ctx.stroke()
    // body
    ctx.fillStyle = colors.shirt
    ctx.beginPath()
    ctx.roundRect(px - 8 * s, py - 32 * s + wob * 0.3, 16 * s, 23 * s, 7 * s)
    ctx.fill()
    // arms (one raised when working facing)
    void angle
    ctx.strokeStyle = colors.skin
    ctx.lineWidth = 4.5 * s
    ctx.beginPath(); ctx.moveTo(px - 7 * s, py - 26 * s); ctx.lineTo(px - 11 * s, py - 16 * s + wob); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(px + 7 * s, py - 26 * s); ctx.lineTo(px + 11 * s, py - 16 * s - wob); ctx.stroke()
    // head
    ctx.fillStyle = colors.skin
    ctx.beginPath()
    ctx.arc(px, py - 38 * s + wob * 0.3, 8.5 * s, 0, Math.PI * 2)
    ctx.fill()
    // cap
    ctx.fillStyle = colors.cap
    ctx.beginPath()
    ctx.arc(px, py - 40 * s + wob * 0.3, 8.5 * s, Math.PI, 0)
    ctx.fill()
    ctx.fillRect(px - 8.5 * s, py - 41 * s + wob * 0.3, 20 * s, 3.5 * s)
  }

  private drawPlayer(game: Game, time: number): void {
    const p = game.player
    this.drawPerson(p.x, p.y, p.angle, p.moving, time, 1, {
      shirt: '#f97316', pants: '#1e3a8a', skin: '#fcd7a8', cap: '#0ea5e9',
    })
    // interaction progress ring under player when working
    const it = game.current
    if (it && it.kind === 'work' && it.progress > 0) {
      const px = this.sx(p.x, p.y)
      const py = this.sy(p.x, p.y, 0.05)
      const { ctx } = this
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 5
      ctx.beginPath(); ctx.arc(px, py, this.tw * 0.5, 0, Math.PI * 2); ctx.stroke()
      ctx.strokeStyle = '#4ade80'
      ctx.beginPath(); ctx.arc(px, py, this.tw * 0.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * it.progress); ctx.stroke()
    }
  }

  private drawWorker(w: Worker, time: number): void {
    const col = WORKER_COLORS[w.role] ?? '#94a3b8'
    const moving = w.state === 'walk' || w.state === 'sellwalk'
    this.drawPerson(w.x, w.y, w.angle, moving, time, w.bob, {
      shirt: col, pants: '#334155', skin: '#f2c9a0', cap: shade(col, -40),
    })
    if (w.role === 'seller') {
      this.label('💼', w.x, w.y, 1.15, { size: 12 })
    } else if (w.state === 'work') {
      this.progressBar(w.x, w.y, 1.0, w.progress, col)
      // tool wiggle
      const { ctx } = this
      const px = this.sx(w.x, w.y)
      const py = this.sy(w.x, w.y, 0.55)
      ctx.save()
      ctx.translate(px + 10, py)
      ctx.rotate(Math.sin(time * 14) * 0.5)
      ctx.font = `${this.tw * 0.4}px system-ui`
      ctx.fillText('🔧', 0, 0)
      ctx.restore()
    }
  }
}

function shade(hex: string, amt: number): string {
  const n = hex.replace('#', '')
  const v = n.length === 3 ? n.split('').map((c) => c + c).join('') : n
  const num = parseInt(v, 16)
  const r = Math.max(0, Math.min(255, (num >> 16) + amt))
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt))
  const b = Math.max(0, Math.min(255, (num & 0xff) + amt))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
