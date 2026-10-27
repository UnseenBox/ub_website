import type { AbilityDefinition, AbilityId } from '../../gameplay/Abilities';
import { el } from '../dom';

import coinUrl from '../../ui-kit/bonk2/assets/icons/coin@2x.png?url';
import powerDashUrl from '../../ui-kit/bonk2/assets/icons/power-dash@2x.png?url';
import powerSlamUrl from '../../ui-kit/bonk2/assets/icons/power-slam@2x.png?url';
import powerStaticUrl from '../../ui-kit/bonk2/assets/icons/power-static@2x.png?url';

/** Existing kit art for each power. */
export const ABILITY_ICONS: Record<AbilityId, string> = {
  blast: powerSlamUrl,
  overdrive: powerDashUrl,
  freeze: powerStaticUrl,
};

export interface AbilityCardOptions {
  /** Touch shows POWER instead of the keyboard key. */
  readonly touch: boolean;
  readonly owned: boolean;
  /** '' on success, otherwise the reason the purchase failed. */
  readonly buy: (id: AbilityId) => string;
  /** Called after a successful purchase so the host can refresh its wallet/goal. */
  readonly onBought?: (id: AbilityId) => void;
}

/** Kit image: never carries meaning on its own. */
function icon(src: string, className = 'b2-icon'): HTMLImageElement {
  const node = el('img', className);
  node.src = src;
  node.alt = '';
  node.decoding = 'async';
  return node;
}

function ownedBadge(): HTMLElement {
  const badge = el('span', 'b2-shop-card__owned', 'OWNED');
  badge.setAttribute('aria-label', 'Owned');
  return badge;
}

/** One ability card, shared by the pause menu and the store. */
export function buildAbilityCard(def: AbilityDefinition, options: AbilityCardOptions): HTMLElement {
  const card = el('article', 'b2-shop-card');
  card.title = def.blurb;
  card.classList.toggle('is-owned', options.owned);

  const iconWrap = el('div', 'b2-shop-card__icon-wrap');
  iconWrap.append(icon(ABILITY_ICONS[def.id], 'b2-icon b2-shop-card__icon'));

  const copy = el('div', 'b2-shop-card__copy');
  const nameRow = el('div', 'b2-shop-card__name-row');
  const name = el('h3', 'b2-shop-card__name', def.name);
  const key = el('span', 'b2-pause__key b2-shop-card__key', options.touch ? 'POWER' : def.key);
  key.title = options.touch ? 'Use the POWER button' : `Key ${def.key}`;
  nameRow.append(name, key);
  copy.append(nameRow, el('p', 'b2-shop-card__blurb', def.blurb));

  const meta = el('div', 'b2-shop-card__meta');
  if (options.owned) {
    meta.append(ownedBadge());
  } else {
    const cost = el('span', 'b2-shop-card__cost');
    cost.append(icon(coinUrl, 'b2-icon b2-shop-card__coin'), el('span', 'b2-num', String(def.cost)));
    const buy = el('button', 'b2-btn b2-btn--lime b2-btn--sm b2-shop-card__buy');
    buy.type = 'button';
    const accessible = `Buy ${def.name} for ${def.cost} scrap: ${def.blurb}`;
    buy.setAttribute('aria-label', accessible);
    buy.textContent = 'BUY';
    buy.addEventListener('click', () => {
      const failed = options.buy(def.id);
      if (!failed) {
        card.classList.add('is-owned');
        buy.replaceWith(ownedBadge());
        options.onBought?.(def.id);
        return;
      }
      buy.textContent = failed.toUpperCase();
      buy.setAttribute('aria-label', failed);
      buy.disabled = true;
      window.setTimeout(() => {
        if (!buy.isConnected) return;
        buy.textContent = 'BUY';
        buy.setAttribute('aria-label', accessible);
        buy.disabled = false;
      }, 1100);
    });
    meta.append(cost, buy);
  }
  copy.append(meta);

  card.append(iconWrap, copy);
  return card;
}
