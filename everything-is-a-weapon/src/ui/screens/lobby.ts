import type { Game } from '../../core/Game';
import type { HeroId } from '../../core/Hero';
import { DIFFICULTY_LABELS, type Difficulty } from '../../save/SaveManager';
import { el } from '../dom';
import { affordableUpgrades } from '../../gameplay/Upgrades';
import { buildCharactersPane, heroPair, heroPortrait } from './characters';
import { buildRoomsPane } from './rooms';

import coinUrl from '../../ui-kit/bonk2/assets/icons/coin@2x.png?url';
import keyUrl from '../../ui-kit/bonk2/assets/icons/key@2x.png?url';
import lampUrl from '../../ui-kit/bonk2/assets/icons/lamp@2x.png?url';

export interface MenuActions {
  play(roomIndex: number): void;
  /** Picks up the saved run at `runFloor`. */
  continueRun(): void;
  /** Starts today's daily room. */
  daily(): void;
  /** Starts an endless run. */
  endless(): void;
  store(): void;
  settings(): void;
  hero(id: HeroId): void;
}

/** Hero picks rebuild the menu; remember to reopen the characters sheet. */
let reopenMode: 'rooms' | 'characters' | null = null;
/** The room picked in MODE, kept across the hero-pick rebuild. */
let lastRoomPick: number | null = null;

const roomLabel = (index: number): string => `ROOM ${index + 1}`;

const TAGLINES = [
  'THE GNOMES GOT IN. GET THEM OUT.',
  'EVERYTHING IS A WEAPON.',
  'THROW THE FURNITURE.',
  'NO GNOMES IN THE KITCHEN.',
  'SHOES OFF. GNOMES OUT.',
  'MY HOUSE. MY RULES.',
] as const;

const BURST_WORDS = ['WHACK!', 'POW!', 'WHAM!', 'THWACK!', 'BOING!'] as const;
const BURST_COLORS = ['#ffd447', '#2bb3a3', '#e4483f', '#ff9f2e', '#f28da0'] as const;
const PARTICLE_SHAPES = ['star', 'diamond', 'dot', 'ring', 'square'] as const;

const reducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A slow field of drifting confetti behind the menu. Pure CSS animation, a dozen or so nodes. */
function buildParticles(count: number): HTMLElement {
  const layer = el('div', 'b2-lobby__fx');
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i++) {
    const p = el('span', `b2-lobby__bit b2-lobby__bit--${PARTICLE_SHAPES[i % PARTICLE_SHAPES.length]}`);
    const size = 8 + Math.random() * 16;
    const dur = 16 + Math.random() * 14;
    p.style.setProperty('--x', `${(Math.random() * 100).toFixed(1)}%`);
    p.style.setProperty('--size', `${size.toFixed(1)}px`);
    p.style.setProperty('--dur', `${dur.toFixed(1)}s`);
    p.style.setProperty('--delay', `${(-Math.random() * dur).toFixed(1)}s`);
    p.style.setProperty('--sway', `${(Math.random() * 60 - 30).toFixed(0)}px`);
    p.style.setProperty('--spin', `${(Math.random() * 360 - 180).toFixed(0)}deg`);
    p.style.setProperty('--col', BURST_COLORS[i % BURST_COLORS.length]!);
    layer.append(p);
  }
  return layer;
}

/** A comic-book hit: a word and a ring of stars at (x, y) inside `host`. Cleans itself up. */
function popBurst(host: HTMLElement, x: number, y: number, word: string): void {
  if (host.querySelectorAll('.b2-lobby__burst').length > 5) return;
  const burst = el('div', 'b2-lobby__burst');
  burst.setAttribute('aria-hidden', 'true');
  burst.style.left = `${x}px`;
  burst.style.top = `${y}px`;
  const color = BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)]!;
  const label = el('span', 'b2-lobby__burstword', word);
  label.style.setProperty('--col', color);
  label.style.setProperty('--tilt', `${(Math.random() * 16 - 8).toFixed(1)}deg`);
  burst.append(label);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.random() * 0.4;
    const spark = el('span', 'b2-lobby__spark');
    spark.style.setProperty('--dx', `${(Math.cos(a) * (46 + Math.random() * 30)).toFixed(0)}px`);
    spark.style.setProperty('--dy', `${(Math.sin(a) * (46 + Math.random() * 30)).toFixed(0)}px`);
    spark.style.setProperty('--col', BURST_COLORS[i % BURST_COLORS.length]!);
    burst.append(spark);
  }
  host.append(burst);
  window.setTimeout(() => burst.remove(), 1200);
}

/** Counts a number up from zero so the scrap chip feels earned. */
function countUp(node: HTMLElement, to: number): void {
  if (to <= 0 || reducedMotion()) return;
  const start = performance.now();
  const dur = 900;
  const step = (now: number): void => {
    const u = Math.min(1, (now - start) / dur);
    node.textContent = String(Math.round(to * (1 - Math.pow(1 - u, 3))));
    if (u < 1 && node.isConnected) requestAnimationFrame(step);
    else node.textContent = String(to);
  };
  node.textContent = '0';
  requestAnimationFrame(step);
}

function svg(path: string): SVGSVGElement {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  node.setAttribute('viewBox', '0 0 24 24');
  node.setAttribute('aria-hidden', 'true');
  node.setAttribute('focusable', 'false');
  node.classList.add('b2-lobby__navicon');
  const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  shape.setAttribute('d', path);
  shape.setAttribute('fill', 'none');
  shape.setAttribute('stroke', 'currentColor');
  shape.setAttribute('stroke-width', '2.4');
  shape.setAttribute('stroke-linecap', 'round');
  shape.setAttribute('stroke-linejoin', 'round');
  node.append(shape);
  return node;
}

/**
 * The home screen: the kit's night-shift composition. Status on top, the
 * selected hero in the middle, PLAY at the bottom, and one navigation bar to
 * everything else.
 */
export function buildMainMenu(game: Game, actions: MenuActions): HTMLElement {
  const save = game.save.data;
  const total = game.rooms.roomCount;
  const screen = el('div', 'screen b2-stage b2-stage--blue b2-lobby');

  // ── status: room, shift, scrap ──────────────────────────────────────────
  const top = el('header', 'b2-lobby__top');

  const night = el('div', 'b2-chip b2-lobby__night');
  const nightNum = el('span', 'b2-badge b2-lobby__nightnum', '01');
  const nightCopy = el('span', 'b2-chip__text');
  const nightTitle = el('span', 'b2-chip__value', 'NIGHT SHIFT');
  const nightSub = el('span', 'b2-chip__label', '');
  nightCopy.append(nightTitle, nightSub);
  night.append(nightNum, nightCopy);

  const scrap = el('div', 'b2-chip b2-lobby__scrap');
  scrap.setAttribute('role', 'status');
  scrap.setAttribute('aria-label', `${save.scrap} coins`);
  const scrapIcon = el('img', 'b2-chip__icon b2-lobby__scrapicon');
  scrapIcon.src = coinUrl;
  scrapIcon.alt = '';
  const scrapCopy = el('span', 'b2-chip__text');
  const scrapValue = el('span', 'b2-chip__value b2-num', String(save.scrap));
  scrapCopy.append(scrapValue, el('span', 'b2-chip__label', 'COINS'));
  scrap.append(scrapIcon, scrapCopy);

  top.append(night, scrap);

  // ── left column: campaign progress ──────────────────────────────────────
  const left = el('aside', 'b2-lobby__left');

  const roomsOpen = Math.max(0, Math.min(save.unlockedRoom + 1, total));
  const roomsStat = el('div', 'b2-lobby__stat');
  const roomsCopy = el('div', 'b2-lobby__statcopy');
  roomsCopy.append(
    el('span', 'b2-lobby__statlabel', 'ROOMS UNLOCKED'),
    el('strong', 'b2-lobby__statvalue b2-display b2-num', `${roomsOpen} / ${total}`),
  );
  const roomsMeter = el('div', 'b2-meter b2-lobby__statmeter');
  const roomsFill = el('span', 'b2-meter__fill');
  roomsFill.style.setProperty('--b2-value', `${(roomsOpen / total) * 100}%`);
  roomsMeter.append(roomsFill);
  roomsCopy.append(roomsMeter);
  const roomsIcon = el('img', 'b2-lobby__staticon');
  roomsIcon.src = keyUrl;
  roomsIcon.alt = '';
  roomsStat.append(roomsCopy, roomsIcon);

  const ideasStat = el('div', 'b2-lobby__stat b2-lobby__stat--ideas');
  const ideasCopy = el('div', 'b2-lobby__statcopy');
  const ideasTotal = Math.max(1, game.discoveries.total);
  ideasCopy.append(
    el('span', 'b2-lobby__statlabel', 'BAD IDEAS FOUND'),
    el('strong', 'b2-lobby__statvalue b2-display b2-num', `${game.discoveries.count} / ${ideasTotal}+`),
  );
  const ideasMeter = el('div', 'b2-meter b2-lobby__statmeter');
  const ideasFill = el('span', 'b2-meter__fill b2-lobby__statmeter--ideas');
  ideasFill.style.setProperty('--b2-value', `${(game.discoveries.count / ideasTotal) * 100}%`);
  ideasMeter.append(ideasFill);
  ideasCopy.append(ideasMeter);
  const ideasIcon = el('img', 'b2-lobby__staticon');
  ideasIcon.src = lampUrl;
  ideasIcon.alt = '';
  ideasStat.append(ideasCopy, ideasIcon);

  left.append(roomsStat, ideasStat);

  // ── centre: wordmark, tagline, selected hero ────────────────────────────
  const center = el('section', 'b2-lobby__center');
  center.setAttribute('aria-label', 'My House, My Rules. Everything is a weapon');
  // The wordmark is type, not a picture: it stays sharp at any size and needs no asset.
  const logo = el('div', 'b2-lobby__logo b2-wordmark');
  logo.setAttribute('role', 'img');
  logo.setAttribute('aria-label', 'My House, My Rules');
  const roof = el('span', 'b2-wordmark__roof');
  roof.setAttribute('aria-hidden', 'true');
  logo.append(roof, el('span', 'b2-wordmark__top', 'MY HOUSE,'), el('span', 'b2-wordmark__bottom', 'MY RULES'));
  const tagline = el('p', 'b2-lobby__tagline', 'THE GNOMES GOT IN. GET THEM OUT.');
  const portrait = el('img', 'b2-lobby__hero');
  portrait.src = heroPortrait(game.hero);
  portrait.alt = '';
  portrait.decoding = 'async';
  portrait.draggable = false;
  const rays = el('div', 'b2-lobby__rays');
  rays.setAttribute('aria-hidden', 'true');
  const shadow = el('div', 'b2-lobby__shadow');
  shadow.setAttribute('aria-hidden', 'true');
  center.append(rays, logo, tagline, shadow, portrait);

  // Tap the hero: a hop, a hit word and a ring of stars. Tap the logo: it jiggles.
  const retrigger = (node: HTMLElement, cls: string): void => {
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
  };
  portrait.addEventListener('animationend', (e) => {
    if (e.animationName === 'b2-hero-bonk' || e.animationName === 'b2-hero-hop') portrait.classList.remove('is-bonked', 'is-hop');
  });
  portrait.addEventListener('pointerdown', (e) => {
    retrigger(portrait, 'is-bonked');
    const r = screen.getBoundingClientRect();
    popBurst(screen, e.clientX - r.left, e.clientY - r.top, BURST_WORDS[Math.floor(Math.random() * BURST_WORDS.length)]!);
    game.audio.play('boing', 0.7);
  });
  logo.addEventListener('pointerdown', (e) => {
    retrigger(logo, 'is-jiggle');
    const r = screen.getBoundingClientRect();
    popBurst(screen, e.clientX - r.left, e.clientY - r.top, 'MY RULES!');
    game.audio.play('stamp', 0.6);
  });
  logo.addEventListener('animationend', (e) => {
    if (e.animationName === 'b2-logo-jiggle') logo.classList.remove('is-jiggle');
  });

  const main = el('div', 'b2-lobby__main');
  main.append(left, center);

  // ── PLAY ────────────────────────────────────────────────────────────────
  const playRow = el('div', 'b2-lobby__play');
  // A shift that was left mid-room (or mid-door) always has a way back to exactly
  // where it stopped. PLAY stays the "start the room I picked" button.
  const continueBtn = save.runActive
    ? el('button', 'b2-btn b2-btn--yellow b2-btn--sm b2-lobby__continue')
    : null;
  if (continueBtn) {
    continueBtn.type = 'button';
    const where = save.runDoors.length > 0 ? 'PICK A DOOR' : `ROOM ${save.runFloor + 1}`;
    continueBtn.append(el('span', 'b2-lobby__playlabel', `CONTINUE · ${where}`));
    continueBtn.addEventListener('click', () => actions.continueRun());
    playRow.append(continueBtn);
  }
  const playBtn = el('button', 'b2-btn b2-btn--lime b2-btn--lg b2-lobby__playbtn primary');
  playBtn.type = 'button';
  playBtn.addEventListener('click', () => actions.play(selected));
  const playIcon = svg('M8 5.5v13l11-6.5z');
  playIcon.classList.add('b2-lobby__playicon');
  playIcon.querySelector('path')?.setAttribute('fill', 'currentColor');
  playIcon.querySelector('path')?.setAttribute('stroke', 'none');
  playBtn.append(playIcon, el('span', 'b2-lobby__playlabel', 'PLAY'));
  const endlessBtn = el('button', 'b2-btn b2-btn--blue b2-lobby__endless');
  endlessBtn.type = 'button';
  const bestFloor = game.save.data.endlessBestFloor;
  endlessBtn.append(el('span', 'b2-lobby__playlabel', 'ENDLESS'), el('span', 'b2-lobby__caption', 'how deep can you go'));
  if (bestFloor > 0) endlessBtn.append(el('span', 'b2-lobby__endlessbest', `BEST: FLOOR ${bestFloor}`));
  endlessBtn.addEventListener('click', () => actions.endless());
  // DAILY: today's shared room, with the week's streak row (ready = a prize is waiting).
  const view = game.dailyView();
  const dailyBtn = el('button', `b2-btn b2-btn--lavender b2-lobby__daily${view.doneToday ? ' is-done' : ' is-ready'}`);
  dailyBtn.type = 'button';
  dailyBtn.setAttribute(
    'aria-label',
    view.doneToday
      ? `Daily challenge done. Streak ${view.streak} days. Practice again, no reward`
      : `Daily challenge ready. Day ${view.nextDay} of 7 reward. Streak ${view.streak} days`,
  );
  const dailyTop = el('span', 'b2-lobby__dailytop');
  dailyTop.append(
    el('span', 'b2-lobby__playlabel', 'DAILY'),
    el('span', 'b2-lobby__dailychip', view.doneToday ? '✓' : `DAY ${view.nextDay}`),
  );
  const pips = el('span', 'b2-lobby__pips');
  pips.setAttribute('aria-hidden', 'true');
  for (let i = 1; i <= 7; i++) {
    const pip = el('span', `b2-lobby__pip${i <= view.pips ? ' is-on' : ''}${i === 3 || i === 7 ? ' is-big' : ''}${!view.doneToday && i === view.pips + 1 ? ' is-next' : ''}`);
    pips.append(pip);
  }
  dailyBtn.append(dailyTop, pips, el('span', 'b2-lobby__caption', 'same room for everyone'));
  dailyBtn.addEventListener('click', () => actions.daily());
  const subRow = el('div', 'b2-lobby__subrow');
  subRow.append(endlessBtn, dailyBtn);
  playRow.append(playBtn, subRow);

  // ── navigation ──────────────────────────────────────────────────────────
  const nav = el('nav', 'b2-nav b2-lobby__nav');
  nav.setAttribute('aria-label', 'Main');
  const navItem = (
    label: string,
    iconPath: string,
    onClick: () => void,
    active = false,
  ): HTMLButtonElement => {
    const node = el('button', 'b2-nav__item');
    node.type = 'button';
    if (active) {
      node.classList.add('is-active');
      node.setAttribute('aria-current', 'page');
    }
    node.append(svg(iconPath), el('span', 'b2-nav__label', label));
    node.addEventListener('click', onClick);
    return node;
  };
  // The store says when the purse can buy something: the reason to open it.
  const ready = affordableUpgrades(game.save.data);
  const storeItem = navItem('STORE', 'M5 8h14l-1.2 12H6.2zM9 8V6a3 3 0 0 1 6 0v2', () => actions.store());
  if (ready > 0) {
    const badge = el('span', 'b2-nav__badge', String(ready));
    badge.setAttribute('aria-label', `${ready} upgrade${ready === 1 ? '' : 's'} ready`);
    storeItem.append(badge);
    storeItem.classList.add('has-badge');
  }
  nav.append(
    navItem(
      'HOME',
      'M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
      () => {
        closeMode();
        playBtn.focus();
      },
      true,
    ),
    navItem('ROOMS', 'M14.5 9.5a4 4 0 1 0-2 3.4L20 20.4V17h-3v-3h-2.2z', () => openMode('rooms')),
    navItem(
      'CHARACTERS',
      'M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11zm6.5 1a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2zM3 20c0-3.3 2.7-5.6 6-5.6s6 2.3 6 5.6zm12.2-5.5c3 .2 5.3 2.3 5.3 5.5h-4.2c0-2.2-.4-4-1.1-5.5z',
      () => openMode('characters'),
    ),
    storeItem,
    navItem('SETTINGS', 'M4 7h16M4 12h16M4 17h16M8 5v4M16 10v4M10 15v4', () => actions.settings()),
  );

  // ── storage warning, only when it is real ───────────────────────────────
  let warning: HTMLElement | null = null;
  if (!game.save.persistent) {
    warning = el('p', 'b2-lobby__warning', 'Storage is blocked — progress will not be saved.');
  }

  // ── MODE sheet ──────────────────────────────────────────────────────────
  const mode = el('div', 'b2-lobby__mode');
  mode.id = 'bonk-mode';
  mode.hidden = true;
  const backdrop = el('div', 'b2-lobby__modebackdrop');
  backdrop.setAttribute('data-mode-close', '');

  const panel = el('div', 'b2-lobby__modepanel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'b2-mode-title');

  const modeHead = el('header', 'b2-lobby__modehead');
  const modeHeading = el('div', 'b2-lobby__modeheading');
  modeHeading.append(
    el('span', 'b2-label', 'RUN SETUP'),
    el('h2', 'b2-lobby__modetitle b2-display b2-outlined', 'MODE'),
  );
  modeHeading.querySelector('h2')!.id = 'b2-mode-title';
  const modeClose = el('button', 'b2-btn b2-btn--ghost b2-btn--sm b2-lobby__modeclose', 'CLOSE');
  modeClose.type = 'button';
  modeClose.setAttribute('aria-label', 'Close run setup');
  modeClose.addEventListener('click', closeMode);
  modeHead.append(modeHeading, modeClose);

  // ── difficulty: the one run-setup choice that changes the fight ──────────
  const difficulty = el('div', 'b2-lobby__difficulty');
  difficulty.setAttribute('role', 'group');
  difficulty.setAttribute('aria-label', 'Campaign difficulty');
  const diffButtons: Record<Difficulty, HTMLButtonElement> = {
    easy: null as never,
    normal: null as never,
    hard: null as never,
  };
  const paintDifficulty = (current: Difficulty): void => {
    (Object.keys(DIFFICULTY_LABELS) as Difficulty[]).forEach((key) => {
      diffButtons[key].classList.toggle('is-active', key === current);
    });
  };
  (Object.entries(DIFFICULTY_LABELS) as [Difficulty, string][]).forEach(([key, label]) => {
    const btn = el('button', 'b2-btn b2-btn--ghost b2-btn--sm b2-lobby__diffbtn');
    btn.type = 'button';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      game.save.data.difficulty = key;
      game.save.write();
      paintDifficulty(key);
    });
    diffButtons[key] = btn;
    difficulty.append(btn);
  });
  paintDifficulty(game.save.data.difficulty);

  const modeTabs = el('div', 'b2-tabs b2-lobby__modetabs');
  modeTabs.setAttribute('role', 'tablist');
  modeTabs.setAttribute('aria-label', 'Run setup sections');
  const tabRooms = el('button', 'b2-tab', 'ROOMS');
  tabRooms.type = 'button';
  tabRooms.setAttribute('role', 'tab');
  tabRooms.setAttribute('aria-controls', 'mode-pane-rooms');
  tabRooms.dataset.modeTab = 'rooms';
  const tabChars = el('button', 'b2-tab', 'CHARACTERS');
  tabChars.type = 'button';
  tabChars.setAttribute('role', 'tab');
  tabChars.setAttribute('aria-controls', 'mode-pane-characters');
  tabChars.dataset.modeTab = 'characters';
  modeTabs.append(tabRooms, tabChars);

  const modeBody = el('div', 'b2-lobby__modebody');
  const paneRooms = el('div', 'b2-lobby__pane');
  paneRooms.id = 'mode-pane-rooms';
  paneRooms.setAttribute('role', 'tabpanel');
  const paneChars = el('div', 'b2-lobby__pane');
  paneChars.id = 'mode-pane-characters';
  paneChars.setAttribute('role', 'tabpanel');
  paneChars.hidden = true;
  modeBody.append(paneRooms, paneChars);

  panel.append(modeHead, difficulty, modeTabs, modeBody);
  mode.append(backdrop, panel);

  // ── selection state, shared by PLAY and the sheet ──────────────────────
  let selected = Math.min(Math.max(0, save.unlockedRoom), total - 1);

  const paintSelection = (index: number): void => {
    selected = index;
    lastRoomPick = index;
    const label = roomLabel(index);
    nightNum.textContent = String(index + 1).padStart(2, '0');
    nightSub.textContent = `${label.toLowerCase()} · ${heroPair(game.hero).toLowerCase()}`;
  };

  const roomsPane = buildRoomsPane(game, {
    initial: lastRoomPick,
    onSelect: (choice) => paintSelection(choice.index),
    onEnter: () => closeMode(),
  });
  paneRooms.append(roomsPane.root);

  paneChars.append(
    buildCharactersPane(game, {
      onPick: (id) => {
        // setHero() calls toMenu(), which rebuilds this screen. Keep the
        // characters sheet open on the rebuilt menu.
        reopenMode = 'characters';
        actions.hero(id);
      },
    }),
  );

  // Initial paint, in case no card fired onSelect during the build.
  paintSelection(selected);

  const setModeTab = (tab: 'rooms' | 'characters'): void => {
    const onRooms = tab === 'rooms';
    paneRooms.hidden = !onRooms;
    paneChars.hidden = onRooms;
    tabRooms.classList.toggle('is-active', onRooms);
    tabChars.classList.toggle('is-active', !onRooms);
    tabRooms.setAttribute('aria-selected', String(onRooms));
    tabChars.setAttribute('aria-selected', String(!onRooms));
    tabRooms.tabIndex = onRooms ? 0 : -1;
    tabChars.tabIndex = onRooms ? -1 : 0;
  };

  function openMode(tab: 'rooms' | 'characters' = 'rooms'): void {
    mode.hidden = false;
    setModeTab(tab);
    if (tab === 'rooms') roomsPane.showMap(true);
    modeClose.focus();
  }

  function closeMode(): void {
    if (mode.hidden) return;
    mode.hidden = true;
    playBtn.focus();
  }

  tabRooms.addEventListener('click', () => setModeTab('rooms'));
  tabChars.addEventListener('click', () => setModeTab('characters'));
  modeTabs.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = tabRooms.getAttribute('aria-selected') === 'true' ? 'characters' : 'rooms';
    setModeTab(next);
    (next === 'characters' ? tabChars : tabRooms).focus();
  });
  backdrop.addEventListener('click', closeMode);
  mode.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMode();
    }
  });

  setModeTab('rooms');

  if (!reducedMotion()) screen.append(buildParticles(14));
  screen.append(top, main, playRow, nav);
  if (warning) screen.append(warning);
  screen.append(mode);

  // ── alive: parallax, rotating tagline, occasional hop, count-up ─────────
  countUp(scrapValue, save.scrap);
  if (!reducedMotion()) {
    let frame = 0;
    screen.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch' || frame) return;
      const { clientX, clientY } = event;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const r = screen.getBoundingClientRect();
        if (r.width === 0) return;
        screen.style.setProperty('--px', (((clientX - r.left) / r.width - 0.5) * 2).toFixed(3));
        screen.style.setProperty('--py', (((clientY - r.top) / r.height - 0.5) * 2).toFixed(3));
      });
    });
    screen.addEventListener('pointerleave', () => {
      screen.style.setProperty('--px', '0');
      screen.style.setProperty('--py', '0');
    });

    let tagIndex = 0;
    let wasConnected = false;
    const alive = window.setInterval(() => {
      if (!screen.isConnected) {
        if (wasConnected) window.clearInterval(alive);
        return;
      }
      wasConnected = true;
      if (!mode.hidden) return;
      tagIndex = (tagIndex + 1) % TAGLINES.length;
      tagline.classList.add('is-out');
      window.setTimeout(() => {
        tagline.textContent = TAGLINES[tagIndex]!;
        tagline.classList.remove('is-out');
      }, 260);
      // every other tick the hero does a little hop
      if (tagIndex % 2 === 0 && !portrait.classList.contains('is-bonked')) retrigger(portrait, 'is-hop');
    }, 3800);
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
