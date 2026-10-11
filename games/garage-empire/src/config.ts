// Garage Empire — balance data, types and pure economy functions.
// Everything here is deterministic and dependency-free so it can be unit-tested.

export type ServiceKind = 'wash' | 'tires' | 'engine' | 'body' | 'detail' | 'paint'

export interface ServiceDef {
  kind: ServiceKind
  label: string
  icon: string
  /** seconds of work at speed 1 */
  duration: number
  /** flat payout for customer cars */
  reward: number
  /** parts fee charged when restoring a player-owned car */
  parts: number
}

export const SERVICES: Record<ServiceKind, ServiceDef> = {
  wash: { kind: 'wash', label: 'Wash', icon: '🧽', duration: 4, reward: 60, parts: 10 },
  tires: { kind: 'tires', label: 'Tires', icon: '🛞', duration: 5, reward: 95, parts: 40 },
  engine: { kind: 'engine', label: 'Engine', icon: '🔧', duration: 6, reward: 140, parts: 80 },
  body: { kind: 'body', label: 'Bodywork', icon: '🔨', duration: 5.5, reward: 115, parts: 60 },
  detail: { kind: 'detail', label: 'Detail', icon: '✨', duration: 6, reward: 150, parts: 55 },
  paint: { kind: 'paint', label: 'Paint', icon: '🎨', duration: 7, reward: 170, parts: 70 },
}

export const SERVICE_LIST: ServiceKind[] = ['wash', 'tires', 'engine', 'body', 'detail', 'paint']

export type StationId =
  | 'wash1' | 'wash2' | 'repair1' | 'lift' | 'tire' | 'detail' | 'paint'

export interface StationDef {
  id: StationId
  name: string
  services: ServiceKind[]
  /** work-speed multiplier applied at this station */
  speed: number
  /** unlock id that grants this station, or null when available from the start */
  unlock: string | null
  color: string
}

export const STATIONS: Record<StationId, StationDef> = {
  wash1: { id: 'wash1', name: 'Wash Bay', services: ['wash'], speed: 1, unlock: null, color: '#38bdf8' },
  wash2: { id: 'wash2', name: 'Wash Bay II', services: ['wash'], speed: 1.15, unlock: 'wash2', color: '#38bdf8' },
  repair1: { id: 'repair1', name: 'Repair Bench', services: ['tires', 'engine', 'body'], speed: 1, unlock: 'repair1', color: '#fb923c' },
  lift: { id: 'lift', name: 'Hydraulic Lift', services: ['engine', 'body'], speed: 1.35, unlock: 'lift', color: '#f472b6' },
  tire: { id: 'tire', name: 'Tire Station', services: ['tires'], speed: 1.6, unlock: 'tire', color: '#a78bfa' },
  detail: { id: 'detail', name: 'Detail Studio', services: ['detail'], speed: 1.2, unlock: 'detail', color: '#2dd4bf' },
  paint: { id: 'paint', name: 'Paint Booth', services: ['paint', 'body'], speed: 1.25, unlock: 'paint', color: '#facc15' },
}

export interface UnlockDef {
  id: string
  name: string
  cost: number
  desc: string
  icon: string
  stage: number
}

export const UNLOCKS: UnlockDef[] = [
  { id: 'repair1', name: 'Repair Bench', cost: 250, desc: 'Fix tires, engines, bodywork', icon: '🧰', stage: 1 },
  { id: 'pressure', name: 'Pro Pressure Kit', cost: 350, desc: 'Wash 80% faster everywhere', icon: '💦', stage: 1 },
  { id: 'wash2', name: 'Second Wash Bay', cost: 450, desc: '+1 wash bay, washes 15% faster', icon: '🧼', stage: 2 },
  { id: 'parking', name: 'Extra Parking', cost: 500, desc: '+2 customer parking slots', icon: '🅿️', stage: 2 },
  { id: 'lift', name: 'Hydraulic Lift', cost: 650, desc: 'Fast engine + bodywork jobs', icon: '🏗️', stage: 2 },
  { id: 'tire', name: 'Tire Station', cost: 850, desc: 'Fast tire swaps', icon: '🛞', stage: 3 },
  { id: 'detail', name: 'Detail Studio', cost: 950, desc: 'Unlocks premium detailing', icon: '✨', stage: 3 },
  { id: 'usedlot', name: 'Used-Car Lot', cost: 1250, desc: 'Buy cheap cars to restore & flip', icon: '🏷️', stage: 4 },
  { id: 'paint', name: 'Paint Booth', cost: 1600, desc: 'Repaint jobs + fast bodywork', icon: '🎨', stage: 4 },
  { id: 'billboard', name: 'Billboard Ads', cost: 1800, desc: 'Customers come 40% faster, +tips', icon: '📣', stage: 5 },
  { id: 'showroom', name: 'Premium Showroom', cost: 2100, desc: '+3 sale slots, +15% sale prices', icon: '🏆', stage: 5 },
]

export type WorkerRole = 'washer' | 'mechanic' | 'detailer' | 'seller'

export interface HireDef {
  role: WorkerRole
  name: string
  cost: number
  desc: string
  icon: string
  services: ServiceKind[]
  speed: number
}

export const HIRES: HireDef[] = [
  { role: 'washer', name: 'Hire Washer', cost: 300, desc: 'Auto-washes cars at wash bays', icon: '🧑‍🔧', services: ['wash'], speed: 0.7 },
  { role: 'mechanic', name: 'Hire Mechanic', cost: 550, desc: 'Auto-repairs tires, engines, body', icon: '👨‍🔧', services: ['tires', 'engine', 'body'], speed: 0.7 },
  { role: 'detailer', name: 'Hire Detailer', cost: 750, desc: 'Auto-details and repaints', icon: '🧑‍🎨', services: ['detail', 'paint'], speed: 0.7 },
  { role: 'seller', name: 'Hire Salesperson', cost: 800, desc: 'Auto-sells showroom cars +10%', icon: '🧑‍💼', services: [], speed: 1 },
]

export interface CarType {
  id: string
  name: string
  base: number
  length: number
  width: number
  palette: string[]
}

export const CAR_TYPES: CarType[] = [
  { id: 'compact', name: 'Compact', base: 1400, length: 1.7, width: 0.85, palette: ['#60a5fa', '#f87171', '#fbbf24'] },
  { id: 'sedan', name: 'Sedan', base: 2200, length: 1.9, width: 0.9, palette: ['#34d399', '#818cf8', '#e5e7eb'] },
  { id: 'hatch', name: 'Hatchback', base: 1800, length: 1.75, width: 0.88, palette: ['#fb923c', '#22d3ee', '#f472b6'] },
  { id: 'suv', name: 'SUV', base: 3200, length: 2.05, width: 1.0, palette: ['#4ade80', '#f87171', '#94a3b8'] },
  { id: 'van', name: 'Van', base: 2800, length: 2.15, width: 1.0, palette: ['#e5e7eb', '#60a5fa', '#fbbf24'] },
  { id: 'sport', name: 'Sportster', base: 5200, length: 1.9, width: 0.92, palette: ['#ef4444', '#facc15', '#22d3ee'] },
]

export interface Conditions {
  clean: number
  mech: number
  body: number
  tires: number
  shine: number
}

export const PERFECT: Conditions = { clean: 100, mech: 100, body: 100, tires: 100, shine: 100 }

export function avgCond(c: Conditions): number {
  return (c.clean + c.mech + c.body + c.tires + c.shine) / 5
}

/** Which services does a car still need? (threshold < 92 counts as needed) */
export function neededServices(c: Conditions): ServiceKind[] {
  const out: ServiceKind[] = []
  if (c.clean < 92) out.push('wash')
  if (c.tires < 92) out.push('tires')
  if (c.mech < 92) out.push('engine')
  if (c.body < 92) out.push('body')
  if (c.shine < 92 && c.clean >= 60) out.push('detail')
  return out
}

/** Market value of a car in its current condition. */
export function carValue(type: CarType, c: Conditions, opts?: { showroom?: boolean; seller?: boolean }): number {
  const q = avgCond(c) / 100
  let v = type.base * (0.35 + 0.75 * q)
  if (opts?.showroom) v *= 1.15
  if (opts?.seller) v *= 1.1
  return Math.round(v / 5) * 5
}

/** What a used-lot offer costs. Always below restored value so flips can profit. */
export function offerPrice(type: CarType, c: Conditions): number {
  const restored = carValue(type, PERFECT)
  const now = carValue(type, c)
  const price = now * 0.62 + restored * 0.12
  return Math.max(250, Math.round(price / 10) * 10)
}

/** Restoration cost estimate: parts for every needed service. */
export function restoreCost(c: Conditions): number {
  let total = 0
  for (const s of neededServices(c)) total += SERVICES[s].parts
  // paint is the premium finish; include it when the body is rough
  if (c.body < 55) total += SERVICES.paint.parts
  return total
}

export function estimateFlip(type: CarType, c: Conditions, opts?: { showroom?: boolean; seller?: boolean }): {
  buy: number
  costs: number
  sell: number
  profit: number
} {
  const buy = offerPrice(type, c)
  const costs = restoreCost(c)
  const sell = carValue(type, PERFECT, opts)
  return { buy, costs, sell, profit: sell - buy - costs }
}

export interface LevelDef {
  at: number
  name: string
}

export const LEVELS: LevelDef[] = [
  { at: 0, name: 'Backyard Garage' },
  { at: 500, name: 'Neighborhood Wash' },
  { at: 1500, name: 'Busy Workshop' },
  { at: 3500, name: 'Auto Center' },
  { at: 7000, name: 'Flip House' },
  { at: 12000, name: 'Car Palace' },
  { at: 20000, name: 'Automotive Empire' },
]

export function levelFor(lifetime: number): number {
  let lvl = 0
  for (let i = 0; i < LEVELS.length; i++) if (lifetime >= LEVELS[i].at) lvl = i
  return lvl
}

/** Seconds between customer arrivals (before billboard modifier). */
export const SPAWN_BASE = 26
export const SPAWN_MIN = 9
/** Arrival interval shrinks slightly as lifetime earnings grow. */
export function spawnInterval(lifetime: number, billboard: boolean): number {
  const t = Math.max(SPAWN_MIN, SPAWN_BASE - lifetime / 900)
  return billboard ? t * 0.6 : t
}

export const PLAYER_SPEED = 5.4
export const CAR_SPEED = 3.4
export const INTERACT_RADIUS = 1.7
export const TIP_CHANCE = 0.35

export const START_MONEY = 150
export const SAVE_KEY = 'garage-empire:save:v1'

/** Ordered onboarding goals: icon + micro-label, never a sentence. */
export function objectives(): { id: string; icon: string; text: string }[] {
  return [
    { id: 'wash1', icon: '🧽', text: 'First wash' },
    { id: 'earn500', icon: '💰', text: '$500' },
    { id: 'buy1', icon: '🪧', text: '1 sign' },
    { id: 'hire1', icon: '🧑‍🔧', text: 'Hire' },
    { id: 'lift', icon: '🏗️', text: 'Lift' },
    { id: 'flipbuy', icon: '🏷️', text: 'Buy car' },
    { id: 'flipsell', icon: '💰', text: 'Sell car' },
    { id: 'showroom', icon: '🏆', text: 'Showroom' },
    { id: 'empire', icon: '👑', text: '$12k' },
  ]
}
