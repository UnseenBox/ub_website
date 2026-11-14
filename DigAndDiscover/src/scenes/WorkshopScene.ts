import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/GameConfig';
import { BUTTON_COLORS, PALETTE, outlinedStyle, textStyle } from '../config/Theme';
import { EVT, state, subscribe } from '../core/GameState';
import type { Rock } from '../core/types';
import { ART_RES, iconScale, releaseRockTextures, rockKeys } from '../art/RockArt';
import { MACHINE, SAW_RADIUS } from '../art/TextureFactory';
import { sfx, type SawHandle } from '../audio/Sfx';
import { sizeLabel } from '../systems/RockGenerator';
import { Button } from '../ui/Button';
import { computeLayout, slotCenter, type Layout } from '../ui/layout';
import { formatMoney } from '../ui/MoneyCounter';

type BenchState = 'empty' | 'placing' | 'ready' | 'cutting' | 'revealed' | 'selling';

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

const BLADE_REST = -290;
const BLADE_END = -60;
const RAY_COUNT = 12;

/**
 * The workshop: place a rock on the bench, run the saw, reveal the inside
 * with a rarity-scaled celebration, then sell. Everything lives in a logical
 * "stage" container that is scaled to fit the play area.
 */
export class WorkshopScene extends Phaser.Scene {
  private S: StageLayout = WIDE_STAGE;
  private L!: Layout;
  private backdrop!: Phaser.GameObjects.Graphics;
  private lamp!: Phaser.GameObjects.Image;
  private stage!: Phaser.GameObjects.Container;
  private machine!: Phaser.GameObjects.Image;
  private machineShadow!: Phaser.GameObjects.Image;
  private rays!: Phaser.GameObjects.Container;
  private rod!: Phaser.GameObjects.Rectangle;
  private blade!: Phaser.GameObjects.Image;
  private rockImg!: Phaser.GameObjects.Image;
  private cutLine!: Phaser.GameObjects.Rectangle;
  private halves: Phaser.GameObjects.Image[] = [];
  private card!: Phaser.GameObjects.Graphics;
  private chip!: Phaser.GameObjects.Container;
  private chipBg!: Phaser.GameObjects.Graphics;
  private chipText!: Phaser.GameObjects.Text;
  private title!: Phaser.GameObjects.Text;
  private sub!: Phaser.GameObjects.Text;
  private big!: Phaser.GameObjects.Text;
  private cutBtn!: Button;
  private sellBtn!: Button;
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
    this.backdrop = this.add.graphics();
    this.lamp = this.add.image(0, 0, 'soft').setTint(0xffd9a0).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    this.stage = this.add.container(0, 0);
    this.buildStage();
    this.buildCard();
    this.buildEffects();

    subscribe(this, EVT.slotSelected, (id: string) => this.onSlotSelected(id));
    subscribe(this, EVT.dayPhaseChanged, () => this.refreshCard());
    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.bench === 'ready') this.cutBtn.trigger();
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
    this.bladeSpeed += (this.bladeTarget - this.bladeSpeed) * Math.min(1, dt / 220);
    if (this.bladeSpeed > 0.001) this.blade.rotation += this.bladeSpeed * dt * 0.03;
    this.rod.height = Math.max(0, this.blade.y - (this.S.bedY + BLADE_REST));
    if (this.cutting && this.current) {
      const rx = this.S.machineX;
      this.rockImg.x = rx + Phaser.Math.FloatBetween(-1.6, 1.6);
      const contact = Math.min(this.blade.y + SAW_RADIUS, this.S.bedY - 4);
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
      this.chipText.setTint(Phaser.Display.Color.HSVToRGB(this.legendaryHue / 360, 0.35, 1).color);
    }
  }

  // ---------- construction ----------

  private buildStage(): void {
    this.machineShadow = this.add.image(0, 0, 'shadow').setScale(3.6, 1.4);
    this.machine = this.add.image(0, 0, 'machine').setScale(1 / ART_RES).setOrigin(0.5, MACHINE.bedY / MACHINE.height);
    this.rays = this.add.container(0, 0).setVisible(false);
    for (let i = 0; i < RAY_COUNT; i++) {
      this.rays.add(this.add.image(0, 0, 'ray').setOrigin(0.5, 1).setRotation((i / RAY_COUNT) * Math.PI * 2).setBlendMode(Phaser.BlendModes.ADD));
    }
    this.rockImg = this.add.image(0, 0, '__DEFAULT').setVisible(false);
    this.cutLine = this.add.rectangle(0, 0, 5, 10, 0xfff3c4).setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    for (let i = 0; i < 2; i++) this.halves.push(this.add.image(0, 0, '__DEFAULT').setVisible(false));
    this.rod = this.add.rectangle(0, 0, 14, 0, 0x8d99a6).setOrigin(0.5, 0).setStrokeStyle(2, 0x4f5763);
    this.blade = this.add.image(0, 0, 'saw').setScale(1 / ART_RES);
    this.stage.add([this.machineShadow, this.machine, this.rays, this.rockImg, this.cutLine, ...this.halves, this.rod, this.blade]);
  }

  private buildCard(): void {
    this.card = this.add.graphics();
    this.chipBg = this.add.graphics();
    this.chipText = this.add.text(0, 0, '', outlinedStyle(22)).setOrigin(0.5);
    this.chip = this.add.container(0, 0, [this.chipBg, this.chipText]).setVisible(false);
    this.title = this.add.text(0, 0, '', textStyle(34, PALETTE.ink)).setOrigin(0.5);
    this.sub = this.add.text(0, 0, '', textStyle(19, '#8a6a4a', { fontStyle: '500', align: 'center' })).setOrigin(0.5);
    this.big = this.add.text(0, 0, '', outlinedStyle(56, PALETTE.money)).setOrigin(0.5);
    this.cutBtn = new Button(this, {
      width: 280, height: 74, label: 'CUT IT OPEN!', fontSize: 30, colors: BUTTON_COLORS.orange,
      onClick: () => void this.cut(),
    });
    this.sellBtn = new Button(this, {
      width: 280, height: 74, label: 'SELL', fontSize: 30, colors: BUTTON_COLORS.green,
      onClick: () => this.sell(),
    });
    this.cutBtn.setVisible(false);
    this.sellBtn.setVisible(false);
    this.stage.add([this.card, this.chip, this.title, this.sub, this.big, this.cutBtn, this.sellBtn]);
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
    this.stage.addAt([this.dustFx, this.burstFx, this.glitterFx, this.sparkFx], this.stage.getIndex(this.rod));
    this.stage.add(this.confettiFx);
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

    // Full-screen workshop wall and bench.
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
    this.lamp.setPosition(this.stage.x + S.machineX * scale, this.stage.y + (S.bedY - 150) * scale).setScale((520 * scale) / 64);

    this.layoutStage(prev !== S);
  }

  private layoutStage(recenterRock: boolean): void {
    const S = this.S;
    this.machineShadow.setPosition(S.machineX, S.bedY + 120);
    this.machine.setPosition(S.machineX, S.bedY);
    this.rays.setPosition(S.machineX, this.rockCenterY());
    this.rod.setPosition(S.machineX, S.bedY + BLADE_REST);
    if (!this.cutting) this.blade.setPosition(S.machineX, S.bedY + BLADE_REST);
    if (recenterRock && this.current && this.bench !== 'placing') this.rockImg.setPosition(S.machineX, this.rockCenterY());
    if (this.bench === 'revealed' || this.bench === 'selling') this.placeHalves(false);

    const { cardX: x, cardY: y, cardW: w, cardH: h } = S;
    const g = this.card;
    g.clear();
    g.fillStyle(0x000000, 0.25).fillRoundedRect(x - w / 2, y - h / 2 + 8, w, h, 28);
    g.fillStyle(PALETTE.cream).fillRoundedRect(x - w / 2, y - h / 2, w, h, 28);
    g.fillStyle(PALETTE.creamShade).fillRoundedRect(x - w / 2 + 10, y + h * 0.12, w - 20, h * 0.38 - 10, 20);
    g.lineStyle(4, 0xe2c497).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 28);
    this.chip.setPosition(x, y - h * 0.37);
    this.title.setPosition(x, y - h * 0.21).setWordWrapWidth(w - 40);
    this.sub.setPosition(x, y - h * 0.07).setWordWrapWidth(w - 40);
    this.big.setPosition(x, y + h * 0.1);
    this.cutBtn.setPosition(x, y + h * 0.33);
    this.sellBtn.setPosition(x, y + h * 0.33);
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
    return iconScale(this.L.slotSize * 0.74) / this.stage.scaleX;
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
    await this.tween({ targets: this.blade, y: this.rockTop() - SAW_RADIUS + 6, duration: 320, ease: 'Sine.easeIn' });
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
    const dud = !!rock.mineral.dud;
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

    const color = Phaser.Display.Color.IntegerToColor(rock.rarity.color);
    if (!dud) this.cameras.main.flash(120 + tier * 70, color.red, color.green, color.blue);
    if (tier >= 2) this.cameras.main.shake(180 + tier * 70, 0.002 + tier * 0.0015);
    this.dustFx.explode(8, S.machineX, cy);
    if (!dud) {
      this.burstFx.setParticleTint(rock.rarity.color);
      this.burstFx.explode(8 + tier * 10, S.machineX, cy);
    }
    if (tier >= 4) {
      this.confettiFx.explode(70, S.machineX, cy);
      this.time.delayedCall(350, () => this.confettiFx.explode(50, S.machineX, cy - 60));
    }
    if (tier >= 2) {
      this.rays.setVisible(true).setAlpha(0).setScale(0.3).setPosition(S.machineX, cy);
      this.rays.each((ray: Phaser.GameObjects.Image) => ray.setTint(rock.rarity.color));
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
    sfx.reveal(tier, dud);

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

  private sell(): void {
    const rock = this.current;
    if (this.bench !== 'revealed' || !rock) return;
    this.bench = 'selling';
    const amount = state.economy.sell(rock);
    const p = this.stageToScreen(this.big.x, this.big.y);
    state.bus.emit(EVT.sale, amount, p.x, p.y, rock.rarity.tier);
    state.inventory.remove(rock.id);
    state.bus.emit(EVT.placedChanged, null);
    this.tweens.add({ targets: this.sellBtn, scale: 0, duration: 160, ease: 'Back.easeIn' });
    this.tweens.add({ targets: this.big, scale: { from: 1.3, to: 1 }, duration: 260, ease: 'Back.easeOut' });
    this.glitterTimer?.remove();
    this.glitterTimer = null;
    this.legendaryHue = -1;
    this.chipText.clearTint();
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
    this.cutBtn.setVisible(this.bench === 'ready').setEnabled(state.canCut);
    if (this.bench !== 'revealed' && this.bench !== 'selling') this.sellBtn.setVisible(false);
    this.big.setScale(1).setFontSize(56);
    // After closing time the last rocks have to be cut before the day can end.
    const lastRocks = !state.canWork && state.canCut;

    if (!rock) {
      const none = state.inventory.uncutCount === 0;
      this.title.setText(none ? 'All cut!' : 'Workbench');
      this.sub.setText(
        none
          ? (lastRocks ? 'All done for today!\nTime to head home.' : 'Head back and dig up\nmore mystery rocks.')
          : 'Tap a rock in your bag\nto put it on the bench.',
      );
      this.big.setText('');
      return;
    }
    if (this.bench === 'placing' || this.bench === 'ready' || this.bench === 'cutting') {
      this.title.setText(rock.exterior.name);
      const hint = rock.sparkly ? 'It glitters a little...' : 'What could be inside?';
      const left = state.inventory.uncutCount;
      this.sub.setText(
        this.bench === 'cutting'
          ? 'Cutting...'
          : lastRocks
            ? `Last rocks of the day!\n${left} left to cut`
            : `${sizeLabel(rock.size)} rock\n${hint}`,
      );
      this.big.setText('?').setColor(PALETTE.money);
      return;
    }
    const tier = rock.rarity.tier;
    this.title.setText(rock.mineral.name);
    this.sub.setText(rock.mineral.flavor);
    this.big.setColor(rock.mineral.dud ? '#d8d0c4' : PALETTE.money);
    this.chipText.setText(rock.rarity.label.toUpperCase()).setFontSize(22 + tier * 2);
    const cw = this.chipText.width + 36;
    const ch = this.chipText.height + 10;
    this.chipBg.clear();
    this.chipBg.fillStyle(0x000000, 0.25).fillRoundedRect(-cw / 2, -ch / 2 + 3, cw, ch, ch / 2);
    this.chipBg.fillStyle(rock.rarity.color).fillRoundedRect(-cw / 2, -ch / 2, cw, ch, ch / 2);
    this.chipBg.fillStyle(0xffffff, 0.25).fillRoundedRect(-cw / 2 + 6, -ch / 2 + 3, cw - 12, ch * 0.35, ch * 0.17);
    this.legendaryHue = tier >= 4 ? 0 : -1;
    if (tier < 4) this.chipText.clearTint();
    this.sellBtn.setLabel(`SELL  ${formatMoney(rock.value)}`);
  }

  // ---------- helpers ----------

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => this.tweens.add({ ...config, onComplete: () => resolve() }));
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }
}

function lightTint(color: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const mix = (v: number) => Math.round(v + (255 - v) * 0.5);
  return Phaser.Display.Color.GetColor(mix(c.red), mix(c.green), mix(c.blue));
}
