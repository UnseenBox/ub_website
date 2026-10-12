// Garage Empire — simulation: customers, jobs, workers, flipping, economy.
// Owns all gameplay state and rules. Rendering and DOM UI only read from it.

import {
  CAR_SPEED,
  CAR_TYPES,
  HIRES,
  INTERACT_RADIUS,
  LEVELS,
  PLAYER_SPEED,
  SERVICES,
  STATIONS,
  UNLOCKS,
  avgCond,
  carValue,
  levelFor,
  neededServices,
  objectives,
  offerPrice,
  restoreCost,
  spawnInterval,
  type CarType,
  type Conditions,
  type ServiceKind,
  type StationId,
  type WorkerRole,
} from './config'
import {
  BILLBOARD,
  ENTRANCE,
  HIRE_BOARD,
  HOUSES,
  OFFER_PADS,
  PARKING_BASE,
  PARKING_EXTRA,
  PLAYER_SPAWN,
  SALE_PADS,
  SHOWROOM_SLOTS,
  STAGING,
  STATION_RECTS,
  type PadDef,
} from './world'
import { EXTRA_PADS } from './world'
import type { SaveData } from './state'
import type { SfxName } from './audio'

export type Phase = 'arriving' | 'queued' | 'toBay' | 'inBay' | 'toSale' | 'forSale' | 'leaving' | 'offer'

export interface Car {
  id: number
  type: CarType
  color: string
  seed: number
  cond: Conditions
  needs: ServiceKind[]
  wantPaint: boolean
  owner: 'customer' | 'player'
  phase: Phase
  x: number
  y: number
  angle: number
  path: { x: number; y: number }[]
  bay: StationId | null
  parkIdx: number
  work: { service: ServiceKind; progress: number; by: 'player' | number } | null
  boughtFor: number
  invested: number
  tip: number
  flash: number
  sellT: number
  sellerBy: number | null
  done: boolean
  notified: boolean
  /** increments on every completed paint job (renderer swaps paint variant) */
  repaint: number
  /** suspension bounce 1->0 after arriving; completion pop 1->0 */
  bounce: number
  pop: number
}

export interface Worker {
  role: WorkerRole
  x: number
  y: number
  angle: number
  state: 'idle' | 'walk' | 'work' | 'sellwalk' | 'selling'
  tx: number
  ty: number
  carId: number | null
  service: ServiceKind | null
  progress: number
  speed: number
  bob: number
}

export type GameEvent =
  | { t: 'floater'; x: number; y: number; text: string; color: string }
  | { t: 'sfx'; name: SfxName }
  | { t: 'washStart' }
  | { t: 'washStop' }
  | { t: 'toast'; text: string }
  | { t: 'objective'; text: string; bonus: number }
  | { t: 'unlockFx'; x: number; y: number }
  | { t: 'openHire' }
  | { t: 'openOffer'; idx: number }
  | { t: 'sold'; title: string; price: number; bought: number; invested: number; profit: number }
  | { t: 'pulse' }

export interface Interact {
  kind: 'work' | 'buy' | 'hire' | 'inspect' | 'sell' | 'info'
  icon: string
  label: string
  sub: string
  carId: number
  service: ServiceKind | null
  stationId: StationId | null
  unlockId: string | null
  offerIdx: number
  affordable: boolean
  cost: number
  progress: number
}

/** World-space guidance marker: where the player should go next, no words. */
export interface Guide {
  x: number
  y: number
}

let nextId = 1

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a)
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by)
}

function distToRect(px: number, py: number, r: { x: number; y: number; w: number; h: number }): number {
  const cx = Math.max(r.x, Math.min(px, r.x + r.w))
  const cy = Math.max(r.y, Math.min(py, r.y + r.h))
  return Math.hypot(px - cx, py - cy)
}

export class Game {
  save: SaveData
  player = { x: PLAYER_SPAWN.x, y: PLAYER_SPAWN.y, vx: 0, vy: 0, speed: 0, angle: 0, moving: false }
  workers: Worker[] = []
  cars: Car[] = []
  offerTimers = [0, 0, 0]
  current: Interact | null = null
  armedUnlock: string | null = null
  /** seconds since boot; drives build-in animations and ambience */
  time = 0
  /** unlock id -> time it was purchased (-99 = pre-existing from save) */
  builtAt: Record<string, number> = {}
  private armedT = 0
  private spawnT = 8
  private assignT = 0
  private washing = false
  boughtCount = 0

  constructor(save: SaveData) {
    this.save = save
    for (const u of save.unlocks) this.builtAt[u] = -99
    for (const h of save.hires) this.spawnWorker(h as WorkerRole, true)
    this.seedOpening()
  }

  // ---- derived ----

  get money(): number {
    return this.save.money
  }

  get level(): number {
    return levelFor(this.save.lifetime)
  }

  get levelName(): string {
    return LEVELS[this.level].name
  }

  hasUnlock(id: string): boolean {
    return this.save.unlocks.includes(id)
  }

  stationUnlocked(id: StationId): boolean {
    const u = STATIONS[id].unlock
    return u === null || this.hasUnlock(u)
  }

  /** Future purchase spots stay hidden until the first wash bay is owned. */
  showPads(): boolean {
    return this.hasUnlock('wash1')
  }

  parkingCount(): number {
    return this.hasUnlock('parking') ? PARKING_BASE.length + PARKING_EXTRA.length : PARKING_BASE.length
  }

  parkPos(i: number): { x: number; y: number } {
    return i < PARKING_BASE.length ? PARKING_BASE[i] : PARKING_EXTRA[i - PARKING_BASE.length]
  }

  unlockDef(id: string) {
    return UNLOCKS.find((u) => u.id === id)
  }

  pads(): PadDef[] {
    return EXTRA_PADS.filter((p) => !this.hasUnlock(p.unlockId))
  }

  stationLockedPad(id: StationId): boolean {
    return !this.stationUnlocked(id)
  }

  // ---- setup ----

  private seedOpening(): void {
    // Bare-floor start: no bay, no cars. The player buys the first wash bay,
    // then the first customer arrives. Nothing to seed.
  }

  private spawnWorker(role: WorkerRole, instant: boolean): void {
    const def = HIRES.find((h) => h.role === role)
    this.workers.push({
      role,
      x: instant ? 6 + Math.random() * 4 : ENTRANCE.x,
      y: instant ? 7 + Math.random() * 2 : ENTRANCE.y - 1,
      angle: 0,
      state: 'idle',
      tx: 0,
      ty: 0,
      carId: null,
      service: null,
      progress: 0,
      speed: def ? def.speed : 0.7,
      bob: Math.random() * 10,
    })
  }

  // ---- economy ----

  private earn(amount: number, ev: GameEvent[], x: number, y: number, _label: string): void {
    this.save.money += amount
    this.save.lifetime += amount
    ev.push({ t: 'floater', x, y, text: `+$${amount}`, color: '#4ade80' })
    ev.push({ t: 'sfx', name: 'cash' })
    ev.push({ t: 'pulse' })
    this.checkObjectives(ev)
  }

  private spend(amount: number): boolean {
    if (this.save.money < amount) return false
    this.save.money -= amount
    return true
  }

  // ---- spawning ----

  private freeParkIdx(): number {
    const n = this.parkingCount()
    for (let i = 0; i < n; i++) {
      const taken = this.cars.some(
        (c) => (c.phase === 'arriving' || c.phase === 'queued') && c.parkIdx === i,
      )
      if (!taken) return i
    }
    return -1
  }

  private activeCount(): number {
    return this.cars.filter((c) => c.phase !== 'offer').length
  }

  private makeCustomerType(): CarType {
    const pool: CarType[] = [CAR_TYPES[0], CAR_TYPES[1], CAR_TYPES[2], CAR_TYPES[0], CAR_TYPES[1]]
    if (this.save.lifetime > 600 || this.hasUnlock('lift')) pool.push(CAR_TYPES[3], CAR_TYPES[4])
    if (this.hasUnlock('paint') && this.save.lifetime > 3000) pool.push(CAR_TYPES[5])
    return pick(pool)
  }

  private spawnCustomer(ev: GameEvent[]): void {
    const idx = this.freeParkIdx()
    if (idx === -1) return
    const type = this.makeCustomerType()
    const u = (id: string) => this.hasUnlock(id)
    const cond: Conditions = {
      clean: Math.random() < 0.75 ? rand(5, 40) : rand(40, 75),
      mech: rand(25, 70),
      body: rand(25, 70),
      tires: rand(25, 70),
      shine: rand(15, 60),
    }
    const needs = neededServices(cond).filter((s) => {
      // wash-only opening: mechanical needs appear once a bench can serve them
      if (s === 'tires' || s === 'engine' || s === 'body') {
        return u('repair1') || u('lift') || u('tire') || u('paint')
      }
      if (s === 'wash') return true
      if (s === 'detail') return u('detail')
      return false
    })
    if (cond.clean >= 92) {
      cond.clean = rand(10, 45)
      if (!needs.includes('wash')) needs.unshift('wash')
    }
    const wantPaint = u('paint') && Math.random() < 0.28
    if (wantPaint) needs.push('paint')
    if (needs.length === 0) needs.push('wash')
    // fix non-needed stats high so the car looks varied but fair
    for (const s of ['tires', 'engine', 'body'] as const) {
      const key = s === 'engine' ? 'mech' : s
      const needKey = s === 'engine' ? 'engine' : s === 'tires' ? 'tires' : 'body'
      if (!needs.includes(needKey as ServiceKind)) cond[key] = rand(88, 100)
    }
    const p = this.parkPos(idx)
    this.cars.push({
      id: nextId++,
      type,
      color: pick(type.palette),
      seed: Math.random() * 100,
      cond,
      needs,
      wantPaint,
      owner: 'customer',
      phase: 'arriving',
      x: ENTRANCE.x + rand(-0.5, 0.5),
      y: ENTRANCE.y,
      angle: -Math.PI / 2,
      path: [{ x: STAGING.x, y: STAGING.y }, { x: p.x, y: p.y }],
      bay: null,
      parkIdx: idx,
      work: null,
      boughtFor: 0,
      invested: 0,
      tip: u('billboard') && Math.random() < 0.5 ? Math.round(rand(8, 25)) : 0,
      flash: 0,
      sellT: 0,
      sellerBy: null,
      done: false,
      notified: false,
      repaint: 0,
      bounce: 0,
      pop: 0,
    })
    ev.push({ t: 'sfx', name: 'horn' })
  }

  private makeOfferCar(): Car {
    const pool: CarType[] = [CAR_TYPES[0], CAR_TYPES[1], CAR_TYPES[2]]
    if (this.save.lifetime > 900 || this.hasUnlock('lift')) pool.push(CAR_TYPES[3], CAR_TYPES[4])
    if (this.hasUnlock('showroom')) pool.push(CAR_TYPES[5])
    const type = pick(pool)
    const rough = rand(0.75, 1)
    const cond: Conditions = {
      clean: rand(8, 35),
      mech: rand(20, 60) * rough,
      body: rand(20, 60) * rough,
      tires: rand(20, 60) * rough,
      shine: rand(10, 40),
    }
    const needs = neededServices(cond)
    const wantPaint = cond.body < 55
    return {
      id: nextId++,
      type,
      color: pick(type.palette),
      seed: Math.random() * 100,
      cond,
      needs,
      wantPaint,
      owner: 'player',
      phase: 'offer',
      x: 0,
      y: 0,
      angle: Math.PI / 2,
      path: [],
      bay: null,
      parkIdx: -1,
      work: null,
      boughtFor: 0,
      invested: 0,
      tip: 0,
      flash: 0,
      sellT: 0,
      sellerBy: null,
      done: false,
      notified: false,
      repaint: 0,
      bounce: 0,
      pop: 0,
    }
  }

  // ---- actions (called by UI / interaction) ----

  buyUnlock(id: string, ev: GameEvent[]): boolean {
    const def = this.unlockDef(id)
    if (!def || this.hasUnlock(id)) return false
    if (this.save.money < def.cost) {
      ev.push({ t: 'sfx', name: 'deny' })
      ev.push({ t: 'toast', text: `Need $${def.cost} for ${def.name}` })
      return false
    }
    if (def.cost >= 1000 && this.armedUnlock !== id) {
      this.armedUnlock = id
      this.armedT = 5
      ev.push({ t: 'sfx', name: 'click' })
      ev.push({ t: 'toast', text: `Press E again to confirm: ${def.name} — $${def.cost}` })
      return false
    }
    this.spend(def.cost)
    this.save.unlocks.push(id)
    this.builtAt[id] = this.time
    this.armedUnlock = null
    ev.push({ t: 'sfx', name: 'buy' })
    const pad = EXTRA_PADS.find((p) => p.unlockId === id)
    const stationEntry = (Object.keys(STATION_RECTS) as StationId[]).find((s) => STATIONS[s].unlock === id)
    const fx = pad ?? (stationEntry ? STATION_RECTS[stationEntry] : null)
    ev.push({ t: 'unlockFx', x: fx ? fx.cx : this.player.x, y: fx ? fx.cy : this.player.y })
    ev.push({ t: 'toast', text: id === 'wash1' ? '🧽 Bay open — first car incoming!' : `${def.icon} ${def.name} unlocked! ${def.desc}` })
    if (id === 'wash1') this.spawnT = Math.min(this.spawnT, 3)
    ev.push({ t: 'pulse' })
    this.checkObjectives(ev)
    return true
  }

  hire(role: WorkerRole, ev: GameEvent[]): boolean {
    const def = HIRES.find((h) => h.role === role)
    if (!def || this.save.hires.includes(role)) return false
    if (!this.spend(def.cost)) {
      ev.push({ t: 'sfx', name: 'deny' })
      ev.push({ t: 'toast', text: `Need $${def.cost} to hire ${def.name}` })
      return false
    }
    this.save.hires.push(role)
    this.spawnWorker(role, false)
    ev.push({ t: 'sfx', name: 'buy' })
    ev.push({ t: 'toast', text: `${def.icon} ${def.name} joined the crew!` })
    this.checkObjectives(ev)
    return true
  }

  buyOffer(idx: number, ev: GameEvent[]): boolean {
    const car = this.cars.find((c) => c.phase === 'offer' && c.parkIdx === idx)
    if (!car) return false
    const projects = this.cars.filter(
      (c) => c.owner === 'player' && (c.phase === 'queued' || c.phase === 'toBay' || c.phase === 'inBay'),
    ).length
    if (projects >= 3) {
      ev.push({ t: 'sfx', name: 'deny' })
      ev.push({ t: 'toast', text: '🅿️ Project garage full (3 max) — finish a restoration first!' })
      return false
    }
    const price = offerPrice(car.type, car.cond)
    if (!this.spend(price)) {
      ev.push({ t: 'sfx', name: 'deny' })
      ev.push({ t: 'toast', text: `Need $${price} to buy this ${car.type.name}` })
      return false
    }
    car.boughtFor = price
    car.invested = 0
    car.owner = 'player'
    car.done = false
    car.parkIdx = -1
    const free = this.freeParkIdx()
    if (free >= 0) {
      car.phase = 'queued'
      car.parkIdx = free
      const p = this.parkPos(free)
      car.path = [{ x: 23.5, y: 12.6 }, { x: 13.5, y: 13.1 }, { x: p.x, y: p.y }]
    } else {
      car.phase = 'queued'
      car.parkIdx = -2 // overflow: waits on the lot until a bay frees
      car.path = []
    }
    this.offerTimers[idx] = 30
    this.boughtCount++
    ev.push({ t: 'sfx', name: 'buy' })
    ev.push({ t: 'toast', text: `🏷️ ${car.type.name} bought — restore it` })
    this.checkObjectives(ev)
    return true
  }

  sellCar(car: Car, bySeller: boolean, ev: GameEvent[]): void {
    const inShowroom = car.phase === 'forSale' && car.parkIdx >= 100
    const price = carValue(car.type, car.cond, { showroom: inShowroom, seller: bySeller })
    const profit = price - car.boughtFor - car.invested
    this.save.money += price
    this.save.lifetime += price
    this.save.stats.flipped++
    this.save.stats.flipsProfit += profit
    car.phase = 'leaving'
    car.path = [{ x: STAGING.x, y: STAGING.y }, { x: ENTRANCE.x, y: ENTRANCE.y + 1 }]
    car.bay = null
    car.sellerBy = null
    ev.push({ t: 'sfx', name: 'sell' })
    ev.push({
      t: 'sold',
      title: car.type.name,
      price,
      bought: car.boughtFor,
      invested: car.invested,
      profit,
    })
    ev.push({ t: 'pulse' })
    this.checkObjectives(ev)
  }

  // ---- job routing ----

  private freeBayFor(service: ServiceKind): StationId | null {
    let best: StationId | null = null
    let bestSpeed = 0
    for (const id of Object.keys(STATIONS) as StationId[]) {
      const st = STATIONS[id]
      if (!this.stationUnlocked(id)) continue
      if (!st.services.includes(service)) continue
      const occupied = this.cars.some((c) => c.bay === id && (c.phase === 'toBay' || c.phase === 'inBay'))
      if (occupied) continue
      if (st.speed > bestSpeed) {
        bestSpeed = st.speed
        best = id
      }
    }
    return best
  }

  private assignBays(): void {
    for (const car of this.cars) {
      if (car.phase !== 'queued' || car.work) continue
      if (car.parkIdx === -2) {
        // overflow project: only move when a bay is actually free
      }
      const service = car.needs[0]
      if (!service) continue
      const bay = this.freeBayFor(service)
      if (!bay) continue
      const r = STATION_RECTS[bay]
      car.bay = bay
      car.phase = 'toBay'
      const laneX = car.x < r.cx ? r.cx - 3.4 : r.cx + 3.4
      car.path =
        car.x > 22 || car.parkIdx === -2
          ? [{ x: 23.5, y: 12.6 }, { x: laneX, y: 13.1 }, { x: r.cx, y: r.cy }]
          : [{ x: laneX, y: 13.1 }, { x: r.cx, y: r.cy }]
      if (car.parkIdx >= 0) car.parkIdx = -1
    }
  }

  private recomputeNeeds(car: Car): void {
    // Availability-aware: never schedule a service no unlocked station can do,
    // otherwise cars could wait forever (e.g. detail before the studio exists).
    const c = car.cond
    const out: ServiceKind[] = []
    if (c.clean < 92) out.push('wash')
    if (c.tires < 92) out.push('tires')
    if (c.mech < 92) out.push('engine')
    if (c.body < 92) out.push('body')
    const wantsPaint = car.wantPaint && c.shine < 92 && this.hasUnlock('paint')
    if (wantsPaint) out.push('paint')
    else if (c.shine < 92 && c.clean >= 60 && this.bayServes('detail')) out.push('detail')
    car.needs = out
  }

  private bayServes(service: ServiceKind): boolean {
    return (Object.keys(STATIONS) as StationId[]).some(
      (id) => this.stationUnlocked(id) && STATIONS[id].services.includes(service),
    )
  }

  private startWork(car: Car, service: ServiceKind, by: 'player' | number, ev: GameEvent[]): boolean {
    if (car.work || car.phase !== 'inBay') return false
    if (car.owner === 'player') {
      const parts = SERVICES[service].parts
      if (!this.spend(parts)) {
        if (by === 'player') {
          ev.push({ t: 'sfx', name: 'deny' })
          ev.push({ t: 'toast', text: `Need $${parts} for parts (${SERVICES[service].label})` })
        }
        return false
      }
      car.invested += parts
      this.save.spentParts += parts
    }
    car.work = { service, progress: 0, by }
    if (service === 'wash' || service === 'detail' || service === 'paint') ev.push({ t: 'washStart' })
    return true
  }

  private workRate(service: ServiceKind, station: StationId, who: 'player' | Worker): number {
    let speed = STATIONS[station].speed
    if (who === 'player') {
      if (service === 'wash' && this.hasUnlock('pressure')) speed *= 1.8
    } else {
      speed *= who.speed
    }
    return speed / SERVICES[service].duration
  }

  private completeService(car: Car, ev: GameEvent[]): void {
    const w = car.work
    if (!w) return
    const by = w.by
    car.work = null
    ev.push({ t: 'washStop' })
    const c = car.cond
    switch (w.service) {
      case 'wash': c.clean = 100; break
      case 'tires': c.tires = 100; break
      case 'engine': c.mech = 100; break
      case 'body': c.body = 100; break
      case 'detail': c.shine = 100; break
      case 'paint':
        c.shine = 100
        car.color = pick(car.type.palette)
        car.repaint++
        ev.push({ t: 'sfx', name: 'paint' })
        break
    }
    car.flash = 1
    car.pop = 1
    if (car.owner === 'customer') {
      let reward = SERVICES[w.service].reward + car.tip
      car.tip = 0
      if (by !== 'player' && this.hasUnlock('billboard')) reward = Math.round(reward * 1.1)
      if (w.service === 'wash') this.save.stats.washed++
      else this.save.stats.fixed++
      this.earn(reward, ev, car.x, car.y - 1, SERVICES[w.service].label)
      ev.push({ t: 'sfx', name: w.service === 'engine' ? 'engine' : 'done' })
    } else {
      ev.push({ t: 'floater', x: car.x, y: car.y - 1, text: SERVICES[w.service].icon, color: '#facc15' })
      ev.push({ t: 'sfx', name: w.service === 'engine' ? 'engine' : 'done' })
      if (w.service === 'wash') this.save.stats.washed++
      else this.save.stats.fixed++
    }
    this.recomputeNeeds(car)
    if (car.needs.length === 0) this.finishCar(car, ev)
    else if (car.phase === 'inBay') {
      // stay for next service if this bay covers it, else route on
      const st = car.bay ? STATIONS[car.bay] : null
      if (!st || !st.services.includes(car.needs[0])) {
        car.phase = 'queued'
        const free = this.freeParkIdx()
        car.bay = null
        if (free >= 0) {
          car.parkIdx = free
          const p = this.parkPos(free)
          car.path = [{ x: 10, y: 13.1 }, { x: p.x, y: p.y }]
        } else {
          car.parkIdx = -2
          car.path = []
        }
      }
    }
  }

  private finishCar(car: Car, ev: GameEvent[]): void {
    car.done = true
    if (car.owner === 'customer') {
      car.phase = 'leaving'
      car.path = [{ x: 13.5, y: 13.1 }, { x: STAGING.x, y: STAGING.y }, { x: ENTRANCE.x, y: ENTRANCE.y + 1 }]
      car.bay = null
      car.parkIdx = -1
      this.save.stats.served++
      ev.push({ t: 'floater', x: car.x, y: car.y - 1.2, text: '⭐', color: '#facc15' })
    } else {
      // owned: head to a sale slot
      const saleIdx = this.freeSaleIdx(false)
      const showIdx = this.hasUnlock('showroom') ? this.freeSaleIdx(true) : -1
      const useShow = showIdx >= 0 && (saleIdx < 0 || Math.random() < 0.6)
      if (useShow) {
        car.phase = 'toSale'
        car.parkIdx = 100 + showIdx
        const p = SHOWROOM_SLOTS[showIdx]
        car.path = [{ x: 13.5, y: 13.1 }, { x: 23.5, y: 12.6 }, { x: p.x, y: p.y }]
        car.bay = null
      } else if (saleIdx >= 0) {
        car.phase = 'toSale'
        car.parkIdx = saleIdx
        const p = SALE_PADS[saleIdx]
        car.path = [{ x: 13.5, y: 13.1 }, { x: 23.5, y: 12.6 }, { x: p.x, y: p.y }]
        car.bay = null
      } else {
        // sale full: wait in bay until a slot frees (retry is silent)
        car.phase = 'inBay'
      }
      if (!car.notified) {
        car.notified = true
        ev.push({ t: 'toast', text: `✨ ${car.type.name} restored — sell it!` })
      }
    }
  }

  private freeSaleIdx(showroom: boolean): number {
    const n = showroom ? SHOWROOM_SLOTS.length : SALE_PADS.length
    for (let i = 0; i < n; i++) {
      const key = showroom ? 100 + i : i
      const taken = this.cars.some(
        (c) => (c.phase === 'toSale' || c.phase === 'forSale') && c.parkIdx === key,
      )
      if (!taken) return i
    }
    return -1
  }

  // ---- objectives & tutorial ----

  private checkObjectives(ev: GameEvent[]): void {
    const s = this.save
    const cond: Record<string, boolean> = {
      washbay: s.unlocks.includes('wash1'),
      wash1: s.stats.washed >= 1,
      earn500: s.lifetime >= 500,
      hire1: s.hires.length >= 1,
      lift: s.unlocks.includes('lift'),
      flipbuy: this.boughtCount >= 1,
      flipsell: s.stats.flipped >= 1,
      showroom: s.unlocks.includes('showroom'),
      empire: s.lifetime >= 12000,
    }
    const list = objectives()
    for (let i = 0; i < list.length; i++) {
      const o = list[i]
      if (!s.doneObj.includes(o.id) && cond[o.id]) {
        s.doneObj.push(o.id)
        const bonus = 40 + i * 30
        s.money += bonus
        s.lifetime += bonus
        ev.push({ t: 'objective', text: `✅ ${o.text}`, bonus })
        ev.push({ t: 'sfx', name: 'done' })
      }
    }
  }

  currentObjective(): { icon: string; text: string } {
    const list = objectives()
    for (const o of list) if (!this.save.doneObj.includes(o.id)) return { icon: o.icon, text: o.text }
    return { icon: '👑', text: 'Empire!' }
  }

  /** Silent onboarding: retire the tutorial toasts, point at the next goal. */
  private tutorial(): void {
    if (this.save.tutorial < 4) this.save.tutorial = 4
  }

  /** Bouncing world marker for the current goal; null once the player is free. */
  guideTarget(): Guide | null {
    const s = this.save
    if (!this.hasUnlock('wash1')) {
      const w = STATION_RECTS.wash1
      return { x: w.cx, y: w.cy }
    }
    if (s.stats.washed < 1) {
      const car = this.cars.find((c) => c.phase === 'inBay' && c.needs.length > 0)
        ?? this.cars.find((c) => c.owner === 'customer')
      if (car) return { x: car.x, y: car.y }
      const w = STATION_RECTS.wash1
      return { x: w.cx, y: w.cy }
    }
    if (s.unlocks.length < 2) {
      const pad = this.cheapestLockedPad()
      if (pad) return { x: pad.x, y: pad.y }
    } else if (s.hires.length < 1 && s.money >= 300) {
      return { x: HIRE_BOARD.x, y: HIRE_BOARD.y }
    }
    return null
  }

  private cheapestLockedPad(): { x: number; y: number } | null {
    let best: { x: number; y: number; cost: number } | null = null
    const consider = (id: string, x: number, y: number) => {
      const def = this.unlockDef(id)
      if (!def || this.hasUnlock(id)) return
      if (!best || def.cost < best.cost) best = { x, y, cost: def.cost }
    }
    for (const sid of Object.keys(STATION_RECTS) as StationId[]) {
      const u = STATIONS[sid].unlock
      if (u) {
        const r = STATION_RECTS[sid]
        consider(u, r.cx, r.cy)
      }
    }
    for (const pd of EXTRA_PADS) consider(pd.unlockId, pd.cx, pd.cy)
    return best
  }

  // ---- interaction ----

  private computeInteract(): void {
    const p = this.player
    // 1. sell a restored car
    let best: Car | null = null
    let bestD = 2.4
    for (const c of this.cars) {
      if (c.phase !== 'forSale' || c.owner !== 'player') continue
      const d = dist(p.x, p.y, c.x, c.y)
      if (d < bestD) {
        bestD = d
        best = c
      }
    }
    if (best) {
      const inShow = best.parkIdx >= 100
      const price = carValue(best.type, best.cond, { showroom: inShow, seller: false })
      this.current = {
        kind: 'sell', icon: '💰', label: 'Sell', sub: `$${price} · +$${price - best.boughtFor - best.invested}`,
        carId: best.id, service: null, stationId: null, unlockId: null, offerIdx: -1,
        affordable: true, cost: 0, progress: 0,
      }
      return
    }
    // 2. inspect a used-lot offer
    if (this.hasUnlock('usedlot')) {
      for (const c of this.cars) {
        if (c.phase !== 'offer') continue
        if (dist(p.x, p.y, c.x, c.y) < 2.6) {
          const buy = offerPrice(c.type, c.cond)
          this.current = {
            kind: 'inspect', icon: '🔍', label: c.type.name, sub: `$${buy} → ~$${carValue(c.type, { clean: 100, mech: 100, body: 100, tires: 100, shine: 100 })}`,
            carId: c.id, service: null, stationId: null, unlockId: null, offerIdx: c.parkIdx,
            affordable: this.money >= buy, cost: buy, progress: 0,
          }
          return
        }
      }
    }
    // 3. hire board (appears once the first bay is owned)
    if (this.showPads() && dist(p.x, p.y, HIRE_BOARD.x, HIRE_BOARD.y) < 2.2) {
      this.current = {
        kind: 'hire', icon: '🧑‍🔧', label: 'Staff', sub: 'from $300',
        carId: -1, service: null, stationId: null, unlockId: null, offerIdx: -1,
        affordable: true, cost: 0, progress: 0,
      }
      return
    }
    // 4. work at an occupied bay (checked before purchase pads: the bays the
    // player actually uses sit wall-to-wall with locked ones, and the frequent
    // action must win ties)
    let wBest: Car | null = null
    let wStation: StationId | null = null
    let wService: ServiceKind | null = null
    let wD = Infinity
    for (const c of this.cars) {
      if (c.phase !== 'inBay' || !c.bay || c.done) continue
      const r = STATION_RECTS[c.bay]
      const d = distToRect(p.x, p.y, r)
      if (d > INTERACT_RADIUS) continue
      const svc = c.needs.find((s) => STATIONS[c.bay as StationId].services.includes(s))
      if (!svc) continue
      if (d < wD) {
        wD = d
        wBest = c
        wStation = c.bay
        wService = svc
      }
    }
    if (wBest && wStation && wService) {
      if (wBest.work && wBest.work.by !== 'player') {
        this.current = {
          kind: 'info', icon: '⏳', label: '', sub: '',
          carId: wBest.id, service: null, stationId: null, unlockId: null, offerIdx: -1,
          affordable: true, cost: 0, progress: wBest.work.progress,
        }
        return
      }
      const parts = wBest.owner === 'player' ? ` · $${SERVICES[wService].parts} parts` : ''
      const pay = wBest.owner === 'customer' ? `+$${SERVICES[wService].reward}` : ''
      this.current = {
        kind: 'work', icon: SERVICES[wService].icon, label: SERVICES[wService].label, sub: `${pay}${parts}`,
        carId: wBest.id, service: wService, stationId: wStation, unlockId: null, offerIdx: -1,
        affordable: true, cost: 0, progress: wBest.work ? wBest.work.progress : 0,
      }
      return
    }
    // 5. purchase pads (locked stations + extras). Before the first bay is
    // owned, only the wash bay itself is offered.
    const pads: { cx: number; cy: number; w: number; h: number; unlockId: string }[] = []
    const showAll = this.showPads()
    for (const id of Object.keys(STATION_RECTS) as StationId[]) {
      if (this.stationLockedPad(id) && (showAll || STATIONS[id].unlock === 'wash1')) {
        const s = STATION_RECTS[id]
        const u = STATIONS[id].unlock
        if (u) pads.push({ cx: s.cx, cy: s.cy, w: s.w, h: s.h, unlockId: u })
      }
    }
    for (const pd of this.pads()) {
      if (!showAll) continue
      pads.push({ cx: pd.cx, cy: pd.cy, w: pd.w, h: pd.h, unlockId: (pd as PadDef).unlockId })
    }
    let padBest: { unlockId: string } | null = null
    let padD = 2.2
    for (const pd of pads) {
      const d = distToRect(p.x, p.y, { x: pd.cx - pd.w / 2, y: pd.cy - pd.h / 2, w: pd.w, h: pd.h })
      if (d < padD) {
        padD = d
        padBest = pd
      }
    }
    if (padBest) {
      const def = this.unlockDef(padBest.unlockId)
      if (def) {
        this.current = {
          kind: 'buy', icon: def.icon, label: def.name, sub: `$${def.cost}`,
          carId: -1, service: null, stationId: null, unlockId: def.id, offerIdx: -1,
          affordable: this.money >= def.cost, cost: def.cost, progress: 0,
        }
        return
      }
    }
    this.current = null
  }

  // ---- per-frame ----

  update(dt: number, input: { x: number; y: number; actionHeld: boolean; actionPressed: boolean }): GameEvent[] {
    const ev: GameEvent[] = []
    this.time += dt
    // player movement with acceleration / deceleration for weight
    const k = Math.min(1, dt * 11)
    this.player.vx += (input.x * PLAYER_SPEED - this.player.vx) * k
    this.player.vy += (input.y * PLAYER_SPEED - this.player.vy) * k
    this.player.x += this.player.vx * dt
    this.player.y += this.player.vy * dt
    this.player.speed = Math.hypot(this.player.vx, this.player.vy)
    const moving = this.player.speed > 0.6
    if (moving) this.player.angle = Math.atan2(this.player.vy, this.player.vx)
    this.player.moving = moving
    // clamp + building collision (bigger roamable outskirts)
    this.player.x = Math.max(0.8, Math.min(39.2, this.player.x))
    this.player.y = Math.max(0.8, Math.min(29.2, this.player.y))
    this.collide(this.player, 0.42)

    // tutorial + objectives
    this.tutorial()

    // customer spawner (silent until the first wash bay is owned)
    this.spawnT -= dt
    if (this.spawnT <= 0) {
      const billboard = this.hasUnlock('billboard')
      this.spawnT = spawnInterval(this.save.lifetime, billboard) * rand(0.85, 1.15)
      const cap = this.parkingCount() + 4
      if (this.stationUnlocked('wash1') && this.activeCount() < cap && this.freeParkIdx() >= 0) {
        this.spawnCustomer(ev)
      }
    }

    // used-lot offers
    if (this.hasUnlock('usedlot')) {
      for (let i = 0; i < OFFER_PADS.length; i++) {
        const has = this.cars.some((c) => c.phase === 'offer' && c.parkIdx === i)
        if (has) continue
        this.offerTimers[i] -= dt
        if (this.offerTimers[i] <= 0) {
          const car = this.makeOfferCar()
          car.x = OFFER_PADS[i].x
          car.y = OFFER_PADS[i].y
          car.parkIdx = i
          this.cars.push(car)
        }
      }
    }

    // bay assignment tick
    this.assignT -= dt
    if (this.assignT <= 0) {
      this.assignT = 0.4
      this.assignBays()
      // owned cars waiting in a full bay with a free sale slot -> move out
      for (const car of this.cars) {
        if (car.phase === 'inBay' && car.done && car.owner === 'player') this.finishCar(car, ev)
      }
    }

    // cars driving
    for (const car of this.cars) {
      if (car.flash > 0) car.flash = Math.max(0, car.flash - dt * 1.4)
      if (car.bounce > 0) car.bounce = Math.max(0, car.bounce - dt * 2.2)
      if (car.pop > 0) car.pop = Math.max(0, car.pop - dt * 2.6)
      if (car.path.length > 0) {
        const t = car.path[0]
        const d = dist(car.x, car.y, t.x, t.y)
        const step = CAR_SPEED * dt
        const targetAngle = Math.atan2(t.y - car.y, t.x - car.x)
        let da = targetAngle - car.angle
        while (da > Math.PI) da -= Math.PI * 2
        while (da < -Math.PI) da += Math.PI * 2
        car.angle += da * Math.min(1, dt * 8)
        if (d <= step) {
          car.x = t.x
          car.y = t.y
          car.path.shift()
          if (car.path.length === 0) this.onArrive(car, ev)
        } else {
          car.x += (Math.cos(car.angle) * step * d) / Math.max(d, 0.001) + ((t.x - car.x) / d) * step * 0.4
          car.y += (Math.sin(car.angle) * step * d) / Math.max(d, 0.001) + ((t.y - car.y) / d) * step * 0.4
        }
      }
    }
    // remove departed
    this.cars = this.cars.filter((c) => !(c.phase === 'leaving' && c.path.length === 0))

    // workers
    this.updateWorkers(dt, ev)

    // seller auto-sell
    this.updateSeller(dt, ev)

    // interaction + player work
    this.computeInteract()
    const it = this.current
    if (it && input.actionPressed) {
      if (it.kind === 'buy' && it.unlockId) this.buyUnlock(it.unlockId, ev)
      else if (it.kind === 'hire') ev.push({ t: 'openHire' })
      else if (it.kind === 'inspect') ev.push({ t: 'openOffer', idx: it.offerIdx })
      else if (it.kind === 'sell') {
        const car = this.cars.find((c) => c.id === it.carId)
        if (car) this.sellCar(car, false, ev)
      }
    }
    let playerWorking = false
    if (it && it.kind === 'work' && input.actionHeld && it.service && it.stationId) {
      const car = this.cars.find((c) => c.id === it.carId)
      if (car && !car.work) {
        if (!this.startWork(car, it.service, 'player', ev)) {
          // couldn't start (parts) — stop here
        }
      }
      const target = this.cars.find((c) => c.id === it.carId)
      if (target && target.work && target.work.by === 'player') {
        target.work.progress += this.workRate(it.service, it.stationId, 'player') * dt
        it.progress = target.work.progress
        playerWorking = true
        if (Math.random() < dt * 6) ev.push({ t: 'sfx', name: 'wrench' })
        if (target.work.progress >= 1) this.completeService(target, ev)
      }
    }
    if (this.washing !== playerWorking) {
      // wash loop handled via events; worker wash loops are approximated with ticks
    }
    void playerWorking
    void this.washing

    if (this.armedUnlock) {
      this.armedT -= dt
      if (this.armedT <= 0) this.armedUnlock = null
    }

    // ambient wash audio: on while any player wash/detail in progress
    const washingNow = this.cars.some(
      (c) => c.work && c.work.by === 'player' && (c.work.service === 'wash' || c.work.service === 'detail' || c.work.service === 'paint'),
    )
    if (washingNow && !this.washing) {
      this.washing = true
      ev.push({ t: 'washStart' })
    } else if (!washingNow && this.washing) {
      this.washing = false
      ev.push({ t: 'washStop' })
    }

    return ev
  }

  private onArrive(car: Car, ev: GameEvent[]): void {
    void ev
    car.bounce = 1
    if (car.phase === 'arriving') car.phase = 'queued'
    else if (car.phase === 'toBay') {
      car.phase = 'inBay'
      this.recomputeNeeds(car)
      if (car.needs.length === 0) this.finishCar(car, [])
    } else if (car.phase === 'toSale') {
      car.phase = 'forSale'
    }
  }

  private updateWorkers(dt: number, ev: GameEvent[]): void {
    const defs = (role: WorkerRole) => HIRES.find((h) => h.role === role)
    this.workers.forEach((w, wi) => {
      w.bob += dt * 10
      if (w.role === 'seller') return // handled in updateSeller
      if (w.state === 'idle') {
        const def = defs(w.role)
        if (!def) return
        // find a job: car in bay needing one of my services at a compatible station
        let job: { car: Car; service: ServiceKind } | null = null
        for (const car of this.cars) {
          if (car.phase !== 'inBay' || !car.bay || car.work || car.done) continue
          const st = STATIONS[car.bay]
          const svc = car.needs.find((s) => st.services.includes(s) && def.services.includes(s))
          if (svc) {
            job = { car, service: svc }
            break
          }
        }
        if (job) {
          const st = STATION_RECTS[job.car.bay as StationId]
          w.carId = job.car.id
          w.service = job.service
          w.tx = st.wx + rand(-0.4, 0.4)
          w.ty = st.wy + rand(-0.2, 0.2)
          w.state = 'walk'
        }
      } else if (w.state === 'walk') {
        const d = dist(w.x, w.y, w.tx, w.ty)
        const step = 3.6 * dt
        if (d <= Math.max(step, 0.12)) {
          w.x = w.tx
          w.y = w.ty
          const car = this.cars.find((c) => c.id === w.carId)
          if (car && car.phase === 'inBay' && !car.work && w.service) {
            if (this.startWork(car, w.service, wi, ev)) {
              car.work = { service: w.service, progress: 0, by: wi }
              w.state = 'work'
              w.progress = 0
            } else {
              w.state = 'idle'
              w.carId = null
            }
          } else {
            w.state = 'idle'
            w.carId = null
          }
        } else {
          w.angle = Math.atan2(w.ty - w.y, w.tx - w.x)
          w.x += ((w.tx - w.x) / d) * step
          w.y += ((w.ty - w.y) / d) * step
        }
      } else if (w.state === 'work') {
        const car = this.cars.find((c) => c.id === w.carId)
        if (!car || !car.work || car.work.by !== wi || car.phase !== 'inBay') {
          w.state = 'idle'
          w.carId = null
          w.service = null
          return
        }
        const st = car.bay as StationId
        car.work.progress += this.workRate(w.service as ServiceKind, st, w) * dt
        w.progress = car.work.progress
        w.angle = Math.atan2(car.y - w.y, car.x - w.x)
        if (Math.random() < dt * 2.2) ev.push({ t: 'sfx', name: 'wrench' })
        if (car.work.progress >= 1) {
          this.completeService(car, ev)
          w.state = 'idle'
          w.carId = null
          w.service = null
        }
      }
    })
  }

  private updateSeller(dt: number, ev: GameEvent[]): void {
    const sellers = this.workers.filter((w) => w.role === 'seller')
    if (sellers.length === 0) return
    // assign idle sellers to forSale cars
    for (const w of sellers) {
      if (w.state === 'idle' || w.state === 'walk') {
        const target = this.cars.find(
          (c) => c.phase === 'forSale' && c.owner === 'player' && c.sellerBy === null,
        )
        if (target) {
          const idx = this.workers.indexOf(w)
          target.sellerBy = idx
          target.sellT = 0
          w.carId = target.id
          w.state = 'sellwalk'
        } else if (w.state === 'walk') {
          w.state = 'idle'
        }
      }
    }
    for (const w of sellers) {
      if (w.state === 'sellwalk' || w.state === 'selling') {
        const car = this.cars.find((c) => c.id === w.carId)
        if (!car || car.phase !== 'forSale') {
          w.state = 'idle'
          w.carId = null
          continue
        }
        const gx = car.x - 1
        const gy = car.y + 0.8
        if (w.state === 'sellwalk') {
          const d = dist(w.x, w.y, gx, gy)
          const step = 3.6 * dt
          if (d <= Math.max(step, 0.15)) {
            w.x = gx
            w.y = gy
            w.state = 'selling'
          } else {
            w.angle = Math.atan2(gy - w.y, gx - w.x)
            w.x += ((gx - w.x) / d) * step
            w.y += ((gy - w.y) / d) * step
          }
        } else {
          car.sellT += dt
          w.angle = Math.atan2(car.y - w.y, car.x - w.x)
          if (car.sellT >= 5) {
            w.state = 'idle'
            w.carId = null
            this.sellCar(car, true, ev)
          }
        }
      }
    }
  }

  private collide(p: { x: number; y: number }, r: number): void {
    // garage building + showroom counter + billboard + hire post + houses
    const solids = [
      { x: 3, y: 1.4, w: 6, h: 3.2 },
      { x: 23.4, y: 13.4, w: 5.6, h: 1.2 },
      { x: BILLBOARD.x - 1.3, y: BILLBOARD.y - 0.9, w: 2.6, h: 1.8 },
      { x: 5.6, y: 5.5, w: 0.8, h: 0.8 },
      ...HOUSES,
    ]
    for (const s of solids) {
      const cx = Math.max(s.x, Math.min(p.x, s.x + s.w))
      const cy = Math.max(s.y, Math.min(p.y, s.y + s.h))
      const dx = p.x - cx
      const dy = p.y - cy
      const d = Math.hypot(dx, dy)
      if (d < r) {
        if (d < 0.001) {
          p.y = s.y + s.h + r
        } else {
          p.x = cx + (dx / d) * r
          p.y = cy + (dy / d) * r
        }
      }
    }
    // cars are soft obstacles
    for (const c of this.cars) {
      if (c.phase === 'leaving' || c.phase === 'arriving') continue
      const dx = p.x - c.x
      const dy = p.y - c.y
      const d = Math.hypot(dx, dy)
      const min = 1.05
      if (d < min && d > 0.001) {
        p.x = c.x + (dx / d) * min
        p.y = c.y + (dy / d) * min
      }
    }
  }

  offerInfo(idx: number): { car: Car; buy: number; costs: number; sell: number; profit: number } | null {
    const car = this.cars.find((c) => c.phase === 'offer' && c.parkIdx === idx)
    if (!car) return null
    const price = offerPrice(car.type, car.cond)
    const costs = restoreCost(car.cond)
    const sell = carValue(car.type, { clean: 100, mech: 100, body: 100, tires: 100, shine: 100 }, { showroom: this.hasUnlock('showroom') })
    return { car, buy: price, costs, sell, profit: sell - price - costs }
  }

  avgValue(): number {
    const c = this.cars.filter((cc) => cc.owner === 'customer')
    if (c.length === 0) return 0
    return c.reduce((a, cc) => a + avgCond(cc.cond), 0) / c.length
  }
}
