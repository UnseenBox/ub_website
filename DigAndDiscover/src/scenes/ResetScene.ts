import Phaser from 'phaser';
import { BUTTON_COLORS, PALETTE, outlinedStyle, textStyle } from '../config/Theme';
import { wipeAllData } from '../systems/ProgressSystem';
import { sfx } from '../audio/Sfx';
import { Button, type ButtonColors } from '../ui/Button';

const CARD_W = 440;
const PAD = 26;
const INK = '#3b2616';
const RED: ButtonColors = { face: 0xd9453a, lip: 0x9a2a22, text: '#ffffff' };
/** The erase button stays grey for a moment so a double tap on "Start over" cannot confirm it. */
const ARM_DELAY_MS = 800;

/**
 * "Start over?" - the only way to erase everything. It sits above the Goals card, asks once, and on
 * "Erase everything" deletes every save and setting this game has stored in the browser and reloads the
 * page, so the next game starts from the Old Shovel with no money. There is no keyboard shortcut.
 */
export class ResetScene extends Phaser.Scene {
  private dim!: Phaser.GameObjects.Rectangle;
  private card!: Phaser.GameObjects.Container;
  private cardH = 360;
  private erasing = false;

  constructor() {
    super('Reset');
  }

  init(): void {
    this.erasing = false;
  }

  create(): void {
    const { width: w, height: h } = this.scale;
    this.dim = this.add.rectangle(0, 0, w, h, 0x120a04, 0).setOrigin(0, 0).setInteractive();
    this.tweens.add({ targets: this.dim, fillAlpha: 0.8, duration: 200 });
    // Nothing below the card may be used while it is open.
    for (const type of [Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, Phaser.Input.Events.GAMEOBJECT_POINTER_UP]) {
      this.dim.on(type, (p: Phaser.Input.Pointer) => {
        const event = p.event as unknown as { stopPropagation?: () => void } | undefined;
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
      });
    }

    this.card = this.add.container(0, 0);
    this.buildCard();
    this.fit();
    const scale = this.card.scale;
    this.card.setAlpha(0).setScale(scale * 0.9);
    this.tweens.add({ targets: this.card, alpha: 1, scale, duration: 240, ease: 'Back.easeOut' });

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    });
  }

  private buildCard(): void {
    const panel = this.add.graphics();
    const content = this.add.container(0, 0);
    this.card.add([panel, content]);

    const title = this.add.text(CARD_W / 2, 40, 'Start over?', outlinedStyle(34)).setOrigin(0.5);
    const rw = title.width + 60;
    const ribbon = this.add.graphics();
    ribbon.fillStyle(0x000000, 0.25).fillRoundedRect(CARD_W / 2 - rw / 2, 20, rw, 54, 14);
    ribbon.fillStyle(0xc0392b).fillRoundedRect(CARD_W / 2 - rw / 2, 14, rw, 54, 14);
    ribbon.fillStyle(0xffffff, 0.22).fillRoundedRect(CARD_W / 2 - rw / 2 + 8, 18, rw - 16, 16, 8);
    ribbon.lineStyle(3, 0x3b2616, 0.9).strokeRoundedRect(CARD_W / 2 - rw / 2, 14, rw, 54, 14);
    content.add([ribbon, title]);
    let y = 92;

    const body = this.add
      .text(
        CARD_W / 2, y,
        'This erases ALL your progress on this device: money, tools, upgrades, skills, level, collection and settings.\n\nYou start again with the Old Shovel and $0. This cannot be undone.',
        textStyle(18, INK, { align: 'center', wordWrap: { width: CARD_W - PAD * 2 } }),
      )
      .setOrigin(0.5, 0);
    content.add(body);
    y += Math.ceil(body.height) + 24;

    const keep = new Button(this, { width: 280, height: 60, label: 'Keep playing', fontSize: 26, colors: BUTTON_COLORS.orange, onClick: () => this.cancel() });
    keep.setPosition(CARD_W / 2, y + 30);
    content.add(keep);
    y += 74;

    const erase = new Button(this, { width: 280, height: 52, label: 'Erase everything', fontSize: 22, colors: RED, onClick: () => this.erase(erase) });
    erase.setEnabled(false);
    this.time.delayedCall(ARM_DELAY_MS, () => erase.setEnabled(true));
    erase.setPosition(CARD_W / 2, y + 26);
    content.add(erase);
    y += 64;

    this.cardH = y + 10;
    const ph = this.cardH - 8;
    panel.fillStyle(0x000000, 0.3).fillRoundedRect(4, 12, CARD_W, ph, 24);
    panel.fillStyle(0xfff3dc).fillRoundedRect(0, 4, CARD_W, ph, 24);
    panel.lineStyle(4, 0x3b2616, 0.9).strokeRoundedRect(0, 4, CARD_W, ph, 24);
    panel.lineStyle(2, PALETTE.gold, 0.5).strokeRoundedRect(8, 12, CARD_W - 16, ph - 16, 18);
    this.card.sendToBack(panel);
  }

  private cancel(): void {
    if (this.erasing) return;
    sfx.click();
    this.scene.stop();
  }

  private erase(button: Button): void {
    if (this.erasing || !button.isEnabled) return;
    this.erasing = true;
    sfx.click();
    wipeAllData();
    // A reload is the cleanest way to a game with no memory of the old one (tools, skills, finds, scene state).
    window.location.reload();
  }

  private fit(): void {
    const { width: w, height: h } = this.scale;
    const s = Math.min(1.15, (w - 16) / CARD_W, (h - 16) / this.cardH);
    this.card.setScale(s);
    this.card.setPosition((w - CARD_W * s) / 2, (h - this.cardH * s) / 2);
  }

  private onResize(): void {
    const { width: w, height: h } = this.scale;
    this.dim.setSize(w, h);
    (this.dim.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setTo(0, 0, w, h);
    this.fit();
  }
}
