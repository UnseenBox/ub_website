import type { HeroId } from '../core/Hero';
import { Player } from '../entities/Player';
import { createPet } from '../entities/Pets';
import { drawPlayer } from './PlayerArt';
import { drawPet } from './PetArt';

/**
 * Character portraits for the menus, painted from the in-game art: the same hero and pet the
 * player controls, posed and blown up. One source of truth, so a redesign of the sprite is a
 * redesign of every portrait. Painted once per hero and kept as a data URL.
 */

const SIZE = 720;
const cache = new Map<HeroId, string>();

/** A data URL of the hero and its pet, or null where there is no 2D canvas (tests, very old browsers). */
export function paintHeroPortrait(hero: HeroId): string | null {
  const hit = cache.get(hero);
  if (hit) return hit;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    return null;
  }
  if (!ctx || typeof ctx.drawImage !== 'function' || typeof canvas.toDataURL !== 'function') return null;

  try {
    const scale = SIZE / 92;
    ctx.save();
    ctx.translate(SIZE * 0.47, SIZE * 0.83);
    ctx.scale(scale, scale);
    // floor shadow under both of them
    ctx.fillStyle = 'rgba(10, 30, 26, 0.28)';
    ctx.beginPath();
    ctx.ellipse(6, 3, 34, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    const pet = createPet(hero, 0, 0);
    pet.sitting = true;
    pet.facing = 1;
    const petBehind = pet.species === 'parrot';
    if (!petBehind) {
      // the pet sits at the hero's feet, in front and to the right
      if (pet.species === 'hamster') drawPet(ctx, pet, 22, 6, 0, 2.0);
      else drawPet(ctx, pet, 24, 7, 0, 2.0);
    }
    // Just woken at 3 a.m. (between yawns), facing the camera, a little to the right.
    const player = Object.assign(new Player(0, 0), { aimX: 0.32, aimY: 0.95 });
    drawPlayer(ctx, player, 0, 0, 2.0, hero);
    if (petBehind) drawPet(ctx, pet, 16, 1, 34, 2.0);
    ctx.restore();
    const url = canvas.toDataURL('image/png');
    if (!url.startsWith('data:image/png')) return null;
    cache.set(hero, url);
    return url;
  } catch {
    return null;
  }
}
