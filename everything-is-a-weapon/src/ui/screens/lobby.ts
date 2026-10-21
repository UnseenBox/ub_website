import type { Game } from '../../core/Game';
import type { HeroId } from '../../core/Hero';
import { button, el } from '../dom';
import { buildCharactersPane, heroPair } from './characters';
import { buildRoomsPane } from './rooms';

export interface MenuActions {
  play(roomIndex: number): void;
  /** STORE opens the same sheet with the shop tab selected. */
  settings(tab?: 'settings' | 'shop'): void;
  hero(id: HeroId): void;
}

/** Hero picks rebuild the menu (the room behind it needs the new pet), so the
 *  MODE sheet remembers where it was and opens again on the new screen. */
let reopenMode: 'rooms' | 'characters' | null = null;
/** The room picked in MODE, kept across the hero-pick rebuild. */
let lastRoomPick: number | null = null;

/**
 * The home screen is the kit's three-beat composition: wordmark, PLAY, and the
 * MODE / SHOP / SETTINGS row. The full room map and the four hero cards live
 * inside the MODE sheet, so the home screen can stay as clean as the reference.
 */
export function buildMainMenu(game: Game, actions: MenuActions): HTMLElement {
  const save = game.save.data;
  const screen = el('div', 'screen menu-board');

  const mode = el('div', 'mode-overlay');
  mode.id = 'bonk-mode';
  mode.hidden = true;
  mode.innerHTML = `
    <div class="mode-backdrop" data-mode-close></div>
    <div class="mode-panel" role="dialog" aria-modal="true" aria-labelledby="mode-title">
      <header class="mode-head">
        <div class="mode-heading">
          <div class="mode-kicker">RUN SETUP</div>
          <h2 class="mode-title" id="mode-title">MODE</h2>
        </div>
        <button class="mode-close" type="button" data-mode-close>CLOSE</button>
      </header>
      <div class="mode-tabs" role="tablist" aria-label="Mode sections">
        <button class="mode-tab on" type="button" role="tab" aria-selected="true" aria-controls="mode-pane-rooms" data-mode-tab="rooms">ROOMS</button>
        <button class="mode-tab" type="button" role="tab" aria-selected="false" aria-controls="mode-pane-characters" data-mode-tab="characters">CHARACTERS</button>
      </div>
      <div class="mode-body">
        <div class="mode-pane" id="mode-pane-rooms" role="tabpanel" data-mode-pane="rooms"></div>
        <div class="mode-pane" id="mode-pane-characters" role="tabpanel" data-mode-pane="characters" hidden></div>
      </div>
    </div>`;
  const modePaneRooms = mode.querySelector<HTMLElement>('[data-mode-pane="rooms"]')!;
  const modePaneChars = mode.querySelector<HTMLElement>('[data-mode-pane="characters"]')!;

  // ── header: the wordmark, loud and centered. The cog stays hidden because
  //    SETTINGS is a first-class button in the row below. ──
  const head = el('header', 'mk-head');
  const logo = el('div', 'mm-logo');
  logo.setAttribute('role', 'img');
  logo.setAttribute('aria-label', 'BONK! Everything is a weapon');
  const letters: Array<[string, string]> = [
    ['B', 'mm-l0'],
    ['O', 'mm-l1'],
    ['N', 'mm-l2'],
    ['K', 'mm-l3'],
    ['!', 'mm-l4'],
  ];
  for (const [char, cls] of letters) logo.append(el('span', `mm-letter ${cls}`, char));
  const tagline = el('div', 'mm-tagline');
  tagline.append(el('span', 'mm-tagline-text', 'everything is a weapon'));
  const gear = el('button', 'mk-gear');
  gear.type = 'button';
  gear.setAttribute('aria-label', 'Settings');
  gear.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M10.3 2h3.4l.5 2.6 1.7.7 2.2-1.5 2.4 2.4-1.5 2.2.7 1.7 2.6.5v3.4l-2.6.5-.7 1.7 1.5 2.2-2.4 2.4-2.2-1.5-1.7.7-.5 2.6h-3.4l-.5-2.6-1.7-.7-2.2 1.5-2.4-2.4 1.5-2.2-.7-1.7L2 13.7v-3.4l2.6-.5.7-1.7-1.5-2.2 2.4-2.4 2.2 1.5 1.7-.7zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"/></svg>';
  gear.addEventListener('click', () => actions.settings());
  head.append(logo, tagline, gear);
  screen.append(head);

  // ── the two MODE panes ──
  const summaryRoom = el('strong', 'rm-summary-room', '');
  const summaryHero = el('span', 'rm-summary-hero', heroPair(game.hero));
  const playSub = el('span', 'rm-play-sub', '');
  let selected = Math.max(0, save.unlockedRoom);

  const roomsPane = buildRoomsPane(game, {
    initial: lastRoomPick,
    onSelect: (choice) => {
      selected = choice.index;
      lastRoomPick = choice.index;
      summaryRoom.textContent = choice.label;
      playSub.textContent = choice.shortLabel;
    },
  });
  modePaneRooms.append(roomsPane.root);

  modePaneChars.append(
    buildCharactersPane(game, {
      onPick: (id) => {
        // setHero() calls toMenu(), which rebuilds this screen. Keep the
        // characters sheet open on the rebuilt menu.
        reopenMode = 'characters';
        actions.hero(id);
      },
    }),
  );

  // ── action: one huge kit PLAY, the three square buttons, and a quiet
  //    room/hero line that opens the MODE sheet. ──
  const action = el('div', 'rm-action');
  const summary = el('button', 'rm-summary mode-trigger') as HTMLButtonElement;
  summary.type = 'button';
  summary.title = 'Change room or hero';
  summary.setAttribute('aria-haspopup', 'dialog');
  summary.setAttribute('aria-controls', mode.id);
  summary.setAttribute('aria-live', 'polite');
  summary.append(summaryRoom, document.createTextNode(' '), summaryHero);
  const playBtn = button('▶ PLAY', 'primary rm-play', () => actions.play(selected));
  playBtn.append(playSub);
  action.append(summary, playBtn);
  screen.append(action);

  // MODE sheet: tabs + open/close.
  const modeTabs = [...mode.querySelectorAll<HTMLButtonElement>('.mode-tab')];
  const setModeTab = (tab: 'rooms' | 'characters'): void => {
    for (const node of modeTabs) {
      const on = node.dataset.modeTab === tab;
      node.classList.toggle('on', on);
      node.setAttribute('aria-selected', String(on));
      node.tabIndex = on ? 0 : -1;
    }
    modePaneRooms.hidden = tab !== 'rooms';
    modePaneChars.hidden = tab !== 'characters';
  };
  const openMode = (tab: 'rooms' | 'characters' = 'rooms'): void => {
    mode.hidden = false;
    screen.classList.add('mode-open');
    setModeTab(tab);
    if (tab === 'rooms') roomsPane.showMap(true);
    mode.querySelector<HTMLElement>('.mode-close')?.focus();
  };
  const closeMode = (): void => {
    if (mode.hidden) return;
    mode.hidden = true;
    screen.classList.remove('mode-open');
    summary.focus();
  };
  for (const tab of modeTabs) {
    tab.addEventListener('click', () => {
      const which = tab.dataset.modeTab === 'characters' ? 'characters' : 'rooms';
      setModeTab(which);
      if (which === 'rooms') roomsPane.showMap(true);
    });
  }
  summary.addEventListener('click', () => openMode('rooms'));
  for (const closer of mode.querySelectorAll<HTMLElement>('[data-mode-close]')) {
    closer.addEventListener('click', closeMode);
  }
  mode.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMode();
    }
  });
  setModeTab('rooms');
  screen.append(mode);

  // The only footer left: a warning when the browser refuses storage.
  if (!game.save.persistent) {
    const footer = el('div', 'menu-footer');
    footer.append(el('span', 'warn', 'Storage is blocked — progress will not be saved.'));
    screen.append(footer);
  }

  // A hero click set this before setHero() rebuilt the menu. Reopen the
  // characters sheet on the new screen, after it has been mounted.
  if (reopenMode) {
    const tab = reopenMode;
    reopenMode = null;
    requestAnimationFrame(() => openMode(tab));
  }
  return screen;
}
