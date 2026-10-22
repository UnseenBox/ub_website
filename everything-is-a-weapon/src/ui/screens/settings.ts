import type { Game } from '../../core/Game';
import type { Settings } from '../../save/SaveManager';
import { el } from '../dom';

import panUrl from '../../ui-kit/bonk2/assets/icons/pan@2x.png?url';
import slipperUrl from '../../ui-kit/bonk2/assets/icons/slipper@2x.png?url';
import toasterUrl from '../../ui-kit/bonk2/assets/icons/toaster@2x.png?url';
import lampUrl from '../../ui-kit/bonk2/assets/icons/lamp@2x.png?url';
import pizzaUrl from '../../ui-kit/bonk2/assets/icons/pizza@2x.png?url';
import tapeUrl from '../../ui-kit/bonk2/assets/icons/tape@2x.png?url';

interface ShopCard {
  name: string;
  blurb: string;
  art: string;
}

/** The store rack: the classics, none of them for sale tonight. */
const SHOP: readonly ShopCard[] = [
  { name: 'FRYING PAN', blurb: 'The opening argument.', art: panUrl },
  { name: 'SLIPPER', blurb: 'Close range. Zero dignity.', art: slipperUrl },
  { name: 'TOASTER', blurb: 'Breakfast is a projectile.', art: toasterUrl },
  { name: 'LAMP', blurb: 'Light reading, heavy landing.', art: lampUrl },
  { name: 'PIZZA', blurb: 'Dinner and a distraction.', art: pizzaUrl },
  { name: 'DUCT TAPE', blurb: 'Fixes everything. Then breaks it.', art: tapeUrl },
];

function icon(src: string, className: string): HTMLImageElement {
  const node = el('img', className);
  node.src = src;
  node.alt = '';
  node.decoding = 'async';
  node.draggable = false;
  return node;
}

function toggle(
  label: string,
  hint: string,
  value: boolean,
  onChange: (value: boolean) => void,
): HTMLLabelElement {
  const row = el('label', 'b2-settings__toggle');
  const input = el('input');
  input.type = 'checkbox';
  input.checked = value;
  input.addEventListener('change', () => onChange(input.checked));
  const copy = el('span', 'b2-settings__toggle-copy');
  copy.append(el('span', 'b2-settings__toggle-name', label), el('span', 'b2-settings__toggle-hint', hint));
  row.append(input, el('span', 'b2-check__box'), copy);
  return row;
}

/** Settings: one panel, two tabs, every switch wired straight to the save file. */
export function buildSettings(
  game: Game,
  onBack: () => void,
  initialTab: 'settings' | 'shop' = 'settings',
): HTMLElement {
  const screen = el('div', 'screen settings b2-stage b2-stage--navy b2-settings');
  const panel = el('section', 'b2-panel b2-settings__panel');
  panel.setAttribute('aria-labelledby', 'b2-settings-title');

  const head = el('div', 'b2-panel__head b2-settings__head');
  const title = el('h2', 'b2-panel__title', 'ADJUST THE CHAOS');
  title.id = 'b2-settings-title';
  head.append(title);
  panel.append(head);

  const body = el('div', 'b2-panel__body b2-settings__body');

  // ── tabs ────────────────────────────────────────────────────────────────
  const tabs = el('div', 'b2-tabs b2-settings__tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Settings sections');
  const settingsTab = el('button', 'b2-tab', 'SETTINGS');
  settingsTab.type = 'button';
  settingsTab.setAttribute('role', 'tab');
  settingsTab.setAttribute('aria-controls', 'b2-pane-settings');
  const shopTab = el('button', 'b2-tab', 'SHOP');
  shopTab.type = 'button';
  shopTab.setAttribute('role', 'tab');
  shopTab.setAttribute('aria-controls', 'b2-pane-shop');
  tabs.append(settingsTab, shopTab);
  body.append(tabs);

  const settingsPane = el('div', 'b2-settings__pane');
  settingsPane.id = 'b2-pane-settings';
  settingsPane.setAttribute('role', 'tabpanel');
  const shopPane = el('div', 'b2-settings__pane b2-settings__pane--shop');
  shopPane.id = 'b2-pane-shop';
  shopPane.setAttribute('role', 'tabpanel');
  shopPane.hidden = true;
  body.append(settingsPane, shopPane);

  const setTab = (tab: 'settings' | 'shop'): void => {
    const on = tab === 'settings';
    settingsPane.hidden = !on;
    shopPane.hidden = on;
    settingsTab.classList.toggle('is-active', on);
    shopTab.classList.toggle('is-active', !on);
    settingsTab.setAttribute('aria-selected', String(on));
    shopTab.setAttribute('aria-selected', String(!on));
    settingsTab.tabIndex = on ? 0 : -1;
    shopTab.tabIndex = on ? -1 : 0;
  };
  settingsTab.addEventListener('click', () => setTab('settings'));
  shopTab.addEventListener('click', () => setTab('shop'));
  tabs.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = settingsTab.getAttribute('aria-selected') === 'true' ? 'shop' : 'settings';
    setTab(next);
    (next === 'shop' ? shopTab : settingsTab).focus();
  });

  // ── settings ────────────────────────────────────────────────────────────
  const settings = game.save.data.settings;
  const change = (apply: (s: Settings) => void): void => {
    apply(settings);
    game.save.write();
    game.applySettings();
  };

  const volume = el('label', 'b2-settings__row b2-settings__row--volume');
  const volumeHead = el('span', 'b2-settings__row-head');
  const volumeValue = el('strong', 'b2-settings__value b2-num', `${Math.round(settings.volume * 100)}%`);
  volumeHead.append(el('span', 'b2-settings__row-name', 'VOLUME'), volumeValue);
  const slider = el('input', 'b2-range');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.value = String(Math.round(settings.volume * 100));
  slider.setAttribute('aria-label', 'Volume');
  slider.addEventListener('input', () => {
    volumeValue.textContent = `${slider.value}%`;
    change((s) => (s.volume = Number(slider.value) / 100));
  });
  slider.addEventListener('change', () => game.audio.impact('wood', 0.7, 9));
  volume.append(volumeHead, slider);

  const switches = el('div', 'b2-settings__switches');
  switches.append(
    toggle('MUSIC', 'The neighbours can hear it.', settings.music, (v) => change((s) => (s.music = v))),
    toggle('MUTE EVERYTHING', 'Silence, but with intent.', settings.muted, (v) => change((s) => (s.muted = v))),
    toggle('LESS SCREEN SHAKE', 'For calmer earthquakes.', settings.reducedShake, (v) => change((s) => (s.reducedShake = v))),
    toggle('HIGH CONTRAST MENUS', 'Every outline, louder.', settings.highContrast, (v) => change((s) => (s.highContrast = v))),
  );

  const controls = el('button', 'b2-btn b2-btn--lavender b2-settings__back');
  controls.type = 'button';
  controls.textContent = 'BACK';
  controls.addEventListener('click', onBack);

  // Two presses, no undo. The label tells the player exactly what is happening.
  let armed = false;
  const shred = el('button', 'b2-btn b2-btn--red b2-settings__shred');
  shred.type = 'button';
  const shredLabel = el('span', 'b2-settings__shred-label', 'SHRED SAVE');
  shred.append(shredLabel);
  shred.setAttribute('aria-label', 'Shred save. Press twice to confirm.');
  shred.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      shred.classList.add('is-armed');
      shredLabel.textContent = 'SURE? AGAIN';
      shred.setAttribute('aria-label', 'Press again to shred the save');
      return;
    }
    game.save.clear();
    game.applySettings();
    onBack();
  });

  const settingsActions = el('div', 'b2-settings__actions');
  settingsActions.append(shred, controls);
  settingsPane.append(volume, switches, settingsActions);

  // ── shop ────────────────────────────────────────────────────────────────
  const shopIntro = el('p', 'b2-settings__shopintro', 'THE STORE IS RESTOCKING. HERE IS WHAT THE HOUSE IS HIDING.');
  const grid = el('div', 'b2-settings__shopgrid');
  for (const item of SHOP) {
    const card = el('article', 'b2-shop-card b2-shop-card--static');
    const art = el('div', 'b2-shop-card__icon-wrap');
    art.append(icon(item.art, 'b2-icon b2-shop-card__icon'));
    const copy = el('div', 'b2-shop-card__copy');
    copy.append(
      el('h3', 'b2-shop-card__name', item.name),
      el('p', 'b2-shop-card__blurb', item.blurb),
      el('span', 'b2-shop-card__owned b2-shop-card__soon', 'SOON'),
    );
    card.append(art, copy);
    grid.append(card);
  }
  const shopActions = el('div', 'b2-settings__actions');
  const shopBack = el('button', 'b2-btn b2-btn--lavender');
  shopBack.type = 'button';
  shopBack.textContent = 'BACK';
  shopBack.addEventListener('click', onBack);
  shopActions.append(shopBack);
  shopPane.append(shopIntro, grid, shopActions);

  panel.append(body);
  screen.append(panel);
  setTab(initialTab);
  return screen;
}
