// Economy invariants: the numbers the HUD promises must be the numbers the
// wallet actually sees. Run with `npm test` (vitest).
import { describe, expect, it } from 'vitest'
import {
  CAR_TYPES,
  LEVELS,
  PERFECT,
  SERVICES,
  carValue,
  estimateFlip,
  levelFor,
  neededServices,
  offerPrice,
  restoreCost,
  spawnInterval,
  type Conditions,
} from './config'

const ROUGH: Conditions = { clean: 15, mech: 35, body: 40, tires: 30, shine: 20 }

describe('carValue', () => {
  it('rises monotonically with condition', () => {
    for (const t of CAR_TYPES) {
      expect(carValue(t, PERFECT)).toBeGreaterThan(carValue(t, ROUGH))
    }
  })
  it('applies showroom and seller bonuses multiplicatively', () => {
    const t = CAR_TYPES[1]
    const base = carValue(t, PERFECT)
    expect(carValue(t, PERFECT, { showroom: true })).toBeGreaterThan(base)
    expect(carValue(t, PERFECT, { seller: true })).toBeGreaterThan(base)
    expect(carValue(t, PERFECT, { showroom: true, seller: true })).toBeGreaterThan(
      carValue(t, PERFECT, { showroom: true }),
    )
  })
  it('rounds to $5 and never goes negative', () => {
    const zero: Conditions = { clean: 0, mech: 0, body: 0, tires: 0, shine: 0 }
    for (const t of CAR_TYPES) {
      const v = carValue(t, zero)
      expect(v).toBeGreaterThan(0)
      expect(v % 5).toBe(0)
    }
  })
})

describe('flip math', () => {
  it('offers leave room for profit after a full restoration', () => {
    for (const t of CAR_TYPES) {
      const restored = carValue(t, PERFECT)
      const buy = offerPrice(t, ROUGH)
      expect(buy).toBeLessThan(restored)
      expect(buy).toBeGreaterThanOrEqual(250)
    }
  })
  it('estimateFlip is internally consistent (profit = sell - buy - costs)', () => {
    for (const t of CAR_TYPES) {
      const e = estimateFlip(t, ROUGH)
      expect(e.profit).toBe(e.sell - e.buy - e.costs)
      expect(e.costs).toBe(restoreCost(ROUGH))
    }
  })
  it('restoration costs equal the parts of needed services', () => {
    const needs = neededServices(ROUGH)
    let sum = 0
    for (const s of needs) sum += SERVICES[s].parts
    if (ROUGH.body < 55) sum += SERVICES.paint.parts
    expect(restoreCost(ROUGH)).toBe(sum)
  })
})

describe('neededServices', () => {
  it('is empty for a perfect car and complete for a wreck', () => {
    expect(neededServices(PERFECT)).toEqual([])
    const wreck: Conditions = { clean: 0, mech: 0, body: 0, tires: 0, shine: 0 }
    // shine needs clean>=60 first, so a filthy wreck skips detail until washed
    expect(neededServices(wreck)).toEqual(['wash', 'tires', 'engine', 'body'])
  })
  it('asks for detail only once the car is mostly clean', () => {
    const c: Conditions = { ...PERFECT, shine: 10, clean: 90 }
    expect(neededServices(c)).toContain('detail')
    const dirty: Conditions = { ...c, clean: 10 }
    expect(neededServices(dirty)).not.toContain('detail')
  })
})

describe('progression', () => {
  it('level thresholds are ascending and levelFor matches', () => {
    for (let i = 1; i < LEVELS.length; i++) expect(LEVELS[i].at).toBeGreaterThan(LEVELS[i - 1].at)
    expect(levelFor(0)).toBe(0)
    expect(levelFor(499)).toBe(0)
    expect(levelFor(500)).toBe(1)
    expect(levelFor(999_999)).toBe(LEVELS.length - 1)
  })
  it('spawn interval shrinks with revenue and billboard speeds it up', () => {
    const early = spawnInterval(0, false)
    const late = spawnInterval(20000, false)
    expect(late).toBeLessThan(early)
    expect(spawnInterval(5000, true)).toBeLessThan(spawnInterval(5000, false))
    expect(spawnInterval(10 ** 9, false)).toBeGreaterThanOrEqual(9)
  })
})
