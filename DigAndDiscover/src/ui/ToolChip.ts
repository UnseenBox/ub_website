import Phaser from 'phaser';
import { PALETTE } from '../config/Theme';
import { state } from '../core/GameState';

/** The tool in hand: just its picture in a small pill (no name). */
export class ToolChip extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly icon: Phaser.GameObjects.Image;
  private chipH = 28;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.bg = scene.add.graphics();
    this.icon = scene.add.image(0, 0, state.tool.textureKey).setOrigin(0.5);
    if (state.tool.tint) this.icon.setTint(state.tool.tint);
    this.add([this.bg, this.icon]);
    scene.add.existing(this);
    this.refresh();
  }

  layout(x: number, y: number, w: number, h: number): void {
    this.chipH = h;
    this.setPosition(x, y);
    this.icon.setScale((h * 1.15) / Math.max(this.icon.width, this.icon.height, 1)).setPosition(w / 2, 0).setAngle(45);
    this.redrawBg(w);
  }

  refresh(): void {
    this.icon.setTexture(state.tool.textureKey);
    if (state.tool.tint) this.icon.setTint(state.tool.tint);
    else this.icon.clearTint();
  }

  private redrawBg(w: number): void {
    const h = this.chipH;
    this.bg.clear();
    this.bg.fillStyle(0x000000, 0.25).fillRoundedRect(0, -h / 2 + 3, w, h, h / 2);
    this.bg.fillStyle(PALETTE.tray, 0.85).fillRoundedRect(0, -h / 2, w, h, h / 2);
    this.bg.lineStyle(2, 0xffffff, 0.12).strokeRoundedRect(0, -h / 2, w, h, h / 2);
    this.setSize(w, h);
  }
}
