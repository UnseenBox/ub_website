// Keeps the mouse inside the game during a fight on desktop, as CrazyGames asks of
// first-person games: a click locks it, Escape or Tab frees it. While it is locked the
// browser only reports how far it moved, so the pointer the game sees is added up here and
// drawn by the game's own crosshair.

import type Phaser from 'phaser';

export interface Spot { x: number; y: number }

/** The locked pointer after moving (dx, dy) screen pixels, kept on a canvas of w × h. */
export function moveSpot(at: Spot, dx: number, dy: number, scale: number, w: number, h: number): Spot {
  const clamp = (v: number, hi: number): number => Math.max(0, Math.min(hi, v));
  return { x: clamp(at.x + dx * scale, w), y: clamp(at.y + dy * scale, h) };
}

class MouseLock {
  private game: Phaser.Game | null = null;
  private spot: Spot = { x: 0, y: 0 };
  /** Set while the game itself lets the mouse go, so that is not mistaken for the player doing it. */
  private releasing = false;
  /** Called when the player frees the mouse (Escape, Tab, switching away). */
  onFreed: (() => void) | null = null;

  install(game: Phaser.Game): void {
    if (this.game || typeof document === 'undefined') return;
    this.game = game;
    // Heard before Phaser's own listener, so the pointer it reads is already up to date.
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      const rect = game.canvas.getBoundingClientRect();
      const scale = rect.width > 0 ? game.scale.width / rect.width : 1;
      this.spot = moveSpot(this.spot, e.movementX, e.movementY, scale, game.scale.width, game.scale.height);
    }, true);
    const manager = game.input;
    const base = manager.transformPointer;
    manager.transformPointer = (pointer, pageX, pageY, wasMove): void => {
      base.call(manager, pointer, pageX, pageY, wasMove);
      if (this.locked && pointer === manager.mousePointer) {
        pointer.x = this.spot.x;
        pointer.y = this.spot.y;
      }
    };
    document.addEventListener('pointerlockchange', () => {
      if (this.locked) return;
      const ours = this.releasing;
      this.releasing = false;
      if (!ours) this.onFreed?.();
    });
    document.addEventListener('pointerlockerror', () => { this.releasing = false; });
  }

  get locked(): boolean {
    return !!this.game && document.pointerLockElement === this.game.canvas;
  }

  /** Locks the mouse where it is. Must be called from a click; a refusal changes nothing. */
  request(): void {
    const game = this.game;
    if (!game || this.locked || !game.canvas.requestPointerLock) return;
    const p = game.input.mousePointer;
    if (p) this.spot = { x: p.x, y: p.y };
    try {
      // Newer browsers answer with a promise, which rejects if the player has just pressed Escape.
      const answer = game.canvas.requestPointerLock() as unknown;
      if (answer instanceof Promise) answer.catch(() => undefined);
    } catch {
      /* the mouse stays free */
    }
  }

  release(): void {
    if (!this.locked) return;
    this.releasing = true;
    document.exitPointerLock();
  }
}

export const mouseLock = new MouseLock();
