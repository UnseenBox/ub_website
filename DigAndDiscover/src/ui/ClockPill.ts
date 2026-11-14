import Phaser from 'phaser';
import { PALETTE, outlinedStyle, textStyle } from '../config/Theme';
import { makeCanvasTexture } from '../art/paint';

const SUN_KEY = 'clock-sun';
/** The time text starts pulsing gently once this much of the day has passed. */
const PULSE_FROM = 0.88;

/** 0xRRGGBB blend from yellow (morning) to orange (late afternoon). */
function sunTint(t: number): number {
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return (mix(0xff, 0xff) << 16) | (mix(0xe0, 0x8a) << 8) | mix(0x6a, 0x2a);
}

/**
 * Top-bar widget: the day number, the in-game clock and a thin bar showing how
 * much of the working day is left. Noticeable without being distracting; it
 * only redraws when the displayed time or bar actually changes.
 */
export class ClockPill extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly dayText: Phaser.GameObjects.Text;
  private readonly timeText: Phaser.GameObjects.Text;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly sun: Phaser.GameObjects.Image;
  private pillH = 44;
  private pillW = 0;
  private centerX = 0;
  private minLeft = -Infinity;
  private lastBar = -1;
  private lastLabel = '';
  private lastDay = -1;
  private pulse: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.bg = scene.add.graphics();
    this.dayText = scene.add.text(0, 0, '', textStyle(12, '#ffd34d')).setOrigin(0.5);
    this.timeText = scene.add.text(0, 0, '', outlinedStyle(20, PALETTE.money)).setOrigin(0.5);
    this.bar = scene.add.graphics();
    this.sun = scene.add.image(0, 0, SUN_KEY).setOrigin(0.5);
    this.add([this.bg, this.sun, this.dayText, this.timeText, this.bar]);
    scene.add.existing(this);
  }

  /** Width of the pill as last drawn, for neighbours that need to avoid it. */
  get pillWidth(): number {
    return this.pillW;
  }

  /** Centres the pill, but never lets its left edge go left of minLeft (keeps it clear of the money pill). */
  layout(centerX: number, centerY: number, height: number, minLeft = -Infinity): void {
    this.pillH = height;
    this.centerX = centerX;
    this.minLeft = minLeft;
    this.setPosition(centerX, centerY);
    this.dayText.setFontSize(Math.round(height * 0.27));
    this.timeText.setFontSize(Math.round(height * 0.46));
    this.sun.setScale((height * 0.5) / 24);
    this.lastBar = -1;
    this.lastLabel = '';
    this.relayout();
  }

  /** Called every frame; progress is quantised so the bar redraws only a few hundred times a day. */
  setTime(rawProgress: number, label: string, day: number): void {
    const progress = Math.round(rawProgress * 240) / 240;
    if (label !== this.lastLabel || day !== this.lastDay) {
      this.lastLabel = label;
      this.lastDay = day;
      this.dayText.setText(`DAY ${day}`);
      this.timeText.setText(label);
      this.relayout();
    }
    if (progress !== this.lastBar) {
      this.lastBar = progress;
      this.drawBar(progress);
      this.sun.setTint(sunTint(progress));
      this.updatePulse(progress);
    }
  }

  private relayout(): void {
    const h = this.pillH;
    const textW = Math.max(this.dayText.width, this.timeText.width);
    const w = Math.max(h * 2.5, textW + h * 1.25);
    this.x = Math.max(this.centerX, this.minLeft + w / 2);
    const left = -w / 2;
    // Sun on the left, the two text lines centred in the remaining space.
    this.sun.setPosition(left + h * 0.55, -h * 0.05);
    const textX = left + h * 1.0 + (w - h * 1.0) / 2;
    this.dayText.setPosition(textX, -h * 0.25);
    this.timeText.setPosition(textX, h * 0.07);
    if (Math.abs(w - this.pillW) > 0.5) {
      this.pillW = w;
      this.bg.clear();
      this.bg.fillStyle(0x000000, 0.25).fillRoundedRect(left, -h / 2 + 3, w, h, h / 2);
      this.bg.fillStyle(PALETTE.tray, 0.88).fillRoundedRect(left, -h / 2, w, h, h / 2);
      this.bg.lineStyle(2, 0xffffff, 0.12).strokeRoundedRect(left, -h / 2, w, h, h / 2);
      this.lastBar = -1;
    }
  }

  private drawBar(progress: number): void {
    const w = this.pillW;
    const h = this.pillH;
    const barW = w - h * 0.9;
    const x = -barW / 2;
    const y = h / 2 - 7;
    this.bar.clear();
    this.bar.fillStyle(0x000000, 0.35).fillRoundedRect(x, y, barW, 4, 2);
    const fill = barW * progress;
    if (fill > 1) this.bar.fillStyle(progress > PULSE_FROM ? 0xff8a3d : PALETTE.gold).fillRoundedRect(x, y, fill, 4, 2);
  }

  /** A calm warm pulse on the time in the last stretch of the day. */
  private updatePulse(progress: number): void {
    const late = progress > PULSE_FROM;
    if (late && !this.pulse) {
      this.timeText.setColor('#ffb066');
      this.pulse = this.scene.tweens.add({
        targets: this.timeText, scale: { from: 1, to: 1.07 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    } else if (!late && this.pulse) {
      this.pulse.remove();
      this.pulse = null;
      this.timeText.setScale(1).setColor(PALETTE.money);
    }
  }

  static createSunTexture(textures: Phaser.Textures.TextureManager): void {
    makeCanvasTexture(textures, SUN_KEY, 48, 48, (ctx) => {
      ctx.translate(24, 24);
      ctx.strokeStyle = '#fff3b0';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 15, Math.sin(a) * 15);
        ctx.lineTo(Math.cos(a) * 21, Math.sin(a) * 21);
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, 13);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#ffffff');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(59,38,22,0.55)';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }
}
