// Open-source 3D models (all CC0, see public/models/*-license.txt):
// vehicles = Kenney Car Kit, characters = Kenney Animated Characters.
// This module owns loading, paint variants, skins and per-entity rigs.

import * as THREE from 'three'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'

const base = import.meta.env.BASE_URL
const M = (p: string) => `${base}models/${p}`

export const CAR_FILES: Record<string, { file: string; targetLen: number }> = {
  compact: { file: 'sedan.glb', targetLen: 2.0 },
  sedan: { file: 'taxi.glb', targetLen: 2.25 },
  hatch: { file: 'hatchback-sports.glb', targetLen: 2.1 },
  suv: { file: 'suv.glb', targetLen: 2.45 },
  van: { file: 'van.glb', targetLen: 2.65 },
  sport: { file: 'sedan-sports.glb', targetLen: 2.25 },
}

/** Paint variants: stock palette + hue-rotated copies (restored cars get one). */
export const PAINTS = ['colormap.png', 'colormap-b.png', 'colormap-c.png', 'colormap-d.png']

export const SKINS: Record<string, { file: string; tint: number }> = {
  player: { file: 'skaterMaleA.png', tint: 0xffffff },
  washer: { file: 'skaterFemaleA.png', tint: 0xffffff },
  mechanic: { file: 'criminalMaleA.png', tint: 0xffffff },
  detailer: { file: 'cyborgFemaleA.png', tint: 0xffffff },
  seller: { file: 'criminalMaleA.png', tint: 0xbdd4ff },
}

const gltfLoader = new GLTFLoader()
const fbxLoader = new FBXLoader()
const texLoader = new THREE.TextureLoader()

const paintTex: Map<string, THREE.Texture> = new Map()
const skinTex: Map<string, THREE.Texture> = new Map()

function paintTexture(file: string): THREE.Texture {
  let t = paintTex.get(file)
  if (!t) {
    t = texLoader.load(M(`cars/Textures/${file}`))
    t.colorSpace = THREE.SRGBColorSpace
    paintTex.set(file, t)
  }
  return t
}

function skinTexture(file: string): THREE.Texture {
  let t = skinTex.get(file)
  if (!t) {
    t = texLoader.load(M(`chars/${file}`))
    t.colorSpace = THREE.SRGBColorSpace
    skinTex.set(file, t)
  }
  return t
}

function fitToLength(obj: THREE.Object3D, len: number): number {
  const box = new THREE.Box3().setFromObject(obj)
  const size = box.getSize(new THREE.Vector3())
  const s = len / Math.max(size.x, size.z)
  obj.scale.setScalar(s)
  return s
}

export interface CarRig {
  group: THREE.Group
  wheels: THREE.Object3D[]
  body: THREE.Mesh | null
  mud: THREE.Mesh | null
  paintIdx: number
  setPaint(i: number): void
  setDirt(d: number): void
  setFlat(wheel: number): void
  spinWheels(dist: number): void
}

const carCache = new Map<string, Promise<THREE.Group>>()

function loadCarModel(file: string): Promise<THREE.Group> {
  let p = carCache.get(file)
  if (!p) {
    p = gltfLoader.loadAsync(M(`cars/${file}`)).then((g) => g.scene)
    carCache.set(file, p)
  }
  return p.then((scene) => scene.clone(true))
}

function bodyMaterial(texFile: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ map: paintTexture(texFile), roughness: 0.55, metalness: 0.08 })
}

const wheelMaterial = new THREE.MeshStandardMaterial({ map: paintTexture(PAINTS[0]), roughness: 0.9 })

export async function makeCarRig(typeId: string, paintIdx: number, seed: number): Promise<CarRig> {
  const def = CAR_FILES[typeId] ?? CAR_FILES.sedan
  const group = await loadCarModel(def.file)
  fitToLength(group, def.targetLen)
  const wheels: THREE.Object3D[] = []
  let body: THREE.Mesh | null = null
  group.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
    if (mesh.name === 'body') {
      body = mesh
      mesh.material = bodyMaterial(PAINTS[paintIdx % PAINTS.length])
    } else if (mesh.name.startsWith('wheel')) {
      mesh.material = wheelMaterial
      const pivot = new THREE.Group()
      pivot.position.copy(mesh.position)
      // pivot spins around the axle (local X); mesh keeps its offset shape
      mesh.position.set(0, 0, 0)
      mesh.parent?.add(pivot)
      pivot.add(mesh)
      wheels.push(pivot)
      void seed
    } else {
      mesh.material = wheelMaterial
    }
  })
  let mud: THREE.Mesh | null = null
  if (body) {
    mud = new THREE.Mesh(
      (body as THREE.Mesh).geometry,
      new THREE.MeshStandardMaterial({
        color: '#5a3d22', transparent: true, opacity: 0, roughness: 1,
        polygonOffset: true, polygonOffsetFactor: -2,
      }),
    )
    mud.scale.setScalar(1.025)
    mud.castShadow = false
    ;(body as THREE.Object3D).parent?.add(mud)
    // keep the shell glued to the body's transform
    mud.position.copy((body as THREE.Object3D).position)
    mud.rotation.copy((body as THREE.Object3D).rotation)
    mud.scale.multiply((body as THREE.Object3D).scale)
  }
  const rig: CarRig = {
    group,
    wheels,
    body,
    mud,
    paintIdx,
    setPaint(i: number) {
      rig.paintIdx = ((i % PAINTS.length) + PAINTS.length) % PAINTS.length
      if (body) (body.material as THREE.MeshStandardMaterial).map = paintTexture(PAINTS[rig.paintIdx])
    },
    setDirt(d: number) {
      if (mud) (mud.material as THREE.MeshStandardMaterial).opacity = Math.max(0, Math.min(1, d * 0.85))
    },
    setFlat(wheel: number) {
      wheels.forEach((w, i) => {
        w.scale.set(1, wheel === i ? 0.55 : 1, 1)
      })
    },
    spinWheels(dist: number) {
      for (const w of wheels) w.rotation.x += dist / 0.3
    },
  }
  return rig
}

// ---- characters ----

export interface CharRig {
  group: THREE.Group
  mixer: THREE.AnimationMixer
  idle: THREE.AnimationAction | null
  run: THREE.AnimationAction | null
  setMoving(m: boolean, speed?: number): void
}

let charBase: Promise<THREE.Group> | null = null
let idleClip: Promise<THREE.AnimationClip | null> | null = null
let runClip: Promise<THREE.AnimationClip | null> | null = null

function loadCharBase(): Promise<THREE.Group> {
  charBase ??= fbxLoader.loadAsync(M('chars/characterMedium.fbx')).then((g) => g)
  return charBase.then((g) => {
    // fresh skeleton per character so mixers don't fight over shared bones
    return cloneSkinned(g) as THREE.Group
  })
}

function pickClip(anims: THREE.AnimationClip[], want: RegExp): THREE.AnimationClip | null {
  // Kenney packs bundle a static bind/targeting pose next to the real take;
  // never play it (a frozen pose gliding across the floor is exactly what
  // "broken animation" looks like).
  const takes = anims.filter((a) => !/pose|target|bind|reference/i.test(a.name))
  return takes.find((a) => want.test(a.name)) ?? takes[0] ?? null
}

function loadClip(which: 'idle' | 'run'): Promise<THREE.AnimationClip | null> {
  const slot = which === 'idle' ? idleClip : runClip
  if (slot) return slot
  const want = which === 'idle' ? /idle/i : /run|walk|sprint/i
  const p = fbxLoader
    .loadAsync(M(`chars/${which}.fbx`))
    .then((g) => pickClip(g.animations, want))
    .catch(() => null)
  if (which === 'idle') idleClip = p
  else runClip = p
  return p
}

export async function makeCharRig(skin: string, tint: number, height = 1.15): Promise<CharRig> {
  const group = await loadCharBase()
  const map = skinTexture(skin)
  group.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.material = new THREE.MeshStandardMaterial({ map, color: tint, roughness: 0.9 })
  })
  const box = new THREE.Box3().setFromObject(group)
  const size = box.getSize(new THREE.Vector3())
  group.scale.setScalar(height / Math.max(0.001, size.y))
  const mixer = new THREE.AnimationMixer(group)
  const [idle, run] = await Promise.all([loadClip('idle'), loadClip('run')])
  const idleAction = idle ? mixer.clipAction(idle) : null
  const runAction = run ? mixer.clipAction(run) : null
  idleAction?.play()
  let moving = false
  return {
    group,
    mixer,
    idle: idleAction,
    run: runAction,
    setMoving(m: boolean, speed = 0) {
      if (runAction) runAction.timeScale = Math.max(0.7, Math.min(1.5, 0.75 + speed * 0.09))
      if (m === moving) return
      moving = m
      if (!idleAction || !runAction) return
      if (m) {
        idleAction.fadeOut(0.15)
        runAction.reset().fadeIn(0.15).play()
      } else {
        runAction.fadeOut(0.15)
        idleAction.reset().fadeIn(0.15).play()
      }
    },
  }
}
