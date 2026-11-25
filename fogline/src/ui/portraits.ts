// Enemy figures for cards: the same body that walks out of the fog, posed still.

import Phaser from 'phaser';
import type { EnemyDef } from '../data/enemies';
import { Zombie } from '../entities/Zombie';

/** The enemy standing with its feet at (0, 0), fitted into `width` × `height`. */
export function enemyPortrait(scene: Phaser.Scene, def: EnemyDef, width: number, height: number): Phaser.GameObjects.Container {
  return new Zombie(scene).portrait(def, height, width);
}
