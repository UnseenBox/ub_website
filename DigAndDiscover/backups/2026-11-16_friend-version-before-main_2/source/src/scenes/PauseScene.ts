import Phaser from 'phaser';
import { BUTTON_COLORS, PALETTE } from '../config/Theme';
import { FEATURES } from '../config/GameConfig';
import { state } from '../core/GameState';
import { uiIcon } from '../art/UiIcons';
import { sfx } from '../audio/Sfx';
import { Button } from '../ui/Button';
import type { HudScene } from './HudScene';

const CARD_W = 400;
const CARD_H = 360;

/**
 * The pause menu: the game holds still. A big pause badge, a row of round shortcuts
 * (sound, store, goals) and one big play button. No words.
 */
export class PauseScene extends Phaser.Scene {
  private dim!: Phaser.GameObjects.Rectangle;
  private card!: Phaser.GameObjects.Container;
  private pausedKey: string | null = null;
  private closing = false;
  private soundG!: Phaser.GameObjects.Graphics;

  constructor() {
    super('Pause');
  }

  init(): void {
    this.closing = false;
  }

  create(): void {
    const { width: w, height: h } = this.scale;
    this.pausedKey = state.mode === 'dig' ? 'Dig' : 'Workshop';
    if (this.scene.isActive(this.pausedKey)) this.scene.pause(this.pausedKey);
    else this.pausedKey = null;

    this.dim = this.add.rectangle(0, 0, w, h, 0x120a04, 0).setOrigin(0, 0).setInteractive();
    this.tweens.add({ targets: this.dim, fillAlpha: 0.7, duration: 220 });

    this.card = this.add.container(0, 0);
    this.buildCard();
    this.fit();
    const scale = this.card.scale;
    this.card.setAlpha(0).setScale(scale * 0.9);
    this.tweens.add({ targets: this.card, alpha: 1, scale, duration: 240, ease: 'Back.easeOut' });

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      if (this.pausedKey && this.scene.isPaused(this.pausedKey)) this.scene.resume(this.pausedKey);
      this.pausedKey = null;
    });
    this.input.keyboard?.on('keydown-ESC', () => this.close());
    this.input.keyboard?.on('keydown-P', () => this.close());
  }

  private buildCard(): void {
    const panel = this.add.graphics();
    panel.fillStyle(0x000000, 0.3).fillRoundedRect(4, 12, CARD_W, CARD_H, 28);
    panel.fillStyle(0xfff3dc).fillRoundedRect(0, 4, CARD_W, CARD_H - 8, 28);
    panel.lineStyle(4, 0x3b2616, 0.9).strokeRoundedRect(0, 4, CARD_W, CARD_H - 8, 28);
    panel.lineStyle(2, PALETTE.gold, 0.5).strokeRoundedRect(8, 12, CARD_W - 16, CARD_H - 24, 22);
    this.card.add(panel);

    // The big badge sits on the top edge of the card.
    const badge = this.add.image(CARD_W / 2, 36, 'ui-pause');
    badge.setScale(118 / Math.max(badge.width, badge.height));
    this.card.add(badge);

    // Round shortcuts.
    const y = 150;
    const xs = FEATURES.goals ? [CARD_W * 0.14, CARD_W * 0.38, CARD_W * 0.62, CARD_W * 0.86] : [CARD_W * 0.2, CARD_W * 0.5, CARD_W * 0.8];
    this.soundG = this.add.graphics();
    const sound = this.add.container(xs[0], y, [this.soundG]).setSize(76, 76).setInteractive({ useHandCursor: true });
    this.drawSound();
    sound.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      sfx.setMuted(!sfx.muted);
      sfx.click();
      this.drawSound();
    });
    this.card.add(sound);
    this.shortcut(xs[1], y, 'ui-store', 'Store');
    this.shortcut(xs[2], y, 'ui-workshop', 'Workshop');
    if (FEATURES.goals) this.shortcut(xs[3], y, 'ui-target', 'Goals');

    const play = new Button(this, { width: 260, height: 84, label: '', icon: uiIcon('play'), ghost: true, iconScale: 1.25, fontSize: 40, colors: BUTTON_COLORS.green, onClick: () => this.close() });
    play.setPosition(CARD_W / 2, 270).setPulse(true);
    this.card.add(play);
  }

  /** A big picture button that closes the menu and opens another card. */
  private shortcut(x: number, y: number, key: string, scene: 'Store' | 'Goals' | 'Workshop'): void {
    const img = this.add.image(0, 0, key);
    img.setScale(76 / Math.max(img.width, img.height));
    const c = this.add.container(x, y, [img]).setSize(80, 80).setInteractive({ useHandCursor: true });
    c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      if (this.closing) return;
      sfx.click();
      this.close();
      this.time.delayedCall(260, () => {
        // The workshop is a place, not a card: the HUD takes the player there.
        if (scene === 'Workshop') (this.scene.get('Hud') as HudScene).gotoWorkshop();
        else this.scene.launch(scene);
      });
    });
    this.card.add(c);
  }

  /** A speaker, with a cross over it while the sound is off. */
  private drawSound(): void {
    const g = this.soundG;
    const r = 36;
    g.clear();
    g.fillStyle(0x000000, 0.25).fillCircle(0, 3, r);
    g.fillStyle(PALETTE.tray, 0.95).fillCircle(0, 0, r);
    g.lineStyle(3, PALETTE.gold, 0.9).strokeCircle(0, 0, r - 1);
    const s = r * 0.42;
    g.fillStyle(0xffffff);
    g.fillRect(-s * 1.1, -s * 0.4, s * 0.6, s * 0.8);
    g.fillTriangle(-s * 0.6, -s * 0.4, s * 0.15, -s * 1.05, s * 0.15, s * 1.05);
    g.fillTriangle(-s * 0.6, -s * 0.4, s * 0.15, s * 1.05, -s * 0.6, s * 0.4);
    if (sfx.muted) {
      g.lineStyle(5, 0xff6b4a);
      g.lineBetween(s * 0.45, -s * 0.5, s * 1.25, s * 0.5);
      g.lineBetween(s * 0.45, s * 0.5, s * 1.25, -s * 0.5);
    } else {
      g.lineStyle(4, 0xffffff);
      g.beginPath();
      g.arc(s * 0.2, 0, s * 0.6, -0.8, 0.8);
      g.strokePath();
      g.beginPath();
      g.arc(s * 0.2, 0, s * 1.05, -0.8, 0.8);
      g.strokePath();
    }
  }

  private fit(): void {
    const { width: w, height: h } = this.scale;
    const s = Math.min(1.2, (w - 16) / CARD_W, (h - 16) / CARD_H);
    this.card.setScale(s);
    this.card.setPosition((w - CARD_W * s) / 2, (h - CARD_H * s) / 2);
  }

  private onResize(): void {
    const { width: w, height: h } = this.scale;
    this.dim.setSize(w, h);
    (this.dim.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setTo(0, 0, w, h);
    this.fit();
  }

  private close(): void {
    if (this.closing) return;
    this.closing = true;
    sfx.click();
    this.tweens.add({ targets: this.card, alpha: 0, scale: this.card.scale * 0.9, duration: 160, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: this.dim, fillAlpha: 0, duration: 180, onComplete: () => this.scene.stop() });
  }
}
