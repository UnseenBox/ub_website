import type Phaser from 'phaser';
import url1 from '../assets/shovels/shovel-1.png';
import url2 from '../assets/shovels/shovel-2.png';
import url3 from '../assets/shovels/shovel-3.png';
import url4 from '../assets/shovels/shovel-4.png';
import url5 from '../assets/shovels/shovel-5.png';

/**
 * The five shovel pictures, rusty to magical. Each was straightened so the handle is upright;
 * `tipX/tipY` is where the blade tip sits in the picture (0..1) - the shovel pivots there when
 * it swings - and `displayH` is how tall it is drawn in the dig, in field units.
 */
export interface ShovelImage {
  url: string;
  tipX: number;
  tipY: number;
  texH: number;
  displayH: number;
}

export const SHOVEL_IMAGES: Record<string, ShovelImage> = {
  'shovel-1': { url: url1, tipX: 0.4223, tipY: 0.9982, texH: 520, displayH: 221 },
  'shovel-2': { url: url2, tipX: 0.4059, tipY: 0.9969, texH: 520, displayH: 257 },
  'shovel-3': { url: url3, tipX: 0.4479, tipY: 0.9986, texH: 520, displayH: 279 },
  'shovel-4': { url: url4, tipX: 0.4096, tipY: 0.9986, texH: 520, displayH: 280 },
  'shovel-5': { url: url5, tipX: 0.46, tipY: 0.9438, texH: 520, displayH: 313 },
};

export function loadShovelImages(load: Phaser.Loader.LoaderPlugin): void {
  for (const [key, img] of Object.entries(SHOVEL_IMAGES)) load.image(key, img.url);
}

export function shovelImage(key: string): ShovelImage {
  return SHOVEL_IMAGES[key] ?? SHOVEL_IMAGES['shovel-1'];
}
