import { describe, expect, it } from 'vitest'
import { EVENTS } from './events'
import {
  MIN_GAP,
  PUZZLE_SIZE,
  addDays,
  evaluate,
  eventsById,
  generatePuzzle,
  giveUp,
  grantExtraAttempt,
  isLocked,
  newGame,
  nudge,
  puzzleNumber,
  revealHint,
  submit,
  swap,
  type GameState,
} from './puzzle'
import { shareText } from './share'
import { emptyStats, liveStreak, recordResult } from './stats'

function solve(state: GameState): GameState {
  const sorted = eventsById(state.order)
    .sort((a, b) => a.year - b.year)
    .map((e) => e.id)
  return { ...state, order: sorted }
}

describe('events', () => {
  it('have unique ids', () => {
    expect(new Set(EVENTS.map((e) => e.id)).size).toBe(EVENTS.length)
  })
})

describe('generatePuzzle', () => {
  it('is deterministic for a seed', () => {
    expect(generatePuzzle(42).map((e) => e.id)).toEqual(generatePuzzle(42).map((e) => e.id))
    expect(generatePuzzle(42).map((e) => e.id)).not.toEqual(generatePuzzle(43).map((e) => e.id))
  })

  it('picks well spaced events that start mostly out of place', () => {
    for (let seed = 0; seed < 2000; seed++) {
      const events = generatePuzzle(seed)
      expect(events).toHaveLength(PUZZLE_SIZE)
      const years = events.map((e) => e.year).sort((a, b) => a - b)
      for (let i = 1; i < years.length; i++) expect(years[i] - years[i - 1]).toBeGreaterThanOrEqual(MIN_GAP)
      expect(evaluate(events).filter((m) => m === 'correct').length).toBeLessThanOrEqual(1)
    }
  })
})

describe('evaluate', () => {
  it('says which way each misplaced card has to move', () => {
    const [a, b, c] = [EVENTS[0], EVENTS[50], EVENTS[100]]
    expect(evaluate([b, a, c])).toEqual(['later', 'earlier', 'correct'])
  })
})

describe('dates', () => {
  it('numbers puzzles from launch day', () => {
    expect(puzzleNumber('2026-10-08')).toBe(1)
    expect(puzzleNumber('2026-10-09')).toBe(2)
    expect(puzzleNumber('2027-10-08')).toBe(366)
  })

  it('adds days across month ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
  })
})

describe('game flow', () => {
  it('wins when the order is right', () => {
    const won = submit(solve(newGame('daily', '2026-10-08')))
    expect(won.status).toBe('won')
    expect(won.attempts).toHaveLength(1)
  })

  it('locks correct cards so they cannot be swapped', () => {
    let g = newGame('daily', '2026-10-10')
    g = submit(g)
    const locked = g.order.findIndex((_, i) => isLocked(g, i))
    if (locked >= 0) {
      const other = locked === 0 ? 1 : 0
      expect(swap(g, locked, other)).toBe(g)
    }
  })

  it('nudges hop over locked cards', () => {
    const base = solve(newGame('practice', 'abc'))
    // Lock the middle card only, then move the card above it down.
    let g: GameState = { ...base, attempts: [['earlier', 'later', 'correct', 'earlier', 'later']], lastOrder: base.order }
    g = nudge(g, 1, 1)
    expect(g.order[2]).toBe(base.order[2])
    expect(g.order[3]).toBe(base.order[1])
  })

  it('offers an extra try once, then loses', () => {
    let g = newGame('daily', '2026-10-11')
    for (let i = 0; i < 4; i++) g = submit(g)
    expect(g.status).toBe('out')
    g = grantExtraAttempt(g)
    expect(g.status).toBe('playing')
    g = submit(g)
    expect(g.status).toBe('lost')
    expect(giveUp(newGame('daily', '2026-10-11'))).toEqual(newGame('daily', '2026-10-11'))
  })

  it('reveals hints on unlocked cards only', () => {
    const g = revealHint(newGame('daily', '2026-10-12'), () => 0)
    expect(g.hinted).toHaveLength(1)
    expect(g.order).toContain(g.hinted[0])
  })
})

describe('stats', () => {
  it('builds streaks on consecutive wins and resets on a loss', () => {
    const win = (key: string) => submit(solve(newGame('daily', key)))
    let s = recordResult(emptyStats(), win('2026-10-08'))
    s = recordResult(s, win('2026-10-09'))
    expect(s.streak).toBe(2)
    expect(recordResult(s, win('2026-10-09'))).toBe(s)
    expect(liveStreak(s, '2026-10-10')).toBe(2)
    expect(liveStreak(s, '2026-10-11')).toBe(0)
    const loss: GameState = { ...newGame('daily', '2026-10-10'), status: 'lost', attempts: [[], [], [], []] }
    s = recordResult(s, loss)
    expect(s.streak).toBe(0)
    expect(s.maxStreak).toBe(2)
    expect(s.played).toBe(3)
  })
})

describe('shareText', () => {
  it('shows the score and grid without revealing events', () => {
    const g = submit(solve(submit(newGame('daily', '2026-10-09'))))
    const text = shareText(g, 'https://example.com', 3)
    expect(text.split('\n')[0]).toBe('Chronodle #2 2/4 🔥3')
    expect(text).toContain('🟩🟩🟩🟩🟩')
    for (const e of eventsById(g.order)) expect(text).not.toContain(e.text)
  })
})
