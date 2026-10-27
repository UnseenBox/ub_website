import { moveKeysLabel } from '../../input/KeyLabels';
import { ABILITIES, type AbilityId } from '../../gameplay/Abilities';
import { LESSONS, type Lesson } from '../../gameplay/Tutorial';
import type { Game } from '../../core/Game';
import { el } from '../dom';
import { buildAbilityCard } from './shopCards';
import coinUrl from '../../ui-kit/bonk2/assets/icons/coin@2x.png?url';

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

function kitButton(label: string, variant: string, onClick: () => void): HTMLButtonElement {
  const node = el('button', `b2-btn b2-btn--${variant}`);
  node.type = 'button';
  node.append(el('span', 'b2-btn__label', label));
  const chevron = el('span', 'b2-btn__chev', '\u203a');
  chevron.setAttribute('aria-hidden', 'true');
  node.append(chevron);
  node.addEventListener('click', onClick);
  return node;
}

function icon(src: string, className = 'b2-icon'): HTMLImageElement {
  const node = el('img', className);
  node.src = src;
  node.alt = '';
  node.decoding = 'async';
  return node;
}

function textRows(rows: ReadonlyArray<readonly [string, string]>, className: string): HTMLElement {
  const list = el('div', className);
  for (const [key, action] of rows) {
    const row = el('div', 'b2-pause__control');
    row.append(el('span', 'b2-pause__key', key), el('span', 'b2-pause__action', action));
    list.append(row);
  }
  return list;
}

/** Pause is the kit's door-hanger card: a breath, the powers, and the manual. */
export function buildPauseMenu(touch: boolean, game: Game, actions: PauseActions): HTMLElement {
  const screen = el('div', 'screen pause b2-stage b2-stage--dim b2-pause');

  const panel = el('section', 'b2-panel b2-pause__panel');
  panel.setAttribute('aria-labelledby', 'b2-pause-title');
  const head = el('div', 'b2-panel__head b2-panel__head--lavender');
  const title = el('h1', 'b2-panel__title', 'HOLD THAT THOUGHT.');
  title.id = 'b2-pause-title';
  head.append(title);

  const body = el('div', 'b2-panel__body b2-pause__body');
  body.append(el('p', 'b2-panel__note b2-pause__subtitle', 'EVEN CHAOS NEEDS A TEA BREAK.'));

  const buttons = el('div', 'b2-pause__actions');
  const keepGoing = kitButton('KEEP GOING', 'lime', actions.resume);
  keepGoing.classList.add('primary', 'b2-pause__keep');
  buttons.append(
    keepGoing,
    kitButton('RESTART', 'blue', actions.restart),
    kitButton('SETTINGS', 'lavender', actions.settings),
    kitButton('BACK TO MAIN MENU', 'lavender', actions.home),
  );
  body.append(buttons);

  // ── powers: permanent unlocks bought with scrap ──────────────────────────
  const shop = el('section', 'b2-pause__shop');
  shop.setAttribute('aria-labelledby', 'b2-pause-powers');
  const shopHead = el('div', 'b2-pause__shop-head');
  const shopTitle = el('h2', 'b2-pause__section-title', 'POWERS');
  shopTitle.id = 'b2-pause-powers';

  const scrapChip = el('div', 'b2-chip b2-pause__scrap');
  const scrapText = el('span', 'b2-chip__text');
  const scrapValue = el('span', 'b2-chip__value b2-num', String(game.save.data.scrap));
  scrapValue.setAttribute('aria-live', 'polite');
  scrapText.append(scrapValue, el('span', 'b2-chip__label', 'SCRAP'));
  scrapChip.append(icon(coinUrl, 'b2-chip__icon'), scrapText);
  scrapChip.setAttribute('aria-label', `${game.save.data.scrap} scrap`);
  scrapChip.setAttribute('role', 'status');
  shopHead.append(shopTitle, scrapChip);
  shop.append(shopHead);

  const grid = el('div', 'b2-pause__grid');
  for (const def of ABILITIES) {
    grid.append(buildAbilityCard(def, {
      touch,
      owned: game.abilities.owned(def.id),
      buy: actions.buyAbility,
      onBought: () => {
        scrapValue.textContent = String(game.save.data.scrap);
        scrapChip.setAttribute('aria-label', `${game.save.data.scrap} scrap`);
      },
    }));
  }
  shop.append(grid);

  // Room 1's lessons again, folded away until wanted. A replay deliberately
  // starts a fresh run, so warn when the player would lose their current Edges.
  const runActive = game.save.data.runActive;
  const replay = el('details', 'b2-fold b2-pause__replay');
  replay.append(el('summary', 'b2-fold__head', runActive ? 'REPLAY TUTORIAL \u00b7 ENDS RUN' : 'REPLAY TUTORIAL'));
  if (runActive) {
    replay.append(
      el('p', 'b2-pause__warn', 'Starts a fresh run from room 1. Your current Edges and run score are lost.'),
    );
  }
  const lessons = el('div', 'b2-pause__lessons');
  for (const id of LESSONS) {
    const again = el('button', 'b2-btn b2-btn--sm b2-btn--lavender', id === 'free' ? 'BRAWL' : id.toUpperCase());
    again.type = 'button';
    again.title = runActive ? 'Starts a fresh run from room 1 and clears your Edges' : '';
    again.setAttribute('aria-label', `Replay the ${id} tutorial in room 1${runActive ? ', ending the current run' : ''}`);
    again.addEventListener('click', () => actions.lesson(id));
    lessons.append(again);
  }
  replay.append(lessons);
  shop.append(replay);
  body.append(shop);

  // ── controls: the essentials up front, the rest one tap away ─────────────
  const note = el('section', 'b2-pause__note');
  note.append(el('h2', 'b2-pause__section-title', 'CONTROLS'));
  const rows: ReadonlyArray<readonly [string, string]> = touch ? TOUCH_CONTROLS : controls();
  const shown = rows.slice(0, touch ? 3 : 4);
  note.append(textRows(shown, 'b2-pause__controls'));
  const rest = rows.slice(touch ? 3 : 4);
  if (rest.length > 0) {
    const more = el('details', 'b2-fold');
    more.append(el('summary', 'b2-fold__head', 'MORE'));
    more.append(textRows(rest, 'b2-pause__controls b2-pause__controls--more'));
    note.append(more);
  }
  body.append(note);

  panel.append(head, body);
  screen.append(panel);
  return screen;
}

export { buildSettings } from './settings';
