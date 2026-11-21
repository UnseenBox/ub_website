import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { MENU_BUTTONS_TEXTURE } from '../game/textureKeys';

/**
 * Title-screen button drawn from a cropped slice of the supplied button sheet.
 * The supplied label is baked into the art; nothing is drawn on top of it.
 */
export function artButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  frame: string,
  onClick: () => void,
  depth = 0,
): Phaser.GameObjects.Container {
  const bg = scene.add.image(0, 0, MENU_BUTTONS_TEXTURE, frame).setDisplaySize(w, h);
  const c = scene.add.container(x, y, [bg]).setDepth(depth).setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerover', () => {
    bg.setTint(0xffe0a8);
    audio.play('ui_hover', { volume: 0.55 });
  });
  c.on('pointerout', () => bg.clearTint());
  c.on('pointerdown', () => {
    void audio.unlock().then(() => audio.play('ui_click', { volume: 0.7 }));
    onClick();
  });
  return c;
}
