import type { Game } from '../core/Game';
import { HEROES, type HeroId } from '../core/Hero';
import { ENEMY_TYPES } from '../entities/EnemyTypes';
import { CHALLENGES } from '../gameplay/ChallengeSystem';
import { HANDCRAFTED_ROOMS } from '../gameplay/RoomDefinitions';
import { bossSpecFor, depthsBossSlots } from '../gameplay/RoomManager';
import { controlRows } from './PauseMenu';
import { button, el, formatScore } from './dom';

export interface MenuActions {
  play(roomIndex: number): void;
  daily(): void;
  settings(): void;
  controls(): void;
  hero(id: HeroId): void;
}

interface KeyEntry {
  readonly key: string;
  /** Room index to play when this key is used. */
  readonly index: number;
  /** What hangs on the tag: a room number, or ∞ for the endless depths. */
  readonly label: string;
  /** Room name, boss name, or 'the depths'. */
  readonly name: string;
  readonly boss: boolean;
  readonly locked: boolean;
}

/** Challenge text for a room, if it has one. */
function challengeText(roomChallenge: string | undefined): string | null {
  if (!roomChallenge) return null;
  return CHALLENGES.find((c) => c.id === roomChallenge)?.text.toLowerCase() ?? null;
}

/**
 * The front page: logo and tagline up top, a wall of hanging room keys as the
 * main event, four character cards with blank frames awaiting artwork, and one
 * big red PLAY button. Nothing else competes for attention.
 */
export function buildMainMenu(game: Game, actions: MenuActions): HTMLElement {
  const save = game.save.data;
  const screen = el('div', 'screen menu menu-keys');

  // Tester unlock (?unlock in the URL): every room open plus the depths bosses
  // pinned to the same rack. Session-only: the save file is never touched, so
  // real progression is exactly as locked as you left it.
  const tester = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('unlock');
  const total = HANDCRAFTED_ROOMS.length;
  const resumeRoom = save.unlockedRoom;
  const openThrough = tester ? total + 60 : resumeRoom;

  // ── header: the logo, loud and centered ──
  const head = el('header', 'mk-head');
  const logo = el('div', 'mm-logo');
  logo.setAttribute('role', 'img');
  logo.setAttribute('aria-label', 'BONK! Everything is a weapon');
  const letters: Array<[string, string]> = [['B', 'mm-l0'], ['O', 'mm-l1'], ['N', 'mm-l2'], ['K', 'mm-l3'], ['!', 'mm-l4']];
  for (const [char, cls] of letters) logo.append(el('span', `mm-letter ${cls}`, char));
  const tagline = el('div', 'mm-tagline');
  tagline.append(el('span', 'mm-tagline-text', 'everything is a weapon'));
  head.append(logo, tagline);
  screen.append(head);

  // ── the wall of keys ──
  const wallSec = el('section', 'mk-wall board');
  wallSec.setAttribute('aria-label', 'Room selection');
  wallSec.append(el('div', 'tape-label', tester ? 'ROOM KEYS · TESTER' : 'ROOM KEYS'));
  const rack = el('div', 'key-rack');
  rack.setAttribute('role', 'listbox');
  rack.setAttribute('aria-label', 'Rooms. Pick a key to choose a room.');
  const info = el('div', 'key-info');
  info.setAttribute('aria-live', 'polite');

  let selected = Math.max(0, resumeRoom);
  const keyNodes = new Map<string, HTMLElement>();
  const entries: Array<{ entry: KeyEntry; node: HTMLElement }> = [];
  // Declared up here: the key wall describes the selection into it while building.
  const playSub = el('span', 'mk-play-sub', '');

  const roomLabel = (index: number): string => (index < total ? `ROOM ${index + 1}` : `DEPTHS ${index + 1}`);

  const describe = (entry: KeyEntry): void => {
    info.replaceChildren();
    info.append(el('span', 'key-info-room', `${roomLabel(entry.index)} — ${entry.name}`));
    if (entry.index < total) {
      const def = HANDCRAFTED_ROOMS[entry.index]!;
      const best = save.roomBests[def.id];
      if (best) info.append(el('span', 'key-info-best', `★ ${formatScore(best.score)}`));
      const challenge = challengeText(def.challenge);
      if (challenge) {
        const done = save.completedChallenges.includes(def.challenge!);
        info.append(el('span', 'key-info-challenge', `${done ? '✓ ' : '✚ '}${challenge}`));
      }
    }
    if (entry.boss) info.append(el('span', 'key-info-boss', 'BOSS'));
    playSub.textContent = roomLabel(entry.index);
  };

  const select = (entry: KeyEntry, node: HTMLElement, scroll = true): void => {
    selected = entry.index;
    for (const other of keyNodes.values()) {
      other.classList.remove('selected');
      other.setAttribute('aria-selected', 'false');
    }
    node.classList.add('selected');
    node.setAttribute('aria-selected', 'true');
    describe(entry);
    if (scroll && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
  };

  const addKey = (entry: KeyEntry): void => {
    if (entry.locked) {
      const node = el('div', 'key locked');
      node.setAttribute('role', 'option');
      node.setAttribute('aria-selected', 'false');
      node.setAttribute('data-index', String(entry.index));
      node.setAttribute('aria-label', `Room ${entry.label}: clear room ${Number(entry.label) - 1} to unlock`);
      node.append(el('span', 'key-hook'), el('span', 'key-body'), el('span', 'key-tag', `🔒${entry.label}`));
      rack.append(node);
      keyNodes.set(entry.key, node);
      return;
    }
    const node = el('button', 'key') as HTMLButtonElement;
    node.type = 'button';
    node.setAttribute('role', 'option');
    node.setAttribute('aria-selected', 'false');
    node.setAttribute('data-index', String(entry.index));
    node.setAttribute('aria-label', `Room ${entry.label}: ${entry.name}${entry.boss ? ', boss' : ''}`);
    node.append(el('span', 'key-hook'), el('span', 'key-body'), el('span', 'key-tag', entry.label));
    if (entry.boss) node.append(el('span', 'key-boss', 'BOSS'));
    node.addEventListener('click', () => select(entry, node));
    rack.append(node);
    keyNodes.set(entry.key, node);
    entries.push({ entry, node });
    if (entry.index === selected) {
      node.classList.add('selected');
      node.setAttribute('aria-selected', 'true');
      describe(entry);
    }
  };

  HANDCRAFTED_ROOMS.forEach((def, i) => {
    addKey({ key: `room-${i}`, index: i, label: String(i + 1), name: def.name.toLowerCase(), boss: !!def.boss, locked: i > openThrough });
  });
  if (tester) {
    for (const { type, index } of depthsBossSlots()) {
      addKey({ key: `depth-${index}`, index, label: String(index + 1), name: ENEMY_TYPES[type].name.toLowerCase(), boss: true, locked: false });
    }
  } else if (resumeRoom >= total) {
    const spec = bossSpecFor(resumeRoom, false, game.rooms.definition(resumeRoom));
    addKey({ key: 'endless', index: resumeRoom, label: '∞', name: 'the depths', boss: !!spec, locked: false });
  }
  wallSec.append(rack, info);
  screen.append(wallSec);

  // ── characters: same four cards, frames left blank for future artwork ──
  const chars = el('section', 'mk-chars board');
  chars.setAttribute('aria-label', 'Character selection');
  chars.append(el('div', 'tape-label', 'CHOOSE YOUR CHARACTER'));
  const cards = el('div', 'mk-cards');
  for (const hero of HEROES) {
    const picked = hero.id === game.hero;
    const card = el('button', `mk-card${picked ? ' picked' : ''}`);
    card.type = 'button';
    card.setAttribute('aria-pressed', String(picked));
    card.setAttribute('aria-label', `Play as ${hero.name}`);
    if (picked) card.append(el('span', 'mm-crown'));
    const blank = el('div', 'hero-blank');
    blank.setAttribute('role', 'img');
    blank.setAttribute('aria-label', `${hero.name} artwork coming soon`);
    card.append(blank, el('span', 'mm-card-name', hero.name), el('span', 'mm-card-note', hero.note));
    card.addEventListener('click', () => actions.hero(hero.id));
    cards.append(card);
  }
  chars.append(cards);
  screen.append(chars);

  // ── actions: one huge red PLAY, everything else secondary ──
  const actionsRow = el('div', 'mk-actions');
  const playBtn = button('▶ PLAY', 'primary mk-play', () => actions.play(selected));
  playBtn.append(playSub);
  const dailyBtn = button('🏆 DAILY CHALLENGE', 'mk-daily', actions.daily);
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  dailyBtn.append(el('span', 'mk-daily-sub', `fresh every day · ${today}`));
  const secondary = el('div', 'mk-secondary');
  secondary.append(button('⚙ SETTINGS', 'mk-small', actions.settings), button('🎮 CONTROLS', 'mk-small', actions.controls));
  actionsRow.append(playBtn, dailyBtn, secondary);
  screen.append(actionsRow);

  // Fallback if nothing was pre-selected: land on the first open key.
  if (![...keyNodes.values()].some((n) => n.classList.contains('selected'))) {
    const firstOpen = entries.find(({ node }) => node.tagName === 'BUTTON');
    if (firstOpen) select(firstOpen.entry, firstOpen.node, false);
  }

  // The only footer left: a warning when the browser refuses storage.
  if (!game.save.persistent) {
    const footer = el('div', 'menu-footer');
    footer.append(el('span', 'warn', 'Storage is blocked — progress will not be saved.'));
    screen.append(footer);
  }
  return screen;
}

/** Controls: the same fight manual as the pause screen, on its own sheet. */
export function buildControls(game: Game, onBack: () => void): HTMLElement {
  const screen = el('div', 'screen settings');
  const sheet = el('div', 'sheet rules-sheet');
  const head = el('div', 'sheet-head');
  head.append(el('span', 'sheet-title', 'CONTROLS'), el('span', 'sheet-no', 'how to fight'));
  sheet.append(head);
  for (const [key, action] of controlRows(game.input.touch)) {
    const row = el('div', 'control-row');
    row.append(el('span', 'key', key), el('span', '', action));
    sheet.append(row);
  }
  screen.append(sheet, button('BACK', 'primary', onBack));
  return screen;
}
