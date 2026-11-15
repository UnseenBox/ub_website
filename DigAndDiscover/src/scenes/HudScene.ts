import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/GameConfig';
import { BUTTON_COLORS, PALETTE, outlinedStyle } from '../config/Theme';
import { EVT, state, subscribe } from '../core/GameState';
import type { DaySummary } from '../core/GameState';
import type { GameMode, Rock } from '../core/types';
import { iconScale, rockKeys } from '../art/RockArt';
import { sfx } from '../audio/Sfx';
import { Button } from '../ui/Button';
import type { StoreScene } from './StoreScene';
import { InventorySlot } from '../ui/InventorySlot';
import { DepthGauge } from '../ui/DepthGauge';
import { ICON_STAR } from '../art/IconArt';
import { uiIcon } from '../art/UiIcons';
import { FindCard } from '../ui/FindCard';
import type { FindDef } from '../data/finds';
import type { FindItem } from '../systems/FindSystem';
import { portal } from '../ads/Portal';
import { TRAY_ART, computeLayout, slotCenter, type Layout } from '../ui/layout';
import { MoneyCounter, formatMoney } from '../ui/MoneyCounter';
import { StaminaBar } from '../ui/StaminaBar';
import { Toast } from '../ui/Toast';

const COIN_POOL = 14;
const FLOAT_POOL = 4;
const CLOSING_BANNER_DURATION = 1100;

/**
 * Always-on overlay: money, stats, mute, stamina, bag and the main action
 * button. Also owns scene switching between the dig site and the workshop.
 */
/** Scales a picture so its longer side is `size` field/screen pixels. */
function fitIcon(img: Phaser.GameObjects.Image, size: number): void {
  img.setScale(size / Math.max(img.width, img.height, 1));
}

export class HudScene extends Phaser.Scene {
  private L!: Layout;
  private tray!: Phaser.GameObjects.Image;
  private trayBadge!: Phaser.GameObjects.Image;
  private trayBolt!: Phaser.GameObjects.Graphics;
  /** Craft medallion: glow while a trip is worth it, dark disc while locked, cover with a picture in other modes. */
  private craftGlow!: Phaser.GameObjects.Image;
  private craftDim!: Phaser.GameObjects.Graphics;
  private craftCover!: Phaser.GameObjects.Graphics;
  private craftCount!: Phaser.GameObjects.Container;
  private craftCountBg!: Phaser.GameObjects.Graphics;
  private craftCountText!: Phaser.GameObjects.Text;
  private craftTween: Phaser.Tweens.Tween | null = null;
  private stamina!: StaminaBar;
  private slots: InventorySlot[] = [];
  private action!: Button;
  private money!: MoneyCounter;
  private mute!: Phaser.GameObjects.Container;
  private storeBtn!: Phaser.GameObjects.Container;
  private storeIcon!: Phaser.GameObjects.Graphics;
  private storeImg!: Phaser.GameObjects.Image;
  private pauseImg!: Phaser.GameObjects.Image;
  private storeDeal = false;
  private iconR = 20;
  private goalsBtn!: Phaser.GameObjects.Container;
  private goalsBg!: Phaser.GameObjects.Graphics;
  private goalsIcon!: Phaser.GameObjects.Image;
  private goalsLevel!: Phaser.GameObjects.Text;
  private ledgerBtn!: Phaser.GameObjects.Container;
  private ledgerBg!: Phaser.GameObjects.Graphics;
  private ledgerIcon!: Phaser.GameObjects.Image;
  private ledgerBadge!: Phaser.GameObjects.Graphics;
  private ledgerSize = 44;
  private findCard!: FindCard;
  private collectBtn!: Phaser.GameObjects.Container;
  private collectBg!: Phaser.GameObjects.Graphics;
  private collectIcon!: Phaser.GameObjects.Image;
  private collectCount!: Phaser.GameObjects.Text;
  private refillBtn!: Button;
  private userActed = false;
  private lastRelocateCard = -1e9;
  private banner: Phaser.GameObjects.Container | null = null;
  private muteIcon!: Phaser.GameObjects.Graphics;
  private toast!: Toast;
  private depthGauge!: DepthGauge;
  private coins: Phaser.GameObjects.Image[] = [];
  private floats: Phaser.GameObjects.Text[] = [];
  private floatIndex = 0;
  private readonly incoming = new Set<string>();
  private benchRockId: string | null = null;
  private switching = false;
  private closingBanner: Phaser.GameObjects.Container | null = null;
  private closingBannerTween: Phaser.Tweens.Tween | null = null;

  constructor() {
    super('Hud');
  }

  create(): void {
    this.slots = [];
    this.coins = [];
    this.floats = [];
    this.incoming.clear();

    this.tray = this.add.image(0, 0, 'rocks-tray').setOrigin(0, 0);
    // The craft medallion's states, drawn over the picture: a glow, a dark "locked" disc, a cover for other modes.
    this.craftGlow = this.add.image(0, 0, 'soft').setTint(0xffc060).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setVisible(false);
    this.craftDim = this.add.graphics().setVisible(false);
    this.craftCover = this.add.graphics().setVisible(false);
    this.stamina = new StaminaBar(this);
    // The round socket is drawn again above the fill, so the bar appears to run in underneath it.
    const bc = TRAY_ART.badgeCrop;
    this.trayBadge = this.add.image(0, 0, 'rocks-tray').setOrigin(0, 0).setCrop(bc.x, bc.y, bc.w, bc.h);
    this.trayBolt = this.add.graphics();
    for (let i = 0; i < GAME_CONFIG.inventory.slots; i++) {
      this.slots.push(new InventorySlot(this, () => this.onSlotPressed(i)));
    }
    this.action = new Button(this, {
      width: 220, height: 56, label: '', fontSize: 22, colors: BUTTON_COLORS.orange, ghost: true,
      onClick: () => this.onAction(),
    });
    // Rock count on the lower edge of the medallion.
    this.craftCountBg = this.add.graphics();
    this.craftCountText = this.add.text(0, 0, '', outlinedStyle(16)).setOrigin(0.5);
    this.craftCount = this.add.container(0, 0, [this.craftCountBg, this.craftCountText]).setVisible(false);
    this.money = new MoneyCounter(this, state.economy.money);
    this.buildMuteButton();
    this.buildStoreButton();
    this.buildCollectionButton();
    this.findCard = new FindCard(this);
    this.toast = new Toast(this);
    this.switching = false;
    this.buildLedgerButton();

    this.depthGauge = new DepthGauge(this);
    this.buildGoalsButton();
    this.refillBtn = new Button(this, {
      width: 84, height: 70, label: '', icon: uiIcon('refill'), ghost: true, iconScale: 1, fontSize: 22, colors: BUTTON_COLORS.blue,
      onClick: () => this.watchRefill(),
    });
    this.refillBtn.setVisible(false).setDepth(30);

    for (let i = 0; i < COIN_POOL; i++) this.coins.push(this.add.image(0, 0, 'coin').setVisible(false).setDepth(20));
    for (let i = 0; i < FLOAT_POOL; i++) {
      this.floats.push(this.add.text(0, 0, '', outlinedStyle(30, PALETTE.money)).setOrigin(0.5).setVisible(false).setDepth(21));
    }

    subscribe(this, EVT.inventoryChanged, () => this.refresh());
    subscribe(this, EVT.modeChanged, () => this.refresh());
    subscribe(this, EVT.busyChanged, () => this.refresh());
    subscribe(this, EVT.rockCollected, (rock: Rock, x: number, y: number, scale: number) => this.flyRockToBag(rock, x, y, scale));
    subscribe(this, EVT.placedChanged, (id: string | null) => {
      this.benchRockId = id;
      this.refreshSlots();
    });
    subscribe(this, EVT.sale, (amount: number, x: number, y: number, tier: number) => this.celebrateSale(amount, x, y, tier));
    subscribe(this, EVT.toast, (message: string) => this.toast.show(message));
    subscribe(this, EVT.staminaDenied, () => this.stamina.denied());
    subscribe(this, EVT.dayPhaseChanged, (phase: string) => this.onDayPhaseChanged(phase));
    subscribe(this, EVT.daySummary, (summary: DaySummary) => this.onDaySummary(summary));
    subscribe(this, EVT.dayStarted, (day: number) => this.onDayStarted(day));
    subscribe(this, EVT.layerEntered, (layerIndex: number) => this.onLayerEntered(layerIndex));
    subscribe(this, EVT.progressChanged, () => {
      this.drawGoalsButton(this.iconR);
      this.updateStoreDeal();
    });
    subscribe(this, EVT.moneyChanged, (money: number, _delta: number, earned: boolean) => {
      // Sales count up with the flying coins; rewards and purchases tick right away.
      if (!earned) this.money.countTo(money, 0, 450);
      this.updateStoreDeal();
    });
    subscribe(this, EVT.findFound, (def: FindDef, item: FindItem, first: boolean) => {
      this.findCard.show(def, item, first, this.L.w - 24);
      this.drawCollectionButton(this.iconR);
    });
    subscribe(this, EVT.bedrock, () => this.offerRelocation());
    subscribe(this, EVT.relocated, (deposit: number) => {
      this.drawGoalsButton(this.iconR);
      this.time.delayedCall(1000, () => {
        sfx.newDay();
        this.showCenterBanner(`${deposit}`, '', uiIcon('flag'));
      });
    });
    subscribe(this, EVT.levelUp, (level: number, bonus: number) => this.onLevelUp(level, bonus));
    subscribe(this, EVT.goalDone, (goal: { cash: number; xp: number }) => {
      this.toast.show(goal.cash > 0 ? `+${formatMoney(goal.cash)}` : `+${goal.xp}`, 1800, goal.cash > 0 ? uiIcon('cash') : uiIcon('sparkle'));
      this.tweens.add({ targets: this.goalsBtn, scale: { from: 1.25, to: 1 }, duration: 380, ease: 'Back.easeOut' });
      sfx.coin();
    });
    subscribe(this, EVT.financeChanged, () => this.drawLedgerButton());
    subscribe(this, EVT.gameOver, () => this.onGameOver());
    subscribe(this, EVT.runReset, () => this.onRunReset());
    this.input.once('pointerdown', () => (this.userActed = true));
    this.input.keyboard?.once('keydown', () => (this.userActed = true));

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this));

    const kb = this.input.keyboard;
    if (kb) {
      kb.on('keydown-ENTER', () => this.handleEnterKey());
      kb.on('keydown-ESC', () => this.handleEscKey());
      kb.on('keydown-M', () => this.toggleMute());
      kb.on('keydown-P', () => this.openPause());
      kb.on('keydown-S', () => this.openStore());
      kb.on('keydown-G', () => this.openGoals());
      kb.on('keydown-C', () => this.openCollection());
      kb.on('keydown-L', () => this.openLedger());
      kb.on('keydown', (e: KeyboardEvent) => {
        if (this.storeOpen) return;
        const n = Number(e.key);
        if (n >= 1 && n <= this.slots.length) this.onSlotPressed(n - 1);
      });
    }

    this.onResize();
    this.refresh();
    this.storeDeal = state.storeHasDeal;
    this.drawStoreIcon(this.iconR);
  }

  /** The store or goals card is up: the world and the day clock hold still. */
  private get storeOpen(): boolean {
    return (
      this.scene.isActive('Store') || this.scene.isActive('Goals') || this.scene.isActive('Collection') ||
      this.scene.isActive('Relocate') || this.scene.isActive('Ledger') || this.scene.isActive('GameOver') || this.scene.isActive('Pause')
    );
  }

  private handleEnterKey(): void {
    if (this.storeOpen) return;
    if (state.mode === 'dig' && state.canWork) {
      this.action.trigger();
    }
  }

  private handleEscKey(): void {
    if (this.storeOpen) return;
    if (state.mode === 'workshop' && !state.busy) {
      this.action.trigger();
    } else if (state.mode === 'dig') {
      this.openPause();
    }
  }

  update(_time: number, delta: number): void {
    // Clamp so a long frame (e.g. returning to the tab) never jumps stamina.
    const dt = Math.min(delta, 100);
    const frozen = this.storeOpen || portal.adOpen; // shopping and ads are free time
    if (!frozen) state.tick(dt);
    portal.setPlaying(this.userActed && state.canWork && !frozen && !this.scene.isActive('EndOfDay'));
    this.updateRefillOffer();
    const s = state.stamina;
    this.stamina.setValue(s.value, s.max, s.isRegenerating, dt);

    this.depthGauge.tick(dt);
    this.forceWorkshopTrip();
  }

  /**
   * After closing time any rock still in the bag has to be cut and sold. Once the
   * running animations are done, the player is walked to the workshop to do it.
   */
  private forceWorkshopTrip(): void {
    if (state.day.phase !== 'closing' || state.mode !== 'dig' || this.switching) return;
    if (state.rocksLeft === 0 || state.somethingRunning || this.incoming.size > 0) return;
    if (state.day.closingElapsedMs < GAME_CONFIG.day.closingTripDelayMs) return;
    this.switchMode('workshop');
  }

  // ---------- layout ----------

  private onResize(): void {
    const L = (this.L = computeLayout(this.scale.width, this.scale.height));
    const t = L.tray;
    this.tray.setPosition(t.x, t.y).setDisplaySize(t.w, t.h);
    this.trayBadge.setPosition(t.x, t.y).setScale(this.tray.scaleX, this.tray.scaleY);
    this.drawBolt(L.badge);

    this.stamina.layout(L.stamina.x, L.stamina.y, L.stamina.w, L.stamina.h, TRAY_ART.trackCover);
    const goalH = L.compact ? 44 : 50;
    this.refillBtn.setPosition(L.w / 2, L.tray.y - 30);
    this.slots.forEach((slot, i) => {
      const c = slotCenter(L, i);
      slot.setPosition(c.x, c.y);
      slot.resizeSlot(L.slotSize);
    });
    const c = L.craft;
    this.action.setPosition(c.x, c.y).resize(c.r * 2, c.r * 2, Math.round(c.r * 0.8));
    this.drawCraft();

    const pillH = Math.round(L.topH * 0.62);
    // The money pill may grow until it meets the first of the three round buttons.
    this.money.maxWidth = L.w - 14 - pillH * 4 - 30 - 8 - 14;
    this.money.layout(14, L.topH / 2, pillH);
    const muteR = pillH / 2;
    this.mute.setPosition(L.w - 14 - muteR, L.topH / 2);
    this.storeBtn.setPosition(L.w - 14 - muteR * 2 - 10 - muteR, L.topH / 2);
    this.storeBtn.setSize(pillH, pillH);
    (this.storeBtn.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setTo(0, 0, pillH, pillH);
    this.iconR = muteR;
    this.drawStoreIcon(muteR);
    this.collectBtn.setPosition(this.storeBtn.x - muteR * 2 - 10, this.storeBtn.y);
    this.collectBtn.setSize(pillH, pillH);
    (this.collectBtn.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setTo(0, 0, pillH, pillH);
    this.drawCollectionButton(muteR);
    this.goalsBtn.setPosition(this.collectBtn.x - muteR * 2 - 10, this.collectBtn.y);
    this.goalsBtn.setSize(pillH, pillH);
    (this.goalsBtn.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setTo(0, 0, pillH, pillH);
    this.drawGoalsButton(muteR);
    this.findCard.place(L.w / 2, L.topH + 120);
    this.mute.setSize(pillH, pillH);
    (this.mute.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setTo(0, 0, pillH, pillH);
    this.drawMuteIcon(muteR);

    this.toast.place(L.w / 2, L.topH + 108, L.compact ? 16 : 20);
    // The debt chip sits in the row under the top bar, at the right, clear of the depth label.
    this.ledgerBtn.setPosition(L.w - 14 - L.depth.w - 46 - goalH / 2, L.topH + 8 + goalH / 2);
    this.ledgerBtn.setSize(goalH, goalH);
    (this.ledgerBtn.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setTo(0, 0, goalH, goalH);
    this.ledgerSize = goalH;
    this.drawLedgerButton();
    this.depthGauge.layout(L.depth.x, L.depth.y, L.depth.w, L.depth.h);
  }

  /** A lightning bolt in the round socket at the left end of the stamina bar. */
  private drawBolt(b: { x: number; y: number; r: number }): void {
    const g = this.trayBolt;
    g.clear();
    const s = b.r * 0.95;
    const pts = [
      { x: 0.25, y: -1 }, { x: -0.55, y: 0.15 }, { x: -0.02, y: 0.15 },
      { x: -0.25, y: 1 }, { x: 0.55, y: -0.15 }, { x: 0.02, y: -0.15 },
    ].map((p) => ({ x: b.x + p.x * s, y: b.y + p.y * s }));
    g.fillStyle(0x2a1405).fillPoints(pts.map((p) => ({ x: p.x + s * 0.07, y: p.y + s * 0.09 })) as Phaser.Types.Math.Vector2Like[], true);
    g.fillStyle(0xffd23f).fillPoints(pts as Phaser.Types.Math.Vector2Like[], true);
  }

  /** How the craft medallion looks: 'locked' (dark, off), 'open', 'ready' (glowing), or a picture on a cover. */
  private craftLook: { kind: 'locked' | 'open' | 'ready' | 'cover'; count: string } = { kind: 'locked', count: '' };

  private setCraft(kind: 'locked' | 'open' | 'ready' | 'cover', count: string): void {
    this.craftLook = { kind, count };
    this.drawCraft();
  }

  private drawCraft(): void {
    if (!this.L) return;
    const c = this.L.craft;
    const { kind, count } = this.craftLook;
    // Locked: the anvil stays visible but dark and quiet.
    this.craftDim.setVisible(kind === 'locked').clear();
    if (kind === 'locked') this.craftDim.fillStyle(0x1a0c04, 0.62).fillCircle(c.x, c.y, c.r * 0.93);
    // Cover: a medallion disc that carries another picture (back to the dig site, the moon).
    this.craftCover.setVisible(kind === 'cover').clear();
    if (kind === 'cover') {
      this.craftCover.fillStyle(0x3a1c08).fillCircle(c.x, c.y, c.r * 0.93);
      this.craftCover.lineStyle(Math.max(2, c.r * 0.09), 0xf0a020, 0.9).strokeCircle(c.x, c.y, c.r * 0.84);
    }
    // Ready: a soft glow that breathes.
    this.craftGlow.setPosition(c.x, c.y).setDisplaySize(c.r * 3.4, c.r * 3.4);
    if (kind === 'ready') {
      this.craftGlow.setVisible(true);
      if (!this.craftTween) {
        this.craftTween = this.tweens.add({ targets: this.craftGlow, alpha: { from: 0.2, to: 0.75 }, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    } else {
      this.craftTween?.remove();
      this.craftTween = null;
      this.craftGlow.setVisible(false).setAlpha(0);
    }
    // The count rides on the lower rim of the medallion.
    this.craftCount.setVisible(count !== '' && kind !== 'cover');
    if (count !== '') {
      const t = this.craftCountText.setFontSize(Math.max(12, Math.round(c.r * 0.5))).setText(count);
      const w = Math.max(c.r * 0.7, t.width + c.r * 0.35);
      const h = c.r * 0.62;
      const g = this.craftCountBg;
      g.clear();
      g.fillStyle(0x000000, 0.3).fillRoundedRect(-w / 2, -h / 2 + 2, w, h, h / 2);
      g.fillStyle(0x3a1c08).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
      g.lineStyle(2, kind === 'locked' ? 0x8a6a46 : 0xf0a020, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
      this.craftCount.setPosition(c.x, c.y + c.r * 0.92);
    }
  }

  // ---------- state -> UI ----------

  private refresh(): void {
    this.refreshSlots();
    const inv = state.inventory;

    // The craft medallion is a picture: the button itself only carries a picture on a cover when the
    // medallion's own anvil is not what should be shown.
    this.action.setLabel('');
    if (state.mode === 'dig') {
      const need = GAME_CONFIG.inventory.rocksToUnlockWorkshop;
      if (!state.canWork) {
        this.action.setIcon(uiIcon('moon')).setEnabled(false);
        this.setCraft('cover', '');
      } else if (state.workshopReady) {
        // Enough rocks collected: the craft button wakes up and glows.
        this.action.setIcon(null).setEnabled(true);
        this.setCraft('ready', `${inv.uncutCount}`);
      } else {
        // Still collecting: the craft button stays off and shows how far along the bag is.
        this.action.setIcon(null).setEnabled(false);
        this.setCraft('locked', `${inv.uncutCount}/${need}`);
      }
    } else if (!state.canWork) {
      // Closing time: no way back to the dig site. The bag has to be emptied first.
      const n = state.rocksLeft;
      this.action.setIcon(n > 0 ? 'ui-workshop' : uiIcon('moon')).setEnabled(false);
      this.setCraft('cover', '');
    } else {
      this.action.setIcon(uiIcon('back')).setEnabled(!state.busy);
      this.setCraft('cover', '');
    }
  }

  private refreshSlots(): void {
    const inv = state.inventory;
    this.slots.forEach((slot, i) => {
      const rock = inv.get(i);
      slot.show({
        rock,
        incoming: !!rock && this.incoming.has(rock.id),
        onBench: !!rock && rock.id === this.benchRockId && state.mode === 'workshop',
      });
    });
  }

  // ---------- actions ----------

  private onAction(): void {
    if (this.switching) return;
    if (state.mode === 'dig') {
      if (state.workshopReady && state.canWork) this.switchMode('workshop');
    } else if (!state.busy && state.canWork) {
      this.switchMode('dig');
    }
  }

  private onSlotPressed(index: number): void {
    const rock = state.inventory.get(index);
    if (!rock) return;
    if (state.mode === 'workshop' && !rock.cut) {
      state.bus.emit(EVT.slotSelected, rock.id);
    } else {
      this.slots[index].wiggle();
    }
  }

  private switchMode(to: GameMode): void {
    this.switching = true;
    const fromKey = to === 'workshop' ? 'Dig' : 'Workshop';
    const toKey = to === 'workshop' ? 'Workshop' : 'Dig';
    const cam = this.scene.get(fromKey).cameras.main;
    cam.fadeOut(170, 30, 20, 12);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.sleep(fromKey);
      state.setMode(to);
      if (this.scene.isSleeping(toKey)) this.scene.wake(toKey);
      else this.scene.launch(toKey);
      this.switching = false;
    });
  }

  // ---------- day events ----------

  private onDayPhaseChanged(phase: string): void {
    if (phase === 'closing') this.showClosingBanner();
    this.refresh();
  }

  private showClosingBanner(): void {
    if (this.closingBanner) return;
    const banner = this.add.container(this.scale.width / 2, this.scale.height / 2 - 60);
    const bg = this.add.graphics();
    const title = this.add.image(0, 0, uiIcon('clock')).setDisplaySize(76, 76);
    const w = 76 + 64;
    const h = 88;
    bg.fillStyle(0x000000, 0.5).fillRoundedRect(-w / 2, -h / 2, w, h, 16);
    bg.fillStyle(PALETTE.tray, 0.95).fillRoundedRect(-w / 2, -h / 2, w, h, 16);
    bg.lineStyle(2, PALETTE.gold, 0.8).strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
    banner.add([bg, title]);
    banner.setAlpha(0).setScale(0.8).setDepth(50);
    this.closingBanner = banner;

    this.closingBannerTween = this.tweens.add({
      targets: banner,
      alpha: 1,
      scale: 1,
      duration: 280,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(CLOSING_BANNER_DURATION, () => {
          this.hideClosingBanner();
        });
      },
    });
    sfx.timesUp();
  }

  private hideClosingBanner(): void {
    if (!this.closingBanner) return;
    this.closingBannerTween?.remove();
    this.tweens.add({
      targets: this.closingBanner,
      alpha: 0,
      scale: 0.8,
      duration: 220,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.closingBanner?.destroy();
        this.closingBanner = null;
      },
    });
  }

  private onDaySummary(summary: DaySummary): void {
    this.hideClosingBanner();
    this.scene.launch('EndOfDay', summary);
  }

  private onDayStarted(_day: number): void {
    this.hideClosingBanner();
    if (state.mode === 'workshop') {
      this.switchMode('dig');
    }
    this.refresh();
    sfx.newDay();
  }

  private onLayerEntered(_layerIndex: number): void {
    sfx.layerEnter();
  }

  // ---------- effects ----------

  private flyRockToBag(rock: Rock, x: number, y: number, scale: number): void {
    const index = state.inventory.indexOf(rock.id);
    if (index < 0) return;
    this.incoming.add(rock.id);
    this.refreshSlots();
    const img = this.add.image(x, y, rockKeys(rock).outside).setScale(scale).setDepth(15);
    const end = slotCenter(this.L, index);
    const endScale = iconScale(this.L.slotSize * GAME_CONFIG.rock.inventoryScale);
    const ctrl = { x: (x + end.x) / 2 + (end.x > x ? -60 : 60), y: Math.min(y, end.y) - 140 };
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 560,
      ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        const u = 1 - t;
        img.setPosition(u * u * x + 2 * u * t * ctrl.x + t * t * end.x, u * u * y + 2 * u * t * ctrl.y + t * t * end.y);
        img.setScale(Phaser.Math.Linear(scale, endScale, t));
        img.setAngle(t * 360);
      },
      onComplete: () => {
        img.destroy();
        this.incoming.delete(rock.id);
        this.refreshSlots();
        this.slots[index]?.bump();
        sfx.collect();
      },
    });
  }

  private celebrateSale(amount: number, x: number, y: number, tier: number): void {
    if (amount <= 0) {
      // A worthless rock: no coins, no cheer, just a grey "$0" and a letdown sound.
      sfx.denied();
      const dud = this.floats[this.floatIndex++ % this.floats.length];
      this.tweens.killTweensOf(dud);
      dud.setText(formatMoney(0)).setColor('#cfc6b8').setPosition(x, y).setAlpha(1).setScale(0.8).setVisible(true);
      this.tweens.add({ targets: dud, y: y - 50, alpha: 0, delay: 350, duration: 500, ease: 'Quad.easeIn', onComplete: () => { dud.setVisible(false).setColor(PALETTE.money); } });
      return;
    }
    sfx.sell();
    const float = this.floats[this.floatIndex++ % this.floats.length];
    this.tweens.killTweensOf(float);
    float.setText(`+${formatMoney(amount)}`).setPosition(x, y).setAlpha(1).setScale(0.6).setVisible(true);
    this.tweens.add({ targets: float, scale: 1.15, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: float, y: y - 90, alpha: 0, delay: 500, duration: 650, ease: 'Quad.easeIn',
      onComplete: () => float.setVisible(false),
    });

    const target = this.money.coinTarget;
    const count = Math.min(COIN_POOL, 5 + tier * 2);
    const flight = 620;
    // Display diameter in screen pixels: starts at ~39, shrinks to ~26 by the money pill.
    const coinBase = this.textures.get('coin').getSourceImage().width || 52;
    for (let i = 0; i < count; i++) {
      const coin = this.coins[i];
      this.tweens.killTweensOf(coin);
      const sx = x + Phaser.Math.Between(-40, 40);
      const sy = y + Phaser.Math.Between(-30, 30);
      const ctrl = { x: (sx + target.x) / 2 + Phaser.Math.Between(-80, 80), y: Math.min(sy, target.y) - Phaser.Math.Between(60, 160) };
      coin.setPosition(sx, sy).setScale(0).setVisible(true).setAlpha(1);
      this.tweens.addCounter({
        from: 0,
        to: 1,
        delay: 80 + i * 55,
        duration: flight,
        ease: 'Quad.easeIn',
        onStart: () => coin.setScale(39 / coinBase),
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0;
          const u = 1 - t;
          coin.setPosition(u * u * sx + 2 * u * t * ctrl.x + t * t * target.x, u * u * sy + 2 * u * t * ctrl.y + t * t * target.y);
          coin.setScale((39 - 13 * t) / coinBase);
        },
        onComplete: () => {
          coin.setVisible(false);
          this.money.pulse();
          sfx.coin();
        },
      });
    }
    this.money.countTo(state.economy.money, 80 + flight, count * 55 + 250);
  }

  // ---------- mute ----------

  private buildMuteButton(): void {
    this.muteIcon = this.add.graphics();
    this.pauseImg = this.add.image(0, 0, 'ui-pause');
    this.mute = this.add.container(0, 0, [this.muteIcon, this.pauseImg]);
    this.mute.setSize(40, 40);
    this.mute.setInteractive({ useHandCursor: true });
    this.mute.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.openPause());
  }

  private buildStoreButton(): void {
    this.storeImg = this.add.image(0, 0, 'ui-store');
    this.storeIcon = this.add.graphics();
    this.storeBtn = this.add.container(0, 0, [this.storeImg, this.storeIcon]);
    this.storeBtn.setSize(40, 40);
    this.storeBtn.setInteractive({ useHandCursor: true });
    this.storeBtn.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.openStore());
  }

  /** Opens the store overlay. It pauses the world while open (see StoreScene). */
  private openStore(): void {
    // The stall is open: the same icon closes it again.
    if (this.scene.isActive('Store')) {
      (this.scene.get('Store') as StoreScene).requestClose();
      return;
    }
    if (this.switching || this.storeOpen || this.scene.isActive('EndOfDay')) return;
    sfx.click();
    this.tweens.add({ targets: this.storeBtn, scale: { from: 0.85, to: 1 }, duration: 200, ease: 'Back.easeOut' });
    this.scene.launch('Store');
  }

  /** The market stall picture, with a red "!" badge when something worth buying is affordable. */
  private drawStoreIcon(r: number): void {
    const g = this.storeIcon;
    g.clear();
    fitIcon(this.storeImg, r * 2.5);
    if (this.storeDeal) {
      // Red "!" badge: something worth buying is affordable right now.
      const bx = r * 0.72;
      const by = -r * 0.72;
      g.fillStyle(0xe5533d).fillCircle(bx, by, r * 0.34);
      g.lineStyle(2, 0xffffff).strokeCircle(bx, by, r * 0.34);
      g.fillStyle(0xffffff).fillRect(bx - r * 0.04, by - r * 0.2, r * 0.08, r * 0.24).fillCircle(bx, by + r * 0.16, r * 0.06);
    }
  }

  private buildGoalsButton(): void {
    this.goalsBg = this.add.graphics();
    this.goalsIcon = this.add.image(0, 0, uiIcon('target'));
    this.goalsLevel = this.add.text(0, 0, '', outlinedStyle(11)).setOrigin(0.5);
    this.goalsBtn = this.add.container(0, 0, [this.goalsBg, this.goalsIcon, this.goalsLevel]);
    this.goalsBtn.setSize(40, 40);
    this.goalsBtn.setInteractive({ useHandCursor: true });
    this.goalsBtn.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.openGoals());
  }

  /** The goals button: a target, with the prospector level in the corner. */
  private drawGoalsButton(r: number): void {
    const g = this.goalsBg;
    g.clear();
    fitIcon(this.goalsIcon, r * 2.5);
    this.goalsIcon.setPosition(0, -r * 0.05);
    this.goalsLevel.setFontSize(Math.max(10, Math.round(r * 0.52))).setPosition(r * 0.62, r * 0.66).setText(`${state.progress.level}`);
  }

  private buildCollectionButton(): void {
    this.collectBg = this.add.graphics();
    this.collectIcon = this.add.image(0, 0, uiIcon('album'));
    this.collectCount = this.add.text(0, 0, '', outlinedStyle(11)).setOrigin(0.5);
    this.collectBtn = this.add.container(0, 0, [this.collectBg, this.collectIcon, this.collectCount]);
    this.collectBtn.setSize(40, 40);
    this.collectBtn.setInteractive({ useHandCursor: true });
    this.collectBtn.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.openCollection());
  }

  /** The album button: the number of different collection items found so far. */
  private drawCollectionButton(r: number): void {
    const g = this.collectBg;
    g.clear();
    // The bag-of-finds picture stands on its own, like the other round-button pictures.
    fitIcon(this.collectIcon, r * 2.3);
    this.collectIcon.setPosition(0, -r * 0.05);
    this.collectCount.setFontSize(Math.max(10, Math.round(r * 0.52))).setPosition(r * 0.62, r * 0.66).setText(`${state.collectionFound}`);
    this.collectCount.setVisible(state.collectionFound > 0);
  }

  /** Bedrock reached: offer a fresh deposit (never over another card or mid-trip). */
  private offerRelocation(): void {
    if (this.storeOpen || this.switching || state.mode !== 'dig' || !state.canRelocate) return;
    if (this.scene.isActive('EndOfDay')) return;
    // Declined a moment ago? Do not nag on every swing at bedrock.
    if (this.time.now - this.lastRelocateCard < 20000) {
      sfx.denied();
      return;
    }
    this.lastRelocateCard = this.time.now;
    this.scene.launch('Relocate');
  }

  private openCollection(): void {
    if (this.switching || this.storeOpen || this.scene.isActive('EndOfDay')) return;
    sfx.click();
    this.scene.launch('Collection');
  }

  // ---------- household ledger (debt) ----------

  private buildLedgerButton(): void {
    this.ledgerBg = this.add.graphics();
    this.ledgerIcon = this.add.image(0, 0, uiIcon('ledger'));
    this.ledgerBadge = this.add.graphics();
    this.ledgerBtn = this.add.container(0, 0, [this.ledgerBg, this.ledgerIcon, this.ledgerBadge]);
    this.ledgerBtn.setSize(44, 44);
    this.ledgerBtn.setInteractive({ useHandCursor: true });
    this.ledgerBtn.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.openLedger());
  }

  /** 'late' = something is overdue, 'soon' = a payment falls due within two days, 'ok' otherwise. */
  private ledgerMood(): 'ok' | 'soon' | 'late' {
    if (state.hasOverdue) return 'late';
    const v = state.ledger;
    if (!v.debtFree && v.nextInstallmentDay !== null && v.daysUntilNextInstallment <= 2) return 'soon';
    return 'ok';
  }

  private drawLedgerButton(): void {
    if (!this.ledgerBg) return;
    const r = this.ledgerSize / 2;
    const mood = this.ledgerMood();
    const ring = mood === 'late' ? 0xe5533d : mood === 'soon' ? 0xffb627 : PALETTE.gold;
    const g = this.ledgerBg;
    g.clear();
    // The book stands on its own; a ring only appears when a payment is near or overdue.
    if (mood !== 'ok') g.lineStyle(Math.max(2, r * 0.1), ring, 1).strokeCircle(0, 0, r * 1.08);
    fitIcon(this.ledgerIcon, r * 2.1);
    this.ledgerIcon.setPosition(0, -r * 0.04);
    const b = this.ledgerBadge;
    b.clear();
    if (mood !== 'ok') {
      const bx = r * 0.7;
      const by = -r * 0.7;
      b.fillStyle(mood === 'late' ? 0xe5533d : 0xffb627).fillCircle(bx, by, r * 0.3);
      b.lineStyle(2, 0xffffff).strokeCircle(bx, by, r * 0.3);
      b.fillStyle(0xffffff).fillRect(bx - r * 0.035, by - r * 0.17, r * 0.07, r * 0.2).fillCircle(bx, by + r * 0.14, r * 0.055);
    }
  }

  private openLedger(): void {
    if (this.switching || this.storeOpen || this.scene.isActive('EndOfDay') || state.isGameOver) return;
    sfx.click();
    this.tweens.add({ targets: this.ledgerBtn, scale: { from: 0.85, to: 1 }, duration: 200, ease: 'Back.easeOut' });
    this.scene.launch('Ledger');
  }

  /** The month ended with unpaid debt: the run is over until the player restarts it. */
  private onGameOver(): void {
    if (this.scene.isActive('GameOver')) return;
    this.scene.launch('GameOver');
  }

  /** The run was reset: every scene starts over from day one. */
  private onRunReset(): void {
    for (const key of ['EndOfDay', 'Store', 'Goals', 'Collection', 'Relocate', 'Ledger', 'GameOver', 'Workshop']) {
      if (this.scene.isActive(key) || this.scene.isPaused(key) || this.scene.isSleeping(key)) this.scene.stop(key);
    }
    this.time.delayedCall(0, () => this.scene.restart());
  }

  private openGoals(): void {
    if (this.switching || this.storeOpen || this.scene.isActive('EndOfDay')) return;
    sfx.click();
    this.scene.launch('Goals');
  }

  /** Shows or hides the red badge on the store icon. */
  private updateStoreDeal(): void {
    const deal = state.storeHasDeal;
    if (deal === this.storeDeal) return;
    this.storeDeal = deal;
    this.drawStoreIcon(this.iconR);
    if (!deal) return;
    this.tweens.add({ targets: this.storeBtn, scale: { from: 1.25, to: 1 }, duration: 420, ease: 'Back.easeOut' });
  }

  /** "Out of stamina? Watch an ad" - appears only when the tank is nearly empty. */
  private updateRefillOffer(): void {
    const show = state.mode === 'dig' && state.canWork && !this.storeOpen && portal.rewardedReady && state.stamina.fraction < 0.2;
    if (this.refillBtn.visible === show) return;
    this.refillBtn.setVisible(show).setPulse(show);
  }

  private watchRefill(): void {
    portal.rewarded(() => {
      state.stamina.refill();
      sfx.coin();
    });
  }

  private onLevelUp(level: number, bonus: number): void {
    sfx.newDay();
    this.drawGoalsButton(this.iconR);
    this.tweens.add({ targets: this.goalsBtn, scale: { from: 1.25, to: 1 }, duration: 380, ease: 'Back.easeOut' });
    this.showCenterBanner(`${level}`, `+${formatMoney(bonus)}`, ICON_STAR);
  }

  private showCenterBanner(titleText: string, subText = '', iconKey?: string): void {
    this.banner?.destroy();
    const banner = this.add.container(this.scale.width / 2, this.scale.height / 2 - 70);
    const bg = this.add.graphics();
    const title = this.add.text(0, subText ? -18 : 0, titleText, outlinedStyle(44, '#ffd34d')).setOrigin(0.5);
    const sub = subText ? this.add.text(0, 26, subText, outlinedStyle(22, '#8dff9a')).setOrigin(0.5) : null;
    const icon = iconKey ? this.add.image(0, subText ? -18 : 0, iconKey).setDisplaySize(72, 72) : null;
    const rowW = (icon ? 82 : 0) + title.width;
    if (icon) {
      icon.x = -rowW / 2 + 36;
      title.x = rowW / 2 - title.width / 2;
    }
    const w = Math.max(rowW, sub?.width ?? 0) + 64;
    const h = subText ? 108 : 84;
    bg.fillStyle(0x000000, 0.5).fillRoundedRect(-w / 2, -h / 2 + 4, w, h, 18);
    bg.fillStyle(PALETTE.tray, 0.95).fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    bg.lineStyle(3, PALETTE.gold, 0.9).strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
    banner.add([bg, title, ...(icon ? [icon] : []), ...(sub ? [sub] : [])]).setAlpha(0).setScale(0.7).setDepth(60);
    this.banner = banner;
    this.tweens.add({
      targets: banner, alpha: 1, scale: 1, duration: 300, ease: 'Back.easeOut',
      onComplete: () => this.time.delayedCall(1900, () => {
        this.tweens.add({ targets: banner, alpha: 0, y: banner.y - 24, duration: 260, onComplete: () => banner.destroy() });
      }),
    });
  }

  private toggleMute(): void {
    sfx.setMuted(!sfx.muted);
    this.tweens.add({ targets: this.mute, scale: { from: 0.85, to: 1 }, duration: 200, ease: 'Back.easeOut' });
  }

  /** The pause badge (this button used to be the mute toggle; sound now lives in the pause menu). */
  private drawMuteIcon(r: number): void {
    this.muteIcon.clear();
    fitIcon(this.pauseImg, r * 2.3);
  }

  private openPause(): void {
    if (this.switching || this.storeOpen || this.scene.isActive('EndOfDay') || state.isGameOver) return;
    sfx.click();
    this.tweens.add({ targets: this.mute, scale: { from: 0.85, to: 1 }, duration: 200, ease: 'Back.easeOut' });
    this.scene.launch('Pause');
  }
}
