import type { Game } from '../core/Game';
import { HEROES, type HeroId } from '../core/Hero';
import { ENEMY_TYPES } from '../entities/EnemyTypes';
import { actFor, campaignProgress, starText, totalStars } from '../gameplay/Campaign';
import { HANDCRAFTED_ROOMS } from '../gameplay/RoomDefinitions';
import { bossSpecFor, depthsBossSlots } from '../gameplay/RoomManager';
import { Player } from '../entities/Player';
import { drawPlayer } from '../rendering/PlayerArt';
import { button, el, formatScore } from './dom';

export interface MenuActions {
  play(roomIndex: number): void;
  settings(): void;
  hero(id: HeroId): void;
}

interface RoomEntry {
  readonly key: string;
  /** Room index to play when this entry is used. */
  readonly index: number;
  /** Number on the card. */
  readonly num: string;
  /** Room name, boss name, or 'the depths'. */
  readonly name: string;
  readonly boss: boolean;
  readonly locked: boolean;
  readonly depths: boolean;
  readonly stars: number;
  readonly best: number | null;
}

/**
 * The card portrait: the hero drawn by the very same code that draws them in the room,
 * on a throwaway Player posed facing the reader, so a new look never needs a second asset.
 */
function heroPortrait(hero: HeroId): HTMLCanvasElement {
  const canvas = el('canvas', 'hero-portrait');
  const w = 112;
  const h = 140;
  canvas.width = w * 2;
  canvas.height = h * 2;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', hero);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const pose = new Player(0, 0);
  pose.aimX = 0.26;
  pose.aimY = 0.96;
  pose.walkPhase = 1.1;
  ctx.scale(2, 2);
  ctx.save();
  ctx.translate(w / 2, h - 26);
  ctx.scale(2.1, 2.1);
  drawPlayer(ctx, pose, 0, 0, 0, hero);
  ctx.restore();
  return canvas;
}

/** 'the tenant & waffle' for the summary line. */
function heroPair(heroId: HeroId): string {
  const hero = HEROES.find((h) => h.id === heroId)!;
  const pet = hero.note.replace(/^\+ /, '').split(',')[0]!;
  return `${hero.name} & ${pet}`;
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

  // The quiet home screen, with rooms + characters behind one sheet.
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

  // Tester unlock (?unlock in the URL): every room open plus the depths bosses
  // pinned to the end of the rail. Session-only: the save file is never touched.
  const tester = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('unlock');
  const total = HANDCRAFTED_ROOMS.length;
  const resumeRoom = save.unlockedRoom;
  const openThrough = tester ? total + 60 : resumeRoom;

  // ── header: the wordmark, loud and centered. The cog stays hidden because
  //    SETTINGS is a first-class button in the row below. ──
  const head = el('header', 'mk-head');
  const logo = el('div', 'mm-logo');
  logo.setAttribute('role', 'img');
  logo.setAttribute('aria-label', 'BONK! Everything is a weapon');
  const letters: Array<[string, string]> = [['B', 'mm-l0'], ['O', 'mm-l1'], ['N', 'mm-l2'], ['K', 'mm-l3'], ['!', 'mm-l4']];
  for (const [char, cls] of letters) logo.append(el('span', `mm-letter ${cls}`, char));
  const tagline = el('div', 'mm-tagline');
  tagline.append(el('span', 'mm-tagline-text', 'everything is a weapon'));
  const gear = el('button', 'mk-gear');
  gear.type = 'button';
  gear.setAttribute('aria-label', 'Settings');
  gear.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M10.3 2h3.4l.5 2.6 1.7.7 2.2-1.5 2.4 2.4-1.5 2.2.7 1.7 2.6.5v3.4l-2.6.5-.7 1.7 1.5 2.2-2.4 2.4-2.2-1.5-1.7.7-.5 2.6h-3.4l-.5-2.6-1.7-.7-2.2 1.5-2.4-2.4 1.5-2.2-.7-1.7L2 13.7v-3.4l2.6-.5.7-1.7-1.5-2.2 2.4-2.4 2.2 1.5 1.7-.7zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"/></svg>';
  gear.addEventListener('click', actions.settings);
  head.append(logo, tagline, gear);
  screen.append(head);

  // ── rooms: every room on cards, grouped by act, locked ones face-up ──
  const roomsSec = el('section', 'rm-rooms');
  roomsSec.setAttribute('aria-label', 'Room selection');
  const roomsHead = el('div', 'rm-rooms-head');
  roomsHead.append(el('div', 'tape-label', tester ? 'ROOMS · TESTER' : 'ROOMS'));
  const openCount = Math.max(0, Math.min(openThrough + 1, total));
  const progress = el('div', 'rm-progress');
  const bar = el('div', 'rm-bar');
  const fill = el('span', 'rm-bar-fill');
  fill.style.width = `${campaignProgress(total, save.roomStars)}%`;
  bar.append(fill);
  const deepest = save.deepest > 0 ? `deepest ${save.deepest}` : 'first visit';
  progress.append(bar, el('span', 'rm-progress-text', `${openCount}/${total} open · ★${totalStars(save.roomStars)} · ${deepest}`));
  roomsHead.append(progress);
  roomsSec.append(roomsHead);

  const rail = el('div', 'rm-map');
  rail.setAttribute('role', 'radiogroup');
  rail.setAttribute('aria-label', 'Rooms. Pick a tile to choose a room.');
  rail.hidden = true;

  const roomLabel = (index: number): string => (index < total ? `ROOM ${index + 1}` : `DEPTHS ${index + 1}`);
  let selected = Math.max(0, resumeRoom);
  if (lastRoomPick !== null && lastRoomPick >= 0 && lastRoomPick <= openThrough) selected = lastRoomPick;
  let mapOpen = false;
  const cardNodes = new Map<string, HTMLButtonElement>();
  const entries: Array<{ entry: RoomEntry; node: HTMLButtonElement }> = [];
  const summaryRoom = el('strong', 'rm-summary-room', '');
  const summaryHero = el('span', 'rm-summary-hero', '');
  const playSub = el('span', 'rm-play-sub', '');
  const mapPick = el('span', 'rm-mapbtn-room', '');

  const describe = (entry: RoomEntry): void => {
    summaryRoom.textContent = `${roomLabel(entry.index)} · ${entry.name}`;
    mapPick.textContent = `${roomLabel(entry.index)} · ${entry.name}`;
    playSub.textContent = roomLabel(entry.index);
  };

  const select = (entry: RoomEntry, node: HTMLButtonElement): void => {
    selected = entry.index;
    lastRoomPick = entry.index;
    for (const other of cardNodes.values()) {
      other.classList.remove('picked');
      other.setAttribute('aria-checked', 'false');
    }
    node.classList.add('picked');
    node.setAttribute('aria-checked', 'true');
    describe(entry);
  };

  const addCard = (entry: RoomEntry): void => {
    const node = el('button', `rm-tile${entry.locked ? ' locked' : ''}${entry.depths ? ' depths' : ''}`) as HTMLButtonElement;
    node.type = 'button';
    node.setAttribute('role', 'radio');
    node.setAttribute('aria-checked', 'false');
    node.setAttribute('data-index', String(entry.index));
    const label = entry.locked
      ? `Room ${entry.num}: locked. Clear room ${entry.index} to unlock.`
      : `${roomLabel(entry.index)}: ${entry.name}${entry.boss ? ', boss' : ''}${entry.stars > 0 ? `, ${starText(entry.stars)}` : ''}${entry.best !== null ? `, best ${entry.best}` : ''}`;
    node.setAttribute('aria-label', label);
    node.title = label;
    node.append(el('span', 'rm-tile-num', entry.locked ? '🔒' : entry.num));
    node.append(el('span', 'rm-tile-name', entry.locked ? '???' : entry.name));
    const meta = el('span', 'rm-tile-meta');
    if (entry.boss && !entry.locked) meta.append(el('span', 'rm-boss', 'BOSS'));
    if (entry.stars > 0) meta.append(el('span', 'rm-stars', starText(entry.stars)));
    else if (!entry.locked && entry.best !== null) meta.append(el('span', 'rm-tile-best', `★ ${formatScore(entry.best)}`));
    if (meta.childElementCount > 0) node.append(meta);
    if (entry.locked) {
      node.setAttribute('aria-disabled', 'true');
    } else {
      node.addEventListener('click', () => select(entry, node));
    }
    rail.append(node);
    cardNodes.set(entry.key, node);
    entries.push({ entry, node });
    if (entry.index === selected) {
      node.classList.add('picked');
      node.setAttribute('aria-checked', 'true');
      describe(entry);
    }
  };

  let lastAct = '';
  HANDCRAFTED_ROOMS.forEach((def, i) => {
    const act = actFor(i);
    if (act.id !== lastAct) {
      lastAct = act.id;
      const divider = el('div', 'rm-map-act', act.name.toLowerCase());
      divider.title = act.tagline;
      rail.append(divider);
    }
    const locked = i > openThrough;
    const stars = save.roomStars[def.id] ?? 0;
    const best = save.roomBests[def.id];
    addCard({
      key: `room-${i}`,
      index: i,
      num: String(i + 1),
      name: def.name.toLowerCase(),
      boss: !!def.boss,
      locked,
      depths: false,
      stars,
      best: best ? best.score : null,
    });
  });
  rail.append(el('div', 'rm-map-act', actFor(total).name.toLowerCase()));
  if (tester) {
    for (const { type, index } of depthsBossSlots()) {
      addCard({
        key: `depth-${index}`, index, num: String(index + 1), name: ENEMY_TYPES[type].name.toLowerCase(),
        boss: true, locked: false, depths: true, stars: 0, best: null,
      });
    }
  } else if (resumeRoom >= total) {
    const spec = bossSpecFor(resumeRoom, false, game.rooms.definition(resumeRoom));
    addCard({
      key: 'endless', index: resumeRoom, num: String(resumeRoom + 1), name: 'the depths',
      boss: !!spec, locked: false, depths: true, stars: 0, best: null,
    });
  } else {
    addCard({
      key: 'endless-locked', index: total, num: String(total + 1), name: 'the depths',
      boss: true, locked: true, depths: true, stars: 0, best: null,
    });
  }
  // ── the map button: the picked room on a signpost; opens the full map ──
  const mapBtn = el('button', 'rm-mapbtn') as HTMLButtonElement;
  mapBtn.type = 'button';
  mapBtn.setAttribute('aria-expanded', 'false');
  mapBtn.setAttribute('aria-controls', 'room-map');
  mapBtn.innerHTML =
    '<svg class="rm-mapicon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M4 12.5h6.5M13.5 12.5H20" stroke="currentColor" stroke-width="2"/><path d="M12 4v5.5M12 14.5V20" stroke="currentColor" stroke-width="2"/><rect x="5.5" y="5.5" width="5" height="5" fill="#e5383b"/></svg>';
  const mapBtnWords = el('span', 'rm-mapbtn-words');
  mapBtnWords.append(mapPick, el('span', 'rm-mapbtn-hint', 'tap for the map'));
  mapBtn.append(mapBtnWords);
  rail.id = 'room-map';
  const mapHead = el('div', 'rm-map-head');
  mapHead.append(el('div', 'tape-label', 'MAP'));
  const mapClose = el('button', 'rm-map-close', '✕ CLOSE') as HTMLButtonElement;
  mapClose.type = 'button';
  mapClose.setAttribute('aria-label', 'Close the map');
  mapHead.append(mapClose);
  const setMap = (open: boolean): void => {
    mapOpen = open;
    rail.hidden = !open;
    mapHead.hidden = !open;
    mapBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      mapBtnWords.querySelector('.rm-mapbtn-hint')!.textContent = 'tap to close';
      rail.querySelector<HTMLElement>('.rm-tile.picked')?.scrollIntoView({ block: 'nearest' });
    } else {
      mapBtnWords.querySelector('.rm-mapbtn-hint')!.textContent = 'tap for the map';
      mapBtn.focus();
    }
  };
  mapBtn.addEventListener('click', () => setMap(!mapOpen));
  mapClose.addEventListener('click', () => setMap(false));
  mapHead.hidden = true;
  roomsSec.append(mapBtn, mapHead, rail);
  modePaneRooms.append(roomsSec);

  // ── characters: the four heroes in a strip, picked one wears the crown ──
  const chars = el('section', 'rm-heroes');
  chars.setAttribute('aria-label', 'Character selection');
  chars.append(el('div', 'tape-label', 'CHARACTER'));
  const cast = el('div', 'rm-cast');
  cast.setAttribute('role', 'radiogroup');
  cast.setAttribute('aria-label', 'Heroes. Pick a card to choose a hero.');
  const crown = el('span', 'mm-crown');
  const heroCards = new Map<HeroId, HTMLButtonElement>();
  const paintHero = (id: HeroId): void => {
    for (const [otherId, card] of heroCards) {
      const on = otherId === id;
      card.classList.toggle('picked', on);
      card.setAttribute('aria-checked', String(on));
      if (on) card.prepend(crown);
    }
    summaryHero.textContent = heroPair(id);
  };
  for (const info of HEROES) {
    const card = el('button', 'rm-hero') as HTMLButtonElement;
    card.type = 'button';
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', 'false');
    card.setAttribute('aria-label', `Play as ${info.name}, ${info.note}`);
    const frame = el('div', 'hero-blank');
    frame.append(heroPortrait(info.id));
    card.append(frame, el('span', 'mm-card-name', info.name), el('span', 'mm-card-note', info.note));
    card.addEventListener('click', () => {
      paintHero(info.id);
      if (info.id === game.hero) return;
      // setHero() calls toMenu(), which rebuilds this screen. Keep the
      // characters sheet open on the rebuilt menu.
      reopenMode = 'characters';
      actions.hero(info.id);
    });
    cast.append(card);
    heroCards.set(info.id, card);
  }
  paintHero(game.hero);
  chars.append(cast);
  modePaneChars.append(chars);

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

  // MODE sheet: tabs + open/close. The full map lives here now, so the home
  // screen never opens a wall of room tiles on its own.
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
    if (tab === 'rooms') setMap(true);
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
      if (which === 'rooms') setMap(true);
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

  // Fallback if nothing was pre-selected: land on the first open tile.
  if (![...cardNodes.values()].some((n) => n.classList.contains('picked'))) {
    const firstOpen = entries.find(({ node }) => node.getAttribute('aria-disabled') !== 'true');
    if (firstOpen) select(firstOpen.entry, firstOpen.node);
  }

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
