// Parametric cartoon vehicles, drawn top-down in screen space (front = +x).
// Every type has a distinct silhouette from shared modular pieces: hull with
// tapered nose/tail, greenhouse, lights, bumpers, mirrors, wheels and trim.
// Condition (dirt, damage, shine) is baked into the paint, not just labelled.

import type { ServiceKind } from './config'
import type { Conditions } from './config'

export interface CarSpec {
  len: number
  wid: number
  /** front-half width factor (1 = slab nose, lower = tapered) */
  nose: number
  tail: number
  /** cabin center, 0 = rear … 1 = front */
  cabinAt: number
  cabinLen: number
  glassRoof?: boolean
  spoiler?: boolean
  rails?: boolean
  tallVan?: boolean
  sunroof?: boolean
}

export const CAR_SPECS: Record<string, CarSpec> = {
  compact: { len: 1.7, wid: 0.94, nose: 0.86, tail: 0.9, cabinAt: 0.52, cabinLen: 0.46 },
  sedan: { len: 1.92, wid: 0.95, nose: 0.82, tail: 0.88, cabinAt: 0.5, cabinLen: 0.4, sunroof: true },
  hatch: { len: 1.76, wid: 0.94, nose: 0.86, tail: 0.94, cabinAt: 0.54, cabinLen: 0.48 },
  suv: { len: 2.0, wid: 1.02, nose: 0.9, tail: 0.92, cabinAt: 0.52, cabinLen: 0.52, rails: true, sunroof: true },
  van: { len: 2.12, wid: 1.04, nose: 0.92, tail: 0.96, cabinAt: 0.56, cabinLen: 0.6, tallVan: true },
  sport: { len: 1.9, wid: 1.0, nose: 0.74, tail: 0.86, cabinAt: 0.44, cabinLen: 0.34, glassRoof: true, spoiler: true },
}

export interface CarDrawOpts {
  color: string
  seed: number
  cond: Conditions
  /** active job, for in-progress effects */
  work: ServiceKind | null
  time: number
  /** pixels per tile */
  tw: number
}

export function shade(hex: string, amt: number): string {
  const n = hex.replace('#', '')
  const v = n.length === 3 ? n.split('').map((c) => c + c).join('') : n
  const num = parseInt(v, 16)
  const r = Math.max(0, Math.min(255, (num >> 16) + amt))
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt))
  const b = Math.max(0, Math.min(255, (num & 0xff) + amt))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function rnd(seed: number, i: number): number {
  const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Symmetric hull path, front = +x. */
function hullPath(ctx: CanvasRenderingContext2D, L: number, W: number, nose: number, tail: number): void {
  const x0 = -L / 2
  const x1 = L / 2
  const wN = (W / 2) * nose
  const wT = (W / 2) * tail
  const wM = W / 2
  ctx.beginPath()
  ctx.moveTo(x0 + L * 0.04, -wT)
  ctx.lineTo(x1 - L * 0.1, -wN)
  ctx.quadraticCurveTo(x1, -wN * 0.9, x1, 0)
  ctx.quadraticCurveTo(x1, wN * 0.9, x1 - L * 0.1, wN)
  ctx.lineTo(x0 + L * 0.04, wT)
  ctx.quadraticCurveTo(x0, wT * 0.92, x0, 0)
  ctx.quadraticCurveTo(x0, -wT * 0.92, x0 + L * 0.04, -wT)
  ctx.closePath()
  void wM
}

export function drawVehicle(ctx: CanvasRenderingContext2D, spec: CarSpec, o: CarDrawOpts): void {
  const { tw } = o
  const L = spec.len * tw
  const W = spec.wid * tw * 0.86
  const dirt = 1 - o.cond.clean / 100
  const flat = o.cond.tires < 55
  const glass = o.cond.clean < 40 ? '#8a7a63' : '#a8d4ea'

  // ---- wheels (behind body, protruding past the sills) ----
  const tireL = L * 0.17
  const tireW = Math.max(5, W * 0.15)
  const wx = L * 0.3
  const wy = W / 2 - tireW * 0.28
  const wheels: [number, number][] = [[wx, -wy], [wx, wy], [-wx, -wy], [-wx, wy]]
  const flatIdx = flat ? 2 + Math.floor(rnd(o.seed, 9) * 2) : -1
  wheels.forEach(([x, y], i) => {
    const squash = i === flatIdx ? 0.62 : 1
    ctx.fillStyle = '#20242e'
    ctx.beginPath()
    ctx.roundRect(x - tireL / 2, y - (tireW * squash) / 2, tireL, tireW * squash, tireW * 0.32)
    ctx.fill()
    ctx.fillStyle = '#c3cad4'
    ctx.beginPath()
    ctx.roundRect(x - tireL * 0.26, y - (tireW * squash) * 0.26, tireL * 0.52, (tireW * squash) * 0.52, 3)
    ctx.fill()
    ctx.fillStyle = '#5b6472'
    ctx.beginPath()
    ctx.arc(x, y, Math.max(1.5, tireW * 0.1), 0, Math.PI * 2)
    ctx.fill()
  })

  // ---- hull ----
  hullPath(ctx, L, W, spec.nose, spec.tail)
  const grad = ctx.createLinearGradient(0, -W / 2, 0, W / 2)
  grad.addColorStop(0, shade(o.color, 26))
  grad.addColorStop(0.45, o.color)
  grad.addColorStop(1, shade(o.color, -34))
  ctx.fillStyle = grad
  ctx.fill()
  ctx.save()
  hullPath(ctx, L, W, spec.nose, spec.tail)
  ctx.clip()

  // hood + trunk shading
  ctx.fillStyle = 'rgba(255,255,255,0.16)'
  ctx.beginPath()
  ctx.roundRect(L * 0.2, -W * 0.32, L * 0.24, W * 0.64, W * 0.1)
  ctx.fill()
  // door seams + handles
  ctx.strokeStyle = 'rgba(15,20,30,0.35)'
  ctx.lineWidth = Math.max(1, tw * 0.02)
  for (const dx of [-0.02, 0.14]) {
    ctx.beginPath()
    ctx.moveTo(L * dx, -W * 0.48)
    ctx.lineTo(L * dx, W * 0.48)
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(15,20,30,0.5)'
  for (const dx of [0.02, 0.18]) {
    ctx.fillRect(L * dx - tw * 0.03, -W * 0.4, tw * 0.06, tw * 0.035)
    ctx.fillRect(L * dx - tw * 0.03, W * 0.4 - tw * 0.035, tw * 0.06, tw * 0.035)
  }
  if (spec.tallVan) {
    // sliding-door rail + tall roof shading
    ctx.strokeStyle = 'rgba(15,20,30,0.4)'
    ctx.beginPath()
    ctx.moveTo(-L * 0.3, -W * 0.3)
    ctx.lineTo(L * 0.15, -W * 0.3)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-L * 0.3, W * 0.3)
    ctx.lineTo(L * 0.15, W * 0.3)
    ctx.stroke()
  }

  // ---- greenhouse ----
  const cabC = (spec.cabinAt - 0.5) * L
  const cabL = spec.cabinLen * L
  const cabW = W * (spec.tallVan ? 0.72 : 0.62)
  // windshield
  const wsX = cabC + cabL * 0.42
  ctx.fillStyle = glass
  ctx.beginPath()
  ctx.moveTo(wsX, -cabW * 0.5)
  ctx.lineTo(wsX + cabL * 0.2, -cabW * 0.38)
  ctx.lineTo(wsX + cabL * 0.2, cabW * 0.38)
  ctx.lineTo(wsX, cabW * 0.5)
  ctx.closePath()
  ctx.fill()
  // roof
  ctx.fillStyle = spec.glassRoof ? glass : shade(o.color, -46)
  ctx.beginPath()
  ctx.roundRect(cabC - cabL * 0.42, -cabW * 0.44, cabL * 0.84, cabW * 0.88, W * 0.08)
  ctx.fill()
  if (spec.sunroof && !spec.glassRoof) {
    ctx.fillStyle = glass
    ctx.beginPath()
    ctx.roundRect(cabC - cabL * 0.2, -cabW * 0.24, cabL * 0.4, cabW * 0.48, W * 0.05)
    ctx.fill()
  }
  // rear window
  ctx.fillStyle = glass
  ctx.fillRect(cabC - cabL * 0.52, -cabW * 0.4, cabL * 0.08, cabW * 0.8)
  // glass glint
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'
  ctx.lineWidth = Math.max(1, tw * 0.025)
  ctx.beginPath()
  ctx.moveTo(wsX + cabL * 0.04, -cabW * 0.34)
  ctx.lineTo(wsX + cabL * 0.14, -cabW * 0.1)
  ctx.stroke()
  // roof rails
  if (spec.rails) {
    ctx.strokeStyle = 'rgba(20,25,35,0.65)'
    ctx.lineWidth = Math.max(1.5, tw * 0.035)
    for (const yy of [-cabW * 0.34, cabW * 0.34]) {
      ctx.beginPath()
      ctx.moveTo(cabC - cabL * 0.4, yy)
      ctx.lineTo(cabC + cabL * 0.4, yy)
      ctx.stroke()
    }
  }
  // spoiler
  if (spec.spoiler) {
    ctx.fillStyle = shade(o.color, -50)
    ctx.fillRect(-L * 0.52, -W * 0.4, tw * 0.07, W * 0.8)
    ctx.fillStyle = shade(o.color, -30)
    ctx.beginPath()
    ctx.roundRect(-L * 0.56, -W * 0.44, tw * 0.12, W * 0.88, 3)
    ctx.fill()
  }

  // ---- dirt grade + splatter (clipped to hull) ----
  if (dirt > 0.04) {
    ctx.fillStyle = `rgba(107,72,36,${0.34 * dirt})`
    ctx.fillRect(-L / 2, -W / 2, L, W)
    for (let i = 0; i < 9; i++) {
      const nearWheel = i < 5
      const bx = nearWheel
        ? (i % 2 === 0 ? wx : -wx) + (rnd(o.seed, i) - 0.5) * L * 0.3
        : (rnd(o.seed, 40 + i) - 0.5) * L * 0.9
      const by = nearWheel
        ? (i < 3 ? -1 : 1) * W * 0.42
        : (rnd(o.seed, 60 + i) - 0.5) * W * 0.8
      ctx.fillStyle = `rgba(96,63,30,${0.35 + 0.4 * dirt * rnd(o.seed, 80 + i)})`
      ctx.beginPath()
      ctx.arc(bx, by, tw * (0.06 + 0.1 * rnd(o.seed, 100 + i)), 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // ---- damage: dents + cracked glass ----
  const dents = o.cond.body < 55 ? 2 : o.cond.body < 92 ? 1 : 0
  for (let i = 0; i < dents; i++) {
    const dx = (rnd(o.seed, 200 + i) - 0.5) * L * 0.6
    const dy = (rnd(o.seed, 220 + i) - 0.5) * W * 0.6
    const r = tw * (0.1 + 0.06 * rnd(o.seed, 240 + i))
    ctx.fillStyle = 'rgba(40,26,16,0.55)'
    ctx.beginPath()
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2
      const rr = r * (0.7 + 0.5 * rnd(o.seed, 260 + i * 7 + k))
      const px = dx + Math.cos(a) * rr
      const py = dy + Math.sin(a) * rr
      if (k === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(dx - r * 0.5, dy + r * 0.3)
    ctx.lineTo(dx + r * 0.5, dy - r * 0.4)
    ctx.stroke()
  }
  if (o.cond.body < 45) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(wsX + cabL * 0.1, -cabW * 0.2)
    ctx.lineTo(wsX + cabL * 0.02, 0)
    ctx.lineTo(wsX + cabL * 0.12, cabW * 0.25)
    ctx.moveTo(wsX + cabL * 0.02, 0)
    ctx.lineTo(wsX - cabL * 0.06, -cabW * 0.3)
    ctx.stroke()
  }

  // ---- fresh-paint specular + sparkles ----
  if (o.cond.shine > 80 && dirt < 0.4) {
    ctx.fillStyle = 'rgba(255,255,255,0.28)'
    ctx.beginPath()
    ctx.moveTo(L * 0.05, -W * 0.3)
    ctx.lineTo(L * 0.3, -W * 0.3)
    ctx.lineTo(L * 0.12, W * 0.3)
    ctx.lineTo(-L * 0.13, W * 0.3)
    ctx.closePath()
    ctx.fill()
    const tw2 = 0.6 + 0.4 * Math.sin(o.time * 5 + o.seed)
    ctx.fillStyle = `rgba(255,255,255,${0.55 * tw2})`
    spark(ctx, -L * 0.28, -W * 0.28, tw * 0.09 * tw2)
    spark(ctx, L * 0.34, W * 0.2, tw * 0.07 * (1.2 - tw2))
  }

  // ---- in-progress effects ----
  if (o.work === 'wash' || o.work === 'detail' || o.work === 'paint') {
    for (let i = 0; i < 8; i++) {
      const bx = (rnd(o.seed, 300 + i) - 0.5) * L * 0.85
      const by = (rnd(o.seed, 320 + i) - 0.5) * W * 0.8
      ctx.fillStyle = o.work === 'paint' ? 'rgba(244,114,182,0.5)' : 'rgba(255,255,255,0.75)'
      ctx.beginPath()
      ctx.arc(bx, by, tw * (0.05 + 0.06 * rnd(o.seed, 340 + i)), 0, Math.PI * 2)
      ctx.fill()
    }
    // scrub sweeps
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = Math.max(2, tw * 0.05)
    for (let i = 0; i < 2; i++) {
      const off = Math.sin(o.time * 7 + i * 2.4 + o.seed) * L * 0.3
      ctx.beginPath()
      ctx.arc(off, 0, W * 0.42, -0.9, 0.9)
      ctx.stroke()
    }
  } else if (o.work === 'tires' || o.work === 'engine' || o.work === 'body') {
    for (let i = 0; i < 3; i++) {
      const a = o.time * 9 + (i * Math.PI * 2) / 3
      const sx = Math.cos(a) * tw * 0.35
      const sy = Math.sin(a) * tw * 0.35
      ctx.strokeStyle = 'rgba(250,204,21,0.9)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(sx * 0.4, sy * 0.4)
      ctx.lineTo(sx, sy)
      ctx.stroke()
    }
  }
  ctx.restore()

  // ---- front / rear furniture (above clip) ----
  // grille + plate
  ctx.fillStyle = '#232a36'
  ctx.beginPath()
  ctx.roundRect(L * 0.44, -W * 0.2, L * 0.05, W * 0.4, 3)
  ctx.fill()
  ctx.fillStyle = '#e8edf3'
  ctx.fillRect(-L * 0.5, -W * 0.09, L * 0.045, W * 0.18)
  // headlights
  for (const yy of [-1, 1]) {
    const hy = yy * W * (0.5 * spec.nose + 0.06)
    ctx.fillStyle = '#fef9c3'
    ctx.beginPath()
    ctx.moveTo(L * 0.47, hy - yy * tw * 0.045)
    ctx.lineTo(L * 0.4, hy - yy * tw * 0.075)
    ctx.lineTo(L * 0.4, hy + yy * tw * 0.02)
    ctx.lineTo(L * 0.47, hy + yy * tw * 0.045)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(254,249,195,0.3)'
    ctx.beginPath()
    ctx.arc(L * 0.5, hy, tw * 0.09, 0, Math.PI * 2)
    ctx.fill()
  }
  // taillights
  ctx.fillStyle = '#dc2626'
  ctx.beginPath()
  ctx.roundRect(-L * 0.5, -W * 0.44, L * 0.03, W * 0.88, 3)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.65)'
  ctx.fillRect(-L * 0.5, -W * 0.06, L * 0.03, W * 0.12)
  // bumpers
  ctx.fillStyle = 'rgba(20,25,35,0.55)'
  ctx.beginPath()
  ctx.roundRect(L * 0.485, -W * 0.42, L * 0.028, W * 0.84, 4)
  ctx.fill()
  // mirrors
  ctx.fillStyle = shade(o.color, -40)
  const mx = cabC + cabL * 0.42
  ctx.beginPath()
  ctx.roundRect(mx - tw * 0.05, -W * 0.52, tw * 0.1, W * 0.06, 2)
  ctx.fill()
  ctx.beginPath()
  ctx.roundRect(mx - tw * 0.05, W * 0.46, tw * 0.1, W * 0.06, 2)
  ctx.fill()
  // antenna
  ctx.strokeStyle = 'rgba(20,25,35,0.7)'
  ctx.lineWidth = Math.max(1, tw * 0.02)
  ctx.beginPath()
  ctx.moveTo(cabC - cabL * 0.3, -W * 0.2)
  ctx.lineTo(cabC - cabL * 0.36, -W * 0.34)
  ctx.stroke()
}

function spark(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  if (r <= 0.5) return
  ctx.beginPath()
  ctx.moveTo(x - r * 2, y)
  ctx.lineTo(x + r * 2, y)
  ctx.moveTo(x, y - r * 2)
  ctx.lineTo(x, y + r * 2)
  ctx.lineWidth = Math.max(1, r * 0.5)
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.stroke()
}
