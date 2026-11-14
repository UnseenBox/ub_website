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
    this.toast = new Toast(this);

    ClockPill.createSunTexture(this.textures);
    this.clockPill = new ClockPill(this);
    this.depthGauge = new DepthGauge(this);
    this.toolChip = new ToolChip(this);

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

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this));

    const kb = this.input.keyboard;
    if (kb) {
      kb.on('keydown-ENTER', () => this.handleEnterKey());
      kb.on('keydown-ESC', () => this.handleEscKey());
      kb.on('keydown-M', () => this.toggleMute());
      kb.on('keydown', (e: KeyboardEvent) => {
        const n = Number(e.key);
        if (n >= 1 && n <= this.slots.length) this.onSlotPressed(n - 1);
      });
    }

    this.onResize();
    this.refresh();
    this.refreshInfo();
  }

  private handleEnterKey(): void {
    if (state.mode === 'dig' && state.canWork) {
      this.action.trigger();
    }
  }

  private handleEscKey(): void {
    if (state.mode === 'workshop' && !state.busy) {
      this.action.trigger();
    }
  }

  update(_time: number, delta: number): void {
    // Clamp so a long frame (e.g. returning to the tab) never jumps stamina.
    const dt = Math.min(delta, 100);
    state.tick(dt);
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
    this.mute.setSize(pillH, pillH);
    (this.mute.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setTo(0, 0, pillH, pillH);
    this.drawMuteIcon(muteR);

    this.infoText.setFontSize(Math.round(pillH * 0.4));
    this.toast.place(L.w / 2, L.topH + 34, L.compact ? 16 : 20);
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
      } else {
        const need = GAME_CONFIG.inventory.rocksToUnlockWorkshop;
        this.action.setLabel(`Find rocks ${inv.uncutCount}/${need}`).setEnabled(false).setPulse(false);
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
    const maxW = this.mute.x - this.mute.width / 2 - 24 - (clockPillRight + 28);
    this.infoText.setText(full);
    if (this.infoText.width > maxW) this.infoText.setText(short);
    this.infoText.setVisible(this.infoText.width <= maxW);
    const h = Math.round(this.L.topH * 0.5);
    const right = this.mute.x - this.mute.width / 2 - 10;
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
    const newBanner = this.add.container(this.scale.width / 2, this.L.topH + 30);
    const bg = this.add.graphics();
    const dot = this.add.graphics();
    const text = this.add.text(14, 0, `Entering: ${layer.name}`, outlinedStyle(16, '#fff6e6')).setOrigin(0, 0.5);
    const w = text.width + 36;
    const h = 28;
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
