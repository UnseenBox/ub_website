import fireIcon from '../assets/ui/ability-fire.png';
import magnetIcon from '../assets/ui/ability-magnet.png';
import rubberIcon from '../assets/ui/ability-rubber.png';
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

/** The hand-drawn circular badge artwork for each boost. */
const ART: Record<Boost, string> = {
  fire: fireIcon,
  magnet: magnetIcon,
  rubber: rubberIcon,
};

/**
 * The solo ability sidebar: three boosts with coin prices and the wallet,
 * stacked vertically on the right. Each boost is its circular badge artwork
 * with a price tag on the corner and a name plate under it. Tap to arm for
 * the next shot, tap again to take it back off (refunded). Paid boosts
 * ride exactly one shot.
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
      const img = document.createElement('img');
      img.src = ART[id];
      img.alt = '';
      img.draggable = false;
      iconWrap.append(img);
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
