import type { Game } from '../../core/Game';
import type { HeroId } from '../../core/Hero';
import { ABILITIES, type AbilityId } from '../../gameplay/Abilities';
import { totalStars } from '../../gameplay/Campaign';
import { nextUnlock, type UnlockGoal } from '../../gameplay/Progression';
import { LEDGER } from '../../gameplay/StarLedger';
import {
  isUpgradeMaxed,
  nextUpgradeCost,
  nextUpgradeEffect,
  UPGRADES,
  upgradeEffect,
  upgradeLevel,
  type UpgradeId,
} from '../../gameplay/Upgrades';
import { el } from '../dom';
import { buildAbilityCard } from './shopCards';

import coinUrl from '../../ui-kit/bonk2/assets/icons/coin@2x.png?url';
import keyUrl from '../../ui-kit/bonk2/assets/icons/key@2x.png?url';
import petDachshundUrl from '../../ui-kit/bonk2/assets/icons/pet-dachshund@2x.png?url';
import petGingerUrl from '../../ui-kit/bonk2/assets/icons/pet-ginger@2x.png?url';
import petHamsterUrl from '../../ui-kit/bonk2/assets/icons/pet-hamster@2x.png?url';
import petParrotUrl from '../../ui-kit/bonk2/assets/icons/pet-parrot@2x.png?url';
import powerDashUrl from '../../ui-kit/bonk2/assets/icons/power-dash@2x.png?url';
import trophyUrl from '../../ui-kit/bonk2/assets/icons/trophy@2x.png?url';

export interface StoreActions {
  /** '' on success, otherwise the reason. */
  buyUpgrade(id: UpgradeId): string;
  /** '' on success, otherwise the reason. */
  buyAbility(id: AbilityId): string;
  back(): void;
}

/** Existing kit art for each upgrade track. */
const UPGRADE_ICONS: Record<'key' | 'coin' | 'dash' | 'trophy', string> = {
  key: keyUrl,
  coin: coinUrl,
  dash: powerDashUrl,
  trophy: trophyUrl,
};

/** Waffle, Biscuit, Captain and Nugget, in the same order as the heroes. */
const PET_ICONS: Record<HeroId, string> = {
  tenant: petDachshundUrl,
  flatmate: petGingerUrl,
  gran: petParrotUrl,
  kid: petHamsterUrl,
};

function icon(src: string, className: string): HTMLImageElement {
  const node = el('img', className);
  node.src = src;
  node.alt = '';
  node.decoding = 'async';
  node.draggable = false;
  return node;
}

function upgradeIcon(game: Game, key: 'key' | 'coin' | 'dash' | 'trophy' | 'pet'): string {
  return key === 'pet' ? PET_ICONS[game.hero] : UPGRADE_ICONS[key];
}

function pips(level: number, max: number): string {
  return '●'.repeat(level) + '○'.repeat(Math.max(0, max - level));
}

function maxedStamp(): HTMLElement {
  const badge = el('span', 'b2-shop-card__owned', 'MAXED');
  badge.setAttribute('aria-label', 'Maxed');
  return badge;
}

/** The permanent shop: five upgrade tracks, three powers, one wallet. */
export function buildStore(game: Game, actions: StoreActions): HTMLElement {
  const save = game.save.data;
  const screen = el('div', 'screen store b2-stage b2-stage--navy');
  const panel = el('section', 'b2-panel b2-store');
  panel.setAttribute('aria-labelledby', 'b2-store-title');

  // ── head: name, promise, wallet, exit ───────────────────────────────────
  const head = el('div', 'b2-panel__head b2-store__head');
  const title = el('h2', 'b2-panel__title', 'THE STORE');
  title.id = 'b2-store-title';
  const promise = el('p', 'b2-store__promise', 'SALVAGE IN. PERMANENT POWER OUT.');

  const wallet = el('div', 'b2-chip b2-store__wallet');
  wallet.setAttribute('role', 'status');
  wallet.setAttribute('aria-label', `${save.scrap} scrap`);
  const walletText = el('span', 'b2-chip__text');
  const walletValue = el('span', 'b2-chip__value b2-num', String(save.scrap));
  walletValue.setAttribute('aria-live', 'polite');
  walletText.append(walletValue, el('span', 'b2-chip__label', 'SCRAP'));
  wallet.append(icon(coinUrl, 'b2-chip__icon'), walletText);

  const back = el('button', 'b2-btn b2-btn--lavender b2-btn--sm b2-store__back', 'BACK');
  back.type = 'button';
  back.addEventListener('click', () => actions.back());

  head.append(title, promise, wallet, back);
  panel.append(head);

  const body = el('div', 'b2-panel__body b2-store__body');
  if (save.runActive) {
    body.append(el(
      'p',
      'b2-store__note',
      'YOUR RUN IS SAVED. UPGRADES APPLY WHEN YOU CONTINUE.',
    ));
  }

  // ── tabs ────────────────────────────────────────────────────────────────
  const tabs = el('div', 'b2-tabs b2-store__tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Store sections');
  const upgradesTab = el('button', 'b2-tab', 'UPGRADES');
  upgradesTab.type = 'button';
  upgradesTab.setAttribute('role', 'tab');
  upgradesTab.setAttribute('aria-controls', 'b2-store-upgrades');
  const powersTab = el('button', 'b2-tab', 'POWERS');
  powersTab.type = 'button';
  powersTab.setAttribute('role', 'tab');
  powersTab.setAttribute('aria-controls', 'b2-store-powers');
  tabs.append(upgradesTab, powersTab);
  body.append(tabs);

  // ── next unlock: one plain answer to "what should I chase?" ─────────────
  const goal = nextUnlock(save, totalStars(save.roomStars));
  const goalStrip = el('div', 'b2-goal b2-store__goal');
  goalStrip.setAttribute('role', 'status');
  const goalLabel = el('span', 'b2-goal__label', 'NEXT UNLOCK');
  const goalKicker = el('span', 'b2-goal__kicker', goal.kicker);
  const goalName = el('strong', 'b2-goal__name', goal.name);
  const goalDetail = el('span', 'b2-goal__detail', goal.detail);
  const goalMeter = el('div', 'b2-meter b2-goal__meter');
  const goalFill = el('span', 'b2-meter__fill');
  goalFill.style.setProperty('--b2-value', `${goal.progress}%`);
  goalMeter.append(goalFill);
  const starTotal = totalStars(save.roomStars);
  const ledgerStars = Math.min(27, starTotal);
  const ledgerNext = LEDGER.find((milestone) => milestone.stars > starTotal);
  const ledgerChip = el(
    'span',
    'b2-chip b2-store__ledger',
    `STAR LEDGER · ${ledgerStars} / 27 · ${ledgerNext?.name ?? 'COMPLETE'}`,
  );
  goalStrip.append(goalLabel, goalKicker, goalName, goalDetail, goalMeter, ledgerChip);
  body.append(goalStrip);

  const refreshWallet = (): void => {
    walletValue.textContent = String(save.scrap);
    wallet.setAttribute('aria-label', `${save.scrap} scrap`);
  };

  const refreshGoal = (): void => {
    const next: UnlockGoal = nextUnlock(save, totalStars(save.roomStars));
    goalKicker.textContent = next.kicker;
    goalName.textContent = next.name;
    goalDetail.textContent = next.detail;
    goalFill.style.setProperty('--b2-value', `${next.progress}%`);
  };

  // ── upgrades: five permanent tracks ─────────────────────────────────────
  const upgradesPane = el('div', 'b2-store__pane b2-store__upgrades');
  upgradesPane.id = 'b2-store-upgrades';
  upgradesPane.setAttribute('role', 'tabpanel');

  for (const def of UPGRADES) {
    const card = el('article', 'b2-shop-card b2-upgrade');
    card.dataset.upgrade = def.id;
    card.title = `${def.name} · ${def.maxLevel} levels`;

    const iconWrap = el('div', 'b2-shop-card__icon-wrap');
    iconWrap.append(icon(upgradeIcon(game, def.icon), 'b2-icon b2-shop-card__icon'));

    const copy = el('div', 'b2-shop-card__copy');
    const nameRow = el('div', 'b2-shop-card__name-row');
    const name = el('h3', 'b2-shop-card__name', def.name);
    const levelPips = el('span', 'b2-upgrade__pips');
    nameRow.append(name, levelPips);
    const current = el('p', 'b2-upgrade__effect');
    const next = el('p', 'b2-upgrade__next');
    const meta = el('div', 'b2-shop-card__meta');
    copy.append(nameRow, current, next, meta);

    const paint = (): void => {
      const level = upgradeLevel(save, def.id);
      card.dataset.level = String(level);
      card.classList.toggle('is-owned', isUpgradeMaxed(save, def.id));
      levelPips.textContent = pips(level, def.maxLevel);
      levelPips.setAttribute('aria-label', `${level} of ${def.maxLevel} levels`);
      current.textContent = upgradeEffect(save, def.id);
      next.textContent = isUpgradeMaxed(save, def.id)
        ? 'ALL TIERS BOUGHT'
        : `NEXT: ${nextUpgradeEffect(save, def.id)}`;
      meta.replaceChildren();

      const cost = nextUpgradeCost(save, def.id);
      if (cost === null) {
        meta.append(maxedStamp());
        return;
      }
      const price = el('span', 'b2-shop-card__cost');
      price.append(icon(coinUrl, 'b2-icon b2-shop-card__coin'), el('span', 'b2-num', String(cost)));
      const buy = el('button', 'b2-btn b2-btn--lime b2-btn--sm b2-shop-card__buy');
      buy.type = 'button';
      const affordable = save.scrap >= cost;
      buy.textContent = affordable ? 'BUY' : `NEEDS ${cost} SCRAP`;
      buy.disabled = !affordable;
      buy.setAttribute('aria-label', affordable ? `Buy ${def.name} for ${cost} scrap` : `Needs ${cost} scrap`);
      buy.addEventListener('click', () => {
        const reason = actions.buyUpgrade(def.id);
        if (reason) {
          refreshWallet();
          paint();
          return;
        }
        game.audio.play('stamp', 1);
        refreshWallet();
        paint();
        refreshGoal();
        card.classList.add('is-bought');
        window.setTimeout(() => card.classList.remove('is-bought'), 700);
      });
      meta.append(price, buy);
    };

    paint();
    card.append(iconWrap, copy);
    upgradesPane.append(card);
  }
  body.append(upgradesPane);

  // ── powers: the same cards as the pause menu ────────────────────────────
  const powersPane = el('div', 'b2-store__pane b2-store__powers');
  powersPane.id = 'b2-store-powers';
  powersPane.setAttribute('role', 'tabpanel');
  powersPane.hidden = true;
  for (const def of ABILITIES) {
    powersPane.append(buildAbilityCard(def, {
      touch: false,
      owned: save.abilities.includes(def.id),
      buy: actions.buyAbility,
      onBought: () => {
        refreshWallet();
        refreshGoal();
        game.audio.play('stamp', 1);
      },
    }));
  }
  body.append(powersPane);

  const setTab = (tab: 'upgrades' | 'powers'): void => {
    const onUpgrades = tab === 'upgrades';
    upgradesPane.hidden = !onUpgrades;
    powersPane.hidden = onUpgrades;
    upgradesTab.classList.toggle('is-active', onUpgrades);
    powersTab.classList.toggle('is-active', !onUpgrades);
    upgradesTab.setAttribute('aria-selected', String(onUpgrades));
    powersTab.setAttribute('aria-selected', String(!onUpgrades));
    upgradesTab.tabIndex = onUpgrades ? 0 : -1;
    powersTab.tabIndex = onUpgrades ? -1 : 0;
  };
  upgradesTab.addEventListener('click', () => setTab('upgrades'));
  powersTab.addEventListener('click', () => setTab('powers'));
  tabs.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = upgradesTab.getAttribute('aria-selected') === 'true' ? 'powers' : 'upgrades';
    setTab(next);
    (next === 'powers' ? powersTab : upgradesTab).focus();
  });
  setTab('upgrades');

  panel.append(body);
  screen.append(panel);
  return screen;
}
