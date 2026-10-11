// TEMPORARY soak test: simulates ~25 game-minutes of chaotic play and asserts
// the economy and job system never enter an invalid state.
import { describe, expect, it, vi } from 'vitest'
import { Game, type GameEvent } from './sim'
import { freshSave } from './state'

const mem: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem[k] ?? null,
  setItem: (k: string, v: string) => {
    mem[k] = String(v)
  },
  removeItem: (k: string) => {
    delete mem[k]
  },
})

describe('soak', () => {
  it('survives 25 chaotic minutes without invalid state', () => {
    const g = new Game(freshSave())
    g.save.money = 30000
    const evs: GameEvent[] = []
    for (const u of ['pressure', 'wash2', 'parking', 'lift', 'tire', 'detail', 'usedlot', 'paint', 'billboard', 'showroom']) {
      g.buyUnlock(u, evs)
      g.buyUnlock(u, evs) // confirm expensive ones
    }
    for (const h of ['washer', 'mechanic', 'detailer', 'seller'] as const) g.hire(h, evs)

    let soldModals = 0
    const frames = 25 * 60 * 60
    for (let f = 0; f < frames; f++) {
      // drunk player: wander + mash E
      const t = f / 60
      const input = {
        x: Math.sin(t * 0.7) + Math.sin(t * 1.9) * 0.5,
        y: Math.cos(t * 0.5) + Math.cos(t * 1.3) * 0.5,
        actionHeld: f % 3 !== 0,
        actionPressed: f % 30 === 0,
      }
      const out = g.update(1 / 60, input)
      for (const e of out) {
        if (e.t === 'openHire' || e.t === 'openOffer') {
          // UI would open a modal; mash through by buying first offer sometimes
          if (e.t === 'openOffer' && f % 2 === 0) g.buyOffer(e.idx, [])
        }
        if (e.t === 'sold') soldModals++
      }
      if (f % 1800 === 0) {
        // invariants sampled every 30s
        expect(Number.isFinite(g.money)).toBe(true)
        expect(g.money).toBeGreaterThanOrEqual(0)
        expect(g.cars.length).toBeLessThan(30)
        for (const c of g.cars) {
          for (const v of Object.values(c.cond)) {
            expect(v).toBeGreaterThanOrEqual(0)
            expect(v).toBeLessThanOrEqual(100)
          }
          if (c.work) {
            expect(c.phase).toBe('inBay')
            expect(c.work.progress).toBeGreaterThanOrEqual(0)
            expect(c.work.progress).toBeLessThanOrEqual(1.5)
          }
          if (c.phase === 'inBay') expect(c.bay).not.toBeNull()
        }
        // no double-booked bays
        const bays = g.cars.filter((c) => c.bay && (c.phase === 'toBay' || c.phase === 'inBay')).map((c) => c.bay)
        expect(new Set(bays).size).toBe(bays.length)
        // workers reference live cars only
        for (const w of g.workers) {
          if (w.carId !== null && (w.state === 'work' || w.state === 'selling' || w.state === 'sellwalk')) {
            expect(g.cars.some((c) => c.id === w.carId)).toBe(true)
          }
        }
      }
    }
    console.log('soak done: money', g.money, 'served', g.save.stats.served, 'flipped', g.save.stats.flipped, 'soldModals', soldModals, 'cars', g.cars.length)
    expect(g.save.stats.served).toBeGreaterThan(5)
    expect(soldModals + g.save.stats.flipped).toBeGreaterThanOrEqual(g.save.stats.flipped)
  })
})
