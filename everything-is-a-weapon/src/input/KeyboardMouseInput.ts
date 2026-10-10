import type { InputAction, InputSource, RawInput } from './InputManager';

const MOVE_KEYS: Readonly<Record<string, readonly [number, number]>> = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export class KeyboardMouseInput implements InputSource {
  private raw: RawInput | null = null;
  private target: HTMLElement | null = null;
  private emit: (action: InputAction) => void = () => {};
  private readonly held = new Set<string>();
  private readonly abort = new AbortController();

  attach(target: HTMLElement, raw: RawInput, emit: (action: InputAction) => void): void {
    this.raw = raw;
    this.target = target;
    this.emit = emit;
    const options = { signal: this.abort.signal };

    window.addEventListener('keydown', this.onKeyDown, options);
    window.addEventListener('keyup', this.onKeyUp, options);
    window.addEventListener('blur', this.onBlur, options);
    target.addEventListener('pointerdown', this.onPointerDown, options);
    window.addEventListener('pointerup', this.onPointerUp, options);
    window.addEventListener('pointermove', this.onPointerMove, options);
    target.addEventListener('contextmenu', (event) => event.preventDefault(), options);
  }

  detach(): void {
    this.abort.abort();
  }

  private updateMove(): void {
    if (!this.raw) return;
    let x = 0;
    let y = 0;
    for (const code of this.held) {
      const dir = MOVE_KEYS[code];
      if (dir) {
        x += dir[0];
        y += dir[1];
      }
    }
    this.raw.moveX = Math.sign(x);
    this.raw.moveY = Math.sign(y);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.raw) return;
    const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
    if (typing) return;
    if (event.code in MOVE_KEYS) {
      this.held.add(event.code);
      this.updateMove();
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    switch (event.code) {
      case 'Space':
        this.raw.dodgePresses++;
        event.preventDefault();
        break;
      case 'Digit1':
      case 'Digit2':
      case 'Digit3':
        // Bought abilities: the last key pressed this tick wins.
        this.raw.abilitySlot = Number(event.code.slice(-1));
        break;
      case 'KeyR':
        this.emit('restart');
        break;
      case 'KeyP':
      case 'Escape':
        // Escape also leaves fullscreen in a browser, so P does the same job without that.
        this.emit('pause');
        break;
      case 'F3':
        this.emit('debug');
        event.preventDefault();
        break;
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    if (this.held.delete(event.code)) this.updateMove();
  };

  private onBlur = (): void => {
    this.held.clear();
    this.updateMove();
    if (this.raw && this.raw.primaryDown) {
      this.raw.primaryDown = false;
      this.raw.primaryReleases++;
    }
  };

  private setPointer(event: PointerEvent): void {
    if (!this.raw || !this.target) return;
    const rect = this.target.getBoundingClientRect();
    this.raw.directional = false;
    this.raw.pointerX = event.clientX - rect.left;
    this.raw.pointerY = event.clientY - rect.top;
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.raw || event.pointerType === 'touch') return;
    this.setPointer(event);
    if (event.button === 0) {
      this.raw.primaryDown = true;
      this.raw.primaryPresses++;
    } else if (event.button === 2) {
      this.raw.secondaryPresses++;
    }
    event.preventDefault();
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.raw || event.pointerType === 'touch') return;
    if (event.button === 0 && this.raw.primaryDown) {
      this.raw.primaryDown = false;
      this.raw.primaryReleases++;
    }
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return;
    this.setPointer(event);
  };
}
