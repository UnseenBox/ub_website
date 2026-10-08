import type { ActionState, InputBackend, PointerMapper, PointerState } from './InputManager';

/**
 * Touch backend scaffold.
 *
 * On a touch device the whole premise changes: there is no hovering cursor, so
 * the mobile design is "drag a floating attention marker with one thumb, walk
 * with a virtual stick under the other". The plumbing for that lives here so no
 * gameplay system needs to change. On desktop this backend contributes nothing.
 *
 * Current behaviour: a two-finger layout where the left half of the screen acts
 * as a relative stick and the right half drags the attention marker. It is wired
 * up but deliberately not tuned, and desktop remains the first-class target.
 */
export class TouchInput implements InputBackend {
  private attached = false;
  private enabled = false;

  private stickId = -1;
  private stickOriginX = 0;
  private stickOriginY = 0;
  private stickX = 0;
  private stickY = 0;

  private aimId = -1;
  private aimX = 0;
  private aimY = 0;
  private aimInside = false;
  private tapDown = false;

  private static readonly STICK_RADIUS = 56;

  constructor(
    private readonly surface: HTMLElement,
    private readonly mapper: PointerMapper,
  ) {}

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    this.enabled =
      typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    if (!this.enabled) return;
    this.surface.addEventListener('touchstart', this.onStart, { passive: false });
    this.surface.addEventListener('touchmove', this.onMove, { passive: false });
    this.surface.addEventListener('touchend', this.onEnd);
    this.surface.addEventListener('touchcancel', this.onEnd);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    if (!this.enabled) return;
    this.surface.removeEventListener('touchstart', this.onStart);
    this.surface.removeEventListener('touchmove', this.onMove);
    this.surface.removeEventListener('touchend', this.onEnd);
    this.surface.removeEventListener('touchcancel', this.onEnd);
  }

  gather(actions: ActionState, pointer: PointerState): void {
    if (!this.enabled) return;

    if (this.stickId !== -1) {
      const dx = this.stickX - this.stickOriginX;
      const dy = this.stickY - this.stickOriginY;
      const r = TouchInput.STICK_RADIUS;
      actions.moveX += Math.max(-1, Math.min(1, dx / r));
      actions.moveY += Math.max(-1, Math.min(1, dy / r));
      if (Math.hypot(dx, dy) < r * 0.45) actions.sneak = true;
    }

    if (this.aimId !== -1 || this.aimInside) {
      pointer.x = this.aimX;
      pointer.y = this.aimY;
      pointer.inside = this.aimInside;
      pointer.primaryHeld = this.aimId !== -1;
    }

    if (this.tapDown) {
      actions.primary = true;
      pointer.primaryDown = true;
    }
  }

  endStep(): void {
    this.tapDown = false;
  }

  private readonly onStart = (e: TouchEvent): void => {
    e.preventDefault();
    const rect = this.surface.getBoundingClientRect();
    const mid = rect.left + rect.width * 0.5;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.clientX < mid && this.stickId === -1) {
        this.stickId = t.identifier;
        this.stickOriginX = t.clientX;
        this.stickOriginY = t.clientY;
        this.stickX = t.clientX;
        this.stickY = t.clientY;
      } else if (this.aimId === -1) {
        this.aimId = t.identifier;
        this.applyAim(t.clientX, t.clientY);
        this.tapDown = true;
      }
    }
  };

  private readonly onMove = (e: TouchEvent): void => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this.stickId) {
        this.stickX = t.clientX;
        this.stickY = t.clientY;
      } else if (t.identifier === this.aimId) {
        this.applyAim(t.clientX, t.clientY);
      }
    }
  };

  private readonly onEnd = (e: TouchEvent): void => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this.stickId) this.stickId = -1;
      if (t.identifier === this.aimId) this.aimId = -1;
    }
  };

  private applyAim(clientX: number, clientY: number): void {
    const p = this.mapper(clientX, clientY);
    this.aimX = p.x;
    this.aimY = p.y;
    this.aimInside = p.inside;
  }
}
