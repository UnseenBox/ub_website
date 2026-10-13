import { moveKeysLabel } from '../input/KeyLabels';
import { ABILITIES, type AbilityId } from '../gameplay/Abilities';
import { LESSONS, type Lesson } from '../gameplay/Tutorial';
import type { Game } from '../core/Game';
import type { Settings } from '../save/SaveManager';
import { button, el } from './dom';

export interface PauseActions {
  resume(): void;
  restart(): void;
  settings(): void;
  home(): void;
  /** Returns '' when the ability was bought, otherwise the reason it failed. */
  buyAbility(id: AbilityId): string;
  /** Back to room 1, starting at that lesson. */
  lesson(id: Lesson): void;
}

const controls = (): ReadonlyArray<readonly [string, string]> => [
  [`${moveKeysLabel()} / arrows`, 'move'],
  ['mouse', 'aim'],
  ['click', 'grab'],
  ['hold + let go', 'charge and throw'],
  ['right click', 'drop'],
  ['space', 'dodge'],
  ['R', 'restart the room'],
  ['P / Esc', 'pause'],
];

const TOUCH_CONTROLS: ReadonlyArray<readonly [string, string]> = [
  ['left thumb', 'move'],
  ['tap right side', 'grab what is highlighted'],
  ['hold right side', 'charge, let go to throw'],
  ['drag right thumb', 'aim by hand'],
  ['dodge / drop', 'buttons, bottom right'],
];

/** The fight manual, shared by the pause screen and the main-menu controls sheet. */
export function controlRows(touch: boolean): ReadonlyArray<readonly [string, string]> {
  return touch ? TOUCH_CONTROLS : controls();
}

/** Pause is a hotel door hanger; the controls are a note someone left next to it. */
export function buildPauseMenu(touch: boolean, game: Game, actions: PauseActions): HTMLElement {
  const screen = el('div', 'screen pause');

  const hanger = el('div', 'hanger');
  const sign = el('div', 'hanger-sign');
  sign.append(el('span', 'hanger-small', 'please'), el('span', 'hanger-big', 'DO NOT'), el('span', 'hanger-big', 'DISTURB'), el('span', 'hanger-small', '(paused)'));
  const buttons = el('div', 'menu-buttons');
  buttons.append(
    button('RESUME', 'primary', actions.resume),
    button('RESTART ROOM', '', actions.restart),
    button('SETTINGS', '', actions.settings),
    button('HOME', '', actions.home),
  );
  hanger.append(el('span', 'hanger-hole'), sign, buttons);

  // The ability shop: scrap buys permanent powers, usable with 1/2/3 (or POWER on touch).
  const shop = el('div', 'ability-shop');
  const scrapRow = el('div', 'scrap-row', `SCRAP: ${game.save.data.scrap}`);
  shop.append(el('div', 'note-title', 'abilities for scrap:'), scrapRow);
  for (const def of ABILITIES) {
    const row = el('div', 'ability-row');
    row.append(el('span', 'key', touch ? 'POWER' : def.key), el('span', 'ability-name', def.name));
    row.append(el('span', 'ability-blurb', def.blurb));
    if (game.abilities.owned(def.id)) {
      row.append(el('span', 'ability-owned', 'OWNED'));
    } else {
      const buy = el('button', 'ability-buy');
      buy.type = 'button';
      buy.textContent = `BUY · ${def.cost}`;
      buy.addEventListener('click', () => {
        const failed = actions.buyAbility(def.id);
        if (!failed) {
          scrapRow.textContent = `SCRAP: ${game.save.data.scrap}`;
          buy.replaceWith(el('span', 'ability-owned', 'OWNED'));
        } else {
          const label = buy.textContent;
          buy.textContent = failed.toUpperCase();
          buy.disabled = true;
          window.setTimeout(() => {
            if (!buy.isConnected) return;
            buy.textContent = label;
            buy.disabled = false;
          }, 1100);
        }
      });
      row.append(buy);
    }
    shop.append(row);
  }

  // Any of room 1's lessons again, for whoever skipped them or forgot.
  const lessons = el('div', 'lesson-row');
  for (const id of LESSONS) {
    const again = el('button', 'ability-buy', id === 'free' ? 'BRAWL' : id.toUpperCase());
    again.type = 'button';
    again.addEventListener('click', () => actions.lesson(id));
    lessons.append(again);
  }
  shop.append(el('div', 'note-title', 'room 1 lessons again:'), lessons);

  const note = el('div', 'controls-note');
  note.append(el('div', 'note-title', 'how to fight:'));
  const rows: ReadonlyArray<readonly [string, string]> = touch ? TOUCH_CONTROLS : controls();
  for (const [key, action] of rows) {
    const row = el('div', 'control-row');
    row.append(el('span', 'key', key), el('span', '', action));
    note.append(row);
  }
  for (const def of game.abilities.ownedList()) {
    const row = el('div', 'control-row');
    row.append(el('span', 'key', touch ? 'power' : def.key), el('span', '', `ability: ${def.name.toLowerCase()}`));
    note.append(row);
  }
  screen.append(hanger, shop, note);
  return screen;
}

function toggle(labelText: string, value: boolean, onChange: (value: boolean) => void): HTMLElement {
  const row = el('label', 'rule');
  const input = el('input');
  input.type = 'checkbox';
  input.checked = value;
  input.addEventListener('change', () => onChange(input.checked));
  row.append(input, el('span', 'rule-box'), el('span', 'rule-text', labelText));
  return row;
}

/** Settings: a typed sheet with boxes ticked in pen. */
export function buildSettings(game: Game, onBack: () => void): HTMLElement {
  const screen = el('div', 'screen settings');
  const sheet = el('div', 'sheet rules-sheet');
  const head = el('div', 'sheet-head');
  head.append(el('span', 'sheet-title', 'SETTINGS'), el('span', 'sheet-no', 'tick as needed'));
  sheet.append(head);

  const settings = game.save.data.settings;
  const change = (apply: (s: Settings) => void): void => {
    apply(settings);
    game.save.write();
    game.applySettings();
  };

  const volumeRow = el('label', 'rule volume');
  const slider = el('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.value = String(Math.round(settings.volume * 100));
  slider.addEventListener('input', () => change((s) => (s.volume = Number(slider.value) / 100)));
  slider.addEventListener('change', () => game.audio.impact('wood', 0.7, 9));
  volumeRow.append(el('span', 'rule-text', 'volume'), slider);

  sheet.append(
    volumeRow,
    toggle('music', settings.music, (v) => change((s) => (s.music = v))),
    toggle('mute everything', settings.muted, (v) => change((s) => (s.muted = v))),
    toggle('less screen shake', settings.reducedShake, (v) => change((s) => (s.reducedShake = v))),
    toggle('high contrast menus', settings.highContrast, (v) => change((s) => (s.highContrast = v))),
  );

  let armed = false;
  const reset = button('SHRED ALL PROGRESS', 'danger', () => {
    if (!armed) {
      armed = true;
      reset.querySelector('.btn-label')!.textContent = 'SURE? CLICK AGAIN TO SHRED';
      return;
    }
    game.save.clear();
    game.applySettings();
    onBack();
  });

  screen.append(sheet, button('BACK', 'primary', onBack), reset);
  return screen;
}
