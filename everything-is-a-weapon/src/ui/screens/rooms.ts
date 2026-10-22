import type { Game } from '../../core/Game';
import { ENEMY_TYPES } from '../../entities/EnemyTypes';
import { actFor, campaignProgress, starText, totalStars } from '../../gameplay/Campaign';
import { HANDCRAFTED_ROOMS } from '../../gameplay/RoomDefinitions';
import { bossSpecFor, depthsBossSlots } from '../../gameplay/RoomManager';
import { el, formatScore } from '../dom';
import keyBedroom from '../../ui-kit/bonk2/assets/buttons/room-key-bedroom@2x.png';
import keyKitchen from '../../ui-kit/bonk2/assets/buttons/room-key-kitchen@2x.png';
import keyLiving from '../../ui-kit/bonk2/assets/buttons/room-key-living@2x.png';
import keyIconArt from '../../ui-kit/bonk2/assets/icons/key@2x.png';

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

/**
 * The kit only draws three hanging keys; the wall cycles them so every room
 * still gets a key. Their baked name plates are cropped away by the card CSS —
 * every word on the wall is live text.
 */
const KEY_ART: readonly string[] = [keyLiving, keyKitchen, keyBedroom];

export function buildRoomsPane(game: Game, options: RoomsPaneOptions = {}): RoomsPane {
  const save = game.save.data;
  const total = HANDCRAFTED_ROOMS.length;
  const tester =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('unlock');
  const resumeRoom = save.unlockedRoom;
  const openThrough = tester ? total + 60 : resumeRoom;

  const section = el('section', 'b2-rooms');
  section.setAttribute('aria-label', 'Room selection');

  const head = el('header', 'b2-rooms__head');
  const heading = el('div', 'b2-rooms__heading');
  heading.append(
    el('h3', 'b2-rooms__title b2-display b2-outlined', 'THE KEY WALL'),
    el('p', 'b2-rooms__sub', 'EVERY ROOM. A NEW BAD IDEA.'),
  );

  const openCount = Math.max(0, Math.min(openThrough + 1, total));
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
    el('strong', 'b2-chip__value b2-num', save.deepest > 0 ? String(save.deepest) : '—'),
    el('span', 'b2-chip__label', 'DEEPEST'),
  );
  depthChip.append(depthText);

  stats.append(openChip, starChip, depthChip);
  head.append(heading, stats);

  const progress = el('div', 'b2-meter b2-rooms__meter');
  progress.setAttribute('role', 'progressbar');
  progress.setAttribute('aria-label', 'Campaign stars');
  progress.setAttribute('aria-valuemin', '0');
  progress.setAttribute('aria-valuemax', '100');
  progress.setAttribute('aria-valuenow', String(campaignProgress(total, save.roomStars)));
  const progressFill = el('span', 'b2-meter__fill');
  progressFill.style.setProperty('--b2-value', `${campaignProgress(total, save.roomStars)}%`);
  progress.append(progressFill);

  const rail = el('div', 'b2-keywall b2-panel');
  rail.id = 'room-map';
  rail.setAttribute('role', 'radiogroup');
  rail.setAttribute('aria-label', 'Rooms. Pick a card to choose a room.');

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

  const roomLabel = (index: number): string =>
    index < total ? `ROOM ${index + 1}` : `DEPTHS ${index + 1}`;

  let selected = Math.max(0, resumeRoom);
  if (typeof options.initial === 'number') {
    selected = Math.max(0, options.initial);
  } else if (lastPick !== null && lastPick >= 0 && lastPick <= openThrough) {
    selected = lastPick;
  }

  const cards: Array<{ entry: RoomEntry; node: HTMLButtonElement }> = [];

  const hintFor = (entry: RoomEntry): string => {
    if (entry.depths) return 'THE BUILDING GOES DOWN FOREVER.';
    if (openThrough >= total - 1) return 'EVERY KEY ON THE WALL IS YOURS.';
    return `CLEAR ${roomLabel(openThrough)} TO EARN THE NEXT KEY.`;
  };

  const describe = (entry: RoomEntry): void => {
    const label = `${roomLabel(entry.index)} · ${entry.name}`;
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
    const divider = el('div', 'b2-keywall__act');
    divider.title = tagline;
    divider.append(
      el('span', 'b2-keywall__act-name', name),
      el('span', 'b2-keywall__act-tag', tagline),
    );
    rail.append(divider);
  };

  const addCard = (entry: RoomEntry): void => {
    const node = el(
      'button',
      `b2-keycard${entry.locked ? ' is-locked' : ''}${entry.depths ? ' is-depths' : ''}${
        !entry.locked && entry.index === save.unlockedRoom ? ' is-next' : ''
      }`,
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

    node.append(el('span', 'b2-keycard__num b2-badge b2-num', entry.num));

    const key = el('span', 'b2-keycard__key');
    const keyImg = el('img', 'b2-keycard__key-img');
    keyImg.src = KEY_ART[entry.index % KEY_ART.length]!;
    keyImg.alt = '';
    keyImg.decoding = 'async';
    keyImg.draggable = false;
    key.append(keyImg);
    if (entry.locked) {
      const lock = el('span', 'b2-keycard__lock');
      lock.setAttribute('aria-hidden', 'true');
      lock.innerHTML =
        '<svg viewBox="0 0 24 24" focusable="false"><path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><rect x="4.5" y="10" width="15" height="11" rx="1.5" fill="currentColor"/></svg>';
      key.append(lock);
    }
    node.append(key);

    node.append(
      el(
        'span',
        'b2-keycard__plate',
        entry.locked ? '???' : entry.name,
      ),
    );

    const meta = el('span', 'b2-keycard__meta');
    if (!entry.locked) {
      const starRow = el('span', 'b2-keycard__stars');
      starRow.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 3; i++) {
        starRow.append(
          el('span', `b2-keycard__star${i < entry.stars ? ' is-on' : ''}`, '★'),
        );
      }
      meta.append(starRow);
      if (entry.boss) meta.append(el('span', 'b2-badge b2-keycard__tag', 'BOSS'));
    }
    const best = entry.locked || entry.best === null ? '—' : formatScore(entry.best);
    meta.append(el('span', 'b2-keycard__best b2-num', `BEST ${best}`));
    node.append(meta);

    const tick = el('span', 'b2-keycard__tick');
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
  HANDCRAFTED_ROOMS.forEach((def, i) => {
    const act = actFor(i);
    if (act.id !== lastAct) {
      lastAct = act.id;
      addDivider(act.name, act.tagline);
    }
    const locked = i > openThrough;
    const roomStars = save.roomStars[def.id] ?? 0;
    const best = save.roomBests[def.id];
    addCard({
      key: `room-${i}`,
      index: i,
      num: String(i + 1).padStart(2, '0'),
      name: def.name.toLowerCase(),
      boss: !!def.boss,
      locked,
      depths: false,
      stars: roomStars,
      best: best ? best.score : null,
    });
  });

  const depthAct = actFor(total);
  addDivider(depthAct.name, depthAct.tagline);
  if (tester) {
    for (const { type, index } of depthsBossSlots()) {
      addCard({
        key: `depth-${index}`,
        index,
        num: String(index + 1).padStart(2, '0'),
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
      num: String(resumeRoom + 1).padStart(2, '0'),
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
      num: String(total + 1).padStart(2, '0'),
      name: 'the depths',
      boss: true,
      locked: true,
      depths: true,
      stars: 0,
      best: null,
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

  section.append(head, progress, rail, foot);

  return {
    root: section,
    selected: () => selected,
    showMap: (open: boolean) => {
      if (!open) return;
      const card = rail.querySelector<HTMLElement>('.b2-keycard.is-selected');
      if (!card) return;
      // Keep the board at the top when the current key is already mostly
      // visible; only chase it when it is genuinely off-screen.
      const wall = rail.getBoundingClientRect();
      const box = card.getBoundingClientRect();
      const visible = Math.min(box.bottom, wall.bottom) - Math.max(box.top, wall.top);
      if (visible < box.height * 0.5) card.scrollIntoView({ block: 'nearest' });
    },
    focusSelected: () => {
      rail.querySelector<HTMLElement>('.b2-keycard.is-selected')?.focus();
    },
  };
}
