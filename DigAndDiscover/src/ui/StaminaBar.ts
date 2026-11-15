import Phaser from 'phaser';

/**
 * The stamina fill that runs inside the dark track of the bag panel picture (the bolt badge and the
 * frame are part of the picture). Redraws only when the value changes.
 */
export class StaminaBar extends Phaser.GameObjects.Container {
  private readonly g: Phaser.GameObjects.Graphics;
  private bw = 200;
  private bh = 22;
  private cover = 0;
  private shownFraction = -1;
  private shownRegen = false;
  private shownShimmer = -1;
  private flash = 0;
  private shimmer = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.g = scene.add.graphics();
    this.add([this.g]);
    scene.add.existing(this);
  }

  /** `cover` is the share of the width that hides under the badge, so the visible part still reads 0..100%. */
  layout(x: number, y: number, w: number, h: number, cover = 0): void {
    this.setPosition(x, y);
    this.bw = w;
    this.bh = h;
    this.cover = cover;
    this.shownFraction = -1;
  }

  /** Called every frame; cheap unless something visibly changed. */
  setValue(value: number, max: number, regenerating: boolean, deltaMs: number): void {
    const fraction = value / max;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - deltaMs / 400);
    if (regenerating) this.shimmer = (this.shimmer + deltaMs / 900) % 1;
    // The shimmer only needs ~16 steps per sweep, so phones are not redrawing the bar every frame.
    const step = Math.floor(this.shimmer * 16);
    const changed = Math.abs(fraction - this.shownFraction) > 0.002 || regenerating !== this.shownRegen || (regenerating && step !== this.shownShimmer);
    if (!changed && this.flash <= 0) return;
    this.shownFraction = fraction;
    this.shownRegen = regenerating;
    this.shownShimmer = step;
    this.draw(fraction, regenerating);
  }

  denied(): void {
    this.flash = 1;
    this.scene.tweens.add({ targets: this, x: { from: this.x - 7, to: this.x }, duration: 260, ease: 'Elastic.easeOut' });
  }

  private draw(fraction: number, regenerating: boolean): void {
    const { bw: w, bh: h } = this;
    const g = this.g;
    g.clear();
    const color = fraction > 0.5 ? 0x7ee05a : fraction > 0.22 ? 0xffd23f : 0xff6b4a;
    // Equal gaps above and below keep the fill centred in the track. It starts square under the
    // badge and only the right end is rounded.
    const pad = Math.max(1.5, h * 0.1);
    const fh = h - pad * 2;
    const hidden = w * this.cover;
    const fillW = fraction > 0.001 ? hidden + (w - hidden - pad) * fraction : 0;
    if (fillW > 2) {
      const r = Math.min(fh / 2, fillW / 2);
      g.fillStyle(color).fillRoundedRect(0, pad, fillW, fh, { tl: 0, bl: 0, tr: r, br: r });
      g.fillStyle(0xffffff, 0.3).fillRoundedRect(hidden, pad + fh * 0.1, Math.max(0, fillW - hidden - r * 0.5), fh * 0.3, { tl: 0, bl: 0, tr: fh * 0.15, br: fh * 0.15 });
      if (regenerating) {
        const sx = hidden + (fillW - hidden) * this.shimmer;
        g.fillStyle(0xffffff, 0.35).fillRect(sx, pad, Math.min(10, fillW - r - sx), fh);
      }
    }
    if (this.flash > 0) g.fillStyle(0xff3b30, 0.45 * this.flash).fillRoundedRect(0, pad, w, fh, { tl: 0, bl: 0, tr: fh / 2, br: fh / 2 });
  }
}
