// Static garage layout: tile coordinates (x east, y south, 1 tile = 1 unit).
// The map is 30 x 22. Lanes at y≈13 and x≈13.5 are kept clear for driving.

import type { StationId } from './config'

export const MAP_W = 40
export const MAP_H = 30

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface StationSlot extends Rect {
  id: StationId
  cx: number
  cy: number
  /** where the worker stands while servicing */
  wx: number
  wy: number
}

export const STATION_RECTS: Record<StationId, StationSlot> = {
  wash1: { id: 'wash1', x: 11, y: 2, w: 3, h: 3.4, cx: 12.5, cy: 3.7, wx: 12.5, wy: 6.2 },
  wash2: { id: 'wash2', x: 15.5, y: 2, w: 3, h: 3.4, cx: 17, cy: 3.7, wx: 17, wy: 6.2 },
  repair1: { id: 'repair1', x: 3, y: 8, w: 3, h: 3.4, cx: 4.5, cy: 9.7, wx: 4.5, wy: 12.2 },
  lift: { id: 'lift', x: 7, y: 8, w: 3, h: 3.4, cx: 8.5, cy: 9.7, wx: 8.5, wy: 12.2 },
  tire: { id: 'tire', x: 11, y: 8, w: 3, h: 3.4, cx: 12.5, cy: 9.7, wx: 12.5, wy: 12.2 },
  detail: { id: 'detail', x: 15, y: 8, w: 3, h: 3.4, cx: 16.5, cy: 9.7, wx: 16.5, wy: 12.2 },
  paint: { id: 'paint', x: 19.5, y: 8, w: 3.4, h: 3.4, cx: 21.2, cy: 9.7, wx: 21.2, wy: 12.2 },
}

export interface PadDef extends Rect {
  unlockId: string
  cx: number
  cy: number
}

function padOf(unlockId: string, r: Rect): PadDef {
  return { unlockId, ...r, cx: r.x + r.w / 2, cy: r.y + r.h / 2 }
}

/** Purchase pads for station unlocks. Non-station unlocks have their own spots. */
export function stationPads(): PadDef[] {
  return (Object.keys(STATION_RECTS) as StationId[])
    .filter((id) => STATION_RECTS[id])
    .map((id) => {
      const s = STATION_RECTS[id]
      return padOf('', { x: s.x, y: s.y, w: s.w, h: s.h })
    })
}

export const EXTRA_PADS: PadDef[] = [
  padOf('pressure', { x: 9.6, y: 2.4, w: 1.2, h: 2.4 }),
  padOf('parking', { x: 10.6, y: 14.2, w: 5.4, h: 2.2 }),
  padOf('usedlot', { x: 24, y: 2, w: 5, h: 5.6 }),
  padOf('billboard', { x: 18, y: 14.2, w: 2.6, h: 1.8 }),
  padOf('showroom', { x: 23.4, y: 13.4, w: 5.6, h: 4 }),
]

/** Customer + overflow parking slots (tile centers). */
export const PARKING_BASE: { x: number; y: number }[] = [
  { x: 3.4, y: 15.2 },
  { x: 5.9, y: 15.2 },
  { x: 8.4, y: 15.2 },
]
export const PARKING_EXTRA: { x: number; y: number }[] = [
  { x: 11.4, y: 15.2 },
  { x: 13.9, y: 15.2 },
]

export function parkingSlots(parkingUnlocked: boolean): { x: number; y: number }[] {
  return parkingUnlocked ? [...PARKING_BASE, ...PARKING_EXTRA] : PARKING_BASE
}

/** Used-lot offer display pads. */
export const OFFER_PADS: { x: number; y: number }[] = [
  { x: 25, y: 3.2 },
  { x: 25, y: 4.9 },
  { x: 25, y: 6.6 },
]

/** Small resale pads (part of the used-lot unlock). */
export const SALE_PADS: { x: number; y: number }[] = [
  { x: 25.2, y: 10.4 },
  { x: 27.2, y: 10.4 },
]

/** Premium showroom slots. */
export const SHOWROOM_SLOTS: { x: number; y: number }[] = [
  { x: 24.8, y: 15.6 },
  { x: 26.5, y: 15.6 },
  { x: 28.2, y: 15.6 },
]

export const HIRE_BOARD = { x: 10.5, y: 13.6 }
export const ENTRANCE = { x: 13.5, y: 21.4 }
export const STAGING = { x: 13.5, y: 18.2 }
export const LANE_Y = 13.1
export const PLAYER_SPAWN = { x: 12.5, y: 7.6 }

export const GARAGE_BUILDING: Rect = { x: 3, y: 1.4, w: 6, h: 3.4 }
export const OFFICE: Rect = { x: 3.4, y: 5.2, w: 2.2, h: 1.6 }

export interface DecoProp {
  kind: 'tree' | 'bush' | 'cone' | 'crate' | 'lamp' | 'bench' | 'tank' | 'tire' | 'plant' | 'house'
  x: number
  y: number
  s: number
}

/** Neighbor houses (solid) and the pond anchor on the outskirts. */
export const HOUSES: { x: number; y: number; w: number; h: number }[] = [
  { x: 35.6, y: 4.6, w: 2.0, h: 1.8 },
  { x: 36.1, y: 11.0, w: 2.0, h: 1.8 },
  { x: 31.2, y: 24.5, w: 2.0, h: 1.8 },
]
export const POND = { x: 22.5, y: 27.2, rx: 2.8, ry: 1.1 }

export const DECOR: DecoProp[] = [
  { kind: 'tree', x: 0.8, y: 2, s: 1 },
  { kind: 'tree', x: 29, y: 2, s: 1.2 },
  { kind: 'tree', x: 0.8, y: 18, s: 1.1 },
  { kind: 'tree', x: 29.2, y: 19, s: 1 },
  { kind: 'tree', x: 30.4, y: 8.2, s: 1 },
  { kind: 'tree', x: 33.2, y: 2.4, s: 1.1 },
  { kind: 'tree', x: 38.8, y: 7.6, s: 1.2 },
  { kind: 'tree', x: 33.8, y: 15.8, s: 1 },
  { kind: 'tree', x: 38.6, y: 19.4, s: 1.1 },
  { kind: 'tree', x: 30.2, y: 21.4, s: 1 },
  { kind: 'tree', x: 34.6, y: 24.8, s: 1.2 },
  { kind: 'tree', x: 38.8, y: 27.2, s: 1 },
  { kind: 'tree', x: 5, y: 23.6, s: 1.2 },
  { kind: 'tree', x: 11, y: 25.4, s: 1 },
  { kind: 'tree', x: 17.5, y: 24.2, s: 0.9 },
  { kind: 'tree', x: 27.6, y: 25.2, s: 1.1 },
  { kind: 'tree', x: 15, y: 28.4, s: 1 },
  { kind: 'tree', x: 8, y: 28.8, s: 1.1 },
  { kind: 'bush', x: 29.8, y: 6.8, s: 1 },
  { kind: 'bush', x: 34.4, y: 9.6, s: 1 },
  { kind: 'bush', x: 38.2, y: 14.6, s: 1 },
  { kind: 'bush', x: 31.4, y: 18.2, s: 1 },
  { kind: 'bush', x: 36.8, y: 22.4, s: 1 },
  { kind: 'bush', x: 2, y: 22.6, s: 1 },
  { kind: 'bush', x: 10.5, y: 24.4, s: 1 },
  { kind: 'bush', x: 19, y: 22.6, s: 1 },
  { kind: 'bush', x: 27.4, y: 22.6, s: 1 },
  { kind: 'bush', x: 13, y: 28.8, s: 1 },
  { kind: 'house', x: 35.6, y: 4.6, s: 1 },
  { kind: 'house', x: 36.1, y: 11.0, s: 1 },
  { kind: 'house', x: 31.2, y: 24.5, s: 1 },
  { kind: 'lamp', x: 10.4, y: 6.6, s: 1 },
  { kind: 'lamp', x: 19, y: 6.6, s: 1 },
  { kind: 'lamp', x: 6, y: 13.2, s: 1 },
  { kind: 'cone', x: 11.6, y: 18.6, s: 1 },
  { kind: 'cone', x: 15.4, y: 18.6, s: 1 },
  { kind: 'crate', x: 6.6, y: 5.4, s: 1 },
  { kind: 'bench', x: 19.5, y: 13.6, s: 1 },
  { kind: 'plant', x: 23, y: 6.4, s: 1 },
  { kind: 'plant', x: 9.6, y: 12.6, s: 1 },
]
