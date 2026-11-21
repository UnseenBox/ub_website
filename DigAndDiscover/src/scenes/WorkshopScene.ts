import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/GameConfig';
import { BUTTON_COLORS, PALETTE, outlinedStyle, textStyle } from '../config/Theme';
import { EVT, state, subscribe } from '../core/GameState';
import type { Rock } from '../core/types';
import { ensureRockTextures, iconScale, releaseRockTextures, rockKeys } from '../art/RockArt';
import { sfx, type SawHandle } from '../audio/Sfx';
import { portal } from '../ads/Portal';
import { ICON_SAW, ICON_STAR } from '../art/IconArt';
import { uiIcon } from '../art/UiIcons';
import { Button } from '../ui/Button';
import { computeLayout, slotCenter, type Layout } from '../ui/layout';
import { formatMoney } from '../ui/MoneyCounter';
import { SawBench, type BenchFx } from './SawBench';

/** Logical stage size for the original, single-machine workshop. */
interface StageLayout {
  w: number;
  h: number;
  machineX: number;
  bedY: number;
  cardX: number;
  cardY: number;
  cardW: number;
  cardH: number;
}

const WIDE_STAGE: StageLayout = { w: 980, h: 600, machineX: 340, bedY: 430, cardX: 770, cardY: 300, cardW: 340, cardH: 390 };
const TALL_STAGE: StageLayout = { w: 640, h: 860, machineX: 320, bedY: 440, cardX: 320, cardY: 708, cardW: 590, cardH: 270 };

/** Rocks worth at least this much offer a "sell for double" ad (single rock only). */
const AD_SELL_MIN_VALUE = 30;

/**
 * The workshop now hosts one to four saw machines. With no Extra Saws levels
 * there is exactly one machine and the original layout, controls and timing.
 * Extra machines use the same SawBench unit at a smaller scale and share the
 * Cut/Sell buttons, so a handful of rocks takes about as long as a single one.
 */
export class WorkshopScene extends Phaser.Scene {
  private S: StageLayout = WIDE_STAGE;
  private L!: Layout;
  private backdrop!: Phaser.GameObjects.Graphics;
  private lamp!: Phaser.GameObjects.Image;
  private stage!: Phaser.GameObjects.Container;
  private benches: SawBench[] = [];
  private fx!: BenchFx;

  private card!: Phaser.GameObjects.Graphics;
  private chip!: Phaser.GameObjects.Container;
  private chipBg!: Phaser.GameObjects.Graphics;
  private chipText!: Phaser.GameObjects.Text;
  private chipStars: Phaser.GameObjects.Image[] = [];
  private title!: Phaser.GameObjects.Text;
  private sub!: Phaser.GameObjects.Text;
  private big!: Phaser.GameObjects.Text;
  private bigIcon!: Phaser.GameObjects.Image;
  private cutBtn!: Button;
  private sellBtn!: Button;
  private adBtn!: Button;

  private sparkFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dustFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private burstFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confettiFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private glitterFx!: Phaser.GameObjects.Particles.ParticleEmitter;

  private saw: SawHandle | null = null;
  private bigCounter = { value: 0 };
  private legendaryHue = -1;
  /** Every timer and floating label we create, so SLEEP/SHUTDOWN can clean up strictly. */
  private timers: Phaser.Time.TimerEvent[] = [];
  private floaters: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('Workshop');
  }

  create(): void {
    this.backdrop = this.add.graphics();
    this.lamp = this.add.image(0, 0, 'soft').setTint(0xffd9a0).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    this.stage = this.add.container(0, 0);

    this.fx = {
      dust: (x, y, count) => this.dustFx.explode(count, x, y),
      spark: (x, y, count) => this.sparkFx.emitParticleAt(x, y, count),
      glitter: (x, y) => this.glitterFx.emitParticleAt(x, y, 1),
      lucky: (bench) => this.flashLuckyCut(bench),
    };
    this.syncBenches();
    this.buildCard();
    this.buildEffects();
    this.computeStage();

    subscribe(this, EVT.slotSelected, (id: string) => this.onSlotSelected(id));
    subscribe(this, EVT.capacityChanged, () => this.computeStage());
    subscribe(this, EVT.dayPhaseChanged, () => this.refreshCard());
    // The keyboard shortcuts act on every machine at once.
    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.benches.some((b) => b.phase === 'ready')) void this.cut();
      else if (this.benches.some((b) => b.phase === 'revealed')) this.sell(1);
    });
    this.scale.on(Phaser.Scale.Events.RESIZE, this.computeStage, this);
    this.events.on(Phaser.Scenes.Events.WAKE, this.onEnter, this);
    const cleanup = (): void => this.cleanup(false);
    this.events.on(Phaser.Scenes.Events.SLEEP, cleanup);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cleanup(true);
      this.events.off(Phaser.Scenes.Events.SLEEP, cleanup);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.computeStage, this);
      this.events.off(Phaser.Scenes.Events.WAKE, this.onEnter, this);
    });
    this.onEnter();
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 100);
    this.updateAdButton();
    for (const bench of this.benches) bench.update(dt);
    if (this.legendaryHue >= 0) {
      this.legendaryHue = (this.legendaryHue + dt * 0.12) % 360;
      const tint = Phaser.Display.Color.HSVToRGB(this.legendaryHue / 360, 0.35, 1).color;
      for (const star of this.chipStars) star.setTint(tint);
    }
  }

  // ---------- construction ----------

  /** Creates/removes machine units when the Extra Saws level changes. */
  private syncBenches(): void {
    const wanted = state.sawCount;
    while (this.benches.length < wanted) {
      const bench = new SawBench(this, this.benches.length, this.fx);
      // Keep machines below the card and the particle pools, even when bought mid-run.
      const cardIndex = this.card ? this.stage.getIndex(this.card) : this.benches.length;
      this.stage.addAt(bench.root, Math.min(this.benches.length, cardIndex));
      this.benches.push(bench);
    }
    while (this.benches.length > wanted) {
      const bench = this.benches.pop();
      if (!bench) break;
      if (bench.rock) releaseRockTextures(this.textures, bench.rock);
      bench.destroy();
    }
  }

  private buildCard(): void {
    this.card = this.add.graphics();
    this.chipBg = this.add.graphics();
    this.chipText = this.add.text(0, 0, '', outlinedStyle(22)).setOrigin(0.5);
    this.chipStars = Array.from({ length: 5 }, () => this.add.image(0, 0, ICON_STAR).setVisible(false));
    this.chip = this.add.container(0, 0, [this.chipBg, this.chipText, ...this.chipStars]).setVisible(false);
    this.title = this.add.text(0, 0, '', textStyle(34, PALETTE.ink)).setOrigin(0.5);
    this.sub = this.add.text(0, 0, '', textStyle(19, '#8a6a4a', { fontStyle: '500', align: 'center' })).setOrigin(0.5);
    this.big = this.add.text(0, 0, '', outlinedStyle(56, PALETTE.money)).setOrigin(0.5);
    this.cutBtn = new Button(this, {
      width: 280, height: 74, label: '', icon: ICON_SAW, fontSize: 40, colors: BUTTON_COLORS.orange,
      onClick: () => void this.cut(),
    });
    this.sellBtn = new Button(this, {
      width: 280, height: 74, label: '', icon: uiIcon('cash'), fontSize: 40, colors: BUTTON_COLORS.green,
      onClick: () => this.sell(1),
    });
    this.cutBtn.setVisible(false);
    this.sellBtn.setVisible(false);
    this.adBtn = new Button(this, {
      width: 280, height: 50, label: '2x', icon: uiIcon('watch'), fontSize: 24, colors: BUTTON_COLORS.blue,
      onClick: () => this.sellDoubled(),
    });
    this.adBtn.setVisible(false);
    // A picture where the big number goes while no rock is on the bench (all done / pick a rock).
    this.bigIcon = this.add.image(0, 0, uiIcon('bag')).setVisible(false);
    this.stage.add([this.card, this.chip, this.title, this.sub, this.big, this.bigIcon, this.cutBtn, this.sellBtn, this.adBtn]);
  }

  private buildEffects(): void {
    this.sparkFx = this.add.particles(0, 0, 'spark', {
      emitting: false,
      lifespan: { min: 250, max: 500 },
      speed: { min: 220, max: 520 },
      angle: { min: 195, max: 345 },
      gravityY: 900,
      rotate: { onEmit: () => 0, onUpdate: (p) => Phaser.Math.RadToDeg(Math.atan2(p.velocityY, p.velocityX)) },
      scale: { start: 1, end: 0.3 },
      tint: [0xffffff, 0xffe28a, 0xffb347],
      blendMode: Phaser.BlendModes.ADD,
    });
    this.dustFx = this.add.particles(0, 0, 'soft', {
      emitting: false,
      lifespan: 700,
      speed: { min: 30, max: 120 },
      angle: { min: 180, max: 360 },
      scale: { start: 0.5, end: 2 },
      alpha: { start: 0.5, end: 0 },
      tint: 0xd9cfc2,
    });
    this.burstFx = this.add.particles(0, 0, 'star', {
      emitting: false,
      lifespan: { min: 600, max: 1000 },
      speed: { min: 150, max: 520 },
      scale: { start: 0.9, end: 0 },
      rotate: { min: 0, max: 360 },
      gravityY: 200,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.confettiFx = this.add.particles(0, 0, 'confetti', {
      emitting: false,
      lifespan: 1800,
      speed: { min: 300, max: 700 },
      angle: { min: 220, max: 320 },
      gravityY: 700,
      rotate: { start: 0, end: 720 },
      scaleX: { start: 1.2, end: 0.2, ease: 'Sine.easeInOut' },
      scaleY: 1.2,
      tint: [0xff5a5f, 0xffd23f, 0x5fcf6e, 0x4fb0ff, 0xb565ff, 0xff9ad5],
    });
    this.glitterFx = this.add.particles(0, 0, 'star', {
      emitting: false,
      lifespan: 900,
      speed: { min: 5, max: 30 },
      scale: { start: 0, end: 0.6, ease: 'Sine.easeOut' },
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
    });
    // One pooled emitter each; never created per rock. Drawn above the benches.
    this.stage.add([this.dustFx, this.burstFx, this.glitterFx, this.sparkFx, this.confettiFx]);
  }

  // ---------- layout ----------

  /** Recomputes the stage, the card and every machine view from the current viewport. */
  private computeStage(): void {
    const { width: w, height: h } = this.scale;
    const L = (this.L = computeLayout(w, h, state.inventory.capacity));
    const count = this.benches.length;
    let S: StageLayout;
    let views: { x: number; bedY: number; scale: number }[];

    if (count <= 1) {
      // Exactly the original stage and position for a single machine.
      S = L.play.w / L.play.h < 1.05 ? TALL_STAGE : WIDE_STAGE;
      views = [{ x: S.machineX, bedY: S.bedY, scale: 1 }];
    } else {
      // Several machines: a compact card plus a row (wide) or 2-column grid (portrait).
      const portrait = L.play.w / L.play.h < 1.05;
      const cardW = portrait ? Math.min(L.play.w - 24, 520) : Math.min(360, L.play.w * 0.28);
      const cardH = portrait ? Math.min(150, L.play.h * 0.24) : Math.min(340, L.play.h * 0.62);
      // Stage-local coordinates (the stage is already positioned at L.play).
      const cardX = portrait ? L.play.w / 2 : L.play.w - cardW / 2 - 12;
      const cardY = portrait ? L.play.h - cardH / 2 - 8 : L.play.h / 2;
      S = { w: L.play.w, h: L.play.h, machineX: 0, bedY: 0, cardX, cardY, cardW, cardH };

      const areaX0 = 12;
      const areaX1 = portrait ? L.play.w - 12 : cardX - cardW / 2 - 12;
      // Leaves room for the HUD chips (money, level, daily goal, debt) above the machines.
      const areaY0 = portrait ? (L.compact ? 44 : 60) : L.play.y + 36;
      const areaY1 = portrait ? cardY - cardH / 2 - 18 : L.play.h - 16;
      const areaW = Math.max(120, areaX1 - areaX0);
      const areaH = Math.max(140, areaY1 - areaY0);
      const cols = portrait ? Math.min(2, count) : count;
      const rows = Math.ceil(count / cols);
      const cellH = areaH / rows;
      // One machine is about 395 stage units wide (base with its control box) and 430 tall (blade travel
      // included); neighbours may overlap by roughly half a base, so the row spacing is 190 units.
      const MACHINE_HALF_W = 197;
      const SPACING = 190;
      const s = Math.min(areaW / (2 * MACHINE_HALF_W + SPACING * (cols - 1)), cellH / 430, portrait ? 0.55 : 0.85);
      const half = MACHINE_HALF_W * s;
      const step = cols > 1 ? (areaW - 2 * half) / (cols - 1) : 0;
      views = [];
      for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        views.push({
          x: cols > 1 ? areaX0 + half + col * step : areaX0 + areaW / 2,
          bedY: areaY0 + row * cellH + 290 * s + (cellH - 410 * s) / 2,
          scale: s,
        });
      }
      S.machineX = views[0].x;
      S.bedY = views[0].bedY;
    }
    this.S = S;
    const scale = Math.min(L.play.w / S.w, L.play.h / S.h);
    this.stage.setScale(scale).setPosition(L.play.x + (L.play.w - S.w * scale) / 2, L.play.y + (L.play.h - S.h * scale) / 2);

    // Full-screen workshop wall and bench, as in the original scene.
    const benchY = this.stage.y + (S.bedY + 85) * scale;
    const g = this.backdrop;
    g.clear();
    g.fillStyle(0x2f5d62).fillRect(0, 0, w, h);
    const plank = Math.max(48, 90 * scale);
    for (let x = -((w / 2) % plank); x < w; x += plank) {
      g.fillStyle(0x2a5459).fillRect(x, 0, 4, benchY);
      g.fillStyle(0x386c71).fillRect(x + 4, 0, 3, benchY);
    }
    g.fillStyle(0x264b50).fillRect(0, benchY - 40 * scale, w, 10 * scale);
    g.fillStyle(0x000000, 0.18).fillRect(0, benchY - 8, w, 14);
    g.fillStyle(0xc4844e).fillRect(0, benchY, w, 26 * scale);
    g.fillStyle(0xe0a46a).fillRect(0, benchY, w, 6 * scale);
    g.fillStyle(0x8c5532).fillRect(0, benchY + 26 * scale, w, h - benchY);
    for (let y = benchY + 60 * scale; y < h; y += 46 * scale) g.fillStyle(0x7a4a2b).fillRect(0, y, w, 4 * scale);
    this.lamp.setPosition(this.stage.x + S.machineX * scale, this.stage.y + (S.bedY - 150) * scale)
      .setScale((520 * scale * views[0].scale) / 64);

    this.benches.forEach((bench, i) => bench.setView(views[i]));
    this.drawCard();
  }

  /** True for the short card of several machines on a phone: the stars chip is dropped and the buttons shrink. */
  private tightCard(): boolean {
    return this.benches.length > 1 && this.S.cardH < 200;
  }

  private btnScale(): number {
    return this.tightCard() ? 0.62 : 1;
  }

  private drawCard(): void {
    const { cardX: x, cardY: y, cardW: w, cardH: h } = this.S;
    const g = this.card;
    g.clear();
    g.fillStyle(0x000000, 0.25).fillRoundedRect(x - w / 2, y - h / 2 + 8, w, h, 28);
    g.fillStyle(PALETTE.cream).fillRoundedRect(x - w / 2, y - h / 2, w, h, 28);
    g.fillStyle(PALETTE.creamShade).fillRoundedRect(x - w / 2 + 10, y + h * 0.12, w - 20, h * 0.38 - 10, 20);
    g.lineStyle(4, 0xe2c497).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 28);
    const tight = this.tightCard();
    this.chip.setPosition(x, y - h * 0.37);
    this.title.setFontSize(tight ? 22 : this.benches.length > 1 ? 26 : 34).setPosition(x, y - h * (tight ? 0.3 : 0.21)).setWordWrapWidth(w - 40);
    this.sub.setPosition(x, y - h * 0.07).setWordWrapWidth(w - 40);
    this.big.setPosition(x, y + h * (tight ? -0.02 : 0.1));
    this.bigIcon.setPosition(x, y + h * (tight ? -0.02 : 0.1)).setDisplaySize(tight ? 56 : 84, tight ? 56 : 84);
    this.cutBtn.setPosition(x, y + h * (tight ? 0.3 : 0.33)).setScale(this.btnScale());
    this.sellBtn.setPosition(x, y + h * (tight ? 0.3 : 0.33)).setScale(this.btnScale());
    this.adBtn.setPosition(x, y + h * 0.33 + 64);
  }

  private stageToScreen(x: number, y: number): { x: number; y: number } {
    const s = this.stage.scaleX;
    return { x: this.stage.x + x * s, y: this.stage.y + y * s };
  }

  private screenToStage(x: number, y: number): { x: number; y: number } {
    const s = this.stage.scaleX;
    return { x: (x - this.stage.x) / s, y: (y - this.stage.y) / s };
  }

  // ---------- flow ----------

  private onEnter(): void {
    this.cameras.main.fadeIn(220, 30, 20, 12);
    this.cleanup(false);
    this.syncBenches();
    this.computeStage();
    if (this.benches.every((b) => b.phase === 'empty')) this.autoPlace();
    else this.refreshCard();
  }

  /** Fills every free machine with a different uncut rock from the bag. */
  private autoPlace(): void {
    if (!state.canCut) return;
    const placed = new Set(this.benches.map((b) => b.rock?.id).filter((id): id is string => !!id));
    let started = false;
    for (const bench of this.benches) {
      if (bench.phase !== 'empty') continue;
      let next: Rock | null = null;
      for (let i = 0; i < state.inventory.capacity; i++) {
        const rock = state.inventory.get(i);
        if (rock && !rock.cut && !placed.has(rock.id)) { next = rock; break; }
      }
      if (!next) break;
      placed.add(next.id);
      this.placeOn(bench, next);
      started = true;
    }
    if (!started) this.refreshCard();
  }

  private onSlotSelected(id: string): void {
    if (!state.canCut) return;
    const onBench = this.benches.find((b) => b.rock?.id === id && (b.phase === 'ready' || b.phase === 'placing'));
    if (onBench) {
      // Tapping a rock that is already on a machine takes it off again.
      if (onBench.phase !== 'ready') return;
      const back = this.slotStagePos(state.inventory.indexOf(id));
      this.syncPlaced();
      void onBench.returnToSlot(back, this.slotIconScale()).then(() => { this.syncPlaced(); this.refreshCard(); });
      return;
    }
    const index = state.inventory.indexOf(id);
    const rock = state.inventory.get(index);
    if (!rock || rock.cut) return;
    const free = this.benches.find((b) => b.phase === 'empty');
    if (free) {
      this.placeOn(free, rock);
      return;
    }
    // All machines busy: swap out the first ready rock, as the original did.
    const swap = this.benches.find((b) => b.phase === 'ready' && b.rock);
    if (!swap) return;
    const back = this.slotStagePos(state.inventory.indexOf(swap.rock!.id));
    void swap.returnToSlot(back, this.slotIconScale()).then(() => this.placeOn(swap, rock));
  }

  private slotStagePos(index: number): { x: number; y: number } {
    const c = slotCenter(this.L, Math.max(0, index));
    return this.screenToStage(c.x, c.y);
  }

  private slotIconScale(): number {
    return iconScale(this.L.slotSize * GAME_CONFIG.rock.inventoryScale) / this.stage.scaleX;
  }

  private placeOn(bench: SawBench, rock: Rock): void {
    const from = this.slotStagePos(state.inventory.indexOf(rock.id));
    const flight = bench.place(rock, from, this.slotIconScale());
    // After place() has claimed the rock, so the bag markers include this one too.
    this.syncPlaced();
    this.refreshCard();
    void flight.then(() => {
      this.refreshCard();
      this.autoPlace();
    });
  }

  /** Notifies the HUD which bag slots are currently marked as "on a bench". */
  private syncPlaced(): void {
    // A rock already being sold is no longer "on the bench" for the bag's markers.
    state.setPlacedRockIds(this.benches.map((b) => (b.phase === 'selling' ? '' : (b.rock?.id ?? ''))));
  }

  /** Cuts every ready machine in parallel; one saw sound for the whole batch. */
  private async cut(): Promise<void> {
    const ready = this.benches.filter((b) => b.phase === 'ready' && b.rock);
    if (!ready.length || !state.canCut) return;
    state.setBusy(true);
    this.refreshCard();
    this.saw = sfx.startSaw();
    const saw = this.saw;
    await Promise.all(ready.map((b) => b.cutDown()));
    saw.grind(true);
    await Promise.all(ready.map((b) => b.cutThrough()));
    saw.grind(false);
    await Promise.all(ready.map((b) => b.cutUp()));
    saw.stop();
    this.saw = null;

    // Master Cutter is rolled per rock: the cross-section is repainted before reveal.
    for (const bench of ready) {
      const rock = bench.rock!;
      if (state.rollLuckyCut(rock)) {
        this.textures.remove(rockKeys(rock).inside);
        ensureRockTextures(this.textures, rock);
        bench.refreshInside();
      }
    }
    await Promise.all(ready.map((b) => b.wobble()));
    const maxTier = Math.max(...ready.map((b) => b.rock!.rarity.tier));
    if (maxTier >= 3) {
      this.cameras.main.shake(260, 0.0025);
      await this.wait(280);
    }
    for (const bench of ready) this.revealBench(bench);
    this.refreshCard();
    this.animateRevealCard(ready.reduce((sum, b) => sum + b.rock!.value, 0), maxTier);
    if (ready.length >= 2) this.playCombo(ready);
  }

  /** Floating "LUCKY CUT!" over the machine when Master Cutter pays off. */
  private flashLuckyCut(bench: SawBench): void {
    const small = this.benches.length > 1;
    const t = this.add.text(bench.x, bench.rockCenterY() - (small ? 60 : 100), 'LUCKY CUT!',
      outlinedStyle(small ? 26 : 36, '#ffe27a')).setOrigin(0.5).setScale(0.4).setDepth(40);
    this.floaters.push(t);
    this.tweens.add({ targets: t, scale: 1.1, duration: 240, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: t.y - 44, alpha: 0, delay: 900, duration: 400, onComplete: () => t.destroy() });
    this.cameras.main.flash(140, 255, 236, 150);
  }

  /** Reveal FX for one machine. For batches the combined effect supplies the shake/flash. */
  private revealBench(bench: SawBench): void {
    const rock = bench.rock;
    if (!rock) return;
    const tier = rock.rarity.tier;
    const dud = !!rock.mineral.dud || rock.value <= 0;
    const tint = revealColor(rock);
    const x = bench.x;
    const cy = bench.rockCenterY();
    const s = bench.scale;

    state.inventory.markCut(rock.id);
    state.recordCut(rock);
    bench.reveal();

    const color = Phaser.Display.Color.IntegerToColor(tint);
    if (s === 1 && !dud) this.cameras.main.flash(120 + tier * 70, color.red, color.green, color.blue);
    if (s === 1 && !dud && rock.mineral.reveal === 'storm') {
      this.delay(150, () => this.cameras.main.flash(90, 170, 225, 255));
    }
    if (s === 1 && tier >= 2) this.cameras.main.shake(180 + tier * 70, 0.002 + tier * 0.0015);
    this.dustFx.explode(8, x, cy);
    if (!dud) {
      if (rock.mineral.reveal === 'rainbow') {
        [0xff9ad5, 0x7fe0d0, 0xffe27a].forEach((c, i) => {
          this.burstFx.setParticleTint(c);
          this.burstFx.explode(Math.ceil((8 + tier * 10) / 3), x, cy - 8 * s + i * 8);
        });
      } else {
        this.burstFx.setParticleTint(tint);
        this.burstFx.explode(8 + tier * 10, x, cy);
      }
    }
    if (tier >= 4) {
      this.confettiFx.explode(70, x, cy);
      this.delay(350, () => this.confettiFx.explode(50, x, cy - 60 * s));
    }
    sfx.reveal(tier, rock.value);
  }

  /** Banner, bench-wide confetti, shake and a rising chime for multi-rock cuts. */
  private playCombo(benches: SawBench[]): void {
    const n = benches.length;
    const rocks = benches.map((b) => b.rock!);
    const total = rocks.reduce((sum, r) => sum + r.value, 0);
    const maxTier = Math.max(...rocks.map((r) => r.rarity.tier));
    const big = total >= 150 || maxTier >= 3;
    const label = n === 2 ? 'DOUBLE CUT!' : n === 3 ? 'TRIPLE CUT!' : n === 4 ? 'QUAD CUT!' : `${n}x CUT!`;

    // Several machines: float the banner over the row, just above the rocks, clear of the HUD.
    const bannerX = n > 1 ? benches.reduce((sum, b) => sum + b.x, 0) / n : this.S.machineX;
    const bannerY = n > 1 ? benches.reduce((sum, b) => sum + b.rockCenterY(), 0) / n - 40 * (this.benches[0]?.viewScale ?? 1) : 80;
    const t = this.add.text(bannerX, bannerY, label,
      outlinedStyle(32 + n * 4 + (big ? 6 : 0), '#ffe27a')).setOrigin(0.5).setScale(0.3).setDepth(50);
    this.floaters.push(t);
    this.tweens.add({ targets: t, scale: 1.15, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: bannerY - 24, alpha: 0, delay: 950, duration: 420, onComplete: () => t.destroy() });

    this.cameras.main.shake(140 + n * 20, 0.0012 + n * 0.0004 + (maxTier >= 3 ? 0.0006 : 0));
    this.confettiFx.explode(30 + n * 14 + (big ? 20 : 0), bannerX, this.S.bedY - 60);
    this.burstFx.setParticleTint(big ? 0xffe27a : 0xffb347);
    for (const bench of benches) this.burstFx.explode(6 + maxTier * 3, bench.x, bench.rockCenterY());

    // Built from existing cues only. 170ms gaps respect every CUE_RULES repeat limit.
    const cues: Array<() => void> = [
      () => sfx.coin(),
      () => sfx.discover(),
      () => sfx.reveal(Math.min(5, maxTier + 1), Math.max(30, total)),
    ];
    if (big) cues.push(() => sfx.coin());
    cues.forEach((cue, i) => this.delay(i * 170, cue));
  }

  /** "Sell for double" only for a single revealed rock worth the wait. */
  private updateAdButton(): void {
    const revealed = this.benches.filter((b) => b.phase === 'revealed' && b.rock);
    const rock = revealed.length === 1 ? revealed[0].rock : null;
    const show = !!rock && rock.value >= AD_SELL_MIN_VALUE && portal.rewardedReady && this.sellBtn.visible;
    if (this.adBtn.visible !== show) this.adBtn.setVisible(show);
  }

  private sellDoubled(): void {
    if (this.benches.filter((b) => b.phase === 'revealed' && b.rock).length !== 1) return;
    portal.rewarded(() => this.sell(2), (granted) => {
      if (!granted) sfx.denied();
    });
  }

  /** Sells every revealed rock together: one money pop-up, all normal per-rock effects. */
  private sell(multiplier = 1): void {
    const revealed = this.benches.filter((b) => b.phase === 'revealed' && b.rock);
    if (!revealed.length) return;
    const rocks = revealed.map((b) => b.rock!);
    for (const bench of revealed) bench.phase = 'selling';
    this.adBtn.setVisible(false);
    let total = 0;
    let maxTier = 0;
    for (const rock of rocks) {
      const amount = state.economy.sell(rock, multiplier * state.sellMult);
      total += amount;
      maxTier = Math.max(maxTier, rock.rarity.tier);
      // Throwing a worthless rock away loads the shovel (Scrap Shot).
      if (amount <= 0 && state.traits.onWorthlessThrown()) state.bus.emit(EVT.toast, 'Shovel loaded!');
    }
    const p = this.stageToScreen(this.big.x, this.big.y);
    state.bus.emit(EVT.sale, total, p.x, p.y, maxTier);
    for (const rock of rocks) state.inventory.remove(rock.id);
    this.syncPlaced();
    // The HUD's sale listener already plays sfx.sell(), so don't double it here.

    this.tweens.add({ targets: this.sellBtn, scale: 0, duration: 160, ease: 'Back.easeIn' });
    this.tweens.add({ targets: this.big, scale: { from: 1.3, to: 1 }, duration: 260, ease: 'Back.easeOut' });
    this.legendaryHue = -1;
    for (const star of this.chipStars) star.clearTint();
    void Promise.all(revealed.map((b) => b.sellOut())).then(() => {
      for (const rock of rocks) releaseRockTextures(this.textures, rock);
      this.sellBtn.setVisible(false).setScale(this.btnScale());
      state.setBusy(false);
      this.delay(220, () => this.autoPlace());
    });
  }

  // ---------- card ----------

  /** Restores the original reveal-card animation (counts up to the combined payout). */
  private animateRevealCard(target: number, tier: number): void {
    this.chip.setScale(0);
    this.tweens.add({ targets: this.chip, scale: 1 + tier * 0.06, delay: 120, duration: 420, ease: 'Back.easeOut', easeParams: [2.5] });
    this.title.setScale(0.6);
    this.tweens.add({ targets: this.title, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.bigCounter.value = 0;
    this.tweens.addCounter({
      from: 0,
      to: target,
      duration: 450 + tier * 160,
      ease: 'Quad.easeOut',
      onUpdate: (tw: Phaser.Tweens.Tween) => {
        this.bigCounter.value = tw.getValue() ?? 0;
        this.big.setText(formatMoney(Math.round(this.bigCounter.value)));
      },
    });
    this.sellBtn.setVisible(true).setScale(0);
    this.tweens.add({ targets: this.sellBtn, scale: this.btnScale(), delay: 380 + tier * 100, duration: 320, ease: 'Back.easeOut' });
  }

  private refreshCard(): void {
    const revealed = this.benches.filter((b) => b.phase === 'revealed' && b.rock);
    const ready = this.benches.filter((b) => b.phase === 'ready' && b.rock);
    // The card follows the best revealed rock, otherwise the first rock being prepared.
    const focus = [...revealed].sort((a, b) => b.rock!.value - a.rock!.value)[0]
      ?? ready[0]
      ?? this.benches.find((b) => b.rock) ?? null;
    const rock = focus?.rock ?? null;
    const showChip = revealed.length > 0;
    this.chip.setVisible(showChip && !this.tightCard());
    this.cutBtn.setVisible(ready.length > 0).setEnabled(state.canCut);
    if (!showChip) this.sellBtn.setVisible(false);
    this.big.setScale(1).setFontSize(this.tightCard() ? 40 : 56);
    // No words here: a picture says what to do next.
    this.title.setText('');
    this.sub.setText('');
    this.bigIcon.setVisible(!rock);

    if (!rock) {
      const none = state.inventory.uncutCount === 0;
      this.big.setText('');
      this.bigIcon.setTexture(none ? uiIcon('check') : uiIcon('bag'));
      return;
    }
    this.sellBtn.setIcon(rock.value > 0 ? uiIcon('cash') : uiIcon('junk'));
    if (!showChip) {
      this.big.setText('?').setColor(PALETTE.money);
      return;
    }
    if (revealed.length > 1) {
      const total = revealed.reduce((sum, b) => sum + b.rock!.value, 0);
      this.title.setText(`${revealed.length} ROCKS REVEALED`);
      this.big.setText(formatMoney(total));
    } else {
      this.title.setText(rock.mineral.name);
      this.big.setText(formatMoney(rock.value));
    }
    this.big.setColor(rock.mineral.dud || rock.value <= 0 ? '#d8d0c4' : PALETTE.money);
    const tier = rock.rarity.tier;
    const n = rock.rarity.id === 'worthless' ? 0 : tier + 1;
    const sz = 32 + tier * 3;
    const gap = sz * 0.9;
    this.chipStars.forEach((star, i) => star.setVisible(i < n).setDisplaySize(sz, sz).setPosition((i - (n - 1) / 2) * gap, -1));
    const cw = n * gap + 44;
    const ch = sz + 18;
    this.chipBg.clear();
    this.chipBg.fillStyle(0x000000, 0.25).fillRoundedRect(-cw / 2, -ch / 2 + 3, cw, ch, ch / 2);
    this.chipBg.fillStyle(rock.rarity.color).fillRoundedRect(-cw / 2, -ch / 2, cw, ch, ch / 2);
    this.chipBg.fillStyle(0xffffff, 0.25).fillRoundedRect(-cw / 2 + 6, -ch / 2 + 3, cw - 12, ch * 0.35, ch * 0.17);
    this.legendaryHue = tier >= 4 ? 0 : -1;
    if (tier < 4) for (const star of this.chipStars) star.clearTint();
  }

  // ---------- cleanup & helpers ----------

  /** Strictly stops saw, tracked timers, tweens and floating labels. */
  private cleanup(deep: boolean): void {
    const interrupted = !deep && state.mode === 'workshop'
      && this.benches.some((b) => b.phase === 'cutting' || b.phase === 'placing');
    this.saw?.stop();
    this.saw = null;
    for (const timer of this.timers) timer.remove();
    this.timers.length = 0;
    for (const label of this.floaters) label.destroy();
    this.floaters.length = 0;
    this.tweens.killTweensOf([this.chip, this.title, this.big, this.bigCounter, this.chipStars, this.cutBtn, this.sellBtn, this.adBtn]);
    for (const bench of this.benches) bench.clear();
    // A cancelled cut would otherwise leave the game "busy" forever.
    if (interrupted) state.setBusy(false);
    if (deep) {
      for (const bench of this.benches) {
        if (bench.rock) releaseRockTextures(this.textures, bench.rock);
        bench.destroy();
      }
      this.benches = [];
      state.setPlacedRockIds([]);
    }
  }

  /** Tracked delayed call (removed on SLEEP/SHUTDOWN). */
  private delay(ms: number, callback: () => void): void {
    const timer = this.time.delayedCall(ms, () => {
      const i = this.timers.indexOf(timer);
      if (i >= 0) this.timers.splice(i, 1);
      callback();
    });
    this.timers.push(timer);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.delay(ms, resolve));
  }
}

/** Tint of the reveal burst and rays: the mineral's own feel beats the plain rarity colour. */
function revealColor(rock: Rock): number {
  switch (rock.mineral.reveal) {
    case 'embers': return 0xff8a2b;
    case 'frost': return 0xcfeaff;
    case 'storm': return 0x7fd0ff;
    case 'stars': return 0xfff3c0;
    case 'shimmer': return 0xe8ecf2;
    case 'glow': return rock.mineral.colors[0];
    case 'rainbow': return 0xff9ad5;
    default: return rock.rarity.color;
  }
}
