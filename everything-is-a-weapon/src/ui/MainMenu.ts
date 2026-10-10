import type { Game } from '../core/Game';
import { HEROES, type HeroId } from '../core/Hero';
import { createPet } from '../entities/Pets';
import { Player } from '../entities/Player';
import { drawPet } from '../rendering/PetArt';
import { drawPlayer } from '../rendering/PlayerArt';
import { button, el, formatScore, ransom } from './dom';

export interface MenuActions {
  play(roomIndex: number): void;
  daily(): void;
  discoveries(): void;
  settings(): void;
  /** Opens the full rack of unlocked rooms. */
  rooms(): void;
  hero(id: HeroId): void;
}

const PORTRAIT_W = 62;
const PORTRAIT_H = 60;

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

/** The menu shows this many of the most recent rooms; the rest are one click away on the rack. */
const RECENT_ROOM_TAGS = 6;

/** The front page: a ransom note glued together over the room, with paper strips for buttons. */
export function buildMainMenu(game: Game, actions: MenuActions): HTMLElement {
  const save = game.save.data;
  const screen = el('div', 'screen menu');

  const title = el('h1', 'menu-title');
  title.setAttribute('aria-label', 'BONK! Everything is a weapon');
  const tagline = el('span', 'title-isa', 'everything is a weapon');
  title.append(ransom('BONK!', 9, 'title-bottom'), tagline);

  const note = el('p', 'menu-note');
  note.append(el('span', '', 'You have no weapon.'), el('strong', '', 'Good.'));

  const buttons = el('div', 'menu-buttons');
  const resumeRoom = save.unlockedRoom;
  buttons.append(
    button(resumeRoom > 0 ? `PLAY · ROOM ${resumeRoom + 1}` : 'PLAY', 'primary', () => actions.play(resumeRoom)),
    button('DAILY CHALLENGE', '', actions.daily),
    button(`EVIDENCE  ${game.discoveries.count} / ${game.discoveries.total}`, '', actions.discoveries),
    button('SETTINGS', '', actions.settings),
  );

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
  screen.append(head, heroes, buttons);

  if (save.unlockedRoom > 0) {
    const row = el('div', 'room-select');
    row.append(el('span', 'room-select-label', 'start from room'));
    const total = save.unlockedRoom + 1;
    const first = Math.max(0, total - RECENT_ROOM_TAGS);
    for (let i = first; i < total; i++) row.append(button(String(i + 1), 'key-tag', () => actions.play(i)));
    if (first > 0) row.append(button(`ALL ${total} ROOMS`, 'all-rooms', actions.rooms));
    screen.append(row);
  }

  const footer = el('div', 'menu-footer');
  footer.append(el('span', 'best-slip', `BEST DAMAGE BILL  ${formatScore(save.highScore)}`));
  if (save.bestChain >= 3) footer.append(el('span', 'best-slip', `BEST CHAIN  x${save.bestChain}`));
  if (!game.save.persistent) footer.append(el('span', 'warn', 'Storage is blocked — progress will not be saved.'));
  screen.append(footer);
  return screen;
}
