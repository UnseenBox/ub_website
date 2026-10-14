import type { Game } from '../core/Game';
import { HEROES, type HeroId } from '../core/Hero';
import { ENEMY_TYPES } from '../entities/EnemyTypes';
import { CHALLENGES } from '../gameplay/ChallengeSystem';
import { BRIEFINGS, actFor, starText } from '../gameplay/Campaign';
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
  /** What hangs on the tag: the room number. */
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

/** Two-word sticky version for the key wall; the full text lives in the tooltip. */
function challengeShort(roomChallenge: string | undefined): string | null {
  if (!roomChallenge) return null;
  return CHALLENGES.find((c) => c.id === roomChallenge)?.short.toLowerCase() ?? null;
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
  doorNote.append(doorRoom, el('span', 'door-note-hint', 'tap door = rooms'));
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
      const starCount = save.roomStars[def.id] ?? 0;
      if (starCount > 0) info.append(el('span', 'key-info-stars', starText(starCount)));
      if (best) info.append(el('span', 'key-info-best', `★ ${formatScore(best.score)}`));
      const briefing = BRIEFINGS[def.id];
      if (briefing) {
        info.append(el('span', 'key-info-objective', `◎ ${briefing.objective}`));
      }
      const short = challengeShort(def.challenge);
      if (short) {
        const done = save.completedChallenges.includes(def.challenge!);
        const tag = el('span', 'key-info-challenge', `${done ? '✓ ' : '✚ '}${short}`);
        tag.title = challengeText(def.challenge) ?? '';
        info.append(tag);
      }
    } else {
      info.append(el('span', 'key-info-story', 'endless rooms · daily work'));
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
      const hint = entry.key === 'endless-locked' ? `the depths: clear room ${total} to unlock` : `clear room ${Number(entry.label) - 1} to unlock`;
      node.setAttribute('aria-label', `Room ${entry.label}: ${hint}`);
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
    if (entry.index < HANDCRAFTED_ROOMS.length) {
      const stars = game.save.data.roomStars[HANDCRAFTED_ROOMS[entry.index]!.id] ?? 0;
      if (stars > 0) node.append(el('span', 'key-stars', starText(stars)));
    }
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

  // Every room on one wall, grouped by act — locked keys stay visible as locked.
  let lastAct = '';
  HANDCRAFTED_ROOMS.forEach((def, i) => {
    const actId = actFor(i).id;
    if (actId !== lastAct) {
      lastAct = actId;
      rack.append(el('div', 'key-act', actFor(i).name.toLowerCase()));
    }
    addKey({ key: `room-${i}`, index: i, label: String(i + 1), name: def.name.toLowerCase(), boss: !!def.boss, locked: i > openThrough });
  });
  rack.append(el('div', 'key-act', actFor(total).name.toLowerCase()));
  if (tester) {
    for (const { type, index } of depthsBossSlots()) {
      addKey({ key: `depth-${index}`, index, label: String(index + 1), name: ENEMY_TYPES[type].name.toLowerCase(), boss: true, locked: false });
    }
  } else if (resumeRoom >= total) {
    const spec = bossSpecFor(resumeRoom, false, game.rooms.definition(resumeRoom));
    addKey({ key: 'endless', index: resumeRoom, label: String(resumeRoom + 1), name: 'the depths', boss: !!spec, locked: false });
  } else {
    addKey({ key: 'endless-locked', index: total, label: String(total + 1), name: 'the depths', boss: true, locked: true });
  }
  wallSec.append(rack, info);
  screen.append(wallSec);

  // ── at-a-glance pips on the front page: all rooms, locked or not ──
  const pips = el('div', 'mk-pips');
  pips.setAttribute('aria-label', 'Rooms overview. Open the key wall to choose.');
  const done = resumeRoom >= total;
  pips.append(
    el('span', 'mk-goal', done ? `★ lease yours · deepest ${Math.max(save.deepest, total)}` : `★ ${Math.min(resumeRoom + 1, total)}/${total} · evict the landlord`),
  );
  const openPips = (): void => openWall(true);
  HANDCRAFTED_ROOMS.forEach((def, i) => {
    const locked = i > openThrough;
    const starCount = save.roomStars[def.id] ?? 0;
    const pip = el('button', `pip${locked ? ' locked' : ''}${starCount >= 3 ? ' perfect' : ''}`);
    pip.type = 'button';
    pip.textContent = locked ? '🔒' : String(i + 1);
    pip.title = locked ? `room ${i + 1}: locked` : `room ${i + 1}: ${def.name.toLowerCase()}${starCount > 0 ? ` · ${starText(starCount)}` : ''}`;
    pip.setAttribute('aria-label', pip.title);
    pip.addEventListener('click', openPips);
    pips.append(pip);
  });
  const dpip = el('button', 'pip depths');
  dpip.type = 'button';
  dpip.textContent = resumeRoom >= total ? String(resumeRoom + 1) : '🔒';
  dpip.title = resumeRoom >= total ? 'the depths: endless' : 'the depths: clear room 8 to unlock';
  dpip.setAttribute('aria-label', dpip.title);
  dpip.addEventListener('click', openPips);
  pips.append(dpip);
  screen.append(pips);

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
    const warn = el('span', 'warn', '⚠ no save');
    warn.title = 'Storage is blocked — progress will not be saved.';
    footer.append(warn);
    screen.append(footer);
  }
  return screen;
}

