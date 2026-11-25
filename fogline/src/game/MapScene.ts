import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { ACT_NAMES, ACT_STAR_GATE, MISSIONS, MissionDef, objectiveText } from '../data/missions';
import { weaponById } from '../data/weapons';
import { makeCanvas, mulberry32, rand } from '../rendering/CanvasUtil';
import {
  actOpen, acts, barracksOpen, bonusText, currentAct, isMissionUnlocked, isWon, needsLoadout, nextMission, playerPower,
  rewardNames, starTotals, starsBeforeAct, threatRating, VETERAN, veteranMedals, veteranOpen, workshopOpen,
} from '../systems/Campaign';
import { profile } from '../systems/Profile';
import { CONTESTED_BONUS, hqOpen, hqWaiting, isContested, playReport, refreshDay } from '../systems/Retention';
import { showDailyDrop } from './HQScene';
import { MONO, STENCIL, button } from '../ui/widgets';
import { VIEW } from './config';
import { drawStar } from './ResultsScene';

export interface MapData {
  /** A mission just won for the first time: the fog pulls back from it on arrival. */
  reveal?: string;
  /** Which act's map to show (defaults to the act of the next mission). */
  act?: number;
}

/** Each act's map: its title and the intro card shown the first time it opens. */
const ACT_MAPS: Record<number, { title: string; card: string[] }> = {
  1: {
    title: 'HARLOW VALLEY',
    card: [
      'Three weeks ago something went wrong at Meridian Station, at the head of Harlow Valley.',
      'A grey fog rolled out of it. Wherever it touches, the dead get up and walk.',
      '',
      'The army threw a chain of bunkers across the valley to stop it. The soldiers call it the Fogline.',
      'You are Warden, the last gunner on a failing line. Hold it while the valley gets out.',
    ],
  },
  2: {
    title: 'MILLBROOK',
    card: [
      'The farm line held, and Dr. Varga found something: when enough of the dead fall, the fog thins.',
      'Command has stopped retreating. Today the Fogline moves forward, into Millbrook.',
      '',
      'Survivors are joining the line. Post them at the side windows and train them in the Barracks.',
      'New dead walk here: spitters, howlers, sappers and worse. Something is singing on the river.',
    ],
  },
  3: {
    title: 'MERIDIAN',
    card: [
      'Dr. Varga has told the truth: Meridian grew the fog, to clean up battlefields. It learned to raise them.',
      'At its centre is the first culture: the Heart. All of the fog comes from it.',
      '',
      'The valley is being evacuated by rail. Kestrel is flying again. Dot is building attachments for your guns.',
      'The dead here are changing: Fogborn, and worse. Push through the quarry and the yard to the gate.',
    ],
  },
  4: {
    title: 'THE NORTH COAST',
    card: [
      'The Heart is dead, but its spores rode the river down to the sea. Saltmarsh harbour woke up last night.',
      'Lurkers wait in the mud. Sporelings burst into clouds you cannot see through. Storms roll in off the water.',
      '',
      'Somewhere up the coast, at Fort Ashby, the Heart\'s last seed is flowering.',
      'The Fogline moves north. One more push, Warden.',
    ],
  },
};

const MAP_TEXTURE = 'valley_map';
const actMissions = (act: number): MissionDef[] => MISSIONS.filter((m) => m.act === act);
const FOG_BRUSH = 'map_fog_brush';
const PANEL_X = 930;
/** Fog cleared around a won mission, and around the one that is open next. */
const CLEAR_WON = 120;
const CLEAR_OPEN = 70;
/** Meridian Station, the source of the fog (Act 3), far up the valley. */
const MERIDIAN = { x: 860, y: 80 };

/** The valley map: missions as nodes, fog over everything not yet won. */
export class MapScene extends Phaser.Scene {
  private fog!: Phaser.GameObjects.RenderTexture;
  private brush!: Phaser.GameObjects.Image;
  private selected!: MissionDef;
  private panel: Phaser.GameObjects.GameObject[] = [];
  private nodes = new Map<string, Phaser.GameObjects.Container>();
  private pulse: Phaser.GameObjects.Arc | null = null;
  private card: Phaser.GameObjects.Container | null = null;
  private act = 1;

  constructor() {
    super('Map');
  }

  create(data: MapData = {}): void {
    this.input.setDefaultCursor('default');
    this.panel = [];
    this.nodes.clear();
    this.card = null;
    const p = profile.get();
    if (refreshDay(p, Date.now())) profile.save();
    const revealed = data.reveal ? MISSIONS.find((m) => m.id === data.reveal) : undefined;
    this.act = data.act ?? revealed?.act ?? currentAct(p);
    if (!actOpen(p, this.act)) this.act = 1;
    const key = `${MAP_TEXTURE}_${this.act}`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, paintValley(this.act));
    if (!this.textures.exists(FOG_BRUSH)) this.textures.addCanvas(FOG_BRUSH, paintBrush());
    this.add.image(0, 0, key).setOrigin(0);
    this.drawRoads(p);

    // Nodes sit under the fog; the fog is cleared around the ones the player has reached.
    for (const m of actMissions(this.act)) this.nodes.set(m.id, this.makeNode(m));

    this.fog = this.add.renderTexture(0, 0, PANEL_X, VIEW.height).setOrigin(0);
    this.brush = this.make.image({ key: FOG_BRUSH, add: false });
    this.paintFog(p, data.reveal);
    // The source of the fog shows faintly through it: the far goal of the campaign.
    if (this.act < 3) this.add.text(MERIDIAN.x, MERIDIAN.y, '☣', { fontFamily: STENCIL, fontSize: '30px', color: '#d8c8a0' }).setOrigin(0.5).setAlpha(0.55);
    if (this.act < 3) this.add.text(MERIDIAN.x, MERIDIAN.y + 26, 'MERIDIAN STATION', { fontFamily: MONO, fontSize: '12px', color: '#d8d0b0' }).setOrigin(0.5).setAlpha(0.6);

    // Header.
    this.add.rectangle(0, 0, PANEL_X, 44, 0x0c0d0b, 0.82).setOrigin(0);
    this.add.text(16, 10, ACT_MAPS[this.act]?.title ?? 'THE VALLEY', { fontFamily: STENCIL, fontSize: '24px', color: '#e0dcc0', stroke: '#000', strokeThickness: 3 });
    this.drawActTabs(p);
    const stars = starTotals(p);
    this.add.text(PANEL_X - 14, 15, `★ ${stars.earned}/${stars.total}   SUPPLIES ${p.supplies}   POWER ${playerPower(p)}`, {
      fontFamily: MONO, fontSize: '14px', color: '#e8c060',
    }).setOrigin(1, 0);

    // Side panel.
    this.add.rectangle(PANEL_X, 0, VIEW.width - PANEL_X, VIEW.height, 0x161714, 0.97).setOrigin(0);
    this.add.rectangle(PANEL_X, 0, 3, VIEW.height, 0x5a5c58).setOrigin(0);
    const nav = PANEL_X + (VIEW.width - PANEL_X) / 2;
    let by = VIEW.height - 184;
    if (workshopOpen(p)) {
      button(this, nav, by, 300, 40, `WORKSHOP  (${p.supplies} SUPPLIES)`, () => this.go('Workshop'), 10, 0x8a9a50);
      by += 46;
    }
    if (barracksOpen(p)) {
      button(this, nav, by, 300, 36, 'BARRACKS', () => this.go('Barracks'), 10, 0x8a7a50);
      by += 44;
    }
    if (needsLoadout(p)) {
      button(this, nav, by, 300, 36, 'LOADOUT', () => this.go('Loadout', { missionId: this.selected.id, deploy: false }), 10, 0x6a7a8a);
      by += 44;
    }
    button(this, nav, Math.max(by, VIEW.height - 40), 300, 36, 'MAIN MENU', () => this.go('Menu'), 10, 0x5a5a50);
    if (hqOpen(p)) this.drawHqButton(p);

    const next = nextMission(p);
    const inAct = actMissions(this.act);
    this.select(next.act === this.act ? next : [...inAct].reverse().find((m) => isMissionUnlocked(p, m.id)) ?? inAct[0]);
    this.input.keyboard!.on('keydown-ENTER', () => this.deploy());
    this.input.keyboard!.on('keydown-ESC', () => this.go('Menu'));
    // Playtest numbers: F9 shows starts, wins, fail rate and minutes per mission.
    this.input.keyboard!.on('keydown-F9', () => this.toggleReport());
    (window as unknown as { __foglineStats: () => unknown }).__foglineStats = () => playReport(profile.get());

    if (!p.hints.includes(`act${this.act}card`)) this.showActCard();
    // Once a day the drop is waiting on the map: one click claims it.
    else if (!data.reveal) this.card = showDailyDrop(this, () => this.scene.restart({ act: this.act }));
  }

  /** ACT 1 / ACT 2 tabs; a locked act says how many stars it needs. */
  private drawActTabs(p: ReturnType<typeof profile.get>): void {
    let x = 230;
    for (const act of acts()) {
      const open = actOpen(p, act);
      const current = act === this.act;
      const need = ACT_STAR_GATE[act] ?? 0;
      const fought = MISSIONS.some((m) => m.act === act && isContested(p, m.id, Date.now()));
      // Only the act on screen spells out its name, so three tabs fit beside the totals.
      const label = open ? `ACT ${act}${current ? ` · ${ACT_NAMES[act] ?? ''}` : ''}${fought ? ' ⚑' : ''}` : `ACT ${act} · LOCKED (${starsBeforeAct(p, act)}/${need} ★)`;
      const t = this.add.text(x, 15, label, {
        fontFamily: MONO, fontSize: '13px', color: current ? '#f0e0a0' : open ? '#a8a088' : '#6a6658',
        backgroundColor: current ? '#3a3320' : undefined, padding: { x: 6, y: 2 },
      });
      if (open && !current) {
        t.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          audio.play('ui_click', { volume: 0.6 });
          this.scene.restart({ act });
        });
      }
      x += t.width + 14;
    }
  }

  // ------------------------------------------------------------ fog

  private paintFog(p: ReturnType<typeof profile.get>, reveal?: string): void {
    const fog = this.fog;
    fog.fill(0x6c706a, 0.93);
    // Mottled fog: stamp darker and lighter clouds so it does not read as a flat grey sheet.
    const rng = mulberry32(7);
    const puff = this.make.image({ key: FOG_BRUSH, add: false });
    for (let i = 0; i < 70; i++) {
      puff.setScale(rand(rng, 1.2, 3.2)).setTint(rng() < 0.5 ? 0x8a8e88 : 0x4c504a).setAlpha(rand(rng, 0.25, 0.5));
      fog.draw(puff, rand(rng, 0, PANEL_X), rand(rng, 0, VIEW.height));
    }
    const clear = (x: number, y: number, r: number): void => {
      this.brush.setScale(r / 64);
      fog.erase(this.brush, x, y);
    };
    // A fresh win: the fog rolls back from that node, then opens toward the next one.
    const list = actMissions(this.act);
    const won = list.find((m) => m.id === reveal);
    const after = won ? list[list.indexOf(won) + 1] : undefined;
    const next = after && isMissionUnlocked(p, after.id) ? after : undefined;
    for (const m of list) {
      if (m === won || m === next) continue;
      if (isWon(p, m.id)) clear(m.map.x, m.map.y, CLEAR_WON);
      else if (isMissionUnlocked(p, m.id)) clear(m.map.x, m.map.y, CLEAR_OPEN);
    }
    if (!won) return;
    if (next && isWon(p, next.id)) clear(next.map.x, next.map.y, CLEAR_WON);
    const state = { r: 0, n: 0 };
    audio.play('wave_clear', { volume: 0.6 });
    this.tweens.add({
      targets: state, r: CLEAR_WON, duration: 1400, ease: 'Sine.Out', delay: 300,
      onUpdate: () => clear(won.map.x, won.map.y, state.r),
      onComplete: () => {
        if (!next || isWon(p, next.id)) return;
        this.tweens.add({
          targets: state, n: CLEAR_OPEN, duration: 900, ease: 'Sine.Out',
          onUpdate: () => clear(next.map.x, next.map.y, state.n),
          onComplete: () => audio.play('radio', { volume: 0.5 }),
        });
      },
    });
  }

  // ------------------------------------------------------------ nodes

  private drawRoads(p: ReturnType<typeof profile.get>): void {
    const g = this.add.graphics();
    const list = actMissions(this.act);
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1].map, b = list[i].map;
      const done = isWon(p, list[i - 1].id);
      g.lineStyle(done ? 5 : 3, done ? 0xc8a050 : 0x6a5a40, done ? 0.9 : 0.6);
      dashed(g, a.x, a.y, b.x, b.y, done ? 0 : 10);
    }
    if (this.act >= 3) return;
    const last = list[list.length - 1].map;
    g.lineStyle(3, 0x6a5a40, 0.5);
    dashed(g, last.x, last.y, MERIDIAN.x, MERIDIAN.y, 10);
  }

  private makeNode(m: MissionDef): Phaser.GameObjects.Container {
    const p = profile.get();
    const won = isWon(p, m.id);
    const open = isMissionUnlocked(p, m.id);
    const boss = m.objective.kind === 'boss';
    const color = won ? 0x4f8a3a : open ? 0xc89a30 : 0x4a4a44;
    const r = boss ? 24 : 19;
    const parts: Phaser.GameObjects.GameObject[] = [
      this.add.circle(2, 3, r + 3, 0x000000, 0.55),
      this.add.circle(0, 0, r + 3, 0x111210),
      this.add.circle(0, 0, r, boss ? (won ? 0x4f8a3a : 0x9a2a1e) : color),
      this.add.text(0, 0, boss ? '☠' : String(m.number), { fontFamily: STENCIL, fontSize: boss ? '24px' : '20px', color: '#f4ecd0', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5),
      this.add.text(0, r + 14, m.name.toUpperCase(), { fontFamily: MONO, fontSize: '12px', color: '#f0e8c8', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5),
    ];
    const stars = p.missions[m.id]?.stars ?? 0;
    if (won) {
      for (let i = 0; i < 3; i++) {
        const s = this.add.graphics({ x: (i - 1) * 15, y: -r - 10 });
        drawStar(s, i < stars ? 0xe8c060 : 0x3a3b36, 7);
        parts.push(s);
      }
    }
    if (p.missions[m.id]?.veteran) {
      parts.push(this.add.text(r + 4, -r - 2, '✪', { fontFamily: STENCIL, fontSize: '16px', color: '#c8b0ff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5));
    }
    if (won && isContested(p, m.id, Date.now())) {
      const ring = this.add.circle(0, 0, r + 9).setStrokeStyle(3, 0xd84030, 1).setFillStyle(0, 0);
      this.tweens.add({ targets: ring, scale: 1.25, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });
      parts.unshift(ring);
      parts.push(this.add.text(0, -r - 26, 'CONTESTED', { fontFamily: MONO, fontSize: '11px', color: '#ff9a70', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5));
    }
    const c = this.add.container(m.map.x, m.map.y, parts).setSize(r * 2 + 40, r * 2 + 30);
    if (open) {
      c.setInteractive({ useHandCursor: true });
      c.on('pointerdown', () => {
        audio.play('ui_click', { volume: 0.6 });
        if (this.selected === m) this.deploy();
        else this.select(m);
      });
      c.on('pointerover', () => audio.play('ui_hover', { volume: 0.4 }));
    }
    return c;
  }

  private select(m: MissionDef): void {
    this.selected = m;
    for (const o of this.panel) o.destroy();
    this.panel = [];
    const p = profile.get();
    this.pulse?.destroy();
    this.pulse = this.add.circle(m.map.x, m.map.y, 30).setStrokeStyle(3, 0xffe090, 1).setFillStyle(0, 0);
    this.tweens.add({ targets: this.pulse, scale: 1.35, alpha: 0.2, duration: 900, yoyo: true, repeat: -1 });

    const x = PANEL_X + 22, w = VIEW.width - PANEL_X - 44;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.panel.push(o);
      return o;
    };
    const text = (y: number, s: string, size: number, color: string, font = MONO): Phaser.GameObjects.Text =>
      add(this.add.text(x, y, s, { fontFamily: font, fontSize: `${size}px`, color, wordWrap: { width: w }, lineSpacing: 3 }));

    text(22, m.objective.kind === 'boss' ? 'BOSS' : `MISSION ${m.number}`, 13, '#a8a088');
    text(40, m.name.toUpperCase(), 30, '#e8e0c0', STENCIL);
    text(80, m.place, 14, '#b8b4a0');
    let y = 112;
    const row = (label: string, value: string, color = '#e0dcc0'): void => {
      text(y, label, 12, '#8a8a76');
      const t = text(y + 16, value, 15, color);
      y += 22 + t.height;
    };
    row('OBJECTIVE', objectiveText(m.objective));
    row('BONUS ★', bonusText(m.bonus));
    const power = playerPower(p);
    const rating = threatRating(power, m.threat);
    row('THREAT', `${m.threat}   ·   YOUR POWER ${power}`, rating === 'ready' ? '#8ae070' : rating === 'risky' ? '#e8c060' : '#ff7a5a');
    const lend = [...m.issue.weapons.map((id) => weaponById(id).name)];
    if (lend.length) row('ISSUED FOR THIS MISSION', lend.join(', '));
    if (isContested(p, m.id, Date.now())) row('CONTESTED', `The fog took it back. Win it today: +${Math.round(m.supplies * CONTESTED_BONUS)} Supplies`, '#ff9a70');
    const rewards = rewardNames(m);
    if (!isWon(p, m.id)) row('FIRST CLEAR', `${m.supplies * 1.5 | 0}+ Supplies${rewards.length ? `\n${rewards.join(', ')}` : ''}`, '#c8d890');
    else {
      const rec = p.missions[m.id];
      row('BEST', `${'★'.repeat(rec.stars)}${'☆'.repeat(3 - rec.stars)}   ·   ${rec.bestKills} kills`, '#e8c060');
    }
    const cx = PANEL_X + (VIEW.width - PANEL_X) / 2;
    const by = Math.min(y + 34, VIEW.height - 200);
    if (veteranOpen(p, m.id)) {
      // A won mission: replay it, or take it on Veteran for a medal.
      add(button(this, cx - 76, by, 146, 50, 'REPLAY [↵]', () => this.deploy(), 10, 0xc84030));
      add(button(this, cx + 76, by, 146, 50, p.missions[m.id]?.veteran ? 'VETERAN ✪' : 'VETERAN', () => this.deploy(true), 10, 0x8a6ac8));
      add(this.add.text(cx, by + 32, `Veteran: harder waves, ×${VETERAN.supplies} Supplies
${veteranMedals(p)} medals ✪`, {
        fontFamily: MONO, fontSize: '11px', color: '#b8a8e0', align: 'center', wordWrap: { width: 300 },
      }).setOrigin(0.5, 0));
    } else {
      add(button(this, cx, by, 300, 50, 'DEPLOY  [ENTER]', () => this.deploy(), 10, 0xc84030));
    }
  }

  private report: Phaser.GameObjects.Container | null = null;

  /** Playtest table (F9): how each mission is going, to tune threat and rewards. */
  private toggleReport(): void {
    if (this.report) {
      this.report.destroy();
      this.report = null;
      return;
    }
    const rows = playReport(profile.get());
    const parts: Phaser.GameObjects.GameObject[] = [this.add.rectangle(0, 0, VIEW.width, VIEW.height, 0x000000, 0.85).setOrigin(0).setInteractive()];
    parts.push(this.add.text(40, 30, 'PLAYTEST NUMBERS  (F9 to close)', { fontFamily: STENCIL, fontSize: '26px', color: '#e8e0c0' }));
    const head = 'MISSION                  STARTS  WINS  FAILS  FAIL%   MIN/RUN';
    const body = rows.length
      ? rows.map((r) => `${r.name.padEnd(24).slice(0, 24)} ${String(r.starts).padStart(6)} ${String(r.wins).padStart(5)} ${String(r.fails).padStart(6)} ${String(Math.round(r.failRate * 100)).padStart(5)}% ${r.minutes.toFixed(1).padStart(8)}`).join('\n')
      : 'No missions played on this save yet.';
    parts.push(this.add.text(40, 74, `${head}\n${body}`, { fontFamily: MONO, fontSize: '14px', color: '#d0ccb4', lineSpacing: 3 }));
    parts.push(this.add.text(40, VIEW.height - 40, 'Target fail rate 15–30% per mission. Kept on this device only.', { fontFamily: MONO, fontSize: '13px', color: '#9a9a86' }));
    this.report = this.add.container(0, 0, parts).setDepth(80);
  }

  /** The HQ, bottom left of the map, with a red badge when something is waiting. */
  private drawHqButton(p: ReturnType<typeof profile.get>): void {
    const waiting = hqWaiting(p, Date.now());
    button(this, 110, VIEW.height - 34, 190, 44, 'HQ  [H]', () => this.go('HQ'), 10, 0xe8c060);
    if (waiting.length) {
      const dot = this.add.circle(196, VIEW.height - 54, 11, 0xd84030).setStrokeStyle(2, 0x000000).setDepth(11);
      this.add.text(196, VIEW.height - 54, `${waiting.length}`, { fontFamily: STENCIL, fontSize: '15px', color: '#ffffff' }).setOrigin(0.5).setDepth(12);
      this.tweens.add({ targets: dot, scale: 1.25, yoyo: true, repeat: -1, duration: 520 });
      this.add.text(215, VIEW.height - 34, waiting.join(' · '), { fontFamily: MONO, fontSize: '12px', color: '#ffe0a0', stroke: '#000', strokeThickness: 3 }).setOrigin(0, 0.5).setDepth(11);
    }
    this.input.keyboard!.on('keydown-H', () => { if (!this.card) this.go('HQ'); });
  }

  private deploy(veteran = false): void {
    if (this.card) return;
    const m = this.selected;
    audio.unlock();
    audio.play('radio', { volume: 0.6 });
    if (needsLoadout(profile.get())) this.go('Loadout', { missionId: m.id, deploy: true, veteran });
    else this.go('Game', { missionId: m.id, veteran });
  }

  private go(scene: string, data?: object): void {
    this.scene.start(scene, data);
  }

  // ------------------------------------------------------------ act card

  private showActCard(): void {
    const W = 760, H = 380;
    const bg = this.add.rectangle(0, 0, VIEW.width, VIEW.height, 0x000000, 0.72).setOrigin(0).setInteractive();
    const box = this.add.rectangle(VIEW.centerX, VIEW.height / 2, W, H, 0x1c1d1a, 0.98).setStrokeStyle(2, 0x7a6420);
    const title = this.add.text(VIEW.centerX, VIEW.height / 2 - H / 2 + 40, `ACT ${this.act} — ${ACT_NAMES[this.act] ?? ''}`, {
      fontFamily: STENCIL, fontSize: '36px', color: '#e8e0c0', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);
    const body = this.add.text(VIEW.centerX, VIEW.height / 2 - 70, (ACT_MAPS[this.act]?.card ?? []).join('\n'), { fontFamily: MONO, fontSize: '15px', color: '#d0ccb4', align: 'center', wordWrap: { width: W - 60 }, lineSpacing: 5 }).setOrigin(0.5, 0);
    const parts: Phaser.GameObjects.GameObject[] = [bg, box, title, body];
    const close = (): void => {
      for (const o of parts) o.destroy();
      this.card = null;
      const id = `act${this.act}card`;
      profile.update((d) => { if (!d.hints.includes(id)) d.hints.push(id); });
    };
    parts.push(button(this, VIEW.centerX, VIEW.height / 2 + H / 2 - 44, 260, 46, 'TO THE LINE', close, 20, 0xc84030));
    this.card = this.add.container(0, 0, parts).setDepth(50);
    this.input.keyboard!.once('keydown-ENTER', () => { if (this.card) close(); });
  }
}

function dashed(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, dash: number): void {
  if (dash <= 0) {
    g.lineBetween(x0, y0, x1, y1);
    return;
  }
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.floor(len / (dash * 2));
  for (let i = 0; i < n; i++) {
    const t0 = (i * 2 * dash) / len, t1 = ((i * 2 + 1) * dash) / len;
    g.lineBetween(x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0, x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1);
  }
}

/** A soft round brush for clearing and mottling the fog. */
function paintBrush(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvas;
}

/** The valley as an army field map: paper, grid, contours, river, woods and towns. */
function paintValley(act: number): HTMLCanvasElement {
  const W = PANEL_X, H = VIEW.height;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(2026 + act * 101);
  if (act === 2) return paintMillbrook(canvas, ctx, rng);
  if (act === 3) return paintSource(canvas, ctx, rng);
  if (act === 4) return paintCoast(canvas, ctx, rng);
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#5a5a3e');
  bg.addColorStop(1, '#46482f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // paper stains
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(${rng() < 0.5 ? '20,18,10' : '120,110,70'},${rand(rng, 0.03, 0.08)})`;
    ctx.beginPath(); ctx.arc(rand(rng, 0, W), rand(rng, 0, H), rand(rng, 20, 90), 0, Math.PI * 2); ctx.fill();
  }
  // contour lines around a few hills
  ctx.strokeStyle = 'rgba(200,180,120,0.18)';
  ctx.lineWidth = 1.2;
  for (const [hx, hy, hr] of [[90, 200, 140], [560, 160, 170], [400, 640, 110], [780, 640, 120]]) {
    for (let k = 1; k < 7; k++) {
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.2) {
        const rr = (hr * k) / 6 * (1 + 0.15 * Math.sin(a * 3 + k));
        const px = hx + Math.cos(a) * rr * 1.3, py = hy + Math.sin(a) * rr * 0.8;
        if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
  // grid
  ctx.strokeStyle = 'rgba(20,20,12,0.22)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(20,20,12,0.4)';
  ctx.font = '10px Consolas, monospace';
  for (let x = 0; x < W; x += 80) ctx.fillText(String.fromCharCode(65 + x / 80), x + 4, H - 6);
  // the river down the valley
  ctx.strokeStyle = 'rgba(70,96,110,0.75)';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(-10, 470);
  ctx.bezierCurveTo(200, 430, 260, 220, 420, 230);
  ctx.bezierCurveTo(560, 240, 640, 300, 760, 180);
  ctx.bezierCurveTo(820, 120, 880, 90, W + 10, 40);
  ctx.stroke();
  // woods
  for (let i = 0; i < 260; i++) {
    const x = rand(rng, 0, W), y = rand(rng, 50, H);
    ctx.fillStyle = `rgba(30,40,22,${rand(rng, 0.35, 0.6)})`;
    ctx.beginPath(); ctx.arc(x, y, rand(rng, 2, 5), 0, Math.PI * 2); ctx.fill();
  }
  // towns and farms as little block clusters
  for (const [tx, ty, n] of [[110, 600, 4], [600, 540, 5], [320, 300, 9], [800, 480, 8], [860, 80, 6]]) {
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = 'rgba(30,22,16,0.7)';
      ctx.fillRect(tx + rand(rng, -40, 40), ty + rand(rng, -30, 30), rand(rng, 8, 16), rand(rng, 6, 12));
    }
  }
  // region labels
  ctx.fillStyle = 'rgba(230,220,180,0.5)';
  ctx.font = 'bold 15px Consolas, monospace';
  ctx.fillText('HARLOW FARMS', 30, 690);
  ctx.fillText('ORCHARDS', 420, 470);
  ctx.fillText('MILLBROOK', 330, 255);
  return canvas;
}

/** Act 2's map: the town of Millbrook, the highway and the river. */
function paintMillbrook(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, rng: () => number): HTMLCanvasElement {
  const W = canvas.width, H = canvas.height;
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#55584a');
  bg.addColorStop(1, '#3e4236');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 50; i++) {
    ctx.fillStyle = `rgba(${rng() < 0.5 ? '20,18,10' : '120,110,70'},${rand(rng, 0.03, 0.08)})`;
    ctx.beginPath(); ctx.arc(rand(rng, 0, W), rand(rng, 0, H), rand(rng, 20, 90), 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(20,20,12,0.22)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // The river, crossed by the bridge near the top right.
  ctx.strokeStyle = 'rgba(70,96,110,0.8)';
  ctx.lineWidth = 16;
  ctx.beginPath(); ctx.moveTo(-10, 300); ctx.bezierCurveTo(260, 260, 520, 360, 700, 300); ctx.bezierCurveTo(820, 260, 880, 200, W + 10, 160); ctx.stroke();
  // Highway 9: a wide pale road on a diagonal.
  ctx.strokeStyle = 'rgba(190,180,150,0.35)';
  ctx.lineWidth = 14;
  ctx.beginPath(); ctx.moveTo(0, 680); ctx.lineTo(620, 330); ctx.lineTo(W, 120); ctx.stroke();
  // Street blocks of the town.
  for (let i = 0; i < 140; i++) {
    const x = rand(rng, 60, 700), y = rand(rng, 380, 700);
    ctx.fillStyle = 'rgba(30,22,16,0.6)';
    ctx.fillRect(x, y, rand(rng, 10, 26), rand(rng, 8, 18));
  }
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = `rgba(30,40,22,${rand(rng, 0.35, 0.6)})`;
    ctx.beginPath(); ctx.arc(rand(rng, 0, W), rand(rng, 40, 260), rand(rng, 2, 5), 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(230,220,180,0.5)';
  ctx.font = 'bold 15px Consolas, monospace';
  ctx.fillText('MILLBROOK', 300, 690);
  ctx.fillText('HIGHWAY 9', 420, 420);
  ctx.fillText('RIVER', 120, 280);
  ctx.fillText('THE QUARRY', 700, 60);
  return canvas;
}

/** Act 3's map: the quarry, the rail yard and Meridian Station behind its fence. */
function paintSource(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, rng: () => number): HTMLCanvasElement {
  const W = canvas.width, H = canvas.height;
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#4e5246');
  bg.addColorStop(1, '#383c32');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 50; i++) {
    ctx.fillStyle = `rgba(${rng() < 0.5 ? '20,18,10' : '120,110,70'},${rand(rng, 0.03, 0.08)})`;
    ctx.beginPath(); ctx.arc(rand(rng, 0, W), rand(rng, 0, H), rand(rng, 20, 90), 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(20,20,12,0.22)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // The quarry pit: stepped contour rings.
  ctx.strokeStyle = 'rgba(200,180,120,0.25)';
  for (let k = 1; k < 7; k++) {
    ctx.beginPath(); ctx.ellipse(180, 580, 40 + k * 22, 24 + k * 13, 0.2, 0, Math.PI * 2); ctx.stroke();
  }
  // Railway lines fanning across the yard.
  ctx.strokeStyle = 'rgba(30,26,20,0.75)';
  ctx.lineWidth = 3;
  for (let k = 0; k < 5; k++) {
    ctx.beginPath(); ctx.moveTo(0, 470 + k * 14); ctx.bezierCurveTo(300, 450 + k * 10, 520, 520 - k * 18, W, 360 - k * 26); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(30,26,20,0.4)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 9) { ctx.beginPath(); ctx.moveTo(x, 455 + Math.sin(x / 140) * 30); ctx.lineTo(x + 3, 540 + Math.sin(x / 140) * 30); ctx.stroke(); }
  // Meridian Station: a fenced compound at the top right.
  ctx.strokeStyle = 'rgba(200,200,180,0.5)';
  ctx.setLineDash([6, 5]);
  ctx.strokeRect(560, 40, 340, 270);
  ctx.setLineDash([]);
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = 'rgba(30,22,16,0.75)';
    ctx.fillRect(rand(rng, 600, 870), rand(rng, 60, 290), rand(rng, 14, 34), rand(rng, 10, 24));
  }
  ctx.fillStyle = 'rgba(150,40,30,0.55)';
  ctx.font = 'bold 26px Consolas, monospace';
  ctx.fillText('☣', 830, 175);
  ctx.fillStyle = 'rgba(230,220,180,0.5)';
  ctx.font = 'bold 15px Consolas, monospace';
  ctx.fillText('HARLOW QUARRY', 60, 690);
  ctx.fillText('RAIL YARD', 420, 560);
  ctx.fillText('MERIDIAN STATION', 600, 30);
  return canvas;
}

/** Act 4's map: the north coast, sea to the top, the harbour, the point and Fort Ashby. */
function paintCoast(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, rng: () => number): HTMLCanvasElement {
  const W = canvas.width, H = canvas.height;
  const land = ctx.createLinearGradient(0, 0, W, H);
  land.addColorStop(0, '#525648');
  land.addColorStop(1, '#3c4034');
  ctx.fillStyle = land;
  ctx.fillRect(0, 0, W, H);
  // The sea along the top and right, with a ragged shoreline.
  ctx.fillStyle = 'rgba(52,72,86,0.95)';
  ctx.beginPath();
  // Shore runs from the left edge down at y≈200 to the top right, so every node sits on land.
  const shore = (x: number): number => 200 - x * 0.18 + Math.sin(x / 70) * 14;
  ctx.moveTo(0, 0);
  ctx.lineTo(W, 0);
  for (let x = W; x >= 0; x -= 20) ctx.lineTo(x, shore(x) + rand(rng, -5, 5));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(200,215,220,0.25)';
  ctx.lineWidth = 1;
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, shore(x) - 18 - k * 20 + Math.sin(x / 60 + k) * 5);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(20,20,12,0.22)';
  for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // The harbour's piers and the coast road.
  ctx.fillStyle = 'rgba(30,24,18,0.75)';
  for (let i = 0; i < 5; i++) {
    const px = 150 + i * 46;
    ctx.fillRect(px, shore(px) - 44, 10, 56);
  }
  ctx.strokeStyle = 'rgba(190,180,150,0.35)';
  ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(60, 700); ctx.bezierCurveTo(300, 560, 520, 520, 700, 380); ctx.lineTo(860, 120); ctx.stroke();
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = 'rgba(30,22,16,0.6)';
    ctx.fillRect(rand(rng, 60, 380), rand(rng, 420, 680), rand(rng, 8, 20), rand(rng, 6, 14));
  }
  // Fort Ashby: a star-shaped outline at the top right.
  ctx.strokeStyle = 'rgba(220,210,180,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let k = 0; k <= 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    const r = k % 2 ? 40 : 64;
    ctx.lineTo(820 + Math.cos(a) * r, 140 + Math.sin(a) * r * 0.7);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(230,220,180,0.5)';
  ctx.font = 'bold 15px Consolas, monospace';
  ctx.fillText('SALTMARSH', 60, 690);
  ctx.fillText('GULL POINT', 480, 470);
  ctx.fillText('FORT ASHBY', 760, 230);
  ctx.fillText('NORTH SEA', 40, 60);
  return canvas;
}
