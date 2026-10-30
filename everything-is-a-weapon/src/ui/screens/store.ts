import type { Game } from '../../core/Game';
import type { HeroId } from '../../core/Hero';
import { ABILITIES, type AbilityId } from '../../gameplay/Abilities';
import { totalStars } from '../../gameplay/Campaign';
import { PET_OUTFITS, PET_OUTFIT_IDS } from '../../gameplay/PetOutfits';
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
  /** '' on success, otherwise the reason. */
  buyOutfit(id: string): string;
  /** Puts an owned outfit on the pet; '' on success. */
  equipOutfit(id: string): string;
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

/** The pet each outfit belongs to, drawn with the kit art already in the game. */
const OUTFIT_ICONS: Record<'dog' | 'cat' | 'hamster' | 'parrot', string> = {
  dog: petDachshundUrl,
  cat: petGingerUrl,
  hamster: petHamsterUrl,
  parrot: petParrotUrl,
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
  const animalsTab = el('button', 'b2-tab', 'ANIMALS');
  animalsTab.type = 'button';
  animalsTab.setAttribute('role', 'tab');
  animalsTab.setAttribute('aria-controls', 'b2-store-animals');
  tabs.append(upgradesTab, powersTab, animalsTab);
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

  // ── animals: cosmetic outfits, no stats, all in scrap ───────────────────
  const animalsPane = el('div', 'b2-store__pane b2-store__animals');
  animalsPane.id = 'b2-store-animals';
  animalsPane.setAttribute('role', 'tabpanel');
  animalsPane.hidden = true;
  const outfitPaints: Array<() => void> = [];
  const refreshOutfits = (): void => {
    for (const repaint of outfitPaints) repaint();
  };
  for (const id of PET_OUTFIT_IDS) {
    const def = PET_OUTFITS[id];
    const card = el('article', 'b2-shop-card b2-outfit');
    card.dataset.outfit = def.id;
    card.title = def.name;

    const iconWrap = el('div', 'b2-shop-card__icon-wrap');
    const art = icon(OUTFIT_ICONS[def.icon], 'b2-icon b2-shop-card__icon');
    art.style.setProperty('--outfit-color', def.color);
    iconWrap.append(art);

    const copy = el('div', 'b2-shop-card__copy');
    const nameRow = el('div', 'b2-shop-card__name-row');
    const name = el('h3', 'b2-shop-card__name', def.name);
    const swatch = el('span', 'b2-outfit__swatch');
    swatch.style.setProperty('--outfit-color', def.color);
    swatch.setAttribute('aria-hidden', 'true');
    nameRow.append(name, swatch);
    const blurb = el('p', 'b2-upgrade__effect', def.blurb);
    const meta = el('div', 'b2-shop-card__meta');
    copy.append(nameRow, blurb, meta);

    const paint = (): void => {
      const owned = save.petOutfits.includes(def.id);
      const worn = save.petOutfit === def.id;
      card.dataset.state = worn ? 'worn' : owned ? 'owned' : 'locked';
      card.classList.toggle('is-owned', owned);
      card.classList.toggle('is-worn', worn);
      meta.replaceChildren();

      if (!owned) {
        const price = el('span', 'b2-shop-card__cost');
        price.append(icon(coinUrl, 'b2-icon b2-shop-card__coin'), el('span', 'b2-num', String(def.cost)));
        const affordable = save.scrap >= def.cost;
        const buy = el('button', 'b2-btn b2-btn--lime b2-btn--sm b2-shop-card__buy');
        buy.type = 'button';
        buy.textContent = affordable ? 'BUY' : `NEEDS ${def.cost} SCRAP`;
        buy.disabled = !affordable;
        buy.setAttribute('aria-label', affordable ? `Buy ${def.name} for ${def.cost} scrap` : `Needs ${def.cost} scrap`);
        buy.addEventListener('click', () => {
          const reason = actions.buyOutfit(def.id);
          if (reason) {
            refreshWallet();
            paint();
            return;
          }
          game.audio.play('stamp', 1);
          refreshWallet();
          refreshGoal();
          refreshOutfits();
          card.classList.add('is-bought');
          window.setTimeout(() => card.classList.remove('is-bought'), 700);
        });
        meta.append(price, buy);
        return;
      }

      if (worn) {
        const badge = el('span', 'b2-shop-card__owned', 'WORN');
        badge.setAttribute('aria-label', 'Currently worn');
        meta.append(badge);
        return;
      }
      const equip = el('button', 'b2-btn b2-btn--yellow b2-btn--sm b2-shop-card__buy', 'WEAR');
      equip.type = 'button';
      equip.addEventListener('click', () => {
        const reason = actions.equipOutfit(def.id);
        if (reason) {
          paint();
          return;
        }
        game.audio.play('pickup', 0.7);
        refreshOutfits();
      });
      meta.append(equip);
    };

    paint();
    card.append(iconWrap, copy);
    animalsPane.append(card);
    outfitPaints.push(paint);
  }
  body.append(animalsPane);

  const tabIds = ['upgrades', 'powers', 'animals'] as const;
  const tabButtons = [upgradesTab, powersTab, animalsTab];
  const panes = [upgradesPane, powersPane, animalsPane];
  const setTab = (tab: (typeof tabIds)[number]): void => {
    const active = tabIds.indexOf(tab);
    panes.forEach((pane, index) => {
      pane.hidden = index !== active;
    });
    tabButtons.forEach((button, index) => {
      const on = index === active;
      button.classList.toggle('is-active', on);
      button.setAttribute('aria-selected', String(on));
      button.tabIndex = on ? 0 : -1;
    });
  };
  upgradesTab.addEventListener('click', () => setTab('upgrades'));
  powersTab.addEventListener('click', () => setTab('powers'));
  animalsTab.addEventListener('click', () => setTab('animals'));
  tabs.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const current = Math.max(0, tabButtons.findIndex((button) => button.getAttribute('aria-selected') === 'true'));
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = (current + step + tabIds.length) % tabIds.length;
    setTab(tabIds[next]!);
    tabButtons[next]!.focus();
  });
  setTab('upgrades');

  panel.append(body);
  screen.append(panel);
  return screen;
}
