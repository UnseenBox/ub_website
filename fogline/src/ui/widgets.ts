import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';

export const MONO = 'Consolas, "Courier New", monospace';
export const STENCIL = 'Impact, "Arial Narrow Bold", "Arial Black", sans-serif';

/** Dark gunmetal button with a stencilled label. */
export function button(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, onClick: () => void, depth = 0, accent = 0xc8a040,
): Phaser.GameObjects.Container {
  const bg = scene.add.rectangle(0, 0, w, h, 0x222423).setStrokeStyle(2, 0x0a0a0a);
  const lip = scene.add.rectangle(0, -h / 2 + 2, w - 4, 2, 0x5a5c58);
  const edge = scene.add.rectangle(-w / 2 + 3, 0, 4, h - 8, accent);
  const t = scene.add.text(6, 0, label, { fontFamily: STENCIL, fontSize: `${Math.round(h * 0.46)}px`, color: '#e0dcc0', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
  const c = scene.add.container(x, y, [bg, lip, edge, t]).setDepth(depth).setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerover', () => {
    bg.setFillStyle(0x34363a);
    audio.play('ui_hover', { volume: 0.55 });
  });
  c.on('pointerout', () => bg.setFillStyle(0x222423));
  c.on('pointerdown', () => {
    void audio.unlock().then(() => audio.play('ui_click', { volume: 0.7 }));
    onClick();
  });
  return c;
}

/** Horizontal slider 0..1. */
export function slider(
  scene: Phaser.Scene, x: number, y: number, w: number, label: string, value: number, onChange: (v: number) => void, depth = 0,
): void {
  scene.add.text(x, y - 18, label, { fontFamily: MONO, fontSize: '13px', color: '#b8b8a0' }).setDepth(depth);
  const track = scene.add.rectangle(x, y, w, 8, 0x0e0f0e).setOrigin(0, 0.5).setStrokeStyle(1, 0x4a4c48).setDepth(depth);
  const fill = scene.add.rectangle(x + 1, y, (w - 2) * value, 6, 0x8a9a50).setOrigin(0, 0.5).setDepth(depth);
  const knob = scene.add.rectangle(x + w * value, y, 12, 20, 0xc8c0a0).setStrokeStyle(2, 0x111111).setDepth(depth + 1);
  const pct = scene.add.text(x + w + 12, y, `${Math.round(value * 100)}%`, { fontFamily: MONO, fontSize: '13px', color: '#d8d8c0' }).setOrigin(0, 0.5).setDepth(depth);
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
    set(p.x);
  });
  scene.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (dragging && p.isDown) set(p.x); });
  scene.input.on('pointerup', () => { dragging = false; });
  void track;
}

export function toggleFullscreen(scene: Phaser.Scene): void {
  if (scene.scale.isFullscreen) scene.scale.stopFullscreen();
  else scene.scale.startFullscreen();
}
