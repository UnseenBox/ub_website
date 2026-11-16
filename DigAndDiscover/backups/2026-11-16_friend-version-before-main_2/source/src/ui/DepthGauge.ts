import Phaser from 'phaser';
import { PALETTE, outlinedStyle } from '../config/Theme';
import { state } from '../core/GameState';

/**
 * Slim vertical depth gauge along the right edge of the play area. The top is
 * the grass line, the bottom is the bottom of the deposit. Each layer is a
 * coloured segment (dimmed until reached); a triangle shows where the digger
 * is working and a thin line marks the deepest point reached so far.
 * Non-interactive, and it redraws only when something actually moves.
 */
export class DepthGauge extends Phaser.GameObjects.Container {
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly marker: Phaser.GameObjects.Graphics;
  private readonly depthText: Phaser.GameObjects.Text;
  private gaugeW = 16;
  private gaugeH = 300;
  private shownUnits = 0;
  private drawnY = -1;
  private drawnDeepY = -1;
  private drawnReached = -1;
  private shownLabel = '';

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.bar = scene.add.graphics();
    this.marker = scene.add.graphics();
    this.depthText = scene.add.text(0, 0, '0.0 m', outlinedStyle(14, '#fff6e6')).setOrigin(1, 0.5);
    this.add([this.bar, this.marker, this.depthText]);
    scene.add.existing(this);
  }

  layout(x: number, y: number, w: number, h: number): void {
    this.gaugeW = w;
    this.gaugeH = Math.max(40, h - 16);
    this.setPosition(x, y + 8);
    const size = w < 18 ? 12 : 14;
    this.depthText.setFontSize(size);
    this.drawnReached = -1;
    this.drawnY = -1;
    this.shownUnits = state.dig.focusUnits;
  }

  /** Called every frame; cheap unless the digger moved. */
  tick(dtMs: number): void {
    const dig = state.dig;
    const target = dig.focusUnits;
    this.shownUnits += (target - this.shownUnits) * (1 - Math.exp(-dtMs / 160));
    if (Math.abs(target - this.shownUnits) < 0.3) this.shownUnits = target;

    const total = dig.totalDepthUnits;
    const y = Math.round((this.shownUnits / total) * this.gaugeH);
    const deepY = Math.round((dig.deepestUnits / total) * this.gaugeH);
    if (dig.deepestLayerIndex !== this.drawnReached) this.drawBar(dig.deepestLayerIndex);
    if (y !== this.drawnY || deepY !== this.drawnDeepY) this.drawMarker(y, deepY);

    // Whole metres: the number changes rarely, so the text is not redrawn every frame.
    const label = `${Math.round(this.shownUnits / dig.unitsPerMeter)} m`;
    if (label !== this.shownLabel) this.depthText.setText((this.shownLabel = label));
  }

  private drawBar(reached: number): void {
    this.drawnReached = reached;
    const { gaugeW: w, gaugeH: h } = this;
    const g = this.bar.clear();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(-2, -2, w + 4, h + 4, 7);
    const total = state.dig.totalDepthUnits;
    let top = 0;
    state.layers.forEach((layer, i) => {
      const segH = (layer.thickness / total) * h;
      g.fillStyle(layer.look.gauge, i <= reached ? 1 : 0.4).fillRect(0, top, w, Math.max(1, segH - 1));
      top += segH;
    });
    g.lineStyle(2, 0xffffff, 0.35).strokeRoundedRect(-1, -1, w + 2, h + 2, 5);
  }

  private drawMarker(y: number, deepY: number): void {
    this.drawnY = y;
    this.drawnDeepY = deepY;
    const { gaugeW: w, gaugeH: h } = this;
    const g = this.marker.clear();
    if (deepY > 0) g.lineStyle(2, 0xffffff, 0.9).lineBetween(-3, deepY, w + 3, deepY);
    g.fillStyle(0x000000, 0.45).fillTriangle(-3, y - 7, -3, y + 7, -13, y);
    g.fillStyle(PALETTE.gold).fillTriangle(-4, y - 6, -4, y + 6, -12, y);
    const labelY = Phaser.Math.Clamp(y, 10, h - 30);
    this.depthText.setPosition(-17, labelY);
  }
}
