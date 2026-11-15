import Phaser from 'phaser';
import { BUTTON_COLORS, textStyle } from '../config/Theme';
import { sfx } from '../audio/Sfx';

export interface ButtonColors {
  face: number;
  lip: number;
  text: string;
}

export interface ButtonOptions {
  width: number;
  height: number;
  label: string;
  fontSize: number;
  colors: ButtonColors;
  onClick: () => void;
}

/** Chunky rounded button with a 3D lip, press squash and optional pulse. */
export class Button extends Phaser.GameObjects.Container {
  private readonly inner: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private bw: number;
  private bh: number;
  private colors: ButtonColors;
  private enabled = true;
  private pressed = false;
  private pulseTween: Phaser.Tweens.Tween | null = null;
  private readonly onClick: () => void;

  constructor(scene: Phaser.Scene, opts: ButtonOptions) {
    super(scene, 0, 0);
    this.bw = opts.width;
    this.bh = opts.height;
    this.colors = opts.colors;
    this.onClick = opts.onClick;
    this.bg = scene.add.graphics();
    this.label = scene.add.text(0, 0, opts.label, textStyle(opts.fontSize)).setOrigin(0.5);
    this.label.setShadow(0, 2, 'rgba(0,0,0,0.25)', 0, false, true);
    this.inner = scene.add.container(0, 0, [this.bg, this.label]);
    this.add(this.inner);
    scene.add.existing(this);

    this.setSize(this.bw, this.bh);
    this.setInteractive({ useHandCursor: true });
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, this.handleDown, this);
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, this.handleUp, this);
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, this.release, this);
    this.redraw();
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  resize(width: number, height: number, fontSize: number): this {
    this.bw = width;
    this.bh = height;
    this.setSize(width, height);
    (this.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setTo(0, 0, width, height);
    this.label.setFontSize(fontSize);
    this.redraw();
    return this;
  }

  setLabel(text: string): this {
    if (this.label.text !== text) this.label.setText(text);
    return this;
  }

  setColors(colors: ButtonColors): this {
    if (colors !== this.colors) {
      this.colors = colors;
      this.redraw();
    }
    return this;
  }

  setEnabled(enabled: boolean): this {
    if (enabled !== this.enabled) {
      this.enabled = enabled;
      if (this.input) this.input.cursor = enabled ? 'pointer' : 'default';
      this.redraw();
    }
    return this;
  }

  setPulse(on: boolean): this {
    if (on && !this.pulseTween) {
      this.pulseTween = this.scene.tweens.add({
        targets: this,
        scale: 1.06,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else if (!on && this.pulseTween) {
      this.pulseTween.remove();
      this.pulseTween = null;
      this.setScale(1);
    }
    return this;
  }

  /** Simulates a full press (used for keyboard shortcuts). */
  trigger(): void {
    if (!this.enabled || !this.visible) return;
    this.scene.tweens.add({ targets: this.inner, scale: 0.93, duration: 60, yoyo: true });
    sfx.click();
    this.onClick();
  }

  private redraw(): void {
    const { bw: w, bh: h } = this;
    const c = this.enabled ? this.colors : BUTTON_COLORS.disabled;
    const lip = Math.max(4, Math.round(h * 0.1));
    const faceH = h - lip;
    const r = Math.min(faceH / 2, 22);
    const g = this.bg;
    g.clear();
    g.fillStyle(0x000000, 0.2).fillRoundedRect(-w / 2, -h / 2 + lip + 3, w, faceH, r);
    g.fillStyle(c.lip).fillRoundedRect(-w / 2, -h / 2 + lip, w, faceH, r);
    g.fillStyle(c.face).fillRoundedRect(-w / 2, -h / 2, w, faceH, r);
    const hiH = faceH * 0.38;
    g.fillStyle(0xffffff, 0.22).fillRoundedRect(-w / 2 + 8, -h / 2 + 4, w - 16, hiH, Math.min(r * 0.8, hiH / 2));
    this.label.setY(-lip / 2);
    this.label.setColor(c.text);
  }

  private handleDown(): void {
    if (!this.enabled) {
      sfx.denied();
      this.scene.tweens.add({ targets: this.inner, x: { from: -5, to: 0 }, duration: 220, ease: 'Elastic.easeOut' });
      return;
    }
    this.pressed = true;
    sfx.click();
    this.scene.tweens.killTweensOf(this.inner);
    this.scene.tweens.add({ targets: this.inner, scale: 0.92, duration: 60, ease: 'Quad.easeOut' });
  }

  private handleUp(): void {
    if (!this.pressed) return;
    this.release();
    this.onClick();
  }

  private release(): void {
    if (!this.pressed) return;
    this.pressed = false;
    this.scene.tweens.killTweensOf(this.inner);
    this.scene.tweens.add({ targets: this.inner, scale: 1, duration: 220, ease: 'Back.easeOut' });
  }
}
