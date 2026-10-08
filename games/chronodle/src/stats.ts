import { addDays, type GameState } from './puzzle'

export interface Stats {
  played: number
  wins: number
  streak: number
  maxStreak: number
  /** Wins by attempts used: index 0 is a first-try win. Index 4 is a win on the bonus attempt. */
  distribution: number[]
  lastWinKey?: string
  lastPlayedKey?: string
}

export function emptyStats(): Stats {
  return { played: 0, wins: 0, streak: 0, maxStreak: 0, distribution: [0, 0, 0, 0, 0] }
}

/** Records a finished daily puzzle. Recording the same day twice is a no-op. */
export function recordResult(stats: Stats, game: GameState): Stats {
  if (game.mode !== 'daily' || stats.lastPlayedKey === game.key) return stats
  if (game.status !== 'won' && game.status !== 'lost') return stats
  const next: Stats = { ...stats, distribution: stats.distribution.slice(), played: stats.played + 1, lastPlayedKey: game.key }
  if (game.status === 'won') {
    next.wins++
    next.streak = stats.lastWinKey === addDays(game.key, -1) ? stats.streak + 1 : 1
    next.maxStreak = Math.max(next.maxStreak, next.streak)
    next.lastWinKey = game.key
    const slot = Math.min(game.attempts.length, next.distribution.length) - 1
    next.distribution[slot]++
  } else {
    next.streak = 0
  }
  return next
}

/** The streak to show today: it is broken once a whole day passes without a win. */
export function liveStreak(stats: Stats, todayKey: string): number {
  if (stats.lastWinKey === todayKey || stats.lastWinKey === addDays(todayKey, -1)) return stats.streak
  return 0
}
