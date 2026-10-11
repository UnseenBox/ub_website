// DOM overlay: HUD, contextual prompt, toasts, floaters, modals, touch controls.
// Canvas stays the world; everything readable/clickable lives here.

import { HIRES, SERVICES, type WorkerRole } from './config'
import type { Game } from './sim'
import type { Renderer } from './render'

export interface SoldSummary {
  title: string
  price: number
  bought: number
  invested: number
  profit: number
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

export class UI {
  root: HTMLElement
  hud!: HTMLElement
  moneyEl!: HTMLElement
  levelEl!: HTMLElement
  objEl!: HTMLElement
  promptEl!: HTMLElement
  toastEl!: HTMLElement
  floatEl!: HTMLElement
  modalEl!: HTMLElement
  touchEl!: HTMLElement
  joyBase!: HTMLElement
  joyKnob!: HTMLElement
  actBtn!: HTMLElement
  floaters: { x: number; y: number; el: HTMLElement; life: number }[] = []
  modal: string | null = null
  isTouch = false

  constructor(root: HTMLElement) {
    this.root = root
    this.root.innerHTML = `
      <canvas id="scene"></canvas>
      <div id="hud">
        <div class="hud-left">
          <div id="money" class="pill cash">$0</div>
          <div id="level" class="pill lvl">LV 1</div>
        </div>
        <div id="objective" class="pill obj">…</div>
        <div class="hud-right">
          <button id="btn-mute" class="icon-btn" aria-label="Mute">🔊</button>
          <button id="btn-help" class="icon-btn" aria-label="Help">?</button>
          <button id="btn-pause" class="icon-btn" aria-label="Pause">⏸</button>
        </div>
      </div>
      <div id="toasts"></div>
      <div id="floaters"></div>
      <div id="prompt" class="hidden"></div>
      <div id="modal" class="hidden"></div>
      <div id="touch" class="hidden">
        <div id="joy"><div id="joy-knob"></div></div>
        <button id="act" aria-label="Action">E</button>
      </div>`
    this.hud = root.querySelector('#hud')!
    this.moneyEl = root.querySelector('#money')!
    this.levelEl = root.querySelector('#level')!
    this.objEl = root.querySelector('#objective')!
    this.promptEl = root.querySelector('#prompt')!
    this.toastEl = root.querySelector('#toasts')!
    this.floatEl = root.querySelector('#floaters')!
    this.modalEl = root.querySelector('#modal')!
    this.touchEl = root.querySelector('#touch')!
    this.joyBase = root.querySelector('#joy')!
    this.joyKnob = root.querySelector('#joy-knob')!
    this.actBtn = root.querySelector('#act')!
    this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    if (this.isTouch) this.touchEl.classList.remove('hidden')
  }

  canvas(): HTMLCanvasElement {
    return this.root.querySelector('#scene')!
  }

  onButton(id: string, fn: () => void): void {
    this.root.querySelector(id)?.addEventListener('click', (e) => {
      e.stopPropagation()
      fn()
    })
  }

  // ---- per-frame ----

  sync(game: Game): void {
    const m = money(game.money)
    if (this.moneyEl.textContent !== m) this.moneyEl.textContent = m
    const lvl = `LV ${game.level + 1} · ${game.levelName}`
    if (this.levelEl.textContent !== lvl) {
      this.levelEl.textContent = lvl
      this.levelEl.title = lvl
    }
    const obj = `🎯 ${game.currentObjective()}`
    if (this.objEl.textContent !== obj) this.objEl.textContent = obj

    const it = game.current
    if (!it) {
      this.promptEl.classList.add('hidden')
    } else {
      this.promptEl.classList.remove('hidden')
      const key = this.isTouch ? 'ACTION' : 'E'
      const afford = it.kind === 'buy' && !it.affordable ? 'cant' : ''
      this.promptEl.innerHTML = `
        <div class="prompt-card ${it.kind} ${afford}">
          <div class="prompt-label">${escapeHtml(it.label)}</div>
          <div class="prompt-sub">${escapeHtml(it.sub)}</div>
          ${it.kind === 'work' || it.kind === 'buy' || it.kind === 'sell' || it.kind === 'inspect' || it.kind === 'hire'
            ? `<div class="prompt-key">${it.kind === 'work' ? `HOLD ${key}` : `PRESS ${key}`}</div>` : ''}
        </div>`
    }
  }

  pulse(): void {
    this.moneyEl.classList.remove('bump')
    void this.moneyEl.offsetWidth
    this.moneyEl.classList.add('bump')
  }

  toast(text: string): void {
    const el = document.createElement('div')
    el.className = 'toast'
    el.textContent = text
    this.toastEl.appendChild(el)
    while (this.toastEl.children.length > 3) this.toastEl.firstChild?.remove()
    window.setTimeout(() => {
      el.classList.add('out')
      window.setTimeout(() => el.remove(), 400)
    }, 3600)
  }

  floater(x: number, y: number, text: string, color: string): void {
    const el = document.createElement('div')
    el.className = 'floater'
    el.textContent = text
    el.style.color = color
    this.floatEl.appendChild(el)
    this.floaters.push({ x, y, el, life: 0 })
    if (this.floaters.length > 24) {
      const f = this.floaters.shift()
      f?.el.remove()
    }
  }

  tickFloaters(r: Renderer, dt: number): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    for (const f of this.floaters) {
      f.life += dt
      const px = r.sx(f.x, f.y) / dpr
      const py = r.sy(f.x, f.y, 1.1 + f.life * 0.55) / dpr
      f.el.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(-50%,-100%)`
      f.el.style.opacity = String(Math.max(0, 1 - f.life / 1.7))
    }
    this.floaters = this.floaters.filter((f) => {
      if (f.life > 1.7) {
        f.el.remove()
        return false
      }
      return true
    })
  }

  // ---- modals ----

  closeModal(): void {
    this.modal = null
    this.modalEl.classList.add('hidden')
    this.modalEl.innerHTML = ''
  }

  private show(html: string, name: string): void {
    this.modal = name
    this.modalEl.classList.remove('hidden')
    this.modalEl.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`
  }

  openHire(game: Game, onHire: (role: WorkerRole) => void): void {
    const rows = HIRES.map((h) => {
      const owned = game.save.hires.includes(h.role)
      const can = game.money >= h.cost
      const svc = h.services.map((s) => SERVICES[s].label).join(', ') || '+10% sale prices'
      return `<div class="row">
        <div class="row-ico">${h.icon}</div>
        <div class="row-main"><b>${h.name}</b><span>${h.desc} (${svc})</span></div>
        ${owned
          ? '<span class="owned">HIRED ✓</span>'
          : `<button class="btn ${can ? 'primary' : 'disabled'}" data-hire="${h.role}">${money(h.cost)}</button>`}
      </div>`
    }).join('')
    this.show(`
      <h2>🧑‍🔧 Hire staff</h2>
      <p class="muted">Workers do real jobs at your stations while you focus on flips.</p>
      ${rows}
      <button class="btn ghost wide" data-close>Close</button>`, 'hire')
    this.wire(game, onHire)
  }

  openOffer(game: Game, idx: number, onBuy: () => void): void {
    const info = game.offerInfo(idx)
    if (!info) {
      this.closeModal()
      return
    }
    const { car, buy, costs, sell, profit } = info
    const bar = (label: string, v: number) => `
      <div class="cond"><span>${label}</span>
        <div class="bar"><i style="width:${Math.round(v)}%;background:${v > 70 ? '#4ade80' : v > 40 ? '#facc15' : '#f87171'}"></i></div>
        <b>${Math.round(v)}%</b>
      </div>`
    const ok = profit > 0
    this.show(`
      <h2>🔍 ${car.type.name} inspection</h2>
      <div class="kv"><span>Purchase price</span><b>-${money(buy)}</b></div>
      ${bar('🧽 Clean', car.cond.clean)}
      ${bar('🔧 Engine', car.cond.mech)}
      ${bar('🔨 Body', car.cond.body)}
      ${bar('🛞 Tires', car.cond.tires)}
      ${bar('✨ Finish', car.cond.shine)}
      ${car.wantPaint ? '<p class="muted">🎨 Wants a full repaint (included in costs).</p>' : ''}
      <div class="kv"><span>Est. parts & service</span><b>-${money(costs)}</b></div>
      <div class="kv"><span>Est. resale, restored</span><b class="green">+${money(sell)}</b></div>
      <div class="kv big"><span>Potential profit</span><b class="${ok ? 'green' : 'red'}">${ok ? '+' : ''}${money(profit)}</b></div>
      <div class="btnrow">
        <button class="btn ghost" data-close>Walk away</button>
        <button class="btn ${game.money >= buy ? 'primary' : 'disabled'}" data-buy>Buy ${money(buy)}</button>
      </div>`, 'offer')
    this.modalEl.querySelector('[data-close]')?.addEventListener('click', () => this.closeModal())
    this.modalEl.querySelector('[data-buy]')?.addEventListener('click', () => {
      onBuy()
      if (this.modal === 'offer') this.openOffer(game, idx, onBuy)
    })
  }

  openSold(s: SoldSummary): void {
    const ok = s.profit >= 0
    this.show(`
      <h2>${ok ? '🎉 Flip sold!' : '🤝 Sold'}</h2>
      <p class="muted">${escapeHtml(s.title)} found a new home.</p>
      <div class="kv"><span>Sale price</span><b class="green">+${money(s.price)}</b></div>
      <div class="kv"><span>Purchase</span><b>-${money(s.bought)}</b></div>
      <div class="kv"><span>Parts & service</span><b>-${money(s.invested)}</b></div>
      <div class="kv big"><span>Profit</span><b class="${ok ? 'green' : 'red'}">${ok ? '+' : ''}${money(s.profit)}</b></div>
      <button class="btn primary wide" data-close>${ok ? 'Beautiful!' : 'Next one!'}</button>`, 'sold')
    this.modalEl.querySelector('[data-close]')?.addEventListener('click', () => this.closeModal())
  }

  openPause(game: Game, opts: { onReset: () => void; muted: boolean; onMute: () => void }): void {
    const s = game.save
    this.show(`
      <h2>⏸ Garage Empire</h2>
      <p class="muted">Wash it. Fix it. Flip it.</p>
      <div class="kv"><span>Cash</span><b>${money(game.money)}</b></div>
      <div class="kv"><span>Revenue (all time)</span><b>${money(s.lifetime)}</b></div>
      <div class="kv"><span>Cars washed</span><b>${s.stats.washed}</b></div>
      <div class="kv"><span>Repairs done</span><b>${s.stats.fixed}</b></div>
      <div class="kv"><span>Cars flipped</span><b>${s.stats.flipped} (${money(s.stats.flipsProfit)} profit)</b></div>
      <h3>Controls</h3>
      <p class="muted">Move: WASD / arrows · Work & buy: hold/press E or Space · Esc: pause. On touch: left stick + ACTION button.</p>
      <div class="btnrow">
        <button class="btn ghost" data-mute>${opts.muted ? '🔇 Unmute' : '🔊 Mute'}</button>
        <button class="btn ghost" data-close>Resume</button>
      </div>
      <button class="btn danger wide" data-reset>Start over (wipes save)</button>`, 'pause')
    this.modalEl.querySelector('[data-close]')?.addEventListener('click', () => this.closeModal())
    this.modalEl.querySelector('[data-mute]')?.addEventListener('click', () => {
      opts.onMute()
      this.openPause(game, { ...opts, muted: !opts.muted })
    })
    const resetBtn = this.modalEl.querySelector('[data-reset]') as HTMLButtonElement | null
    resetBtn?.addEventListener('click', () => {
      if (resetBtn.dataset.armed) opts.onReset()
      else {
        resetBtn.dataset.armed = '1'
        resetBtn.textContent = 'Really wipe everything? Click again'
      }
    })
  }

  openHelp(): void {
    this.show(`
      <h2>❓ How to play</h2>
      <p class="muted"><b>1.</b> Walk to the dirty car in the blue bay and <b>HOLD E</b> to wash it. You get paid per job.</p>
      <p class="muted"><b>2.</b> Spend earnings on <b>yellow signs</b>: new bays, the used-car lot, the showroom.</p>
      <p class="muted"><b>3.</b> Hire staff at the <b>STAFF board</b> — they work real jobs for you.</p>
      <p class="muted"><b>4.</b> Buy cheap cars at the <b>used lot</b>, restore them in your bays, sell for profit.</p>
      <p class="muted">Cars drive themselves between parking and free bays. You do the satisfying part.</p>
      <button class="btn primary wide" data-close>Let's go!</button>`, 'help')
    this.modalEl.querySelector('[data-close]')?.addEventListener('click', () => this.closeModal())
  }

  private wire(game: Game, onHire: (role: WorkerRole) => void): void {
    this.modalEl.querySelector('[data-close]')?.addEventListener('click', () => this.closeModal())
    this.modalEl.querySelectorAll('[data-hire]').forEach((b) => {
      b.addEventListener('click', () => {
        onHire((b as HTMLElement).dataset.hire as WorkerRole)
        if (this.modal === 'hire') this.openHire(game, onHire)
      })
    })
  }

  setMuted(m: boolean): void {
    const b = this.root.querySelector('#btn-mute')
    if (b) b.textContent = m ? '🔇' : '🔊'
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}
