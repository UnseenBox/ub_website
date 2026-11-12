import { tr } from '../core/i18n';
import { snapBend } from '../core/Guide';
import type { ShotType } from '../physics/Flight';
import { bendGlyph, ICON } from './KickIcons';

export interface KickControlsHandlers {
  /** Solo play, the ball waiting or being aimed, nothing over the screen. */
  visible(): boolean;
  /** Which controls to show: a lesson shows only the one it teaches. */
  parts(): { air: boolean; bend: boolean };
  /** The control a lesson asks for next, drawn with a pulsing ring and a finger. */
  hint(): 'air' | 'bend' | null;
  type(): ShotType;
  /** -1 (left) to 1 (right). */
  bend(): number;
  setType(type: ShotType): void;
  setBend(bend: number): void;
}

/**
 * The free-kick controls, as pictures: two big round buttons (the ball on the ground, the ball over a
 * defender) and a bend dial with a live curve. No words on screen; the names live in aria-labels.
 * Real buttons and a real range input underneath, so touch, mouse and keyboard all work.
 */
export class KickControls {
  readonly el: HTMLElement;
  private readonly modes: HTMLElement;
  private readonly ground: HTMLButtonElement;
  private readonly air: HTMLButtonElement;
  private readonly bendBox: HTMLElement;
  private readonly range: HTMLInputElement;
  private readonly curve: SVGElement;
  private last = '';

  constructor(private readonly handlers: KickControlsHandlers) {
    this.el = document.createElement('div');
    this.el.className = 'kick-dock';
    this.el.hidden = true;
    this.el.setAttribute('role', 'group');
    this.el.setAttribute('aria-label', tr('SHOT TYPE'));

    this.modes = document.createElement('div');
    this.modes.className = 'kick-modes';
    this.ground = this.makeButton('GROUND', ICON.ground, 'ground');
    this.air = this.makeButton('AIR', ICON.air, 'air');
    this.modes.append(this.ground, this.air);

    this.bendBox = document.createElement('label');
    this.bendBox.className = 'kick-bend';
    this.bendBox.setAttribute('aria-label', tr('BEND'));
    this.curve = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.curve.setAttribute('viewBox', '0 0 80 56');
    this.curve.setAttribute('class', 'kick-curve');
    this.curve.setAttribute('aria-hidden', 'true');
    this.range = document.createElement('input');
    this.range.type = 'range';
    this.range.className = 'kick-range';
    this.range.min = '-100';
    this.range.max = '100';
    this.range.step = '5';
    this.range.value = '0';
    // The dial is a left to right picture even in Arabic, like the pitch.
    this.range.dir = 'ltr';
    this.range.addEventListener('input', () => {
      const bend = snapBend(Number(this.range.value) / 100);
      this.handlers.setBend(bend);
      this.range.value = String(Math.round(bend * 100));
      this.refresh();
    });
    // Keys on the dial are its own: they must not pause, retry or mute the game.
    this.range.addEventListener('keydown', (e) => e.stopPropagation());
    const tap = document.createElement('span');
    tap.className = 'kick-finger';
    tap.innerHTML = ICON.tap;
    this.bendBox.append(this.curve, this.range, tap);

    const airFinger = document.createElement('span');
    airFinger.className = 'kick-finger';
    airFinger.innerHTML = ICON.tap;
    this.air.append(airFinger);

    this.el.append(this.modes, this.bendBox);
  }

  private makeButton(label: string, icon: string, type: ShotType): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `kick-mode kick-mode-${type}`;
    b.setAttribute('aria-label', tr(label));
    b.innerHTML = icon;
    b.addEventListener('click', () => {
      if (this.handlers.type() !== type) this.burst(b);
      this.handlers.setType(type);
      this.refresh();
    });
    return b;
  }

  /** A ring of light round a button when it is switched on. */
  private burst(on: HTMLElement): void {
    on.classList.remove('is-burst');
    void on.offsetWidth;
    on.classList.add('is-burst');
  }

  refresh(): void {
    const visible = this.handlers.visible();
    const parts = this.handlers.parts();
    const type = this.handlers.type();
    const bend = this.handlers.bend();
    const hint = this.handlers.hint();
    const key = `${visible}|${parts.air}|${parts.bend}|${type}|${bend}|${hint}`;
    if (key === this.last) return;
    this.last = key;
    const show = visible && (parts.air || parts.bend);
    this.el.hidden = !show;
    if (!show) return;
    this.modes.hidden = !parts.air;
    this.bendBox.hidden = !parts.bend;
    this.ground.classList.toggle('is-on', type === 'ground');
    this.air.classList.toggle('is-on', type === 'air');
    this.ground.setAttribute('aria-pressed', String(type === 'ground'));
    this.air.setAttribute('aria-pressed', String(type === 'air'));
    this.air.classList.toggle('is-hint', hint === 'air');
    this.bendBox.classList.toggle('is-hint', hint === 'bend');
    this.range.value = String(Math.round(bend * 100));
    // The curve shows where the ball will go; the fill and the glow show how much, and which side.
    this.curve.innerHTML = bendGlyph(bend);
    const left = Math.max(0, -bend) * 50;
    const right = Math.max(0, bend) * 50;
    this.range.style.setProperty('--fill', `linear-gradient(90deg, transparent ${50 - left}%, var(--sun) ${50 - left}%, var(--sun) ${50 + right}%, transparent ${50 + right}%)`);
    this.bendBox.classList.toggle('is-bent', bend !== 0);
    const pct = Math.round(Math.abs(bend) * 100);
    this.range.setAttribute('aria-valuetext', bend === 0 ? tr('STRAIGHT') : `${pct}% ${tr(bend < 0 ? 'LEFT' : 'RIGHT')}`);
  }
}
