import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { ENEMIES } from '../data/enemies';
import { GearId, MISSIONS, MissionDef, missionById } from '../data/missions';
import { SKINS } from '../data/retention';
import { ModeOutcome, RunRewards } from '../systems/Retention';
import { MODS, SUPPORT, DEFENSES } from '../data/upgrades';
import { weaponById } from '../data/weapons';
import {
  BUNKER_STAR_FRACTION, MissionOutcome, MissionResult, actOpen, isActFinale, missionAfter, nextUnlockHint,
  playerPower, veteranMedals, workshopOpen,
} from '../systems/Campaign';
import { ACT_STAR_GATE } from '../data/missions';
import { recruitById } from '../data/squad';
import { profile } from '../systems/Profile';
import { portal } from '../portal/Portal';
import { RETRY_CASH_BONUS } from '../portal/adRules';
import { MONO, STENCIL, button } from '../ui/widgets';
import { VIEW } from './config';
import { bonusValue } from '../ui/messages';
import { drawReticle, drawShield, drawTick } from '../ui/icons';
import { keyHint } from './touchControls';

export interface ResultsData {
  missionId: string;
  /** The mission as played (Fog Surge and Last Stand are generated, not looked up). */
  mission?: MissionDef;
  result: MissionResult;
  outcome: MissionOutcome | ModeOutcome;
  /** Contracts, Field Notes pages and skins this battle earned. */
  rewards?: RunRewards;
  /** Supplies for retaking a contested node today. */
  contested?: number;
  /** False in test mode and training: the result is shown but not kept. */
  saved: boolean;
  /** Why a lost mission was lost (bunker, asset, evacuation). */
  failReason?: string;
}

const GOLD = 0xe8c060;
const DIM = 0x3a3b36;

export function gearName(g: GearId | string): string {
  const [kind, id] = g.split(':');
  if (kind === 'mod') return MODS.find((m) => m.id === id)?.name ?? id;
  if (kind === 'support') return SUPPORT.find((s) => s.id === id)?.name ?? id;
  return DEFENSES.find((d) => d.id === id)?.name ?? id;
}

/** Mission results: stars, what earned them, Supplies, unlocks and what comes next. */
export class ResultsScene extends Phaser.Scene {
  private busy = false;
  private saved = false;
  private suppliesText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('Results');
  }

  create(data: ResultsData): void {
    this.busy = false;
    this.saved = data.saved;
    this.suppliesText = null;
    const mission = data.mission ?? missionById(data.missionId)!;
    const training = mission.id === 'training';
    const mode = mission.mode;
    const { result, outcome } = data;
    const win = result.victory;
    this.input.setDefaultCursor('default');

    const title = mode === 'endless' ? 'THE LINE FELL'
      : win ? (training ? 'THE LINE HELD' : mode === 'surge' ? 'SURGE BROKEN' : 'MISSION COMPLETE')
      : data.failReason ?? 'BUNKER OVERRUN';
    const subtitle = mission.veteran ? `VETERAN · MISSION ${mission.number} · ${mission.name.toUpperCase()} · ${mission.place}`
      : training ? 'TRAINING · the classic eight waves'
      : mode === 'surge' ? `FOG SURGE · ${mission.name.toUpperCase()} · ${mission.place}`
      : mode === 'endless' ? `LAST STAND · ${mission.place}`
      : `MISSION ${mission.number} · ${mission.name.toUpperCase()} · ${mission.place}`;
    this.add.rectangle(0, 0, VIEW.width, VIEW.height, win ? 0x000000 : 0x1a0000, 0.94).setOrigin(0).setInteractive();
    this.add.text(VIEW.centerX, 70, title, {
      fontFamily: STENCIL, fontSize: '64px', color: win || mode === 'endless' ? '#d8e0b0' : '#d84030', stroke: '#000', strokeThickness: 8,
    }).setOrigin(0.5);
    this.add.text(VIEW.centerX, 120, subtitle, {
      fontFamily: MONO, fontSize: '15px', color: '#b8b4a0',
    }).setOrigin(0.5);

    if (mode) this.drawScore(mode, outcome as ModeOutcome, result.wavesCleared);
    else if (!training) this.drawStars(mission.bonus, data);

    // Battle stats: one tile each.
    const tiles: [string, string][] = [
      ['WAVES', mode === 'endless' ? `${result.wavesCleared}` : `${result.wavesCleared} / ${result.totalWaves}`],
      ['KILLS', `${result.kills}`],
      ['HEADSHOTS', `${result.headshots}`],
      ['ACCURACY', `${Math.round(result.accuracy * 100)}%`],
    ];
    if (result.vehicles !== undefined) tiles.push(['SAVED', `${result.saved} / ${result.vehicles}`]);
    if (result.assetFraction !== undefined) tiles.push(['TARGET', `${Math.round(result.assetFraction * 100)}%`]);
    const tw = 118, tg = 10;
    const tx0 = VIEW.centerX - (tiles.length * tw + (tiles.length - 1) * tg) / 2;
    tiles.forEach(([k, v], i) => {
      const x = tx0 + i * (tw + tg);
      this.add.rectangle(x, 300, tw, 66, 0x0c0d0c, 0.9).setOrigin(0).setStrokeStyle(1, 0x4a4c48);
      this.add.text(x + tw / 2, 310, k, { fontFamily: MONO, fontSize: '11px', color: '#9a9a86' }).setOrigin(0.5, 0);
      this.add.text(x + tw / 2, 328, v, { fontFamily: STENCIL, fontSize: '26px', color: '#e0dcc0' }).setOrigin(0.5, 0);
    });

    // Rewards: a supplies headline, chips for what was earned, and one line about what comes next.
    const p = profile.get();
    const rw = data.rewards;
    const chips: string[] = [];
    const notes: string[] = [];
    let nextLine: string | null = null;
    let gauge: { power: number; threat: number } | null = null;
    if (mode) {
      const earned = outcome.supplies + (rw?.supplies ?? 0);
      const total = data.saved ? p.supplies : p.supplies + earned;
      const why = mode === 'surge' && outcome.firstClear ? "  (TODAY'S FIRST WIN)" : '';
      this.suppliesText = this.add.text(VIEW.centerX, 392, `+${earned} SUPPLIES${why}   ·   TOTAL ${total}`, {
        fontFamily: STENCIL, fontSize: '26px', color: '#c8d890', stroke: '#000', strokeThickness: 5,
      }).setOrigin(0.5, 0);
      for (const ms of (outcome as ModeOutcome).milestones) chips.push(`WAVE ${ms.wave} +${ms.supplies}`);
      chips.push(...rewardLines(rw));
      if (!data.saved) notes.push('TEST MODE: this result is not saved');
    } else if (!training) {
      const earned = outcome.supplies + (rw?.supplies ?? 0) + (data.contested ?? 0);
      const total = data.saved ? p.supplies : p.supplies + earned;
      this.suppliesText = this.add.text(VIEW.centerX, 392, `+${earned} SUPPLIES${outcome.firstClear ? '  ·  FIRST CLEAR' : ''}   ·   TOTAL ${total}`, {
        fontFamily: STENCIL, fontSize: '26px', color: '#c8d890', stroke: '#000', strokeThickness: 5,
      }).setOrigin(0.5, 0);
      if (data.contested) chips.push(`CONTESTED RETAKEN +${data.contested}`);
      chips.push(...rewardLines(rw));
      if (outcome.veteranMedal) chips.push(`VETERAN MEDAL ${veteranMedals(p)}/${MISSIONS.length}`);
      for (const w of outcome.unlockedWeapons) chips.push(`UNLOCK ${weaponById(w).shortName}`);
      for (const g of outcome.unlockedGear) chips.push(`UNLOCK ${gearName(g)}`);
      for (const r of outcome.unlockedRecruits ?? []) chips.push(`JOINS ${recruitById(r)!.name.split(' ')[0]}`);
      const next = missionAfter(mission.id);
      if (!data.saved) notes.push('TEST MODE: this result is not saved');
      else if (win && outcome.firstClear && isActFinale(mission)) {
        nextLine = !next ? 'The Bloom is dead. The coast is clear.'
          : actOpen(p, next.act) ? `Act ${next.act} is open on the map.`
          : `Earn ${ACT_STAR_GATE[next.act]} stars to open Act ${next.act}.`;
      } else if (!win) {
        const power = playerPower(p);
        gauge = { power, threat: mission.threat };
        nextLine = power < mission.threat ? 'Spend Supplies in the Workshop.' : 'So close. Try another loadout.';
      } else {
        nextLine = nextUnlockHint(p);
      }
    }

    // The crate icon sits left of the supplies headline.
    if (this.suppliesText) {
      const sw = this.suppliesText.width;
      this.add.graphics({ x: VIEW.centerX - sw / 2 - 22, y: 409 })
        .fillStyle(0x5a6a3a, 1).fillRect(-11, -9, 22, 18)
        .lineStyle(2, 0x2e361e, 1).strokeRect(-11, -9, 22, 18).lineBetween(-11, -9, 11, 9).lineBetween(11, -9, -11, 9);
    }

    // A defeat shows the power the player had against the threat of the mission.
    let cy = win ? 430 : 470;
    if (gauge) {
      const { power, threat } = gauge;
      const max = Math.max(power, threat) * 1.25;
      const bw = 360, bx = VIEW.centerX - bw / 2, by = 458;
      this.add.text(VIEW.centerX, 430, `POWER ${power}   ·   THREAT ${threat}`, {
        fontFamily: MONO, fontSize: '13px', color: power >= threat ? '#a8e090' : '#ff9a70',
      }).setOrigin(0.5, 0);
      this.add.graphics()
        .fillStyle(0x0c0d0c, 1).fillRect(bx, by, bw, 12)
        .fillStyle(power >= threat ? 0x6aae4a : 0xc89a30, 1).fillRect(bx, by, bw * (power / max), 12)
        .fillStyle(0xff7a5a, 1).fillRect(bx + bw * (threat / max) - 1, by - 5, 3, 22);
      cy = 492;
    }

    cy = this.chipRows(chips, cy);
    if (nextLine) {
      const ny = cy + 14;
      this.add.rectangle(VIEW.centerX - 10, ny, 570, 40, 0x1c1d1a, 0.92).setStrokeStyle(2, 0xc8a040);
      this.add.text(VIEW.centerX, ny, nextLine, { fontFamily: MONO, fontSize: '15px', color: '#e8c060' }).setOrigin(0.5);
      cy = ny + 20;
    }
    if (notes.length) this.add.text(VIEW.centerX, cy + 14, notes.join('\n'), { fontFamily: MONO, fontSize: '12px', color: '#8a8a76' }).setOrigin(0.5, 0);

    // Radio debrief after a win.
    if (win && mission.debrief.length) {
      this.add.text(24, VIEW.height - 24, mission.debrief.map((l) => `${l.who}: ${l.text}`).join('\n'), {
        fontFamily: MONO, fontSize: '13px', color: '#b8b4a0', wordWrap: { width: 340 }, lineSpacing: 3,
      }).setOrigin(0, 1);
    }

    // Actions.
    const bx = VIEW.width - 190;
    let y = 470;
    // The Heart (Act 3) and the Bloom (Act 4) each end with an epilogue.
    const finale = win && outcome.firstClear && data.saved && !mode && !training && isActFinale(mission) && mission.act >= 3;
    const toMap = (): void => this.leave(() => (finale
      ? this.scene.start('Ending', { act: mission.act })
      : this.scene.start('Map', { reveal: win && outcome.firstClear && data.saved ? mission.id : undefined })));
    const retry = (): void => this.leave(() => this.scene.start('Game', training ? { tutorial: false, missionId: 'training' } : { missionId: mission.id, veteran: mission.veteran }));
    let primary: () => void;
    if (mode) {
      const again = (): void => this.leave(() => this.scene.start('Game', { missionId: mission.id }));
      const hq = (): void => this.leave(() => this.scene.start('HQ', { tab: mode === 'surge' ? 'surge' : 'endless' }));
      primary = hq;
      button(this, bx, y, 300, 50, keyHint('BACK TO HQ', 'ENTER'), hq, 10, 0x5fae3c);
      y += 54;
      button(this, bx, y, 300, 38, mode === 'endless' ? 'TRY AGAIN' : 'PLAY AGAIN', again, 10, 0xc8a040);
    } else if (training) {
      primary = retry;
      button(this, bx, y, 300, 50, keyHint('TRAIN AGAIN', 'ENTER'), retry, 10, 0xc84030);
    } else if (win) {
      primary = toMap;
      button(this, bx, y, 300, 50, keyHint('CONTINUE', 'ENTER'), toMap, 10, 0x5fae3c);
      y += 54;
      button(this, bx, y, 300, 38, 'PLAY AGAIN', retry, 10, 0xc8a040);
    } else {
      primary = retry;
      button(this, bx, y, 300, 50, keyHint('RETRY', 'ENTER'), retry, 10, 0xc84030);
      y += 54;
      button(this, bx, y, 300, 38, workshopOpen(p) ? 'MAP & WORKSHOP' : 'VALLEY MAP', toMap, 10, 0xc8a040);
    }
    y += 46;
    button(this, bx, y, 300, 38, 'MAIN MENU', () => this.leave(() => this.scene.start('Menu')), 10, 0x5a5a50);
    this.input.keyboard!.on('keydown-ENTER', () => primary());

    // CrazyGames: the portal's celebration for a boss kill, a finished act, a first three-star result.
    if (data.saved && win && !training) {
      const proud = mission.objective.kind === 'boss' || (outcome.stars === 3 && outcome.previousStars < 3) || (mode === 'surge' && outcome.firstClear);
      if (proud) portal.happytime();
    }
    // Optional rewarded ads (only in a CrazyGames build with ads on).
    if (data.saved && !training) this.rewardOffers(data, mission.id, win, bx, y + 50);
  }

  /** Double the Supplies after any finish, or retry a loss with extra cash: the player's choice, never forced. */
  private rewardOffers(data: ResultsData, missionId: string, win: boolean, x: number, y: number): void {
    if (!portal.rewardReady) return;
    const supplies = data.outcome.supplies;
    if (supplies > 0) {
      const b = button(this, x, y, 300, 38, `DOUBLE SUPPLIES  +${supplies}  ▶ AD`, () => {
        b.disableInteractive().setAlpha(0.5);
        const ok = portal.rewarded(() => {
          profile.update((d) => {
            d.supplies += supplies;
            d.suppliesEarned += supplies;
          });
          audio.play('buy', { volume: 0.8 });
          this.suppliesText?.setText(`SUPPLIES DOUBLED  +${supplies}   ·   TOTAL ${profile.get().supplies}`);
        }, () => b.destroy());
        if (!ok) b.destroy();
      }, 10, 0x4a8ac8);
      y += 44;
    }
    if (!win) {
      const r = button(this, x, y, 300, 38, `RETRY +${Math.round(RETRY_CASH_BONUS * 100)}% CASH  ▶ AD`, () => {
        r.disableInteractive().setAlpha(0.5);
        let granted = false;
        const ok = portal.rewarded(() => { granted = true; }, () => {
          if (granted) this.leave(() => this.scene.start('Game', { missionId, bonusCash: RETRY_CASH_BONUS }), false);
          else r.destroy();
        });
        if (!ok) r.destroy();
      }, 10, 0x4a8ac8);
    }
  }

  private drawStars(goal: Parameters<typeof bonusValue>[0], data: ResultsData): void {
    const { outcome, result } = data;
    const xs = [-74, 0, 74].map((d) => VIEW.centerX + d);
    xs.forEach((x, i) => {
      const lit = i < outcome.stars;
      const g = this.add.graphics({ x, y: 182 });
      drawStar(g, lit ? GOLD : DIM, i === 1 ? 34 : 28);
      if (lit) {
        g.setScale(0);
        this.tweens.add({ targets: g, scale: 1, duration: 260, delay: 350 + i * 260, ease: 'Back.Out', onStart: () => audio.play('ui_click', { volume: 0.8, rate: 1 + i * 0.12 }) });
      }
    });
    // Under each star: the reason it was earned, as an icon and a short value.
    const reasons: [boolean, (g: Phaser.GameObjects.Graphics, c: number) => void, string][] = [
      [result.victory, drawTick, ''],
      [outcome.bunkerStar, drawShield, `${Math.round(BUNKER_STAR_FRACTION * 100)}%`],
      [outcome.bonusMet, drawReticle, bonusValue(goal)],
    ];
    reasons.forEach(([ok, draw, value], i) => {
      const x = xs[i];
      draw(this.add.graphics({ x: value ? x - 22 : x, y: 248 }), ok ? GOLD : DIM);
      if (value) this.add.text(x - 8, 248, value, { fontFamily: MONO, fontSize: '15px', color: ok ? '#e0dcc0' : '#6a6a5e' }).setOrigin(0, 0.5);
    });
  }

  /** Fog Surge and Last Stand: the score and today's or all-time best instead of stars. */
  private drawScore(mode: 'surge' | 'endless', o: ModeOutcome, wave: number): void {
    const big = mode === 'surge' ? `SCORE ${o.score.toLocaleString('en-US')}` : `WAVE ${wave}`;
    const best = mode === 'surge' ? `TODAY'S BEST ${o.best.toLocaleString('en-US')}` : `BEST WAVE ${o.best}`;
    this.add.text(VIEW.centerX, 190, big, { fontFamily: STENCIL, fontSize: '48px', color: '#e8c060', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);
    this.add.text(VIEW.centerX, 240, o.newBest && o.score > 0 ? `NEW BEST  ·  ${best}` : best, {
      fontFamily: MONO, fontSize: '17px', color: o.newBest ? '#a8e090' : '#b8b4a0',
    }).setOrigin(0.5);
    if (o.newBest && o.score > 0) audio.play('wave_clear', { volume: 0.6, rate: 1.2 });
  }

  /** Reward and unlock chips, centred in rows. Returns the y just below the last row. */
  private chipRows(chips: string[], y: number): number {
    if (!chips.length) return y;
    const maxW = 600, gap = 8, rowH = 26;
    const placed: { t: Phaser.GameObjects.Text; x: number; w: number; row: number }[] = [];
    const rowW: number[] = [];
    let row = 0, cur = 0;
    for (const c of chips) {
      const t = this.add.text(0, 0, c, { fontFamily: MONO, fontSize: '12px', color: '#e8c060' }).setDepth(2);
      const w = t.width + 20;
      if (cur > 0 && cur + w > maxW) {
        rowW.push(cur - gap);
        row++;
        cur = 0;
      }
      placed.push({ t, x: cur, w, row });
      cur += w + gap;
    }
    rowW.push(cur - gap);
    for (const c of placed) {
      const ox = VIEW.centerX - rowW[c.row] / 2;
      const yy = y + c.row * rowH;
      this.add.rectangle(ox + c.x, yy, c.w, 20, 0x1a1b18, 0.95).setOrigin(0, 0.5).setStrokeStyle(1, 0x7a6420).setDepth(1);
      c.t.setPosition(ox + c.x + 10, yy).setOrigin(0, 0.5);
    }
    return y + (row + 1) * rowH;
  }

  /** Leaves the results; a CrazyGames midgame break may run first (never in the first missions, three minutes apart). */
  private leave(then: () => void, allowBreak = true): void {
    if (this.busy) return;
    this.busy = true;
    this.scene.stop('Game');
    const wins = Object.values(profile.get().missions).filter((r) => r.wins > 0).length;
    if (allowBreak && this.saved && portal.midgame(wins, then)) return;
    then();
  }
}

/** One line each for finished contracts, Field Notes pages and new skins. */
function rewardLines(rw: RunRewards | undefined): string[] {
  if (!rw) return [];
  const out = rw.contracts.map((c) => `CONTRACT DONE: ${c.text.toUpperCase()}  +${c.reward}`);
  if (rw.setBonus) out.push(`ALL TODAY'S CONTRACTS DONE  +${rw.setBonus}`);
  if (rw.codex.length) {
    const pages = rw.codex.map((c) => `${ENEMIES[c.enemy]?.name ?? c.enemy} p.${c.page}`).join(', ');
    out.push(`FIELD NOTES: ${pages}  +${rw.codex.reduce((n, c) => n + c.supplies, 0)}`);
  }
  for (const s of rw.skins) out.push(`MASTERY: ${weaponById(s.weapon).shortName} ${SKINS[s.skin].name.toUpperCase()} SKIN UNLOCKED (WORKSHOP)`);
  return out;
}




export function drawStar(g: Phaser.GameObjects.Graphics, color: number, r: number): void {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(new Phaser.Math.Vector2(Math.cos(a) * rr, Math.sin(a) * rr));
  }
  g.fillStyle(0x000000, 0.6).fillPoints(pts.map((v) => new Phaser.Math.Vector2(v.x + 3, v.y + 4)), true);
  g.fillStyle(color, 1).fillPoints(pts, true);
  g.lineStyle(2, 0x000000, 0.8).strokePoints(pts, true);
}
