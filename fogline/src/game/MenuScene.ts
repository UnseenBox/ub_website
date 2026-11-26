import Phaser from 'phaser';
import { audio, LoopHandle } from '../audio/AudioManager';
import { MISSIONS } from '../data/missions';
import { campaignComplete, nextMission, starTotals, workshopOpen } from '../systems/Campaign';
import { defaultProfile, profile } from '../systems/Profile';
import { hqWaiting } from '../systems/Retention';
import type { GameStartData } from './GameScene';
import { toggleFullscreen } from '../ui/widgets';
import { C, MONO, STENCIL, BODY, box, chip, pushButton, text } from '../ui/kit';
import { icon, type IconName } from '../ui/icons';
import { BLEED, MAX_SCREEN, SCREEN, designPoint } from './screen';
import { backdrop } from '../rendering/Margins';
import { ScreenOverlay, buildScreenFx } from '../rendering/ScreenFx';
import { VIEW } from './config';
import { isTestMode } from './testMode';
import { MENU_BG_TEXTURE } from './textureKeys';

/** The size of a menu entry, and the gap between entries. */
const ENTRY = { x: 690, y: 196, w: 380, h: 64, step: 80 } as const;

interface Entry {
  label: string;
  icon: IconName;
  tone: number;
  blurb: () => string;
  go: () => void;
}

interface Drawn {
  c: Phaser.GameObjects.Container;
  g: Phaser.GameObjects.Graphics;
  sweep: number;
  entry: Entry;
}

/**
 * The outline of the iris: the whole screen, with a round hole. The hole is one closed path
 * that runs round the screen and then back round the circle, so the fill leaves it open.
 */
function irisPoints(cx: number, cy: number, r: number): Phaser.Math.Vector2[] {
  const L = -BLEED.x, T = -BLEED.y, R = L + MAX_SCREEN.width, B = T + MAX_SCREEN.height;
  const seam = new Phaser.Math.Vector2(cx - r, cy);
  const pts = [new Phaser.Math.Vector2(L, T), new Phaser.Math.Vector2(R, T), new Phaser.Math.Vector2(R, B), new Phaser.Math.Vector2(L, B), new Phaser.Math.Vector2(L, cy), seam];
  const n = 72;
  for (let i = 1; i <= n; i++) {
    const a = Math.PI - (Math.PI * 2 * i) / n;
    pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  pts.push(new Phaser.Math.Vector2(L, cy));
  return pts;
}

/** Title screen. The DEPLOY click is also the user gesture that unlocks audio. */
export class MenuScene extends Phaser.Scene {
  private wind: LoopHandle | null = null;
  private drawn: Drawn[] = [];
  private selected = 0;
  private busy = false;
  private confirm: Phaser.GameObjects.Container | null = null;
  private info!: Phaser.GameObjects.Text;
  private art!: Phaser.GameObjects.Image;
  private artBase = { x: 0, y: 0 };
  private artShift = { x: 0, y: 0 };
  private overlay!: ScreenOverlay;
  private haze!: Phaser.GameObjects.TileSprite;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.input.setDefaultCursor('default');
    this.busy = false;
    this.confirm = null;
    this.selected = 0;
    buildScreenFx(this);

    // The painting covers the whole screen, whatever its shape, and drifts a little with the pointer.
    this.art = this.add.image(0, 0, MENU_BG_TEXTURE).setOrigin(0);
    const cover = (): void => {
      const k = Math.max(SCREEN.width / VIEW.width, SCREEN.height / VIEW.height);
      const spare = (VIEW.height * k - SCREEN.height) / 2;
      const w = VIEW.width * k, h = VIEW.height * k;
      this.art.setDisplaySize(w, h);
      // Pinned by its left edge, so the logo is never cut off.
      this.artBase = { x: -SCREEN.mx, y: -SCREEN.my - Math.min(spare, 40 * k) };
    };
    cover();
    this.scale.on(Phaser.Scale.Events.RESIZE, cover);
    this.events.once('shutdown', () => this.scale.off(Phaser.Scale.Events.RESIZE, cover));
    backdrop(this, 0x000000, 0.3);

    // A soft haze drifts over the painting, and the whole picture is pushed down a little.
    this.haze = this.add.tileSprite(-BLEED.x, -BLEED.y, MAX_SCREEN.width, MAX_SCREEN.height, 'clouds')
      .setOrigin(0).setAlpha(0.14).setBlendMode(Phaser.BlendModes.SCREEN).setDepth(2);

    this.buildEntries();
    this.buildInfo();
    this.paint();
    this.buildCorners();

    if (isTestMode()) {
      this.add.text(VIEW.centerX, 430, 'TEST MODE — ALL WEAPONS & GEAR UNLOCKED', {
        fontFamily: MONO, fontSize: '12px', color: '#c8a040', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5);
    }

    this.overlay = new ScreenOverlay(this, 40);
    this.playIris();

    // Synthesize the sound bank while the player reads the title screen.
    this.time.delayedCall(120, () => audio.prepare());
    this.input.keyboard!.on('keydown-UP', () => this.move(-1));
    this.input.keyboard!.on('keydown-W', () => this.move(-1));
    this.input.keyboard!.on('keydown-DOWN', () => this.move(1));
    this.input.keyboard!.on('keydown-S', () => this.move(1));
    this.input.keyboard!.on('keydown-ENTER', () => this.activate(this.selected));
    this.input.keyboard!.on('keydown-F', () => toggleFullscreen(this));
    this.input.once('pointerdown', () => {
      audio.unlock();
      if (!this.wind) this.wind = audio.loop('wind_loop', 0.5, 'music', 1.5);
    });
    this.events.once('shutdown', () => {
      this.wind?.stop(0.5);
      this.wind = null;
    });
  }

  /** The menu entries: each leans, shows its number and icon, and reveals a line about itself when chosen. */
  private buildEntries(): void {
    const save = profile.get();
    const next = nextMission(save);
    const entries: Entry[] = [
      {
        label: 'CONTINUE', icon: 'play', tone: C.goLine,
        blurb: () => (campaignComplete(save) ? 'The campaign is complete. Revisit the valley.' : `Next: ${next.number} · ${next.name.toUpperCase()}`),
        go: () => this.deploy(),
      },
      {
        label: 'NEW GAME', icon: 'replay', tone: C.lineStrong,
        blurb: () => 'Start the campaign over. This erases your progress.',
        go: () => this.newGame(),
      },
      {
        label: 'ARMORY', icon: 'cart', tone: C.brass,
        blurb: () => "Dot's bench: upgrade your weapons and the bunker.",
        go: () => this.openArmory(),
      },
      {
        label: 'SETTINGS', icon: 'gear', tone: C.lineStrong,
        blurb: () => 'Volume and the display.',
        go: () => this.openSettings(),
      },
      {
        label: 'STORE', icon: 'crate', tone: C.brass,
        blurb: () => 'Spend your supplies on upgrades.',
        go: () => this.openArmory(),
      },
    ];
    this.drawn = entries.map((entry, i) => this.drawEntry(entry, i));
  }

  private drawEntry(entry: Entry, i: number): Drawn {
    const { x, y, w, h, step } = ENTRY;
    const row = y + i * step;
    const g = this.add.graphics();
    const pic = icon(this, entry.icon, 36, h / 2, 28, C.iconTone);
    const label = text(this, 66, h / 2, entry.label, { size: 30, font: STENCIL }).setOrigin(0, 0.5);
    const c = this.add.container(x, row, [g, pic, label]).setSize(w, h).setDepth(10);
    c.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    c.on('pointerover', () => this.select(i));
    c.on('pointerdown', () => this.activate(i));
    return { c, g, sweep: 0, entry };
  }

  /** Redraws every entry for the current selection. */
  private paint(): void {
    const { w, h } = ENTRY;
    this.drawn.forEach((d, i) => {
      const on = i === this.selected;
      const g = d.g;
      g.clear();
      g.fillStyle(on ? C.raised : C.card, 0.94).fillRect(0, 0, w, h);
      if (d.sweep > 0) {
        // The brass wash that sweeps across an entry as it is chosen.
        g.fillStyle(C.brass, 0.22).fillRect(0, 0, w * d.sweep, h);
      }
      g.lineStyle(on ? 2 : 1, on ? d.entry.tone : C.line, 1).strokeRect(0, 0, w, h);
      g.fillStyle(on ? d.entry.tone : C.lineSoft, 1).fillRect(0, 0, 4, h);
    });
    this.info.setText(this.drawn[this.selected].entry.blurb());
  }

  /** The line under the list: what the chosen entry does. */
  private buildInfo(): void {
    const { x, w } = ENTRY;
    const y = ENTRY.y + this.drawn.length * ENTRY.step + 18;
    box(this, x, y, w + 4, 50, C.tile, C.lineSoft, 1);
    text(this, x + 14, y + 25, '▸', { size: 18, color: C.brass, font: MONO }).setOrigin(0, 0.5);
    this.info = text(this, x + 34, y + 25, '', { size: 16, font: BODY, color: C.soft, wrap: w - 40 }).setOrigin(0, 0.5);
  }

  /** The corners: the campaign totals and the channel, like a set tuned to a station. */
  private buildCorners(): void {
    const save = profile.get();
    const played = Object.values(save.missions).some((r) => r.plays > 0);
    const channel = text(this, 26, 22, '● CH 03 · FOGLINE NET', { size: 13, color: C.threat, bold: true, font: MONO });
    this.tweens.add({ targets: channel, alpha: 0.35, duration: 900, yoyo: true, repeat: -1 });
    // The title: the menu picture carries no logo, so the name is set here, over the sky.
    text(this, 60, 118, 'FOG LINE', { size: 96, font: STENCIL, color: C.title });
    this.add.rectangle(64, 232, 360, 3, C.brass).setOrigin(0, 0.5);
    if (played) {
      const totals = [
        chip(this, { icon: 'star', text: `${starTotals(save).earned}`, tone: 'gold', size: 20 }),
        chip(this, { icon: 'crate', iconColor: C.brass, text: `${save.supplies}`, size: 20 }),
      ];
      const waiting = hqWaiting(save, Date.now()).length;
      if (waiting) totals.push(chip(this, { icon: 'radio', iconColor: C.red, text: `${waiting}`, tone: 'red', size: 20 }));
      let tx = VIEW.width - 22 - totals.reduce((w, t) => w + t.w + 8, -8);
      for (const t of totals) {
        t.c.setPosition(tx, 22).setDepth(10);
        tx += t.w + 8;
      }
    }
    // The training briefing, at the foot of the screen.
    pushButton(this, 130, 660, { w: 216, h: 48, size: 22, icon: 'book', label: 'TRAINING', onClick: () => this.startBriefing() }).c.setDepth(10);
    this.add.text(VIEW.width - 12, VIEW.height - 10, 'original prototype · supplied art and audio', {
      fontFamily: MONO, fontSize: '11px', color: '#5a5a50',
    }).setOrigin(1, 1);
  }

  /** The screen opens like a lens coming into focus: black fills the screen, with a round hole that grows out of the middle. */
  private playIris(): void {
    const iris = this.add.graphics().setDepth(60);
    const hole = { r: 8 };
    const paint = (): void => {
      iris.clear();
      iris.fillStyle(0x000000, 1);
      iris.fillPoints(irisPoints(VIEW.centerX, VIEW.height / 2, hole.r), true);
    };
    paint();
    this.tweens.add({
      targets: hole, r: 1150, duration: 1500, ease: 'Cubic.easeOut',
      onUpdate: paint,
      onComplete: () => iris.destroy(),
    });
    // The entries arrive one by one, sliding in from the right.
    this.drawn.forEach((d, i) => {
      const home = ENTRY.x;
      d.c.setX(home + 420).setAlpha(0);
      this.tweens.add({ targets: d.c, x: home, alpha: 1, duration: 480, delay: 500 + i * 110, ease: 'Cubic.easeOut' });
    });
  }

  override update(_t: number, dms: number): void {
    const dt = dms / 1000;
    this.overlay?.update(dt);
    this.haze.tilePositionX += dms * 0.012;
    // The painting follows the pointer a little, like a layer behind the glass.
    const p = designPoint(this.input.activePointer);
    const tx = Phaser.Math.Clamp(((p.x - VIEW.centerX) / VIEW.centerX) * -12, -12, 12);
    const ty = Phaser.Math.Clamp(((p.y - VIEW.height / 2) / (VIEW.height / 2)) * -8, -8, 8);
    this.artShift.x += (tx - this.artShift.x) * Math.min(1, dt * 4);
    this.artShift.y += (ty - this.artShift.y) * Math.min(1, dt * 4);
    this.art.setPosition(this.artBase.x + this.artShift.x, this.artBase.y + this.artShift.y);
  }

  private select(i: number): void {
    if (this.confirm || this.busy || i === this.selected) return;
    this.selected = i;
    audio.play('ui_hover', { volume: 0.45 });
    this.paint();
  }

  private move(step: number): void {
    const n = this.drawn.length;
    this.select((this.selected + step + n) % n);
  }

  /** Chooses an entry: it sweeps brass across, then does what it says. */
  private activate(i: number): void {
    if (this.confirm || this.busy) return;
    this.select(i);
    this.busy = true;
    const d = this.drawn[i];
    this.tweens.add({
      targets: d, sweep: 1, duration: 200, ease: 'Cubic.easeIn',
      onUpdate: () => this.paint(),
      onComplete: () => {
        this.busy = false;
        d.entry.go();
      },
    });
  }

  private openArmory(): void {
    audio.unlock();
    audio.play('radio', { volume: 0.6 });
    this.scene.start(workshopOpen(profile.get()) ? 'Workshop' : 'Map');
  }

  private openSettings(): void {
    audio.unlock();
    this.scene.launch('Settings');
  }

  private deploy(): void {
    if (this.confirm) return;
    audio.unlock();
    audio.play('radio', { volume: 0.6 });
    // A new player is shooting within seconds: straight into mission 1. Everyone else picks on the map.
    const p = profile.get();
    const played = Object.values(p.missions).some((r) => r.plays > 0);
    if (played) this.scene.start('Map');
    else this.scene.start('Game', { missionId: MISSIONS[0].id } satisfies GameStartData);
  }

  /** NEW GAME: erase campaign progress (settings are kept) after asking. */
  private newGame(): void {
    if (this.confirm) return;
    audio.unlock();
    const p = profile.get();
    if (!Object.values(p.missions).some((r) => r.plays > 0)) return this.deploy();
    const bg = backdrop(this, 0x000000, 0.75).setInteractive();
    const panel = box(this, VIEW.centerX - 300, VIEW.height / 2 - 140, 600, 280, C.night, C.goLine);
    const t = text(this, VIEW.centerX, VIEW.height / 2 - 92, 'NEW CAMPAIGN?', { size: 40, font: STENCIL }).setOrigin(0.5);
    // What would be lost, as pictures and numbers.
    const lost = [
      chip(this, { icon: 'star', text: `${starTotals(p).earned}`, tone: 'red', size: 24 }),
      chip(this, { icon: 'crate', text: `${p.supplies}`, tone: 'red', size: 24 }),
      chip(this, { icon: 'cross', text: 'NO UNDO', tone: 'red', size: 24 }),
    ];
    let lx = VIEW.centerX - lost.reduce((w, c) => w + c.w + 12, -12) / 2;
    for (const c of lost) {
      c.c.setPosition(lx, VIEW.height / 2 - 40);
      lx += c.w + 12;
    }
    const close = (): void => {
      this.confirm?.destroy();
      this.confirm = null;
    };
    const erase = pushButton(this, VIEW.centerX - 140, VIEW.height / 2 + 78, {
      w: 250, h: 56, size: 26, icon: 'replay', label: 'ERASE', tone: 'go',
      onClick: () => {
        profile.update((d) => {
          const keep = { volumes: d.volumes, tutorialSeen: d.tutorialSeen };
          Object.assign(d, defaultProfile(), keep);
        });
        close();
        this.scene.restart();
      },
    });
    const cancel = pushButton(this, VIEW.centerX + 140, VIEW.height / 2 + 78, { w: 250, h: 56, size: 26, icon: 'back', label: 'KEEP', onClick: close });
    this.confirm = this.add.container(0, 0, [bg, panel, t, ...lost.map((c) => c.c), erase.c, cancel.c]).setDepth(100);
  }

  private startBriefing(): void {
    audio.unlock();
    this.scene.start('Game', { tutorial: true });
  }
}
