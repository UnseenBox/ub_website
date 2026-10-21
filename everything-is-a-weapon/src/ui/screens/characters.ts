import type { Game } from '../../core/Game';
import { HEROES, type HeroId } from '../../core/Hero';
import { Player } from '../../entities/Player';
import { drawPlayer } from '../../rendering/PlayerArt';
import { el } from '../dom';

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

/** 'the tenant & waffle' for the summary line. */
export function heroPair(heroId: HeroId): string {
  const hero = HEROES.find((h) => h.id === heroId)!;
  const pet = hero.note.replace(/^\+ /, '').split(',')[0]!;
  return `${hero.name} & ${pet}`;
}

export interface CharactersPaneOptions {
  /** Called after the card repaints itself. The lobby rebuilds the menu here. */
  onPick?: (id: HeroId) => void;
}

/** The four heroes in a strip, picked one wears the crown. */
export function buildCharactersPane(game: Game, options: CharactersPaneOptions = {}): HTMLElement {
  const section = el('section', 'rm-heroes');
  section.setAttribute('aria-label', 'Character selection');
  section.append(el('div', 'tape-label', 'CHARACTER'));

  const cast = el('div', 'rm-cast');
  cast.setAttribute('role', 'radiogroup');
  cast.setAttribute('aria-label', 'Heroes. Pick a card to choose a hero.');

  const crown = el('span', 'mm-crown');
  const cards = new Map<HeroId, HTMLButtonElement>();

  const paint = (id: HeroId): void => {
    for (const [otherId, card] of cards) {
      const on = otherId === id;
      card.classList.toggle('picked', on);
      card.setAttribute('aria-checked', String(on));
      if (on && card.firstElementChild !== crown) card.prepend(crown);
    }
  };

  for (const info of HEROES) {
    const card = el('button', 'rm-hero') as HTMLButtonElement;
    card.type = 'button';
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', 'false');
    card.setAttribute('aria-label', `Play as ${info.name}, ${info.note}`);

    const frame = el('div', 'hero-blank');
    frame.append(heroPortrait(info.id));
    card.append(frame, el('span', 'mm-card-name', info.name), el('span', 'mm-card-note', info.note));
    card.addEventListener('click', () => {
      paint(info.id);
      if (info.id === game.hero) return;
      options.onPick?.(info.id);
    });

    cast.append(card);
    cards.set(info.id, card);
  }

  paint(game.hero);
  section.append(cast);
  return section;
}
