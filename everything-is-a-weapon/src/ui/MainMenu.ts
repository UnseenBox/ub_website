import { WALL } from '../core/constants';
import type { Game } from '../core/Game';
import { HEROES, type HeroId } from '../core/Hero';
import { Enemy } from '../entities/Enemy';
import { ENEMY_TYPES } from '../entities/EnemyTypes';
import { createPet } from '../entities/Pets';
import { Player } from '../entities/Player';
import { CHALLENGES } from '../gameplay/ChallengeSystem';
import type { RoomDefinition } from '../gameplay/Room';
import { HANDCRAFTED_ROOMS } from '../gameplay/RoomDefinitions';
import { depthsBossSlots } from '../gameplay/RoomManager';
import { createObject } from '../objects/ObjectFactory';
import { drawEnemy } from '../rendering/EnemyArt';
import { drawObject } from '../rendering/ObjectArt';
import { drawPet } from '../rendering/PetArt';
import { drawPlayer } from '../rendering/PlayerArt';
import { RoomArt } from '../rendering/RoomArt';
import { button, el, formatScore } from './dom';

export interface MenuActions {
  play(roomIndex: number): void;
  daily(): void;
  settings(): void;
  controls(): void;
  hero(id: HeroId): void;
}

const PORTRAIT_W = 62;
const PORTRAIT_H = 60;

const PIN_COLORS = ['#e5383b', '#2f4fb5', '#ffd23f', '#3fa7a3', '#fbf6e9'];

/** One shared painter: room floors are static, so thumbs cost a single draw each. */
const roomPainter = new RoomArt();

/** A snapshot of the hero, drawn with the same code that draws them in the room. */
function portrait(hero: HeroId): HTMLCanvasElement {
  const canvas = el('canvas', 'hero-photo');
  const scale = 2.6;
  canvas.width = PORTRAIT_W * scale;
  canvas.height = PORTRAIT_H * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(scale, scale);
  const model = new Player(0, 0);
  model.aimX = 0.32;
  model.aimY = 0.95;
  ctx.fillStyle = 'rgba(34, 27, 54, 0.2)';
  ctx.beginPath();
  ctx.ellipse(22, 55, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  drawPlayer(ctx, model, 22, 52, 0.6, hero);
  const pet = createPet(hero, 0, 0);
  pet.sitting = true;
  pet.facing = -1;
  if (pet.species === 'parrot') drawPet(ctx, pet, 31, 53, hero === 'kid' ? 32 : 37, 0.6);
  else drawPet(ctx, pet, 48, 55, 0, 0.6);
  return canvas;
}

/**
 * Paints a room's floor (plus a couple of its things and one mover) into a
 * canvas, fitted and centred. Purely a picture: nothing here simulates.
 */
function paintRoomThumb(canvas: HTMLCanvasElement, def: RoomDefinition, withActors: boolean): void {
  const cssW = canvas.clientWidth || canvas.width;
  const cssH = canvas.clientHeight || canvas.height;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(cssW * dpr));
  canvas.height = Math.max(1, Math.round(cssH * dpr));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const margin = WALL + 4;
  const scale = Math.min(canvas.width / (def.width + margin * 2), canvas.height / (def.height + margin * 2));
  ctx.setTransform(scale, 0, 0, scale, margin * scale + (canvas.width - (def.width + margin * 2) * scale) / 2, margin * scale + (canvas.height - (def.height + margin * 2) * scale) / 2);
  roomPainter.draw(ctx, def, scale);
  if (!withActors) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return;
  }
  // A couple of the room's own things, drawn where they stand.
  const placed = def.objects.filter((spec) => spec.on === undefined).slice(0, 3);
  for (const spec of placed) {
    const object = createObject(spec.type, spec.x, spec.y, spec.angle ?? 0);
    if (!object) continue;
    object.body.angle = spec.angle ?? 0;
    drawObject(ctx, object, spec.x, spec.y, 0, spec.angle ?? 0, 1.3);
  }
  // ...and one mover sniffing around, so the preview reads as a fight.
  const first = def.enemies[0];
  if (first) {
    const type = ENEMY_TYPES[first.type];
    const foe = new Enemy(type, def.width * 0.72, def.height * 0.55, -1, 0);
    foe.walkPhase = 2.1;
    drawEnemy(ctx, foe, def.width * 0.72, def.height * 0.55, 1.3);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** Challenge text for a room, if it has one. */
function challengeText(def: RoomDefinition): string | null {
  if (!def.challenge) return null;
  return CHALLENGES.find((c) => c.id === def.challenge)?.text.toLowerCase() ?? null;
}

/**
 * The front page, rebuilt around the reference board: the logo and a living
 * hero splash on the left; room preview, level grid, character cards and the
 * big red PLAY on the right. Every number on it comes from the save file.
 */
export function buildMainMenu(game: Game, actions: MenuActions): HTMLElement {
  const save = game.save.data;
  const screen = el('div', 'screen menu menu-new');

  // Tester unlock (?unlock in the URL): every room open plus a depths-boss
  // picker, for trying whatever you want. Session-only: the save file is never
  // touched, so real progression is exactly as locked as you left it.
  const tester = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('unlock');
  const total = HANDCRAFTED_ROOMS.length;
  const resumeRoom = save.unlockedRoom;
  const openThrough = tester ? total + 60 : resumeRoom;
  const openCount = Math.min(openThrough + 1, total);

  // ── left: logo + living splash ──
  const left = el('div', 'mm-left');
  const logo = el('div', 'mm-logo');
  logo.setAttribute('role', 'img');
  logo.setAttribute('aria-label', 'BONK! Everything is a weapon');
  const letters: Array<[string, string]> = [['B', 'mm-l0'], ['O', 'mm-l1'], ['N', 'mm-l2'], ['K', 'mm-l3'], ['!', 'mm-l4']];
  for (const [char, cls] of letters) logo.append(el('span', `mm-letter ${cls}`, char));
  const tagline = el('div', 'mm-tagline');
  tagline.append(el('span', 'mm-tagline-text', 'everything is a weapon'));
  left.append(logo, tagline);

  const splashWrap = el('div', 'mm-splash-wrap');
  const splash = el('canvas', 'mm-splash');
  splash.width = 440;
  splash.height = 470;
  splashWrap.append(splash, el('div', 'mm-splash-caption', 'grab a pan. ruin a mover.'));
  left.append(splashWrap);
  screen.append(left);

  // Animated with the game's own art: the picked hero mid-swing, pet at their
  // heels, two cardboard movers about to regret everything. Stops itself when
  // the menu is replaced (hero select, settings, play).
  const heroId = game.hero;
  const splashModel = new Player(0, 0);
  splashModel.aimX = 1;
  splashModel.aimY = 0.12;
  splashModel.walkPhase = 1.2;
  splashModel.throwAnim = 1;
  const splashPan = createObject('pan', 0, 0);
  const splashPet = createPet(heroId, 0, 0);
  const splashFoeA = new Enemy(ENEMY_TYPES.basic, 0, 0, -1, 0);
  const splashFoeB = new Enemy(ENEMY_TYPES.basic, 0, 0, -1, 0.2);
  const splashStart = performance.now();
  const splashLoop = (): void => {
    if (!splash.isConnected) return;
    const ctx = splash.getContext('2d');
    if (ctx) {
      const t = (performance.now() - splashStart) / 1000;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = 440;
      const ch = 470;
      if (splash.width !== cw * dpr) {
        splash.width = cw * dpr;
        splash.height = ch * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      const bob = Math.sin(t * 3.1) * 5;
      // floor shadow
      ctx.fillStyle = 'rgba(20, 12, 40, 0.35)';
      ctx.beginPath();
      ctx.ellipse(215, 428, 150, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      const k = 4.6;
      // movers, wobbling closer
      const wob = Math.sin(t * 5.2) * 0.06;
      splashFoeA.walkPhase = t * 9;
      splashFoeB.walkPhase = t * 9 + 2;
      ctx.save();
      ctx.translate(352, 330 + Math.sin(t * 4.1) * 4);
      ctx.scale(k, k);
      ctx.rotate(wob);
      drawEnemy(ctx, splashFoeA, 0, 0, t);
      ctx.restore();
      ctx.save();
      ctx.translate(408, 392 + Math.cos(t * 3.4) * 4);
      ctx.scale(k * 0.72, k * 0.72);
      ctx.rotate(-wob * 1.4);
      drawEnemy(ctx, splashFoeB, 0, 0, t + 1.7);
      ctx.restore();
      // the hero, mid-swing
      ctx.save();
      ctx.translate(168, 300 + bob);
      ctx.scale(k, k);
      drawPlayer(ctx, splashModel, 0, 0, t, heroId);
      ctx.restore();
      // the pan, caught mid-swing in front of them
      if (splashPan) {
        const swing = Math.sin(t * 3.1 + 0.7) * 0.16;
        ctx.save();
        ctx.translate(258, 218 + bob * 0.7);
        ctx.scale(k, k);
        ctx.rotate(-0.9 + swing);
        drawObject(ctx, splashPan, 0, 0, 0, 0, t);
        ctx.restore();
      }
      // the pet, along for the ride
      ctx.save();
      ctx.translate(84, 392);
      ctx.scale(k * 0.8, k * 0.8);
      drawPet(ctx, splashPet, 0, 0, 0, t);
      ctx.restore();
    }
    requestAnimationFrame(splashLoop);
  };
  requestAnimationFrame(splashLoop);

  // ── right column ──
  const right = el('div', 'mm-right');

  // Upper center: the selected room, big. Prev/next walk the open rooms.
  const openIndices: number[] = [];
  for (let i = 0; i < total; i++) if (i <= openThrough) openIndices.push(i);
  const endlessOpen = resumeRoom >= total;
  let preview = Math.min(resumeRoom, total - 1);
  if (resumeRoom >= total) preview = total; // the depths slot

  const previewCard = el('div', 'mm-preview board');
  previewCard.append(el('div', 'tape-label mm-tab', 'NEXT ROOM ➜'));
  const shotWrap = el('div', 'mm-shot-wrap');
  const prevBtn = el('button', 'mm-arrow mm-prev');
  prevBtn.type = 'button';
  prevBtn.setAttribute('aria-label', 'Previous room');
  prevBtn.textContent = '◀';
  const nextBtn = el('button', 'mm-arrow mm-next');
  nextBtn.type = 'button';
  nextBtn.setAttribute('aria-label', 'Next room');
  nextBtn.textContent = '▶';
  const shot = el('canvas', 'mm-shot');
  shotWrap.append(prevBtn, shot, nextBtn);
  const roomTitle = el('div', 'mm-room-title');
  const roomName = el('div', 'mm-room-name');
  const statRow = el('div', 'mm-stats');
  const statBest = el('div', 'mm-stat');
  const statChallenge = el('div', 'mm-stat');
  const statCombo = el('div', 'mm-stat');
  statRow.append(statBest, statChallenge, statCombo);
  previewCard.append(shotWrap, roomTitle, roomName, statRow);

  const renderPreview = (): void => {
    const endless = preview >= total;
    const def: RoomDefinition = endless ? game.rooms.definition(resumeRoom) : HANDCRAFTED_ROOMS[preview]!;
    const n = endless ? resumeRoom + 1 : preview + 1;
    paintRoomThumb(shot, def, true);
    roomTitle.textContent = endless ? `DEPTHS ${n}` : `ROOM ${n}`;
    roomName.textContent = (endless ? 'the depths' : def.name.toLowerCase()) + (def.boss ? ' · BOSS' : '');
    const best = save.roomBests[def.id];
    statBest.replaceChildren(
      el('span', 'mm-stat-key', '★ best score'),
      el('span', 'mm-stat-val', best ? formatScore(best.score) : '—'),
    );
    const challenge = challengeText(def);
    const done = def.challenge ? save.completedChallenges.includes(def.challenge) : false;
    statChallenge.replaceChildren(
      el('span', 'mm-stat-key', '✚ objective'),
      el('span', 'mm-stat-val', challenge ? `${done ? '✓ ' : ''}${challenge}` : '—'),
    );
    statCombo.replaceChildren(
      el('span', 'mm-stat-key', '♛ best combo'),
      el('span', 'mm-stat-val', best && best.chain > 0 ? `x${best.chain}` : '—'),
    );
    playBtn.querySelector('.btn-label')!.textContent = `▶ PLAY · ${endless ? `DEPTHS ${n}` : `ROOM ${n}`}`;
    for (const tile of grid.querySelectorAll('.mm-tile')) {
      tile.classList.toggle('picked', tile.getAttribute('data-room') === String(preview));
    }
  };
  const stepPreview = (dir: 1 | -1): void => {
    const order = endlessOpen ? [...openIndices, total] : openIndices;
    if (order.length === 0) return;
    const at = order.indexOf(preview);
    preview = order[(at + dir + order.length) % order.length]!;
    renderPreview();
  };
  prevBtn.addEventListener('click', () => stepPreview(-1));
  nextBtn.addEventListener('click', () => stepPreview(1));

  // Upper right: every handmade room as a polaroid. Open ones select the big
  // preview on click; locked ones are just a padlock and a number.
  const levels = el('div', 'mm-levels board');
  levels.append(el('div', 'tape-label', tester ? 'LEVEL SELECT · TESTER' : 'LEVEL SELECT'));
  const grid = el('div', 'mm-grid');
  HANDCRAFTED_ROOMS.forEach((def, i) => {
    const locked = i > openThrough;
    if (locked) {
      const tile = el('div', 'mm-tile locked');
      const thumb = el('canvas', 'mm-thumb');
      tile.append(el('span', 'pin'), thumb, el('span', 'mm-lock'), el('span', 'mm-num', String(i + 1)));
      tile.setAttribute('aria-label', `Room ${i + 1}: clear room ${i} to unlock`);
      paintRoomThumb(thumb, def, false);
      grid.append(tile);
      return;
    }
    const tile = el('button', 'mm-tile');
    tile.type = 'button';
    tile.setAttribute('data-room', String(i));
    const best = save.roomBests[def.id];
    tile.setAttribute('aria-label', best ? `Room ${i + 1}: ${def.name}, best ${best.score}` : `Room ${i + 1}: ${def.name}`);
    const thumb = el('canvas', 'mm-thumb');
    tile.append(el('span', 'pin'), thumb, el('span', 'mm-num', String(i + 1)));
    if (best) tile.append(el('span', 'mm-tick', '✓'));
    if (def.boss) tile.append(el('span', 'mm-boss', 'BOSS'));
    if (i === resumeRoom && !tester) tile.append(el('span', 'mm-flag', 'YOU ARE HERE'));
    tile.addEventListener('click', () => {
      preview = i;
      renderPreview();
    });
    paintRoomThumb(thumb, def, false);
    grid.append(tile);
  });
  if (endlessOpen) {
    const tile = el('button', 'mm-tile endless');
    tile.type = 'button';
    tile.setAttribute('data-room', String(total));
    tile.setAttribute('aria-label', `Endless depths, room ${resumeRoom + 1}`);
    const thumb = el('canvas', 'mm-thumb');
    tile.append(el('span', 'pin'), thumb, el('span', 'mm-num', '∞'));
    tile.addEventListener('click', () => {
      preview = total;
      renderPreview();
    });
    paintRoomThumb(thumb, game.rooms.definition(resumeRoom), false);
    grid.append(tile);
  }
  levels.append(grid);

  const topRow = el('div', 'mm-toprow');
  topRow.append(previewCard, levels);
  right.append(topRow);

  // Middle: the four heroes. The picked one is full colour with a crown.
  const chars = el('div', 'mm-chars board');
  chars.append(el('div', 'tape-label', 'CHOOSE YOUR CHARACTER'));
  const cards = el('div', 'mm-cards');
  for (const hero of HEROES) {
    const picked = hero.id === game.hero;
    const card = el('button', `mm-card${picked ? ' picked' : ''}`);
    card.type = 'button';
    card.setAttribute('aria-pressed', String(picked));
    card.setAttribute('aria-label', `Play as ${hero.name}`);
    if (picked) card.append(el('span', 'mm-crown'));
    card.append(portrait(hero.id), el('span', 'mm-card-name', hero.name), el('span', 'mm-card-note', hero.note));
    card.addEventListener('click', () => actions.hero(hero.id));
    cards.append(card);
  }
  chars.append(cards);
  right.append(chars);

  // Bottom: one huge red PLAY, cream daily, compact settings + controls.
  const actionsRow = el('div', 'mm-actions');
  const playBtn = button('▶ PLAY', 'primary mm-play', () => actions.play(preview >= total ? resumeRoom : preview));
  const dailyBtn = button('🏆 DAILY CHALLENGE', 'mm-daily', actions.daily);
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  dailyBtn.append(el('span', 'mm-daily-sub', `fresh every day · ${today}`));
  const settingsBtn = button('⚙ SETTINGS', 'mm-small', actions.settings);
  const controlsBtn = button('🎮 CONTROLS', 'mm-small', actions.controls);
  actionsRow.append(playBtn, dailyBtn, settingsBtn, controlsBtn);
  right.append(actionsRow);
  screen.append(right);

  renderPreview();

  if (tester) {
    // One pinned tag per depths boss, jumping straight to its generated room.
    const depWall = el('div', 'room-wall board tester-wall');
    depWall.append(el('div', 'tape-label', 'DEPTHS BOSSES · PICK YOUR FIGHT'));
    const depGrid = el('div', 'rack-grid');
    depthsBossSlots().forEach(({ type, index }, k) => {
      const boss = ENEMY_TYPES[type];
      const slot = el('div', 'rack-slot');
      const pin = el('span', 'pin');
      pin.style.setProperty('--pin', PIN_COLORS[(total + k) % PIN_COLORS.length]!);
      const tag = button(String(index + 1), 'key-tag', () => actions.play(index));
      tag.setAttribute('aria-label', `Test ${boss.name}, generated room ${index + 1}`);
      slot.append(pin, tag, el('span', 'rack-name', boss.name.toLowerCase()));
      depGrid.append(slot);
    });
    depWall.append(depGrid);
    screen.append(depWall);
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
  const rows: ReadonlyArray<readonly [string, string]> = game.input.touch
    ? [
      ['left thumb', 'move'],
      ['tap right side', 'grab what is highlighted'],
      ['hold right side', 'charge, let go to throw'],
      ['drag right thumb', 'aim by hand'],
      ['dodge / drop', 'buttons, bottom right'],
    ]
    : [
      ['WASD / arrows', 'move'],
      ['mouse', 'aim'],
      ['click', 'grab'],
      ['hold + let go', 'charge and throw'],
      ['right click', 'drop'],
      ['space', 'dodge'],
      ['R', 'restart the room'],
      ['P / Esc', 'pause'],
    ];
  for (const [key, action] of rows) {
    const row = el('div', 'control-row');
    row.append(el('span', 'key', key), el('span', '', action));
    sheet.append(row);
  }
  screen.append(sheet, button('BACK', 'primary', onBack));
  return screen;
}
