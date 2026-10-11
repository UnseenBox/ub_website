// Real-time 3D renderer (three.js): isometric ortho camera, sun + shadows,
// CanvasTexture ground (all decals baked once per unlock-state), open-source
// Kenney models for cars/characters, DOM overlay for labels/bars.
//
// Public API mirrors the old software renderer, so sim / UI / main are
// untouched: constructor(canvas), resize(), render(game, time, dt),
// burst(x, y), sx/sy projectors, particles[].

import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { PAINTS, SKINS, makeCarRig, makeCharRig, type CarRig, type CharRig } from './models'
import { STATIONS, UNLOCKS, carValue, offerPrice, type StationId } from './config'
import type { Car, Game } from './sim'
import {
  DECOR,
  ENTRANCE,
  GARAGE_BUILDING,
  HIRE_BOARD,
  MAP_H,
  MAP_W,
  PARKING_BASE,
  PARKING_EXTRA,
  POND,
  STATION_RECTS,
} from './world'

export function shade(hex: string, amt: number): string {
  const n = hex.replace('#', '')
  const v = n.length === 3 ? n.split('').map((c) => c + c).join('') : n
  const num = parseInt(v, 16)
  const r = Math.max(0, Math.min(255, (num >> 16) + amt))
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt))
  const b = Math.max(0, Math.min(255, (num & 0xff) + amt))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

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
}

const WORKER_SKIN: Record<string, string> = {
  washer: 'washer',
  mechanic: 'mechanic',
  detailer: 'detailer',
  seller: 'seller',
}

const SERVICE_ICON: Record<string, string> = {
  wash: '🧽', tires: '🛞', engine: '🔧', body: '🔨', detail: '✨', paint: '🎨',
}

// ---------- tiny builders ----------

function mat(color: string, rough = 0.9): THREE.MeshStandardMaterial {
  const key = `${color}|${rough}`
  let m = matCache.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 })
    matCache.set(key, m)
  }
  return m
}
const matCache = new Map<string, THREE.MeshStandardMaterial>()

function emojiTex(emoji: string, bg: string | null, size = 128): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')
  if (g) {
    if (bg) {
      g.fillStyle = bg
      g.beginPath()
      g.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2)
      g.fill()
    }
    g.font = `${Math.round(size * 0.62)}px system-ui`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(emoji, size / 2, size / 2 + size * 0.03)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export class Renderer {
  canvas: HTMLCanvasElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.OrthographicCamera
  private cam = { x: 12.5, y: 10 }
  private vw = 1
  private vh = 1
  private halfH = 10
  private sun: THREE.DirectionalLight
  private groundMesh: THREE.Mesh | null = null
  private groundKey = ''
  private stationGroups = new Map<StationId, THREE.Group>()
  private builtProps: THREE.Group | null = null
  private cars = new Map<number, { rig: CarRig; paintSeen: number; flatSeen: number; lastX: number; lastZ: number }>()
  private paintByCar = new Map<number, number>()
  private playerRig: CharRig | null = null
  private playerTool: THREE.Mesh | null = null
  private workerRigs = new Map<string, { rig: CharRig; tool: THREE.Mesh | null; root: THREE.Group }>()
  private playerRing: THREE.Mesh
  private guideArrow: THREE.Mesh
  private guideRing: THREE.Mesh
  private bursts: { mesh: THREE.Mesh; t: number }[] = []
  particles: Particle[] = []
  private points: THREE.Points
  private pointGeo = new THREE.BufferGeometry()
  private labelLayer: HTMLElement
  private labels: HTMLElement[] = []
  private projV = new THREE.Vector3()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.3

    this.scene.background = new THREE.Color('#79c25f')
    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x6a8f5f, 1.05)
    this.scene.add(hemi)
    this.sun = new THREE.DirectionalLight(0xfff1d6, 1.75)
    this.sun.position.set(20 - 14, 26, 15 + 8)
    this.sun.target.position.set(20, 0, 15)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(1024, 1024)
    this.sun.shadow.camera.left = -26
    this.sun.shadow.camera.right = 26
    this.sun.shadow.camera.top = 26
    this.sun.shadow.camera.bottom = -26
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 70
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.02
    this.scene.add(this.sun)
    this.scene.add(this.sun.target)

    const aspect = 16 / 10
    this.camera = new THREE.OrthographicCamera(
      -this.halfH * aspect, this.halfH * aspect, this.halfH, -this.halfH, 0.1, 200,
    )
    this.camera.position.set(this.cam.x + 20, 17, this.cam.y + 20)
    this.camera.lookAt(this.cam.x, 0, this.cam.y)

    // guide arrow + ring
    this.guideArrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, 0.55, 4),
      new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.5 }),
    )
    this.guideArrow.rotation.x = Math.PI
    this.guideArrow.visible = false
    this.scene.add(this.guideArrow)
    this.guideRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.7, 0.05, 8, 40),
      new THREE.MeshBasicMaterial({ color: '#facc15', transparent: true, opacity: 0.9 }),
    )
    this.guideRing.rotation.x = -Math.PI / 2
    this.guideRing.visible = false
    this.scene.add(this.guideRing)

    // player tracking ring
    this.playerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.045, 8, 32),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 }),
    )
    this.playerRing.rotation.x = -Math.PI / 2
    this.scene.add(this.playerRing)

    // particle points
    const MAX = 420
    const pos = new Float32Array(MAX * 3)
    const col = new Float32Array(MAX * 3)
    this.pointGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.pointGeo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    this.points = new THREE.Points(
      this.pointGeo,
      new THREE.PointsMaterial({ size: 0.13, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }),
    )
    this.points.frustumCulled = false
    this.scene.add(this.points)

    // DOM label layer + vignette live with the canvas (#app is already fixed)
    const host = canvas.parentElement ?? document.body
    this.labelLayer = document.createElement('div')
    this.labelLayer.className = 'wl-layer'
    host.appendChild(this.labelLayer)
    const vig = document.createElement('div')
    vig.className = 'wl-vignette'
    host.appendChild(vig)

    this.buildStatic()
  }

  // ---------- public API ----------

  resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = this.canvas.clientWidth || window.innerWidth
    const h = this.canvas.clientHeight || window.innerHeight
    this.vw = w
    this.vh = h
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(w, h, false)
    const aspect = w / h
    this.camera.left = -this.halfH * aspect
    this.camera.right = this.halfH * aspect
    this.camera.top = this.halfH
    this.camera.bottom = -this.halfH
    this.camera.updateProjectionMatrix()
  }

  get w(): number {
    return this.vw
  }
  get h(): number {
    return this.vh
  }

  sx(x: number, y: number): number {
    this.projV.set(x, 0, y).project(this.camera)
    return (this.projV.x * 0.5 + 0.5) * this.vw
  }
  sy(x: number, y: number, z = 0): number {
    this.projV.set(x, z, y).project(this.camera)
    return (-this.projV.y * 0.5 + 0.5) * this.vh
  }

  burst(x: number, y: number): void {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.4, 0.07, 8, 32),
      new THREE.MeshBasicMaterial({ color: '#facc15', transparent: true, opacity: 1 }),
    )
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(x, 0.15, y)
    this.scene.add(mesh)
    this.bursts.push({ mesh, t: 0 })
    const cols = ['#facc15', '#4ade80', '#38bdf8', '#f472b6']
    for (let i = 0; i < 22; i++) {
      if (this.particles.length > 400) return
      const a = Math.random() * Math.PI * 2
      this.particles.push({
        x, y, z: 0.5,
        vx: Math.cos(a) * (1 + Math.random() * 2.5),
        vy: Math.sin(a) * (1 + Math.random() * 2.5),
        vz: 2 + Math.random() * 3,
        life: 0, max: 0.7 + Math.random() * 0.5,
        color: cols[i % 4],
      })
    }
  }

  get drawCalls(): number {
    return this.renderer.info.render.calls
  }

  render(game: Game, time: number, dt: number): void {
    // camera follow with slight look-ahead; translation only
    const look = 0.22
    const tx = game.player.x + game.player.vx * look
    const ty = game.player.y - 1.2 + game.player.vy * look
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 4)
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 4)
    this.camera.position.set(this.cam.x + 20, 17, this.cam.y + 20)
    this.camera.lookAt(this.cam.x, 0, this.cam.y)

    this.syncGround(game)
    this.syncStations(game, time)
    this.syncCars(game, time, dt)
    this.syncActors(game, time, dt)
    this.syncGuide(game, time)
    this.updateParticles(dt)
    this.updateBursts(dt)
    this.updateLabels(game)
    this.renderer.render(this.scene, this.camera)
  }

  // ---------- ground ----------

  private groundSig(game: Game): string {
    return game.save.unlocks.join(',')
  }

  private syncGround(game: Game): void {
    const sig = this.groundSig(game)
    if (this.groundMesh && sig === this.groundKey) return
    this.groundKey = sig
    if (this.groundMesh) {
      this.scene.remove(this.groundMesh)
      this.groundMesh.geometry.dispose()
      ;(this.groundMesh.material as THREE.Material).dispose()
    }
    const S = 52
    const c = document.createElement('canvas')
    c.width = MAP_W * S
    c.height = MAP_H * S
    paintGround(c, game)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy())
    this.groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_W, MAP_H),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }),
    )
    this.groundMesh.rotation.x = -Math.PI / 2
    this.groundMesh.position.set(MAP_W / 2, 0, MAP_H / 2)
    this.groundMesh.receiveShadow = true
    this.scene.add(this.groundMesh)
  }

  // ---------- static world ----------

  private bx(
    parent: THREE.Group, w: number, h: number, d: number, color: string,
    cx: number, yBase: number, cz: number, rough = 0.9,
  ): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, rough))
    m.position.set(cx, yBase + h / 2, cz)
    m.castShadow = true
    m.receiveShadow = true
    parent.add(m)
    return m
  }

  private cyl(
    parent: THREE.Group, rt: number, rb: number, h: number, color: string,
    cx: number, yBase: number, cz: number, seg = 12,
  ): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color))
    m.position.set(cx, yBase + h / 2, cz)
    m.castShadow = true
    m.receiveShadow = true
    parent.add(m)
    return m
  }

  private plaque(parent: THREE.Group, emoji: string, cx: number, y: number, cz: number, s = 0.62, bg: string | null = 'rgba(15,23,42,0.92)'): void {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(s, s),
      new THREE.MeshBasicMaterial({ map: emojiTex(emoji, bg), transparent: true }),
    )
    m.position.set(cx, y, cz)
    // face the iso camera
    m.rotation.y = Math.PI / 4
    parent.add(m)
  }

  private buildStatic(): void {
    const root = new THREE.Group()
    this.scene.add(root)
    this.buildGarage(root)
    this.buildArch(root)
    this.buildHireBoard(root)
    if (!this.builtProps) this.builtProps = new THREE.Group()
    this.scene.add(this.builtProps)
    // stations get their own groups (build-in animation + unlock gating)
    for (const id of Object.keys(STATION_RECTS) as StationId[]) {
      const g = new THREE.Group()
      this.stationGroups.set(id, g)
      this.scene.add(g)
    }
    this.buildDecor(root)
    this.mergeStatic(root)
  }

  private buildGarage(root: THREE.Group): void {
    const b = GARAGE_BUILDING
    const g = new THREE.Group()
    root.add(g)
    this.bx(g, b.w, 0.14, b.h, '#cfc7b6', b.x + b.w / 2, 0, b.y + b.h / 2)
    this.bx(g, b.w, 1.5, 0.5, '#e9e4d8', b.x + b.w / 2, 0, b.y + 0.25)
    // roller door + slats
    const dw = 2.6
    const dx = b.x + (b.w - dw) / 2
    this.bx(g, dw, 1.32, 0.34, '#8b98a9', dx + dw / 2, 0, b.y + 0.23)
    for (let i = 1; i < 6; i++) {
      this.bx(g, dw - 0.1, 0.035, 0.02, '#4a5568', dx + dw / 2, i * 0.21, b.y + 0.4)
    }
    // side wall + window
    this.bx(g, 0.5, 1.3, b.h, '#f4f1ea', b.x + 0.25, 0, b.y + b.h / 2)
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.6),
      new THREE.MeshStandardMaterial({ color: '#bae3f5', roughness: 0.15, metalness: 0.3 }),
    )
    win.position.set(b.x + 0.51, 0.75, b.y + 1.75)
    win.rotation.y = Math.PI / 2
    g.add(win)
    // teal counter + interior dressing
    this.bx(g, b.w, 0.9, 0.5, '#0d9488', b.x + b.w / 2, 0, b.y + b.h - 0.25)
    this.bx(g, 1.5, 0.55, 0.6, '#a16207', b.x + 1.55, 0, b.y + 1.4)
    this.bx(g, 0.9, 1.1, 0.6, '#475569', b.x + 4.05, 0, b.y + 1.4)
    this.bx(g, 0.7, 0.5, 0.5, '#b45309', b.x + 6.9, 0, b.y + 5.65)
    // sign posts + panel + wrench plaque
    this.bx(g, 0.28, 1.5, 0.28, '#075985', b.x + 1.34, 0, b.y + 0.64)
    this.bx(g, 0.28, 1.5, 0.28, '#075985', b.x + 4.64, 0, b.y + 0.64)
    this.bx(g, 4.2, 0.62, 0.55, '#0e7490', b.x + 3, 1.5, b.y + 0.62)
    this.plaque(g, '🔧', b.x + 3, 2.05, b.y + 0.95, 0.55)
  }

  private buildArch(root: THREE.Group): void {
    const g = new THREE.Group()
    root.add(g)
    for (const px of [ENTRANCE.x - 2.3, ENTRANCE.x + 2]) {
      this.bx(g, 0.5, 2.1, 0.5, '#b45309', px + 0.25, 0, 20.45)
      this.bx(g, 0.6, 0.14, 0.6, '#e8e2d4', px + 0.25, 2.1, 20.45)
      for (let i = 1; i < 5; i++) {
        this.bx(g, 0.52, 0.05, 0.52, '#7c3f0c', px + 0.25, i * 0.42, 20.45)
      }
    }
    this.bx(g, 5.1, 0.22, 0.22, '#334155', ENTRANCE.x + 0.1, 2.1, 20.45)
    this.plaque(g, '⭐', ENTRANCE.x + 0.1, 1.55, 20.45, 0.6)
  }

  private buildHireBoard(root: THREE.Group): void {
    const g = new THREE.Group()
    root.add(g)
    const { x, y } = HIRE_BOARD
    this.bx(g, 0.22, 1.15, 0.3, '#57370c', x - 0.34, 0, y - 0.05)
    this.bx(g, 0.22, 1.15, 0.3, '#57370c', x + 0.46, 0, y - 0.05)
    this.bx(g, 1.5, 0.85, 0.3, '#8a5a2b', x + 0.05, 0.55, y - 0.05)
    const notes: [string, number, number][] = [
      ['#fef9c3', -0.3, 0.95], ['#bfdbfe', 0.15, 0.9], ['#fecaca', 0.5, 0.98],
    ]
    for (const [c, ox, oy] of notes) {
      const n = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.3), mat(c, 1))
      n.position.set(x + 0.05 + ox, oy, y + 0.11)
      n.rotation.y = Math.PI / 4
      g.add(n)
    }
    this.plaque(g, '🧑‍🔧', x + 0.05, 1.75, y - 0.05, 0.5, 'rgba(30,58,138,0.92)')
  }

  private buildDecor(root: THREE.Group): void {
    for (const p of DECOR) {
      const g = new THREE.Group()
      g.position.set(p.x, 0, p.y)
      root.add(g)
      if (p.kind === 'lamp') {
        this.bx(g, 0.18, 1.9, 0.18, '#3f4756', 0, 0, 0)
        this.bx(g, 0.6, 0.22, 0.3, '#232a36', 0, 1.9, 0)
        const lamp = new THREE.Mesh(
          new THREE.PlaneGeometry(0.4, 0.14),
          new THREE.MeshBasicMaterial({ color: '#fef9c3' }),
        )
        lamp.position.set(0, 1.86, 0)
        lamp.rotation.y = Math.PI / 4
        g.add(lamp)
      } else if (p.kind === 'cone') {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.19 * p.s, 0.42 * p.s, 12), mat('#f97316'))
        c.position.y = 0.21 * p.s + 0.04
        c.castShadow = true
        g.add(c)
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * p.s, 0.15 * p.s, 0.08, 12), mat('#ffffff'))
        band.position.y = 0.2 * p.s
        g.add(band)
        this.bx(g, 0.4, 0.06, 0.24, '#c2410c', 0, 0, 0)
      } else if (p.kind === 'crate') {
        this.bx(g, 0.64, 0.52, 0.64, '#c99a5b', 0, 0, 0)
        this.bx(g, 0.64, 0.53, 0.2, '#8a5a2b', 0, 0, 0)
      } else if (p.kind === 'bench') {
        this.bx(g, 1.5, 0.28, 0.56, '#8a5a2b', 0, 0.28, 0)
        this.bx(g, 0.2, 0.28, 0.2, '#57370c', -0.55, 0, 0)
        this.bx(g, 0.2, 0.28, 0.2, '#57370c', 0.55, 0, 0)
      } else if (p.kind === 'bush' || p.kind === 'plant') {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24 * p.s, 1), mat(p.kind === 'bush' ? '#1d8a44' : '#16a34a', 1))
        b.position.y = 0.24 * p.s
        b.castShadow = true
        g.add(b)
        const b2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 * p.s, 1), mat('#35b862', 1))
        b2.position.set(0.14 * p.s, 0.36 * p.s, 0.06)
        b2.castShadow = true
        g.add(b2)
        if (p.kind === 'plant') this.bx(g, 0.32, 0.3, 0.32, '#b45309', 0, 0, 0)
      } else if (p.kind === 'house') {
        this.bx(g, 2.0, 1.0, 1.8, '#e7dcc8', 0, 0, 0)
        const roof = new THREE.Mesh(new THREE.ConeGeometry(1.75, 0.85, 4), mat('#b45309'))
        roof.position.y = 1.0 + 0.42
        roof.rotation.y = Math.PI / 4
        roof.castShadow = true
        g.add(roof)
        this.bx(g, 0.34, 0.62, 0.06, '#6b3f16', -0.35, 0, 0.93)
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.36), new THREE.MeshBasicMaterial({ color: '#fde68a' }))
        win.position.set(1.01, 0.62, 0)
        win.rotation.y = Math.PI / 2
        g.add(win)
        this.bx(g, 0.28, 0.9, 0.28, '#9a6a4a', 0.5, 1.0, -0.45)
      }
    }
  }

  // ---------- stations ----------

  private lockRings = new Map<StationId, THREE.LineLoop>()

  private lockRing(id: StationId): THREE.LineLoop {
    let ring = this.lockRings.get(id)
    if (!ring) {
      const r = STATION_RECTS[id]
      const pts: THREE.Vector3[] = []
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2
        pts.push(new THREE.Vector3(r.cx + Math.cos(a) * 1.9, 0.04, r.cy + Math.sin(a) * 1.0))
      }
      ring = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineDashedMaterial({ color: '#a8a29e', dashSize: 0.3, gapSize: 0.2, transparent: true, opacity: 0.9 }),
      )
      ring.computeLineDistances()
      this.lockRings.set(id, ring)
      this.scene.add(ring)
    }
    return ring
  }

  /** Fuses static opaque meshes per material: fewer draw calls, same pixels. */
  private mergeStatic(root: THREE.Group): void {
    root.updateWorldMatrix(true, true)
    const meshes: THREE.Mesh[] = []
    root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh && !mesh.userData.keep) meshes.push(mesh)
    })
    const buckets = new Map<string, { mat: THREE.Material; items: THREE.Mesh[] }>()
    for (const mesh of meshes) {
      const m = mesh.material as THREE.Material
      const std = m as THREE.MeshStandardMaterial
      if (m.transparent || std.map) continue
      const key = m.uuid
      let bucket = buckets.get(key)
      if (!bucket) {
        bucket = { mat: m, items: [] }
        buckets.set(key, bucket)
      }
      bucket.items.push(mesh)
    }
    for (const { mat: m, items } of buckets.values()) {
      if (items.length < 2) continue
      const geos = items.map((mesh) => (mesh.geometry as THREE.BufferGeometry).clone().applyMatrix4(mesh.matrixWorld))
      const merged = mergeGeometries(geos, false)
      geos.forEach((g) => g.dispose())
      if (!merged) continue
      for (const mesh of items) {
        mesh.parent?.remove(mesh)
      }
      const out = new THREE.Mesh(merged, m)
      out.castShadow = true
      out.receiveShadow = true
      root.add(out)
    }
  }

  private syncStations(game: Game, time: number): void {
    // equipment groups appear on purchase (animated); locked bays show rings only
    for (const id of Object.keys(STATION_RECTS) as StationId[]) {
      const g = this.stationGroups.get(id)
      if (!g) continue
      const st = STATIONS[id]
      const unlocked = this.stationUnlocked(game, id)
      const want = unlocked ? 1 : 0
      const has = g.children.length > 0 ? 1 : 0
      if (want !== has) {
        g.clear()
        if (want) {
          this.buildStation(g, id, game, time)
          this.mergeStatic(g)
        }
      }
      if (want && unlocked) {
        const t = (game.time - (game.builtAt[st.unlock ?? ''] ?? -99)) / 0.6
        const s = t >= 1 ? 1 : Math.max(0.01, easeOutBack(Math.max(0, t)))
        g.scale.setScalar(s)
      }
      this.lockRing(id).visible = !unlocked
      this.syncStationFx(game, id, time)
    }
    this.syncBuiltProps(game, time)
  }

  private stationUnlocked(game: Game, id: StationId): boolean {
    return game.stationUnlocked(id)
  }

  private buildStation(g: THREE.Group, id: StationId, game: Game, time: number): void {
    void game
    void time
    const r = STATION_RECTS[id]
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.85, 2.15, 40),
      new THREE.MeshBasicMaterial({ color: STATIONS[id].color, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.set(r.cx - r.x, 0.02, r.cy - r.y)
    const wrap = new THREE.Group()
    wrap.position.set(r.x, 0, r.y)
    wrap.add(ring)
    g.add(wrap)

    const B = (w: number, h: number, d: number, c: string, cx: number, yb: number, cz: number, rough = 0.9) =>
      this.bx(g, w, h, d, c, r.x + cx, yb, r.y + cz, rough)
    const C = (rt: number, rb: number, h: number, c: string, cx: number, yb: number, cz: number, seg = 12) =>
      this.cyl(g, rt, rb, h, c, r.x + cx, yb, r.y + cz, seg)

    if (id === 'wash1' || id === 'wash2') {
      B(0.32, 1.5, 3.1, '#0369a1', 0.41, 0, 1.7)
      B(0.32, 1.5, 3.1, '#0369a1', 2.59, 0, 1.7)
      B(0.42, 0.3, 0.5, '#eab308', 0.41, 0, 0.35)
      B(0.42, 0.3, 0.5, '#eab308', 2.59, 0, 0.35)
      B(2.5, 0.3, 0.32, '#0ea5e9', 1.5, 1.5, 0.3)
      // totem + lamp
      B(0.4, 1.0, 0.4, '#0f766e', 2.95, 0, 2.7)
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), new THREE.MeshBasicMaterial({ color: '#f87171' }))
      lamp.position.set(r.x + 2.95, 1.12, r.y + 2.7)
      lamp.name = 'totemLamp'
      lamp.userData.keep = true
      g.add(lamp)
      // foam tank + hose coil
      C(0.3, 0.3, 0.85, '#7dd3fc', -0.27, 0, 2.75)
      const hose = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 20), mat('#075985'))
      hose.position.set(r.x - 0.27, 0.2, r.y + 3.35)
      hose.rotation.x = -Math.PI / 2
      hose.castShadow = true
      g.add(hose)
      // spinning brushes (dynamic: excluded from the static merge)
      for (const off of [-0.7, 0.7]) {
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.0, 10), mat('#bae6fd', 1))
        br.position.set(r.cx + off, 0.75, r.cy)
        br.castShadow = true
        br.name = 'brush'
        br.userData.keep = true
        g.add(br)
      }
      // puddle sheen
      const pud = new THREE.Mesh(
        new THREE.CircleGeometry(1.15, 24),
        new THREE.MeshStandardMaterial({ color: '#7dd3fc', transparent: true, opacity: 0.3, roughness: 0.2 }),
      )
      pud.rotation.x = -Math.PI / 2
      pud.position.set(r.cx, 0.015, r.cy + 0.7)
      pud.receiveShadow = true
      g.add(pud)
    } else if (id === 'repair1') {
      B(1.5, 0.55, 0.55, '#a16207', 0.95, 0, 2.82)
      B(1.3, 0.1, 0.35, '#713f12', 0.95, 0.55, 2.82)
      B(0.25, 0.2, 0.25, '#374151', 1.6, 0.55, 2.82)
      B(0.08, 1.0, 0.9, '#92400e', 2.4, 0.35, 3.1)
      for (const oy of [0.2, 0.45, 0.7]) {
        B(0.03, 0.3, 0.03, '#1f2937', 2.4, 0.6, 2.65 + oy)
      }
      B(1.1, 0.12, 0.45, '#b91c1c', 0.75, 0, 0.62)
      B(0.8, 1.3, 0.5, '#475569', 2.4, 0, 0.55)
      B(0.7, 0.14, 0.4, '#64748b', 2.4, 0.5, 0.55)
      B(0.7, 0.14, 0.4, '#64748b', 2.4, 0.9, 0.55)
      C(0.14, 0.14, 0.4, '#dc2626', 0.64, 0, 2.1)
      // wheel stack + crate belong to this bench
      for (const dy of [0.16, 0.44]) {
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.11, 10, 20), mat('#1f2937'))
        t.position.set(r.x + 3.1, dy, r.y + 3.5)
        t.rotation.x = -Math.PI / 2
        t.castShadow = true
        g.add(t)
      }
      B(0.64, 0.52, 0.64, '#c99a5b', r.x - 1.0 + 0.32 - r.x, 0, 3.62)
      B(0.64, 0.53, 0.2, '#8a5a2b', r.x - 1.0 + 0.32 - r.x, 0, 3.4)
    } else if (id === 'lift') {
      for (const px of [0.42, 2.62]) {
        B(0.34, 1.5, 0.5, '#be123c', px, 0, 1.65)
        for (let i = 0; i < 3; i++) B(0.36, 0.12, 0.52, '#facc15', px, 0.25 + i * 0.35, 1.65)
      }
      B(2.54, 0.28, 0.3, '#881337', 1.52, 1.5, 1.65)
      B(0.9, 0.22, 0.22, '#facc15', 0.95, 0, 2.6)
      B(0.9, 0.22, 0.22, '#facc15', 2.15, 0, 2.6)
    } else if (id === 'tire') {
      B(0.45, 1.15, 0.45, '#6d28d9', 0.52, 0, 2.52)
      B(0.2, 0.2, 1.0, '#4c1d95', 0.52, 0.9, 2.3)
      C(0.38, 0.38, 0.28, '#374151', 1.52, 0, 2.72)
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.1, 10, 20), mat('#1f2937'))
      t.position.set(r.x + 1.52, 0.42, r.y + 2.72)
      t.rotation.x = -Math.PI / 2
      t.castShadow = true
      g.add(t)
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.12, 12), mat('#a78bfa'))
      hub.position.set(r.x + 1.52, 0.4, r.y + 2.72)
      g.add(hub)
      B(0.6, 0.8, 0.5, '#4c1d95', 2.4, 0, 2.65)
      for (const [ox, oy] of [[0.35, 0.5], [0.35, 0.95], [2.15, 0.5]] as const) {
        const w = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.09, 10, 18), mat('#1f2937'))
        w.position.set(r.x + ox, 0.16, r.y + oy)
        w.rotation.x = -Math.PI / 2
        w.castShadow = true
        g.add(w)
      }
    } else if (id === 'detail') {
      for (const [px, py] of [[0.29, 0.29], [2.69, 0.29], [0.29, 3.09], [2.69, 3.09]] as const) {
        B(0.18, 1.9, 0.18, '#0f766e', px, 0, py)
      }
      // striped awning
      const awn = new THREE.Group()
      for (let i = 0; i < 4; i++) {
        const s = new THREE.Mesh(
          new THREE.PlaneGeometry(0.75, 3.1),
          mat(i % 2 === 0 ? '#f8fafc' : '#2dd4bf', 1),
        )
        s.rotation.x = -Math.PI / 2
        s.position.set(0.55 + i * 0.72, 1.9, 1.69)
        s.castShadow = true
        awn.add(s)
      }
      awn.position.set(r.x, 0, r.y)
      g.add(awn)
      // lamp + vacuum + cart
      B(0.06, 0.35, 0.06, '#134e4a', 1.6, 1.55, 1.4)
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), new THREE.MeshBasicMaterial({ color: '#fef9c3' }))
      bulb.position.set(r.x + 1.6, 1.5, r.y + 1.4)
      bulb.name = 'lampBulb'
      g.add(bulb)
      C(0.26, 0.3, 0.6, '#dc2626', 0.55, 0, 2.75)
      B(0.55, 0.45, 0.5, '#334155', 2.47, 0, 2.75)
    } else if (id === 'paint') {
      B(3.4, 1.15, 0.3, '#d08a1e', r.x + 1.7 - r.x, 0, 0.15)
      B(0.3, 1.15, 3.4, '#e0a63a', 0.15, 0, 1.7)
      B(0.3, 0.62, 3.4, '#eab308', 3.25, 0, 1.7)
      for (const [px, py] of [[0.12, 0.12], [3.28, 0.12], [0.12, 3.28], [3.28, 3.28]] as const) {
        B(0.25, 1.15, 0.25, '#a16207', px, 0, py)
      }
      B(0.5, 0.6, 0.5, '#9aa0ab', 0.7, 1.15, 0.2)
      B(0.36, 0.12, 0.36, '#5b6472', 0.7, 1.75, 0.2)
      B(3.4, 0.5, 0.3, '#f0c14b', 1.7, 0, 3.25)
    }
  }

  private syncStationFx(game: Game, id: StationId, time: number): void {
    const g = this.stationGroups.get(id)
    if (!g || g.children.length === 0) return
    const busyWash = game.cars.some((cc) => cc.bay === id && cc.work && (cc.work.service === 'wash' || cc.work.service === 'detail'))
    g.traverse((o) => {
      if (o.name === 'brush') o.rotation.y = busyWash ? time * 7 : 0
      if (o.name === 'totemLamp') {
        ;((o as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(busyWash ? '#4ade80' : '#f87171')
      }
    })
  }

  private syncBuiltProps(game: Game, time: number): void {
    void time
    if (!this.builtProps) return
    const want = new Set<string>()
    if (game.hasUnlock('pressure')) want.add('tank')
    if (game.hasUnlock('billboard')) want.add('billboard')
    if (game.hasUnlock('showroom')) want.add('showroom')
    if (game.hasUnlock('usedlot')) want.add('bunting')
    for (const child of [...this.builtProps.children]) {
      if (!want.has(child.name)) this.builtProps.remove(child)
    }
    const has = new Set(this.builtProps.children.map((c) => c.name))
    const add = (name: string, build: (root: THREE.Group) => void) => {
      if (want.has(name) && !has.has(name)) {
        build(this.builtProps as THREE.Group)
        const g = this.builtProps?.children.find((c) => c.name === name)
        if (g) this.mergeStatic(g as THREE.Group)
      }
    }
    add('tank', (r) => this.buildTank(r))
    add('billboard', (r) => this.buildBillboard(r))
    add('showroom', (r) => this.buildShowroom(r))
    add('bunting', (r) => this.buildBunting(r))
  }

  private buildTank(root: THREE.Group): void {
    const g = new THREE.Group()
    g.name = 'tank'
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.0, 16), mat('#0284c7'))
    t.position.set(10.15, 0.5, 2.9)
    t.castShadow = true
    g.add(t)
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.18, 16), mat('#075985'))
    band.position.set(10.15, 0.14, 2.9)
    g.add(band)
    const gauge = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), new THREE.MeshBasicMaterial({ color: '#f8fafc' }))
    gauge.position.set(10.15, 1.06, 2.34)
    gauge.rotation.y = Math.PI / 4
    g.add(gauge)
    const hose = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.04, 8, 20), mat('#075985'))
    hose.position.set(10.15, 0.2, 4.05)
    hose.rotation.x = -Math.PI / 2
    hose.castShadow = true
    g.add(hose)
    root.add(g)
  }

  private buildBillboard(root: THREE.Group): void {
    const g = new THREE.Group()
    g.name = 'billboard'
    const put = (w: number, h: number, d: number, c: string, x: number, yb: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c))
      m.position.set(x, yb + h / 2, z)
      m.castShadow = true
      g.add(m)
    }
    put(0.3, 2.0, 0.3, '#44403c', 19.0, 0, 14.85)
    put(0.3, 2.0, 0.3, '#44403c', 19.75, 0, 14.85)
    const panel: Array<[string, number, number, number, number]> = [
      ['#f59e0b', 3.4, 1.45, 19.37, 1.35],
      ['#fffbeb', 3.2, 0.6, 19.37, 1.75],
    ]
    for (const [c, w, h, x, y] of panel) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), mat(c))
      m.position.set(x, y, 14.85)
      m.castShadow = true
      g.add(m)
    }
    const words: Array<[string, number, number, number]> = [
      ['🚗', 18.5, 1.78, 0.5], ['✨', 19.37, 1.78, 0.5], ['💰', 20.25, 1.78, 0.5],
    ]
    for (const [e, x, y, s] of words) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(s, s),
        new THREE.MeshBasicMaterial({ map: emojiTex(e, null), transparent: true }),
      )
      m.position.set(x, y, 14.78)
      m.rotation.y = Math.PI / 4
      g.add(m)
    }
    put(1.6, 0.18, 0.18, '#78350f', 19.37, 0.55, 14.85)
    root.add(g)
  }

  private buildShowroom(root: THREE.Group): void {
    const g = new THREE.Group()
    g.name = 'showroom'
    const put = (w: number, h: number, d: number, c: string, x: number, yb: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c))
      m.position.set(x, yb + h / 2, z)
      m.castShadow = true
      m.receiveShadow = true
      g.add(m)
    }
    put(5.6, 0.12, 4, '#eef2f6', 26.2, 0, 15.4)
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#aed6f2', transparent: true, opacity: 0.35, roughness: 0.15, metalness: 0.1,
    })
    const back = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.25, 0.12), glassMat)
    back.position.set(26.2, 0.62, 13.55)
    g.add(back)
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.25, 4), glassMat)
    side.position.set(23.55, 0.62, 15.4)
    g.add(side)
    for (let i = 0; i <= 4; i++) put(0.1, 1.25, 0.1, '#f8fafc', 23.9 + i * 1.15, 0, 13.55)
    put(4.6, 0.2, 0.34, '#b2781f', 26.2, 1.25, 13.5)
    const trophy = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.5),
      new THREE.MeshBasicMaterial({ map: emojiTex('🏆', 'rgba(120,53,15,0.95)'), transparent: true }),
    )
    trophy.position.set(26.2, 1.62, 13.72)
    trophy.rotation.y = Math.PI / 4
    g.add(trophy)
    // showroom sale podiums
    for (const s of [{ x: 24.8, y: 15.6 }, { x: 26.5, y: 15.6 }, { x: 28.2, y: 15.6 }]) {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.2, 0.08, 24), mat('#f8fafc'))
      pod.position.set(s.x, 0.04, s.y)
      pod.receiveShadow = true
      g.add(pod)
    }
    root.add(g)
  }

  private buildBunting(root: THREE.Group): void {
    const g = new THREE.Group()
    g.name = 'bunting'
    const cols = ['#ef4444', '#facc15', '#22c55e', '#38bdf8', '#f472b6']
    const lines: Array<[[number, number], [number, number]]> = [
      [[24, 2], [28.6, 2]],
      [[24, 2], [24, 7.4]],
    ]
    for (const [[x1, y1], [x2, y2]] of lines) {
      for (const [px, py] of [[x1, y1], [x2, y2]] as const) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.9, 8), mat('#44403c'))
        post.position.set(px, 0.95, py)
        post.castShadow = true
        g.add(post)
      }
      const pts: THREE.Vector3[] = []
      for (let i = 0; i <= 12; i++) {
        const t = i / 12
        pts.push(new THREE.Vector3(x1 + (x2 - x1) * t, 1.9 - Math.sin(t * Math.PI) * 0.22, y1 + (y2 - y1) * t))
      }
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: '#57534e' }),
      )
      g.add(line)
      for (let i = 1; i < 7; i++) {
        const t = i / 7
        const shape = new THREE.Shape()
        shape.moveTo(-0.11, 0)
        shape.lineTo(0.11, 0)
        shape.lineTo(0, -0.2)
        shape.closePath()
        const flag = new THREE.Mesh(
          new THREE.ShapeGeometry(shape),
          new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide }),
        )
        flag.position.set(x1 + (x2 - x1) * t, 1.9 - Math.sin(t * Math.PI) * 0.22, y1 + (y2 - y1) * t)
        flag.rotation.y = Math.PI / 4
        flag.name = 'flag'
        g.add(flag)
      }
    }
    root.add(g)
  }

  // ---------- actors ----------

  private async syncCars(game: Game, time: number, dt: number): Promise<void> {
    void time
    const seen = new Set<number>()
    for (const car of game.cars) {
      seen.add(car.id)
      let entry = this.cars.get(car.id)
      if (!entry) {
        const paintIdx = (car.seed * 7 + car.type.base) % PAINTS.length | 0
        this.paintByCar.set(car.id, paintIdx)
        try {
          const rig = await makeCarRig(car.type.id, paintIdx, car.seed)
          rig.group.rotation.order = 'YXZ'
          this.scene.add(rig.group)
          entry = { rig, paintSeen: car.repaint, flatSeen: -2, lastX: car.x, lastZ: car.y }
          this.cars.set(car.id, entry)
        } catch (e) {
          console.warn('[models] car failed', car.type.id, e)
          continue
        }
      }
      const lifted = car.bay === 'lift' && car.phase === 'inBay'
      const hop = Math.sin(Math.min(1, car.bounce) * Math.PI) * 0.07
      entry.rig.group.position.set(car.x, (lifted ? 0.42 : 0) + hop, car.y)
      entry.rig.group.rotation.y = Math.atan2(Math.cos(car.angle), Math.sin(car.angle))
      const pop = 1 + car.pop * 0.06
      entry.rig.group.scale.setScalar(pop)
      // wheels roll with travel; flat tire pins one wheel
      const moved = Math.hypot(car.x - entry.lastX, car.y - entry.lastZ)
      entry.lastX = car.x
      entry.lastZ = car.y
      if (moved > 0.0001) entry.rig.spinWheels(moved)
      const wantFlat = car.cond.tires < 55 ? Math.floor(((car.seed * 13) % 4 + 4) % 4) : -1
      if (wantFlat !== entry.flatSeen) {
        entry.flatSeen = wantFlat
        entry.rig.setFlat(wantFlat)
      }
      entry.rig.setDirt(1 - car.cond.clean / 100)
      this.spawnWorkFx(game, car)
      if (car.repaint !== entry.paintSeen) {
        entry.paintSeen = car.repaint
        entry.rig.setPaint((this.paintByCar.get(car.id) ?? 0) + 1)
        this.paintByCar.set(car.id, entry.rig.paintIdx)
      }
      void dt
    }
    for (const [id, entry] of this.cars) {
      if (!seen.has(id)) {
        this.scene.remove(entry.rig.group)
        this.cars.delete(id)
        this.paintByCar.delete(id)
      }
    }
  }

  private async rigFor(key: string, skin: string, tint: number): Promise<{ rig: CharRig; tool: THREE.Mesh | null; root: THREE.Group }> {
    let entry = this.workerRigs.get(key)
    if (!entry) {
      const rig = await makeCharRig(skin, tint, key === 'player' ? 1.2 : 1.1)
      // wrapper carries heading + position; the inner group carries lean + bob
      // so effort poses never fight the facing direction
      const root = new THREE.Group()
      root.add(rig.group)
      const tool = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 0.09), mat('#9aa3b2', 0.5))
      tool.visible = false
      rig.group.add(tool)
      tool.position.set(0.28, 0.75, 0.15)
      entry = { rig, tool, root }
      this.workerRigs.set(key, entry)
      this.scene.add(root)
    }
    return entry
  }

  private faceMove(obj: THREE.Object3D, vx: number, vz: number): void {
    if (Math.hypot(vx, vz) > 0.05) obj.rotation.y = Math.atan2(vx, vz)
  }

  /** Effort posing on top of the skinned clips: lean into work, bob on the move. */
  private pose(entry: { rig: CharRig; root: THREE.Group }, working: boolean, moving: boolean, time: number, dt: number): void {
    const g = entry.rig.group
    const leanT = working ? 0.1 : 0
    const lean = ((g.userData.lean as number | undefined) ?? 0) + (leanT - (((g.userData.lean as number | undefined) ?? 0))) * Math.min(1, dt * 8)
    g.userData.lean = lean
    g.rotation.x = lean
    g.position.y = moving
      ? Math.abs(Math.sin(time * 11)) * 0.05
      : working
        ? Math.sin(time * 9) * 0.02
        : 0
  }

  private async syncActors(game: Game, time: number, dt: number): Promise<void> {
    // player
    try {
      const skin = SKINS.player
      const pe = await this.rigFor('player', skin.file, skin.tint)
      pe.root.position.set(game.player.x, 0, game.player.y)
      this.faceMove(pe.root, game.player.vx, game.player.vy)
      pe.rig.setMoving(game.player.moving, game.player.speed)
      pe.rig.mixer.update(dt)
      // work lean + tool
      let working = false
      const it = game.current
      if (it && it.kind === 'work') {
        const car = game.cars.find((c) => c.id === it.carId)
        working = !!car?.work && car.work.by === 'player'
      }
      this.pose(pe, working, game.player.moving, time, dt)
      if (pe.tool) {
        pe.tool.visible = working
        if (working) pe.tool.position.y = 0.75 + Math.sin(time * 13) * 0.08
      }
      this.playerRig = pe.rig
      this.playerTool = pe.tool
      this.playerRing.position.set(game.player.x, 0.03, game.player.y)
    } catch (e) {
      console.warn('[models] player failed', e)
    }
    // workers
    const seen = new Set<string>()
    for (const w of game.workers) {
      seen.add(w.role)
      try {
        const key = WORKER_SKIN[w.role] ?? 'washer'
        const skin = SKINS[key] ?? SKINS.player
        const we = await this.rigFor(w.role, skin.file, skin.tint)
        we.root.position.set(w.x, 0, w.y)
        const moving = w.state === 'walk' || w.state === 'sellwalk'
        const face = { x: 0, z: 0 }
        if (moving) {
          face.x = Math.cos(w.angle)
          face.z = Math.sin(w.angle)
        } else if (w.state === 'work' || w.state === 'selling') {
          const car = game.cars.find((c) => c.id === w.carId)
          if (car) {
            const dx = car.x - w.x
            const dz = car.y - w.y
            if (Math.hypot(dx, dz) > 0.05) {
              face.x = dx
              face.z = dz
            }
          }
        }
        if (Math.hypot(face.x, face.z) > 0.05) we.root.rotation.y = Math.atan2(face.x, face.z)
        we.rig.setMoving(moving, 3.6)
        we.rig.mixer.update(dt)
        const working = w.state === 'work'
        this.pose(we, working, moving, time + w.bob, dt)
        if (we.tool) {
          const showTool = working && w.role !== 'seller'
          we.tool.visible = showTool
          if (showTool) we.tool.position.y = 0.75 + Math.sin(time * 9 + w.bob) * 0.08
        }
      } catch (e) {
        console.warn('[models] worker failed', w.role, e)
      }
    }
    for (const [key, entry] of this.workerRigs) {
      if (key !== 'player' && !seen.has(key)) {
        this.scene.remove(entry.root)
        this.workerRigs.delete(key)
      }
    }
    void this.playerRig
    void this.playerTool
  }

  // ---------- guide / particles / labels ----------

  private syncGuide(game: Game, time: number): void {
    const t = game.guideTarget()
    const show = !!t
    this.guideArrow.visible = show
    this.guideRing.visible = show
    if (!t) return
    const bob = Math.sin(time * 4) * 0.12
    this.guideArrow.position.set(t.x, 1.9 + bob, t.y)
    this.guideArrow.rotation.y = time * 1.5
    const ring = (time % 1.2) / 1.2
    this.guideRing.position.set(t.x, 0.05, t.y)
    const s = 0.5 + ring * 0.9
    this.guideRing.scale.set(s, s, s)
    ;(this.guideRing.material as THREE.MeshBasicMaterial).opacity = 1 - ring
  }

  private spawnWorkFx(game: Game, car: Car): void {
    void game
    if (!car.work) {
      if (car.path.length > 0 && Math.random() < 0.3 && this.particles.length < 400) {
        this.particles.push({
          x: car.x, y: car.y, z: 0.08,
          vx: (Math.random() - 0.5), vy: (Math.random() - 0.5), vz: 0.7,
          life: 0, max: 0.55, color: 'rgba(190,180,160,0.6)',
        })
      }
      return
    }
    const s = car.work.service
    const n = s === 'wash' ? 3 : 2
    const palette =
      s === 'wash' ? ['#7dd3fc', '#e0f2fe', '#ffffff']
      : s === 'paint' ? ['#f472b6', '#facc15', '#a78bfa']
      : s === 'detail' ? ['#ffffff', '#fef9c3', '#5eead4']
      : ['#fdba74', '#e5e7eb', '#facc15']
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 400) return
      this.particles.push({
        x: car.x + (Math.random() - 0.5) * 1.8,
        y: car.y + (Math.random() - 0.5) * 1.4,
        z: 0.5 + Math.random() * 0.5,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        vz: 1 + Math.random() * 1.5,
        life: 0, max: 0.5 + Math.random() * 0.4,
        color: palette[Math.floor(Math.random() * palette.length)],
      })
    }
    if (car.cond.mech < 50 && Math.random() < 0.1 && this.particles.length < 400) {
      this.particles.push({
        x: car.x + 0.7, y: car.y, z: 0.6, vx: 0.2, vy: -0.2, vz: 1.1,
        life: 0, max: 0.9, color: 'rgba(90,90,100,0.65)',
      })
    }
  }

  private updateParticles(dt: number): void {
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
    const pos = this.pointGeo.getAttribute('position') as THREE.BufferAttribute
    const col = this.pointGeo.getAttribute('color') as THREE.BufferAttribute
    const c = new THREE.Color()
    const n = Math.min(this.particles.length, 420)
    for (let i = 0; i < n; i++) {
      const p = this.particles[i]
      pos.setXYZ(i, p.x, p.z, p.y)
      c.set(p.color)
      col.setXYZ(i, c.r, c.g, c.b)
    }
    pos.needsUpdate = true
    col.needsUpdate = true
    this.pointGeo.setDrawRange(0, n)
  }

  private updateBursts(dt: number): void {
    for (const b of this.bursts) {
      b.t += dt
      const s = 1 + b.t * 3
      b.mesh.scale.set(s, s, s)
      ;(b.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - b.t)
    }
    this.bursts = this.bursts.filter((b) => {
      if (b.t >= 0.9) {
        this.scene.remove(b.mesh)
        return false
      }
      return true
    })
  }

  private updateLabels(game: Game): void {
    // pooled DOM nodes: bubbles, prices, pins, progress bars
    let n = 0
    const use = (html: string, cls: string, x: number, y: number, z: number): void => {
      let el = this.labels[n]
      if (!el) {
        el = document.createElement('div')
        this.labelLayer.appendChild(el)
        this.labels[n] = el
      }
      n++
      if (el.dataset.k !== cls + html) {
        el.dataset.k = cls + html
        el.className = `wl ${cls}`
        el.innerHTML = html
      }
      const px = this.sx(x, y)
      const py = this.sy(x, y, z)
      el.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(-50%,-100%)`
      el.style.display = px < -80 || px > this.vw + 80 || py < -80 || py > this.vh + 80 ? 'none' : 'block'
    }
    const bar = (x: number, y: number, z: number, p: number, color: string): void => {
      use(`<div class="wl-bar"><i style="width:${Math.round(Math.min(1, p) * 100)}%;background:${color}"></i></div>`, '', x, y, z)
    }
    for (const car of game.cars) {
      if (car.phase === 'inBay' && !car.done && car.needs.length > 0) {
        const svc = car.needs[0]
        const lifted = car.bay === 'lift' && car.phase === 'inBay'
        const z = 1.15 + (lifted ? 0.42 : 0)
        use(car.work ? '⏳' : (SERVICE_ICON[svc] ?? '❗'), 'wl-bubble', car.x, car.y, z)
        if (car.work) bar(car.x, car.y, z - 0.35, car.work.progress, '#4ade80')
      } else if (car.phase === 'forSale') {
        const inShow = car.parkIdx >= 100
        const price = carValue(car.type, car.cond, { showroom: inShow })
        use(`💰 $${price}`, car.parkIdx >= 100 ? 'wl-price show' : 'wl-price', car.x, car.y, 1.05)
        if (car.sellerBy !== null) bar(car.x, car.y, 0.7, car.sellT / 5, '#a78bfa')
      } else if (car.phase === 'offer') {
        use(`🏷️ $${offerPrice(car.type, car.cond)}`, 'wl-price tag', car.x, car.y, 1.05)
      } else if (car.phase === 'queued' && car.owner === 'player') {
        use('🔧', 'wl-bubble', car.x, car.y, 1.0)
      }
    }
    // locked pads: pin far, price chip near
    const lockedPads: Array<{ x: number; y: number; icon: string; cost: number }> = []
    for (const id of Object.keys(STATION_RECTS) as StationId[]) {
      if (game.stationUnlocked(id)) continue
      const u = STATIONS[id].unlock
      const def = UNLOCKS.find((d) => d.id === u)
      if (!def) continue
      const r = STATION_RECTS[id]
      lockedPads.push({ x: r.cx, y: r.cy, icon: def.icon, cost: def.cost })
    }
    for (const pd of game.pads()) {
      const def = UNLOCKS.find((d) => d.id === pd.unlockId)
      if (def) lockedPads.push({ x: pd.cx, y: pd.cy, icon: def.icon, cost: def.cost })
    }
    for (const pd of lockedPads) {
      const near = Math.hypot(pd.x - game.player.x, pd.y - game.player.y) < 7.5
      const afford = game.money >= pd.cost
      if (near) {
        use(`${pd.icon} $${pd.cost}`, afford ? 'wl-chip' : 'wl-chip poor', pd.x, pd.y, 1.2)
      } else {
        use(pd.icon, afford ? 'wl-pin' : 'wl-pin poor', pd.x, pd.y, 0.9)
      }
    }
    // worker progress + player work ring anchor (ring is 3D; bar here)
    for (const w of game.workers) {
      if (w.state === 'work' && w.role !== 'seller') {
        const col = { washer: '#38bdf8', mechanic: '#fb923c', detailer: '#2dd4bf' }[w.role] ?? '#94a3b8'
        bar(w.x, w.y, 1.05, w.progress, col)
      }
    }
    for (let i = n; i < this.labels.length; i++) this.labels[i].style.display = 'none'
  }
}

// ---------- ground texture (decals baked once per unlock-state) ----------

function paintGround(canvas: HTMLCanvasElement, game: Game): void {
  const g = canvas.getContext('2d')
  if (!g) return
  const S = canvas.width / MAP_W
  const X = (x: number) => x * S
  const Y = (y: number) => y * S
  // grass
  const grad = g.createLinearGradient(0, 0, 0, canvas.height)
  grad.addColorStop(0, '#86c96f')
  grad.addColorStop(1, '#69ad57')
  g.fillStyle = grad
  g.fillRect(0, 0, canvas.width, canvas.height)
  // concrete yard (west)
  for (let x = 1; x < 29; x++) {
    for (let y = 1; y < 19; y++) {
      g.fillStyle = (x + y) % 2 === 0 ? '#d8d1c2' : '#d1c9b8'
      g.fillRect(X(x), Y(y), S + 1, S + 1)
    }
  }
  g.strokeStyle = 'rgba(120,110,95,0.35)'
  g.lineWidth = 1.5
  for (let x = 2; x < 29; x += 4) {
    g.beginPath()
    g.moveTo(X(x), Y(1))
    g.lineTo(X(x), Y(19))
    g.stroke()
  }
  // zone tints
  const tint = (x: number, y: number, w: number, h: number, c: string) => {
    g.fillStyle = c
    g.fillRect(X(x), Y(y), w * S, h * S)
  }
  tint(10.6, 1.6, 8.6, 4.2, 'rgba(56,189,248,0.16)')
  tint(2.6, 7.6, 20.6, 4.4, 'rgba(234,88,12,0.10)')
  if (game.hasUnlock('usedlot')) tint(23.6, 1.6, 5.4, 6.2, 'rgba(190,165,120,0.5)')
  tint(23.6, 8.6, 5, 3.6, 'rgba(167,139,250,0.12)')
  if (game.hasUnlock('showroom')) tint(23.2, 13.2, 6, 4.4, 'rgba(248,250,252,0.5)')
  // curb + road
  g.fillStyle = '#e8e2d4'
  g.fillRect(0, Y(18.55), canvas.width, 0.45 * S)
  for (let x = 0; x < MAP_W; x++) {
    g.fillStyle = '#565e6d'
    g.fillRect(X(x), Y(19), S + 1, S)
    g.fillStyle = '#4d5462'
    g.fillRect(X(x), Y(20), S + 1, S)
    g.fillStyle = '#565e6d'
    g.fillRect(X(x), Y(21), S + 1, S)
  }
  g.fillStyle = '#fbbf24'
  for (let x = 0; x < MAP_W; x += 2) {
    g.save()
    g.translate(X(x + 0.3), Y(20.4))
    g.rotate(Math.PI / 4)
    g.fillRect(-S * 0.28, -2, S * 0.56, 4)
    g.restore()
  }
  // driveway + chevrons
  g.fillStyle = '#c0b7a4'
  g.fillRect(X(12.4), Y(17.6), 2.2 * S, 1.4 * S)
  g.fillStyle = 'rgba(255,255,255,0.5)'
  for (const cx of [6, 13.5, 21]) {
    const px = X(cx)
    const py = Y(13.1)
    g.beginPath()
    g.moveTo(px - 9, py - 4)
    g.lineTo(px + 2, py)
    g.lineTo(px - 9, py + 4)
    g.lineTo(px - 9, py + 1)
    g.lineTo(px - 3, py)
    g.lineTo(px - 9, py - 1)
    g.closePath()
    g.fill()
  }
  // parking slots + wheel stops
  const slots = game.hasUnlock('parking') ? [...PARKING_BASE, ...PARKING_EXTRA] : PARKING_BASE
  g.strokeStyle = 'rgba(255,255,255,0.7)'
  g.lineWidth = 2
  for (const p of slots) {
    g.beginPath()
    g.ellipse(X(p.x), Y(p.y), S * 1.0, S * 0.52, 0, 0, Math.PI * 2)
    g.stroke()
    g.fillStyle = '#9aa0ab'
    for (const ox of [-0.55, 0.55]) g.fillRect(X(p.x + ox) - S * 0.16, Y(p.y - 0.75) - 3, S * 0.32, 6)
  }
  // drains + oil stains
  g.fillStyle = '#3c434f'
  for (const [gx, gy] of [[9.2, 6.4], [14.8, 12.6]] as const) {
    g.save()
    g.translate(X(gx), Y(gy))
    g.rotate(0.46)
    g.fillRect(-10, -5, 20, 10)
    g.fillStyle = '#565e6d'
    for (let i = -7; i <= 7; i += 3.5) g.fillRect(i, -5, 1.6, 10)
    g.fillStyle = '#3c434f'
    g.restore()
  }
  for (const [ox, oy, r] of [[4.5, 10.6, 9], [8.5, 10.8, 7], [12.3, 10.5, 6]] as const) {
    g.fillStyle = 'rgba(40,36,30,0.28)'
    g.beginPath()
    g.ellipse(X(ox), Y(oy), r, r * 0.5, 0.3, 0, Math.PI * 2)
    g.fill()
  }
  // pond
  g.fillStyle = '#cbb98f'
  g.beginPath()
  g.ellipse(X(POND.x), Y(POND.y), POND.rx * S * 1.12, POND.ry * S * 1.35, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#3f9db8'
  g.beginPath()
  g.ellipse(X(POND.x), Y(POND.y), POND.rx * S, POND.ry * S, 0, 0, Math.PI * 2)
  g.fill()
}
