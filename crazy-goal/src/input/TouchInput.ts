/**
 * Touch arrives through Pointer Events like the mouse does; this only stops the browser
 * from treating a pull-back as a scroll, a pinch or a long-press menu.
 */
export class TouchInput {
  private readonly offs: Array<() => void> = [];

  constructor(target: HTMLElement) {
    target.style.touchAction = 'none';
    const stop = (e: Event): void => {
      if (e.cancelable) e.preventDefault();
    };
    for (const type of ['touchstart', 'touchmove', 'gesturestart', 'gesturechange']) {
      target.addEventListener(type, stop, { passive: false });
      this.offs.push(() => target.removeEventListener(type, stop));
    }
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
  }
}
