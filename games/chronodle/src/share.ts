import { maxAttempts, puzzleNumber, type GameState, type Mark } from './puzzle'

const TILE: Record<Mark, string> = { correct: '🟩', earlier: '🟨', later: '🟨' }

export function emojiGrid(game: GameState): string {
  return game.attempts.map((row) => row.map((m) => TILE[m]).join('')).join('\n')
}

/** Text players paste into chats and socials. The grid shows progress but never the answer. */
export function shareText(game: GameState, url: string, streak = 0): string {
  const score = game.status === 'won' ? `${game.attempts.length}/${maxAttempts(game)}` : `X/${maxAttempts(game)}`
  const extras = [
    game.hinted.length ? '💡'.repeat(game.hinted.length) : '',
    game.mode === 'daily' && streak > 1 ? `🔥${streak}` : '',
  ].filter(Boolean)
  const title =
    game.mode === 'daily'
      ? `Chronodle #${puzzleNumber(game.key)} ${score}`
      : `Chronodle practice ${score}. Can you beat this one?`
  return [[title, ...extras].join(' '), emojiGrid(game), url].join('\n')
}
