import type Phaser from 'phaser';
import { ROCK_SPRITE_PREFIX } from '../data/exteriors';

/** The painted rocks, one PNG each in src/assets/rocks (cut from the two rock sheets). */
const FILES = import.meta.glob('../assets/rocks/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** Queues every rock picture for loading (call from a scene's preload). */
export function loadRockSprites(load: Phaser.Loader.LoaderPlugin): void {
  for (const [path, url] of Object.entries(FILES)) {
    const id = path.split('/').pop()?.replace(/\.png$/i, '');
    if (id) load.image(ROCK_SPRITE_PREFIX + id, url);
  }
}
