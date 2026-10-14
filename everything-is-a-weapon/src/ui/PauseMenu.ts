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
  ['hold + let go', 'throw'],
  ['right click', 'drop'],
  ['space', 'dodge'],
  ['R', 'restart'],
  ['P / Esc', 'pause'],
];

const TOUCH_CONTROLS: ReadonlyArray<readonly [string, string]> = [
  ['left thumb', 'move'],
  ['tap right', 'grab'],
  ['hold right', 'throw'],
  ['drag right', 'aim'],
  ['dodge / drop', 'buttons'],
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
  sign.append(el('span', 'hanger-big', 'PAUSED'));
  const buttons = el('div', 'menu-buttons');
  buttons.append(
    button('RESUME', 'primary', actions.resume),
    button('RESTART', '', actions.restart),
    button('SETTINGS', '', actions.settings),
    button('HOME', '', actions.home),
  );
  hanger.append(el('span', 'hanger-hole'), sign, buttons);

  // Scrap buys permanent powers: key, name and price on one line. What each
  // power does lives in the tooltip, so the list stays scannable.
  const shop = el('div', 'ability-shop');
  const shopHead = el('div', 'shop-head');
  shopHead.append(el('div', 'note-title', 'POWERS'));
  const scrapCount = el('span', 'scrap-count', `${game.save.data.scrap} SCRAP`);
  shopHead.append(scrapCount);
  shop.append(shopHead);
  for (const def of ABILITIES) {
    const row = el('div', 'ability-row');
    row.title = def.blurb;
    row.append(el('span', 'key', touch ? 'POWER' : def.key), el('span', 'ability-name', def.name));
    if (game.abilities.owned(def.id)) {
      row.append(el('span', 'ability-owned', 'OWNED'));
    } else {
      const buy = el('button', 'ability-buy');
      buy.type = 'button';
      buy.textContent = `${def.cost} SCRAP`;
      buy.setAttribute('aria-label', `Unlock ${def.name} for ${def.cost} scrap: ${def.blurb}`);
      buy.addEventListener('click', () => {
        const failed = actions.buyAbility(def.id);
        if (!failed) {
          scrapCount.textContent = `${game.save.data.scrap} SCRAP`;
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

  // Room 1's lessons again, folded away until wanted.
  const replay = el('details', 'fold-box');
  replay.append(el('summary', 'fold-head', 'REPLAY TUTORIAL'));
  const lessons = el('div', 'lesson-row');
  for (const id of LESSONS) {
    const again = el('button', 'ability-buy', id === 'free' ? 'BRAWL' : id.toUpperCase());
    again.type = 'button';
    again.setAttribute('aria-label', `Replay the ${id} tutorial in room 1`);
    again.addEventListener('click', () => actions.lesson(id));
    lessons.append(again);
  }
  replay.append(lessons);
  shop.append(replay);

  // The essentials up front, the rest one tap away. Owned powers already show
  // in the shop above, so the note does not list them twice.
  const note = el('div', 'controls-note');
  note.append(el('div', 'note-title', 'CONTROLS'));
  const rows: ReadonlyArray<readonly [string, string]> = touch ? TOUCH_CONTROLS : controls();
  const shown = rows.slice(0, touch ? 3 : 4);
  for (const [key, action] of shown) {
    const row = el('div', 'control-row');
    row.append(el('span', 'key', key), el('span', '', action));
    note.append(row);
  }
  const rest = rows.slice(touch ? 3 : 4);
  if (rest.length > 0) {
    const more = el('details', 'fold-box');
    more.append(el('summary', 'fold-head', 'MORE'));
    for (const [key, action] of rest) {
      const row = el('div', 'control-row');
      row.append(el('span', 'key', key), el('span', '', action));
      more.append(row);
    }
    note.append(more);
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
