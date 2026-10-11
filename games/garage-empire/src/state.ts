// Persistent progression: currency, unlocks, hires, records. Validated on load.

import { SAVE_KEY, START_MONEY } from './config'

export interface SaveData {
  v: 1
  money: number
  lifetime: number
  spentParts: number
  unlocks: string[]
  hires: string[]
  stats: { washed: number; fixed: number; flipped: number; flipsProfit: number; served: number }
  muted: boolean
  tutorial: number
  doneObj: string[]
  resetCount: number
}

export function freshSave(): SaveData {
  return {
    v: 1,
    money: START_MONEY,
    lifetime: 0,
    spentParts: 0,
    unlocks: [],
    hires: [],
    stats: { washed: 0, fixed: 0, flipped: 0, flipsProfit: 0, served: 0 },
    muted: false,
    tutorial: 0,
    doneObj: [],
    resetCount: 0,
  }
}

function valid(s: unknown): s is SaveData {
  if (!s || typeof s !== 'object') return false
  const d = s as Record<string, unknown>
  if (d.v !== 1) return false
  if (typeof d.money !== 'number' || !Number.isFinite(d.money)) return false
  if (typeof d.lifetime !== 'number' || !Number.isFinite(d.lifetime)) return false
  if (!Array.isArray(d.unlocks) || !Array.isArray(d.hires) || !Array.isArray(d.doneObj)) return false
  if (!d.stats || typeof d.stats !== 'object') return false
  return true
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return freshSave()
    const parsed: unknown = JSON.parse(raw)
    if (!valid(parsed)) return freshSave()
    const f = freshSave()
    return {
      ...f,
      ...parsed,
      money: Math.max(0, Math.min(9_999_999, Math.floor(parsed.money))),
      lifetime: Math.max(0, Math.min(99_999_999, Math.floor(parsed.lifetime))),
      unlocks: parsed.unlocks.filter((u): u is string => typeof u === 'string'),
      hires: parsed.hires.filter((h): h is string => typeof h === 'string'),
      doneObj: parsed.doneObj.filter((o): o is string => typeof o === 'string'),
      stats: { ...f.stats, ...parsed.stats },
    }
  } catch {
    return freshSave()
  }
}

export function storeSave(s: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s))
  } catch {
    // Storage unavailable (private mode, blocked): the game still plays.
  }
}
