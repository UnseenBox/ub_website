import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { STATUS_TEXT, ShopCategory, ShopItem } from '../systems/Shop';
import { MONO, STENCIL, button } from '../ui/widgets';
import { VIEW } from './config';
import type { GameScene } from './GameScene';

const COLUMNS: { cat: ShopCategory; title: string }[] = [
  { cat: 'weapons', title: 'WEAPONS & AMMO' },
  { cat: 'mods', title: 'AMMO MODS  [5-8]' },
  { cat: 'support', title: 'SUPPORT  [A S D]' },
  { cat: 'bunker', title: 'BUNKER  [W E]' },
];

interface Card {
  item: ShopItem;
  bg: Phaser.GameObjects.Rectangle;
  price: Phaser.GameObjects.Text;
  stock: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
  x: number;
  y: number;
  container: Phaser.GameObjects.Container;
}

/** Armory overlay. Combat is paused underneath while it is open. */
export class ShopScene extends Phaser.Scene {
  private game_!: GameScene;
  private cards: Card[] = [];
  private cashText!: Phaser.GameObjects.Text;
  private info!: Phaser.GameObjects.Text;
  private infoTitle!: Phaser.GameObjects.Text;
  private msg!: Phaser.GameObjects.Text;
  private msgLeft = 0;
  private deployBtn?: Phaser.GameObjects.Container;

  constructor() {
    super('Shop');
  }

  create(): void {
    this.game_ = this.scene.get('Game') as GameScene;
    this.cards = [];
    this.input.setDefaultCursor('default');
    const W = 1100, H = 560, x0 = (VIEW.width - W) / 2, y0 = 60;
    this.add.rectangle(0, 0, VIEW.width, VIEW.height, 0x000000, 0.62).setOrigin(0).setInteractive();
    this.add.rectangle(x0, y0, W, H, 0x1c1d1c, 0.97).setOrigin(0).setStrokeStyle(2, 0x050505);
    this.add.rectangle(x0, y0, W, 4, 0x5a5c58).setOrigin(0);
    this.add.rectangle(x0, y0 + 4, W, 3, 0x7a6420).setOrigin(0);
    this.add.text(x0 + 18, y0 + 18, 'ARMORY', { fontFamily: STENCIL, fontSize: '34px', color: '#e0dcc0', stroke: '#000', strokeThickness: 4 });
    this.add.text(x0 + 150, y0 + 32, 'REQUISITION TERMINAL · COMBAT PAUSED', { fontFamily: MONO, fontSize: '12px', color: '#8a8a76' });
    this.cashText = this.add.text(x0 + W - 18, y0 + 16, '', { fontFamily: STENCIL, fontSize: '32px', color: '#c8d890', stroke: '#000', strokeThickness: 4 }).setOrigin(1, 0);

    const colW = 262, gap = 9, top = y0 + 74;
    COLUMNS.forEach((col, ci) => {
      const cx = x0 + 16 + ci * (colW + gap);
      this.add.rectangle(cx, top, colW, 20, 0x0e0f0e).setOrigin(0);
      this.add.text(cx + 6, top + 10, col.title, { fontFamily: MONO, fontSize: '11px', color: '#b0ac90' }).setOrigin(0, 0.5);
      const items = this.game_.catalog.filter((i) => i.category === col.cat);
      items.forEach((item, ri) => this.makeCard(item, cx, top + 26 + ri * 56, colW));
    });

    // description bar
    const iy = y0 + H - 96;
    this.add.rectangle(x0 + 16, iy, W - 32, 46, 0x0e0f0e).setOrigin(0).setStrokeStyle(1, 0x3a3c38);
    this.infoTitle = this.add.text(x0 + 26, iy + 6, 'Hover an item for details. Click to buy.', { fontFamily: STENCIL, fontSize: '16px', color: '#d8d4bc' });
    this.info = this.add.text(x0 + 26, iy + 26, '', { fontFamily: MONO, fontSize: '12px', color: '#a8a890' });
    this.msg = this.add.text(x0 + W - 26, iy + 23, '', { fontFamily: STENCIL, fontSize: '18px', color: '#ff7050', stroke: '#000', strokeThickness: 3 }).setOrigin(1, 0.5);

    const by = y0 + H - 28;
    button(this, x0 + 160, by, 280, 36, 'RETURN TO LINE  [SPACE]', () => this.close(), 10, 0x6a7a8a);
    const waves = this.game_.waves;
    if (waves.canStartNext && waves.remaining === 0) {
      this.deployBtn = button(this, x0 + W - 170, by, 300, 36, `DEPLOY WAVE ${waves.wave + 1}  [ENTER]`, () => this.close(true), 10, 0xc84030);
    }
    this.add.text(VIEW.centerX, by, `WAVE ${waves.wave}/${waves.totalWaves}  ·  BUNKER ${Math.ceil(this.game_.bunker.health)}/${this.game_.bunker.max}`, {
      fontFamily: MONO, fontSize: '12px', color: '#8a8a76',
    }).setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.on('keydown-SPACE', () => this.close());
    kb.on('keydown-ESC', () => this.close());
    kb.on('keydown-ENTER', () => { if (this.deployBtn) this.close(true); });
    this.refresh();
  }

  private makeCard(item: ShopItem, x: number, y: number, w: number): void {
    const h = 52;
    const bg = this.add.rectangle(0, 0, w, h, 0x262826).setOrigin(0).setStrokeStyle(1, 0x0a0a0a);
    const iconFrame = this.add.rectangle(4, 4, 70, h - 8, 0x101110).setOrigin(0);
    const tex = this.textures.get(item.icon).getSourceImage() as HTMLCanvasElement;
    const icon = this.add.image(39, h / 2, item.icon).setScale(Math.min(64 / tex.width, (h - 12) / tex.height) * (tex.width > 60 ? 1 : 0.9));
    const key = this.add.text(6, 4, item.key, { fontFamily: STENCIL, fontSize: '12px', color: '#e0d8b0', stroke: '#000', strokeThickness: 2 });
    const name = this.add.text(82, 6, item.name, { fontFamily: STENCIL, fontSize: '15px', color: '#e0dcc0', wordWrap: { width: w - 90 } });
    const price = this.add.text(82, h - 6, '', { fontFamily: MONO, fontSize: '14px', color: '#c8d890' }).setOrigin(0, 1);
    const stock = this.add.text(w - 6, h - 6, '', { fontFamily: MONO, fontSize: '12px', color: '#a8a890' }).setOrigin(1, 1);
    const status = this.add.text(w - 6, 6, '', { fontFamily: MONO, fontSize: '11px', color: '#ff8060' }).setOrigin(1, 0);
    const c = this.add.container(x, y, [bg, iconFrame, icon, key, name, price, stock, status]).setSize(w, h);
    c.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    const card: Card = { item, bg, price, stock, status, x, y, container: c };
    c.on('pointerover', () => {
      bg.setStrokeStyle(2, 0xc8a040);
      this.infoTitle.setText(item.name);
      this.info.setText(item.description);
      audio.play('ui_hover', { volume: 0.4 });
    });
    c.on('pointerout', () => bg.setStrokeStyle(1, 0x0a0a0a));
    c.on('pointerdown', () => this.buy(card));
    this.cards.push(card);
  }

  private buy(card: Card): void {
    const st = card.item.status();
    if (st !== 'ok') {
      audio.play('deny', { volume: 0.6 });
      const need = card.item.price() - this.game_.economy.cash;
      this.flashMsg(st === 'cash' ? `NEED $${need} MORE` : STATUS_TEXT[st], '#ff7050');
      this.tweens.add({ targets: card.container, x: card.x + 6, duration: 40, yoyo: true, repeat: 2, onComplete: () => card.container.setX(card.x) });
      return;
    }
    const price = card.item.price();
    if (card.item.buy()) {
      audio.play('buy', { volume: 0.8 });
      this.flashMsg(`PURCHASED  −$${price}`, '#a8e090');
      card.bg.setFillStyle(0x3a5a30);
      this.tweens.addCounter({ from: 0, to: 1, duration: 260, onComplete: () => card.bg.setFillStyle(0x262826) });
      this.refresh();
    }
  }

  private flashMsg(text: string, color: string): void {
    this.msg.setText(text).setColor(color).setAlpha(1);
    this.msgLeft = 1.6;
  }

  private refresh(): void {
    this.cashText.setText(`$${this.game_.economy.cash.toLocaleString('en-US')}`);
    for (const c of this.cards) {
      const st = c.item.status();
      c.price.setText(st === 'owned' || st === 'maxed' ? '' : `$${c.item.price().toLocaleString('en-US')}`);
      c.price.setColor(st === 'cash' ? '#c86050' : '#c8d890');
      c.stock.setText(c.item.stock());
      c.status.setText(STATUS_TEXT[st]);
      c.status.setColor(st === 'owned' || st === 'maxed' ? '#a8c890' : '#ff8060');
      c.container.setAlpha(st === 'ok' ? 1 : st === 'owned' || st === 'maxed' ? 0.7 : 0.82);
    }
  }

  override update(_t: number, dms: number): void {
    if (this.msgLeft > 0) {
      this.msgLeft -= dms / 1000;
      this.msg.setAlpha(Math.min(1, this.msgLeft / 0.4));
    }
  }

  private close(deploy = false): void {
    audio.play('shop_close', { volume: 0.7 });
    this.scene.stop();
    this.game_.resumeFromOverlay();
    this.game_.input.setDefaultCursor('none');
    if (deploy) this.game_.startNextWave();
  }
}
