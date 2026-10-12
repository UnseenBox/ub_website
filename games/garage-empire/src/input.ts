// Unified keyboard + touch input. Desktop: WASD/arrows to move (screen-space:
// x = right, y = down), E/Space to interact (hold to work), Esc pauses.
// Touch: virtual joystick + action button rendered as DOM by the UI layer;
// this module only stores their vector state. sim.ts rotates the vector 45°
// into world space to match the isometric camera.

export interface InputState {
  x: number
  y: number
  actionHeld: boolean
  actionPressed: boolean
  pausePressed: boolean
}

const keys = new Set<string>()
let actionHeldKey = false
let actionPressedFlag = false
let pausePressedFlag = false

// Touch joystick vector, written by the UI layer.
export const touchMove = { x: 0, y: 0 }
export let touchActionHeld = false
let touchActionPressedFlag = false

export function pressTouchAction(): void {
  touchActionPressedFlag = true
}

export function setTouchAction(held: boolean): void {
  touchActionHeld = held
  if (held) touchActionPressedFlag = true
}

export function setTouchMove(x: number, y: number): void {
  touchMove.x = x
  touchMove.y = y
}

export function initInput(onFirstGesture: () => void): void {
  let gestured = false
  const gesture = () => {
    if (!gestured) {
      gestured = true
      onFirstGesture()
    }
  }
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase()
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault()
    if (e.repeat) return
    keys.add(k)
    gesture()
    if (k === 'e' || k === ' ') {
      actionHeldKey = true
      actionPressedFlag = true
    }
    if (k === 'escape' || k === 'p') pausePressedFlag = true
  })
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase()
    keys.delete(k)
    if (k === 'e' || k === ' ') {
      // Space/E may overlap; only release when neither is down.
      if (!keys.has('e') && !keys.has(' ')) actionHeldKey = false
    }
  })
  window.addEventListener('blur', () => {
    keys.clear()
    actionHeldKey = false
    touchMove.x = 0
    touchMove.y = 0
    touchActionHeld = false
  })
  const pointerGesture = () => gesture()
  window.addEventListener('pointerdown', pointerGesture, { passive: true })
  window.addEventListener('touchstart', pointerGesture, { passive: true })
}

export function pollInput(): InputState {
  let x = 0
  let y = 0
  if (keys.has('a') || keys.has('arrowleft')) x -= 1
  if (keys.has('d') || keys.has('arrowright')) x += 1
  if (keys.has('w') || keys.has('arrowup')) y -= 1
  if (keys.has('s') || keys.has('arrowdown')) y += 1
  x += touchMove.x
  y += touchMove.y
  const len = Math.hypot(x, y)
  if (len > 1) {
    x /= len
    y /= len
  }
  const st: InputState = {
    x,
    y,
    actionHeld: actionHeldKey || touchActionHeld,
    actionPressed: actionPressedFlag || touchActionPressedFlag,
    pausePressed: pausePressedFlag,
  }
  actionPressedFlag = false
  touchActionPressedFlag = false
  pausePressedFlag = false
  return st
}
