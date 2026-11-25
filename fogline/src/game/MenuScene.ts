import Phaser from 'phaser';
import { audio, LoopHandle } from '../audio/AudioManager';
import { MISSIONS } from '../data/missions';
import { campaignComplete, nextMission, starTotals, workshopOpen } from '../systems/Campaign';
import { defaultProfile, profile } from '../systems/Profile';
import { hqWaiting } from '../systems/Retention';
import type { GameStartData } from './GameScene';
import { toggleFullscreen } from '../ui/widgets';
import { C, MONO, STENCIL, box, chip, pushButton, text } from '../ui/kit';
import { artButton } from '../ui/buttonArt';
import { SCREEN } from './screen';
import { backdrop } from '../rendering/Margins';
import { VIEW } from './config';
import { isTestMode } from './testMode';
import { MENU_BG_TEXTURE, MENU_BUTTON_FRAMES } from './textureKeys';

/** Title screen. The DEPLOY click is also the user gesture that unlocks audio. */
export class MenuScene extends Phaser.Scene {
  private wind: LoopHandle | null = null;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.input.setDefaultCursor('default');
    // The painting covers the whole screen, whatever its shape. It is pinned by its left
    // edge and (nearly) its top, so what gets cut off never includes the logo.
    const art = this.add.image(0, 0, MENU_BG_TEXTURE).setOrigin(0);
    const cover = (): void => {
      const k = Math.max(SCREEN.width / VIEW.width, SCREEN.height / VIEW.height);
      const spare = (VIEW.height * k - SCREEN.height) / 2;
      art.setDisplaySize(VIEW.width * k, VIEW.height * k).setPosition(-SCREEN.mx, -SCREEN.my - Math.min(spare, 40 * k));
    };
    cover();
    this.scale.on(Phaser.Scale.Events.RESIZE, cover);
    this.events.once('shutdown', () => this.scale.off(Phaser.Scale.Events.RESIZE, cover));
    backdrop(this, 0x000000, 0.25);

    const bx = VIEW.centerX + 120;
    // CONTINUE goes to the valley map (a brand-new player goes straight into mission 1);
    // NEW GAME starts the campaign over after a confirmation. ARMORY and STORE open the
    // Workshop once it exists.
    artButton(this, bx, 200, 340, 60, MENU_BUTTON_FRAMES.continue, () => this.deploy(), 10);
    artButton(this, bx, 276, 340, 60, MENU_BUTTON_FRAMES.newGame, () => this.newGame(), 10);
    artButton(this, bx, 352, 340, 60, MENU_BUTTON_FRAMES.armory, () => this.openArmory(), 10);
    artButton(this, bx, 428, 340, 60, MENU_BUTTON_FRAMES.settings, () => this.openSettings(), 10);
    artButton(this, bx, 504, 340, 60, MENU_BUTTON_FRAMES.store, () => this.openArmory(), 10);
    pushButton(this, 130, 660, { w: 216, h: 48, size: 22, icon: 'book', label: 'TRAINING', onClick: () => this.startBriefing() }).c.setDepth(10);
    if (isTestMode()) {
      this.add.text(VIEW.centerX, 430, 'TEST MODE — ALL WEAPONS & GEAR UNLOCKED', {
        fontFamily: MONO, fontSize: '12px', color: '#c8a040', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5);
    }

    // Campaign progress: the next mission beside CONTINUE, the totals in the corner.
    const save = profile.get();
    const next = nextMission(save);
    const played = Object.values(save.missions).some((r) => r.plays > 0);
    const where = campaignComplete(save)
      ? chip(this, { icon: 'check', iconColor: C.ok, text: 'COMPLETE', tone: 'green', size: 18 })
      : chip(this, { icon: 'play', text: `${next.number} ${next.name.toUpperCase()}`, tone: 'gold', size: 18 });
    where.c.setPosition(bx + 184, 200 - where.h / 2).setDepth(10);
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
    this.add.text(VIEW.width - 12, VIEW.height - 10, 'original prototype · supplied art and audio', {
      fontFamily: MONO, fontSize: '11px', color: '#5a5a50',
    }).setOrigin(1, 1);

    // Synthesize the sound bank while the player reads the title screen.
    this.time.delayedCall(120, () => audio.prepare());
    this.input.keyboard!.on('keydown-ENTER', () => this.deploy());
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

  override update(_t: number, dms: number): void {
    const c = this.children.getByName('clouds') as Phaser.GameObjects.TileSprite | null;
    if (c) c.tilePositionX += (dms / 1000) * 4;
  }

  private openArmory(): void {
    if (this.confirm) return;
    audio.unlock();
    audio.play('radio', { volume: 0.6 });
    this.scene.start(workshopOpen(profile.get()) ? 'Workshop' : 'Map');
  }

  private openSettings(): void {
    if (this.confirm) return;
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

  private confirm: Phaser.GameObjects.Container | null = null;

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
