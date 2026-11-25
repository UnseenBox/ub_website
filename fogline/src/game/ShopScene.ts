import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { STATUS_TEXT, ShopCategory, ShopItem } from '../systems/Shop';
import { MODS } from '../data/upgrades';
import { weaponById } from '../data/weapons';
import { ITEM_ICON, WEAPON_ICON, icon, iconWidth, type IconName } from '../ui/icons';
import { BODY, C, STENCIL, box, chip, css, pushButton, text, type Part } from '../ui/kit';
import { backdrop } from '../rendering/Margins';
import { VIEW } from './config';
import type { GameScene } from './GameScene';
import { isTouchDevice } from './touchControls';

const ROWS: { cat: ShopCategory; icon: IconName }[] = [
  { cat: 'weapons', icon: 'carbine' },
  { cat: 'mods', icon: 'bullet' },
  { cat: 'support', icon: 'heli' },
  { cat: 'bunker', icon: 'shield' },
];

const SHORT: Record<string, string> = { gunship: 'GUNSHIP', orbital: 'LANCE', nuke: 'NUKE', repair: 'REPAIR', wall: 'SHUTTERS' };

/** An item's picture and its one- or two-word name. */
function face(item: ShopItem): { icon: IconName; name: string } {
  const [kind, id] = item.id.split(':');
  if (kind === 'weapon') return { icon: WEAPON_ICON[id], name: weaponById(id).shortName };
  if (kind === 'ammo') return { icon: WEAPON_ICON[id], name: `+${weaponById(id).ammoPack!.rounds}` };
  if (kind === 'upgrade') return { icon: 'shield', name: 'REINFORCE' };
  return { icon: ITEM_ICON[id], name: SHORT[id] ?? MODS.find((m) => m.id === id)?.short ?? item.name.toUpperCase() };
}

interface Card {
  item: ShopItem;
  bg: Phaser.GameObjects.Rectangle;
  price: Phaser.GameObjects.Text;
  crate: Phaser.GameObjects.Image;
  stock: Phaser.GameObjects.Text;
  state: Phaser.GameObjects.Image;
  w: number;
  x: number;
  y: number;
  container: Phaser.GameObjects.Container;
}

const TILE_H = 104;

/** Armory overlay. Combat is paused underneath while it is open. */
export class ShopScene extends Phaser.Scene {
  private game_!: GameScene;
  private cards: Card[] = [];
  private cashText!: Phaser.GameObjects.Text;
  private info!: Phaser.GameObjects.Text;
  private infoBox!: Phaser.GameObjects.Rectangle;
  private infoTitle!: Phaser.GameObjects.Text;
  private msg!: Phaser.GameObjects.Text;
  private msgLeft = 0;
  private canDeploy = false;

  constructor() {
    super('Shop');
  }

  create(): void {
    this.game_ = this.scene.get('Game') as GameScene;
    this.cards = [];
    this.canDeploy = false;
    this.input.setDefaultCursor('default');
    const rows = ROWS.map((r) => ({ ...r, items: this.game_.catalog.filter((i) => i.category === r.cat) })).filter((r) => r.items.length);
    // The panel is only as tall as what is for sale.
    const W = 1040, H = 88 + rows.length * (TILE_H + 10) + 150, x0 = (VIEW.width - W) / 2, y0 = Math.max(10, (VIEW.height - H) / 2);
    backdrop(this, 0x000000, 0.65).setInteractive();
    box(this, x0, y0, W, H, C.night, C.lineStrong);
    icon(this, 'cart', x0 + 44, y0 + 42, 40, C.text);
    text(this, x0 + 76, y0 + 42, 'ARMORY', { size: 38, font: STENCIL, color: C.title }).setOrigin(0, 0.5);
    this.cashText = text(this, x0 + W - 24, y0 + 42, '', { size: 36, font: STENCIL, color: C.cash }).setOrigin(1, 0.5);

    rows.forEach((row, ri) => {
      const y = y0 + 80 + ri * (TILE_H + 10);
      const size = iconWidth(row.icon, 1) > 1 ? 24 : 34;
      icon(this, row.icon, x0 + 48, y + TILE_H / 2, size, C.dim);
      const w = Math.min(136, Math.floor((W - 112) / row.items.length) - 10);
      row.items.forEach((item, i) => this.makeCard(item, x0 + 92 + i * (w + 10), y, w));
    });

    // details of whatever is under the pointer
    const iy = y0 + 84 + rows.length * (TILE_H + 10);
    this.infoBox = box(this, x0 + 20, iy, W - 40, 56, C.tile, C.lineSoft, 1).setVisible(false);
    this.infoTitle = text(this, x0 + 36, iy + 6, '', { size: 19, font: STENCIL });
    this.info = text(this, x0 + 36, iy + 31, '', { size: 14, font: BODY, color: C.soft });
    this.msg = text(this, x0 + W - 36, iy + 28, '', { size: 22, font: STENCIL, color: C.red }).setOrigin(1, 0.5);

    const by = y0 + H - 38;
    const touch = isTouchDevice();
    const back = pushButton(this, 0, by, { h: 50, size: 24, icon: 'back', label: 'RETURN', key: touch ? undefined : 'SPACE', onClick: () => this.close() });
    back.c.x = x0 + 20 + back.w / 2;
    const waves = this.game_.waves;
    if (waves.canStartNext && waves.remaining === 0) {
      this.canDeploy = true;
      const go = pushButton(this, 0, by, { h: 50, size: 24, icon: 'play', label: `WAVE ${waves.wave + 1}`, key: touch ? undefined : 'ENTER', tone: 'go', onClick: () => this.close(true) });
      go.c.x = x0 + W - 20 - go.w / 2;
    }
    const facts: Part[] = [
      chip(this, { icon: 'wave', text: waves.endless ? `${waves.wave}` : `${waves.wave}/${waves.totalWaves}`, size: 18 }),
      chip(this, { icon: 'shield', iconColor: C.health, text: `${Math.ceil(this.game_.bunker.health)}`, size: 18 }),
    ];
    let fx = VIEW.centerX - (facts[0].w + facts[1].w + 10) / 2;
    for (const f of facts) {
      f.c.setPosition(fx, by - f.h / 2);
      fx += f.w + 10;
    }

    const kb = this.input.keyboard!;
    kb.on('keydown-SPACE', () => this.close());
    kb.on('keydown-ESC', () => this.close());
    kb.on('keydown-ENTER', () => { if (this.canDeploy) this.close(true); });
    this.refresh();
  }

  private makeCard(item: ShopItem, x: number, y: number, w: number): void {
    const f = face(item);
    const h = TILE_H;
    const bg = this.add.rectangle(0, 0, w, h, C.raised).setOrigin(0).setStrokeStyle(2, C.lineReward);
    const size = iconWidth(f.icon, 1) > 1 ? Math.min(30, (w - 24) / 2) : 34;
    const picture = icon(this, f.icon, w / 2, 33, size, C.iconTone);
    const name = text(this, w / 2, 64, f.name, { size: 14, bold: true, color: C.soft }).setOrigin(0.5);
    if (name.width > w - 8) name.setScale((w - 8) / name.width);
    const key = text(this, 6, 3, item.key === '—' ? '' : item.key, { size: 12, color: C.muted, bold: true });
    const stock = text(this, w - 6, 3, '', { size: 12, color: C.text, bold: true }).setOrigin(1, 0);
    const crate = icon(this, 'cash', 0, h - 18, 20, C.brass);
    const price = text(this, 0, h - 18, '', { size: 21, font: STENCIL }).setOrigin(0, 0.5);
    const state = icon(this, 'check', w / 2, h - 18, 24, C.ok, { stroke: 2.6 });
    // No setSize: the tile is drawn from its top left, and a sized container would centre the hit area.
    const c = this.add.container(x, y, [bg, picture, name, key, stock, crate, price, state]);
    c.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    const card: Card = { item, bg, price, crate, stock, state, w, x, y, container: c };
    c.on('pointerover', () => {
      bg.setStrokeStyle(2, C.brass);
      this.infoBox.setVisible(true);
      this.infoTitle.setText(item.name.toUpperCase());
      this.info.setText(item.description);
      audio.play('ui_hover', { volume: 0.4 });
    });
    c.on('pointerout', () => bg.setStrokeStyle(2, C.lineReward));
    c.on('pointerdown', () => this.buy(card));
    this.cards.push(card);
  }

  private buy(card: Card): void {
    const st = card.item.status();
    if (st !== 'ok') {
      audio.play('deny', { volume: 0.6 });
      const need = card.item.price() - this.game_.economy.cash;
      this.flashMsg(st === 'cash' ? `NEED $${need} MORE` : STATUS_TEXT[st], css(C.red));
      this.tweens.add({ targets: card.container, x: card.x + 6, duration: 40, yoyo: true, repeat: 2, onComplete: () => card.container.setX(card.x) });
      return;
    }
    const price = card.item.price();
    if (card.item.buy()) {
      audio.play('buy', { volume: 0.8 });
      this.flashMsg(`−$${price}`, css(C.green));
      card.bg.setFillStyle(C.buyFill);
      this.tweens.addCounter({ from: 0, to: 1, duration: 260, onComplete: () => card.bg.setFillStyle(C.raised) });
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
      const priced = st === 'ok' || st === 'cash' || st === 'needs';
      c.price.setText(priced ? c.item.price().toLocaleString('en-US') : st === 'locked' ? c.item.stock().replace('CLEAR ', '') : st === 'full' ? 'FULL' : '');
      c.price.setColor(css(st === 'cash' ? C.red : st === 'ok' ? C.cash : C.dim));
      c.crate.setVisible(priced);
      const width = (priced ? 24 : 0) + c.price.width;
      c.crate.x = c.w / 2 - width / 2 + 9;
      c.price.x = c.w / 2 - width / 2 + (priced ? 24 : 0);
      c.state.setVisible(st === 'owned' || st === 'maxed');
      // The stock line says how many or what level; "owned" and "locked" already show as pictures.
      const stock = c.item.stock();
      c.stock.setText(st === 'owned' || st === 'locked' || stock === 'OWNED' || stock.startsWith('CLEAR') ? '' : stock.replace(' RES', ''));
      c.container.setAlpha(st === 'ok' ? 1 : st === 'owned' || st === 'maxed' ? 0.75 : 0.6);
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
