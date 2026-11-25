import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { ACT_NAMES, ACT_STAR_GATE, MISSIONS, MissionDef } from '../data/missions';
import { weaponById } from '../data/weapons';
import { MODS } from '../data/upgrades';
import { recruitById } from '../data/squad';
import { makeCanvas, mulberry32, rand } from '../rendering/CanvasUtil';
import {
  actOpen, acts, barracksOpen, currentAct, isMissionUnlocked, isWon, needsLoadout, nextMission, playerPower,
  starTotals, starsBeforeAct, threatRating, VETERAN, veteranMedals, veteranOpen, workshopOpen,
} from '../systems/Campaign';
import { profile } from '../systems/Profile';
import { bonusValue, clipWords, objectiveLabel, wordCount } from '../ui/messages';
import { ITEM_ICON, WEAPON_ICON, icon, iconWidth, type IconName } from '../ui/icons';
import {
  BODY, C, MONO, STENCIL, centreRow, chip, flowRow, meter, press, pushButton, radioChip, row, text, type Part,
} from '../ui/kit';
import { CONTESTED_BONUS, hqOpen, hqWaiting, isContested, playReport, refreshDay } from '../systems/Retention';
import { showDailyDrop } from './HQScene';
import { BLEED, MAX_SCREEN } from './screen';
import { backdrop } from '../rendering/Margins';
import { VIEW } from './config';
import { isTouchDevice } from './touchControls';

export interface MapData {
  /** A mission just won for the first time: the fog pulls back from it on arrival. */
  reveal?: string;
  /** Which act's map to show (defaults to the act of the next mission). */
  act?: number;
  /** Radio lines after a win: one short line at a time while the fog lifts. */
  debrief?: { who: string; text: string }[];
}

/** Each act's map: its title and the intro card shown the first time it opens. */
const ACT_MAPS: Record<number, { title: string; headline: string; card: string[] }> = {
  1: {
    title: 'HARLOW VALLEY',
    headline: 'The fog is moving. Hold the Fogline.',
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
    headline: 'The line moves forward, into the town.',
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
    headline: 'The Heart is the source. Push to the gate.',
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
    headline: 'The spores came north. Burn the Bloom.',
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
    // Beyond the map on a wider or taller screen: the same country, mirrored, under the same fog.
    backdrop(this, 0x62665f);
    this.add.image(0, 0, key).setOrigin(0);
    this.add.image(0, 0, key).setOrigin(1, 0).setFlipX(true);
    this.add.image(0, VIEW.height, key).setOrigin(0).setFlipY(true);
    this.add.image(0, VIEW.height, key).setOrigin(1, 0).setFlip(true, true);
    this.drawRoads(p);

    // Nodes sit under the fog; the fog is cleared around the ones the player has reached.
    for (const m of actMissions(this.act)) this.nodes.set(m.id, this.makeNode(m));

    this.fog = this.add.renderTexture(-BLEED.x, 0, PANEL_X + BLEED.x, VIEW.height + BLEED.y).setOrigin(0);
    this.brush = this.make.image({ key: FOG_BRUSH, add: false });
    this.paintFog(p, data.reveal);
    // The source of the fog shows faintly through it: the far goal of the campaign.
    if (this.act < 3) this.add.text(MERIDIAN.x, MERIDIAN.y, '☣', { fontFamily: STENCIL, fontSize: '30px', color: '#d8c8a0' }).setOrigin(0.5).setAlpha(0.55);
    if (this.act < 3) this.add.text(MERIDIAN.x, MERIDIAN.y + 26, 'MERIDIAN STATION', { fontFamily: MONO, fontSize: '12px', color: '#d8d0b0' }).setOrigin(0.5).setAlpha(0.6);

    // Header.
    this.add.rectangle(-BLEED.x, -BLEED.y, PANEL_X + BLEED.x, 54 + BLEED.y, C.chip, 0.85).setOrigin(0);
    const title = text(this, 18, 27, ACT_MAPS[this.act]?.title ?? 'THE VALLEY', { size: 28, font: STENCIL }).setOrigin(0, 0.5);
    this.drawActTabs(p, 36 + title.width);
    const totals: Part[] = [
      chip(this, { icon: 'star', text: `${starTotals(p).earned}`, tone: 'gold', size: 18 }),
      chip(this, { icon: 'crate', iconColor: C.brass, text: `${p.supplies}`, size: 18 }),
    ];
    row(totals, PANEL_X - 12 - totals.reduce((w, t) => w + t.w, 8), 27);

    // Side panel.
    this.add.rectangle(PANEL_X, -BLEED.y, VIEW.width - PANEL_X + BLEED.x, MAX_SCREEN.height, C.panel, 1).setOrigin(0);
    this.add.rectangle(PANEL_X, -BLEED.y, 2, MAX_SCREEN.height, 0x4a4c44).setOrigin(0);
    const nav: { icon: IconName; label: string; go: () => void }[] = [];
    if (workshopOpen(p)) nav.push({ icon: 'wrench', label: 'WORKSHOP', go: () => this.go('Workshop') });
    if (barracksOpen(p)) nav.push({ icon: 'people', label: 'BARRACKS', go: () => this.go('Barracks') });
    if (needsLoadout(p)) nav.push({ icon: 'carbine', label: 'LOADOUT', go: () => this.go('Loadout', { missionId: this.selected.id, deploy: false }) });
    nav.push({ icon: 'home', label: 'MENU', go: () => this.go('Menu') });
    const gap = 8, tileW = Math.floor((VIEW.width - PANEL_X - 36 - gap * 3) / 4);
    let nx = VIEW.width - 18 - nav.length * tileW - (nav.length - 1) * gap;
    for (const n of nav) {
      this.navTile(nx + tileW / 2, VIEW.height - 52, tileW, n.icon, n.label, n.go);
      nx += tileW + gap;
    }
    if (hqOpen(p)) this.drawHqButton(p);
    if (data.debrief?.length) this.playDebrief(data.debrief);

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

  /** ACT 1 / ACT 2 tabs; a locked act shows a padlock and the stars it needs. */
  private drawActTabs(p: ReturnType<typeof profile.get>, from: number): void {
    let x = from;
    for (const act of acts()) {
      const open = actOpen(p, act);
      const current = act === this.act;
      const need = ACT_STAR_GATE[act] ?? 0;
      const fought = MISSIONS.some((m) => m.act === act && isContested(p, m.id, Date.now()));
      const tab = open
        ? chip(this, { icon: fought ? 'flame' : undefined, iconColor: C.red, text: `ACT ${act}`, tone: current ? 'plain' : 'muted', size: 17 })
        : chip(this, { icon: 'lock', text: `${starsBeforeAct(p, act)}/${need}★`, tone: 'muted', size: 17, dashed: true });
      tab.c.setPosition(x, 27 - tab.h / 2);
      if (current) this.add.rectangle(x, 27 - tab.h / 2, tab.w, tab.h).setOrigin(0).setStrokeStyle(2, C.brass).setDepth(1);
      if (open && !current) {
        tab.c.setSize(tab.w, tab.h);
        const zone = this.add.zone(x, 27 - tab.h / 2, tab.w, tab.h).setOrigin(0).setInteractive({ useHandCursor: true });
        press(zone, () => this.scene.restart({ act }));
      }
      x += tab.w + 8;
    }
  }

  /** A small square button: an icon over its name. Origin at its centre. */
  private navTile(x: number, y: number, w: number, name: IconName, label: string, go: () => void): Phaser.GameObjects.Container {
    const h = 74;
    const bg = this.add.rectangle(0, 0, w, h, C.tile).setStrokeStyle(2, C.line);
    const size = iconWidth(name, 1) > 1 ? 26 : 32;
    const c = this.add.container(x, y, [
      bg, icon(this, name, 0, -11, size, C.iconTone), text(this, 0, 23, label, { size: 12, color: C.soft, bold: true }).setOrigin(0.5),
    ]).setSize(w, h).setDepth(10);
    c.setInteractive({ useHandCursor: true });
    press(c, go, (over) => bg.setStrokeStyle(2, over ? C.brass : C.line));
    return c;
  }

  /** The after-battle radio lines, one short line at a time. */
  private playDebrief(lines: { who: string; text: string }[]): void {
    let at = 700;
    for (const line of lines) {
      const shown = clipWords(line.text);
      const stay = 2200 + wordCount(shown) * 360;
      this.time.delayedCall(at, () => {
        const part = radioChip(this, line.who, shown, 420);
        part.c.setPosition(114, 66).setDepth(40).setAlpha(0);
        this.tweens.add({ targets: part.c, alpha: 1, duration: 200 });
        this.tweens.add({ targets: part.c, alpha: 0, delay: stay - 300, duration: 300, onComplete: () => part.c.destroy() });
      });
      at += stay;
    }
  }

  // ------------------------------------------------------------ fog

  private paintFog(p: ReturnType<typeof profile.get>, reveal?: string): void {
    const fog = this.fog;
    fog.fill(0x6c706a, 0.93);
    // Mottled fog: stamp darker and lighter clouds so it does not read as a flat grey sheet.
    const rng = mulberry32(7);
    const puff = this.make.image({ key: FOG_BRUSH, add: false });
    for (let i = 0; i < 100; i++) {
      puff.setScale(rand(rng, 1.2, 3.2)).setTint(rng() < 0.5 ? 0x8a8e88 : 0x4c504a).setAlpha(rand(rng, 0.25, 0.5));
      fog.draw(puff, rand(rng, 0, PANEL_X + BLEED.x), rand(rng, 0, VIEW.height + BLEED.y));
    }
    // The fog starts a margin left of the map, so a clearing is offset by it.
    const clear = (x: number, y: number, r: number): void => {
      this.brush.setScale(r / 64);
      fog.erase(this.brush, x + BLEED.x, y);
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
    const color = won ? 0x4f8a3a : boss ? 0x9a2a1e : open ? 0xc89a30 : 0x4a4a44;
    const r = boss ? 27 : 23;
    const parts: Phaser.GameObjects.GameObject[] = [];
    if (open && !won) parts.push(this.add.circle(0, 0, r + 11, 0xffe090, 0.35));
    parts.push(this.add.circle(0, 0, r + 3, 0x111111), this.add.circle(0, 0, r, color));
    parts.push(boss
      ? icon(this, 'skull', 0, 0, 32, C.text)
      : text(this, 0, 0, String(m.number), { size: 25, font: STENCIL }).setOrigin(0.5));
    const name = text(this, 0, r + 17, m.name.toUpperCase(), { size: 12, bold: true }).setOrigin(0.5);
    parts.push(this.add.rectangle(0, r + 17, name.width + 12, 19, C.chip, 0.82), name);
    const stars = p.missions[m.id]?.stars ?? 0;
    if (won) {
      for (let i = 0; i < 3; i++) {
        parts.push(icon(this, 'star', (i - 1) * 18, -r - 12, 18, 0x000000, { fill: i < stars ? C.star : C.track, stroke: 1.6 }));
      }
    }
    if (p.missions[m.id]?.veteran) parts.push(icon(this, 'medal', r + 8, -r + 4, 22, 0xc8b0ff));
    if (won && isContested(p, m.id, Date.now())) {
      const alarm = this.add.circle(0, 0, r + 10).setStrokeStyle(3, C.dot, 1).setFillStyle(0, 0);
      this.tweens.add({ targets: alarm, scale: 1.25, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });
      parts.unshift(alarm);
      parts.push(icon(this, 'flame', 0, -r - 34, 24, C.red));
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

  /** The side panel: name, objective and bonus, the threat gauge, what a win brings, and Deploy. */
  private select(m: MissionDef): void {
    this.selected = m;
    for (const o of this.panel) o.destroy();
    this.panel = [];
    const p = profile.get();
    this.pulse?.destroy();
    this.pulse = this.add.circle(m.map.x, m.map.y, 36).setStrokeStyle(3, 0xffe090, 1).setFillStyle(0, 0);
    this.tweens.add({ targets: this.pulse, scale: 1.35, alpha: 0.2, duration: 900, yoyo: true, repeat: -1 });

    const x = PANEL_X + 22, w = VIEW.width - PANEL_X - 44, mid = x + w / 2;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.panel.push(o);
      return o;
    };
    const keep = (parts: Part[]): Part[] => {
      for (const part of parts) add(part.c);
      return parts;
    };

    let y = 22;
    add(text(this, x, y, m.objective.kind === 'boss' ? 'BOSS' : `MISSION ${m.number}`, { size: 14, color: C.brass, bold: true, spacing: 2 }));
    y += 20;
    const name = add(text(this, x, y, m.name.toUpperCase(), { size: 38, font: STENCIL, wrap: w }));
    y += name.height + 12;

    const objective: IconName = m.objective.kind === 'hold' ? 'shield' : m.objective.kind === 'protect' ? 'mast'
      : m.objective.kind === 'evacuate' ? 'truck' : m.objective.kind === 'nests' ? 'nest' : 'skull';
    const goal = m.bonus;
    const bonus: IconName = goal.kind === 'headshots' ? 'head' : goal.kind === 'accuracy' ? 'gauge'
      : goal.kind === 'saveAll' ? 'truck' : goal.kind === 'assetHealth' ? 'star' : ITEM_ICON[goal.id];
    y += flowRow(keep([
      chip(this, { icon: objective, text: objectiveLabel(m.objective), size: 19 }),
      chip(this, { icon: bonus, text: bonusValue(goal), tone: 'gold', size: 19 }),
    ]), x, y, w, 8) + 20;

    // Threat against power: the bar is the player's power, the red mark the mission's threat.
    const power = playerPower(p);
    const rating = threatRating(power, m.threat);
    const colour = rating === 'ready' ? C.health : rating === 'risky' ? 0xe0b040 : C.goLine;
    const max = Math.max(power, m.threat) * 1.25;
    const g = add(this.add.graphics());
    meter(g, x, y + 6, w, 18, power / max, colour);
    g.fillStyle(0xff7a5a, 1).fillRect(x + w * (m.threat / max) - 2, y - 2, 5, 34);
    add(text(this, x, y + 32, `POWER ${power}`, { size: 16, color: 0xc8c2a6, bold: true }));
    add(text(this, x + w, y + 32, `${m.threat}`, { size: 16, color: 0xff7a5a, bold: true }).setOrigin(1, 0));
    y += 68;

    // What the mission lends and what a first win brings, as item cards.
    const cards: Part[] = [];
    for (const id of m.issue.weapons) cards.push(this.itemCard(WEAPON_ICON[id], weaponById(id).shortName, 'LENT'));
    if (!isWon(p, m.id)) {
      for (const id of m.firstClear.weapons) cards.push(this.itemCard(WEAPON_ICON[id], weaponById(id).shortName));
      for (const g_ of m.firstClear.gear) {
        const id = g_.split(':')[1];
        cards.push(this.itemCard(ITEM_ICON[id], MODS.find((mod) => mod.id === id)?.short ?? id.toUpperCase()));
      }
      for (const r of m.firstClear.recruits ?? []) cards.push(this.itemCard('people', recruitById(r)!.name.split(' ')[0].toUpperCase()));
      cards.push(this.itemCard('crate', `+${Math.round(m.supplies * 1.5)}`));
    }
    if (cards.length) y += flowRow(keep(cards), x, y, w, 8) + 14;
    const facts: Part[] = [];
    if (isWon(p, m.id)) {
      const rec = p.missions[m.id];
      facts.push(chip(this, { icon: 'star', text: `${rec.stars}/3`, tone: 'gold', size: 19 }));
      facts.push(chip(this, { icon: 'skull', text: `${rec.bestKills}`, size: 19 }));
    }
    if (isContested(p, m.id, Date.now())) facts.push(chip(this, { icon: 'flame', text: `+${Math.round(m.supplies * CONTESTED_BONUS)}`, tone: 'red', size: 19 }));
    if (facts.length) y += flowRow(keep(facts), x, y, w, 8) + 14;

    const by = Math.min(y + 40, VIEW.height - 190);
    if (veteranOpen(p, m.id)) {
      // A won mission: replay it, or take it on Veteran for a medal.
      const half = (w - 10) / 2;
      add(pushButton(this, x + half / 2, by, { w: half, h: 60, size: 24, icon: 'replay', label: 'REPLAY', tone: 'go', onClick: () => this.deploy() }).c);
      add(pushButton(this, x + w - half / 2, by, { w: half, h: 60, size: 24, icon: 'medal', label: 'VETERAN', tone: 'brass', onClick: () => this.deploy(true) }).c);
      // Under Veteran: the medals so far and what it pays.
      const veteran = keep([
        chip(this, { icon: 'medal', text: `${veteranMedals(p)}`, tone: 'muted', size: 15 }),
        chip(this, { icon: 'crate', text: `×${VETERAN.supplies}`, tone: 'muted', size: 15 }),
      ]);
      centreRow(veteran, x + w - half / 2, by + 36 + veteran[0].h / 2, 6);
    } else {
      add(pushButton(this, mid, by, { w, h: 64, size: 31, icon: 'play', label: 'DEPLOY', tone: 'go', onClick: () => this.deploy() }).c);
    }
  }

  /** One reward or loan: its silhouette and short name; `ribbon` marks a loan. */
  private itemCard(name: IconName, label: string, ribbon?: string): Part {
    const t = text(this, 0, 0, label, { size: 15, color: C.brass, bold: true }).setOrigin(0.5);
    const w = Math.max(96, Math.ceil(t.width + 20)), h = ribbon ? 84 : 70;
    t.setPosition(w / 2, 54);
    const bg = this.add.rectangle(0, 0, w, h, C.raised).setOrigin(0).setStrokeStyle(2, ribbon ? C.lineReward : C.brass);
    const size = iconWidth(name, 1) > 1 ? 30 : 36;
    const items: Phaser.GameObjects.GameObject[] = [bg, icon(this, name, w / 2, 26, size, name === 'crate' ? C.brass : C.iconTone), t];
    if (ribbon) items.push(text(this, w / 2, 73, ribbon, { size: 11, color: C.green, bold: true, spacing: 2 }).setOrigin(0.5));
    return { c: this.add.container(0, 0, items), w, h };
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
    const parts: Phaser.GameObjects.GameObject[] = [backdrop(this, 0x000000, 0.85).setInteractive()];
    parts.push(this.add.text(40, 30, 'PLAYTEST NUMBERS  (F9 to close)', { fontFamily: STENCIL, fontSize: '26px', color: '#e8e0c0' }));
    const head = 'MISSION                  STARTS  WINS  FAILS  FAIL%   MIN/RUN';
    const body = rows.length
      ? rows.map((r) => `${r.name.padEnd(24).slice(0, 24)} ${String(r.starts).padStart(6)} ${String(r.wins).padStart(5)} ${String(r.fails).padStart(6)} ${String(Math.round(r.failRate * 100)).padStart(5)}% ${r.minutes.toFixed(1).padStart(8)}`).join('\n')
      : 'No missions played on this save yet.';
    parts.push(this.add.text(40, 74, `${head}\n${body}`, { fontFamily: MONO, fontSize: '14px', color: '#d0ccb4', lineSpacing: 3 }));
    parts.push(this.add.text(40, VIEW.height - 40, 'Target fail rate 15–30% per mission. Kept on this device only.', { fontFamily: MONO, fontSize: '13px', color: '#9a9a86' }));
    this.report = this.add.container(0, 0, parts).setDepth(80);
  }

  /** The HQ, top left of the map, with a red badge when something is waiting. */
  private drawHqButton(p: ReturnType<typeof profile.get>): void {
    const waiting = hqWaiting(p, Date.now());
    this.navTile(58, 104, 84, 'radio', isTouchDevice() ? 'HQ' : 'HQ  [H]', () => this.go('HQ'));
    if (waiting.length) {
      const dot = this.add.circle(98, 70, 12, C.dot).setStrokeStyle(2, 0x000000).setDepth(11);
      text(this, 98, 70, `${waiting.length}`, { size: 16, font: STENCIL, color: 0xffffff }).setOrigin(0.5).setDepth(12);
      this.tweens.add({ targets: dot, scale: 1.25, yoyo: true, repeat: -1, duration: 520 });
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

  /** The first look at an act: a picture, one headline and Go. INTEL swaps in the full story. */
  private showActCard(): void {
    const left = 102, top = 96, W = 666, pad = 26, inner = W - pad * 2;
    const map = ACT_MAPS[this.act];
    const art = `act_art_${this.act}`;
    if (!this.textures.exists(art)) this.textures.addCanvas(art, paintActArt(this.act, inner, 190));

    const shade = backdrop(this, 0x000000, 0.6).setInteractive();
    const eyebrow = text(this, left + pad, top + 20, `ACT ${this.act} · ${ACT_NAMES[this.act] ?? ''}`, { size: 18, color: C.brass, bold: true, spacing: 3 });
    const picture = this.add.image(left + pad, top + 56, art).setOrigin(0);
    const headline = text(this, left + pad, top + 262, map?.headline ?? '', { size: 36, font: STENCIL, wrap: inner });
    const buttonsY = Math.round(top + 262 + headline.height + 46);
    const H = buttonsY + 52 - top;
    const story = text(this, left + pad, top + 60, (map?.card ?? []).join('\n'), { size: 17, font: BODY, color: 0xd8d4bc, wrap: inner }).setVisible(false);
    story.setLineSpacing(2);
    const box = this.add.rectangle(left, top, W, H, C.chip, 0.96).setOrigin(0).setStrokeStyle(2, C.brass);
    const parts: Phaser.GameObjects.GameObject[] = [shade, box, eyebrow, picture, headline, story];
    let intel = false;
    const close = (): void => {
      this.card?.destroy();
      this.card = null;
      const id = `act${this.act}card`;
      profile.update((d) => { if (!d.hints.includes(id)) d.hints.push(id); });
    };
    const go = pushButton(this, 0, buttonsY, { h: 54, size: 25, icon: 'play', label: 'TO THE LINE', tone: 'go', onClick: close });
    go.c.x = left + pad + go.w / 2;
    const more = pushButton(this, 0, buttonsY, {
      h: 54, size: 25, icon: 'book', label: 'INTEL',
      onClick: () => {
        intel = !intel;
        picture.setVisible(!intel);
        headline.setVisible(!intel);
        story.setVisible(intel);
        more.setLabel(intel ? 'BACK' : 'INTEL');
      },
    });
    more.c.x = left + pad + go.w + 14 + more.w / 2;
    parts.push(go.c, more.c);
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

/** The picture on an act card: sky, ground, a glow in the fog and the act's skyline. */
function paintActArt(act: number, W: number, H: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(90 + act);
  const horizon = Math.round(H * 0.52);
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#70746c');
  sky.addColorStop(1, '#9a9e94');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon);
  const glow = ctx.createRadialGradient(W * 0.68, H * 0.3, 0, W * 0.68, H * 0.3, 90);
  glow.addColorStop(0, 'rgba(226,232,212,0.9)');
  glow.addColorStop(1, 'rgba(226,232,212,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, horizon);
  const ground = ctx.createLinearGradient(0, horizon, 0, H);
  ground.addColorStop(0, '#4a4c3a');
  ground.addColorStop(1, '#2e3024');
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon, W, H - horizon);

  ctx.fillStyle = '#383b30';
  ctx.strokeStyle = '#383b30';
  const block = (x: number, w: number, h: number): void => ctx.fillRect(x, horizon - h, w, h + 1);
  const tree = (x: number, h: number): void => {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, horizon + 2);
    ctx.lineTo(x, horizon - h);
    for (let k = 0; k < 4; k++) {
      const y = horizon - h * (0.45 + k * 0.15), side = k % 2 ? 1 : -1;
      ctx.moveTo(x, y);
      ctx.lineTo(x + side * h * 0.28, y - h * 0.18);
    }
    ctx.stroke();
  };
  if (act === 2) { // a town: roofs and a church spire
    for (let x = 10; x < W; x += 46) {
      const w = rand(rng, 28, 44), h = rand(rng, 16, 40);
      block(x, w, h);
      ctx.beginPath(); ctx.moveTo(x - 3, horizon - h); ctx.lineTo(x + w / 2, horizon - h - 16); ctx.lineTo(x + w + 3, horizon - h); ctx.fill();
    }
    block(W * 0.3, 16, 62);
    ctx.beginPath(); ctx.moveTo(W * 0.3, horizon - 62); ctx.lineTo(W * 0.3 + 8, horizon - 96); ctx.lineTo(W * 0.3 + 16, horizon - 62); ctx.fill();
  } else if (act === 3) { // the station: two cooling towers and a fence
    for (const [x, h] of [[W * 0.6, 74], [W * 0.74, 58]]) {
      ctx.beginPath();
      ctx.moveTo(x - 30, horizon); ctx.quadraticCurveTo(x - 12, horizon - h * 0.55, x - 20, horizon - h);
      ctx.lineTo(x + 20, horizon - h); ctx.quadraticCurveTo(x + 12, horizon - h * 0.55, x + 30, horizon); ctx.fill();
    }
    block(W * 0.38, 70, 24);
    for (let x = 0; x < W; x += 18) block(x, 2, 14);
    ctx.fillRect(0, horizon - 12, W, 2);
  } else if (act === 4) { // the coast: sea lines, cranes and a fort
    ctx.fillStyle = '#4c5a60';
    ctx.fillRect(0, horizon - 8, W, 10);
    ctx.fillStyle = '#383b30';
    for (const x of [W * 0.12, W * 0.24]) {
      block(x, 5, 66);
      ctx.fillRect(x - 12, horizon - 66, 58, 4);
      ctx.fillRect(x + 40, horizon - 66, 2, 26);
    }
    block(W * 0.74, 90, 28);
    for (let x = W * 0.74; x < W * 0.74 + 90; x += 18) block(x, 10, 36);
  } else { // the valley: bare trees and the bunker
    for (let x = 14; x < W; x += rand(rng, 22, 48)) if (x < W * 0.4 || x > W * 0.62) tree(x, rand(rng, 18, 44));
    block(W * 0.46, 66, 20);
    ctx.fillStyle = '#1c1d17';
    ctx.fillRect(W * 0.46 + 14, horizon - 13, 38, 5);
  }
  const fog = ctx.createLinearGradient(0, horizon - 22, 0, horizon + 22);
  fog.addColorStop(0, 'rgba(220,226,214,0)');
  fog.addColorStop(0.5, 'rgba(220,226,214,0.4)');
  fog.addColorStop(1, 'rgba(220,226,214,0)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, horizon - 22, W, 44);
  return canvas;
}
