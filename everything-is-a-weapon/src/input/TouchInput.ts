import type { InputAction, InputSource, RawInput } from './InputManager';

const STICK_RADIUS = 52;
const AIM_DEADZONE = 16;
const MOVE_ZONE = 0.42;

/**
 * Phone controls.
 *   left thumb   — floating move stick (appears where you touch)
 *   right thumb  — tap to grab the highlighted object; while carrying, hold to charge and
 *                  release to throw. Drag to aim by hand, or just tap/hold and the throw
 *                  goes at the nearest intruder.
 *   buttons      — DODGE, and DROP while carrying
 * The adapter only fills in RawInput; gameplay never knows a touch screen is involved.
 */
export class TouchInput implements InputSource {
  private raw: RawInput | null = null;
  private target: HTMLElement | null = null;
  private readonly abort = new AbortController();

  private moveId = -1;
  private moveX = 0;
  private moveY = 0;
  private aimId = -1;
  private aimX = 0;
  private aimY = 0;

  private root: HTMLElement | null = null;
  private moveBase: HTMLElement | null = null;
  private moveKnob: HTMLElement | null = null;
  private aimBase: HTMLElement | null = null;
  private aimKnob: HTMLElement | null = null;

  attach(target: HTMLElement, raw: RawInput, _emit: (action: InputAction) => void): void {
    this.raw = raw;
    this.target = target;
    const options = { signal: this.abort.signal, passive: false };
    target.addEventListener('pointerdown', this.onDown, options);
    window.addEventListener('pointermove', this.onMove, options);
    window.addEventListener('pointerup', this.onUp, options);
    window.addEventListener('pointercancel', this.onUp, options);
    // Stops long-press menus, text selection and double-tap zoom from interrupting play.
    target.addEventListener('touchstart', (event) => event.preventDefault(), options);

    this.buildUi(target.parentElement ?? document.body);
    if (window.matchMedia?.('(pointer: coarse)').matches) this.enterTouchMode();
  }

  detach(): void {
    this.abort.abort();
    this.root?.remove();
  }

  private enterTouchMode(): void {
    if (!this.raw) return;
    this.raw.directional = true;
    document.body.classList.add('touch');
  }

  private buildUi(parent: HTMLElement): void {
    const make = (className: string, into: HTMLElement, text = ''): HTMLElement => {
      const node = document.createElement('div');
      node.className = className;
      node.textContent = text;
      into.append(node);
      return node;
    };
    const root = make('touch-ui', parent);
    this.moveBase = make('stick', root);
    this.moveKnob = make('stick-knob', this.moveBase);
    this.aimBase = make('stick aim', root);
    this.aimKnob = make('stick-knob', this.aimBase);

    const button = (className: string, text: string, onPress: () => void): void => {
      const node = document.createElement('button');
      node.type = 'button';
      node.className = `touch-btn ${className}`;
      node.textContent = text;
      node.addEventListener(
        'pointerdown',
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          onPress();
        },
        { signal: this.abort.signal },
      );
      root.append(node);
    };
    button('dodge', 'DODGE', () => {
      if (this.raw) this.raw.dodgePresses++;
    });
    button('drop', 'DROP', () => {
      if (this.raw) this.raw.secondaryPresses++;
    });
    // One POWER button for every bought ability: it fires the first one ready.
    button('power', 'POWER', () => {
      if (this.raw) this.raw.abilitySlot = -1;
    });
    this.root = root;
  }

  private local(event: PointerEvent): { x: number; y: number; width: number } {
    const rect = this.target!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top, width: rect.width };
  }

  private place(base: HTMLElement | null, x: number, y: number, visible: boolean): void {
    if (!base) return;
    base.style.transform = `translate(${x}px, ${y}px)`;
    base.classList.toggle('active', visible);
  }

  private knob(knob: HTMLElement | null, dx: number, dy: number): void {
    if (knob) knob.style.transform = `translate(${dx * STICK_RADIUS}px, ${dy * STICK_RADIUS}px)`;
  }

  private onDown = (event: PointerEvent): void => {
    const raw = this.raw;
    if (!raw || event.pointerType !== 'touch') return;
    event.preventDefault();
    this.enterTouchMode();
    const p = this.local(event);

    if (p.x < p.width * MOVE_ZONE && this.moveId < 0) {
      this.moveId = event.pointerId;
      this.moveX = p.x;
      this.moveY = p.y;
      this.place(this.moveBase, p.x, p.y, true);
      this.knob(this.moveKnob, 0, 0);
    } else if (this.aimId < 0) {
      this.aimId = event.pointerId;
      this.aimX = p.x;
      this.aimY = p.y;
      raw.aimIdle = true;
      raw.primaryDown = true;
      raw.primaryPresses++;
      this.place(this.aimBase, p.x, p.y, true);
      this.knob(this.aimKnob, 0, 0);
    }
  };

  private onMove = (event: PointerEvent): void => {
    const raw = this.raw;
    if (!raw || event.pointerType !== 'touch') return;
    const p = this.local(event);

    if (event.pointerId === this.moveId) {
      let dx = (p.x - this.moveX) / STICK_RADIUS;
      let dy = (p.y - this.moveY) / STICK_RADIUS;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      // A small dead zone so a resting thumb does not creep.
      const active = len > 0.18;
      raw.moveX = active ? dx : 0;
      raw.moveY = active ? dy : 0;
      this.knob(this.moveKnob, dx, dy);
      // Face the way you walk unless the right thumb is aiming.
      if (active && this.aimId < 0) {
        const n = Math.hypot(dx, dy);
        raw.aimDirX = dx / n;
        raw.aimDirY = dy / n;
      }
    } else if (event.pointerId === this.aimId) {
      const dx = p.x - this.aimX;
      const dy = p.y - this.aimY;
      const len = Math.hypot(dx, dy);
      if (len > AIM_DEADZONE) {
        raw.aimDirX = dx / len;
        raw.aimDirY = dy / len;
        raw.aimIdle = false;
      }
      const clamped = Math.min(1, len / STICK_RADIUS);
      this.knob(this.aimKnob, len > 0 ? (dx / len) * clamped : 0, len > 0 ? (dy / len) * clamped : 0);
    }
  };

  private onUp = (event: PointerEvent): void => {
    const raw = this.raw;
    if (!raw || event.pointerType !== 'touch') return;
    if (event.pointerId === this.moveId) {
      this.moveId = -1;
      raw.moveX = 0;
      raw.moveY = 0;
      this.place(this.moveBase, this.moveX, this.moveY, false);
    } else if (event.pointerId === this.aimId) {
      this.aimId = -1;
      raw.primaryDown = false;
      raw.primaryReleases++;
      // aimIdle is cleared on the next touch, so the release tick still uses the dragged direction.
      this.place(this.aimBase, this.aimX, this.aimY, false);
    }
  };
}
