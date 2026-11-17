export interface PointerPoint {
  /** CSS pixels relative to the canvas. */
  x: number;
  y: number;
}

export interface PointerHandlers {
  onDown(p: PointerPoint): void;
  onMove(p: PointerPoint): void;
  onUp(p: PointerPoint): void;
  onCancel(): void;
}

/**
 * Pointer Events for mouse, pen and touch alike. Only the first pointer that
 * goes down counts, so a second finger cannot steal or cancel the aim.
 */
export class InputManager {
  private activeId: number | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly handlers: PointerHandlers,
  ) {
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onCancel);
    canvas.addEventListener('lostpointercapture', this.onCancel);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private local(e: PointerEvent): PointerPoint {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onDown = (e: PointerEvent): void => {
    if (this.activeId !== null) return;
    e.preventDefault();
    this.activeId = e.pointerId;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Capture can fail on some touch stacks; the drag still works without it.
    }
    this.handlers.onDown(this.local(e));
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    this.handlers.onMove(this.local(e));
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    this.activeId = null;
    this.handlers.onUp(this.local(e));
  };

  private onCancel = (e: Event): void => {
    const id = (e as PointerEvent).pointerId;
    if (id !== undefined && id !== this.activeId) return;
    this.activeId = null;
    this.handlers.onCancel();
  };
}
