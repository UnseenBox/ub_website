// Garage Empire — boot, fixed-clamp game loop, event wiring, touch controls.

import './style.css'
import { SAVE_KEY } from './config'
import type { WorkerRole } from './config'
import { ads } from './ads'
import { audio } from './audio'
import { initInput, pollInput, setTouchAction, setTouchMove } from './input'
import { Renderer } from './render'
import { Game, type GameEvent } from './sim'
import { loadSave, storeSave } from './state'
import { UI } from './ui'

const app = document.getElementById('app')!
const ui = new UI(app)
const canvas = ui.canvas()
const renderer = new Renderer(canvas)

canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault()
  audio.stopWash()
  ui.toast('⚠️ 3D context lost — reloading…')
  window.setTimeout(() => location.reload(), 1500)
})

let save = loadSave()
audio.muted = save.muted
audio.setVolume(save.volume)
ui.setMuted(save.muted)

let game = new Game(save)
let paused = false
let last = performance.now()
let saveT = 0

function persist(): void {
  storeSave(game.save)
}

function dispatch(evs: GameEvent[]): void {
  for (const e of evs) {
    switch (e.t) {
      case 'floater':
        ui.floater(e.x, e.y, e.text, e.color)
        break
      case 'sfx':
        audio.play(e.name)
        break
      case 'washStart':
        audio.startWash()
        break
      case 'washStop':
        audio.stopWash()
        break
      case 'toast':
        ui.toast(e.text)
        break
      case 'objective':
        ui.toast(`${e.text}  (+$${e.bonus} bonus)`)
        ui.floater(game.player.x, game.player.y - 1, `+$${e.bonus}`, '#facc15')
        ads.happy()
        break
      case 'unlockFx':
        renderer.burst(e.x, e.y)
        audio.thud()
        break
      case 'openHire':
        audio.play('click')
        ui.openHire(game, (role: WorkerRole) => {
          audio.unlock()
          const sink: GameEvent[] = []
          game.hire(role, sink)
          dispatch(sink)
        })
        break
      case 'openOffer':
        audio.play('click')
        ui.openOffer(game, e.idx, () => {
          const sink: GameEvent[] = []
          game.buyOffer(e.idx, sink)
          dispatch(sink)
        })
        break
      case 'sold':
        ui.openSold(e)
        persist()
        break
      case 'pulse':
        ui.pulse()
        break
    }
  }
}

function togglePause(force?: boolean): void {
  const next = force !== undefined ? force : !paused
  if (next === paused && ui.modal === 'pause') {
    ui.closeModal()
    paused = false
    ads.gameplayStart()
    return
  }
  paused = next
  if (paused) {
    audio.stopWash()
    ui.openPause(game, {
      muted: audio.muted,
      volume: audio.volume,
      onMute: () => {
        audio.unlock()
        audio.setMuted(!audio.muted)
        game.save.muted = audio.muted
        ui.setMuted(audio.muted)
        persist()
      },
      onVolume: (v: number) => {
        audio.unlock()
        audio.setVolume(v)
        game.save.volume = audio.volume
        persist()
      },
      onReset: () => {
        try {
          localStorage.removeItem(SAVE_KEY)
        } catch { /* ignore */ }
        location.reload()
      },
    })
    ads.gameplayStop()
  } else {
    if (ui.modal === 'pause') ui.closeModal()
    ads.gameplayStart()
  }
}

function frame(now: number): void {
  requestAnimationFrame(frame)
  let dt = (now - last) / 1000
  last = now
  if (dt > 0.05) dt = 0.05
  if (dt <= 0) return

  const input = pollInput()
  if (input.pausePressed) {
    if (ui.modal && ui.modal !== 'pause') ui.closeModal()
    else togglePause()
  }

  const modalBlocks = ui.modal === 'pause'
  if (!paused && !modalBlocks && !document.hidden) {
    const evs = game.update(dt, input)
    dispatch(evs)
    saveT += dt
    if (saveT > 5) {
      saveT = 0
      persist()
    }
  } else if (ui.modal === 'hire' || ui.modal === 'offer') {
    // keep the world alive behind browse modals, but ignore movement input
    const evs = game.update(dt, { x: 0, y: 0, actionHeld: false, actionPressed: false })
    dispatch(evs)
  }

  renderer.render(game, now / 1000, paused ? 0 : dt)
  ui.sync(game)
  ui.tickFloaters(renderer, dt)
}

// ---- chrome ----

ui.onButton('#btn-pause', () => {
  audio.unlock()
  audio.play('click')
  togglePause()
})
ui.onButton('#btn-help', () => {
  audio.unlock()
  audio.play('click')
  audio.stopWash()
  ui.openHelp()
})
ui.onButton('#btn-mute', () => {
  audio.unlock()
  audio.setMuted(!audio.muted)
  game.save.muted = audio.muted
  ui.setMuted(audio.muted)
  persist()
})

function resize(): void {
  renderer.resize()
}
window.addEventListener('resize', resize)
window.addEventListener('orientationchange', () => window.setTimeout(resize, 120))
resize()

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    audio.stopWash()
    persist()
  }
})
window.addEventListener('beforeunload', persist)

// ---- touch controls ----

function wireTouch(): void {
  const joy = ui.joyBase
  const knob = ui.joyKnob
  const act = ui.actBtn
  let joyId: number | null = null

  const setKnob = (dx: number, dy: number) => {
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
  }

  joy.addEventListener('pointerdown', (e) => {
    joyId = e.pointerId
    joy.setPointerCapture(e.pointerId)
    e.preventDefault()
  })
  joy.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joyId) return
    const r = joy.getBoundingClientRect()
    let dx = e.clientX - (r.left + r.width / 2)
    let dy = e.clientY - (r.top + r.height / 2)
    const max = r.width / 2 - 8
    const len = Math.hypot(dx, dy)
    if (len > max) {
      dx = (dx / len) * max
      dy = (dy / len) * max
    }
    setKnob(dx, dy)
    setTouchMove(dx / max, dy / max)
  })
  const endJoy = (e: PointerEvent) => {
    if (e.pointerId !== joyId) return
    joyId = null
    setKnob(0, 0)
    setTouchMove(0, 0)
  }
  joy.addEventListener('pointerup', endJoy)
  joy.addEventListener('pointercancel', endJoy)

  act.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    act.classList.add('held')
    setTouchAction(true)
  })
  const endAct = () => {
    act.classList.remove('held')
    setTouchAction(false)
  }
  act.addEventListener('pointerup', endAct)
  act.addEventListener('pointercancel', endAct)
  act.addEventListener('pointerleave', endAct)
}
wireTouch()

// ---- boot ----

initInput(() => {
  audio.unlock()
  ads.gameplayStart()
})

// Scripted demo for headless screenshot tests: dev server (`?demo=1`) or any
// build with VITE_DEMO=1. Never active in normal play (needs the query flag).
const demoMode = import.meta.env.DEV || import.meta.env.VITE_DEMO === '1'
if (demoMode && new URLSearchParams(location.search).has('demo')) {
  const demo = {
    game,
    hold: (v: boolean) => setTouchAction(v),
    tp: (x: number, y: number) => {
      game.player.x = x
      game.player.y = y
      game.player.vx = 0
      game.player.vy = 0
    },
  }
  ;(window as unknown as { __ge?: Game; __demo?: typeof demo }).__ge = game
  ;(window as unknown as { __demo?: typeof demo }).__demo = demo
  try {
    localStorage.setItem('garage-empire:seen', '1')
  } catch { /* ignore */ }
  // Teleport next to the first wash bay, then hold ACTION to work.
  const hop = setInterval(() => {
    const car = game.cars[0]
    if (car && car.phase === 'inBay' && car.bay === 'wash1') {
      demo.tp(12.5, 6.4)
      demo.hold(true)
      clearInterval(hop)
    }
  }, 200)
  setInterval(() => {
    console.log(`[demo] money=${game.save.money} washed=${game.save.stats.washed} cars=${game.cars.length} player=${game.player.x.toFixed(1)},${game.player.y.toFixed(1)}`)
  }, 3000)
  // fps meter over 5s windows
  let frames = 0
  const tick = () => {
    frames++
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  setInterval(() => {
    console.log(`[demo] fps=${Math.round(frames / 5)} particles=${renderer.particles.length} draws=${renderer.drawCalls}`)
    frames = 0
  }, 5000)
}
void ads.init().then(() => {
  if (!paused) ads.gameplayStart()
})

// Fresh players get the help card once; returning players jump straight in.
try {
  if (!localStorage.getItem('garage-empire:seen')) {
    localStorage.setItem('garage-empire:seen', '1')
    ui.openHelp()
  }
} catch { /* ignore */ }

requestAnimationFrame((t) => {
  last = t
  requestAnimationFrame(frame)
})
