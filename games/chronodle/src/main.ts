import './style.css'
import { ads } from './ads'
import { CATEGORY_ICON, formatYear, type HistEvent } from './events'
import {
  BASE_ATTEMPTS,
  dateKey,
  eventsById,
  generatePuzzle,
  giveUp,
  grantExtraAttempt,
  isLocked,
  isValidState,
  lastMarks,
  maxAttempts,
  newGame,
  nudge,
  puzzleNumber,
  randomPracticeSeed,
  revealHint,
  seedFor,
  submit,
  swap,
  type GameState,
  type Mode,
} from './puzzle'
import { shareText } from './share'
import { emptyStats, liveStreak, recordResult, type Stats } from './stats'
import { load, save } from './storage'

const MAX_HINTS = 2
const WIN_TITLES = ['Genius!', 'Brilliant!', 'Nicely done!', 'Phew!', 'Saved by the bell!']

const app = document.getElementById('app')!

let game!: GameState
let selected: number | null = null
let modal: 'help' | 'stats' | null = null
let busy = false
/** Deal the cards in with an animation only when a puzzle first appears, not on every tap. */
let dealIn = true
let stats: Stats = load<Stats>('stats') ?? emptyStats()
let today = dateKey()

// --- Game lifecycle ---

function storageKey(mode: Mode, key: string): string {
  return mode === 'daily' ? `game:daily:${key}` : 'game:practice'
}

/** Restores a saved game only if it is the same puzzle the seed would generate today. */
function restore(mode: Mode, key: string): GameState {
  const saved = load<GameState>(storageKey(mode, key))
  if (isValidState(saved) && saved.mode === mode && saved.key === key) {
    const expected = generatePuzzle(seedFor(mode, key)).map((e) => e.id)
    if (expected.every((id) => saved.order.includes(id))) return saved
  }
  return newGame(mode, key)
}

function start(mode: Mode, key: string): void {
  game = restore(mode, key)
  selected = null
  dealIn = true
  const url = new URL(location.href)
  if (mode === 'practice') url.searchParams.set('p', key)
  else url.searchParams.delete('p')
  history.replaceState(null, '', url)
  if (game.status === 'playing') ads.gameplayStart()
  render()
}

function update(next: GameState): void {
  const finished = game.status !== next.status && (next.status === 'won' || next.status === 'lost')
  game = next
  save(storageKey(game.mode, game.key), game)
  if (finished) onFinish()
  render()
}

function onFinish(): void {
  ads.gameplayStop()
  if (game.mode === 'daily') {
    stats = recordResult(stats, game)
    save('stats', stats)
  }
  if (game.status === 'won') {
    ads.happy()
    confetti()
  }
}

async function nextPractice(): Promise<void> {
  await ads.maybeInterstitial('practice-next')
  start('practice', randomPracticeSeed())
}

// --- Ads ---

async function watchAd(placement: string, reward: () => void): Promise<void> {
  if (busy) return
  busy = true
  render()
  const result = await ads.rewarded(placement)
  busy = false
  if (result === 'skipped') toast('Ad closed early, no reward this time')
  else {
    if (result === 'unavailable') toast('No ad available. This one is on us!')
    reward()
  }
  if (game.status === 'playing') ads.gameplayStart()
  render()
}

// --- Sharing ---

function shareUrl(): string {
  const base = (import.meta.env.VITE_SHARE_URL as string | undefined) || `${location.origin}${location.pathname}`
  return game.mode === 'practice' ? `${base}?p=${encodeURIComponent(game.key)}` : base
}

async function share(): Promise<void> {
  const text = shareText(game, shareUrl(), liveStreak(stats, today))
  const touch = matchMedia('(pointer: coarse)').matches
  if (touch && navigator.share) {
    try {
      await navigator.share({ text })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    toast('Result copied, paste it anywhere!')
  } catch {
    window.prompt('Copy your result:', text)
  }
}

// --- Rendering ---

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

function render(): void {
  const events = eventsById(game.order)
  const finished = game.status === 'won' || game.status === 'lost'
  const marks = lastMarks(game)

  app.innerHTML = `
    <header class="top">
      <button type="button" class="icon-btn" data-action="help" aria-label="How to play">?</button>
      <h1 class="logo">Chrono<span>dle</span></h1>
      <button type="button" class="icon-btn" data-action="stats" aria-label="Statistics">📊</button>
    </header>
    <nav class="tabs" aria-label="Mode">
      <button type="button" data-action="daily" class="${game.mode === 'daily' ? 'on' : ''}">Daily #${puzzleNumber(today)}</button>
      <button type="button" data-action="practice" class="${game.mode === 'practice' ? 'on' : ''}">Practice ∞</button>
    </nav>
    <main class="board">
      <p class="axis">⬆ Oldest</p>
      <ol class="cards ${dealIn ? 'intro' : ''}">
        ${events.map((e, i) => card(e, i, finished, marks)).join('')}
      </ol>
      <p class="axis">⬇ Newest</p>
      ${finished ? '' : attemptsLeft()}
      ${actions(finished)}
    </main>
    ${modal === 'help' ? helpModal() : ''}
    ${modal === 'stats' ? statsModal() : ''}
  `
  dealIn = false
}

function card(e: HistEvent, i: number, finished: boolean, marks: GameState['attempts'][number] | undefined): string {
  const unmoved = game.lastOrder?.[i] === e.id
  const mark = marks && unmoved ? marks[i] : undefined
  const locked = isLocked(game, i)
  const showYear = finished || game.hinted.includes(e.id)
  const cls = ['card', finished ? (game.status === 'won' ? 'correct' : mark ?? '') : mark ?? '', selected === i ? 'selected' : '', locked ? 'locked' : '']
  const arrow = !finished && mark === 'earlier' ? '<span class="dir" title="Belongs earlier">⬆</span>' : !finished && mark === 'later' ? '<span class="dir" title="Belongs later">⬇</span>' : ''
  const playing = game.status === 'playing' && !locked && !busy
  return `
    <li class="${cls.filter(Boolean).join(' ')}" style="--i:${i}">
      <button type="button" class="card-main" data-action="select" data-index="${i}" ${playing ? '' : 'disabled'}>
        <span class="cat" aria-hidden="true">${CATEGORY_ICON[e.cat]}</span>
        <span class="text">${esc(e.text)}</span>
        ${showYear ? `<span class="year">${formatYear(e)}</span>` : ''}
        ${arrow}
        ${locked && !finished ? '<span class="lock" aria-label="Locked in">✓</span>' : ''}
      </button>
      ${
        playing
          ? `<div class="nudges">
              <button type="button" data-action="up" data-index="${i}" aria-label="Move up">▲</button>
              <button type="button" data-action="down" data-index="${i}" aria-label="Move down">▼</button>
            </div>`
          : ''
      }
    </li>`
}

function attemptsLeft(): string {
  const max = maxAttempts(game)
  const dots = Array.from({ length: max }, (_, i) => `<span class="dot ${i < game.attempts.length ? 'used' : ''}"></span>`)
  return `<div class="attempts" aria-label="${max - game.attempts.length} tries left">${dots.join('')}</div>`
}

function actions(finished: boolean): string {
  if (game.status === 'playing') {
    const hintsLeft = MAX_HINTS - game.hinted.length
    return `
      <div class="actions">
        <button type="button" class="btn ghost" data-action="hint" ${hintsLeft > 0 && !busy ? '' : 'disabled'}>
          💡 Reveal a year <span class="ad-tag">AD</span>
        </button>
        <button type="button" class="btn primary" data-action="submit" ${busy ? 'disabled' : ''}>Submit</button>
      </div>
      <p class="tip">${game.attempts.length === 0 ? 'Tap two cards to swap them.' : '🟩 locked in · 🟨 move it the way the arrow points'}</p>`
  }
  if (game.status === 'out') {
    return `
      <div class="panel">
        <h2>Out of tries!</h2>
        <p>Watch a short ad for one more go?</p>
        <div class="actions">
          <button type="button" class="btn primary" data-action="extra" ${busy ? 'disabled' : ''}>📺 One more try</button>
          <button type="button" class="btn ghost" data-action="giveup">Show answer</button>
        </div>
      </div>`
  }
  if (!finished) return ''
  const won = game.status === 'won'
  const title = won ? WIN_TITLES[game.attempts.length - 1] ?? WIN_TITLES[WIN_TITLES.length - 1] : 'So close!'
  const answer = won
    ? ''
    : `<ol class="answer">${eventsById(game.order)
        .slice()
        .sort((a, b) => a.year - b.year)
        .map((e) => `<li><b>${formatYear(e)}</b> ${esc(e.text)}</li>`)
        .join('')}</ol>`
  const daily = game.mode === 'daily'
  return `
    <div class="panel result ${won ? 'win' : 'loss'}">
      <h2>${title}</h2>
      <p>${won ? `Solved in ${game.attempts.length}/${maxAttempts(game)}` : 'The correct order was:'}</p>
      ${answer}
      <div class="actions">
        <button type="button" class="btn primary" data-action="share">${daily ? 'Share result' : 'Challenge a friend'}</button>
        <button type="button" class="btn ghost" data-action="${daily ? 'practice' : 'next'}">${daily ? 'Play practice ∞' : 'Next puzzle ▶'}</button>
      </div>
      ${daily ? `<p class="countdown">Next Chronodle in <b data-countdown>${countdown()}</b></p>` : ''}
    </div>`
}

function helpModal(): string {
  return `
    <div class="modal" data-action="close">
      <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <button type="button" class="icon-btn close" data-action="close" aria-label="Close">✕</button>
        <h2 id="help-title">How to play</h2>
        <p>Put the <b>5 events</b> in order, <b>oldest at the top</b>.</p>
        <p>Tap two cards to swap them, or use the ▲▼ arrows. Then hit <b>Submit</b>.</p>
        <ul class="legend">
          <li><span class="swatch correct"></span>Right spot. It locks in place.</li>
          <li><span class="swatch earlier"></span>Wrong spot. The arrow says if it belongs earlier ⬆ or later ⬇.</li>
        </ul>
        <p>You get <b>${BASE_ATTEMPTS} tries</b>. Stuck? Reveal a year with 💡.</p>
        <p>A new puzzle every day at midnight. Practice mode is unlimited, and you can send any practice puzzle to a friend as a challenge.</p>
        <button type="button" class="btn primary wide" data-action="close">Let's play</button>
      </div>
    </div>`
}

function statsModal(): string {
  const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0
  const most = Math.max(1, ...stats.distribution)
  const labels = ['1', '2', '3', '4', '+1']
  const bars = stats.distribution
    .map((n, i) => `<li><span>${labels[i]}</span><div class="bar" style="--w:${Math.max(8, (n / most) * 100)}%">${n}</div></li>`)
    .join('')
  return `
    <div class="modal" data-action="close">
      <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="stats-title">
        <button type="button" class="icon-btn close" data-action="close" aria-label="Close">✕</button>
        <h2 id="stats-title">Statistics</h2>
        <div class="stat-row">
          <div><b>${stats.played}</b><span>Played</span></div>
          <div><b>${winPct}</b><span>Win %</span></div>
          <div><b>${liveStreak(stats, today)}</b><span>Streak 🔥</span></div>
          <div><b>${stats.maxStreak}</b><span>Best</span></div>
        </div>
        <h3>Solved in</h3>
        <ol class="dist">${bars}</ol>
        <p class="countdown">Next Chronodle in <b data-countdown>${countdown()}</b></p>
      </div>
    </div>`
}

function countdown(): string {
  const now = new Date()
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const s = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

// --- Juice ---

let toastTimer = 0
function toast(message: string): void {
  document.querySelector('.toast')?.remove()
  const el = document.createElement('div')
  el.className = 'toast'
  el.setAttribute('role', 'status')
  el.textContent = message
  document.body.appendChild(el)
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => el.remove(), 2600)
}

function confetti(): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const layer = document.createElement('div')
  layer.className = 'confetti'
  const colors = ['#22c55e', '#facc15', '#38bdf8', '#f472b6', '#a78bfa']
  for (let i = 0; i < 60; i++) {
    const p = document.createElement('i')
    p.style.left = `${Math.random() * 100}%`
    p.style.background = colors[i % colors.length]
    p.style.animationDelay = `${Math.random() * 0.4}s`
    p.style.setProperty('--drift', `${(Math.random() - 0.5) * 200}px`)
    layer.appendChild(p)
  }
  document.body.appendChild(layer)
  setTimeout(() => layer.remove(), 2500)
}

// --- Input ---

app.addEventListener('click', (ev) => {
  const target = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]')
  if (!target) return
  // A click inside a modal box only closes it from its own close buttons.
  if (target.classList.contains('modal') && (ev.target as HTMLElement).closest('.modal-box')) return
  const index = Number(target.dataset.index)
  switch (target.dataset.action) {
    case 'select':
      if (selected === null) selected = index
      else {
        const from = selected
        selected = null
        if (from !== index) return update(swap(game, from, index))
      }
      return render()
    case 'up':
    case 'down':
      selected = null
      return update(nudge(game, index, target.dataset.action === 'up' ? -1 : 1))
    case 'submit':
      selected = null
      return update(submit(game))
    case 'hint':
      return void watchAd('hint', () => update(revealHint(game)))
    case 'extra':
      return void watchAd('extra-try', () => update(grantExtraAttempt(game)))
    case 'giveup':
      return update(giveUp(game))
    case 'share':
      return void share()
    case 'daily':
      return start('daily', today)
    case 'practice':
      return game.mode === 'practice' ? undefined : start('practice', load<GameState>('game:practice')?.key ?? randomPracticeSeed())
    case 'next':
      return void nextPractice()
    case 'help':
    case 'stats':
      modal = target.dataset.action
      return render()
    case 'close':
      modal = null
      return render()
  }
})

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && modal) {
    modal = null
    render()
  }
})

// Ticks the countdowns, and rolls the daily puzzle over at midnight.
setInterval(() => {
  const now = dateKey()
  if (now !== today) {
    today = now
    if (game.mode === 'daily' && game.status !== 'playing') start('daily', today)
    else render()
    return
  }
  document.querySelectorAll('[data-countdown]').forEach((el) => (el.textContent = countdown()))
}, 1000)

// --- Boot ---

void (async () => {
  const challenge = new URL(location.href).searchParams.get('p')
  start(challenge ? 'practice' : 'daily', challenge ?? today)
  if (!load<boolean>('seenHelp')) {
    modal = 'help'
    save('seenHelp', true)
    render()
  }
  await ads.init()
  if (game.status === 'playing') ads.gameplayStart()
})()
