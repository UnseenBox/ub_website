import Phaser from 'phaser';

/**
 * The stamina fill that runs inside the dark track of the bag panel picture (the bolt badge and the
 * frame are part of the picture). Redraws only when the value changes.
 */
export class StaminaBar extends Phaser.GameObjects.Container {
  private readonly g: Phaser.GameObjects.Graphics;
  private bw = 200;
  private bh = 22;
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

  layout(x: number, y: number, w: number, h: number): void {
    this.setPosition(x, y);
    this.bw = w;
    this.bh = h;
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
    const pad = Math.max(2, h * 0.12);
    const fillW = Math.max(0, (w - pad * 2) * fraction);
    if (fillW > 2) {
      const fh = h - pad * 2;
      const fr = Math.min(fh / 2, fillW / 2);
      g.fillStyle(color).fillRoundedRect(pad, pad, fillW, fh, fr);
      g.fillStyle(0xffffff, 0.32).fillRoundedRect(pad + 3, pad + 2, Math.max(0, fillW - 6), fh * 0.36, Math.min(fr, fh * 0.18));
      if (regenerating) {
        const sx = pad + fillW * this.shimmer;
        g.fillStyle(0xffffff, 0.35).fillRect(sx, pad, Math.min(10, pad + fillW - sx), fh);
      }
    }
    if (this.flash > 0) g.fillStyle(0xff3b30, 0.45 * this.flash).fillRoundedRect(0, 0, w, h, h / 2);
  }
}
