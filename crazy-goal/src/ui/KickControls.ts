import { tr } from '../core/i18n';
import { snapBend } from '../core/Guide';
import { snapHeight, type ShotType } from '../physics/Flight';
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
  /** The height of the lob, 0 (low) to 1 (high): the one picked, or the power's own while it is automatic. */
  height(): number;
  /** True while the height is the automatic one the power gives. */
  heightAuto(): boolean;
  setType(type: ShotType): void;
  setBend(bend: number): void;
  /** Picking a height makes the shot a lofted one. */
  setHeight(height: number): void;
  /** Back to the height the power gives on its own. */
  resetHeight(): void;
  /** A click for the ear when a dial lands on a notch. */
  tick?(): void;
}

/**
 * The free-kick controls: a GROUND and an AIR button, a BEND dial with a live curve, and a HEIGHT slider for the lob.
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
  private readonly heightBox: HTMLElement;
  private readonly heightValue: HTMLButtonElement;
  private readonly heightRange: HTMLInputElement;
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

    // HEIGHT: how high the lob goes. Its value says AUTO while the power picks it; tapping a picked value gives it back.
    this.heightBox = document.createElement('div');
    this.heightBox.className = 'kick-height';
    this.heightBox.setAttribute('role', 'group');
    this.heightBox.setAttribute('aria-label', tr('HEIGHT'));
    this.heightValue = document.createElement('button');
    this.heightValue.type = 'button';
    this.heightValue.className = 'kick-value kick-auto';
    this.heightValue.addEventListener('click', () => {
      if (this.handlers.heightAuto()) return;
      this.handlers.resetHeight();
      this.feedback();
      this.refresh();
    });
    const heightHead = document.createElement('div');
    heightHead.className = 'kick-head';
    heightHead.append(this.title('HEIGHT'), this.heightValue);
    const track = document.createElement('div');
    track.className = 'kick-height-track';
    this.heightRange = document.createElement('input');
    this.heightRange.type = 'range';
    this.heightRange.className = 'kick-range kick-height-range';
    this.heightRange.min = '0';
    this.heightRange.max = '100';
    this.heightRange.step = '5';
    this.heightRange.value = '0';
    // The slider runs low to high from left to right in its own frame; the CSS turns it upright.
    this.heightRange.dir = 'ltr';
    this.heightRange.setAttribute('aria-label', tr('HEIGHT'));
    this.heightRange.addEventListener('input', () => {
      const before = this.handlers.height();
      const height = snapHeight(Number(this.heightRange.value) / 100);
      this.handlers.setHeight(height);
      if (height !== before && (height === 0 || height === 1)) this.feedback();
      this.heightRange.value = String(Math.round(height * 100));
      this.refresh();
    });
    this.heightRange.addEventListener('keydown', (e) => e.stopPropagation());
    track.append(this.heightRange);
    this.heightBox.append(heightHead, track);

    this.el.append(this.modes, this.bendBox, this.heightBox);
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
    const height = this.handlers.height();
    const auto = this.handlers.heightAuto();
    const hint = this.handlers.hint();
    const key = `${visible}|${parts.air}|${parts.bend}|${type}|${bend}|${height.toFixed(2)}|${auto}|${hint}`;
    if (key === this.last) return;
    this.last = key;
    const show = visible && (parts.air || parts.bend);
    this.el.hidden = !show;
    if (!show) return;
    this.modes.hidden = !parts.air;
    this.heightBox.hidden = !parts.air;
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

    // HEIGHT: dimmed until the shot is a lofted one, and its value says AUTO while the power picks the height.
    const pctHeight = Math.round(height * 100);
    this.heightBox.classList.toggle('is-off', type !== 'air');
    this.heightRange.value = String(pctHeight);
    this.heightRange.style.setProperty('--fill', `linear-gradient(90deg, var(--sun) ${pctHeight}%, transparent ${pctHeight}%)`);
    this.heightValue.textContent = auto ? tr('AUTO') : `${pctHeight}%`;
    this.heightValue.classList.toggle('is-auto', auto);
    this.heightRange.setAttribute('aria-valuetext', auto ? tr('AUTO') : `${pctHeight}%`);
  }
}
