// Gameplay-loop smoke test: boots a game, washes the first car by holding E,
// buys upgrades, hires staff, flips a used car and checks the wallet math.
// Run with `npm test` (vitest, node environment with a localStorage stub).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { carValue, objectives } from './config'
import { Game, type GameEvent } from './sim'
import { freshSave, loadSave, storeSave } from './state'

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

const IDLE = { x: 0, y: 0, actionHeld: false, actionPressed: false }

function step(game: Game, n: number, input = IDLE): GameEvent[] {
  const out: GameEvent[] = []
  for (let i = 0; i < n; i++) out.push(...game.update(1 / 60, input))
  return out
}

/** Objective completion bonus for id, per the rule bonus = 40 + idx*30. */
function bonusFor(id: string): number {
  const idx = objectives().findIndex((o) => o.id === id)
  return 40 + idx * 30
}

beforeEach(() => {
  for (const k of Object.keys(mem)) delete mem[k]
})

describe('opening minute', () => {
  it('boots with one dirty car waiting in the wash bay', () => {
    const g = new Game(freshSave())
    expect(g.cars).toHaveLength(1)
    expect(g.cars[0].phase).toBe('inBay')
    expect(g.cars[0].needs).toContain('wash')
    expect(g.money).toBe(150)
  })

  it('washing the first car pays out and completes the objective', () => {
    const g = new Game(freshSave())
    g.player.x = 12.5
    g.player.y = 6.6
    const evs = step(g, 320, { ...IDLE, actionHeld: true })
    expect(g.save.stats.washed).toBe(1)
    // $60 wash reward + $40 first-objective bonus
    expect(g.money).toBe(150 + 60 + 40)
    expect(g.save.lifetime).toBe(60 + 40)
    expect(g.save.doneObj).toContain('wash1')
    expect(evs.some((e) => e.t === 'objective')).toBe(true)
  })

  it('player movement actually moves the player', () => {
    const g = new Game(freshSave())
    const x0 = g.player.x
    step(g, 60, { ...IDLE, x: 1, y: 0 })
    expect(g.player.x).toBeGreaterThan(x0)
  })
})

describe('progression purchases', () => {
  it('buys an upgrade once, deducts exactly once, unlocks the station', () => {
    const g = new Game(freshSave())
    g.save.money = 1000
    const evs: GameEvent[] = []
    expect(g.buyUnlock('wash2', evs)).toBe(true)
    // price + first-purchase objective bonus
    expect(g.money).toBe(1000 - 450 + bonusFor('buy1'))
    expect(g.save.unlocks).toContain('wash2')
    expect(g.save.doneObj).toContain('buy1')
    expect(g.stationUnlocked('wash2')).toBe(true)
    // second buy is rejected
    expect(g.buyUnlock('wash2', evs)).toBe(false)
    expect(g.money).toBe(1000 - 450 + 100)
  })

  it('rejects purchases it cannot afford without touching the wallet', () => {
    const g = new Game(freshSave())
    const evs: GameEvent[] = []
    expect(g.buyUnlock('wash2', evs)).toBe(false)
    expect(g.money).toBe(150)
    expect(evs.some((e) => e.t === 'toast')).toBe(true)
  })

  it('requires double-confirm for expensive unlocks', () => {
    const g = new Game(freshSave())
    g.save.money = 5000
    const evs: GameEvent[] = []
    expect(g.buyUnlock('paint', evs)).toBe(false) // arms
    expect(g.money).toBe(5000)
    expect(g.buyUnlock('paint', evs)).toBe(true) // confirms
    expect(g.money).toBe(5000 - 1600 + bonusFor('buy1'))
  })

  it('hires a washer who then completes a real wash job', () => {
    const g = new Game(freshSave())
    g.save.money = 2000
    const evs: GameEvent[] = []
    expect(g.hire('washer', evs)).toBe(true)
    expect(g.workers).toHaveLength(1)
    expect(g.money).toBe(2000 - 300 + bonusFor('hire1'))
    // let the washer walk over and wash the opening car
    step(g, 900)
    expect(g.save.stats.washed).toBe(1)
    expect(g.money).toBeGreaterThan(2000 - 300 + bonusFor('hire1'))
  })
})

describe('car flipping', () => {
  function richGame(): Game {
    const g = new Game(freshSave())
    g.save.money = 20000
    const evs: GameEvent[] = []
    g.buyUnlock('usedlot', evs) // armed first (cost>=1000)
    g.buyUnlock('usedlot', evs)
    expect(g.hasUnlock('usedlot')).toBe(true)
    step(g, 10)
    return g
  }

  it('stocks three offers after unlocking the lot', () => {
    const g = richGame()
    const offers = g.cars.filter((c) => c.phase === 'offer')
    expect(offers).toHaveLength(3)
    const info = g.offerInfo(0)
    expect(info).not.toBeNull()
    expect(info!.sell).toBeGreaterThan(info!.buy)
  })

  it('caps concurrent restoration projects at three', () => {
    const g = richGame()
    const evs: GameEvent[] = []
    // buy three projects (respawn offers instantly for the test)
    for (let n = 0; n < 3; n++) {
      const idx = [0, 1, 2].find((i) => g.offerInfo(i) !== null)
      if (idx === undefined) break
      expect(g.buyOffer(idx, evs)).toBe(true)
      g.offerTimers[idx] = 0
      step(g, 5)
    }
    const projects = g.cars.filter(
      (c) => c.owner === 'player' && (c.phase === 'queued' || c.phase === 'toBay' || c.phase === 'inBay'),
    ).length
    expect(projects).toBe(3)
    const idx = [0, 1, 2].find((i) => g.offerInfo(i) !== null)
    if (idx !== undefined) {
      const cash = g.money
      expect(g.buyOffer(idx, evs)).toBe(false)
      expect(g.money).toBe(cash)
      expect(evs.some((e) => e.t === 'toast')).toBe(true)
    }
  })

  it('buys, restores and sells exactly once with consistent profit', () => {
    const g = richGame()
    const before = g.money
    const info = g.offerInfo(0)!
    const evs: GameEvent[] = []
    expect(g.buyOffer(0, evs)).toBe(true)
    // + first-flip-purchase objective bonus
    expect(g.money).toBe(before - info.buy + bonusFor('flipbuy'))
    expect(g.save.doneObj).toContain('flipbuy')
    const car = g.cars.find((c) => c.boughtFor === info.buy)!
    expect(car.owner).toBe('player')

    // restore instantly, then sell (sale also completes flipsell + earn500)
    car.cond = { clean: 100, mech: 100, body: 100, tires: 100, shine: 100 }
    car.phase = 'forSale'
    car.parkIdx = 0
    const sellEvs: GameEvent[] = []
    const expected = carValue(car.type, car.cond, { showroom: false, seller: false })
    const atBuy = before - info.buy + bonusFor('flipbuy')
    g.sellCar(car, false, sellEvs)
    expect(g.money).toBe(atBuy + expected + bonusFor('flipsell') + bonusFor('earn500'))
    expect(g.save.doneObj).toContain('flipsell')
    expect(g.save.stats.flipped).toBe(1)
    const sold = sellEvs.find((e) => e.t === 'sold')
    expect(sold).toBeDefined()
    if (sold?.t === 'sold') {
      expect(sold.profit).toBe(sold.price - sold.bought - sold.invested)
      expect(g.save.stats.flipsProfit).toBe(sold.profit)
    }
    // car leaves and cannot be sold twice
    expect(car.phase).toBe('leaving')
    const afterDouble = g.money
    step(g, 60 * 30)
    expect(g.cars.includes(car)).toBe(false)
    expect(g.money).toBe(afterDouble)
  })
})

describe('persistence', () => {
  it('round-trips money, unlocks and hires through localStorage', () => {
    const g = new Game(freshSave())
    g.save.money = 1234
    g.save.unlocks.push('wash2')
    g.save.hires.push('washer')
    storeSave(g.save)
    const loaded = loadSave()
    expect(loaded.money).toBe(1234)
    expect(loaded.unlocks).toContain('wash2')
    expect(loaded.hires).toContain('washer')
    // a fresh game from the save keeps progression and stays playable
    const g2 = new Game(loaded)
    expect(g2.stationUnlocked('wash2')).toBe(true)
    expect(g2.workers).toHaveLength(1)
  })

  it('falls back to safe defaults on corrupt saves', () => {
    mem['garage-empire:save:v1'] = '{not json'
    expect(loadSave().money).toBe(150)
    mem['garage-empire:save:v1'] = JSON.stringify({ v: 999, money: -5 })
    expect(loadSave().money).toBe(150)
  })
})
