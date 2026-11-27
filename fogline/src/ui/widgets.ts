import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { designPoint } from '../game/screen';
import { MONO, STENCIL, pushButton, type ButtonTone } from './kit';

export { MONO, STENCIL };

const TONE_OF: Record<number, ButtonTone> = { 0xc84030: 'go', 0x5fae3c: 'buy', 0xc8a040: 'brass', 0xe8c060: 'brass' };

/** A bordered button with a stencilled label; the accent colour picks its tone. */
export function button(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, onClick: () => void, depth = 0, accent = 0x55554a,
): Phaser.GameObjects.Container {
  return pushButton(scene, x, y, { w, h, label, onClick, tone: TONE_OF[accent] ?? 'plain' }).c.setDepth(depth);
}

/** Horizontal slider 0..1. */
export function slider(
  scene: Phaser.Scene, x: number, y: number, w: number, label: string, value: number, onChange: (v: number) => void, depth = 0,
): void {
  scene.add.text(x, y - 27, label, { fontFamily: MONO, fontSize: '17px', fontStyle: 'bold', color: '#b8b298' }).setDepth(depth);
  const track = scene.add.rectangle(x, y, w, 8, 0x2e3026).setOrigin(0, 0.5).setStrokeStyle(1, 0x44443a).setDepth(depth);
  const fill = scene.add.rectangle(x + 1, y, (w - 2) * value, 6, 0xd3a948).setOrigin(0, 0.5).setDepth(depth);
  const knob = scene.add.rectangle(x + w * value, y, 12, 20, 0xf1ead0).setStrokeStyle(2, 0x12130f).setDepth(depth + 1);
  const pct = scene.add.text(x + w + 12, y, `${Math.round(value * 100)}%`, { fontFamily: MONO, fontSize: '17px', color: '#d8d8c0' }).setOrigin(0, 0.5).setDepth(depth);
  const zone = scene.add.zone(x - 8, y - 14, w + 16, 28).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(depth + 2);
  let dragging = false;
  const set = (px: number) => {
    const v = Phaser.Math.Clamp((px - x) / w, 0, 1);
    fill.width = (w - 2) * v;
    knob.x = x + w * v;
    pct.setText(`${Math.round(v * 100)}%`);
    onChange(v);
  };
  zone.on('pointerover', () => audio.play('ui_hover', { volume: 0.4 }));
  zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
    audio.play('ui_click', { volume: 0.55 });
    dragging = true;
    set(designPoint(p).x);
  });
  scene.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (dragging && p.isDown) set(designPoint(p).x); });
  scene.input.on('pointerup', () => { dragging = false; });
  void track;
}

export function toggleFullscreen(scene: Phaser.Scene): void {
  if (scene.scale.isFullscreen) scene.scale.stopFullscreen();
  else scene.scale.startFullscreen();
}
