import type { ActionState, InputBackend, PointerMapper, PointerState } from './InputManager';

/**
 * Desktop backend. Holds raw key state and the pointer's last known logical
 * position, including whether the pointer is still over the play surface.
 */
export class KeyboardMouseInput implements InputBackend {
  private readonly down = new Set<string>();
  private readonly pressedThisStep = new Set<string>();
  private pointerX = 0;
  private pointerY = 0;
  private pointerInside = false;
  private primaryHeld = false;
  private primaryDown = false;
  private secondaryDown = false;
  private attached = false;

  constructor(
    private readonly surface: HTMLElement,
    private readonly mapper: PointerMapper,
  ) {}

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onBlur);
    this.surface.addEventListener('pointermove', this.onPointerMove);
    this.surface.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    this.surface.addEventListener('pointerleave', this.onPointerLeave);
    this.surface.addEventListener('pointerenter', this.onPointerMove);
    this.surface.addEventListener('contextmenu', this.onContextMenu);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onBlur);
    this.surface.removeEventListener('pointermove', this.onPointerMove);
    this.surface.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.surface.removeEventListener('pointerleave', this.onPointerLeave);
    this.surface.removeEventListener('pointerenter', this.onPointerMove);
    this.surface.removeEventListener('contextmenu', this.onContextMenu);
  }

  gather(actions: ActionState, pointer: PointerState): void {
    const d = this.down;
    if (d.has('KeyW') || d.has('ArrowUp')) actions.moveY -= 1;
    if (d.has('KeyS') || d.has('ArrowDown')) actions.moveY += 1;
    if (d.has('KeyA') || d.has('ArrowLeft')) actions.moveX -= 1;
    if (d.has('KeyD') || d.has('ArrowRight')) actions.moveX += 1;

    if (d.has('ShiftLeft') || d.has('ShiftRight')) actions.sprint = true;
    if (d.has('KeyC') || d.has('ControlLeft') || d.has('ControlRight')) actions.sneak = true;

    if (this.pressedThisStep.has('KeyE')) actions.interact = true;
    if (this.pressedThisStep.has('Space')) actions.hide = true;
    if (this.pressedThisStep.has('KeyF')) actions.flashlight = true;
    if (this.pressedThisStep.has('KeyQ') || this.pressedThisStep.has('KeyG')) actions.throwBottle = true;
    if (this.pressedThisStep.has('Escape')) actions.pause = true;
    if (this.pressedThisStep.has('KeyR')) actions.restart = true;
    if (this.pressedThisStep.has('F3')) actions.toggleDebug = true;

    if (this.primaryDown) actions.primary = true;
    if (this.secondaryDown) actions.secondary = true;

    pointer.x = this.pointerX;
    pointer.y = this.pointerY;
    pointer.inside = this.pointerInside;
    pointer.primaryHeld = this.primaryHeld;
    if (this.primaryDown) pointer.primaryDown = true;
    if (this.secondaryDown) pointer.secondaryDown = true;
  }

  endStep(): void {
    this.pressedThisStep.clear();
    this.primaryDown = false;
    this.secondaryDown = false;
  }

  releaseAll(): void {
    this.down.clear();
    this.pressedThisStep.clear();
    this.primaryHeld = false;
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    // Stop the page from scrolling or the browser from stealing our keys.
    if (
      e.code === 'Space' ||
      e.code === 'F3' ||
      e.code.startsWith('Arrow') ||
      e.code === 'Tab'
    ) {
      e.preventDefault();
    }
    if (e.repeat) return;
    this.down.add(e.code);
    this.pressedThisStep.add(e.code);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code);
  };

  private readonly onBlur = (): void => {
    this.releaseAll();
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    const p = this.mapper(e.clientX, e.clientY);
    this.pointerX = p.x;
    this.pointerY = p.y;
    this.pointerInside = p.inside;
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    this.onPointerMove(e);
    if (e.button === 0) {
      this.primaryDown = true;
      this.primaryHeld = true;
    } else if (e.button === 2) {
      this.secondaryDown = true;
    }
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (e.button === 0) this.primaryHeld = false;
  };

  private readonly onPointerLeave = (): void => {
    this.pointerInside = false;
    this.primaryHeld = false;
  };

  private readonly onContextMenu = (e: Event): void => {
    // Right click is a gameplay action, so suppress the browser menu.
    e.preventDefault();
  };
}
