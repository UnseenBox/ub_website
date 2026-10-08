import { EVENTS, type HistEvent } from './events'
import { hashString, mulberry32, shuffle } from './rng'

export const PUZZLE_SIZE = 5
export const BASE_ATTEMPTS = 4
/** Events in one puzzle are at least this many years apart, so no pair is a coin flip. */
export const MIN_GAP = 3
/** Puzzle #1. Changing it renumbers every share. */
export const LAUNCH_KEY = '2026-10-08'

/** Where a card has to move after a submit: it is right, or belongs higher (earlier) or lower (later). */
export type Mark = 'correct' | 'earlier' | 'later'
export type Mode = 'daily' | 'practice'
export type Status = 'playing' | 'out' | 'won' | 'lost'

export interface GameState {
  mode: Mode
  /** Date key for daily (YYYY-MM-DD), seed for practice. */
  key: string
  /** Current order of event ids, top (oldest) to bottom (newest). */
  order: string[]
  /** One row of marks per submitted attempt. */
  attempts: Mark[][]
  /** The order as last submitted, so marks only show on cards that have not moved since. */
  lastOrder?: string[]
  /** Ids whose year was revealed by a hint. */
  hinted: string[]
  /** A rewarded ad bought one more attempt. */
  extraAttempt: boolean
  status: Status
}

/** Local calendar date, so the puzzle flips at the player's midnight. */
export function dateKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function keyToUtc(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function addDays(key: string, days: number): string {
  const d = new Date(keyToUtc(key) + days * 86_400_000)
  return d.toISOString().slice(0, 10)
}

export function puzzleNumber(key: string): number {
  return Math.round((keyToUtc(key) - keyToUtc(LAUNCH_KEY)) / 86_400_000) + 1
}

export function seedFor(mode: Mode, key: string): number {
  return hashString(`${mode}:${key}`)
}

export function randomPracticeSeed(): string {
  return Math.floor(Math.random() * 2 ** 32).toString(36)
}

function sortedByYear(events: readonly HistEvent[]): HistEvent[] {
  return events.slice().sort((a, b) => a.year - b.year)
}

/**
 * Picks the puzzle's events and the scrambled order they start in. The same seed
 * always gives the same puzzle, which is what makes daily puzzles and challenge
 * links work without a server.
 */
export function generatePuzzle(seed: number, pool: readonly HistEvent[] = EVENTS): HistEvent[] {
  const rand = mulberry32(seed)
  const picked: HistEvent[] = []
  for (const e of shuffle(pool, rand)) {
    if (picked.every((p) => Math.abs(p.year - e.year) >= MIN_GAP)) picked.push(e)
    if (picked.length === PUZZLE_SIZE) break
  }
  if (picked.length < PUZZLE_SIZE) throw new Error('Event pool too small for a puzzle')

  // Start with at most one card already in place so there is always work to do.
  let order = picked
  for (let i = 0; i < 50 && countCorrect(order) > 1; i++) order = shuffle(picked, rand)
  if (countCorrect(order) > 1) order = picked.slice().reverse()
  return order
}

function countCorrect(order: readonly HistEvent[]): number {
  return evaluate(order).filter((m) => m === 'correct').length
}

export function evaluate(order: readonly HistEvent[]): Mark[] {
  const sorted = sortedByYear(order)
  return order.map((e, i) => {
    const target = sorted.findIndex((s) => s.id === e.id)
    if (target === i) return 'correct'
    return target < i ? 'earlier' : 'later'
  })
}

export function maxAttempts(state: GameState): number {
  return BASE_ATTEMPTS + (state.extraAttempt ? 1 : 0)
}

export function lastMarks(state: GameState): Mark[] | undefined {
  return state.attempts[state.attempts.length - 1]
}

/** Cards confirmed correct by the last submit stay put. */
export function isLocked(state: GameState, index: number): boolean {
  return lastMarks(state)?.[index] === 'correct'
}

export function newGame(mode: Mode, key: string): GameState {
  const events = generatePuzzle(seedFor(mode, key))
  return { mode, key, order: events.map((e) => e.id), attempts: [], hinted: [], extraAttempt: false, status: 'playing' }
}

export function eventsById(ids: readonly string[]): HistEvent[] {
  return ids.map((id) => {
    const e = EVENTS.find((x) => x.id === id)
    if (!e) throw new Error(`Unknown event ${id}`)
    return e
  })
}

export function swap(state: GameState, a: number, b: number): GameState {
  if (state.status !== 'playing' || a === b) return state
  if (isLocked(state, a) || isLocked(state, b)) return state
  const order = state.order.slice()
  ;[order[a], order[b]] = [order[b], order[a]]
  return { ...state, order }
}

/** Moves a card one step up or down, hopping over locked cards. */
export function nudge(state: GameState, index: number, dir: -1 | 1): GameState {
  let target = index + dir
  while (target >= 0 && target < state.order.length && isLocked(state, target)) target += dir
  if (target < 0 || target >= state.order.length) return state
  return swap(state, index, target)
}

export function submit(state: GameState): GameState {
  if (state.status !== 'playing') return state
  const marks = evaluate(eventsById(state.order))
  const attempts = [...state.attempts, marks]
  const won = marks.every((m) => m === 'correct')
  const next: GameState = { ...state, attempts, lastOrder: state.order.slice() }
  if (won) next.status = 'won'
  else if (attempts.length >= maxAttempts(next)) next.status = next.extraAttempt ? 'lost' : 'out'
  return next
}

/** Out of attempts and the player watched an ad for one more. */
export function grantExtraAttempt(state: GameState): GameState {
  if (state.status !== 'out') return state
  return { ...state, extraAttempt: true, status: 'playing' }
}

export function giveUp(state: GameState): GameState {
  if (state.status !== 'out') return state
  return { ...state, status: 'lost' }
}

/** Reveals the year of a random unrevealed card that is not yet locked in place. */
export function revealHint(state: GameState, rand: () => number = Math.random): GameState {
  const candidates = state.order.filter((id, i) => !state.hinted.includes(id) && !isLocked(state, i))
  if (state.status !== 'playing' || candidates.length === 0) return state
  const id = candidates[Math.floor(rand() * candidates.length)]
  return { ...state, hinted: [...state.hinted, id] }
}

export function isValidState(s: unknown): s is GameState {
  if (!s || typeof s !== 'object') return false
  const g = s as GameState
  return (
    (g.mode === 'daily' || g.mode === 'practice') &&
    typeof g.key === 'string' &&
    Array.isArray(g.order) &&
    g.order.length === PUZZLE_SIZE &&
    g.order.every((id) => EVENTS.some((e) => e.id === id)) &&
    Array.isArray(g.attempts) &&
    (g.lastOrder === undefined || Array.isArray(g.lastOrder)) &&
    Array.isArray(g.hinted) &&
    typeof g.extraAttempt === 'boolean' &&
    ['playing', 'out', 'won', 'lost'].includes(g.status)
  )
}
