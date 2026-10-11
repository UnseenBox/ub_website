// True isometric vehicles: extruded prisms projected through the same
// camera the world uses, so cars have real volume and sit correctly on the
// floor at any heading. Local car space is x = forward, y = left, z = up,
// measured in TILES (never screen pixels).

import type { Conditions, ServiceKind } from './config'

/** local car coords + height -> screen point */
export type Proj = (lx: number, ly: number, z: number) => { x: number; y: number }

export interface CarSpec {
  /** length / width in tiles */
  len: number
  wid: number
  /** front + rear width factor (1 = slab, lower = tapered) */
  nose: number
  tail: number
  /** cabin center, 0 = rear … 1 = front; length as a fraction of len */
  cabinAt: number
  cabinLen: number
  cabinW: number
  /** belt line + roof height in tiles */
  bodyH: number
  roofH: number
  wheelR: number
  glassRoof?: boolean
  spoiler?: boolean
  rails?: boolean
  sunroof?: boolean
}

export const CAR_SPECS: Record<string, CarSpec> = {
  compact: { len: 2.0, wid: 1.0, nose: 0.82, tail: 0.86, cabinAt: 0.5, cabinLen: 0.44, cabinW: 0.8, bodyH: 0.2, roofH: 0.37, wheelR: 0.12 },
  sedan: { len: 2.4, wid: 1.06, nose: 0.78, tail: 0.84, cabinAt: 0.47, cabinLen: 0.4, cabinW: 0.78, bodyH: 0.21, roofH: 0.39, wheelR: 0.125, sunroof: true },
  hatch: { len: 2.15, wid: 1.02, nose: 0.82, tail: 0.92, cabinAt: 0.52, cabinLen: 0.46, cabinW: 0.8, bodyH: 0.22, roofH: 0.4, wheelR: 0.125 },
  suv: { len: 2.5, wid: 1.2, nose: 0.86, tail: 0.9, cabinAt: 0.5, cabinLen: 0.5, cabinW: 0.84, bodyH: 0.27, roofH: 0.5, wheelR: 0.15, rails: true, sunroof: true },
  van: { len: 2.8, wid: 1.2, nose: 0.9, tail: 0.95, cabinAt: 0.54, cabinLen: 0.62, cabinW: 0.88, bodyH: 0.28, roofH: 0.58, wheelR: 0.145 },
  sport: { len: 2.35, wid: 1.12, nose: 0.7, tail: 0.82, cabinAt: 0.42, cabinLen: 0.34, cabinW: 0.74, bodyH: 0.17, roofH: 0.32, wheelR: 0.13, glassRoof: true, spoiler: true },
}

export interface CarDrawOpts {
  color: string
  seed: number
  cond: Conditions
  work: ServiceKind | null
  time: number
  /** pixels per tile, for line widths only */
  tw: number
  /** world heading in radians */
  heading: number
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

/** Blends a paint colour toward mud as the car gets dirtier. */
function muddy(hex: string, k: number): string {
  const n = hex.replace('#', '')
  const v = n.length === 3 ? n.split('').map((c) => c + c).join('') : n
  const num = parseInt(v, 16)
  const mix = (c: number, m: number) => Math.round(c + (m - c) * k)
  const r = mix(num >> 16, 124)
  const g = mix((num >> 8) & 0xff, 101)
  const b = mix(num & 0xff, 72)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function rnd(seed: number, i: number): number {
  const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453
  return x - Math.floor(x)
}

type Pt = [number, number]

function hullPoly(s: CarSpec): Pt[] {
  const L = s.len
  const hm = s.wid / 2
  const hn = hm * s.nose
  const ht = hm * s.tail
  return [
    [L * 0.5, hn * 0.5],
    [L * 0.45, hn],
    [L * 0.18, hm],
    [-L * 0.2, hm],
    [-L * 0.45, ht],
    [-L * 0.5, ht * 0.5],
    [-L * 0.5, -ht * 0.5],
    [-L * 0.45, -ht],
    [-L * 0.2, -hm],
    [L * 0.18, -hm],
    [L * 0.45, -hn],
    [L * 0.5, -hn * 0.5],
  ]
}

function cabinPoly(s: CarSpec): Pt[] {
  const c = (s.cabinAt - 0.5) * s.len
  const l = s.cabinLen * s.len
  const w = (s.wid / 2) * s.cabinW
  return [
    [c + l * 0.5, w * 0.5],
    [c + l * 0.3, w],
    [c - l * 0.38, w],
    [c - l * 0.5, w * 0.55],
    [c - l * 0.5, -w * 0.55],
    [c - l * 0.38, -w],
    [c + l * 0.3, -w],
    [c + l * 0.5, -w * 0.5],
  ]
}

function path(ctx: CanvasRenderingContext2D, p: Proj, pts: Pt[], z: number): void {
  ctx.beginPath()
  for (let i = 0; i < pts.length; i++) {
    const q = p(pts[i][0], pts[i][1], z)
    if (i === 0) ctx.moveTo(q.x, q.y)
    else ctx.lineTo(q.x, q.y)
  }
  ctx.closePath()
}

function quad(ctx: CanvasRenderingContext2D, p: Proj, c: [number, number, number][], fill: string): void {
  ctx.beginPath()
  for (let i = 0; i < c.length; i++) {
    const q = p(c[i][0], c[i][1], c[i][2])
    if (i === 0) ctx.moveTo(q.x, q.y)
    else ctx.lineTo(q.x, q.y)
  }
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}

/** Is a local-space outward normal facing the camera (+x+y in world)? */
function facing(nx: number, ny: number, cos: number, sin: number): number {
  const wnx = nx * cos - ny * sin
  const wny = nx * sin + ny * cos
  return wnx + wny
}

/** Diffuse term for a local normal, light coming from the north-west. */
function lum(nx: number, ny: number, cos: number, sin: number): number {
  const wnx = nx * cos - ny * sin
  const wny = nx * sin + ny * cos
  const l = Math.hypot(wnx, wny) || 1
  return (wnx / l) * -0.3 + (wny / l) * -0.92
}

/** Extrudes a closed polygon between two heights, culling back faces. */
function prism(
  ctx: CanvasRenderingContext2D, p: Proj, pts: Pt[], z0: number, z1: number,
  side: string, top: string, cos: number, sin: number,
): void {
  let cx = 0
  let cy = 0
  for (const [x, y] of pts) {
    cx += x / pts.length
    cy += y / pts.length
  }
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    let nx = b[1] - a[1]
    let ny = -(b[0] - a[0])
    if (nx * ((a[0] + b[0]) / 2 - cx) + ny * ((a[1] + b[1]) / 2 - cy) < 0) {
      nx = -nx
      ny = -ny
    }
    if (facing(nx, ny, cos, sin) <= 0) continue
    quad(ctx, p, [
      [a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1],
    ], shade(side, Math.round(-8 + 26 * lum(nx, ny, cos, sin))))
  }
  path(ctx, p, pts, z1)
  ctx.fillStyle = top
  ctx.fill()
}

export function drawVehicle(ctx: CanvasRenderingContext2D, p: Proj, spec: CarSpec, o: CarDrawOpts): void {
  const cos = Math.cos(o.heading)
  const sin = Math.sin(o.heading)
  const dirt = 1 - o.cond.clean / 100
  const paint = muddy(o.color, dirt * 0.5)
  const glass = dirt > 0.6 ? '#8d8068' : '#bcdcee'
  const L = spec.len
  const hm = spec.wid / 2
  const hull = hullPoly(spec)
  const cabin = cabinPoly(spec)
  const bodyZ0 = spec.wheelR * 0.55
  const r = spec.wheelR

  // ---- wheels: capsules drawn along the car's forward axis ----
  const axleF = L * 0.3
  const axleR = -L * 0.31
  const trackY = hm - r * 0.35
  const flatIdx = o.cond.tires < 55 ? Math.floor(rnd(o.seed, 9) * 4) : -1
  const wheels: Pt[] = [[axleF, trackY], [axleF, -trackY], [axleR, trackY], [axleR, -trackY]]
  const drawWheel = (i: number) => {
    const [wx, wy] = wheels[i]
    const squash = i === flatIdx ? 0.55 : 1
    const zc = r * squash
    const a = p(wx - r * 0.95, wy, zc)
    const b = p(wx + r * 0.95, wy, zc)
    // contact patch
    const g = p(wx, wy, 0)
    ctx.fillStyle = 'rgba(18,22,30,0.5)'
    ctx.beginPath()
    ctx.ellipse(g.x, g.y, o.tw * r * 1.1, o.tw * r * 0.45, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1b1f28'
    ctx.lineWidth = o.tw * r * 1.5 * squash
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    // hub
    ctx.strokeStyle = '#b9c1cc'
    ctx.lineWidth = o.tw * r * 0.6 * squash
    const ha = p(wx - r * 0.3, wy, zc)
    const hb = p(wx + r * 0.3, wy, zc)
    ctx.beginPath()
    ctx.moveTo(ha.x, ha.y)
    ctx.lineTo(hb.x, hb.y)
    ctx.stroke()
  }
  // far wheels first, near wheels after the body
  const depth = (w: Pt) => (w[0] * cos - w[1] * sin) + (w[0] * sin + w[1] * cos)
  const order = [0, 1, 2, 3].sort((i, j) => depth(wheels[i]) - depth(wheels[j]))
  const near: number[] = []
  for (const i of order) {
    if (depth(wheels[i]) < 0) drawWheel(i)
    else near.push(i)
  }

  // ---- body + cabin ----
  prism(ctx, p, hull, bodyZ0, spec.bodyH, paint, shade(paint, 16), cos, sin)
  const roofTop = spec.glassRoof ? shade(glass, -6) : shade(paint, 10)
  prism(ctx, p, cabin, spec.bodyH - 0.004, spec.roofH, glass, roofTop, cos, sin)

  // roof outline reads as the glasshouse edge for one stroke instead of a
  // per-pillar loop (cheaper, and pillars were sub-pixel at this zoom)
  path(ctx, p, cabin, spec.roofH)
  ctx.strokeStyle = shade(paint, -26)
  ctx.lineWidth = Math.max(1.2, o.tw * 0.035)
  ctx.stroke()

  for (const i of near) drawWheel(i)

  // ---- roof details on the top face ----
  ctx.save()
  path(ctx, p, hull, spec.bodyH)
  ctx.clip()
  // hood + boot shut lines
  ctx.strokeStyle = 'rgba(16,22,32,0.3)'
  ctx.lineWidth = Math.max(1, o.tw * 0.022)
  for (const lx of [(spec.cabinAt - 0.5) * L + spec.cabinLen * L * 0.5, (spec.cabinAt - 0.5) * L - spec.cabinLen * L * 0.5]) {
    const a = p(lx, hm, spec.bodyH)
    const b = p(lx, -hm, spec.bodyH)
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
  // clear-coat sheen on fresh paint
  if (o.cond.shine > 80 && dirt < 0.4) {
    quad(ctx, p, [
      [L * 0.42, hm * 0.1, spec.bodyH], [L * 0.44, -hm * 0.55, spec.bodyH],
      [-L * 0.5, -hm * 0.1, spec.bodyH], [-L * 0.5, hm * 0.5, spec.bodyH],
    ], 'rgba(255,255,255,0.18)')
  }
  // mud film and splatter
  if (dirt > 0.05) {
    for (let i = 0; i < 5; i++) {
      const bx = (rnd(o.seed, 40 + i) - 0.5) * L * 0.9
      const by = (rnd(o.seed, 60 + i) - 0.5) * spec.wid * 0.9
      const q = p(bx, by, spec.bodyH)
      ctx.fillStyle = `rgba(86,62,34,${0.2 + 0.4 * dirt * rnd(o.seed, 80 + i)})`
      ctx.beginPath()
      ctx.ellipse(q.x, q.y, o.tw * (0.05 + 0.08 * rnd(o.seed, 100 + i)), o.tw * (0.03 + 0.04 * rnd(o.seed, 110 + i)), 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // dents
  const dents = o.cond.body < 55 ? 2 : o.cond.body < 92 ? 1 : 0
  for (let i = 0; i < dents; i++) {
    const dx = (rnd(o.seed, 200 + i) - 0.5) * L * 0.6
    const dy = (rnd(o.seed, 220 + i) - 0.5) * spec.wid * 0.55
    const q = p(dx, dy, spec.bodyH)
    const rr = o.tw * (0.07 + 0.05 * rnd(o.seed, 240 + i))
    ctx.fillStyle = 'rgba(38,26,16,0.5)'
    ctx.beginPath()
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2
      const rad = rr * (0.65 + 0.55 * rnd(o.seed, 260 + i * 7 + k))
      const px = q.x + Math.cos(a) * rad
      const py = q.y + Math.sin(a) * rad * 0.55
      if (k === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(q.x - rr * 0.5, q.y + rr * 0.2)
    ctx.lineTo(q.x + rr * 0.5, q.y - rr * 0.25)
    ctx.stroke()
  }
  ctx.restore()

  // ---- lamps, grille, mirrors (sit just proud of the shell) ----
  const hn = hm * spec.nose
  const ht = hm * spec.tail
  const lampZ0 = spec.bodyH * 0.45
  const lampZ1 = spec.bodyH * 0.82
  for (const sgn of [1, -1]) {
    quad(ctx, p, [
      [L * 0.503, sgn * hn * 0.86, lampZ0], [L * 0.503, sgn * hn * 0.3, lampZ0],
      [L * 0.503, sgn * hn * 0.3, lampZ1], [L * 0.503, sgn * hn * 0.86, lampZ1],
    ], '#fff6c8')
    quad(ctx, p, [
      [-L * 0.503, sgn * ht * 0.88, lampZ0], [-L * 0.503, sgn * ht * 0.32, lampZ0],
      [-L * 0.503, sgn * ht * 0.32, lampZ1], [-L * 0.503, sgn * ht * 0.88, lampZ1],
    ], '#d92b2b')
  }
  // grille + plate
  quad(ctx, p, [
    [L * 0.502, hn * 0.26, lampZ0 * 0.75], [L * 0.502, -hn * 0.26, lampZ0 * 0.75],
    [L * 0.502, -hn * 0.26, lampZ1 * 0.78], [L * 0.502, hn * 0.26, lampZ1 * 0.78],
  ], '#262c38')
  quad(ctx, p, [
    [-L * 0.502, ht * 0.22, bodyZ0 + 0.015], [-L * 0.502, -ht * 0.22, bodyZ0 + 0.015],
    [-L * 0.502, -ht * 0.22, bodyZ0 + 0.075], [-L * 0.502, ht * 0.22, bodyZ0 + 0.075],
  ], '#e9eef4')
  // bumpers
  for (const [x, w] of [[L * 0.497, hn], [-L * 0.497, ht]] as const) {
    quad(ctx, p, [
      [x, w * 0.95, bodyZ0], [x, -w * 0.95, bodyZ0],
      [x, -w * 0.95, bodyZ0 + 0.045], [x, w * 0.95, bodyZ0 + 0.045],
    ], 'rgba(22,27,38,0.55)')
  }
  // mirrors on the cabin shoulders
  const mX = (spec.cabinAt - 0.5) * L + spec.cabinLen * L * 0.42
  for (const sgn of [1, -1]) {
    quad(ctx, p, [
      [mX - 0.05, sgn * (hm * spec.cabinW + 0.02), spec.bodyH + 0.02],
      [mX + 0.05, sgn * (hm * spec.cabinW + 0.02), spec.bodyH + 0.02],
      [mX + 0.05, sgn * (hm + 0.06), spec.bodyH + 0.02],
      [mX - 0.05, sgn * (hm + 0.06), spec.bodyH + 0.02],
    ], shade(paint, -26))
  }
  // windscreen glint
  const wsX = (spec.cabinAt - 0.5) * L + spec.cabinLen * L * 0.45
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'
  ctx.lineWidth = Math.max(1.2, o.tw * 0.03)
  {
    const a = p(wsX, hm * spec.cabinW * 0.5, spec.bodyH + 0.03)
    const b = p(wsX, -hm * spec.cabinW * 0.15, spec.roofH - 0.02)
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }

  // ---- type-specific furniture ----
  if (spec.rails) {
    ctx.strokeStyle = shade(paint, -34)
    ctx.lineWidth = Math.max(1.5, o.tw * 0.04)
    const c = (spec.cabinAt - 0.5) * L
    for (const sgn of [1, -1]) {
      const a = p(c - spec.cabinLen * L * 0.34, sgn * hm * spec.cabinW * 0.68, spec.roofH + 0.025)
      const b = p(c + spec.cabinLen * L * 0.26, sgn * hm * spec.cabinW * 0.68, spec.roofH + 0.025)
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
  }
  if (spec.sunroof && !spec.glassRoof) {
    const c = (spec.cabinAt - 0.5) * L
    quad(ctx, p, [
      [c + spec.cabinLen * L * 0.16, hm * spec.cabinW * 0.5, spec.roofH + 0.003],
      [c + spec.cabinLen * L * 0.16, -hm * spec.cabinW * 0.5, spec.roofH + 0.003],
      [c - spec.cabinLen * L * 0.2, -hm * spec.cabinW * 0.5, spec.roofH + 0.003],
      [c - spec.cabinLen * L * 0.2, hm * spec.cabinW * 0.5, spec.roofH + 0.003],
    ], 'rgba(60,78,96,0.75)')
  }
  if (spec.spoiler) {
    const sx = -L * 0.44
    prism(ctx, p, [
      [sx + 0.07, ht * 0.9], [sx - 0.07, ht * 0.9],
      [sx - 0.07, -ht * 0.9], [sx + 0.07, -ht * 0.9],
    ], spec.bodyH, spec.bodyH + 0.1, shade(paint, -20), shade(paint, -4), cos, sin)
  }

  // ---- live job effects ----
  if (o.work) {
    ctx.save()
    path(ctx, p, hull, spec.bodyH)
    ctx.clip()
    if (o.work === 'wash' || o.work === 'detail' || o.work === 'paint') {
      for (let i = 0; i < 6; i++) {
        const bx = (rnd(o.seed, 300 + i) - 0.5) * L * 0.9
        const by = (rnd(o.seed, 320 + i) - 0.5) * spec.wid * 0.9
        const q = p(bx, by, spec.bodyH)
        ctx.fillStyle = o.work === 'paint' ? 'rgba(244,114,182,0.55)' : 'rgba(255,255,255,0.8)'
        ctx.beginPath()
        ctx.arc(q.x, q.y, o.tw * (0.03 + 0.045 * rnd(o.seed, 340 + i)), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'
      ctx.lineWidth = Math.max(2, o.tw * 0.05)
      const sweep = Math.sin(o.time * 7 + o.seed) * L * 0.3
      const c0 = p(sweep, hm * 0.7, spec.bodyH)
      const c1 = p(sweep + 0.2, -hm * 0.7, spec.bodyH)
      ctx.beginPath()
      ctx.moveTo(c0.x, c0.y)
      ctx.quadraticCurveTo((c0.x + c1.x) / 2 + 6, (c0.y + c1.y) / 2, c1.x, c1.y)
      ctx.stroke()
    }
    ctx.restore()
    if (o.work === 'tires' || o.work === 'engine' || o.work === 'body') {
      const at = o.work === 'tires' ? p(axleF, trackY, r) : p(L * 0.34, 0, spec.bodyH)
      for (let i = 0; i < 3; i++) {
        const a = o.time * 9 + (i * Math.PI * 2) / 3
        ctx.strokeStyle = 'rgba(250,204,21,0.95)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(at.x + Math.cos(a) * o.tw * 0.12, at.y + Math.sin(a) * o.tw * 0.07)
        ctx.lineTo(at.x + Math.cos(a) * o.tw * 0.3, at.y + Math.sin(a) * o.tw * 0.17)
        ctx.stroke()
      }
    }
  }

  // sparkle on a showroom-fresh car
  if (o.cond.shine > 90 && dirt < 0.2) {
    const tw2 = 0.55 + 0.45 * Math.sin(o.time * 4 + o.seed)
    const q = p(L * 0.3, -hm * 0.5, spec.bodyH)
    ctx.strokeStyle = `rgba(255,255,255,${0.85 * tw2})`
    ctx.lineWidth = 2
    const s = o.tw * 0.1 * tw2
    ctx.beginPath()
    ctx.moveTo(q.x - s, q.y)
    ctx.lineTo(q.x + s, q.y)
    ctx.moveTo(q.x, q.y - s)
    ctx.lineTo(q.x, q.y + s)
    ctx.stroke()
  }
}
