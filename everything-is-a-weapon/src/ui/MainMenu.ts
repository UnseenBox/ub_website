import type { Game } from '../core/Game';
import { HEROES, type HeroId } from '../core/Hero';
import { ENEMY_TYPES } from '../entities/EnemyTypes';
import { CHALLENGES } from '../gameplay/ChallengeSystem';
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

/** Challenge text for a room, if it has one. */
function challengeText(roomChallenge: string | undefined): string | null {
  if (!roomChallenge) return null;
  return CHALLENGES.find((c) => c.id === roomChallenge)?.text.toLowerCase() ?? null;
}

/**
 * The front page: logo up top with a settings cog in the corner, the chosen
 * room's front door over one big red PLAY button, and the four characters in
 * a column down the side. Pressing the door swaps the page for a wall of
 * hanging room keys (brass for rooms you have reached, iron for the rest).
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
  const gear = el('button', 'mk-gear');
  gear.type = 'button';
  gear.setAttribute('aria-label', 'Settings');
  gear.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M10.3 2h3.4l.5 2.6 1.7.7 2.2-1.5 2.4 2.4-1.5 2.2.7 1.7 2.6.5v3.4l-2.6.5-.7 1.7 1.5 2.2-2.4 2.4-2.2-1.5-1.7.7-.5 2.6h-3.4l-.5-2.6-1.7-.7-2.2 1.5-2.4-2.4 1.5-2.2-.7-1.7L2 13.7v-3.4l2.6-.5.7-1.7-1.5-2.2 2.4-2.4 2.2 1.5 1.7-.7zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"/></svg>';
  gear.addEventListener('click', actions.settings);
  head.append(logo, tagline, gear);
  screen.append(head);

  // ── the door: wears the chosen room's number, opens the key wall ──
  const doorway = el('section', 'mk-doorway');
  doorway.setAttribute('aria-label', 'Room selection');
  const door = el('button', 'mk-door');
  door.type = 'button';
  const plate = el('span', 'door-plate');
  const leaf = el('span', 'door-leaf');
  leaf.append(plate, el('span', 'door-panel'), el('span', 'door-panel'), el('span', 'door-knob'));
  door.append(leaf);
  const doorNote = el('div', 'door-note');
  const doorRoom = el('strong', 'door-note-room');
  doorNote.append(el('span', '', 'now playing'), doorRoom, el('span', 'door-note-hint', 'knock on the door to pick another room'));
  doorway.append(door, doorNote);
  screen.append(doorway);

  // ── the wall of keys: hidden until the door is pressed ──
  const wallSec = el('section', 'mk-wall');
  wallSec.setAttribute('aria-label', 'Room keys');
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
    plate.textContent = entry.label;
    doorRoom.textContent = `${roomLabel(entry.index)}: ${entry.name}`;
    door.setAttribute('aria-label', `${roomLabel(entry.index)}, ${entry.name}. Open the key wall to pick another room.`);
  };

  const openWall = (open: boolean): void => {
    screen.classList.toggle('wall-open', open);
    // Focus also scrolls the key (or the door) into view on cramped screens.
    (open ? rack.querySelector<HTMLElement>('button.key.selected') : door)?.focus();
  };
  door.addEventListener('click', () => openWall(true));

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

  // ── characters: the four heroes, each drawn into its card frame ──
  const chars = el('section', 'mk-chars');
  chars.setAttribute('aria-label', 'Character selection');
  chars.append(el('div', 'tape-label', 'CHARACTER'));
  const cards = el('div', 'mk-cards');
  for (const hero of HEROES) {
    const picked = hero.id === game.hero;
    const card = el('button', `mk-card${picked ? ' picked' : ''}`);
    card.type = 'button';
    card.setAttribute('aria-pressed', String(picked));
    card.setAttribute('aria-label', `Play as ${hero.name}`);
    if (picked) card.append(el('span', 'mm-crown'));
    const frame = el('div', 'hero-blank');
    frame.append(heroPortrait(hero.id));
    card.append(frame, el('span', 'mm-card-name', hero.name), el('span', 'mm-card-note', hero.note));
    card.addEventListener('click', () => actions.hero(hero.id));
    cards.append(card);
  }
  chars.append(cards);
  screen.append(chars);

  // ── actions: one huge red PLAY (plus BACK on the key wall) ──
  const actionsRow = el('div', 'mk-actions');
  const playBtn = button('▶ PLAY', 'primary mk-play', () => actions.play(selected));
  playBtn.append(playSub);
  actionsRow.append(playBtn, button('◀ BACK', 'mk-small mk-back', () => openWall(false)));
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

