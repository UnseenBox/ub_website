import Phaser from 'phaser';
import { audio, LoopHandle } from '../audio/AudioManager';
import { MISSIONS } from '../data/missions';
import { campaignComplete, nextMission, nextUnlockHint, starTotals, workshopOpen } from '../systems/Campaign';
import { defaultProfile, profile } from '../systems/Profile';
import { hqWaiting } from '../systems/Retention';
import type { GameStartData } from './GameScene';
import { MONO, button, toggleFullscreen } from '../ui/widgets';
import { artButton } from '../ui/buttonArt';
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
    this.add.image(0, 0, MENU_BG_TEXTURE).setOrigin(0).setDisplaySize(VIEW.width, VIEW.height);
    this.add.rectangle(0, 0, VIEW.width, VIEW.height, 0x000000, 0.25).setOrigin(0);

    const bx = VIEW.centerX + 120;
    // CONTINUE goes to the valley map (a brand-new player goes straight into mission 1);
    // NEW GAME starts the campaign over after a confirmation. ARMORY and STORE open the
    // Workshop once it exists.
    artButton(this, bx, 200, 340, 60, MENU_BUTTON_FRAMES.continue, () => this.deploy(), 10);
    artButton(this, bx, 276, 340, 60, MENU_BUTTON_FRAMES.newGame, () => this.newGame(), 10);
    artButton(this, bx, 352, 340, 60, MENU_BUTTON_FRAMES.armory, () => this.openArmory(), 10);
    artButton(this, bx, 428, 340, 60, MENU_BUTTON_FRAMES.settings, () => this.openSettings(), 10);
    artButton(this, bx, 504, 340, 60, MENU_BUTTON_FRAMES.store, () => this.openArmory(), 10);
    button(this, 150, 652, 240, 40, 'TRAINING & BRIEFING', () => this.startBriefing(), 10);
    if (isTestMode()) {
      this.add.text(VIEW.centerX, 430, 'TEST MODE — ALL WEAPONS & GEAR UNLOCKED', {
        fontFamily: MONO, fontSize: '12px', color: '#c8a040', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5);
    }

    // Campaign progress under the buttons: where the player is and what comes next.
    const save = profile.get();
    const next = nextMission(save);
    const stars = starTotals(save);
    const hint = nextUnlockHint(save);
    const lines = [
      campaignComplete(save)
        ? `CAMPAIGN COMPLETE  ·  ★ ${stars.earned}/${stars.total}  ·  SUPPLIES ${save.supplies}`
        : `NEXT: ACT ${next.act} · MISSION ${next.number} — ${next.name.toUpperCase()}  ·  ★ ${stars.earned}/${stars.total}  ·  SUPPLIES ${save.supplies}`,
    ];
    if (hint) lines.push(hint);
    const waiting = hqWaiting(save, Date.now());
    if (waiting.length) lines.push(`WAITING AT HQ: ${waiting.join(' · ')}`);
    this.add.text(bx, 560, lines.join('\n'), {
      fontFamily: MONO, fontSize: '14px', color: '#e0d8b0', stroke: '#000', strokeThickness: 4, align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0);
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
    const bg = this.add.rectangle(0, 0, VIEW.width, VIEW.height, 0x000000, 0.7).setOrigin(0).setInteractive();
    const box = this.add.rectangle(VIEW.centerX, VIEW.height / 2, 620, 240, 0x1c1d1a, 0.98).setStrokeStyle(2, 0xc84030);
    const t = this.add.text(VIEW.centerX, VIEW.height / 2 - 70, 'START A NEW CAMPAIGN?', { fontFamily: MONO, fontSize: '24px', color: '#e8e0c0' }).setOrigin(0.5);
    const s = this.add.text(VIEW.centerX, VIEW.height / 2 - 30, 'Every mission, star, Supply, weapon and upgrade will be erased.\nThis cannot be undone.', {
      fontFamily: MONO, fontSize: '14px', color: '#c8b8a0', align: 'center',
    }).setOrigin(0.5, 0);
    const close = (): void => {
      this.confirm?.destroy();
      this.confirm = null;
    };
    const erase = button(this, VIEW.centerX - 150, VIEW.height / 2 + 70, 260, 44, 'ERASE AND START', () => {
      profile.update((d) => {
        const keep = { volumes: d.volumes, tutorialSeen: d.tutorialSeen };
        Object.assign(d, defaultProfile(), keep);
      });
      close();
      this.scene.restart();
    }, 10, 0xc84030);
    const cancel = button(this, VIEW.centerX + 150, VIEW.height / 2 + 70, 260, 44, 'CANCEL', close, 10, 0x5a5a50);
    this.confirm = this.add.container(0, 0, [bg, box, t, s, erase, cancel]).setDepth(100);
  }

  private startBriefing(): void {
    audio.unlock();
    this.scene.start('Game', { tutorial: true });
  }
}
