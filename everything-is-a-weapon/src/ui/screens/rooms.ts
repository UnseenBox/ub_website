import type { Game } from '../../core/Game';
import { actFor, starText, totalStars } from '../../gameplay/Campaign';
import { campaignBossType } from '../../gameplay/RoomManager';
import { el } from '../dom';
import keyIconArt from '../../ui-kit/bonk2/assets/icons/key@2x.png';

export interface RoomEntry {
  readonly key: string;
  /** Room index to play when this entry is used. */
  readonly index: number;
  /** Number on the card. */
  readonly num: string;
  /** Room name or boss name. */
  readonly name: string;
  readonly boss: boolean;
  readonly locked: boolean;
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
  /** ENTER ROOM: confirm the pick and leave the sheet. */
  onEnter?: (choice: RoomChoice) => void;
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
  const total = game.rooms.roomCount;
  const tester =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('unlock');
  const resumeRoom = Math.min(Math.max(0, save.unlockedRoom), total - 1);
  const openThrough = tester ? total - 1 : resumeRoom;

  const section = el('section', 'b2-rooms');
  section.setAttribute('aria-label', 'Room selection');

  const head = el('header', 'b2-rooms__head');
  const heading = el('div', 'b2-rooms__heading');
  heading.append(
    el('h3', 'b2-rooms__title b2-display b2-outlined', 'THE FLOOR PLAN'),
    el('p', 'b2-rooms__sub', 'FIFTY ROOMS. PICK A NUMBER.'),
  );

  const openCount = tester
    ? total
    : Math.max(0, Math.min(save.unlockedRoom + 1, total));
  const stars = totalStars(save.roomStars);
  const stats = el('div', 'b2-rooms__stats');

  const openChip = el('div', 'b2-chip b2-rooms__chip');
  const keyIcon = el('img', 'b2-chip__icon');
  keyIcon.src = keyIconArt;
  keyIcon.alt = '';
  keyIcon.setAttribute('aria-hidden', 'true');
  const openText = el('span', 'b2-chip__text');
  openText.append(
    el('strong', 'b2-chip__value', `${openCount}/${total}`),
    el('span', 'b2-chip__label', 'ROOMS OPEN'),
  );
  openChip.append(keyIcon, openText);

  const starChip = el('div', 'b2-chip b2-rooms__chip');
  const starIcon = el('span', 'b2-chip__icon b2-rooms__star', '★');
  starIcon.setAttribute('aria-hidden', 'true');
  const starTextWrap = el('span', 'b2-chip__text');
  starTextWrap.append(
    el('strong', 'b2-chip__value b2-num', String(stars)),
    el('span', 'b2-chip__label', 'STARS'),
  );
  starChip.append(starIcon, starTextWrap);

  const depthChip = el('div', 'b2-chip b2-rooms__chip b2-rooms__chip--plain');
  const depthText = el('span', 'b2-chip__text');
  depthText.append(
    el('strong', 'b2-chip__value b2-num', save.deepest > 0 ? String(Math.min(save.deepest, total)) : '—'),
    el('span', 'b2-chip__label', 'DEEPEST'),
  );
  depthChip.append(depthText);

  stats.append(openChip, starChip, depthChip);
  head.append(heading, stats);

  const rail = el('div', 'b2-roomgrid b2-panel');
  rail.id = 'room-map';
  rail.setAttribute('role', 'radiogroup');
  rail.setAttribute('aria-label', 'Rooms. Pick a numbered room.');

  const foot = el('footer', 'b2-rooms__foot');
  const pickWrap = el('div', 'b2-rooms__pick-wrap');
  const pick = el('strong', 'b2-rooms__pick b2-display', '');
  const hint = el('span', 'b2-rooms__hint', '');
  hint.setAttribute('aria-live', 'polite');
  pickWrap.append(el('span', 'b2-label', 'SELECTED'), pick, hint);

  const enter = el('button', 'b2-btn b2-btn--yellow b2-rooms__enter');
  enter.type = 'button';
  enter.append(document.createTextNode('ENTER ROOM'));
  const chev = el('span', 'b2-btn__chev', '›');
  chev.setAttribute('aria-hidden', 'true');
  enter.append(chev);
  foot.append(pickWrap, enter);

  const roomLabel = (index: number): string => `ROOM ${index + 1}`;

  let selected = Math.min(resumeRoom, openThrough);
  if (typeof options.initial === 'number') {
    selected = Math.max(0, Math.min(options.initial, openThrough));
  } else if (lastPick !== null && lastPick >= 0 && lastPick <= openThrough) {
    selected = lastPick;
  }

  const cards: Array<{ entry: RoomEntry; node: HTMLButtonElement }> = [];

  const hintFor = (entry: RoomEntry): string => {
    // A locked card at index N opens after room N (1-based) is cleared.
    if (entry.locked) return `CLEAR ROOM ${entry.index} TO UNLOCK.`;
    if (openThrough >= total - 1) return 'EVERY ROOM IS UNLOCKED.';
    return `CLEAR ROOM ${openThrough + 1} TO UNLOCK THE NEXT.`;
  };

  const describe = (entry: RoomEntry): void => {
    const label = `${roomLabel(entry.index)} · ${entry.name}${entry.boss ? ' · BOSS' : ''}`;
    pick.textContent = label;
    hint.textContent = hintFor(entry);
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
    for (const other of cards) {
      other.node.classList.remove('is-selected');
      other.node.setAttribute('aria-checked', 'false');
    }
    node.classList.add('is-selected');
    node.setAttribute('aria-checked', 'true');
    describe(entry);
  };

  const addDivider = (name: string, tagline: string): void => {
    const divider = el('div', 'b2-roomgrid__act');
    divider.title = tagline;
    divider.append(
      el('span', 'b2-roomgrid__act-name', name),
      el('span', 'b2-roomgrid__act-tag', tagline),
    );
    rail.append(divider);
  };

  const addCard = (entry: RoomEntry): void => {
    const node = el(
      'button',
      `b2-roomtile${entry.locked ? ' is-locked' : ''}${
        !entry.locked && entry.index === save.unlockedRoom ? ' is-next' : ''
      }${entry.boss ? ' is-boss' : ''}`,
    );
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

    node.append(el('span', 'b2-roomtile__num b2-num', entry.num));

    const marks = el('span', 'b2-roomtile__marks');
    if (entry.locked) {
      const lock = el('span', 'b2-roomtile__lock');
      lock.setAttribute('aria-hidden', 'true');
      lock.innerHTML =
        '<svg viewBox="0 0 24 24" focusable="false"><path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><rect x="4.5" y="10" width="15" height="11" rx="1.5" fill="currentColor"/></svg>';
      marks.append(lock);
    } else {
      const starRow = el('span', 'b2-roomtile__stars');
      starRow.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 3; i++) {
        starRow.append(
          el('span', `b2-roomtile__star${i < entry.stars ? ' is-on' : ''}`, '★'),
        );
      }
      marks.append(starRow);
    }
    node.append(marks);

    const tick = el('span', 'b2-roomtile__tick', '✓');
    tick.setAttribute('aria-hidden', 'true');
    node.append(tick);

    if (entry.locked) {
      node.setAttribute('aria-disabled', 'true');
    } else {
      node.addEventListener('click', () => select(entry, node));
    }
    rail.append(node);
    cards.push({ entry, node });
    if (entry.index === selected) {
      node.classList.add('is-selected');
      node.setAttribute('aria-checked', 'true');
      describe(entry);
    }
  };

  let lastAct = '';
  for (let index = 0; index < total; index++) {
    const def = game.rooms.definition(index);
    const act = actFor(index);
    if (act.id !== lastAct) {
      lastAct = act.id;
      addDivider(act.name, act.tagline);
    }
    const locked = index > openThrough;
    const roomStars = save.roomStars[def.id] ?? 0;
    const best = save.roomBests[def.id];
    addCard({
      key: `room-${index}`,
      index,
      num: String(index + 1).padStart(2, '0'),
      name: def.name.toLowerCase(),
      boss: campaignBossType(index, def) !== null,
      locked,
      stars: roomStars,
      best: best ? best.score : null,
    });
  }

  // Fallback if nothing was pre-selected: land on the first open card.
  if (!cards.some(({ node }) => node.classList.contains('is-selected'))) {
    const firstOpen = cards.find(({ node }) => node.getAttribute('aria-disabled') !== 'true');
    if (firstOpen) select(firstOpen.entry, firstOpen.node);
  }

  enter.addEventListener('click', () => {
    const picked = cards.find(({ entry }) => entry.index === selected);
    if (!picked) return;
    select(picked.entry, picked.node);
    options.onEnter?.({
      index: picked.entry.index,
      label: `${roomLabel(picked.entry.index)} · ${picked.entry.name}`,
      shortLabel: roomLabel(picked.entry.index),
      name: picked.entry.name,
    });
  });

  section.append(head, rail, foot);

  return {
    root: section,
    selected: () => selected,
    showMap: (open: boolean) => {
      if (!open) return;
      const card = rail.querySelector<HTMLElement>('.b2-roomtile.is-selected');
      if (!card) return;
      // Keep the board at the top when the current room is already mostly
      // visible; only chase it when it is genuinely off-screen.
      const wall = rail.getBoundingClientRect();
      const box = card.getBoundingClientRect();
      const visible = Math.min(box.bottom, wall.bottom) - Math.max(box.top, wall.top);
      if (visible < box.height * 0.5) card.scrollIntoView({ block: 'nearest' });
    },
    focusSelected: () => {
      rail.querySelector<HTMLElement>('.b2-roomtile.is-selected')?.focus();
    },
  };
}
