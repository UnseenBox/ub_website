import type { Game } from '../../core/Game';
import { ENEMY_TYPES } from '../../entities/EnemyTypes';
import { actFor, campaignProgress, starText, totalStars } from '../../gameplay/Campaign';
import { HANDCRAFTED_ROOMS } from '../../gameplay/RoomDefinitions';
import { bossSpecFor, depthsBossSlots } from '../../gameplay/RoomManager';
import { el, formatScore } from '../dom';

export interface RoomEntry {
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

/** What the lobby needs to know when the player picks a room. */
export interface RoomChoice {
  index: number;
  /** 'ROOM 3 · the living room' */
  label: string;
  /** Just the room label, for the PLAY subtitle. */
  shortLabel: string;
  name: string;
}

export interface RoomsPaneOptions {
  /** Index to preselect. Falls back to the last pick, then the resume room. */
  initial?: number | null;
  onSelect?: (choice: RoomChoice) => void;
}

export interface RoomsPane {
  root: HTMLElement;
  /** The room index PLAY should start. */
  selected(): number;
  showMap(open: boolean): void;
  focusSelected(): void;
}

/** The pick survives a rebuild (hero changes rebuild the whole menu). */
let lastPick: number | null = null;

export function buildRoomsPane(game: Game, options: RoomsPaneOptions = {}): RoomsPane {
  const save = game.save.data;
  const total = HANDCRAFTED_ROOMS.length;
  const tester =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('unlock');
  const resumeRoom = save.unlockedRoom;
  const openThrough = tester ? total + 60 : resumeRoom;

  const section = el('section', 'rm-rooms');
  section.setAttribute('aria-label', 'Room selection');

  const head = el('div', 'rm-rooms-head');
  head.append(el('div', 'tape-label', tester ? 'ROOMS · TESTER' : 'ROOMS'));
  const openCount = Math.max(0, Math.min(openThrough + 1, total));
  const progress = el('div', 'rm-progress');
  const bar = el('div', 'rm-bar');
  const fill = el('span', 'rm-bar-fill');
  fill.style.width = `${campaignProgress(total, save.roomStars)}%`;
  bar.append(fill);
  const deepest = save.deepest > 0 ? `deepest ${save.deepest}` : 'first visit';
  progress.append(
    bar,
    el('span', 'rm-progress-text', `${openCount}/${total} open · ★${totalStars(save.roomStars)} · ${deepest}`),
  );
  head.append(progress);
  section.append(head);

  const rail = el('div', 'rm-map');
  rail.id = 'room-map';
  rail.setAttribute('role', 'radiogroup');
  rail.setAttribute('aria-label', 'Rooms. Pick a tile to choose a room.');
  rail.hidden = true;

  const roomLabel = (index: number): string =>
    index < total ? `ROOM ${index + 1}` : `DEPTHS ${index + 1}`;

  let selected = Math.max(0, resumeRoom);
  if (typeof options.initial === 'number') {
    selected = Math.max(0, options.initial);
  } else if (lastPick !== null && lastPick >= 0 && lastPick <= openThrough) {
    selected = lastPick;
  }

  const cardNodes = new Map<string, HTMLButtonElement>();
  const entries: Array<{ entry: RoomEntry; node: HTMLButtonElement }> = [];
  let mapPickEl: HTMLElement | null = null;

  const describe = (entry: RoomEntry): void => {
    const label = `${roomLabel(entry.index)} · ${entry.name}`;
    if (mapPickEl) mapPickEl.textContent = label;
    options.onSelect?.({
      index: entry.index,
      label,
      shortLabel: roomLabel(entry.index),
      name: entry.name,
    });
  };

  const select = (entry: RoomEntry, node: HTMLButtonElement): void => {
    selected = entry.index;
    lastPick = entry.index;
    for (const other of cardNodes.values()) {
      other.classList.remove('picked');
      other.setAttribute('aria-checked', 'false');
    }
    node.classList.add('picked');
    node.setAttribute('aria-checked', 'true');
    describe(entry);
  };

  const addCard = (entry: RoomEntry): void => {
    const node = el(
      'button',
      `rm-tile${entry.locked ? ' locked' : ''}${entry.depths ? ' depths' : ''}`,
    ) as HTMLButtonElement;
    node.type = 'button';
    node.setAttribute('role', 'radio');
    node.setAttribute('aria-checked', 'false');
    node.setAttribute('data-index', String(entry.index));
    const label = entry.locked
      ? `Room ${entry.num}: locked. Clear room ${entry.index} to unlock.`
      : `${roomLabel(entry.index)}: ${entry.name}${entry.boss ? ', boss' : ''}${
          entry.stars > 0 ? `, ${starText(entry.stars)}` : ''
        }${entry.best !== null ? `, best ${entry.best}` : ''}`;
    node.setAttribute('aria-label', label);
    node.title = label;
    node.append(el('span', 'rm-tile-num', entry.locked ? '🔒' : entry.num));
    node.append(el('span', 'rm-tile-name', entry.locked ? '???' : entry.name));
    const meta = el('span', 'rm-tile-meta');
    if (entry.boss && !entry.locked) meta.append(el('span', 'rm-boss', 'BOSS'));
    if (entry.stars > 0) meta.append(el('span', 'rm-stars', starText(entry.stars)));
    else if (!entry.locked && entry.best !== null) {
      meta.append(el('span', 'rm-tile-best', `★ ${formatScore(entry.best)}`));
    }
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
        key: `depth-${index}`,
        index,
        num: String(index + 1),
        name: ENEMY_TYPES[type].name.toLowerCase(),
        boss: true,
        locked: false,
        depths: true,
        stars: 0,
        best: null,
      });
    }
  } else if (resumeRoom >= total) {
    const spec = bossSpecFor(resumeRoom, false, game.rooms.definition(resumeRoom));
    addCard({
      key: 'endless',
      index: resumeRoom,
      num: String(resumeRoom + 1),
      name: 'the depths',
      boss: !!spec,
      locked: false,
      depths: true,
      stars: 0,
      best: null,
    });
  } else {
    addCard({
      key: 'endless-locked',
      index: total,
      num: String(total + 1),
      name: 'the depths',
      boss: true,
      locked: true,
      depths: true,
      stars: 0,
      best: null,
    });
  }

  // The signpost: the picked room, and the control that opens the full map.
  const mapBtn = el('button', 'rm-mapbtn') as HTMLButtonElement;
  mapBtn.type = 'button';
  mapBtn.setAttribute('aria-expanded', 'false');
  mapBtn.setAttribute('aria-controls', 'room-map');
  mapBtn.innerHTML =
    '<svg class="rm-mapicon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M4 12.5h6.5M13.5 12.5H20" stroke="currentColor" stroke-width="2"/><path d="M12 4v5.5M12 14.5V20" stroke="currentColor" stroke-width="2"/><rect x="5.5" y="5.5" width="5" height="5" fill="#e5383b"/></svg>';
  const mapBtnWords = el('span', 'rm-mapbtn-words');
  const mapPick = el('span', 'rm-mapbtn-room', '');
  mapPickEl = mapPick;
  mapBtnWords.append(mapPick, el('span', 'rm-mapbtn-hint', 'tap for the map'));
  mapBtn.append(mapBtnWords);

  const mapHead = el('div', 'rm-map-head');
  mapHead.append(el('div', 'tape-label', 'MAP'));
  const mapClose = el('button', 'rm-map-close', '✕ CLOSE') as HTMLButtonElement;
  mapClose.type = 'button';
  mapClose.setAttribute('aria-label', 'Close the map');
  mapHead.append(mapClose);
  mapHead.hidden = true;

  let mapOpen = false;
  const setMap = (open: boolean): void => {
    mapOpen = open;
    rail.hidden = !open;
    mapHead.hidden = !open;
    mapBtn.setAttribute('aria-expanded', String(open));
    const hint = mapBtnWords.querySelector('.rm-mapbtn-hint');
    if (hint) hint.textContent = open ? 'tap to close' : 'tap for the map';
    if (open) {
      rail.querySelector<HTMLElement>('.rm-tile.picked')?.scrollIntoView({ block: 'nearest' });
    }
  };
  mapBtn.addEventListener('click', () => setMap(!mapOpen));
  mapClose.addEventListener('click', () => setMap(false));

  // The signpost shows the same label the lobby summary does.
  const pickedEntry = entries.find(({ entry }) => entry.index === selected)?.entry;
  if (pickedEntry) {
    mapPick.textContent = `${roomLabel(pickedEntry.index)} · ${pickedEntry.name}`;
  }

  section.append(mapBtn, mapHead, rail);

  // Fallback if nothing was pre-selected: land on the first open tile.
  if (![...cardNodes.values()].some((node) => node.classList.contains('picked'))) {
    const firstOpen = entries.find(({ node }) => node.getAttribute('aria-disabled') !== 'true');
    if (firstOpen) select(firstOpen.entry, firstOpen.node);
  }

  return {
    root: section,
    selected: () => selected,
    showMap: setMap,
    focusSelected: () => {
      rail.querySelector<HTMLElement>('.rm-tile.picked')?.focus();
    },
  };
}
