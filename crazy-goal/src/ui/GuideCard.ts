import { tr } from '../core/i18n';
import type { GuideNeed } from '../core/Guide';
import type { GuideDef } from '../levels/LevelDefinition';
import type { Boost } from '../abilities/Cards';
import { ABILITY_ICON } from './abilityIcons';
import { ICON, MOVE_ART } from './KickIcons';

export interface GuideInfo {
  move: GuideDef['move'];
  /** 1-based lesson number and how many there are. */
  step: number;
  total: number;
  /** The control still to switch on, or null once the lesson is ready to be shot. */
  need: GuideNeed;
  /** An ability lesson: the boost it shows. */
  boost?: Boost;
}

export interface GuideCardHandlers {
  /** The lesson to show, or null when there is none (or something is over the screen). */
  info(): GuideInfo | null;
}

/** The lesson names: one or two words, big, over the picture of the move. */
const TITLE: Readonly<Record<GuideDef['move'], string>> = {
  straight: 'STRAIGHT SHOT',
  bend: 'BEND IT',
  air: 'LOB IT',
  bank: 'BANK IT',
  free: 'FREE KICK',
  coin: 'GRAB THE COIN',
  fire: 'HARISSA',
  magnet: 'MAGNET',
  rubber: 'RUBBER',
};

/**
 * The coach card at the top of the screen during the tutorial: lesson pips, an animated picture of the
 * move, its name, and two chips that say what to do (set the control, then pull back and let go).
 */
export class GuideCard {
  readonly el: HTMLElement;
  private readonly pips: HTMLElement;
  private readonly art: HTMLElement;
  private readonly title: HTMLElement;
  private readonly chips: HTMLElement;
  private last = '';

  constructor(private readonly handlers: GuideCardHandlers) {
    this.el = document.createElement('div');
    this.el.className = 'guide-card';
    this.el.hidden = true;
    this.el.setAttribute('role', 'status');
    this.pips = document.createElement('div');
    this.pips.className = 'guide-pips';
    this.art = document.createElement('div');
    this.art.className = 'guide-art';
    this.title = document.createElement('div');
    this.title.className = 'guide-title';
    this.chips = document.createElement('div');
    this.chips.className = 'guide-chips';
    const side = document.createElement('div');
    side.className = 'guide-side';
    side.append(this.title, this.chips);
    const body = document.createElement('div');
    body.className = 'guide-body';
    body.append(this.art, side);
    this.el.append(this.pips, body);
  }

  refresh(): void {
    const info = this.handlers.info();
    const key = info ? `${info.move}|${info.step}|${info.total}|${info.need}` : '';
    if (key === this.last) return;
    const was = this.last;
    this.last = key;
    this.el.hidden = !info;
    if (!info) return;
    this.el.dataset.move = info.move;
    this.pips.innerHTML = '';
    // One lesson on its own (a single level) needs no progress bar.
    this.pips.hidden = info.total <= 1;
    for (let i = 1; i <= info.total; i++) {
      const pip = document.createElement('span');
      pip.className = `guide-pip${i < info.step ? ' is-done' : i === info.step ? ' is-now' : ''}`;
      this.pips.append(pip);
    }
    const lesson = was.split('|').slice(0, 2).join('|');
    // The picture and the name change only when the lesson does, so the animation is not restarted by every tick.
    if (lesson !== `${info.move}|${info.step}`) {
      this.art.innerHTML = MOVE_ART[info.move]();
      const label = tr(TITLE[info.move]);
      this.title.textContent = label;
      this.el.setAttribute('aria-label', label);
      this.el.classList.remove('is-new');
      void this.el.offsetWidth;
      this.el.classList.add('is-new');
    }
    // Two chips: the control to set (when the lesson has one), then the pull.
    this.chips.innerHTML = '';
    if (info.move === 'bend' || info.move === 'air') {
      const set = document.createElement('span');
      const done = info.need === null;
      set.className = `guide-chip${done ? ' is-done' : ' is-now'}`;
      set.innerHTML = (info.move === 'air' ? ICON.air : ICON.bend) + (done ? `<i class="guide-tick">${ICON.check}</i>` : '');
      this.chips.append(set);
    }
    if (info.boost) {
      // An ability lesson: the ability is already on the ball. Its badge, ticked, then the pull.
      const on = document.createElement('span');
      on.className = 'guide-chip is-done is-ability';
      on.innerHTML = `<img src="${ABILITY_ICON[info.boost]}" alt="" draggable="false"><i class="guide-tick">${ICON.check}</i>`;
      this.chips.append(on);
    }
    const pull = document.createElement('span');
    pull.className = `guide-chip${info.need === null ? ' is-now' : ' is-wait'}`;
    pull.innerHTML = ICON.pull;
    this.chips.append(pull);
  }
}
