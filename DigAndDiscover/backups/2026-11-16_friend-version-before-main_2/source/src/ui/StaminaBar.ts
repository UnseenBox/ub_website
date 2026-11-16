import Phaser from 'phaser';

/**
 * The stamina fill that runs inside the dark track of the bag panel picture (the bolt badge and the
 * frame are part of the picture).
 *
 * The fill never jumps: it eases toward the real value (quickly when stamina is spent, gently when it
 * comes back), a pale "lost" chunk lingers where the bar just was and then drains away, a white
 * flash runs along the edge of every hit, and below a fifth of the tank the bar breathes red.
 */
export class StaminaBar extends Phaser.GameObjects.Container {
  private readonly g: Phaser.GameObjects.Graphics;
  private bw = 200;
  private bh = 22;
  private cover = 0;
  private target = 1;
  /** What is drawn now (eases toward `target`). */
  private shown = -1;
  /** Where the bar was before the latest hits; drains down to `shown` after a short hold. */
  private ghost = 1;
  private hold = 0;
  private hit = 0;
  private flash = 0;
  private shimmer = 0;
  private breath = 0;
  private dirty = true;
  private lastRegen = false;

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
    this.dirty = true;
  }

  /** Called every frame; redraws only while something is moving. */
  setValue(value: number, max: number, regenerating: boolean, deltaMs: number): void {
    const target = Phaser.Math.Clamp(value / max, 0, 1);
    if (this.shown < 0) {
      this.shown = this.ghost = this.target = target;
      this.dirty = true;
    }
    if (target < this.target - 0.0005) {
      // Spent: remember where the bar was, hold it a moment, kick the flash.
      this.ghost = Math.max(this.ghost, this.shown);
      this.hold = 320;
      this.hit = 1;
    }
    this.target = target;
    const dt = Math.min(deltaMs, 100);

    // The fill: fast when draining, softer when refilling.
    const rate = target < this.shown ? 1 - Math.exp(-dt / 50) : 1 - Math.exp(-dt / 150);
    const prev = this.shown;
    this.shown += (target - this.shown) * rate;
    if (Math.abs(target - this.shown) < 0.0004) this.shown = target;

    // The lost chunk trails after a hold.
    if (this.hold > 0) this.hold -= dt;
    else if (this.ghost > this.shown) {
      this.ghost += (this.shown - this.ghost) * (1 - Math.exp(-dt / 260));
      if (this.ghost - this.shown < 0.0006) this.ghost = this.shown;
    }
    if (this.ghost < this.shown) this.ghost = this.shown;

    if (this.hit > 0) this.hit = Math.max(0, this.hit - dt / 360);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt / 400);
    if (regenerating) this.shimmer = (this.shimmer + dt / 900) % 1;
    const low = this.shown < 0.22 && target < 0.22;
    if (low) this.breath = (this.breath + dt / 420) % (Math.PI * 2);

    const moving = this.shown !== prev || this.ghost > this.shown || this.hit > 0 || this.flash > 0;
    if (!(moving || this.dirty || low || regenerating || regenerating !== this.lastRegen)) return;
    this.lastRegen = regenerating;
    this.dirty = false;
    this.draw(regenerating, low);
  }

  denied(): void {
    this.flash = 1;
    this.scene.tweens.add({ targets: this, x: { from: this.x - 7, to: this.x }, duration: 260, ease: 'Elastic.easeOut' });
  }

  private draw(regenerating: boolean, low: boolean): void {
    const { bw: w, bh: h } = this;
    const g = this.g;
    g.clear();
    const pad = Math.max(1.5, h * 0.1);
    const fh = h - pad * 2;
    const hidden = w * this.cover;
    const span = w - hidden - pad;
    const xAt = (f: number): number => (f > 0.001 ? hidden + span * f : 0);
    const endX = xAt(this.shown);
    const ghostX = xAt(this.ghost);
    const color = this.shown > 0.5 ? 0x7ee05a : this.shown > 0.22 ? 0xffd23f : 0xff6b4a;

    // The lost chunk: pale, with a warm edge, between the fill and where it was.
    if (ghostX > endX + 1) {
      const r = Math.min(fh / 2, (ghostX - endX) / 2);
      g.fillStyle(this.shown > 0.22 ? 0xfff0c0 : 0xffb0a0, 0.85).fillRoundedRect(Math.max(0, endX - r), pad, ghostX - Math.max(0, endX - r), fh, { tl: 0, bl: 0, tr: Math.min(fh / 2, r), br: Math.min(fh / 2, r) });
    }

    if (endX > 2) {
      const r = Math.min(fh / 2, endX / 2);
      g.fillStyle(color).fillRoundedRect(0, pad, endX, fh, { tl: 0, bl: 0, tr: r, br: r });
      g.fillStyle(0xffffff, 0.3).fillRoundedRect(hidden, pad + fh * 0.1, Math.max(0, endX - hidden - r * 0.5), fh * 0.3, { tl: 0, bl: 0, tr: fh * 0.15, br: fh * 0.15 });
      if (regenerating) {
        const sx = hidden + (endX - hidden) * this.shimmer;
        g.fillStyle(0xffffff, 0.35).fillRect(sx, pad, Math.min(10, endX - r - sx), fh);
      }
      // A hit: white wash over the fill and a bright edge that fades.
      if (this.hit > 0) {
        g.fillStyle(0xffffff, 0.35 * this.hit).fillRoundedRect(0, pad, endX, fh, { tl: 0, bl: 0, tr: r, br: r });
        g.fillStyle(0xffffff, 0.9 * this.hit).fillRect(Math.max(0, endX - 3), pad, 3, fh);
      }
    }

    // Running low: the whole track breathes red.
    if (low) {
      const a = 0.1 + 0.16 * (0.5 + 0.5 * Math.sin(this.breath));
      g.fillStyle(0xff3b30, a).fillRoundedRect(0, pad, w, fh, { tl: 0, bl: 0, tr: fh / 2, br: fh / 2 });
    }
    if (this.flash > 0) g.fillStyle(0xff3b30, 0.45 * this.flash).fillRoundedRect(0, pad, w, fh, { tl: 0, bl: 0, tr: fh / 2, br: fh / 2 });
  }
}
