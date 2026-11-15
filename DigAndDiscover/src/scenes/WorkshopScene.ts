import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/GameConfig';
import { BUTTON_COLORS, PALETTE, outlinedStyle, textStyle } from '../config/Theme';
import { EVT, state, subscribe } from '../core/GameState';
import type { Rock } from '../core/types';
import { ART_RES, iconScale, releaseRockTextures, rockKeys } from '../art/RockArt';
import { sfx, type SawHandle } from '../audio/Sfx';
import { portal } from '../ads/Portal';
import { ICON_STAR } from '../art/IconArt';
import { uiIcon } from '../art/UiIcons';
import { Button } from '../ui/Button';
import { computeLayout, slotCenter, type Layout } from '../ui/layout';
import { formatMoney } from '../ui/MoneyCounter';

type BenchState = 'empty' | 'placing' | 'ready' | 'cutting' | 'revealed' | 'selling';

interface StageLayout {
  w: number;
  h: number;
  machineX: number;
  /** Width the machine picture is drawn at. */
  machineW: number;
  bedY: number;
  cardX: number;
  cardY: number;
  cardW: number;
  cardH: number;
  /** Scale of the card picture (its bottom part, with the two button slots, keeps this size). */
  cardScale: number;
  /** The two station tabs (saw, crusher): where they are and which way they line up. */
  tabsX: number;
  tabsY: number;
  tabsRow: boolean;
}

const WIDE_STAGE: StageLayout = { w: 980, h: 600, machineX: 300, machineW: 500, bedY: 430, cardX: 770, cardY: 300, cardW: 300, cardH: 400, cardScale: 0.714, tabsX: 770, tabsY: 46, tabsRow: true };
const TALL_STAGE: StageLayout = { w: 640, h: 860, machineX: 320, machineW: 480, bedY: 400, cardX: 320, cardY: 706, cardW: 360, cardH: 300, cardScale: 0.68, tabsX: 34, tabsY: 70, tabsRow: false };

/** The supplied saw table (assets/workshop/machine2.png), measured in its own pixels. */
const MACHINE_ART = { w: 700, h: 803, bed: 602, beam: 88, playX: 532, playY: 738, playD: 100 };
/** The supplied card (assets/workshop/card.png): its frame, and where the bottom part with the two slots starts. */
const CARD_ART = { w: 420, h: 565, edge: 45, bottom: 213, bigBottom: 208, slot1: 165, slot2: 92, slotH1: 60, slotH2: 68 };
/** Drawn radius of the circular blade, in stage pixels. */
const SAW_R = 80;

/** Rocks worth at least this much offer a "sell for double" ad. */
const AD_SELL_MIN_VALUE = 30;
const BLADE_REST = -300;
const BLADE_END = -62;
const RAY_COUNT = 12;

/**
 * The workshop: place a rock on the bench, run the saw, reveal the inside
 * with a rarity-scaled celebration, then sell. Everything lives in a logical
 * "stage" container that is scaled to fit the play area.
 */
export class WorkshopScene extends Phaser.Scene {
  private S: StageLayout = WIDE_STAGE;
  private L!: Layout;
  private backdrop!: Phaser.GameObjects.Image;
  private lamp!: Phaser.GameObjects.Image;
  private stage!: Phaser.GameObjects.Container;
  private machine!: Phaser.GameObjects.Image;
  private machineShadow!: Phaser.GameObjects.Image;
  private rays!: Phaser.GameObjects.Container;
  private rod!: Phaser.GameObjects.Rectangle;
  private blade!: Phaser.GameObjects.Image;
  private lampTime = 0;
  private rockImg!: Phaser.GameObjects.Image;
  private cutLine!: Phaser.GameObjects.Rectangle;
  private halves: Phaser.GameObjects.Image[] = [];
  /** Everything that belongs to the saw table (machine, rock, blade, effects, result card). */
  private sawGroup!: Phaser.GameObjects.Container;
  /** The rock crusher: shown dimmed and locked, with a "coming soon" label. */
  private crusherGroup!: Phaser.GameObjects.Container;
  private crusher!: Phaser.GameObjects.Image;
  private crusherLock!: Phaser.GameObjects.Image;
  private crusherRibbon!: Phaser.GameObjects.Graphics;
  private crusherLabel!: Phaser.GameObjects.Text;
  private ribbonBox!: Phaser.GameObjects.Container;
  private tabs: { id: 'saw' | 'crusher'; c: Phaser.GameObjects.Container; ring: Phaser.GameObjects.Graphics }[] = [];
  private station: 'saw' | 'crusher' = 'saw';
  private card!: Phaser.GameObjects.NineSlice;
  private titleSize = 34;
  private bigSize = 56;
  private chip!: Phaser.GameObjects.Container;
  private chipBg!: Phaser.GameObjects.Graphics;
  private chipText!: Phaser.GameObjects.Text;
  private chipStars: Phaser.GameObjects.Image[] = [];
  private title!: Phaser.GameObjects.Text;
  private sub!: Phaser.GameObjects.Text;
  private big!: Phaser.GameObjects.Text;
  private bigIcon!: Phaser.GameObjects.Image;
  private playGlow!: Phaser.GameObjects.Image;
  private playIcon!: Phaser.GameObjects.Image;
  private playZone!: Phaser.GameObjects.Zone;
  /** The rock is on the bench and the saw may start. */
  private playReady = false;
  private sellBtn!: Button;
  private adBtn!: Button;
  private sparkFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dustFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private burstFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confettiFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private glitterFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private glitterTimer: Phaser.Time.TimerEvent | null = null;

  private bench: BenchState = 'empty';
  private current: Rock | null = null;
  private bladeSpeed = 0;
  private bladeTarget = 0;
  private saw: SawHandle | null = null;
  private cutting = false;
  private raysSpin = 0;
  private bigCounter = { value: 0 };
  private legendaryHue = -1;

  constructor() {
    super('Workshop');
  }

  create(): void {
    this.halves = [];
    this.bench = 'empty';
    this.current = null;
    this.backdrop = this.add.image(0, 0, 'workshop-bg').setOrigin(0, 0);
    this.lamp = this.add.image(0, 0, 'soft').setTint(0xffd9a0).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    this.stage = this.add.container(0, 0);
    this.sawGroup = this.add.container(0, 0);
    this.crusherGroup = this.add.container(0, 0).setVisible(false);
    this.station = 'saw';
    this.stage.add([this.sawGroup, this.crusherGroup]);
    this.buildStage();
    this.buildCard();
    this.buildEffects();
    this.buildCrusher();

    subscribe(this, EVT.slotSelected, (id: string) => this.onSlotSelected(id));
    subscribe(this, EVT.dayPhaseChanged, () => this.refreshCard());
    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.bench === 'ready') this.pressPlay();
      else if (this.bench === 'revealed') this.sellBtn.trigger();
    });
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.on(Phaser.Scenes.Events.WAKE, this.onEnter, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.events.off(Phaser.Scenes.Events.WAKE, this.onEnter, this);
    });
    this.onResize();
    this.onEnter();
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 100);
    this.updateAdButton();
    this.bladeSpeed += (this.bladeTarget - this.bladeSpeed) * Math.min(1, dt / 220);
    if (this.bladeSpeed > 0.001) this.blade.rotation += this.bladeSpeed * dt * 0.03;
    this.rod.height = Math.max(0, this.blade.y - this.rodTop());
    this.animateMachine(dt);
    if (this.cutting && this.current) {
      const rx = this.S.machineX;
      this.rockImg.x = rx + Phaser.Math.FloatBetween(-1.6, 1.6);
      const contact = Math.min(this.blade.y + SAW_R, this.S.bedY - 4);
      const top = this.rockTop();
      if (contact > top) {
        this.cutLine.setPosition(rx, top).setSize(5, contact - top).setVisible(true);
        this.sparkFx.emitParticleAt(rx, contact, 2);
        if (Math.random() < 0.3) this.dustFx.emitParticleAt(rx, contact, 1);
      }
    }
    if (this.rays.visible) this.rays.rotation += this.raysSpin * dt;
    if (this.legendaryHue >= 0) {
      this.legendaryHue = (this.legendaryHue + dt * 0.12) % 360;
      const tint = Phaser.Display.Color.HSVToRGB(this.legendaryHue / 360, 0.35, 1).color;
      for (const star of this.chipStars) star.setTint(tint);
    }
  }

  /** The machine's start key (blue button, or SPACE). */
  private pressPlay(): void {
    if (this.bench !== 'ready' || !state.canCut) {
      if (this.bench === 'ready') sfx.denied();
      return;
    }
    sfx.click();
    void this.cut();
  }

  /** Where the saw's rod hangs from: the middle of the machine's top beam. */
  private rodTop(): number {
    return this.S.bedY - (MACHINE_ART.bed - MACHINE_ART.beam) * (this.S.machineW / MACHINE_ART.w);
  }

  /**
   * Life in the machine: the play button on the base (lit and breathing while a rock waits), a
   * tremble through the frame and the blade while it cuts, and a slight sway when it parks.
   */
  private animateMachine(dt: number): void {
    this.lampTime += dt;
    const S = this.S;
    const k = this.machine.scaleX;
    const shake = this.cutting ? Phaser.Math.FloatBetween(-1.3, 1.3) : 0;
    this.machine.x = S.machineX + shake * 0.6;
    this.blade.x = S.machineX + shake;
    this.rod.x = S.machineX + shake;
    const pulse = 0.5 + 0.5 * Math.sin(this.lampTime / 520);
    // The play button on the base: a glow and a gentle pulse while a rock waits on the bench.
    const bx = this.machine.x + (MACHINE_ART.playX - MACHINE_ART.w / 2) * k;
    const by = this.machine.y + (MACHINE_ART.playY - MACHINE_ART.bed) * k;
    const d = MACHINE_ART.playD * k;
    this.playGlow.setPosition(bx, by).setDisplaySize(d * 2.4, d * 2.4);
    this.playGlow.setAlpha(this.playReady ? 0.3 + 0.45 * Math.sin(this.lampTime / 260) ** 2 : 0);
    const size = d * (this.playReady ? 1 + 0.07 * pulse : 1);
    if (!this.tweens.isTweening(this.playIcon)) this.playIcon.setDisplaySize(size, size);
    this.playIcon.setPosition(bx, by).setAlpha(this.playReady ? 1 : 0.4);
    this.playZone.setPosition(bx, by).setSize(d * 1.5, d * 1.5);
    (this.playZone.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setTo(0, 0, this.playZone.width, this.playZone.height);
    if (!this.cutting && this.bladeSpeed < 0.05 && this.bench !== 'cutting') {
      // Parked: the blade rocks gently on its rod.
      this.blade.y = S.bedY + BLADE_REST + Math.sin(this.lampTime / 700) * 2;
    }
  }

  // ---------- construction ----------

  private buildStage(): void {
    this.machineShadow = this.add.image(0, 0, 'shadow').setScale(5.4, 1.4);
    this.machine = this.add.image(0, 0, 'machine-art').setOrigin(0.5, MACHINE_ART.bed / MACHINE_ART.h);
    // The play button on the table's base is the start button: a glow, the play picture and a big tap zone.
    this.playGlow = this.add.image(0, 0, 'soft').setTint(0xffd27a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.playIcon = this.add.image(0, 0, uiIcon('play')).setAlpha(0.35);
    this.playZone = this.add.zone(0, 0, 10, 10).setInteractive({ useHandCursor: true });
    this.playZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      if (this.bench === 'ready' && state.canCut) this.tweens.add({ targets: this.playIcon, scale: this.playIcon.scale * 0.8, duration: 70, yoyo: true });
    });
    this.playZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.pressPlay());
    this.rays = this.add.container(0, 0).setVisible(false);
    for (let i = 0; i < RAY_COUNT; i++) {
      this.rays.add(this.add.image(0, 0, 'ray').setOrigin(0.5, 1).setRotation((i / RAY_COUNT) * Math.PI * 2).setBlendMode(Phaser.BlendModes.ADD));
    }
    this.rockImg = this.add.image(0, 0, '__DEFAULT').setVisible(false);
    this.cutLine = this.add.rectangle(0, 0, 5, 10, 0xfff3c4).setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    for (let i = 0; i < 2; i++) this.halves.push(this.add.image(0, 0, '__DEFAULT').setVisible(false));
    this.rod = this.add.rectangle(0, 0, 14, 0, 0x8d99a6).setOrigin(0.5, 0).setStrokeStyle(2, 0x4f5763);
    this.blade = this.add.image(0, 0, 'saw-art');
    this.blade.setScale((SAW_R * 2) / this.blade.width);
    this.sawGroup.add([this.machineShadow, this.machine, this.playGlow, this.playIcon, this.playZone, this.rays, this.rockImg, this.cutLine, ...this.halves, this.rod, this.blade]);
  }

  private buildCard(): void {
    this.card = this.add.nineslice(0, 0, 'workshop-card', undefined, CARD_ART.w, CARD_ART.h, CARD_ART.edge, CARD_ART.edge, CARD_ART.edge, CARD_ART.bottom).setOrigin(0, 0);
    this.chipBg = this.add.graphics();
    this.chipText = this.add.text(0, 0, '', outlinedStyle(22)).setOrigin(0.5);
    this.chipStars = Array.from({ length: 5 }, () => this.add.image(0, 0, ICON_STAR).setVisible(false));
    this.chip = this.add.container(0, 0, [this.chipBg, this.chipText, ...this.chipStars]).setVisible(false);
    this.title = this.add.text(0, 0, '', textStyle(34, PALETTE.ink)).setOrigin(0.5);
    this.sub = this.add.text(0, 0, '', textStyle(19, '#8a6a4a', { fontStyle: '500', align: 'center' })).setOrigin(0.5);
    this.big = this.add.text(0, 0, '', outlinedStyle(56, PALETTE.money)).setOrigin(0.5);
    this.sellBtn = new Button(this, {
      width: 280, height: 74, label: '', icon: 'ui-collect', ghost: true, iconScale: 1.35, fontSize: 40, colors: BUTTON_COLORS.green,
      onClick: () => this.sell(1),
    });
    this.sellBtn.setVisible(false);
    this.adBtn = new Button(this, {
      width: 280, height: 50, label: '2x', icon: uiIcon('watch'), fontSize: 24, colors: BUTTON_COLORS.blue,
      onClick: () => this.sellDoubled(),
    });
    this.adBtn.setVisible(false);
    // A picture where the big number goes while no rock is on the bench (all done / pick a rock).
    this.bigIcon = this.add.image(0, 0, uiIcon('bag')).setVisible(false);
    this.sawGroup.add([this.card, this.chip, this.title, this.sub, this.big, this.bigIcon, this.sellBtn, this.adBtn]);
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
    // Particles render just below the blade so sparks fly in front of the rock.
    this.sawGroup.addAt([this.dustFx, this.burstFx, this.glitterFx, this.sparkFx], this.sawGroup.getIndex(this.rod));
    this.sawGroup.add(this.confettiFx);
  }

  // ---------- the rock crusher (locked for now) ----------

  /** The crusher picture, dimmed, with a lock over it and a "coming soon" ribbon; plus the two station tabs. */
  private buildCrusher(): void {
    this.crusher = this.add.image(0, 0, 'crusher-art').setOrigin(0.5, 1).setTint(0x7c7c8c);
    this.crusherLock = this.add.image(0, 0, uiIcon('lock'));
    this.crusherRibbon = this.add.graphics();
    this.crusherLabel = this.add.text(0, 0, 'Coming soon', outlinedStyle(30, '#fff3dc')).setOrigin(0.5);
    this.ribbonBox = this.add.container(0, 0, [this.crusherRibbon, this.crusherLabel]);
    this.crusherGroup.add([this.crusher, this.crusherLock, this.ribbonBox]);
    // The lock sways a little, the ribbon bobs: it is waiting, not broken.
    this.tweens.add({ targets: this.crusherLock, angle: { from: -6, to: 6 }, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this.ribbonBox, y: 5, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Tabs: the saw table (open) and the crusher (locked).
    this.tabs = (['saw', 'crusher'] as const).map((id) => {
      const ring = this.add.graphics();
      const pic = this.add.image(0, 0, id === 'saw' ? 'saw-art' : 'crusher-art');
      const fit = id === 'saw' ? 40 : 46;
      pic.setScale(fit / Math.max(pic.width, pic.height));
      if (id === 'crusher') pic.setTint(0x8a8a98);
      const parts: Phaser.GameObjects.GameObject[] = [ring, pic];
      if (id === 'crusher') parts.push(this.add.image(17, 17, uiIcon('lock')).setDisplaySize(24, 24));
      const c = this.add.container(0, 0, parts);
      c.setSize(60, 60).setInteractive({ useHandCursor: true });
      c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.setStation(id));
      this.stage.add(c);
      return { id, c, ring };
    });
    this.paintTabs();
  }

  private paintTabs(): void {
    for (const t of this.tabs) {
      const on = t.id === this.station;
      const g = t.ring;
      g.clear();
      g.fillStyle(0x000000, 0.3).fillCircle(0, 3, 29);
      g.fillStyle(0x3a2412, 0.95).fillCircle(0, 0, 29);
      g.lineStyle(on ? 4 : 3, on ? 0xffc83d : 0x8a6a46, 1).strokeCircle(0, 0, 28);
      t.c.setScale(on ? 1.08 : 1);
    }
  }

  /** The shop opens over the workshop's background only: the table, card and tabs step aside while it is up. */
  setStageHidden(hidden: boolean): void {
    this.stage?.setVisible(!hidden);
    this.lamp?.setVisible(!hidden);
  }

  /** Switches between the saw table and the (locked) crusher. Not while a cut or a placing is running. */
  private setStation(next: 'saw' | 'crusher'): void {
    if (next === this.station || state.busy || this.bench === 'cutting' || this.bench === 'placing' || this.bench === 'selling') return;
    this.station = next;
    sfx.click();
    this.sawGroup.setVisible(next === 'saw');
    this.crusherGroup.setVisible(next === 'crusher');
    const shown = next === 'saw' ? this.sawGroup : this.crusherGroup;
    shown.setAlpha(0).setY(14);
    this.tweens.add({ targets: shown, alpha: 1, y: 0, duration: 240, ease: 'Cubic.easeOut' });
    this.paintTabs();
  }

  // ---------- layout ----------

  private onResize(): void {
    const { width: w, height: h } = this.scale;
    const L = (this.L = computeLayout(w, h));
    const prev = this.S;
    this.S = L.play.w / L.play.h < 1.05 ? TALL_STAGE : WIDE_STAGE;
    const S = this.S;
    const scale = Math.min(L.play.w / S.w, L.play.h / S.h);
    this.stage.setScale(scale).setPosition(L.play.x + (L.play.w - S.w * scale) / 2, L.play.y + (L.play.h - S.h * scale) / 2);

    // The supplied workshop picture, covering the screen with its floor edge near the bench.
    const benchY = this.stage.y + (S.bedY + 110) * scale;
    const cover = Math.max(w / this.backdrop.width, h / this.backdrop.height);
    this.backdrop.setScale(cover).setPosition((w - this.backdrop.width * cover) / 2, Math.min(0, Math.max(h - this.backdrop.height * cover, benchY - 560 * cover)));
    this.lamp.setPosition(this.stage.x + S.machineX * scale, this.stage.y + (S.bedY - 150) * scale).setScale((520 * scale) / 64);

    this.layoutStage(prev !== S);
  }

  private layoutStage(recenterRock: boolean): void {
    const S = this.S;
    this.machine.setScale(S.machineW / MACHINE_ART.w);
    this.machineShadow.setPosition(S.machineX, S.bedY + (MACHINE_ART.h - MACHINE_ART.bed) * this.machine.scaleX - 8);
    this.machine.setPosition(S.machineX, S.bedY);
    this.rays.setPosition(S.machineX, this.rockCenterY());
    this.rod.setPosition(S.machineX, this.rodTop());
    if (!this.cutting) this.blade.setPosition(S.machineX, S.bedY + BLADE_REST);
    if (recenterRock && this.current && this.bench !== 'placing') this.rockImg.setPosition(S.machineX, this.rockCenterY());
    if (this.bench === 'revealed' || this.bench === 'selling') this.placeHalves(false);

    // The crusher stands where the saw table does; the tabs sit above the card (wide) or at the left (phone).
    const kMachine = this.machine.scaleX;
    const baseY = S.bedY + (MACHINE_ART.h - MACHINE_ART.bed) * kMachine;
    this.crusher.setPosition(S.machineX, baseY).setScale((S.machineW * 1.04) / this.crusher.width);
    const ch0 = this.crusher.displayHeight;
    this.crusherLock.setPosition(S.machineX, baseY - ch0 * 0.5).setDisplaySize(ch0 * 0.34, ch0 * 0.34);
    const ry = baseY - ch0 * 0.16;
    const rw = Math.min(S.machineW * 0.78, 300);
    this.crusherRibbon.setPosition(0, 0).clear();
    this.crusherRibbon.fillStyle(0x000000, 0.35).fillRoundedRect(S.machineX - rw / 2, ry - 20 + 5, rw, 46, 14);
    this.crusherRibbon.fillStyle(0xff8a3d).fillRoundedRect(S.machineX - rw / 2, ry - 20, rw, 46, 14);
    this.crusherRibbon.fillStyle(0xffffff, 0.25).fillRoundedRect(S.machineX - rw / 2 + 8, ry - 16, rw - 16, 14, 7);
    this.crusherRibbon.lineStyle(3, 0x3b2616, 0.9).strokeRoundedRect(S.machineX - rw / 2, ry - 20, rw, 46, 14);
    this.crusherLabel.setPosition(S.machineX, ry + 3);
    this.tabs.forEach((t, i) => {
      if (S.tabsRow) t.c.setPosition(S.tabsX + (i === 0 ? -36 : 36), S.tabsY);
      else t.c.setPosition(S.tabsX, S.tabsY + i * 66);
    });

    // The card picture: frame, a big cream area for the rock, and two slots at the bottom for the buttons.
    const { cardX: x, cardY: y, cardW: w, cardH: h, cardScale: cs } = S;
    this.card.setSize(w / cs, h / cs).setScale(cs).setPosition(x - w / 2, y - h / 2);
    const top0 = y - h / 2 + CARD_ART.edge * cs;
    const bottom0 = y + h / 2 - CARD_ART.bigBottom * cs;
    const hz = bottom0 - top0;
    this.titleSize = Math.round(Math.max(22, Math.min(36, hz * 0.16)));
    this.bigSize = Math.round(Math.max(34, Math.min(58, hz * 0.26)));
    this.chip.setPosition(x, top0 + hz * 0.17);
    this.title.setPosition(x, top0 + hz * 0.45).setWordWrapWidth(9999).setFontSize(this.titleSize);
    this.sub.setPosition(x, top0 + hz * 0.6).setWordWrapWidth(w - 70 * cs);
    this.big.setPosition(x, top0 + hz * 0.78).setFontSize(this.bigSize);
    const isz = Math.min(84, hz * 0.45);
    this.bigIcon.setPosition(x, top0 + hz * 0.62).setDisplaySize(isz, isz);
    this.placeButtons();
  }

  /** The sell button sits in the card's upper slot and the "2x" ad button in the lower one. */
  private placeButtons(): void {
    const { cardX: x, cardY: y, cardW: w, cardH: h, cardScale: cs } = this.S;
    const bottom = y + h / 2;
    const slotW = w - CARD_ART.edge * 2 * cs - 12 * cs;
    this.sellBtn.resize(slotW, CARD_ART.slotH1 * cs, Math.round(30 * cs + 10)).setPosition(x, bottom - CARD_ART.slot1 * cs);
    this.adBtn.resize(slotW - 8, CARD_ART.slotH2 * cs - 8, Math.round(24 * cs + 6)).setPosition(x, bottom - CARD_ART.slot2 * cs);
  }

  private rockScale(): number {
    return GAME_CONFIG.rock.workshopScale / ART_RES;
  }

  private rockRadius(): number {
    return this.current ? GAME_CONFIG.rock.baseRadius * this.current.size * GAME_CONFIG.rock.workshopScale : 0;
  }

  private rockCenterY(): number {
    const r = this.rockRadius() || GAME_CONFIG.rock.baseRadius * GAME_CONFIG.rock.workshopScale;
    return this.S.bedY - r * (this.current?.exterior.squash ?? 0.85) - 2;
  }

  private rockTop(): number {
    return this.rockCenterY() - this.rockRadius() * (this.current?.exterior.squash ?? 0.85);
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
    this.onResize();
    if (this.bench === 'empty') this.autoPlace();
    else this.refreshCard();
  }

  private autoPlace(): void {
    if (this.bench !== 'empty' || this.current || !state.canCut) return;
    const next = state.inventory.firstUncut();
    if (next) this.place(next);
    else this.refreshCard();
  }

  private onSlotSelected(id: string): void {
    // Picking a rock goes to the saw table, wherever the player was looking.
    if (this.station !== 'saw') this.setStation('saw');
    if (!state.canCut || (this.bench !== 'empty' && this.bench !== 'ready')) return;
    if (this.current?.id === id) return;
    const index = state.inventory.indexOf(id);
    const rock = state.inventory.get(index);
    if (!rock || rock.cut) return;
    if (this.bench === 'ready' && this.current) {
      // Send the current rock back to its slot, then bring the new one.
      const back = this.slotStagePos(state.inventory.indexOf(this.current.id));
      this.bench = 'placing';
      this.tweens.add({
        targets: this.rockImg, x: back.x, y: back.y, scale: this.slotIconScale(), duration: 220, ease: 'Quad.easeIn',
        onComplete: () => {
          this.current = null;
          this.bench = 'empty';
          this.place(rock);
        },
      });
    } else {
      this.place(rock);
    }
  }

  private slotStagePos(index: number): { x: number; y: number } {
    const c = slotCenter(this.L, Math.max(0, index));
    return this.screenToStage(c.x, c.y);
  }

  private slotIconScale(): number {
    return iconScale(this.L.slotSize * GAME_CONFIG.rock.inventoryScale) / this.stage.scaleX;
  }

  private place(rock: Rock): void {
    this.current = rock;
    this.bench = 'placing';
    state.bus.emit(EVT.placedChanged, rock.id);
    this.refreshCard();
    const from = this.slotStagePos(state.inventory.indexOf(rock.id));
    const to = { x: this.S.machineX, y: this.rockCenterY() };
    const ctrl = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 220 };
    const startScale = this.slotIconScale();
    const endScale = this.rockScale();
    this.rockImg.setTexture(rockKeys(rock).outside).setPosition(from.x, from.y).setScale(startScale).setAngle(0).setAlpha(1).setVisible(true);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 460,
      ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        const u = 1 - t;
        this.rockImg.setPosition(u * u * from.x + 2 * u * t * ctrl.x + t * t * to.x, u * u * from.y + 2 * u * t * ctrl.y + t * t * to.y);
        this.rockImg.setScale(Phaser.Math.Linear(startScale, endScale, t));
        this.rockImg.setAngle(-20 * u);
      },
      onComplete: () => {
        sfx.place();
        this.dustFx.explode(6, to.x, this.S.bedY - 6);
        this.tweens.add({ targets: this.machine, y: { from: this.S.bedY + 4, to: this.S.bedY }, duration: 200, ease: 'Bounce.easeOut' });
        this.tweens.chain({
          targets: this.rockImg,
          tweens: [
            { scaleX: endScale * 1.18, scaleY: endScale * 0.84, duration: 80, ease: 'Quad.easeOut' },
            { scaleX: endScale, scaleY: endScale, duration: 300, ease: 'Elastic.easeOut', easeParams: [1.1, 0.45] },
          ],
        });
        this.bench = 'ready';
        this.refreshCard();
      },
    });
  }

  private async cut(): Promise<void> {
    const rock = this.current;
    if (this.bench !== 'ready' || !rock || !state.canCut) return;
    this.bench = 'cutting';
    state.setBusy(true);
    this.refreshCard();
    const S = this.S;
    this.saw = sfx.startSaw();
    this.bladeTarget = 1;
    await this.tween({ targets: this.blade, y: this.rockTop() - SAW_R + 6, duration: 320, ease: 'Sine.easeIn' });
    this.saw.grind(true);
    this.cutting = true;
    await this.tween({ targets: this.blade, y: S.bedY + BLADE_END, duration: GAME_CONFIG.cutting.cutDurationMs, ease: 'Linear' });
    this.cutting = false;
    this.saw.grind(false);
    this.rockImg.x = S.machineX;
    await this.tween({ targets: this.blade, y: S.bedY + BLADE_REST, duration: 300, ease: 'Sine.easeOut' });
    this.bladeTarget = 0;
    this.saw.stop();
    this.saw = null;

    // Anticipation: a little wobble (plus a dramatic pause for the good stuff).
    const tier = rock.rarity.tier;
    await this.tween({ targets: this.rockImg, angle: { from: -4, to: 4 }, duration: 70, yoyo: true, repeat: 1 });
    this.rockImg.setAngle(0);
    if (tier >= 3) {
      this.cameras.main.shake(260, 0.0025);
      await this.wait(280);
    }
    this.reveal(rock);
  }

  private reveal(rock: Rock): void {
    const S = this.S;
    const tier = rock.rarity.tier;
    // A dud (plain stone) or a worthless rock ($0) gets no celebration: only a sad little puff.
    const dud = !!rock.mineral.dud || rock.value <= 0;
    const tint = revealColor(rock);
    state.inventory.markCut(rock.id);
    state.recordCut(rock);

    this.rockImg.setVisible(false);
    this.cutLine.setVisible(false);
    const inside = rockKeys(rock).inside;
    const cy = this.rockCenterY();
    this.halves.forEach((half, i) => {
      half.setTexture(inside).setFlipX(i === 1).setPosition(S.machineX, cy).setScale(this.rockScale()).setAngle(0).setAlpha(1).setVisible(true);
    });
    this.placeHalves(true);

    const color = Phaser.Display.Color.IntegerToColor(tint);
    if (!dud) this.cameras.main.flash(120 + tier * 70, color.red, color.green, color.blue);
    if (!dud && rock.mineral.reveal === 'storm') this.time.delayedCall(150, () => this.cameras.main.flash(90, 170, 225, 255));
    if (tier >= 2) this.cameras.main.shake(180 + tier * 70, 0.002 + tier * 0.0015);
    this.dustFx.explode(8, S.machineX, cy);
    if (!dud) {
      if (rock.mineral.reveal === 'rainbow') {
        // Three bursts in different colours: a rainbow pop.
        [0xff9ad5, 0x7fe0d0, 0xffe27a].forEach((c, i) => {
          this.burstFx.setParticleTint(c);
          this.burstFx.explode(Math.ceil((8 + tier * 10) / 3), S.machineX, cy - 8 + i * 8);
        });
      } else {
        this.burstFx.setParticleTint(tint);
        this.burstFx.explode(8 + tier * 10, S.machineX, cy);
      }
    }
    if (tier >= 4) {
      this.confettiFx.explode(70, S.machineX, cy);
      this.time.delayedCall(350, () => this.confettiFx.explode(50, S.machineX, cy - 60));
    }
    if (tier >= 2) {
      this.rays.setVisible(true).setAlpha(0).setScale(0.3).setPosition(S.machineX, cy);
      this.rays.each((ray: Phaser.GameObjects.Image) => ray.setTint(tint));
      this.raysSpin = 0.0003 + tier * 0.0001;
      this.tweens.add({ targets: this.rays, alpha: 0.25 + tier * 0.08, scale: 0.85 + tier * 0.15, duration: 500, ease: 'Back.easeOut' });
    }
    if (tier >= 1) {
      const rate = 420 - tier * 80;
      this.glitterFx.setParticleTint(lightTint(rock.mineral.colors[0]));
      this.glitterTimer = this.time.addEvent({
        delay: rate,
        loop: true,
        callback: () => {
          const r = this.rockRadius();
          for (const half of this.halves) {
            this.glitterFx.emitParticleAt(half.x + Phaser.Math.FloatBetween(-0.6, 0.6) * r, half.y + Phaser.Math.FloatBetween(-0.5, 0.5) * r, 1);
          }
        },
      });
    }
    sfx.reveal(tier, rock.value);

    this.bench = 'revealed';
    this.refreshCard();
    this.chip.setScale(0);
    this.tweens.add({ targets: this.chip, scale: 1 + tier * 0.06, delay: 120, duration: 420, ease: 'Back.easeOut', easeParams: [2.5] });
    this.title.setScale(0.6);
    this.tweens.add({ targets: this.title, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.bigCounter.value = 0;
    this.tweens.add({
      targets: this.bigCounter,
      value: rock.value,
      duration: 450 + tier * 160,
      ease: 'Quad.easeOut',
      onUpdate: () => this.big.setText(formatMoney(this.bigCounter.value)),
    });
    this.sellBtn.setVisible(true).setScale(0);
    this.tweens.add({ targets: this.sellBtn, scale: 1, delay: 380 + tier * 100, duration: 320, ease: 'Back.easeOut' });
  }

  private placeHalves(animate: boolean): void {
    const S = this.S;
    const r = this.rockRadius();
    const cy = this.rockCenterY() - 8;
    const spread = r * 1.08;
    this.halves.forEach((half, i) => {
      const dir = i === 0 ? -1 : 1;
      const target = { x: S.machineX + dir * spread, y: cy, angle: dir * 9 };
      if (!animate) {
        half.setPosition(target.x, target.y).setAngle(target.angle);
        return;
      }
      const s = this.rockScale();
      this.tweens.add({ targets: half, x: target.x, y: target.y, angle: target.angle, duration: 420, ease: 'Back.easeOut', easeParams: [2] });
      this.tweens.chain({
        targets: half,
        tweens: [
          { scaleX: s * 1.12, scaleY: s * 0.9, duration: 110 },
          { scaleX: s, scaleY: s, duration: 380, ease: 'Elastic.easeOut', easeParams: [1, 0.5] },
        ],
      });
      this.tweens.add({ targets: half, y: target.y - 6, delay: 500, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
  }

  /** "Sell for double (watch an ad)" under the SELL button, for rocks worth the wait. */
  private updateAdButton(): void {
    const rock = this.current;
    const show = this.bench === 'revealed' && !!rock && rock.value >= AD_SELL_MIN_VALUE && portal.rewardedReady && this.sellBtn.visible;
    if (this.adBtn.visible !== show) {
      this.adBtn.setVisible(show);
      this.placeButtons();
    }
  }

  private sellDoubled(): void {
    if (this.bench !== 'revealed') return;
    portal.rewarded(() => this.sell(2));
  }

  private sell(multiplier = 1): void {
    const rock = this.current;
    if (this.bench !== 'revealed' || !rock) return;
    this.bench = 'selling';
    this.adBtn.setVisible(false);
    const amount = state.economy.sell(rock, multiplier);
    const p = this.stageToScreen(this.big.x, this.big.y);
    state.bus.emit(EVT.sale, amount, p.x, p.y, rock.rarity.tier);
    state.inventory.remove(rock.id);
    state.bus.emit(EVT.placedChanged, null);
    this.tweens.add({ targets: this.sellBtn, scale: 0, duration: 160, ease: 'Back.easeIn' });
    this.tweens.add({ targets: this.big, scale: { from: 1.3, to: 1 }, duration: 260, ease: 'Back.easeOut' });
    this.glitterTimer?.remove();
    this.glitterTimer = null;
    this.legendaryHue = -1;
    for (const star of this.chipStars) star.clearTint();
    this.tweens.add({ targets: this.rays, alpha: 0, duration: 300, onComplete: () => this.rays.setVisible(false) });
    for (const half of this.halves) this.tweens.killTweensOf(half);
    this.tweens.add({
      targets: this.halves,
      scale: this.rockScale() * 0.2,
      alpha: 0,
      y: '-=60',
      duration: 320,
      ease: 'Back.easeIn',
      onComplete: () => {
        for (const half of this.halves) half.setVisible(false).setTexture('__DEFAULT');
        this.rockImg.setTexture('__DEFAULT');
        releaseRockTextures(this.textures, rock);
        this.current = null;
        this.bench = 'empty';
        this.sellBtn.setVisible(false).setScale(1);
        state.setBusy(false);
        this.time.delayedCall(220, () => this.autoPlace());
      },
    });
  }

  // ---------- card ----------

  private refreshCard(): void {
    const rock = this.current;
    const showChip = (this.bench === 'revealed' || this.bench === 'selling') && rock;
    this.chip.setVisible(!!showChip);
    this.playReady = this.bench === 'ready' && state.canCut;
    if (this.bench !== 'revealed' && this.bench !== 'selling') this.sellBtn.setVisible(false);
    this.big.setScale(1).setFontSize(this.bigSize);
    // No words here: a picture says what to do next.
    this.title.setText('').setScale(1);
    this.sub.setText('');
    this.bigIcon.setVisible(!rock);

    if (!rock) {
      // Nothing on the bench: a tick when every rock is done, otherwise the bag (pick the next rock).
      const none = state.inventory.uncutCount === 0;
      this.big.setText('');
      this.bigIcon.setTexture(none ? uiIcon('check') : uiIcon('bag'));
      return;
    }
    // A worthless rock cannot be "sold": the same button throws it away.
    this.sellBtn.setIcon(rock.value > 0 ? 'ui-collect' : uiIcon('junk'));
    if (this.bench === 'placing' || this.bench === 'ready' || this.bench === 'cutting') {
      this.big.setText('?').setColor(PALETTE.money);
      return;
    }
    const tier = rock.rarity.tier;
    this.title.setText(rock.mineral.name);
    // The name stays on one line: shrink it to fit the card.
    this.title.setScale(Math.min(1, (this.S.cardW - 70 * this.S.cardScale) / Math.max(1, this.title.width)));
    this.big.setColor(rock.mineral.dud || rock.value <= 0 ? '#d8d0c4' : PALETTE.money);
    // Rarity is a row of gold stars on the chip - no words. A worthless rock has no stars at all.
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

  // ---------- helpers ----------

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => this.tweens.add({ ...config, onComplete: () => resolve() }));
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }
}

/** Tint of the reveal burst, flash and rays: the mineral's own feel beats the plain rarity colour. */
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

function lightTint(color: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const mix = (v: number) => Math.round(v + (255 - v) * 0.5);
  return Phaser.Display.Color.GetColor(mix(c.red), mix(c.green), mix(c.blue));
}
