import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/GameConfig';
import { BUTTON_COLORS, PALETTE, outlinedStyle, textStyle } from '../config/Theme';
import { EVT, state, subscribe } from '../core/GameState';
import type { DaySummary } from '../core/GameState';
import type { GameMode, Rock } from '../core/types';
import { iconScale, rockKeys } from '../art/RockArt';
import { sfx } from '../audio/Sfx';
import { Button } from '../ui/Button';
import { InventorySlot } from '../ui/InventorySlot';
import { ClockPill } from '../ui/ClockPill';
import { DepthGauge } from '../ui/DepthGauge';
import { ToolChip } from '../ui/ToolChip';
import { GoalPill } from '../ui/GoalPill';
import { CurioCard } from '../ui/CurioCard';
import type { CurioDef } from '../data/curios';
import { portal } from '../ads/Portal';
import { computeLayout, slotCenter, type Layout } from '../ui/layout';
import { MoneyCounter, formatMoney } from '../ui/MoneyCounter';
import { StaminaBar } from '../ui/StaminaBar';
import { Toast } from '../ui/Toast';

const COIN_POOL = 14;
const FLOAT_POOL = 4;
const LAYER_BANNER_POOL = 2;
const CLOSING_BANNER_DURATION = 1100;
const LAYER_BANNER_DURATION = 1800;

/**
 * Always-on overlay: money, stats, mute, stamina, bag and the main action
 * button. Also owns scene switching between the dig site and the workshop.
 */
export class HudScene extends Phaser.Scene {
  private L!: Layout;
  private tray!: Phaser.GameObjects.Graphics;
  private stamina!: StaminaBar;
  private bagText!: Phaser.GameObjects.Text;
  private slots: InventorySlot[] = [];
  private action!: Button;
  private money!: MoneyCounter;
  private infoBg!: Phaser.GameObjects.Graphics;
  private infoText!: Phaser.GameObjects.Text;
  private mute!: Phaser.GameObjects.Container;
  private storeBtn!: Phaser.GameObjects.Container;
  private storeIcon!: Phaser.GameObjects.Graphics;
  private storeDeal = false;
  private lastDealToast = -1e9;
  private iconR = 20;
  private goalPill!: GoalPill;
  private curioCard!: CurioCard;
  private collectBtn!: Phaser.GameObjects.Container;
  private collectBg!: Phaser.GameObjects.Graphics;
  private collectIcon!: Phaser.GameObjects.Text;
  private collectCount!: Phaser.GameObjects.Text;
  private refillBtn!: Button;
  private userActed = false;
  private banner: Phaser.GameObjects.Container | null = null;
  private muteIcon!: Phaser.GameObjects.Graphics;
  private toast!: Toast;
  private clockPill!: ClockPill;
  private depthGauge!: DepthGauge;
  private toolChip!: ToolChip;
  private coins: Phaser.GameObjects.Image[] = [];
  private floats: Phaser.GameObjects.Text[] = [];
  private floatIndex = 0;
  private readonly incoming = new Set<string>();
  private benchRockId: string | null = null;
  private switching = false;
  private wasReady = false;
  private closingBanner: Phaser.GameObjects.Container | null = null;
  private closingBannerTween: Phaser.Tweens.Tween | null = null;
  private layerBanners: Phaser.GameObjects.Container[] = [];
  private layerBannerIndex = 0;

  constructor() {
    super('Hud');
  }

  create(): void {
    this.slots = [];
    this.coins = [];
    this.floats = [];
    this.incoming.clear();
    this.layerBanners = [];

    this.tray = this.add.graphics();
    this.stamina = new StaminaBar(this);
    this.bagText = this.add.text(0, 0, '', outlinedStyle(16)).setOrigin(1, 0.5);
    for (let i = 0; i < GAME_CONFIG.inventory.slots; i++) {
      this.slots.push(new InventorySlot(this, () => this.onSlotPressed(i)));
    }
    this.action = new Button(this, {
      width: 220, height: 56, label: '', fontSize: 22, colors: BUTTON_COLORS.orange,
      onClick: () => this.onAction(),
    });
    this.money = new MoneyCounter(this, state.economy.money);
    this.infoBg = this.add.graphics();
    this.infoText = this.add.text(0, 0, '', textStyle(16, '#fff6e6')).setOrigin(1, 0.5);
    this.buildMuteButton();
    this.buildStoreButton();
    this.buildCollectionButton();
    this.curioCard = new CurioCard(this);
    this.toast = new Toast(this);

    ClockPill.createSunTexture(this.textures);
    this.clockPill = new ClockPill(this);
    this.depthGauge = new DepthGauge(this);
    this.toolChip = new ToolChip(this);
    this.goalPill = new GoalPill(this, () => this.openGoals());
    this.refillBtn = new Button(this, {
      width: 250, height: 44, label: 'REFILL STAMINA  (WATCH AD)', fontSize: 16, colors: BUTTON_COLORS.blue,
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
    subscribe(this, EVT.statsChanged, () => this.refreshInfo());
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
      this.goalPill.refresh();
      this.updateStoreDeal();
    });
    subscribe(this, EVT.moneyChanged, (money: number, _delta: number, earned: boolean) => {
      // Sales count up with the flying coins; rewards and purchases tick right away.
      if (!earned) this.money.countTo(money, 0, 450);
      this.updateStoreDeal();
    });
    subscribe(this, EVT.curioFound, (curio: CurioDef, first: boolean, value: number) => {
      this.curioCard.show(curio, first, value, this.L.w - 24);
      this.drawCollectionButton(this.iconR);
    });
    subscribe(this, EVT.levelUp, (level: number, bonus: number) => this.onLevelUp(level, bonus));
    subscribe(this, EVT.goalDone, (goal: { cash: number; xp: number }) => {
      this.toast.show(`Goal complete!  +${formatMoney(goal.cash)}  +${goal.xp} XP`, 2400);
      this.goalPill.bump();
      sfx.coin();
    });
    subscribe(this, EVT.toolChanged, () => {
      this.toolChip.refresh();
      this.toast.show(`${state.tool.name} equipped!`, 2200);
    });
    this.input.once('pointerdown', () => (this.userActed = true));
    this.input.keyboard?.once('keydown', () => (this.userActed = true));

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this));

    const kb = this.input.keyboard;
    if (kb) {
      kb.on('keydown-ENTER', () => this.handleEnterKey());
      kb.on('keydown-ESC', () => this.handleEscKey());
      kb.on('keydown-M', () => this.toggleMute());
      kb.on('keydown-S', () => this.openStore());
      kb.on('keydown-G', () => this.openGoals());
      kb.on('keydown-C', () => this.openCollection());
      kb.on('keydown', (e: KeyboardEvent) => {
        if (this.storeOpen) return;
        const n = Number(e.key);
        if (n >= 1 && n <= this.slots.length) this.onSlotPressed(n - 1);
      });
    }

    this.onResize();
    this.refresh();
    this.refreshInfo();
    this.storeDeal = state.storeHasDeal;
    this.drawStoreIcon(this.iconR);
  }

  /** The store or goals card is up: the world and the day clock hold still. */
  private get storeOpen(): boolean {
    return this.scene.isActive('Store') || this.scene.isActive('Goals') || this.scene.isActive('Collection');
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

    this.clockPill.setTime(state.day.clock.progress, state.day.clock.label, state.day.day);
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
    this.tray.clear();
    this.tray.fillStyle(0x000000, 0.18).fillRoundedRect(t.x, t.y - 4, t.w, t.h, 24);
    this.tray.fillStyle(PALETTE.tray, 0.88).fillRoundedRect(t.x, t.y, t.w, t.h, 24);
    this.tray.lineStyle(2, 0xffffff, 0.08).strokeRoundedRect(t.x, t.y, t.w, t.h, 24);

    this.stamina.layout(L.stamina.x, L.stamina.y, L.stamina.w, L.stamina.h);
    this.toolChip.layout(L.tool.x, L.tool.y, L.tool.w, L.tool.h);
    const pillW = L.compact ? Math.min(L.w * 0.58, 250) : 300;
    const goalH = L.compact ? 44 : 50;
    this.goalPill.layout(14 + pillW / 2, L.topH + 8 + goalH / 2, pillW, goalH);
    this.refillBtn.setPosition(L.w / 2, L.tray.y - 30);
    this.bagText.setPosition(L.bag.x, L.bag.y).setFontSize(Math.round(L.stamina.h * 0.78));
    this.slots.forEach((slot, i) => {
      const c = slotCenter(L, i);
      slot.setPosition(c.x, c.y);
      slot.resizeSlot(L.slotSize);
    });
    const b = L.button;
    this.action.setPosition(b.x + b.w / 2, b.y + b.h / 2).resize(b.w, b.h, Math.round(b.h * 0.4));

    const pillH = Math.round(L.topH * 0.62);
    this.money.layout(14, L.topH / 2, pillH);
    this.clockPill.layout(L.w / 2, L.topH / 2, pillH, 14 + pillH * 3.4 + 8);
    const muteR = pillH / 2;
    this.mute.setPosition(L.w - 14 - muteR, L.topH / 2);
    // Phones: the clock pill leaves no room in the top bar, so the store sits beside the goal pill.
    if (L.compact) this.storeBtn.setPosition(14 + pillW + 12 + muteR, L.topH + 8 + goalH / 2);
    else this.storeBtn.setPosition(L.w - 14 - muteR * 2 - 10 - muteR, L.topH / 2);
    this.storeBtn.setSize(pillH, pillH);
    (this.storeBtn.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setTo(0, 0, pillH, pillH);
    this.iconR = muteR;
    this.drawStoreIcon(muteR);
    if (L.compact) this.collectBtn.setPosition(this.storeBtn.x + muteR * 2 + 8, this.storeBtn.y);
    else this.collectBtn.setPosition(this.storeBtn.x - muteR * 2 - 10, this.storeBtn.y);
    this.collectBtn.setSize(pillH, pillH);
    (this.collectBtn.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setTo(0, 0, pillH, pillH);
    this.drawCollectionButton(muteR);
    this.curioCard.place(L.w / 2, L.topH + 120);
    this.mute.setSize(pillH, pillH);
    (this.mute.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setTo(0, 0, pillH, pillH);
    this.drawMuteIcon(muteR);

    this.infoText.setFontSize(Math.round(pillH * 0.4));
    this.toast.place(L.w / 2, L.topH + 108, L.compact ? 16 : 20);
    this.depthGauge.layout(L.depth.x, L.depth.y, L.depth.w, L.depth.h);
    this.refreshInfo();
  }

  // ---------- state -> UI ----------

  private refresh(): void {
    this.refreshSlots();
    const inv = state.inventory;
    this.bagText.setText(`Bag ${inv.count}/${inv.capacity}`);
    this.bagText.setColor(inv.isFull ? PALETTE.goldText : '#ffffff');
    this.toolChip.refresh();

    if (state.mode === 'dig') {
      const ready = state.workshopReady && state.canWork;
      if (!state.canWork) {
        this.action.setLabel('Day over').setColors(BUTTON_COLORS.blue).setEnabled(false).setPulse(false);
      } else if (ready) {
        this.action.setLabel('Workshop  >').setColors(BUTTON_COLORS.orange).setEnabled(true).setPulse(true);
        if (!this.wasReady) this.toast.show(inv.isFull ? 'Bag full! Time to cut some rocks!' : 'Ready! Take your rocks to the workshop!');
      } else if (state.workshopAvailable) {
        // Any rock can be cut right away; the button only starts pulsing once a trip is worth it.
        this.action.setLabel(`Workshop  (${inv.uncutCount})`).setColors(BUTTON_COLORS.orange).setEnabled(true).setPulse(false);
      } else {
        const need = GAME_CONFIG.inventory.rocksToUnlockWorkshop;
        this.action.setLabel(`Find rocks ${inv.uncutCount}/${need}`).setColors(BUTTON_COLORS.orange).setEnabled(false).setPulse(false);
      }
      this.wasReady = ready;
    } else if (!state.canWork) {
      // Closing time: no way back to the dig site. The bag has to be emptied first.
      const n = state.rocksLeft;
      this.action
        .setLabel(n > 0 ? `${n} rock${n === 1 ? '' : 's'} left` : 'Day over')
        .setColors(BUTTON_COLORS.blue)
        .setEnabled(false)
        .setPulse(false);
      this.wasReady = false;
    } else {
      const nothingLeft = inv.uncutCount === 0 && !state.busy;
      this.action.setLabel('<  Back to Dig').setColors(BUTTON_COLORS.blue).setEnabled(!state.busy).setPulse(nothingLeft);
      this.wasReady = false;
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

  private refreshInfo(): void {
    if (!this.L) return;
    const { found, best } = state.stats;
    const full = `Found ${found}   Best: ${best ? best.mineral.name : '-'}`;
    const short = best ? `Best: ${best.mineral.name}` : `Found ${found}`;
    const clockPillRight = this.clockPill.x + this.clockPill.pillWidth / 2;
    const edge = this.L.compact ? this.mute : this.collectBtn;
    const maxW = edge.x - edge.width / 2 - 24 - (clockPillRight + 28);
    this.infoText.setText(full);
    if (this.infoText.width > maxW) this.infoText.setText(short);
    this.infoText.setVisible(this.infoText.width <= maxW);
    const h = Math.round(this.L.topH * 0.5);
    const right = edge.x - edge.width / 2 - 10;
    this.infoText.setPosition(right - 14, this.L.topH / 2);
    this.infoBg.clear();
    if (this.infoText.visible) {
      const w = this.infoText.width + 28;
      this.infoBg.fillStyle(PALETTE.tray, 0.7).fillRoundedRect(right - w, this.L.topH / 2 - h / 2, w, h, h / 2);
    }
  }

  // ---------- actions ----------

  private onAction(): void {
    if (this.switching) return;
    if (state.mode === 'dig') {
      if (state.workshopAvailable && state.canWork) this.switchMode('workshop');
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
    const title = this.add.text(0, -18, 'Time\'s up!', outlinedStyle(36, '#fff6e6')).setOrigin(0.5);
    const subText = state.rocksLeft > 0 ? 'Cut your last rocks first' : 'The working day is over';
    const sub = this.add.text(0, 18, subText, outlinedStyle(18, '#ffd34d')).setOrigin(0.5);
    const w = Math.max(title.width, sub.width) + 48;
    const h = 72;
    bg.fillStyle(0x000000, 0.5).fillRoundedRect(-w / 2, -h / 2, w, h, 16);
    bg.fillStyle(PALETTE.tray, 0.95).fillRoundedRect(-w / 2, -h / 2, w, h, 16);
    bg.lineStyle(2, PALETTE.gold, 0.8).strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
    banner.add([bg, title, sub]);
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

  private onDayStarted(day: number): void {
    this.hideClosingBanner();
    if (state.mode === 'workshop') {
      this.switchMode('dig');
    }
    this.refresh();
    this.toast.show(`Day ${day} begins - 7:00 AM`);
    sfx.newDay();
  }

  private onLayerEntered(layerIndex: number): void {
    const layer = state.layers[layerIndex];
    if (!layer) return;
    this.showLayerBanner(layer);
    sfx.layerEnter();
  }

  private showLayerBanner(layer: { name: string; look: { gauge: number } }): void {
    const banner = this.layerBanners[this.layerBannerIndex++ % LAYER_BANNER_POOL];
    if (banner) {
      this.tweens.killTweensOf(banner);
      banner.destroy();
    }
    const newBanner = this.add.container(this.scale.width / 2, this.L.topH + 72);
    const bg = this.add.graphics();
    const dot = this.add.graphics();
    const text = this.add.text(14, 0, `Entering: ${layer.name}`, outlinedStyle(16, '#fff6e6')).setOrigin(0, 0.5);
    const w = text.width + 40;
    const h = 28;
    text.setX(-w / 2 + 24); // the dot and the text both sit inside the pill, whatever the name's length
    bg.fillStyle(0x000000, 0.3).fillRoundedRect(-w / 2, -h / 2 + 3, w, h, h / 2);
    bg.fillStyle(PALETTE.tray, 0.9).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    bg.lineStyle(2, layer.look.gauge, 0.9).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    dot.fillStyle(layer.look.gauge, 1).fillCircle(-w / 2 + 10, 0, 6);
    newBanner.add([bg, dot, text]);
    newBanner.setAlpha(0).setY(newBanner.y - 16).setDepth(40);
    this.layerBanners[this.layerBannerIndex - 1] = newBanner;

    this.tweens.add({
      targets: newBanner,
      alpha: 1,
      y: newBanner.y + 16,
      duration: 240,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(LAYER_BANNER_DURATION, () => {
          this.tweens.add({
            targets: newBanner,
            alpha: 0,
            y: newBanner.y - 16,
            duration: 220,
            ease: 'Quad.easeIn',
            onComplete: () => newBanner.destroy(),
          });
        });
      },
    });
  }

  // ---------- effects ----------

  private flyRockToBag(rock: Rock, x: number, y: number, scale: number): void {
    const index = state.inventory.indexOf(rock.id);
    if (index < 0) return;
    this.incoming.add(rock.id);
    this.refreshSlots();
    const img = this.add.image(x, y, rockKeys(rock).outside).setScale(scale).setDepth(15);
    const end = slotCenter(this.L, index);
    const endScale = iconScale(this.L.slotSize * 0.74);
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
        onStart: () => coin.setScale(0.75),
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0;
          const u = 1 - t;
          coin.setPosition(u * u * sx + 2 * u * t * ctrl.x + t * t * target.x, u * u * sy + 2 * u * t * ctrl.y + t * t * target.y);
          coin.setScale(0.75 - 0.25 * t);
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
    this.mute = this.add.container(0, 0, [this.muteIcon]);
    this.mute.setSize(40, 40);
    this.mute.setInteractive({ useHandCursor: true });
    this.mute.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.toggleMute());
  }

  private buildStoreButton(): void {
    this.storeIcon = this.add.graphics();
    this.storeBtn = this.add.container(0, 0, [this.storeIcon]);
    this.storeBtn.setSize(40, 40);
    this.storeBtn.setInteractive({ useHandCursor: true });
    this.storeBtn.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.openStore());
  }

  /** Opens the store overlay. It pauses the world while open (see StoreScene). */
  private openStore(): void {
    if (this.switching || this.storeOpen || this.scene.isActive('EndOfDay')) return;
    sfx.click();
    this.tweens.add({ targets: this.storeBtn, scale: { from: 0.85, to: 1 }, duration: 200, ease: 'Back.easeOut' });
    this.scene.launch('Store');
  }

  /** A little shop front: striped awning over a window and door. */
  private drawStoreIcon(r: number): void {
    const g = this.storeIcon;
    g.clear();
    g.fillStyle(0x000000, 0.25).fillCircle(0, 3, r);
    g.fillStyle(PALETTE.tray, 0.85).fillCircle(0, 0, r);
    g.lineStyle(Math.max(2, r * 0.07), PALETTE.gold, 0.9).strokeCircle(0, 0, r - 1);
    const s = r * 0.5;
    // Shop body.
    g.fillStyle(0xfff3dc).fillRect(-s * 0.85, -s * 0.15, s * 1.7, s * 1.05);
    g.fillStyle(0x4fb0ff).fillRect(-s * 0.62, s * 0.1, s * 0.6, s * 0.5);
    g.fillStyle(0x8a5a2c).fillRect(s * 0.15, s * 0.1, s * 0.45, s * 0.8);
    // Awning stripes.
    const stripes = 4;
    const top = -s * 0.95;
    const bottom = -s * 0.15;
    const topW = s * 1.5;
    const botW = s * 1.15;
    for (let i = 0; i < stripes; i++) {
      const t0 = i / stripes;
      const t1 = (i + 1) / stripes;
      g.fillStyle(i % 2 === 0 ? 0xff6b4a : 0xffffff);
      g.fillPoints(
        [
          new Phaser.Geom.Point(-topW + 2 * topW * t0, top),
          new Phaser.Geom.Point(-topW + 2 * topW * t1, top),
          new Phaser.Geom.Point(-botW + 2 * botW * t1, bottom),
          new Phaser.Geom.Point(-botW + 2 * botW * t0, bottom),
        ],
        true,
      );
    }
    g.lineStyle(Math.max(1.5, r * 0.06), PALETTE.inkHex, 0.7).strokeRect(-s * 0.85, -s * 0.15, s * 1.7, s * 1.05);
    if (this.storeDeal) {
      // Red "!" badge: something worth buying is affordable right now.
      const bx = r * 0.72;
      const by = -r * 0.72;
      g.fillStyle(0xe5533d).fillCircle(bx, by, r * 0.34);
      g.lineStyle(2, 0xffffff).strokeCircle(bx, by, r * 0.34);
      g.fillStyle(0xffffff).fillRect(bx - r * 0.04, by - r * 0.2, r * 0.08, r * 0.24).fillCircle(bx, by + r * 0.16, r * 0.06);
    }
  }

  private buildCollectionButton(): void {
    this.collectBg = this.add.graphics();
    this.collectIcon = this.add.text(0, 0, '\u{1F3FA}', textStyle(20, '#ffffff')).setOrigin(0.5);
    this.collectCount = this.add.text(0, 0, '', outlinedStyle(11)).setOrigin(0.5);
    this.collectBtn = this.add.container(0, 0, [this.collectBg, this.collectIcon, this.collectCount]);
    this.collectBtn.setSize(40, 40);
    this.collectBtn.setInteractive({ useHandCursor: true });
    this.collectBtn.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.openCollection());
  }

  /** The album button: a vase with the number of different curios found so far. */
  private drawCollectionButton(r: number): void {
    const g = this.collectBg;
    g.clear();
    g.fillStyle(0x000000, 0.25).fillCircle(0, 3, r);
    g.fillStyle(PALETTE.tray, 0.85).fillCircle(0, 0, r);
    g.lineStyle(Math.max(2, r * 0.07), 0xb98cff, 0.9).strokeCircle(0, 0, r - 1);
    this.collectIcon.setFontSize(Math.round(r * 1.05)).setPosition(0, -r * 0.05);
    this.collectCount.setFontSize(Math.max(10, Math.round(r * 0.52))).setPosition(r * 0.62, r * 0.66).setText(`${state.progress.curiosFound}`);
    this.collectCount.setVisible(state.progress.curiosFound > 0);
  }

  private openCollection(): void {
    if (this.switching || this.storeOpen || this.scene.isActive('EndOfDay')) return;
    sfx.click();
    this.scene.launch('Collection');
  }

  private openGoals(): void {
    if (this.switching || this.storeOpen || this.scene.isActive('EndOfDay')) return;
    sfx.click();
    this.scene.launch('Goals');
  }

  /** Shows or hides the red badge on the store icon; nudges the player the first time. */
  private updateStoreDeal(): void {
    const deal = state.storeHasDeal;
    if (deal === this.storeDeal) return;
    this.storeDeal = deal;
    this.drawStoreIcon(this.iconR);
    if (!deal) return;
    this.tweens.add({ targets: this.storeBtn, scale: { from: 1.25, to: 1 }, duration: 420, ease: 'Back.easeOut' });
    if (this.time.now - this.lastDealToast > 90000 && !this.storeOpen && !this.banner?.active) {
      this.lastDealToast = this.time.now;
      this.toast.show('New gear is affordable - check the store!', 2400);
    }
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
      this.toast.show('Stamina refilled!', 1600);
      sfx.coin();
    });
  }

  private onLevelUp(level: number, bonus: number): void {
    sfx.newDay();
    this.goalPill.refresh();
    this.goalPill.bump();
    const extra = state.storeHasDeal ? '  -  new gear in the store!' : '';
    this.showCenterBanner(`LEVEL ${level}!`, `Bonus ${formatMoney(bonus)}${extra}`);
  }

  private showCenterBanner(titleText: string, subText: string): void {
    this.banner?.destroy();
    const banner = this.add.container(this.scale.width / 2, this.scale.height / 2 - 70);
    const bg = this.add.graphics();
    const title = this.add.text(0, -18, titleText, outlinedStyle(40, '#ffd34d')).setOrigin(0.5);
    const sub = this.add.text(0, 24, subText, outlinedStyle(18, '#fff6e6')).setOrigin(0.5);
    const w = Math.max(title.width, sub.width) + 56;
    const h = 92;
    bg.fillStyle(0x000000, 0.5).fillRoundedRect(-w / 2, -h / 2 + 4, w, h, 18);
    bg.fillStyle(PALETTE.tray, 0.95).fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    bg.lineStyle(3, PALETTE.gold, 0.9).strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
    banner.add([bg, title, sub]).setAlpha(0).setScale(0.7).setDepth(60);
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
    this.drawMuteIcon(this.mute.width / 2);
    this.tweens.add({ targets: this.mute, scale: { from: 0.85, to: 1 }, duration: 200, ease: 'Back.easeOut' });
  }

  private drawMuteIcon(r: number): void {
    const g = this.muteIcon;
    g.clear();
    g.fillStyle(0x000000, 0.25).fillCircle(0, 3, r);
    g.fillStyle(PALETTE.tray, 0.85).fillCircle(0, 0, r);
    const s = r * 0.42;
    g.fillStyle(0xffffff);
    g.fillRect(-s * 1.1, -s * 0.4, s * 0.6, s * 0.8);
    g.fillTriangle(-s * 0.6, -s * 0.4, s * 0.15, -s * 1.05, s * 0.15, s * 1.05);
    g.fillTriangle(-s * 0.6, -s * 0.4, s * 0.15, s * 1.05, -s * 0.6, s * 0.4);
    if (sfx.muted) {
      g.lineStyle(Math.max(2, r * 0.12), 0xff6b4a);
      g.lineBetween(s * 0.45, -s * 0.5, s * 1.25, s * 0.5);
      g.lineBetween(s * 0.45, s * 0.5, s * 1.25, -s * 0.5);
    } else {
      g.lineStyle(Math.max(2, r * 0.1), 0xffffff);
      g.beginPath();
      g.arc(s * 0.2, 0, s * 0.6, -0.8, 0.8);
      g.strokePath();
      g.beginPath();
      g.arc(s * 0.2, 0, s * 1.05, -0.8, 0.8);
      g.strokePath();
    }
  }
}
