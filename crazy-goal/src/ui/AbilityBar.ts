import { cardOf, type Boost } from '../abilities/Cards';
import { tr } from '../core/i18n';

export interface AbilityBarHandlers {
  wallet(): number;
  armed(): Boost | null;
  /** Solo free play, ball waiting to be struck, nothing covering the screen. */
  canShow(): boolean;
  buy(id: Boost): void;
}

const SHOP: readonly Boost[] = ['fire', 'magnet', 'rubber'];

/** SVG icons for each boost — 24×24, currentColor. */
const ICONS: Record<Boost, string> = {
  fire: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/></svg>`,
  magnet: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 3h4v7a2 2 0 0 0 4 0V3h4v7a6 6 0 0 1-12 0V3z"/><path d="M6 3h4v4H6zM14 3h4v4h-4z" opacity=".55"/></svg>`,
  rubber: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="14" r="6" fill="currentColor" stroke="none"/><path d="M2.5 8.5c2.5-2.5 5.5-2.5 8 0"/><path d="M13.5 5.5c2.5-2.5 5.5-2.5 8 0"/></svg>`,
};

/**
 * The solo ability sidebar: three boosts with coin prices and the wallet,
 * stacked vertically on the right. Each card has an SVG icon, name, cost,
 * and a live glow when armed. Tap to arm for the next shot, tap again
 * to take it back off (refunded). Paid boosts ride exactly one shot.
 */
export class AbilityBar {
  readonly el: HTMLElement;
  private readonly coinCount: HTMLElement;
  private readonly buttons = new Map<Boost, HTMLButtonElement>();
  private last = '';

  constructor(private readonly handlers: AbilityBarHandlers) {
    this.el = document.createElement('div');
    this.el.className = 'ability-bar';
    this.el.hidden = true;

    // Wallet at the top
    const wallet = document.createElement('div');
    wallet.className = 'coin-pill';
    const dot = document.createElement('span');
    dot.className = 'coin-dot';
    this.coinCount = document.createElement('span');
    this.coinCount.className = 'coin-n';
    wallet.append(dot, this.coinCount);
    this.el.append(wallet);

    // Three ability cards
    for (const id of SHOP) {
      const card = cardOf(id);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ability-card';
      b.style.setProperty('--card', card.color);
      b.dataset.boost = id;
      const iconWrap = document.createElement('span');
      iconWrap.className = 'ability-icon';
      iconWrap.innerHTML = ICONS[id];
      const name = document.createElement('span');
      name.className = 'ability-name';
      const cost = document.createElement('span');
      cost.className = 'ability-cost';
      b.append(iconWrap, name, cost);
      b.addEventListener('click', () => this.handlers.buy(id));
      this.buttons.set(id, b);
      this.el.append(b);
    }
  }

  refresh(costs: Readonly<Record<Boost, number>>): void {
    const visible = this.handlers.canShow();
    const wallet = this.handlers.wallet();
    const armed = this.handlers.armed();
    const key = `${visible}|${wallet}|${armed}`;
    if (key === this.last) return;
    this.last = key;
    this.el.hidden = !visible;
    if (!visible) return;
    this.coinCount.textContent = String(wallet);
    this.el.querySelector('.coin-pill')?.setAttribute('aria-label', tr('{n} COINS', { n: wallet }));
    for (const [id, b] of this.buttons) {
      const card = cardOf(id);
      const cost = costs[id];
      const isArmed = armed === id;
      const afford = wallet >= cost;
      b.disabled = !isArmed && !afford;
      b.classList.toggle('is-armed', isArmed);
      b.title = tr(card.blurb);
      b.setAttribute('aria-label', isArmed ? `${tr(card.name)} — ${tr('ARMED')}` : afford ? `${tr(card.name)} — ${tr(card.blurb)}` : tr('NOT ENOUGH COINS'));
      (b.querySelector('.ability-name') as HTMLElement).textContent = tr(card.name);
      (b.querySelector('.ability-cost') as HTMLElement).textContent = isArmed ? '✓' : `◉${cost}`;
    }
  }
}
