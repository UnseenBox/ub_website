import { tr } from '../core/i18n';
import { snapBend } from '../core/Guide';
import type { ShotType } from '../physics/Flight';
import { footballUrl } from './Football';
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
  /** A click for the ear when a dial lands on a notch. */
  tick?(): void;
}

/**
 * The free-kick controls: a GROUND and an AIR button, and a BEND dial with a live curve.
 * Every control has its name on screen, and each is a real button or range input, so touch, mouse and keyboard all work.
 */
export class KickControls {
  readonly el: HTMLElement;
  private readonly modes: HTMLElement;
  private readonly ground: HTMLButtonElement;
  private readonly air: HTMLButtonElement;
  private readonly bendBox: HTMLElement;
  private readonly bendValue: HTMLElement;
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
    const airFinger = document.createElement('span');
    airFinger.className = 'kick-finger';
    airFinger.innerHTML = ICON.tap;
    this.air.append(airFinger);
    this.modes.append(this.ground, this.air);

    // BEND: its title and value, the curve it makes, and the dial under the curve.
    this.bendBox = document.createElement('label');
    this.bendBox.className = 'kick-bend';
    this.bendBox.setAttribute('aria-label', tr('BEND'));
    const bendHead = document.createElement('div');
    bendHead.className = 'kick-head';
    this.bendValue = document.createElement('span');
    this.bendValue.className = 'kick-value';
    bendHead.append(this.title('BEND'), this.bendValue);
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
    // The knob is the ball itself.
    this.range.style.setProperty('--ball', footballUrl());
    this.range.addEventListener('input', () => {
      const before = this.handlers.bend();
      const bend = snapBend(Number(this.range.value) / 100);
      this.handlers.setBend(bend);
      // A tick and a buzz when it lands on straight or on full bend: you can feel the notches.
      if (bend !== before && (bend === 0 || Math.abs(bend) === 1)) this.feedback();
      this.range.value = String(Math.round(bend * 100));
      this.refresh();
    });
    // Keys on the dial are its own: they must not pause, retry or mute the game.
    this.range.addEventListener('keydown', (e) => e.stopPropagation());
    // Tapping the picture of the curve puts the dial back to straight.
    this.curve.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.handlers.bend() === 0) return;
      this.handlers.setBend(0);
      this.feedback();
      this.refresh();
    });
    const bendFinger = document.createElement('span');
    bendFinger.className = 'kick-finger';
    bendFinger.innerHTML = ICON.tap;
    this.bendBox.append(bendHead, this.curve, this.range, bendFinger);


    this.el.append(this.modes, this.bendBox);
  }

  private makeButton(label: string, icon: string, type: ShotType): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `kick-mode kick-mode-${type}`;
    b.setAttribute('aria-label', tr(label));
    const art = document.createElement('span');
    art.className = 'kick-mode-art';
    art.innerHTML = icon;
    const name = document.createElement('span');
    name.className = 'kick-mode-name';
    name.textContent = tr(label);
    b.append(art, name);
    b.addEventListener('click', () => {
      if (this.handlers.type() !== type) {
        this.burst(b);
        this.feedback();
      }
      this.handlers.setType(type);
      this.refresh();
    });
    return b;
  }

  private title(label: string): HTMLElement {
    const t = document.createElement('span');
    t.className = 'kick-title';
    t.textContent = tr(label);
    return t;
  }

  private feedback(): void {
    this.handlers.tick?.();
    try {
      navigator.vibrate?.(8);
    } catch {
      /* no vibration motor, or not allowed: the click is enough */
    }
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

    // BEND: the dial, the curve it makes (its fill and glow show how much, and which side), and the words for it.
    this.range.value = String(Math.round(bend * 100));
    this.curve.innerHTML = bendGlyph(bend, type === 'air');
    this.bendBox.classList.toggle('is-bent', bend !== 0);
    const pct = Math.round(Math.abs(bend) * 100);
    const bendText = bend === 0 ? tr('STRAIGHT') : `${tr(bend < 0 ? 'LEFT' : 'RIGHT')} ${pct}%`;
    this.bendValue.textContent = bendText;
    this.range.setAttribute('aria-valuetext', bendText);
    const left = Math.max(0, -bend) * 50;
    const right = Math.max(0, bend) * 50;
    this.range.style.setProperty('--fill', `linear-gradient(90deg, transparent ${50 - left}%, var(--sun) ${50 - left}%, var(--sun) ${50 + right}%, transparent ${50 + right}%)`);
  }
}
