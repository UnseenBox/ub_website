// Isometric renderer: cohesive stylized-garage art, all procedural.
// World-space ground drawn culled per frame (never cached in screen space, so
// the floor can never drift from entities). DPR handled via ctx transform.

import { STATIONS, UNLOCKS, carValue, offerPrice, type StationId } from './config'
import { CAR_SPECS, drawVehicle, shade } from './cars'
import type { Car, Game, Worker } from './sim'
import {
  DECOR,
  ENTRANCE,
  GARAGE_BUILDING,
  HIRE_BOARD,
  MAP_W,
  PARKING_BASE,
  PARKING_EXTRA,
  STATION_RECTS,
} from './world'

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

/** One palette, one light direction (upper-left): [top, left, right]. */
function faces(base: string): [string, string, string] {
  return [shade(base, 14), shade(base, -12), shade(base, -30)]
}

function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

export class Renderer {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  cam = { x: 12.5, y: 10 }
  tw = 56
  vw = 0
  vh = 0
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
    this.vw = w
    this.vh = h
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.tw = Math.max(30, Math.min(64, Math.min(w, h) / 13))
  }

  get w(): number {
    return this.vw
  }
  get h(): number {
    return this.vh
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

  dust(x: number, y: number): void {
    if (this.particles.length > 340) return
    this.particles.push({
      x: x + (Math.random() - 0.5) * 0.4, y, z: 0.05,
      vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, vz: 0.7,
      life: 0, max: 0.5, color: 'rgba(190,180,160,0.7)', size: 3.5,
    })
  }

  private spawnWorkFx(car: Car): void {
    if (!car.work) {
      if (car.path.length > 0 && Math.random() < 0.3) {
        this.particles.push({
          x: car.x, y: car.y, z: 0.08,
          vx: (Math.random() - 0.5), vy: (Math.random() - 0.5), vz: 0.7,
          life: 0, max: 0.55, color: 'rgba(190,180,160,0.6)', size: 4,
        })
      }
      return
    }
    const s = car.work.service
    const n = s === 'wash' ? 3 : 2
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 340) return
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
  }

  // ---- projection (CSS pixels; camera-relative every frame) ----

  private get th(): number {
    return this.tw / 2
  }

  sx(x: number, y: number): number {
    return ((x - this.cam.x - (y - this.cam.y)) * this.tw) / 2 + this.w / 2
  }
  sy(x: number, y: number, z = 0): number {
    return (((x - this.cam.x + (y - this.cam.y)) * this.th) / 2 + this.h / 2 - z * this.tw) + this.tw * 0.4
  }

  private inView(x: number, y: number, pad = 120): boolean {
    const px = this.sx(x, y)
    const py = this.sy(x, y)
    return px > -pad && px < this.w + pad && py > -pad && py < this.h + pad
  }

  // ---- frame ----

  render(game: Game, time: number, dt: number): void {
    const { ctx } = this
    // follow with slight velocity look-ahead; position-only, never rotate/scale
    const look = 0.22
    const tx = game.player.x + game.player.vx * look
    const ty = game.player.y - 1.2 + game.player.vy * look
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 4)
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 4)

    const g = ctx.createLinearGradient(0, 0, 0, this.h)
    g.addColorStop(0, '#86c96f')
    g.addColorStop(1, '#69ad57')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, this.w, this.h)

    this.drawGround(game)

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

    interface Item {
      d: number
      f: () => void
    }
    const items: Item[] = []
    const depth = (x: number, y: number) => x + y

    items.push({ d: depth(ENTRANCE.x, 19.4), f: () => this.drawArch(time) })
    items.push({ d: depth(3, 5) + 2, f: () => this.drawGarage(time) })
    if (game.hasUnlock('showroom')) {
      items.push({
        d: depth(26, 17.4),
        f: () => this.withBuild(game, 'showroom', 26.2, 15.4, () => this.drawShowroom(time)),
      })
    }
    for (const id of Object.keys(STATION_RECTS) as StationId[]) {
      const locked = !game.stationUnlocked(id)
      const r = STATION_RECTS[id]
      items.push({
        d: depth(r.x + 1.5, r.y + 3),
        f: () => this.drawStation(game, id, locked, time),
      })
    }
    if (game.hasUnlock('pressure')) items.push({ d: depth(10, 4.8), f: () => this.drawTank() })
    if (game.hasUnlock('billboard')) {
      items.push({
        d: depth(19.3, 16),
        f: () => this.withBuild(game, 'billboard', 19.3, 15.4, () => this.drawBillboard()),
      })
    }
    if (game.hasUnlock('usedlot')) {
      items.push({
        d: depth(26.5, 7.6) - 0.2,
        f: () => this.withBuild(game, 'usedlot', 26.5, 4.6, () => this.drawBuntingLot(time)),
      })
    }
    items.push({ d: depth(HIRE_BOARD.x, HIRE_BOARD.y), f: () => this.drawHireBoard() })

    // locked expansion pads: dashed claim + price
    for (const pd of game.pads()) {
      const def = UNLOCKS.find((u) => u.id === pd.unlockId)
      if (def && this.inView(pd.cx, pd.cy, 200)) {
        items.push({ d: depth(pd.cx, pd.cy) - 0.1, f: () => this.drawPadClaim(pd, `${def.icon} $${def.cost}`) })
      }
    }

    for (const p of DECOR) {
      if (this.inView(p.x, p.y)) items.push({ d: depth(p.x, p.y), f: () => this.drawDecor(p.kind, p.x, p.y, p.s, time) })
    }

    for (const car of game.cars) {
      this.spawnWorkFx(car)
      items.push({ d: depth(car.x, car.y) + 0.05, f: () => this.drawCar(game, car, time) })
    }
    for (const w of game.workers) items.push({ d: depth(w.x, w.y) + 0.1, f: () => this.drawWorker(game, w, time) })
    items.push({
      d: depth(game.player.x, game.player.y) + 0.12,
      f: () => this.drawPlayer(game, time, dt),
    })

    items.sort((a, b) => a.d - b.d)
    for (const it of items) it.f()

    for (const p of this.particles) {
      const a = 1 - p.life / p.max
      ctx.globalAlpha = Math.max(0, a)
      ctx.fillStyle = p.color
      const px = this.sx(p.x, p.y)
      const py = this.sy(p.x, p.y, p.z)
      ctx.beginPath()
      ctx.arc(px, py, (p.size * this.tw) / 56, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
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

  private withBuild(game: Game, unlock: string, cx: number, cy: number, fn: () => void): void {
    const t = (game.time - (game.builtAt[unlock] ?? -99)) / 0.6
    if (t >= 1) {
      fn()
      return
    }
    const s = Math.max(0.01, easeOutBack(Math.max(0, t)))
    const { ctx } = this
    const px = this.sx(cx, cy)
    const py = this.sy(cx, cy)
    ctx.save()
    ctx.translate(px, py)
    ctx.scale(s, s)
    ctx.translate(-px, -py)
    fn()
    ctx.restore()
  }

  private drawVignette(): void {
    const { ctx } = this
    const g = ctx.createRadialGradient(
      this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.45,
      this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75,
    )
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(10,15,30,0.26)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, this.w, this.h)
  }

  // ---- ground (world-locked, viewport-culled; never cached) ----

  private diamond(x: number, y: number, w: number, h: number, fill: string): void {
    const { ctx } = this
    ctx.beginPath()
    ctx.moveTo(this.sx(x, y), this.sy(x, y))
    ctx.lineTo(this.sx(x + w, y), this.sy(x + w, y))
    ctx.lineTo(this.sx(x + w, y + h), this.sy(x + w, y + h))
    ctx.lineTo(this.sx(x, y + h), this.sy(x, y + h))
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()
  }

  private drawGround(game: Game): void {
    // concrete yard
    for (let x = 0; x < MAP_W; x++) {
      for (let y = 0; y < 19; y++) {
        if (!this.inView(x + 0.5, y + 0.5, 90)) continue
        this.diamond(x, y, 1, 1, (x + y) % 2 === 0 ? '#d8d1c2' : '#d1c9b8')
      }
    }
    // expansion joints every 4 tiles
    this.ctx.strokeStyle = 'rgba(120,110,95,0.35)'
    this.ctx.lineWidth = 1.5
    for (let x = 2; x < MAP_W; x += 4) {
      if (!this.inView(x, 9, 200)) continue
      this.ctx.beginPath()
      this.ctx.moveTo(this.sx(x, 1), this.sy(x, 1))
      this.ctx.lineTo(this.sx(x, 19), this.sy(x, 19))
      this.ctx.stroke()
    }
    // zone tints
    this.diamond(10.6, 1.6, 8.6, 4.2, 'rgba(56,189,248,0.16)')
    this.diamond(2.6, 7.6, 20.6, 4.4, 'rgba(234,88,12,0.10)')
    if (game.hasUnlock('usedlot')) this.diamond(23.6, 1.6, 5.4, 6.2, 'rgba(190,165,120,0.5)')
    this.diamond(23.6, 8.6, 5, 3.6, 'rgba(167,139,250,0.12)')
    if (game.hasUnlock('showroom')) this.diamond(23.2, 13.2, 6, 4.4, 'rgba(248,250,252,0.5)')
    // curb + road
    this.diamond(0, 18.55, MAP_W, 0.45, '#e8e2d4')
    for (let x = 0; x < MAP_W; x++) {
      if (!this.inView(x + 0.5, 20, 90)) continue
      this.diamond(x, 19, 1, 1, '#565e6d')
      this.diamond(x, 20, 1, 1, '#4d5462')
      this.diamond(x, 21, 1, 1, '#565e6d')
    }
    // center dashes
    this.ctx.fillStyle = '#fbbf24'
    for (let x = 0; x < MAP_W; x += 2) {
      if (!this.inView(x + 0.5, 20.4, 60)) continue
      const dx = this.sx(x + 0.3, 20.4)
      const dy = this.sy(x + 0.3, 20.4)
      this.ctx.save()
      this.ctx.translate(dx, dy)
      this.ctx.rotate(Math.atan2(this.th, this.tw))
      this.ctx.fillRect(-this.tw * 0.28, -2, this.tw * 0.56, 4)
      this.ctx.restore()
    }
    // driveway apron + lane chevrons
    this.diamond(12.4, 17.6, 2.2, 1.4, '#c0b7a4')
    this.ctx.fillStyle = 'rgba(255,255,255,0.5)'
    for (const cx of [6, 13.5, 21]) {
      if (!this.inView(cx, 13.1, 60)) continue
      const px = this.sx(cx, 13.1)
      const py = this.sy(cx, 13.1)
      this.ctx.beginPath()
      this.ctx.moveTo(px - 9, py - 4)
      this.ctx.lineTo(px + 2, py)
      this.ctx.lineTo(px - 9, py + 4)
      this.ctx.lineTo(px - 9, py + 1)
      this.ctx.lineTo(px - 3, py)
      this.ctx.lineTo(px - 9, py - 1)
      this.ctx.closePath()
      this.ctx.fill()
    }
    // parking slots: outline + wheel stops (+ extra pair when unlocked)
    const slots = game.hasUnlock('parking') ? [...PARKING_BASE, ...PARKING_EXTRA] : PARKING_BASE
    this.ctx.lineWidth = 2
    for (const p of slots) {
      if (!this.inView(p.x, p.y, 90)) continue
      const cx = this.sx(p.x, p.y)
      const cy = this.sy(p.x, p.y)
      this.ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      this.ctx.beginPath()
      this.ctx.ellipse(cx, cy, this.tw * 1.0, this.tw * 0.52, 0, 0, Math.PI * 2)
      this.ctx.stroke()
      // wheel stops
      this.ctx.fillStyle = '#9aa0ab'
      for (const ox of [-0.55, 0.55]) {
        const wx = this.sx(p.x + ox, p.y - 0.75)
        const wy = this.sy(p.x + ox, p.y - 0.75)
        this.ctx.save()
        this.ctx.translate(wx, wy)
        this.ctx.rotate(-0.45)
        this.ctx.fillRect(-this.tw * 0.16, -3, this.tw * 0.32, 6)
        this.ctx.restore()
      }
    }
    // drain grates + oil stains (static garage dressing)
    this.ctx.fillStyle = '#3c434f'
    for (const [gx, gy] of [[9.2, 6.4], [14.8, 12.6]] as const) {
      if (!this.inView(gx, gy, 60)) continue
      const px = this.sx(gx, gy)
      const py = this.sy(gx, gy)
      this.ctx.save()
      this.ctx.translate(px, py)
      this.ctx.rotate(0.46)
      this.ctx.fillRect(-10, -5, 20, 10)
      this.ctx.fillStyle = '#565e6d'
      for (let i = -7; i <= 7; i += 3.5) this.ctx.fillRect(i, -5, 1.6, 10)
      this.ctx.fillStyle = '#3c434f'
      this.ctx.restore()
    }
    for (const [ox, oy, r] of [[4.5, 10.6, 9], [8.5, 10.8, 7], [12.3, 10.5, 6]] as const) {
      if (!this.inView(ox, oy, 60)) continue
      this.ctx.fillStyle = 'rgba(40,36,30,0.28)'
      this.ctx.beginPath()
      this.ctx.ellipse(this.sx(ox, oy), this.sy(ox, oy), r, r * 0.5, 0.3, 0, Math.PI * 2)
      this.ctx.fill()
    }
  }

  // ---- shared pieces ----

  private shadow(x: number, y: number, rx: number, ry: number): void {
    const { ctx } = this
    ctx.fillStyle = 'rgba(20,25,40,0.22)'
    ctx.beginPath()
    ctx.ellipse(this.sx(x, y), this.sy(x, y) + 2, rx * this.tw, ry * this.tw, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  private box3d(x: number, y: number, w: number, h: number, z: number, top: string, left: string, right: string, base = 0): void {
    const { ctx } = this
    const p = (wx: number, wy: number, wz: number) => ({ x: this.sx(wx, wy), y: this.sy(wx, wy, wz + base) })
    const b = p(x + w, y, 0)
    const cc = p(x + w, y + h, 0)
    const d = p(x, y + h, 0)
    const b2 = p(x + w, y, z)
    const c2 = p(x + w, y + h, z)
    const d2 = p(x, y + h, z)
    const a2 = p(x, y, z)
    ctx.fillStyle = left
    ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(cc.x, cc.y); ctx.lineTo(c2.x, c2.y); ctx.lineTo(d2.x, d2.y); ctx.closePath(); ctx.fill()
    ctx.fillStyle = right
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(cc.x, cc.y); ctx.lineTo(c2.x, c2.y); ctx.lineTo(b2.x, b2.y); ctx.closePath(); ctx.fill()
    ctx.fillStyle = top
    ctx.beginPath()
    ctx.moveTo(a2.x, a2.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(c2.x, c2.y); ctx.lineTo(d2.x, d2.y)
    ctx.closePath(); ctx.fill()
  }

  private bx(x: number, y: number, w: number, h: number, z: number, baseColor: string, base = 0): void {
    const [t, l, r] = faces(baseColor)
    this.box3d(x, y, w, h, z, t, l, r, base)
  }

  private label(text: string, x: number, y: number, z: number, opts?: { bg?: string; fg?: string; size?: number }): void {
    const { ctx } = this
    const size = ((opts?.size ?? 13) * this.tw) / 56
    ctx.font = `800 ${size}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const px = this.sx(x, y)
    const py = this.sy(x, y, z)
    const w = ctx.measureText(text).width + size * 1.0
    ctx.fillStyle = opts?.bg ?? 'rgba(15,23,42,0.88)'
    ctx.beginPath()
    ctx.roundRect(px - w / 2, py - size * 0.85, w, size * 1.7, size * 0.8)
    ctx.fill()
    ctx.fillStyle = opts?.fg ?? '#fff'
    ctx.fillText(text, px, py)
  }

  private progressBar(x: number, y: number, z: number, p: number, color: string): void {
    const { ctx } = this
    const px = this.sx(x, y)
    const py = this.sy(x, y, z)
    const w = this.tw * 1.1
    ctx.fillStyle = 'rgba(15,23,42,0.82)'
    ctx.beginPath()
    ctx.roundRect(px - w / 2, py - 5, w, 10, 5)
    ctx.fill()
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(px - w / 2 + 1.5, py - 3.5, Math.max(0, (w - 3) * Math.min(1, p)), 7, 3.5)
    ctx.fill()
  }

  private drawPadClaim(pd: { x: number; y: number; w: number; h: number; cx: number; cy: number }, text: string): void {
    const { ctx } = this
    ctx.save()
    ctx.strokeStyle = 'rgba(250,204,21,0.85)'
    ctx.lineWidth = 2.5
    ctx.setLineDash([8, 6])
    ctx.beginPath()
    ctx.moveTo(this.sx(pd.x, pd.y), this.sy(pd.x, pd.y))
    ctx.lineTo(this.sx(pd.x + pd.w, pd.y), this.sy(pd.x + pd.w, pd.y))
    ctx.lineTo(this.sx(pd.x + pd.w, pd.y + pd.h), this.sy(pd.x + pd.w, pd.y + pd.h))
    ctx.lineTo(this.sx(pd.x, pd.y + pd.h), this.sy(pd.x, pd.y + pd.h))
    ctx.closePath()
    ctx.stroke()
    ctx.restore()
    this.label(text, pd.cx, pd.cy, 1.2, { bg: '#713f12', fg: '#fde68a', size: 12 })
  }

  // ---- buildings ----

  private drawArch(time: number): void {
    // brick gate pillars + steel truss + hanging sign
    for (const px of [ENTRANCE.x - 2.3, ENTRANCE.x + 2]) {
      this.bx(px, 20.2, 0.5, 0.5, 2.1, '#b45309')
      const { ctx } = this
      ctx.strokeStyle = 'rgba(69,26,3,0.6)'
      ctx.lineWidth = 1.5
      for (let i = 1; i < 5; i++) {
        const y0 = this.sy(px + 0.25, 20.45, i * 0.42)
        const x0 = this.sx(px, 20.45) - this.tw * 0.12
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        ctx.lineTo(x0 + this.tw * 0.24, y0)
        ctx.stroke()
      }
      this.bx(px - 0.05, 20.15, 0.6, 0.6, 0.14, '#e8e2d4')
    }
    const { ctx } = this
    const yT = 2.1
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(this.sx(ENTRANCE.x - 2.3, 20.45), this.sy(ENTRANCE.x - 2.3, 20.45, yT))
    ctx.lineTo(this.sx(ENTRANCE.x + 2.3, 20.45), this.sy(ENTRANCE.x + 2.3, 20.45, yT))
    ctx.stroke()
    ctx.lineWidth = 1.5
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath()
      ctx.moveTo(this.sx(ENTRANCE.x + i * 0.9, 20.45), this.sy(ENTRANCE.x + i * 0.9, 20.45, yT))
      ctx.lineTo(this.sx(ENTRANCE.x + i * 0.9, 20.45), this.sy(ENTRANCE.x + i * 0.9, 20.45, yT - 0.35))
      ctx.stroke()
    }
    const sway = Math.sin(time * 1.2) * 0.02
    this.label('★ GARAGE EMPIRE ★', ENTRANCE.x + sway, 20.45, yT - 0.62, { bg: '#0f172a', fg: '#fbbf24', size: 15 })
  }

  private drawGarage(time: number): void {
    const b = GARAGE_BUILDING
    void time
    // slab + low cutaway walls
    this.bx(b.x, b.y, b.w, b.h, 0.14, '#cfc7b6')
    this.bx(b.x, b.y, b.w, 0.5, 1.5, '#e9e4d8')
    // roller door with slats on the back wall
    const { ctx } = this
    const dw = 2.6
    const dx0 = b.x + (b.w - dw) / 2
    this.bx(dx0, b.y + 0.06, dw, 0.34, 1.32, '#8b98a9')
    ctx.strokeStyle = 'rgba(40,48,60,0.55)'
    ctx.lineWidth = 1.5
    for (let i = 1; i < 6; i++) {
      const y0 = this.sy(dx0 + dw / 2, b.y + 0.23, i * 0.21)
      ctx.beginPath()
      ctx.moveTo(this.sx(dx0, b.y + 0.23) + 2, y0)
      ctx.lineTo(this.sx(dx0 + dw, b.y + 0.23) - 2, y0)
      ctx.stroke()
    }
    // side wall with window + awning
    this.bx(b.x, b.y, 0.5, b.h, 1.3, '#f4f1ea')
    this.bx(b.x + 0.08, b.y + 1.2, 0.34, 1.1, 0.62, '#274b63', 0.35)
    ctx.fillStyle = 'rgba(190,227,245,0.9)'
    const gx = this.sx(b.x + 0.25, b.y + 1.75)
    const gy = this.sy(b.x + 0.25, b.y + 1.75, 0.66)
    ctx.fillRect(gx - this.tw * 0.16, gy - this.tw * 0.14, this.tw * 0.32, this.tw * 0.28)
    ctx.strokeStyle = '#274b63'
    ctx.lineWidth = 2
    ctx.strokeRect(gx - this.tw * 0.16, gy - this.tw * 0.14, this.tw * 0.32, this.tw * 0.28)
    // south counter wall (teal) + interior dressing
    this.bx(b.x, b.y + b.h - 0.5, b.w, 0.5, 0.9, '#0d9488')
    this.bx(b.x + 0.8, b.y + 1.1, 1.5, 0.6, 0.55, '#b45309') // workbench
    this.bx(b.x + 0.9, b.y + 1.2, 1.3, 0.4, 0.12, '#7c4a1e', 0.55)
    this.bx(b.x + 3.6, b.y + 1.1, 0.9, 0.6, 1.1, '#475569') // tool cabinet
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = 'rgba(226,232,240,0.7)'
      ctx.lineWidth = 1.5
      const y0 = this.sy(b.x + 4.05, b.y + 1.4, 0.35 + i * 0.25)
      ctx.beginPath()
      ctx.moveTo(this.sx(b.x + 3.6, b.y + 1.4), y0)
      ctx.lineTo(this.sx(b.x + 4.5, b.y + 1.4), y0)
      ctx.stroke()
    }
    // rooftop sign on posts
    this.bx(b.x + 1.2, b.y + 0.5, 0.28, 0.28, 1.5, '#075985')
    this.bx(b.x + 4.5, b.y + 0.5, 0.28, 0.28, 1.5, '#075985')
    this.bx(b.x + 0.9, b.y + 0.35, 4.2, 0.55, 0.62, '#0e7490', 1.5)
    this.label('🔧 GARAGE', b.x + 3, b.y + 0.62, 2.32, { bg: 'rgba(12,74,110,0.95)', fg: '#fff', size: 14 })
  }

  private drawShowroom(time: number): void {
    void time
    // podium floor, glass back + side walls with mullions, fascia sign
    this.bx(23.4, 13.4, 5.6, 4, 0.12, '#eef2f6')
    const glass = 'rgba(165,205,240,0.75)'
    this.box3d(23.4, 13.4, 5.6, 0.35, 1.7, glass, glass, glass)
    this.box3d(23.4, 13.4, 0.35, 4, 1.7, glass, glass, glass)
    const { ctx } = this
    ctx.strokeStyle = 'rgba(240,248,255,0.95)'
    ctx.lineWidth = 2.5
    for (let i = 0; i <= 4; i++) {
      const x = 23.4 + i * 1.4
      ctx.beginPath()
      ctx.moveTo(this.sx(x, 13.4), this.sy(x, 13.4, 0))
      ctx.lineTo(this.sx(x, 13.4), this.sy(x, 13.4, 1.7))
      ctx.stroke()
    }
    this.bx(23.9, 13.15, 4.6, 0.4, 0.28, '#5b3410', 1.7)
    this.label('🏆 SHOWROOM', 26.2, 13.35, 2.28, { bg: '#78350f', fg: '#fde68a', size: 14 })
  }

  // ---- stations ----

  private bayDecal(r: { x: number; y: number; w: number; h: number; cx: number; cy: number }, color: string, icon: string, time: number): void {
    const { ctx } = this
    const cx = this.sx(r.cx, r.cy)
    const cy = this.sy(r.cx, r.cy)
    ctx.fillStyle = color + '2e'
    ctx.beginPath()
    ctx.ellipse(cx, cy, this.tw * 1.25, this.tw * 0.66, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.ellipse(cx, cy, this.tw * 1.25, this.tw * 0.66, 0, 0, Math.PI * 2)
    ctx.stroke()
    // painted floor icon, gently pulsing
    ctx.globalAlpha = 0.5 + Math.sin(time * 2 + r.cx) * 0.1
    ctx.font = `${this.tw * 0.55}px system-ui`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(icon, cx, cy + this.tw * 0.5)
    ctx.globalAlpha = 1
  }

  private drawStation(game: Game, id: StationId, locked: boolean, time: number): void {
    const r = STATION_RECTS[id]
    const st = STATIONS[id]
    if (locked) {
      const { ctx } = this
      const cx = this.sx(r.cx, r.cy)
      const cy = this.sy(r.cx, r.cy)
      ctx.save()
      ctx.strokeStyle = 'rgba(250,204,21,0.9)'
      ctx.lineWidth = 3
      ctx.setLineDash([10, 7])
      ctx.beginPath()
      ctx.ellipse(cx, cy, this.tw * 1.1, this.tw * 0.58, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
      // tarp-covered future equipment
      ctx.globalAlpha = 0.85
      ctx.fillStyle = '#57534e'
      const gw = this.tw * 0.9
      const gh = this.tw * (0.5 + (id === 'lift' || id === 'wash2' ? 0.35 : 0))
      ctx.beginPath()
      ctx.roundRect(cx - gw / 2, cy - gh, gw, gh, 6)
      ctx.fill()
      ctx.globalAlpha = 1
      const def = UNLOCKS.find((u) => u.id === st.unlock)
      if (def) this.label(`${def.icon} $${def.cost}`, r.cx, r.cy, 1.5, { bg: '#713f12', fg: '#fde68a' })
      return
    }
    this.withBuild(game, st.unlock ?? '', r.cx, r.cy, () => {
      const icons: Record<StationId, string> = { wash1: '🧽', wash2: '🧽', repair1: '🔧', lift: '🏗️', tire: '🛞', detail: '✨', paint: '🎨' }
      this.bayDecal(r, st.color, icons[id], time)
      switch (id) {
        case 'wash1':
        case 'wash2': this.drawWashBay(game, id, r, time); break
        case 'repair1': this.drawRepairBench(r, time); break
        case 'lift': this.drawLift(r); break
        case 'tire': this.drawTireStation(r); break
        case 'detail': this.drawDetailStudio(r, time); break
        case 'paint': this.drawPaintBooth(r); break
      }
    })
  }

  private drawWashBay(game: Game, id: StationId, r: { x: number; y: number; cx: number; cy: number }, time: number): void {
    // portal gantry: columns, top beam, hanging brushes, side foam tank, floor rails
    this.bx(r.x + 0.25, r.y + 0.15, 0.32, 3.1, 1.5, '#0369a1')
    this.bx(r.x + 2.43, r.y + 0.15, 0.32, 3.1, 1.5, '#0369a1')
    // hazard bases
    this.bx(r.x + 0.2, r.y + 0.1, 0.42, 0.5, 0.3, '#eab308')
    this.bx(r.x + 2.38, r.y + 0.1, 0.42, 0.5, 0.3, '#eab308')
    this.bx(r.x + 0.25, r.y + 0.15, 2.5, 0.32, 0.34, '#0ea5e9', 1.5)
    // control totem with lights
    this.bx(r.x + 2.75, r.y + 2.5, 0.4, 0.4, 1.0, '#0f766e')
    const busy = game.cars.some((cc) => cc.bay === id && cc.work && (cc.work.service === 'wash' || cc.work.service === 'detail'))
    const { ctx } = this
    const lx = this.sx(r.x + 2.95, r.y + 2.7)
    const ly = this.sy(r.x + 2.95, r.y + 2.7, 1.05)
    ctx.fillStyle = busy ? '#4ade80' : '#f87171'
    ctx.beginPath()
    ctx.arc(lx, ly, 4 + (busy ? Math.sin(time * 8) * 1.2 : 0), 0, Math.PI * 2)
    ctx.fill()
    // foam tank + hose
    this.bx(r.x - 0.55, r.y + 2.4, 0.55, 0.7, 0.85, '#7dd3fc')
    ctx.strokeStyle = '#075985'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(this.sx(r.x - 0.28, r.y + 2.75), this.sy(r.x - 0.28, r.y + 2.75, 0.85))
    ctx.quadraticCurveTo(
      this.sx(r.x + 0.6, r.y + 2.9), this.sy(r.x + 0.6, r.y + 2.9, 0.3),
      this.sx(r.x + 1.1, r.y + 2.2), this.sy(r.x + 1.1, r.y + 2.2, 0.15),
    )
    ctx.stroke()
    // spinning brush pair while washing
    if (busy) {
      for (const off of [-0.7, 0.7]) {
        const bx = this.sx(r.cx + off, r.cy)
        const by = this.sy(r.cx + off, r.cy, 0.75)
        ctx.save()
        ctx.translate(bx, by)
        ctx.rotate(time * 7 + off)
        ctx.fillStyle = 'rgba(186,230,253,0.9)'
        for (let i = 0; i < 3; i++) {
          ctx.rotate((Math.PI * 2) / 3)
          ctx.beginPath()
          ctx.roundRect(-3, -this.tw * 0.32, 6, this.tw * 0.32, 3)
          ctx.fill()
        }
        ctx.restore()
      }
    }
    // floor rails + puddle sheen
    ctx.fillStyle = 'rgba(125,211,252,0.35)'
    ctx.beginPath()
    ctx.ellipse(this.sx(r.cx, r.cy + 0.9), this.sy(r.cx, r.cy + 0.9), this.tw * 0.9, this.tw * 0.28, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawRepairBench(r: { x: number; y: number }, time: number): void {
    void time
    // workbench with vise, pegboard with tool silhouettes, creeper, parts shelf
    this.bx(r.x + 0.2, r.y + 2.55, 1.5, 0.55, 0.55, '#a16207')
    this.bx(r.x + 0.3, r.y + 2.6, 1.3, 0.35, 0.1, '#713f12', 0.55)
    this.bx(r.x + 1.35, r.y + 2.6, 0.25, 0.25, 0.2, '#374151', 0.55) // vise
    // pegboard
    this.bx(r.x + 1.95, r.y + 2.65, 0.08, 0.9, 1.0, '#92400e', 0.35)
    const { ctx } = this
    ctx.strokeStyle = '#1f2937'
    ctx.lineWidth = 2.5
    for (const oy of [0.2, 0.45, 0.7]) {
      const tx = this.sx(r.x + 2.0, r.y + 2.65 + oy)
      const ty = this.sy(r.x + 2.0, r.y + 2.65 + oy, 0.75)
      ctx.beginPath()
      ctx.moveTo(tx, ty - 6)
      ctx.lineTo(tx, ty + 6)
      ctx.stroke()
    }
    // red creeper + parts shelf + oil can
    this.bx(r.x + 0.2, r.y + 0.4, 1.1, 0.45, 0.12, '#b91c1c')
    this.bx(r.x + 2.0, r.y + 0.3, 0.8, 0.5, 1.3, '#475569')
    this.bx(r.x + 2.05, r.y + 0.35, 0.7, 0.4, 0.14, '#64748b', 0.5)
    this.bx(r.x + 2.05, r.y + 0.35, 0.7, 0.4, 0.14, '#64748b', 0.9)
    this.bx(r.x + 0.5, r.y + 1.9, 0.28, 0.28, 0.4, '#dc2626')
  }

  private drawLift(r: { x: number; y: number }): void {
    // two-post lift with hazard stripes, crossbar and swing arms
    for (const px of [r.x + 0.25, r.x + 2.45]) {
      this.bx(px, r.y + 0.4, 0.34, 0.5, 1.5, '#be123c')
      const { ctx } = this
      ctx.save()
      ctx.fillStyle = '#facc15'
      for (let i = 0; i < 3; i++) {
        const y0 = this.sy(px + 0.17, r.y + 0.65, 0.25 + i * 0.35)
        const x0 = this.sx(px, r.y + 0.65)
        ctx.fillRect(x0 - 4, y0 - 5, 8, 5)
      }
      ctx.restore()
    }
    this.bx(r.x + 0.25, r.y + 0.4, 2.54, 0.3, 0.28, '#881337', 1.5)
    // swing arms reaching under the car
    this.bx(r.x + 0.5, r.y + 1.3, 0.9, 0.22, 0.22, '#facc15')
    this.bx(r.x + 1.7, r.y + 1.3, 0.9, 0.22, 0.22, '#facc15')
  }

  private drawTireStation(r: { x: number; y: number }): void {
    // tire changer (column + arm + table), balancer, rim stacks
    this.bx(r.x + 0.3, r.y + 2.3, 0.45, 0.45, 1.15, '#6d28d9')
    this.bx(r.x + 0.42, r.y + 2.0, 0.2, 1.0, 0.2, '#4c1d95', 0.9)
    this.bx(r.x + 1.15, r.y + 2.35, 0.75, 0.75, 0.28, '#374151')
    const { ctx } = this
    const tx = this.sx(r.x + 1.52, r.y + 2.72)
    const ty = this.sy(r.x + 1.52, r.y + 2.72, 0.3)
    ctx.fillStyle = '#1f2937'
    ctx.beginPath(); ctx.arc(tx, ty, this.tw * 0.24, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#a78bfa'
    ctx.beginPath(); ctx.arc(tx, ty, this.tw * 0.12, 0, Math.PI * 2); ctx.fill()
    // balancer cabinet + stacked wheels with rims
    this.bx(r.x + 2.1, r.y + 2.4, 0.6, 0.5, 0.8, '#4c1d95')
    for (const [ox, oy] of [[0.35, 0.5], [0.35, 0.95], [2.15, 0.5]] as const) {
      const sx = this.sx(r.x + ox, r.y + oy)
      const sy = this.sy(r.x + ox, r.y + oy, 0.16)
      ctx.fillStyle = '#1f2937'
      ctx.beginPath(); ctx.arc(sx, sy, this.tw * 0.2, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#d1d5db'
      ctx.beginPath(); ctx.arc(sx, sy, this.tw * 0.09, 0, Math.PI * 2); ctx.fill()
    }
  }

  private drawDetailStudio(r: { x: number; y: number }, time: number): void {
    // canopy tent: poles + striped awning, work lamp, vacuum, buffer cart
    for (const [px, py] of [[r.x + 0.2, r.y + 0.2], [r.x + 2.6, r.y + 0.2], [r.x + 0.2, r.y + 3.0], [r.x + 2.6, r.y + 3.0]] as const) {
      this.bx(px, py, 0.18, 0.18, 1.9, '#0f766e')
    }
    const { ctx } = this
    const stripe = (x0: number, col: string) => {
      ctx.fillStyle = col
      ctx.beginPath()
      ctx.moveTo(this.sx(x0, r.y + 0.2), this.sy(x0, r.y + 0.2, 1.9))
      ctx.lineTo(this.sx(x0 + 0.7, r.y + 0.2), this.sy(x0 + 0.7, r.y + 0.2, 1.9))
      ctx.lineTo(this.sx(x0 + 0.7, r.y + 3.2), this.sy(x0 + 0.7, r.y + 3.2, 1.9))
      ctx.lineTo(this.sx(x0, r.y + 3.2), this.sy(x0, r.y + 3.2, 1.9))
      ctx.closePath(); ctx.fill()
    }
    for (let i = 0; i < 4; i++) stripe(r.x + 0.2 + i * 0.7, i % 2 === 0 ? '#f8fafc' : '#2dd4bf')
    // hanging work lamp with sway + glow
    const lx = this.sx(r.x + 1.6, r.y + 1.4)
    const ly = this.sy(r.x + 1.6, r.y + 1.4, 1.55) + Math.sin(time * 1.6) * 2
    ctx.strokeStyle = '#134e4a'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(this.sx(r.x + 1.6, r.y + 1.4), this.sy(r.x + 1.6, r.y + 1.4, 1.9))
    ctx.lineTo(lx, ly)
    ctx.stroke()
    ctx.fillStyle = '#fef9c3'
    ctx.beginPath(); ctx.arc(lx, ly, 5, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(254,249,195,0.18)'
    ctx.beginPath(); ctx.arc(lx, ly + 8, 16, 0, Math.PI * 2); ctx.fill()
    // vacuum canister + buffer cart
    this.bx(r.x + 0.3, r.y + 2.5, 0.5, 0.5, 0.6, '#dc2626')
    this.bx(r.x + 2.2, r.y + 2.5, 0.55, 0.5, 0.45, '#334155')
  }

  private drawPaintBooth(r: { x: number; y: number }): void {
    // spray booth: solid ochre on the hidden faces (north + west), low open
    // faces toward the camera (east + south) so the car stays readable.
    this.bx(r.x, r.y, 3.4, 0.3, 1.7, '#92400e')
    this.bx(r.x, r.y, 0.3, 3.4, 1.7, '#b45309')
    this.bx(r.x + 3.1, r.y, 0.3, 3.4, 0.7, '#ca8a04')
    // corner posts + vent stack riding on the back wall
    for (const [px, py] of [[r.x, r.y], [r.x + 3.15, r.y], [r.x, r.y + 3.15], [r.x + 3.15, r.y + 3.15]] as const) {
      this.bx(px, py, 0.25, 0.25, 1.7, '#78350f')
    }
    this.bx(r.x + 0.45, r.y - 0.1, 0.5, 0.5, 0.75, '#78716c', 1.7)
    this.bx(r.x + 0.52, r.y - 0.03, 0.36, 0.36, 0.14, '#44403c', 2.45)
    // low front guide wall so the car stays readable
    this.bx(r.x, r.y + 3.1, 3.4, 0.3, 0.55, '#ca8a04')
  }

  private drawTank(): void {
    // pro pressure kit: tank, gauge, coiled hose
    this.bx(9.6, 2.4, 1.1, 1.0, 1.0, '#0284c7')
    this.bx(9.6, 2.4, 1.1, 1.0, 0.18, '#075985')
    const { ctx } = this
    const gx = this.sx(10.15, 2.4)
    const gy = this.sy(10.15, 2.4, 1.05)
    ctx.fillStyle = '#f8fafc'
    ctx.beginPath(); ctx.arc(gx, gy, 5, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#dc2626'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(gx, gy)
    ctx.lineTo(gx + 3, gy - 3)
    ctx.stroke()
    ctx.strokeStyle = '#075985'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(this.sx(10.15, 3.6), this.sy(10.15, 3.6, 0.2), 7, 0, Math.PI * 2)
    ctx.stroke()
    this.label('💦 PRO', 10.15, 3.0, 1.35, { size: 11 })
  }

  private drawBillboard(): void {
    // roadside billboard on twin posts with floodlight bar
    this.bx(18.85, 14.7, 0.3, 0.3, 2.0, '#44403c')
    this.bx(19.6, 14.7, 0.3, 0.3, 2.0, '#44403c')
    const { ctx } = this
    const cx = this.sx(19.2, 14.85)
    const cy = this.sy(19.2, 14.85, 2.2)
    ctx.fillStyle = '#f59e0b'
    const w = this.tw * 1.7
    const h = this.tw * 0.72
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h)
    ctx.fillStyle = '#fffbeb'
    ctx.fillRect(cx - w / 2 + 5, cy - h / 2 + 5, w - 10, h * 0.42)
    ctx.fillStyle = '#b45309'
    ctx.font = `800 ${this.tw * 0.22}px system-ui`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('WASH • FIX', cx, cy - h * 0.2)
    ctx.fillStyle = '#7c2d12'
    ctx.font = `900 ${this.tw * 0.3}px system-ui`
    ctx.fillText('FLIP!', cx, cy + h * 0.22)
  }

  private drawHireBoard(): void {
    // staff notice board with pinned notes
    this.bx(HIRE_BOARD.x - 0.45, HIRE_BOARD.y - 0.2, 0.22, 0.3, 1.15, '#57370c')
    this.bx(HIRE_BOARD.x + 0.35, HIRE_BOARD.y - 0.2, 0.22, 0.3, 1.15, '#57370c')
    this.bx(HIRE_BOARD.x - 0.6, HIRE_BOARD.y - 0.35, 1.5, 0.3, 0.85, '#8a5a2b', 0.55)
    const { ctx } = this
    const bx = this.sx(HIRE_BOARD.x + 0.05, HIRE_BOARD.y - 0.2)
    const by = this.sy(HIRE_BOARD.x + 0.05, HIRE_BOARD.y - 0.2, 0.85)
    ctx.fillStyle = '#fef9c3'
    ctx.fillRect(bx - 14, by - 10, 11, 13)
    ctx.fillStyle = '#bfdbfe'
    ctx.fillRect(bx + 1, by - 8, 11, 13)
    ctx.fillStyle = '#fecaca'
    ctx.fillRect(bx - 7, by - 2, 11, 12)
    this.label('🧑‍🔧 STAFF', HIRE_BOARD.x, HIRE_BOARD.y, 1.6, { bg: '#1e3a8a', fg: '#bfdbfe' })
  }

  private drawBuntingLot(time: number): void {
    // used-car lot dressing: pennant strings around the lot
    const { ctx } = this
    const lines: [number, number, number, number][] = [
      [24, 2, 28.6, 2],
      [24, 2, 24, 7.4],
    ]
    const cols = ['#ef4444', '#facc15', '#22c55e', '#38bdf8', '#f472b6']
    for (const [x1, y1, x2, y2] of lines) {
      this.bx(x1 - 0.09, y1 - 0.09, 0.18, 0.18, 1.9, '#44403c')
      this.bx(x2 - 0.09, y2 - 0.09, 0.18, 0.18, 1.9, '#44403c')
      const ax = this.sx(x1, y1)
      const ay = this.sy(x1, y1, 1.9)
      const bx = this.sx(x2, y2)
      const by = this.sy(x2, y2, 1.9)
      ctx.strokeStyle = '#57534e'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 14, bx, by)
      ctx.stroke()
      for (let i = 1; i < 7; i++) {
        const t = i / 7
        const px = ax + (bx - ax) * t
        const py = ay + (by - ay) * t + Math.sin(t * Math.PI) * 14 + Math.sin(time * 2 + i) * 1.5
        ctx.fillStyle = cols[i % cols.length]
        ctx.beginPath()
        ctx.moveTo(px - 5, py)
        ctx.lineTo(px + 5, py)
        ctx.lineTo(px, py + 9)
        ctx.closePath()
        ctx.fill()
      }
    }
  }

  private drawDecor(kind: string, x: number, y: number, s: number, time: number): void {
    const { ctx } = this
    this.shadow(x, y, 0.3 * s, 0.15 * s)
    if (kind === 'tree') {
      this.bx(x - 0.13, y - 0.13, 0.26, 0.26, 0.7, '#7c4a21')
      const cx = this.sx(x, y)
      const cy = this.sy(x, y, 1.15 * s)
      ctx.fillStyle = '#15803d'
      ctx.beginPath(); ctx.arc(cx, cy, this.tw * 0.4 * s, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#22c55e'
      ctx.beginPath(); ctx.arc(cx - this.tw * 0.14, cy - this.tw * 0.14, this.tw * 0.25 * s, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#4ade80'
      ctx.beginPath(); ctx.arc(cx - this.tw * 0.2, cy - this.tw * 0.22, this.tw * 0.12 * s, 0, Math.PI * 2); ctx.fill()
    } else if (kind === 'lamp') {
      this.bx(x - 0.09, y - 0.09, 0.18, 0.18, 1.9, '#3f4756')
      this.bx(x - 0.3, y - 0.15, 0.6, 0.3, 0.22, '#232a36', 1.9)
      const cx = this.sx(x, y)
      const cy = this.sy(x, y, 1.95)
      ctx.fillStyle = '#fef9c3'
      ctx.fillRect(cx - 9, cy - 3, 18, 6)
    } else if (kind === 'cone') {
      const cx = this.sx(x, y)
      const cy = this.sy(x, y, 0)
      ctx.fillStyle = '#f97316'
      ctx.beginPath()
      ctx.moveTo(cx, cy - this.tw * 0.36)
      ctx.lineTo(cx + this.tw * 0.19, cy)
      ctx.lineTo(cx - this.tw * 0.19, cy)
      ctx.closePath(); ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.fillRect(cx - this.tw * 0.12, cy - this.tw * 0.17, this.tw * 0.24, this.tw * 0.08)
      this.bx(x - 0.2, y - 0.12, 0.4, 0.24, 0.06, '#c2410c')
    } else if (kind === 'crate') {
      // parts box with tape stripe + stencil dot
      this.bx(x - 0.32, y - 0.32, 0.64, 0.64, 0.52, '#c99a5b')
      this.bx(x - 0.32, y - 0.1, 0.64, 0.2, 0.53, '#8a5a2b')
      ctx.fillStyle = 'rgba(69,26,3,0.5)'
      ctx.beginPath()
      ctx.arc(this.sx(x + 0.1, y + 0.1), this.sy(x + 0.1, y + 0.1, 0.53), 3, 0, Math.PI * 2)
      ctx.fill()
    } else if (kind === 'tire') {
      const cx = this.sx(x, y)
      const cy = this.sy(x, y, 0.22)
      ctx.fillStyle = '#1f2937'
      ctx.beginPath(); ctx.arc(cx, cy, this.tw * 0.28, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#374151'
      ctx.beginPath(); ctx.arc(cx, cy, this.tw * 0.2, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#9ca3af'
      ctx.beginPath(); ctx.arc(cx, cy, this.tw * 0.09, 0, Math.PI * 2); ctx.fill()
    } else if (kind === 'bench') {
      this.bx(x - 0.75, y - 0.28, 1.5, 0.56, 0.28, '#8a5a2b')
      this.bx(x - 0.65, y - 0.2, 0.2, 0.2, 0.28, '#57370c', 0.28)
      this.bx(x + 0.45, y - 0.2, 0.2, 0.2, 0.28, '#57370c', 0.28)
    } else {
      // plant: pot + foliage
      this.bx(x - 0.16, y - 0.16, 0.32, 0.32, 0.3, '#b45309')
      const cx = this.sx(x, y)
      const cy = this.sy(x, y, 0.5)
      ctx.fillStyle = '#16a34a'
      ctx.beginPath(); ctx.arc(cx - 4, cy, this.tw * 0.14, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(cx + 5, cy - 3, this.tw * 0.16, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#4ade80'
      ctx.beginPath(); ctx.arc(cx, cy - 6 + Math.sin(time * 2 + x) * 1.2, this.tw * 0.1, 0, Math.PI * 2); ctx.fill()
    }
  }

  // ---- cars ----

  private drawCar(game: Game, car: Car, time: number): void {
    const { ctx } = this
    const spec = CAR_SPECS[car.type.id] ?? CAR_SPECS.sedan
    if (car.phase === 'offer') {
      const cx = this.sx(car.x, car.y)
      const cy = this.sy(car.x, car.y)
      ctx.save()
      ctx.strokeStyle = 'rgba(250,204,21,0.8)'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 5])
      ctx.beginPath()
      ctx.ellipse(cx, cy, this.tw * 1.05, this.tw * 0.55, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
    // showroom podium
    if (car.phase === 'forSale' && car.parkIdx >= 100) {
      const cx = this.sx(car.x, car.y)
      const cy = this.sy(car.x, car.y)
      ctx.fillStyle = 'rgba(120,53,15,0.25)'
      ctx.beginPath()
      ctx.ellipse(cx, cy, this.tw * 1.15, this.tw * 0.6, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#f8fafc'
      ctx.beginPath()
      ctx.ellipse(cx, cy, this.tw * 1.0, this.tw * 0.5, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    const liftH = car.bay === 'lift' && car.phase === 'inBay' ? 10 : 0
    const hop = Math.sin(Math.min(1, car.bounce) * Math.PI) * 7
    this.shadow(car.x, car.y, spec.len * 0.52, 0.3)
    const jiggle = car.work ? Math.sin(time * 26 + car.seed) * 1.6 : 0
    const px = this.sx(car.x, car.y) + Math.cos(car.angle + Math.PI / 2) * jiggle * 0.3
    const py = this.sy(car.x, car.y, 0.1) - liftH - hop
    const sa = Math.atan2(Math.sin(car.angle) * 0.5, Math.cos(car.angle))
    const scale = 1 + car.pop * 0.07
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(sa)
    ctx.scale(scale, scale)
    drawVehicle(ctx, spec, {
      color: car.color,
      seed: car.seed,
      cond: car.cond,
      work: car.work ? car.work.service : null,
      time,
      tw: this.tw,
    })
    ctx.restore()

    if (car.cond.mech < 50 && car.phase !== 'leaving' && Math.random() < 0.1) {
      this.particles.push({
        x: car.x + 0.7, y: car.y, z: 0.5, vx: 0.2, vy: -0.2, vz: 1.1,
        life: 0, max: 0.9, color: 'rgba(90,90,100,0.65)', size: 5,
      })
    }

    const bx = car.x
    const by = car.y
    if (car.phase === 'inBay' && !car.done && car.needs.length > 0) {
      const svc = car.needs[0]
      const icon = car.work ? '⏳' : ({ wash: '🧽', tires: '🛞', engine: '🔧', body: '🔨', detail: '✨', paint: '🎨' } as Record<string, string>)[svc] ?? '❗'
      this.label(icon, bx, by, 1.45, { size: 13 })
      if (car.work) this.progressBar(bx, by, 1.12, car.work.progress, '#4ade80')
    } else if (car.phase === 'forSale') {
      const inShow = car.parkIdx >= 100
      const price = carValue(car.type, car.cond, { showroom: inShow })
      this.label(`💰 $${price}`, bx, by, 1.45, { bg: '#14532d', fg: '#bbf7d0' })
      if (car.sellerBy !== null) this.progressBar(bx, by, 1.08, Math.min(1, car.sellT / 5), '#a78bfa')
    } else if (car.phase === 'offer') {
      this.label(`🏷️ $${offerPrice(car.type, car.cond)}`, bx, by, 1.45, { bg: '#713f12', fg: '#fde68a' })
    } else if (car.phase === 'queued' && car.owner === 'player') {
      this.label('🔧', bx, by, 1.4, { size: 12 })
    }
    if (car.flash > 0) {
      ctx.strokeStyle = `rgba(74,222,128,${car.flash})`
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.ellipse(px, py, this.tw * 1.2 * (1.4 - car.flash * 0.4), this.tw * 0.62 * (1.4 - car.flash * 0.4), 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    void game
  }

  // ---- characters ----

  private drawPerson(
    x: number, y: number, angle: number, moving: boolean, working: string | null,
    time: number, seed: number,
    colors: { shirt: string; pants: string; skin: string; cap: string },
  ): void {
    const { ctx } = this
    this.shadow(x, y, 0.3, 0.14)
    const s = this.tw / 56
    const px = this.sx(x, y)
    const py = this.sy(x, y, 0)
    const dir = Math.cos(angle) >= 0 ? 1 : -1
    const walking = moving ? Math.sin(time * 11 + seed) : 0
    const breathe = Math.sin(time * 2.2 + seed) * 0.8 * s
    const scrub = working === 'wash' || working === 'detail' || working === 'paint'
      ? Math.sin(time * 13 + seed) * 5 * s : 0
    const pump = working === 'tires' || working === 'engine' || working === 'body'
      ? Math.abs(Math.sin(time * 9 + seed)) * -6 * s : 0
    const lean = moving ? 2.5 * s : scrub !== 0 ? 3 * s : 0

    ctx.lineCap = 'round'
    // legs
    ctx.strokeStyle = colors.pants
    ctx.lineWidth = 5.5 * s
    const hipY = py - 12 * s
    ctx.beginPath(); ctx.moveTo(px, hipY); ctx.lineTo(px - 4.5 * s + walking * 1.4 * s, py - 1); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(px, hipY); ctx.lineTo(px + 4.5 * s - walking * 1.4 * s, py - 1); ctx.stroke()
    // torso (lean into motion/work)
    ctx.fillStyle = colors.shirt
    ctx.beginPath()
    ctx.roundRect(px - 8 * s + lean * dir * 0.4, py - 33 * s + breathe * 0.3, 16 * s, 22 * s, 7 * s)
    ctx.fill()
    // overalls strap
    ctx.fillStyle = 'rgba(15,23,42,0.4)'
    ctx.fillRect(px - 2 * s + lean * dir * 0.4, py - 31 * s, 4 * s, 12 * s)
    // arms
    ctx.strokeStyle = colors.skin
    ctx.lineWidth = 4.5 * s
    if (scrub !== 0) {
      ctx.beginPath(); ctx.moveTo(px - 6 * s, py - 26 * s); ctx.lineTo(px + dir * (10 * s + scrub), py - 18 * s); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(px + 6 * s, py - 26 * s); ctx.lineTo(px + dir * (10 * s - scrub), py - 18 * s); ctx.stroke()
    } else {
      const swing = moving ? walking * 1.2 * s : 0
      ctx.beginPath(); ctx.moveTo(px - 7 * s, py - 27 * s); ctx.lineTo(px - 10 * s, py - 16 * s + swing + pump); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(px + 7 * s, py - 27 * s); ctx.lineTo(px + 10 * s, py - 16 * s - swing + pump); ctx.stroke()
    }
    // head + cap with brim toward facing
    const hx = px + lean * dir * 0.5
    const hy = py - 39 * s + breathe * 0.3 + pump * 0.4
    ctx.fillStyle = colors.skin
    ctx.beginPath()
    ctx.arc(hx, hy, 8.5 * s, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = colors.cap
    ctx.beginPath()
    ctx.arc(hx, hy - 1.5 * s, 8.5 * s, Math.PI * 0.95, Math.PI * 2.05)
    ctx.fill()
    ctx.fillRect(hx - 8.5 * s, hy - 3.5 * s, 17 * s, 3 * s)
    ctx.beginPath()
    ctx.roundRect(hx + (dir > 0 ? 2 * s : -14 * s), hy - 4 * s, 12 * s, 3.5 * s, 2 * s)
    ctx.fill()
  }

  private drawPlayer(game: Game, time: number, dt: number): void {
    const p = game.player
    if (p.moving && Math.random() < dt * 9) this.dust(p.x, p.y + 0.15)
    let working: string | null = null
    const it = game.current
    if (it && it.kind === 'work') {
      const car = game.cars.find((c) => c.id === it.carId)
      if (car?.work && car.work.by === 'player') working = car.work.service
    }
    this.drawPerson(p.x, p.y, p.angle, p.moving, working, time, 1, {
      shirt: '#f97316', pants: '#1e3a8a', skin: '#f6c69c', cap: '#0ea5e9',
    })
    if (it && it.kind === 'work' && it.progress > 0.01) {
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

  private drawWorker(game: Game, w: Worker, time: number): void {
    void game
    const col = WORKER_COLORS[w.role] ?? '#94a3b8'
    const moving = w.state === 'walk' || w.state === 'sellwalk'
    const working = w.state === 'work' && w.service ? w.service : null
    this.drawPerson(w.x, w.y, w.angle, moving, working, time, w.bob, {
      shirt: col, pants: '#334155', skin: '#eebd93', cap: shade(col, -45),
    })
    if (w.role === 'seller') {
      // briefcase
      const { ctx } = this
      const px = this.sx(w.x, w.y)
      const py = this.sy(w.x, w.y, 0)
      const s = this.tw / 56
      ctx.fillStyle = '#57370c'
      ctx.beginPath()
      ctx.roundRect(px + 8 * s, py - 12 * s, 12 * s, 9 * s, 2 * s)
      ctx.fill()
    } else if (w.state === 'work') {
      this.progressBar(w.x, w.y, 1.05, w.progress, col)
    }
  }
}
