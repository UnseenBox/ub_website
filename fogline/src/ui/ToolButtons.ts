// The tool belt on screen: a round button for each special tool, down the right side of the
// field, with its charges (and its key where there is a keyboard).

import Phaser from 'phaser';
import { toolById, type ToolId } from '../data/tools';
import { VIEW } from '../game/config';
import { DEPTH } from '../game/depths';
import { edgeShift } from '../game/screen';
import type { ToolBelt } from '../systems/ToolBelt';
import { ITEM_ICON, icon } from './icons';
import { C, STENCIL, text } from './kit';

const R = 32;
const TOP = 132;
const STEP = 76;

interface Button {
  id: ToolId;
  c: Phaser.GameObjects.Container;
  ring: Phaser.GameObjects.Graphics;
  face: Phaser.GameObjects.Image;
  count: Phaser.GameObjects.Text;
  key: Phaser.GameObjects.Text;
  drawn: string;
}

export class ToolButtons {
  private readonly buttons: Button[];

  constructor(
    scene: Phaser.Scene, private readonly belt: ToolBelt, private readonly touch: () => boolean,
    use: (id: ToolId) => void,
  ) {
    this.buttons = belt.slots.map((s, i) => {
      const def = toolById(s.id)!;
      const ring = scene.add.graphics();
      const face = icon(scene, ITEM_ICON[s.id], 0, -2, 32, def.color);
      const count = text(scene, R - 4, R - 8, '', { size: 18, font: STENCIL, shadow: 2 }).setOrigin(0.5);
      const key = text(scene, -R - 6, 0, def.key, { size: 14, color: C.muted, bold: true, shadow: 2 }).setOrigin(1, 0.5);
      const c = scene.add.container(0, TOP + i * STEP, [ring, face, count, key]).setDepth(DEPTH.hud + 2);
      c.setInteractive(new Phaser.Geom.Circle(0, 0, R + 6), Phaser.Geom.Circle.Contains);
      c.on('pointerdown', () => use(s.id));
      return { id: s.id, c, ring, face, count, key, drawn: '' };
    });
  }

  setVisible(on: boolean): void {
    for (const b of this.buttons) b.c.setVisible(on);
  }

  update(): void {
    const x = VIEW.width - 44 + edgeShift();
    for (const b of this.buttons) {
      const s = this.belt.slot(b.id)!;
      b.c.x = x;
      b.key.setVisible(!this.touch());
      const cooling = Math.ceil(s.cooldownLeft * 10);
      const state = `${s.charges}:${cooling}`;
      if (state === b.drawn) continue;
      b.drawn = state;
      const ready = s.charges > 0 && s.cooldownLeft <= 0;
      const color = toolById(b.id)!.color;
      b.face.setAlpha(ready ? 1 : 0.35);
      b.count.setText(`${s.charges}`).setColor(s.charges ? '#f1ead0' : '#77735f');
      const g = b.ring;
      g.clear();
      g.fillStyle(0x000000, 0.45).fillCircle(2, 3, R);
      g.fillStyle(0x16170f, 0.92).fillCircle(0, 0, R);
      g.lineStyle(3, ready ? color : 0x55554a, 1).strokeCircle(0, 0, R);
      if (s.cooldownLeft > 0 && s.charges > 0) {
        g.lineStyle(4, color, 0.9);
        g.beginPath();
        g.arc(0, 0, R - 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - s.cooldownLeft / 5));
        g.strokePath();
      }
    }
  }
}
