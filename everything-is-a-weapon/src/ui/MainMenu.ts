import type { Game } from '../core/Game';
import { HEROES, type HeroId } from '../core/Hero';
import { createPet } from '../entities/Pets';
import { Player } from '../entities/Player';
import { HANDCRAFTED_ROOMS } from '../gameplay/RoomDefinitions';
import { drawPet } from '../rendering/PetArt';
import { drawPlayer } from '../rendering/PlayerArt';
import { button, el, formatScore, ransom } from './dom';

export interface MenuActions {
  play(roomIndex: number): void;
  daily(): void;
  settings(): void;
  hero(id: HeroId): void;
}

const PORTRAIT_W = 62;
const PORTRAIT_H = 60;

const PIN_COLORS = ['#e5383b', '#2f4fb5', '#ffd23f', '#3fa7a3', '#fbf6e9'];

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
 * The front page: a ransom note over the room, the actions on the left and every
 * open room pinned to a corkboard wall on the right. No tallies, no footer clutter.
 */
export function buildMainMenu(game: Game, actions: MenuActions): HTMLElement {
  const save = game.save.data;
  const screen = el('div', 'screen menu');

  const title = el('h1', 'menu-title');
  title.setAttribute('aria-label', 'BONK! Everything is a weapon');
  const tagline = el('span', 'title-isa', 'everything is a weapon');
  title.append(ransom('BONK!', 9, 'title-bottom'), tagline);

  const note = el('p', 'menu-note');
  note.append(el('span', '', 'You have no weapon.'), el('strong', '', 'Good.'));

  // who is home tonight: two snapshots, the one in use taped down
  const heroes = el('div', 'hero-pick');
  for (const hero of HEROES) {
    const card = el('button', hero.id === game.hero ? 'hero-card on' : 'hero-card');
    card.type = 'button';
    card.setAttribute('aria-pressed', String(hero.id === game.hero));
    card.setAttribute('aria-label', `Play as ${hero.name}`);
    card.append(portrait(hero.id), el('span', 'hero-name', hero.name), el('span', 'hero-note', hero.note));
    card.addEventListener('click', () => actions.hero(hero.id));
    heroes.append(card);
  }

  const head = el('div', 'menu-head');
  head.append(title, note);

  const resumeRoom = save.unlockedRoom;
  const buttons = el('div', 'menu-buttons');
  buttons.append(
    button(resumeRoom > 0 ? `PLAY · ROOM ${resumeRoom + 1}` : 'PLAY', 'primary play', () => actions.play(resumeRoom)),
    button('DAILY CHALLENGE', '', actions.daily),
    button('SETTINGS', '', actions.settings),
  );

  // The evidence wall: every handmade room pinned up in order — cleared rooms show
  // their best damage bill, open rooms show their name, locked rooms stay masked.
  const wall = el('div', 'room-wall board');
  const total = HANDCRAFTED_ROOMS.length;
  const open = Math.min(resumeRoom + 1, total);
  wall.append(el('div', 'tape-label', open >= total ? 'ALL ROOMS OPEN' : `${open} OF ${total} ROOMS OPEN`));
  const grid = el('div', 'rack-grid');
  HANDCRAFTED_ROOMS.forEach((def, i) => {
    const locked = i > resumeRoom;
    const best = save.roomBests[def.id];
    const slot = el('div', `rack-slot${locked ? ' locked' : ''}${i === resumeRoom ? ' latest' : ''}${best ? ' cleared' : ''}`);
    const pin = el('span', 'pin');
    pin.style.setProperty('--pin', PIN_COLORS[i % PIN_COLORS.length]!);
    slot.append(pin);
    if (locked) {
      const mask = el('span', 'key-tag locked', '?');
      mask.setAttribute('aria-label', `Room ${i + 1}: clear room ${i} to unlock`);
      slot.append(mask, el('span', 'rack-name', '???'));
    } else {
      const tag = button(String(i + 1), 'key-tag', () => actions.play(i));
      tag.setAttribute('aria-label', best
        ? `Room ${i + 1}: ${def.name}, cleared, best ${best.score}`
        : i === resumeRoom ? `Room ${i + 1}: ${def.name}, your furthest` : `Room ${i + 1}: ${def.name}`);
      slot.append(tag, el('span', 'rack-name', def.name.toLowerCase()));
      if (best) {
        slot.append(el('span', 'rack-tick', '✓'));
        slot.append(el('span', 'rack-best', `${formatScore(best.score)} · x${best.chain}`));
      } else if (def.boss) {
        slot.append(el('span', 'rack-boss', 'BOSS'));
      }
    }
    if (i === resumeRoom && total > 1 && !locked) slot.append(el('span', 'rack-flag', 'furthest'));
    grid.append(slot);
  });
  if (resumeRoom >= total) {
    // Past the handmade tour: the generated depths, endless and meaner.
    const slot = el('div', 'rack-slot latest endless');
    const pin = el('span', 'pin');
    pin.style.setProperty('--pin', PIN_COLORS[total % PIN_COLORS.length]!);
    const tag = button('∞', 'key-tag', () => actions.play(resumeRoom));
    tag.setAttribute('aria-label', `Endless depths, room ${resumeRoom + 1}`);
    slot.append(pin, tag, el('span', 'rack-name', 'the depths'), el('span', 'rack-flag', 'furthest'));
    grid.append(slot);
  }
  wall.append(grid);

  const mid = el('div', 'menu-mid');
  mid.append(buttons, wall);
  screen.append(head, heroes, mid);

  // The only footer left: a warning when the browser refuses storage.
  if (!game.save.persistent) {
    const footer = el('div', 'menu-footer');
    footer.append(el('span', 'warn', 'Storage is blocked — progress will not be saved.'));
    screen.append(footer);
  }
  return screen;
}
