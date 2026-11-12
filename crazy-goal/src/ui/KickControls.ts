import { tr } from '../core/i18n';
import type { ShotType } from '../physics/Flight';

export interface KickControlsHandlers {
  /** Solo play, the ball waiting or being aimed, nothing over the screen. */
  visible(): boolean;
  type(): ShotType;
  /** -1 (left) to 1 (right). */
  bend(): number;
  setType(type: ShotType): void;
  setBend(bend: number): void;
}

/**
 * The free-kick moves: GROUND or AIR, and a bend slider. Real buttons and a real range input, so
 * touch, mouse and keyboard all work. Sits low in the corner, over the stands, clear of the pitch.
 */
export class KickControls {
  readonly el: HTMLElement;
  private readonly ground: HTMLButtonElement;
  private readonly air: HTMLButtonElement;
  private readonly range: HTMLInputElement;
  private readonly out: HTMLElement;
  private last = '';

  constructor(private readonly handlers: KickControlsHandlers) {
    this.el = document.createElement('div');
    this.el.className = 'kick-controls';
    this.el.hidden = true;
    this.el.setAttribute('role', 'group');
    this.el.setAttribute('aria-label', tr('SHOT TYPE'));

    const seg = document.createElement('div');
    seg.className = 'kick-seg';
    this.ground = this.makeButton('GROUND', 'ground');
    this.air = this.makeButton('AIR', 'air');
    seg.append(this.ground, this.air);

    const row = document.createElement('label');
    row.className = 'kick-bend';
    const label = document.createElement('span');
    label.className = 'kick-label';
    label.textContent = tr('BEND');
    this.out = document.createElement('output');
    this.out.className = 'kick-out';
    const head = document.createElement('span');
    head.className = 'kick-head';
    head.append(label, this.out);
    this.range = document.createElement('input');
    this.range.type = 'range';
    this.range.className = 'kick-range';
    this.range.min = '-100';
    this.range.max = '100';
    this.range.step = '5';
    this.range.value = '0';
    // The slider is a left to right picture even in Arabic, like the pitch.
    this.range.dir = 'ltr';
    this.range.addEventListener('input', () => this.handlers.setBend(Number(this.range.value) / 100));
    // Keys on the slider are the slider's own: they must not pause, retry or mute the game.
    this.range.addEventListener('keydown', (e) => e.stopPropagation());
    const ends = document.createElement('span');
    ends.className = 'kick-ends';
    ends.dir = 'ltr';
    const left = document.createElement('span');
    left.textContent = tr('LEFT');
    const right = document.createElement('span');
    right.textContent = tr('RIGHT');
    ends.append(left, right);
    row.append(head, this.range, ends);

    this.el.append(seg, row);
  }

  private makeButton(label: string, type: ShotType): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'kick-type';
    b.textContent = tr(label);
    b.addEventListener('click', () => this.handlers.setType(type));
    return b;
  }

  refresh(): void {
    const visible = this.handlers.visible();
    const type = this.handlers.type();
    const bend = this.handlers.bend();
    const key = `${visible}|${type}|${bend}`;
    if (key === this.last) return;
    this.last = key;
    this.el.hidden = !visible;
    if (!visible) return;
    this.ground.classList.toggle('is-on', type === 'ground');
    this.air.classList.toggle('is-on', type === 'air');
    this.ground.setAttribute('aria-pressed', String(type === 'ground'));
    this.air.setAttribute('aria-pressed', String(type === 'air'));
    this.range.value = String(Math.round(bend * 100));
    const pct = Math.round(Math.abs(bend) * 100);
    this.out.textContent = bend === 0 ? tr('STRAIGHT') : `${pct}% ${tr(bend < 0 ? 'LEFT' : 'RIGHT')}`;
    this.range.setAttribute('aria-valuetext', this.out.textContent);
  }
}
