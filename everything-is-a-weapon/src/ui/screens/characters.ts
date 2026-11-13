import type { Game } from '../../core/Game';
import { HEROES, heroPerk, type HeroId } from '../../core/Hero';
import { unlockRule } from '../../gameplay/HeroUnlocks';
import { el } from '../dom';
import tenantArt from '../../assets/characters/tenant.webp';
import flatmateArt from '../../assets/characters/flatmate.webp';
import granArt from '../../assets/characters/gran.webp';
import kidArt from '../../assets/characters/kid.webp';
import { paintHeroPortrait } from '../../rendering/HeroPortrait';

interface RosterArt {
  readonly portrait: string;
  /** Matches a `.b2-hero[data-accent]` rule in rooms.css. */
  readonly accent: 'violet' | 'teal' | 'rose' | 'lime';
}

/** The four sticker illustrations. Each one already includes the hero's pet. */
const ROSTER: Record<HeroId, RosterArt> = {
  tenant: { portrait: tenantArt, accent: 'teal' },
  flatmate: { portrait: flatmateArt, accent: 'violet' },
  gran: { portrait: granArt, accent: 'rose' },
  kid: { portrait: kidArt, accent: 'lime' },
};

/**
 * The selected hero's card art, shared by the roster and the main menu: painted from the
 * in-game sprite and pet (rendering/HeroPortrait.ts), so it always matches what you play.
 * The older sticker illustrations are the fallback where no canvas is available.
 */
export function heroPortrait(heroId: HeroId): string {
  return paintHeroPortrait(heroId) ?? ROSTER[heroId].portrait;
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
  const section = el('section', 'b2-roster');
  section.setAttribute('aria-label', 'Character selection');

  const head = el('header', 'b2-roster__head');
  head.append(
    el('h3', 'b2-roster__title b2-display b2-outlined', 'THE HOUSEHOLD'),
    el('p', 'b2-roster__sub', 'FOUR DEFENDERS. FOUR LOYAL PETS. ONE HOUSE.'),
  );

  const current = el('strong', 'b2-roster__current b2-display', heroPair(game.hero));
  current.setAttribute('aria-live', 'polite');
  const foot = el('footer', 'b2-roster__foot');
  foot.append(current, el('span', 'b2-roster__hint', 'PICK A CARD — IT SAVES RIGHT AWAY.'));

  const cast = el('div', 'b2-roster__cast');
  cast.setAttribute('role', 'radiogroup');
  cast.setAttribute('aria-label', 'Heroes. Pick a card to choose a hero.');

  const cards = new Map<HeroId, HTMLButtonElement>();

  const paint = (id: HeroId): void => {
    for (const [otherId, card] of cards) {
      const on = otherId === id;
      card.classList.toggle('is-selected', on);
      card.setAttribute('aria-checked', String(on));
      const plate = card.querySelector<HTMLElement>('.b2-hero__plate');
      if (plate) plate.textContent = !game.isHeroUnlocked(otherId) ? 'LOCKED' : on ? 'SELECTED' : 'CHOOSE';
      const crown = card.querySelector<HTMLElement>('.b2-hero__crown');
      if (crown) crown.hidden = !on;
    }
    current.textContent = heroPair(id);
  };

  HEROES.forEach((info, index) => {
    const art = ROSTER[info.id];
    const card = el('button', 'b2-hero');
    card.type = 'button';
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', 'false');
    card.setAttribute('aria-label', `Play as ${info.name}, ${info.note}`);
    card.title = `${info.name} ${info.note}`;
    card.dataset.hero = info.id;
    card.dataset.accent = art.accent;

    card.append(el('span', 'b2-hero__num b2-display b2-num', String(index + 1).padStart(2, '0')));

    const stage = el('span', 'b2-hero__stage');
    const portrait = el('img', 'b2-hero__portrait');
    portrait.src = art.portrait;
    portrait.alt = '';
    portrait.decoding = 'async';
    portrait.draggable = false;
    const crown = el('span', 'b2-hero__crown');
    crown.hidden = true;
    crown.setAttribute('aria-hidden', 'true');
    crown.innerHTML =
      '<svg viewBox="0 0 32 26" focusable="false"><path d="M3 21 4.6 7.2 11.6 13 16 3l4.4 10 7-5.8L29 21Z"/><path d="M4 21h24v3H4z"/></svg>';
    stage.append(portrait, crown);

    const name = el('span', 'b2-hero__name b2-display', info.name);
    const note = el('span', 'b2-hero__note', info.note);
    const perk = el('span', 'b2-hero__perk', heroPerk(info.id).text);
    const plate = el('span', 'b2-hero__plate b2-display', 'CHOOSE');

    const unlocked = game.isHeroUnlocked(info.id);
    const rule = unlockRule(info.id);
    if (!unlocked && rule) {
      const have = Math.min(rule.target, rule.current(game.heroProgress()));
      card.classList.add('is-locked');
      card.setAttribute('aria-disabled', 'true');
      card.setAttribute('aria-label', `${info.name}: locked. ${rule.goal}, ${have} of ${rule.target}`);
      const goal = el('span', 'b2-hero__goal');
      goal.append(el('span', 'b2-hero__goaltext', rule.goal), el('strong', 'b2-hero__goalcount b2-num', `${have}/${rule.target}`));
      const meter = el('span', 'b2-hero__goalmeter');
      const fill = el('span', 'b2-hero__goalfill');
      fill.style.width = `${(have / rule.target) * 100}%`;
      meter.append(fill);
      card.append(stage, name, goal, meter, plate);
    } else {
      card.append(stage, name, note, perk, plate);
    }
    card.addEventListener('click', () => {
      if (!game.isHeroUnlocked(info.id)) {
        card.classList.remove('is-nope');
        void card.offsetWidth;
        card.classList.add('is-nope');
        return;
      }
      paint(info.id);
      if (info.id === game.hero) return;
      options.onPick?.(info.id);
    });

    cast.append(card);
    cards.set(info.id, card);
  });

  paint(game.hero);
  section.append(head, cast, foot);
  return section;
}
