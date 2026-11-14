import Phaser from 'phaser';
import { outlinedStyle } from '../config/Theme';

/** Rounded stamina bar with a bolt badge. Redraws only when the value changes. */
export class StaminaBar extends Phaser.GameObjects.Container {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private bw = 200;
  private bh = 22;
  private shownFraction = -1;
  private shownRegen = false;
  private flash = 0;
  private shimmer = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.g = scene.add.graphics();
    this.label = scene.add.text(0, 0, '', outlinedStyle(14)).setOrigin(1, 0.5);
    this.add([this.g, this.label]);
    scene.add.existing(this);
  }

  layout(x: number, y: number, w: number, h: number): void {
    this.setPosition(x, y);
    this.bw = w;
    this.bh = h;
    this.label.setFontSize(Math.round(h * 0.68));
    this.label.setPosition(w - 10, h / 2);
    this.shownFraction = -1;
  }

  /** Called every frame; cheap unless something visibly changed. */
  setValue(value: number, max: number, regenerating: boolean, deltaMs: number): void {
    const fraction = value / max;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - deltaMs / 400);
    if (regenerating) this.shimmer = (this.shimmer + deltaMs / 900) % 1;
    const changed = Math.abs(fraction - this.shownFraction) > 0.001 || regenerating !== this.shownRegen;
    if (!changed && this.flash <= 0 && !regenerating) return;
    this.shownFraction = fraction;
    this.shownRegen = regenerating;
    this.label.setText(`${Math.floor(value)} / ${max}`);
    this.draw(fraction, regenerating);
  }

  denied(): void {
    this.flash = 1;
    this.scene.tweens.add({ targets: this, x: { from: this.x - 7, to: this.x }, duration: 260, ease: 'Elastic.easeOut' });
  }

  private draw(fraction: number, regenerating: boolean): void {
    const { bw: w, bh: h } = this;
    const g = this.g;
    const r = h / 2;
    const iconR = h * 0.78;
    const barX = iconR + 4;
    const barW = w - barX;
    g.clear();
    g.fillStyle(0x000000, 0.4).fillRoundedRect(barX, 0, barW, h, r);
    const color = fraction > 0.5 ? 0x7ee05a : fraction > 0.22 ? 0xffd23f : 0xff6b4a;
    const fillW = Math.max(0, (barW - 6) * fraction);
    if (fillW > 2) {
      const fr = Math.min((h - 6) / 2, fillW / 2);
      g.fillStyle(color).fillRoundedRect(barX + 3, 3, fillW, h - 6, fr);
      g.fillStyle(0xffffff, 0.3).fillRoundedRect(barX + 6, 5, Math.max(0, fillW - 6), (h - 6) * 0.35, Math.min(fr, (h - 6) * 0.17));
      if (regenerating) {
        const sx = barX + 3 + fillW * this.shimmer;
        g.fillStyle(0xffffff, 0.35).fillRect(sx, 3, Math.min(10, barX + 3 + fillW - sx), h - 6);
      }
    }
    if (this.flash > 0) g.fillStyle(0xff3b30, 0.45 * this.flash).fillRoundedRect(barX, 0, barW, h, r);
    // Bolt badge.
    const cx = iconR * 0.9;
    const cy = h / 2;
    g.fillStyle(0x3b2616).fillCircle(cx, cy + 2, iconR);
    g.fillStyle(regenerating ? 0x9ef07a : 0xffd23f).fillCircle(cx, cy, iconR);
    const s = iconR * 0.62;
    g.fillStyle(0x3b2616).fillPoints(
      [
        { x: cx + s * 0.25, y: cy - s },
        { x: cx - s * 0.55, y: cy + s * 0.15 },
        { x: cx - s * 0.02, y: cy + s * 0.15 },
        { x: cx - s * 0.25, y: cy + s },
        { x: cx + s * 0.55, y: cy - s * 0.15 },
        { x: cx + s * 0.02, y: cy - s * 0.15 },
      ] as Phaser.Types.Math.Vector2Like[],
      true,
    );
  }
}
