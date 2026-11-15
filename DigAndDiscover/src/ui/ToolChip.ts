import Phaser from 'phaser';
import { PALETTE, textStyle } from '../config/Theme';
import { state } from '../core/GameState';

export class ToolChip extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly nameText: Phaser.GameObjects.Text;
  private chipW = 120;
  private chipH = 40;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.bg = scene.add.graphics();
    this.icon = scene.add.image(0, 0, state.tool.textureKey).setOrigin(0.5);
    this.nameText = scene.add.text(0, 0, state.tool.name, textStyle(14, '#fff6e6')).setOrigin(0, 0.5);
    this.add([this.bg, this.icon, this.nameText]);
    scene.add.existing(this);
    this.refresh();
  }

  layout(x: number, y: number, w: number, h: number): void {
    this.chipW = w;
    this.chipH = h;
    this.setPosition(x, y);
    this.icon.setScale((h * 1.15) / Math.max(this.icon.width, this.icon.height, 1)).setPosition(h * 0.5, 0).setAngle(45);
    this.nameText.setFontSize(Math.round(h * 0.52)).setPosition(h * 1.1, 1);
    this.redrawBg();
  }

  refresh(): void {
    this.icon.setTexture(state.tool.textureKey);
    this.nameText.setText(state.tool.name);
    this.redrawBg();
  }

  private redrawBg(): void {
    const textW = this.nameText.width;
    const iconW = this.icon.displayWidth;
    const w = Math.max(this.chipW, iconW + textW + this.chipH * 1.2);
    const h = this.chipH;
    this.bg.clear();
    this.bg.fillStyle(0x000000, 0.25).fillRoundedRect(0, -h / 2 + 3, w, h, h / 2);
    this.bg.fillStyle(PALETTE.tray, 0.85).fillRoundedRect(0, -h / 2, w, h, h / 2);
    this.bg.lineStyle(2, 0xffffff, 0.12).strokeRoundedRect(0, -h / 2, w, h, h / 2);
    this.setSize(w, h);
  }
}