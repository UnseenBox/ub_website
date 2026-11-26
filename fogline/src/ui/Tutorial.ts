import Phaser from 'phaser';
import { ENEMIES } from '../data/enemies';
import { CLASSIC_WEAPONS as WEAPONS } from '../data/weapons';
import { LEG_SLOW, Zombie } from '../entities/Zombie';
import { VIEW, WINDOW } from '../game/config';
import { DEPTH } from '../game/depths';
import { buildSteps, canAdvance, Facts, GATE_PAUSE_SECONDS, StepId, TutorialStep } from '../game/tutorialSteps';
import { HUD_AREA, type HudSlots, type SlotRect } from './hudLayout';
import { EnemyManager } from '../systems/EnemyManager';
import { WaveManager } from '../systems/WaveManager';
import { WeaponManager } from '../systems/WeaponManager';

const MONO = '"Saira", sans-serif';
const STENCIL = '"Saira Stencil One", sans-serif';
const GOLD = 0xe8c060;
const INK = 0x080907;
const PANEL = { x: 24, y: 24, w: 600, h: 214 };
const CHARS_PER_SECOND = 62;
/** Enemies shown one at a time in the field, in this order. */
const SHOWCASE = ['shambler', 'runner', 'plated', 'crawler', 'carrier', 'brute'];
const SHOWCASE_SECONDS = 2.8;
/** Practice zombies stand in the window, well short of the wall, so they never attack. */
const PRACTICE_Z = 9;
const SHOWCASE_Z = 12;

const pct = (x: number): number => Math.round(x * 100);
const rand = (a: number, b: number): number => a + (b - a) * Math.random();

export interface TutorialDeps {
  weapons: WeaponManager;
  enemies: EnemyManager;
  waves: WaveManager;
  touch: boolean;
  clearBanner: () => void;
  /** Where the HUD put its slots, so the briefing can ring them. */
  slots: HudSlots;
  onFinish: () => void;
}

/**
 * The first-time briefing. Shown over the battlefield: a panel types out each step, the real
 * HUD parts it talks about are ringed, and the practice steps wait for the real thing (a kill,
 * a weapon switch, a reload, the armory) before the player may move on.
 */
export class Tutorial {
  private readonly steps: TutorialStep[];
  private index = -1;
  private ended = false;
  private readonly root: Phaser.GameObjects.Container;
  private readonly stage: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly dots: Phaser.GameObjects.Graphics;
  private readonly button: Phaser.GameObjects.Container;
  private readonly keys = new Set<string>();
  private readonly onKey: (e: KeyboardEvent) => void;
  private fullText = '';
  private typed = 0;
  private typeAcc = 0;
  private gateTimer = 0;
  private fireDone = false;
  private shopOpened = false;
  private practiceTarget: Zombie | null = null;
  private props: Zombie[] = [];
  private showcaseIndex = -1;
  private showcaseTimer = SHOWCASE_SECONDS;
  private nameplate: Phaser.GameObjects.Text | null = null;

  constructor(private readonly scene: Phaser.Scene, private readonly deps: TutorialDeps) {
    this.steps = buildSteps({ touch: deps.touch, legSlow: LEG_SLOW });
    deps.clearBanner();

    this.stage = scene.add.container(0, 0).setDepth(DEPTH.banner + 20);
    this.root = scene.add.container(PANEL.x, PANEL.y).setDepth(DEPTH.banner + 30);
    const bg = scene.add.graphics();
    bg.fillStyle(INK, 0.9);
    bg.fillRoundedRect(0, 0, PANEL.w, PANEL.h, 10);
    bg.lineStyle(2, GOLD, 0.8);
    bg.strokeRoundedRect(0, 0, PANEL.w, PANEL.h, 10);
    this.title = scene.add.text(20, 12, '', { fontFamily: STENCIL, fontSize: '26px', color: '#f0e0a0', stroke: '#000', strokeThickness: 4 });
    this.dots = scene.add.graphics();
    this.body = scene.add.text(20, 64, '', {
      fontFamily: MONO, fontSize: '14px', color: '#d8d4b8', wordWrap: { width: 560 }, lineSpacing: 3,
    });
    this.hint = scene.add.text(20, 196, '', { fontFamily: MONO, fontSize: '13px', color: '#e8c060', stroke: '#000', strokeThickness: 3 });
    const skip = scene.add.text(PANEL.w - 16, PANEL.h - 14, 'SKIP ×', { fontFamily: MONO, fontSize: '12px', color: '#9a9a86' })
      .setOrigin(1, 1)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.close());
    this.button = this.makeButton();
    this.root.add([bg, this.dots, this.title, this.body, this.hint, this.button, skip]);
    this.root.setAlpha(0);

    this.onKey = (e: KeyboardEvent) => this.handleKey(e);
    scene.input.keyboard?.on('keydown', this.onKey);
    this.enter(0);
  }

  /** The id of the step on screen. */
  get stepId(): StepId {
    return this.steps[this.index]?.id ?? 'welcome';
  }

  /** Stop the briefing without marking it seen (the scene is going away). */
  destroy(): void {
    if (this.ended) return;
    this.ended = true;
    this.scene.input.keyboard?.off('keydown', this.onKey);
    this.clearStage();
    this.killTweens(this.root);
    this.root.destroy(true);
    this.stage.destroy(true);
  }

  update(dt: number): void {
    if (this.ended) return;
    if (this.typed < this.fullText.length) {
      this.typeAcc += dt * CHARS_PER_SECOND;
      const n = Math.floor(this.typeAcc);
      if (n > 0) {
        this.typeAcc -= n;
        this.typed = Math.min(this.fullText.length, this.typed + n);
        this.body.setText(this.fullText.slice(0, this.typed));
      }
    }
    const step = this.steps[this.index];
    if (step.id === 'fire' && this.practiceTarget && !this.practiceTarget.alive) this.fireDone = true;
    const typedDone = this.typed >= this.fullText.length;
    const ready = canAdvance(step, this.facts());

    this.button.setVisible(step.gate === 'continue' && typedDone);
    this.hint.setVisible(step.gate !== 'continue');
    if (step.gate !== 'continue' && ready) {
      if (this.gateTimer === 0) this.hint.setText('Well done!');
      this.gateTimer += dt;
      if (this.gateTimer >= GATE_PAUSE_SECONDS) this.next();
      return;
    }
    this.animate(dt, step);
  }

  // ------------------------------------------------------------ flow

  private facts(): Facts {
    return {
      fireDone: this.fireDone,
      keys: this.keys,
      shopOpened: this.shopOpened,
      waveStarted: this.deps.waves.wave > 0,
    };
  }

  private enter(i: number): void {
    if (this.ended) return;
    this.index = i;
    const step = this.steps[i];
    this.clearStage();
    this.fireDone = false;
    this.shopOpened = false;
    this.keys.clear();
    this.gateTimer = 0;
    this.showcaseIndex = -1;
    this.showcaseTimer = SHOWCASE_SECONDS;

    this.title.setText(step.title);
    this.setBody(step.lines.join('\n'));
    this.hint.setText(step.hint ?? '');
    this.hint.setAlpha(1);
    this.scene.tweens.killTweensOf(this.hint);
    if (step.hint) {
      this.scene.tweens.add({ targets: this.hint, alpha: { from: 0.45, to: 1 }, yoyo: true, repeat: -1, duration: 520 });
    }
    this.drawDots();
    this.scene.tweens.killTweensOf(this.title);
    this.title.setScale(1.1);
    this.scene.tweens.add({ targets: this.title, scale: 1, duration: 320, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: this.root, alpha: 1, duration: 260 });
    this.buildStage(step);
  }

  private next(): void {
    if (this.index + 1 >= this.steps.length) {
      this.close();
      return;
    }
    this.enter(this.index + 1);
  }

  /** Finish the briefing for good: the caller marks it seen. */
  private close(): void {
    if (this.ended) return;
    this.destroy();
    this.deps.onFinish();
  }

  private setBody(text: string): void {
    this.fullText = text;
    this.typed = 0;
    this.typeAcc = 0;
    this.body.setText('');
  }

  private onContinue(): void {
    if (this.ended) return;
    if (this.steps[this.index].gate !== 'continue') return;
    if (this.typed < this.fullText.length) {
      this.typed = this.fullText.length;
      this.body.setText(this.fullText);
      return;
    }
    this.next();
  }

  private handleKey(e: KeyboardEvent): void {
    if (this.ended) return;
    const k = e.key === ' ' ? ' ' : e.key.toLowerCase();
    this.keys.add(k);
    if (k === ' ') this.shopOpened = true;
    if (this.steps[this.index].gate === 'continue' && (k === 'enter' || k === 'arrowright')) this.onContinue();
  }

  private makeButton(): Phaser.GameObjects.Container {
    const w = 150;
    const h = 28;
    const bg = this.scene.add.rectangle(0, 0, w, h, 0x2a2612).setStrokeStyle(2, GOLD).setInteractive({ useHandCursor: true });
    const label = this.scene.add.text(0, 0, 'CONTINUE ▸', { fontFamily: MONO, fontSize: '13px', color: '#f0e0a0', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5);
    bg.on('pointerover', () => bg.setFillStyle(0x3a3418));
    bg.on('pointerout', () => bg.setFillStyle(0x2a2612));
    bg.on('pointerdown', () => this.onContinue());
    return this.scene.add.container(PANEL.w - 20 - w / 2, 26, [bg, label]);
  }

  private drawDots(): void {
    this.dots.clear();
    this.steps.forEach((_, k) => {
      this.dots.fillStyle(k <= this.index ? GOLD : 0x3a3a32, 1);
      this.dots.fillCircle(24 + k * 14, 46, 4);
    });
  }

  // ------------------------------------------------------------ stage (visuals per step)

  private buildStage(step: TutorialStep): void {
    switch (step.id) {
      case 'welcome': this.windowOutline(); break;
      case 'aim': this.crosshairDemo(); break;
      case 'fire': this.spawnPractice(); this.markTarget(); break;
      case 'weapons': this.weaponCards(); break;
      case 'switch': this.slotRings(); break;
      case 'reload': this.ammoRing(); break;
      case 'zones': this.spawnPractice(); this.zoneMarkers(); break;
      case 'bunker': this.bunkerRing(); break;
      case 'arsenal': this.arsenalRings(); break;
      case 'armory': this.keyCap('SPACE', VIEW.centerX, 420, 120, 0); break;
      case 'waves': this.keyCap('ENTER', VIEW.centerX, 420, 110, 0); this.keyCap('P', VIEW.centerX + 120, 420, 40, 120); this.keyCap('ESC', VIEW.centerX + 190, 420, 56, 240); break;
      case 'finish': this.confetti(); break;
      default: break;
    }
  }

  private animate(dt: number, step: TutorialStep): void {
    if (step.id !== 'enemies') return;
    this.showcaseTimer += dt;
    if (this.showcaseTimer >= SHOWCASE_SECONDS) {
      this.showcaseTimer = 0;
      this.showcase((this.showcaseIndex + 1) % SHOWCASE.length);
    }
  }

  /** The window opening, traced in gold. */
  private windowOutline(): void {
    const g = this.scene.add.graphics();
    g.lineStyle(4, GOLD, 1);
    g.beginPath();
    g.moveTo(WINDOW.topX, WINDOW.topY);
    g.lineTo(WINDOW.bottomX, VIEW.height);
    g.moveTo(VIEW.width - WINDOW.topX, WINDOW.topY);
    g.lineTo(VIEW.width - WINDOW.bottomX, VIEW.height);
    g.strokePath();
    this.stage.add(g);
    this.scene.tweens.add({ targets: g, alpha: 0.2, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const label = this.text(VIEW.centerX, 300, 'YOUR WINDOW ON THE FIELD', { fontFamily: STENCIL, fontSize: '22px', color: '#f0e0a0', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5);
    this.pop(label);
  }

  /** A crosshair gliding left and right, to show that it follows the aim. */
  private crosshairDemo(): void {
    const c = this.scene.add.container(VIEW.centerX - 200, 420);
    const g = this.scene.add.graphics();
    g.lineStyle(2, 0xf0e0a0, 1);
    g.strokeCircle(0, 0, 14);
    g.lineBetween(-26, 0, -8, 0);
    g.lineBetween(8, 0, 26, 0);
    g.lineBetween(0, -26, 0, -8);
    g.lineBetween(0, 8, 0, 26);
    c.add(g);
    this.stage.add(c);
    this.scene.tweens.add({ targets: c, x: VIEW.centerX + 200, duration: 1300, yoyo: true, repeat: -1, hold: 250, ease: 'Sine.easeInOut' });
    this.text(VIEW.centerX, 468, this.deps.touch ? 'left stick aims · right side fires' : 'move the mouse · the crosshair follows', { fontFamily: MONO, fontSize: '13px', color: '#c8c4a0', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
  }

  private spawnPractice(): void {
    this.practiceTarget = this.deps.enemies.spawn('shambler', 1, 0.0001, 0, PRACTICE_Z);
    this.props.push(this.practiceTarget);
  }

  /** A pulsing ring and a bobbing "SHOOT" over the practice zombie. */
  private markTarget(): void {
    const z = this.practiceTarget;
    if (!z) return;
    const cy = z.sy - z.screenHeight * 0.55;
    const ring = this.scene.add.circle(z.sx, cy, 46, 0x000000, 0).setStrokeStyle(3, GOLD);
    this.stage.add(ring);
    this.scene.tweens.add({ targets: ring, scale: 1.15, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const label = this.text(z.sx, cy - 62, 'SHOOT', { fontFamily: STENCIL, fontSize: '24px', color: '#ff9a70', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5);
    this.scene.tweens.add({ targets: label, y: cy - 72, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** Four weapon cards: photo, stats as bars, and whether the weapon is free, locked or for sale. */
  private weaponCards(): void {
    const max = {
      damage: Math.max(...WEAPONS.map((w) => w.damage)),
      rate: Math.max(...WEAPONS.map((w) => w.fireRate)),
      magazine: Math.max(...WEAPONS.map((w) => w.magazine)),
      price: Math.max(...WEAPONS.map((w) => w.price)),
    };
    WEAPONS.forEach((w, i) => {
      const cx = 310 + i * 220;
      const cy = 430;
      const free = w.price === 0;
      const card = this.scene.add.container(cx, cy + 46).setAlpha(0);
      card.add(this.scene.add.rectangle(0, 0, 200, 250, 0x0b0c0a, 0.94).setStrokeStyle(2, free ? GOLD : 0x5a5a50));
      card.add(this.text(0, -112, w.shortName, { fontFamily: STENCIL, fontSize: '22px', color: '#f0e0a0' }).setOrigin(0.5));
      card.add(this.text(0, -92, w.name, { fontFamily: MONO, fontSize: '10px', color: '#a8a890', align: 'center', wordWrap: { width: 186 } }).setOrigin(0.5, 0));
      const img = this.scene.add.image(0, -28, w.viewTexture);
      img.setScale(Math.min(170 / img.width, 96 / img.height));
      card.add(img);
      this.scene.tweens.add({ targets: img, angle: { from: -2.5, to: 2.5 }, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut' });
      const rows: [string, number, number][] = [
        ['DMG', w.damage, max.damage],
        ['RATE', w.fireRate, max.rate],
        ['MAG', w.magazine, max.magazine],
        ['COST', w.price, max.price],
      ];
      rows.forEach(([label, value, top], r) => {
        const y = 40 + r * 18;
        card.add(this.text(-92, y - 6, label, { fontFamily: MONO, fontSize: '10px', color: '#c8c4a0' }));
        card.add(this.scene.add.rectangle(-18, y, 106, 8, 0x1c1d1a).setOrigin(0, 0.5));
        card.add(this.scene.add.rectangle(-18, y, Math.max(3, 106 * (value / top)), 8, label === 'COST' ? 0xd08050 : GOLD).setOrigin(0, 0.5));
      });
      const status = free ? 'OWNED · FREE' : w.unlockAfterWave > 0 ? `LOCKED · CLEAR WAVE ${w.unlockAfterWave}` : `$${w.price}`;
      card.add(this.text(0, 110, status, { fontFamily: MONO, fontSize: '11px', color: free ? '#a8c890' : '#e8a070', align: 'center' }).setOrigin(0.5));
      this.stage.add(card);
      this.scene.tweens.add({ targets: card, alpha: 1, y: cy, duration: 380, delay: i * 120, ease: 'Back.easeOut' });
    });
  }

  private ringSlot(r: SlotRect, delay: number): void {
    this.hudRing(r.x + r.w / 2, r.y + r.h / 2, r.w + 8, r.h + 8, delay);
  }

  /** Rings round the weapon slots, with their number keys above them. */
  private slotRings(): void {
    this.deps.slots.weapons.forEach((r, i) => {
      this.ringSlot(r, i * 220);
      this.keyCap(String(i + 1), r.x + r.w / 2, HUD_AREA.top - 20, 34, i * 220);
    });
  }

  private ammoRing(): void {
    this.hudRing(1188, 554, 164, 68, 0);
    this.keyCap('R', 1084, 540, 40, 0);
  }

  /** Markers on the practice zombie: head, body and legs, and what each one does. */
  private zoneMarkers(): void {
    const z = this.practiceTarget;
    if (!z) return;
    const head = z.headScreen({ x: 0, y: 0 });
    const chest = z.chestScreen({ x: 0, y: 0 });
    const legs = { x: z.sx, y: z.sy - z.screenHeight * 0.18 };
    const marks: { x: number; y: number; color: number; label: string }[] = [
      { x: head.x, y: head.y, color: 0xff6040, label: `HEAD  headshot +$${ENEMIES.shambler.headshotBonus}` },
      { x: chest.x, y: chest.y, color: GOLD, label: 'BODY  the usual' },
      { x: legs.x, y: legs.y, color: 0x7fd6ff, label: `LEGS  slow to ${pct(LEG_SLOW.factor)}%` },
    ];
    marks.forEach((m, i) => {
      const dot = this.scene.add.circle(m.x, m.y, 9, m.color, 1).setStrokeStyle(2, 0x000000);
      this.stage.add(dot);
      this.scene.tweens.add({ targets: dot, scale: 1.5, duration: 480, yoyo: true, repeat: -1, delay: i * 160, ease: 'Sine.easeInOut' });
      const label = this.text(m.x + 22, m.y, m.label, { fontFamily: MONO, fontSize: '13px', color: '#f0ecd0', stroke: '#000', strokeThickness: 4 }).setOrigin(0, 0.5);
      this.pop(label);
    });
  }

  private bunkerRing(): void {
    const s = HUD_AREA.status;
    this.hudRing(s.x + s.w / 2, HUD_AREA.top + HUD_AREA.height / 2, s.w, HUD_AREA.slotH + 8, 0);
  }

  /** Rings chase along the mods, support and defences, one after another. */
  private arsenalRings(): void {
    const { mods, support, defense } = this.deps.slots;
    [...mods, ...support, ...defense].forEach((r, i) => this.ringSlot(r, i * 180));
  }

  /** A confetti burst for the last step. */
  private confetti(): void {
    const colours = [0xe8c060, 0xf0e0a0, 0xc8504a, 0x7fd6ff];
    for (let i = 0; i < 44; i++) {
      const piece = this.scene.add.rectangle(rand(120, VIEW.width - 120), rand(-60, -10), 9, 5, colours[i % colours.length]);
      this.stage.add(piece);
      this.scene.tweens.add({
        targets: piece,
        y: VIEW.height + 40,
        angle: rand(-360, 360),
        duration: rand(1400, 2600),
        delay: rand(0, 700),
        ease: 'Quad.easeIn',
        onComplete: () => piece.destroy(),
      });
    }
  }

  /** The enemy on show: walks in at a stroll, gets a nameplate and is described in the panel. */
  private showcase(i: number): void {
    this.showcaseIndex = i;
    for (const z of this.props) if (z.alive) z.vanish();
    this.props = [];
    const id = SHOWCASE[i];
    const def = ENEMIES[id];
    // Speed set so it strolls about 3 metres in the time on screen: never close enough to attack.
    const z = this.deps.enemies.spawn(id, 1, 1.2 / def.speed, 0, SHOWCASE_Z);
    this.props.push(z);
    this.nameplate?.destroy();
    this.nameplate = this.text(VIEW.centerX, z.sy - z.screenHeight - 10, def.name.toUpperCase(), {
      fontFamily: STENCIL, fontSize: '20px', color: '#f0e0a0', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5, 1);
    this.title.setText(def.name.toUpperCase());
    this.setBody(`${def.description}\nHealth ${def.health}  ·  speed ${def.speed.toFixed(1)} m/s  ·  headshot bonus $${def.headshotBonus}`);
  }

  // ------------------------------------------------------------ small helpers

  private text(x: number, y: number, s: string, style: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text {
    const t = this.scene.add.text(x, y, s, style);
    this.stage.add(t);
    return t;
  }

  private hudRing(x: number, y: number, w: number, h: number, delay: number): void {
    const r = this.scene.add.rectangle(x, y, w, h, 0x000000, 0).setStrokeStyle(3, GOLD);
    this.stage.add(r);
    this.scene.tweens.add({ targets: r, alpha: { from: 0.25, to: 1 }, yoyo: true, repeat: -1, duration: 420, delay, repeatDelay: 300 });
  }

  /** A keyboard key, drawn as a cap that presses in and out. */
  private keyCap(label: string, x: number, y: number, w: number, delay: number): void {
    const cap = this.scene.add.container(x, y);
    cap.add(this.scene.add.rectangle(0, 0, w, 34, 0x1b1c18).setStrokeStyle(2, GOLD));
    cap.add(this.scene.add.text(0, 0, label, { fontFamily: MONO, fontSize: '16px', color: '#f0e6b0', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5));
    this.stage.add(cap);
    this.scene.tweens.add({ targets: cap, scale: 0.92, duration: 380, yoyo: true, repeat: -1, delay, ease: 'Sine.easeInOut' });
  }

  private pop(obj: Phaser.GameObjects.GameObject & { scale: number }): void {
    this.scene.tweens.add({ targets: obj, scale: { from: 0.6, to: 1 }, duration: 320, ease: 'Back.easeOut' });
  }

  private clearStage(): void {
    this.killTweens(this.stage);
    this.stage.removeAll(true);
    for (const z of this.props) if (z.alive) z.vanish();
    this.props = [];
    this.practiceTarget = null;
    this.nameplate = null;
  }

  /** Stop every tween on an object and its children, so none outlives what it animates. */
  private killTweens(obj: Phaser.GameObjects.GameObject): void {
    this.scene.tweens.killTweensOf(obj);
    const list = (obj as Phaser.GameObjects.Container).list;
    if (Array.isArray(list)) for (const child of list) this.killTweens(child);
  }
}
