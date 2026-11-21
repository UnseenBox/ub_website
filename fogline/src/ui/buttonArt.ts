import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { MENU_BUTTON_FRAMES, MENU_BUTTONS_TEXTURE } from '../game/textureKeys';
import { STENCIL } from './widgets';

/**
 * Title-screen button drawn from a cropped slice of the supplied button sheet.
 * The baked label is covered with a blank patch from the same art before the
 * correct action label is drawn on top.
 */
export function imageButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  depth = 0,
  accent = 0xc8a040,
  frame: string = MENU_BUTTON_FRAMES.deploy,
): Phaser.GameObjects.Container {
  void accent;
  const bg = scene.add.image(0, 0, MENU_BUTTONS_TEXTURE, frame).setDisplaySize(w, h);
  const patch = scene.add.image(-0.08 * w, 0, MENU_BUTTONS_TEXTURE, MENU_BUTTON_FRAMES.patch)
    .setDisplaySize(0.55 * w, 0.62 * h);
  const text = scene.add.text(6, 0, label, {
    fontFamily: STENCIL,
    fontSize: `${Math.round(h * 0.42)}px`,
    color: '#f0e6c8',
    stroke: '#000',
    strokeThickness: 3,
  }).setOrigin(0.5);
  const c = scene.add.container(x, y, [bg, patch, text]).setDepth(depth).setSize(w, h);
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
