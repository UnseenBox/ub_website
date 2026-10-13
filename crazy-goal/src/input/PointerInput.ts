import type { InputSink } from './InputSink';

/** Mouse, pen and touch through Pointer Events. One pointer at a time owns the drag. */
export class PointerInput {
  private active = -1;
  private readonly offs: Array<() => void> = [];

  constructor(
    private readonly target: HTMLElement,
    private readonly sink: InputSink,
  ) {
    this.listen('pointerdown', this.onDown);
    this.listen('pointermove', this.onMove);
    this.listen('pointerup', this.onUp);
    this.listen('pointercancel', this.onLost);
    // Losing capture without a pointerup means the browser took the pointer away: never fire a shot.
    this.listen('lostpointercapture', this.onLost);
    this.listen('contextmenu', (e) => e.preventDefault());
    const blur = (): void => this.cancel();
    window.addEventListener('blur', blur);
    this.offs.push(() => window.removeEventListener('blur', blur));
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
  }

  private listen<K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void): void {
    this.target.addEventListener(type, fn);
    this.offs.push(() => this.target.removeEventListener(type, fn));
  }

  private local(e: PointerEvent): { x: number; y: number } {
    const rect = this.target.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private cancel(): void {
    if (this.active < 0) return;
    this.active = -1;
    this.sink.pointerCancel();
  }

  private readonly onDown = (e: PointerEvent): void => {
    this.sink.gesture();
    if (this.active >= 0) {
      // A second button or finger during a drag is a deliberate "never mind".
      this.cancel();
      return;
    }
    if (e.button !== 0) return;
    this.active = e.pointerId;
    // Capture keeps the drag alive when the pointer wanders off the canvas.
    try {
      this.target.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety, not a requirement */
    }
    const p = this.local(e);
    this.sink.pointerDown(p.x, p.y, e.pointerType === 'touch');
  };

  private readonly onMove = (e: PointerEvent): void => {
    if (this.active >= 0 && e.pointerId !== this.active) return;
    const p = this.local(e);
    this.sink.pointerMove(p.x, p.y);
  };

  private readonly onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.active) return;
    this.active = -1;
    const p = this.local(e);
    this.sink.pointerUp(p.x, p.y);
  };

  private readonly onLost = (e: PointerEvent): void => {
    if (e.pointerId === this.active) this.cancel();
  };
}
