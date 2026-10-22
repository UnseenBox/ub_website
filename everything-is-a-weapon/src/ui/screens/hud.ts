import { moveKeysLabel } from '../../input/KeyLabels';
import type { Game } from '../../core/Game';
import { ANNOUNCEMENTS_VISIBLE } from '../../core/constants';
import { ENEMY_TYPES, type EnemyTypeId } from '../../entities/EnemyTypes';
import type { Enemy } from '../../entities/Enemy';
import type { IncidentKind } from '../../gameplay/Incidents';
import type { GuideIcon } from '../../gameplay/Tutorial';
import type { AbilityId } from '../../gameplay/Abilities';
import { DISCOVERY_BY_ID } from '../../gameplay/Discoveries';
import { COMBO_WINDOW } from '../../gameplay/ScoreSystem';
import { el, formatScore, ransom } from '../dom';

import discoveryBanner from '../../ui-kit/bonk2/assets/banners/discovery@2x.png?url';
import heartIcon from '../../ui-kit/bonk2/assets/icons/heart@2x.png?url';
import coinIcon from '../../ui-kit/bonk2/assets/icons/coin@2x.png?url';
import blastIcon from '../../ui-kit/bonk2/assets/icons/power-slam@2x.png?url';
import dashIcon from '../../ui-kit/bonk2/assets/icons/power-dash@2x.png?url';
import staticIcon from '../../ui-kit/bonk2/assets/icons/power-static@2x.png?url';

interface Mug {
  node: HTMLElement;
  type: EnemyTypeId;
  incident: IncidentKind | null;
  out: boolean;
}

const POWER_ART: Record<AbilityId, string> = {
  blast: blastIcon,
  overdrive: dashIcon,
  freeze: staticIcon,
};

/**
 * The in-game overlay: a cream health plate, a police line-up of the intruders,
 * a coin score chip, ability slots and the room's boss bar. DOM writes only
 * happen when a value actually changes.
 */
export class HUD {
  private readonly root: HTMLElement;
  private readonly roomNum: HTMLElement;
  private readonly healthBar: HTMLElement;
  private readonly healthFill: HTMLElement;
  private readonly healthGhost: HTMLElement;
  private readonly healthHp: HTMLElement;
  private readonly hearts: HTMLImageElement[] = [];
  private heartMax = 0;
  private healthTimer = 0;
  private readonly heatBox: HTMLElement;
  private readonly heatFill: HTMLElement;
  private readonly heatPct: HTMLElement;
  private readonly heatName: HTMLElement;
  private readonly heatTier: HTMLElement;
  private lastHeat = '';
  private readonly bossBox: HTMLElement;
  private readonly bossName: HTMLElement;
  private readonly bossTag: HTMLElement;
  private readonly bossFill: HTMLElement;
  private readonly bossPips: HTMLElement;
  private lastBoss = '';
  private lastBossUid = -1;
  private readonly lineup: HTMLElement;
  private readonly sticky: HTMLElement;
  private readonly stickyText: HTMLElement;
  private readonly score: HTMLElement;
  private readonly combo: HTMLElement;
  private readonly comboValue: HTMLElement;
  private readonly powers: HTMLElement;
  private readonly scrapSlip: HTMLElement;
  private readonly bannerBox: HTMLElement;
  private readonly incomingBox: HTMLElement;
  private incomingTimer = 0;
  private readonly stampBox: HTMLElement;
  private readonly toast: HTMLElement;
  private readonly toastTitle: HTMLElement;
  private readonly toastCount: HTMLElement;
  private readonly coach: HTMLElement;
  private readonly unlockBox: HTMLElement;
  private readonly point = { x: 0, y: 0 };
  private unlockTimer = 0;

  private mugs: Mug[] = [];
  private readonly powerChips = new Map<string, HTMLElement>();
  private readonly powerCool = new Map<string, number>();
  private last = { room: '', hp: -1, pending: -1, challenge: '', combo: -1, carrying: false, cinema: false, comboT: -1, powers: '', scrap: -1, coach: '', touch: false };
  private shownScore = 0;
  private bannerTimer = 0;
  private bannerSeed = 1;
  private stampTimer = 0;
  private toastTimer = 0;
  private readonly toastQueue: string[] = [];

  constructor(private readonly game: Game, parent: HTMLElement, onPause: () => void) {
    this.root = el('div', 'hud b2-hud hidden');
    const top = el('div', 'b2-hud__top');

    // ── left: health plate + heat ──
    const left = el('div', 'b2-hud__left');

    const healthWrap = el('div', 'b2-hud__health');
    const tag = el('div', 'b2-hud__room');
    tag.setAttribute('aria-label', 'Room');
    tag.append((this.roomNum = el('span', 'b2-hud__roomnum', '1')));

    const bar = el('div', 'healthbar b2-hud__plate');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', 'Health');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(game.player.maxHp));

    const plateRow = el('div', 'b2-hud__platerow');
    const hearts = el('span', 'b2-hud__hearts');
    this.healthHp = el('span', 'b2-hud__hp b2-num', `${game.player.hp} / ${game.player.maxHp}`);
    plateRow.append(hearts, this.healthHp);

    const track = el('span', 'b2-hud__track');
    this.healthGhost = el('span', 'health-ghost');
    this.healthFill = el('span', 'health-fill');
    this.healthFill.append(el('span', 'health-shine'));
    track.append(this.healthGhost, this.healthFill);

    bar.append(plateRow, track);
    this.healthBar = bar;
    healthWrap.append(tag, bar);
    this.updateHealth(game.player.hp, game.player.maxHp, true);

    this.heatBox = el('div', 'hud-heat b2-hud__heat hidden');
    this.heatFill = el('span', 'heat-fill');
    this.heatPct = el('span', 'heat-pct', '0%');
    this.heatName = el('span', 'heat-name', '');
    this.heatTier = el('span', 'heat-tier', 'QUIET');
    const heatTrack = el('div', 'heat-track');
    const heatTicks = el('span', 'heat-ticks');
    for (const at of [34, 67]) {
      const tick = el('span', 'heat-tick');
      tick.style.left = `${at}%`;
      heatTicks.append(tick);
    }
    heatTrack.append(this.heatFill, heatTicks);
    const heatHead = el('div', 'heat-head');
    heatHead.append(el('span', 'heat-label', 'HEAT'), this.heatPct, this.heatTier);
    this.heatBox.append(heatHead, this.heatName, heatTrack);
    left.append(healthWrap, this.heatBox);

    // ── centre: the line-up + the room's objective ──
    const center = el('div', 'b2-hud__center');
    this.lineup = el('div', 'lineup b2-hud__lineup');
    this.lineup.setAttribute('role', 'list');
    this.lineup.setAttribute('aria-label', 'Intruders');
    this.sticky = el('div', 'sticky b2-hud__sticky hidden');
    this.stickyText = el('span', 'sticky-text b2-hud__stickytext');
    this.sticky.append(el('span', 'sticky-box b2-hud__stickytab'), this.stickyText);
    center.append(this.lineup, this.sticky);

    // ── right: score, scrap, combo, pause ──
    const right = el('div', 'b2-hud__right');
    const chips = el('div', 'b2-hud__chips');

    const scoreChip = el('div', 'b2-hud__score');
    scoreChip.setAttribute('aria-label', 'Score');
    const scoreIcon = el('img', 'b2-hud__scoreicon');
    scoreIcon.src = coinIcon;
    scoreIcon.alt = '';
    scoreIcon.decoding = 'async';
    const scoreCopy = el('span', 'b2-hud__scorecopy');
    this.score = el('span', 'b2-hud__scorevalue b2-num receipt-total', '0');
    scoreCopy.append(this.score, el('span', 'b2-hud__scorelabel', 'SCORE'));
    scoreChip.append(scoreIcon, scoreCopy);

    this.scrapSlip = el('span', 'scrap-slip b2-hud__scrap', '');

    const pause = el('button', 'hud-pause b2-hud__pause');
    pause.type = 'button';
    pause.setAttribute('aria-label', 'Pause');
    pause.append(el('span'), el('span'));
    pause.addEventListener('click', onPause);

    chips.append(scoreChip, this.scrapSlip, pause);

    this.combo = el('div', 'combo-sticker b2-hud__combo');
    this.comboValue = el('span', 'combo-value b2-hud__combovalue');
    this.combo.append(el('span', 'combo-ring b2-hud__comboring'), this.comboValue);
    right.append(chips, this.combo);

    top.append(left, center, right);

    // ── boss plate ──
    this.bossBox = el('div', 'hud-boss b2-hud__boss hidden');
    this.bossName = el('span', 'boss-name b2-hud__bossname', '');
    this.bossTag = el('span', 'boss-tag b2-hud__bosstag', '');
    this.bossFill = el('span', 'boss-fill b2-hud__bossfill');
    this.bossPips = el('span', 'boss-pips b2-hud__bosspips');
    const bossHead = el('div', 'boss-head b2-hud__bosshead');
    bossHead.append(this.bossName, this.bossTag);
    const bossTrack = el('div', 'boss-track b2-hud__bosstrack');
    bossTrack.append(this.bossFill, this.bossPips);
    this.bossBox.append(bossHead, bossTrack);

    // ── powers hotbar ──
    this.powers = el('div', 'powers b2-hud__powers');

    // ── announcements ──
    this.bannerBox = el('div', 'hud-banner b2-hud__banner');
    this.incomingBox = el('div', 'hud-incoming b2-hud__incoming');
    this.stampBox = el('div', 'hud-stamp b2-hud__stamp');

    this.toast = el('div', 'hud-toast b2-hud__toast');
    const ribbon = el('img', 'b2-hud__toastribbon');
    ribbon.src = discoveryBanner;
    ribbon.alt = 'New bad idea!';
    ribbon.decoding = 'async';
    const toastCard = el('div', 'b2-hud__toastcard');
    this.toastCount = el('span', 'toast-count b2-hud__toastcount');
    this.toastTitle = el('div', 'toast-title b2-hud__toasttitle');
    toastCard.append(this.toastCount, this.toastTitle);
    this.toast.append(ribbon, toastCard);

    this.coach = el('div', 'coach b2-hud__coach');
    this.unlockBox = el('div', 'hud-unlock b2-hud__unlock');
    const skip = el('button', 'coach-skip b2-hud__skip', 'SKIP');
    skip.type = 'button';
    skip.addEventListener('click', () => game.tutorial.skip());

    this.root.append(
      top,
      this.bossBox,
      this.powers,
      this.bannerBox,
      this.incomingBox,
      this.stampBox,
      this.toast,
      this.coach,
      skip,
      this.unlockBox,
      el('div', 'cinema-bar top'),
      el('div', 'cinema-bar bottom'),
    );
    parent.append(this.root);

    game.bus.on('ROOM_START', () => this.buildLineup());
    game.bus.on('ENEMY_DEFEATED', (e) => this.crossOut(e.enemy));
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  /** One mugshot per intruder expected in this room, in the order they will arrive. */
  private buildLineup(): void {
    this.lineup.replaceChildren();
    // The incident always gets the last slot, even if a rushed regular is due sooner.
    const pending = this.game.room.pending;
    const specs = [...pending.filter((spec) => !spec.incident), ...pending.filter((spec) => spec.incident)];
    this.mugs = specs.map((spec) => {
      const type = ENEMY_TYPES[spec.type];
      const incident = spec.incident?.kind ?? null;
      const boss = incident === 'headliner' ? ' mug-boss' : incident === 'enforcer' ? ' mug-enforcer' : '';
      const node = el('span', `mug mug-${spec.type}${boss} waiting`);
      node.style.setProperty('--mug', type.color);
      node.title = spec.incident?.name ?? type.name;
      node.setAttribute('role', 'img');
      node.setAttribute('aria-label', spec.incident?.name ?? type.name);
      node.append(el('span', 'mug-face'));
      if (incident === 'enforcer') node.append(el('span', 'mug-crown', '♛'));
      const slot = el('span', 'b2-hud__mugslot');
      slot.append(node);
      this.lineup.append(slot);
      return { node, type: spec.type, incident, out: false };
    });
    this.last.pending = -1;
  }

  private crossOut(enemy: Enemy): void {
    const mug = this.mugs.find((m) => !m.out && m.type === enemy.type.id && m.incident === enemy.incident)
      ?? this.mugs.find((m) => !m.out && m.type === enemy.type.id);
    if (!mug) return;
    mug.out = true;
    mug.node.classList.remove('waiting');
    mug.node.classList.add('out');
  }

  /** Big ransom-note announcement. `sub` may be a chain ("A → B → C"), shown as linked tags.
   *  Off while `ANNOUNCEMENTS_VISIBLE` is false: no announcement banners cover the screen. */
  banner(title: string, sub = '', seconds = 2): void {
    if (!ANNOUNCEMENTS_VISIBLE) return;
    const box = this.bannerBox;
    box.classList.remove('show');
    box.replaceChildren(ransom(title, this.bannerSeed++, 'banner-title'));
    if (sub) {
      const strip = el('div', 'chain-strip');
      const steps = sub.split('→').map((s) => s.trim()).filter(Boolean);
      steps.forEach((step, i) => {
        if (i > 0) strip.append(el('span', 'chain-link'));
        strip.append(el('span', 'chain-tag', step));
      });
      box.append(strip);
    }
    // Restart the entrance animation.
    void box.offsetWidth;
    box.classList.add('show');
    this.bannerTimer = seconds;
  }

  /** A torn arrival card for the room's Headliner or Enforcer. */
  incoming(kicker: string, title: string, sub: string, type: EnemyTypeId): void {
    if (!ANNOUNCEMENTS_VISIBLE) return;
    const typeDef = ENEMY_TYPES[type];
    const mug = el('span', `incoming-mug mug mug-${type}`);
    mug.append(el('span', 'mug-face'));
    this.incomingBox.style.setProperty('--incoming', typeDef.color);
    this.incomingBox.replaceChildren(
      el('span', 'incoming-kicker', kicker),
      mug,
      ransom(title, this.bannerSeed++, 'incoming-title'),
      el('span', 'incoming-sub', sub),
    );
    this.incomingBox.classList.remove('show');
    void this.incomingBox.offsetWidth;
    this.incomingBox.classList.add('show');
    this.incomingTimer = 2.4;
  }

  /** A rubber stamp slammed across the screen. */
  stamp(text: string): void {
    const box = this.stampBox;
    box.textContent = text;
    box.classList.remove('show');
    void box.offsetWidth;
    box.classList.add('show');
    this.stampTimer = 1.5;
    window.setTimeout(() => this.game.audio.play('stamp', 1), 90);
  }

  discovery(title: string): void {
    this.toastQueue.push(title);
  }

  /** The level-up card: a sticker slapped on the screen for a few seconds.
   *  Off while `ANNOUNCEMENTS_VISIBLE` is false. */
  unlock(kicker: string, title: string, sub: string): void {
    if (!ANNOUNCEMENTS_VISIBLE) return;
    const box = this.unlockBox;
    box.replaceChildren(el('span', 'unlock-kicker', kicker), ransom(title, this.bannerSeed++, 'unlock-title'), el('span', 'unlock-sub', sub));
    box.classList.remove('show');
    void box.offsetWidth;
    box.classList.add('show');
    this.unlockTimer = 3.4;
  }

  /** Controls as pictures: keycaps and a mouse, or thumbs where the thumbs go. */
  private coachArt(icon: GuideIcon, touch: boolean): HTMLElement[] {
    const wrap = (className: string, ...children: HTMLElement[]): HTMLElement => {
      const node = el('div', className);
      node.append(...children);
      return node;
    };
    if (touch) {
      // The real POWER button pulses instead (body.coach-power).
      if (icon === 'power') return [];
      if (icon === 'move') return [wrap('coach-pad', el('i', 'coach-thumb'))];
      return [wrap(icon === 'throw' ? 'coach-tap hold' : 'coach-tap', el('i', 'coach-thumb'))];
    }
    if (icon === 'move') return [wrap('coach-keys', ...[...moveKeysLabel()].map((c) => el('kbd', '', c)))];
    const mouse = (mode: string): HTMLElement => wrap(`coach-mouse ${mode}`, el('i'));
    if (icon === 'power') return [wrap('coach-row', mouse('aim'), el('kbd', '', '1'))];
    if (icon === 'throw') return [mouse('hold'), wrap('coach-bar', el('i'))];
    return [mouse('click')];
  }

  private updateCoach(touch: boolean): void {
    const game = this.game;
    const g = game.tutorial.guide;
    const icon = game.state === 'playing' ? g.icon : null;
    const key = icon ? `${icon}|${touch}|${g.caption}|${moveKeysLabel()}` : '';
    if (key !== this.last.coach) {
      this.last.coach = key;
      document.body.classList.toggle('coach-power', icon === 'power');
      this.coach.className = icon ? `coach show ${icon} ${touch ? 'thumb' : 'desk'}` : 'coach';
      this.coach.style.transform = '';
      const body = el('div', 'coach-body');
      if (icon) body.append(...this.coachArt(icon, touch));
      if (g.caption) body.append(el('span', 'coach-cap', g.caption));
      this.coach.replaceChildren(body);
    }
    // A mouse player gets the icon next to the thing; a thumb gets it where the thumb goes (CSS).
    if (icon && !touch) {
      game.camera.worldToScreen(g.x, g.y, this.point);
      this.coach.style.transform = `translate(${Math.round(this.point.x)}px, ${Math.round(Math.max(96, this.point.y))}px)`;
    }
  }

  /** Paints the health plate: hearts for every point, the number, and the thin bar. */
  private updateHealth(hp: number, max: number, snap = false): void {
    const ratio = Math.max(0, Math.min(1, hp / max));
    this.healthBar.dataset.state = ratio >= 0.6 ? 'full' : ratio > 0.3 ? 'mid' : 'low';
    this.healthBar.classList.toggle('is-low', ratio <= 0.3);
    this.healthBar.setAttribute('aria-valuenow', String(hp));
    this.healthHp.textContent = `${hp} / ${max}`;

    if (this.heartMax !== max) {
      this.heartMax = max;
      const holder = this.healthBar.querySelector<HTMLElement>('.b2-hud__hearts');
      if (holder) {
        holder.replaceChildren();
        this.hearts.length = 0;
        for (let i = 0; i < max; i++) {
          const heart = el('img', 'b2-hud__heart');
          heart.src = heartIcon;
          heart.alt = '';
          heart.decoding = 'async';
          heart.draggable = false;
          holder.append(heart);
          this.hearts.push(heart);
        }
      }
    }
    this.hearts.forEach((heart, i) => heart.classList.toggle('is-empty', i >= hp));

    this.healthFill.style.width = `${ratio * 100}%`;
    if (snap) {
      // First paint (or a revive): the trailing ghost jumps straight there, no lag.
      this.healthGhost.style.transition = 'none';
      this.healthGhost.style.width = `${ratio * 100}%`;
      void this.healthGhost.offsetWidth;
      this.healthGhost.style.transition = '';
    } else {
      // Damage leaves a fading trail because the ghost drains slower than the fill.
      this.healthGhost.style.width = `${ratio * 100}%`;
    }
  }

  reset(): void {
    this.bannerBox.classList.remove('show');
    this.incomingBox.classList.remove('show');
    this.bossBox.classList.add('hidden');
    this.heatBox.classList.add('hidden');
    this.stampBox.classList.remove('show');
    this.toast.classList.remove('show');
    this.bannerTimer = 0;
    this.incomingTimer = 0;
    this.stampTimer = 0;
    this.toastTimer = 0;
    this.toastQueue.length = 0;
    this.lastHeat = '';
    this.lastBoss = '';
    this.lastBossUid = -1;
    this.shownScore = this.game.score.score;
    this.score.textContent = formatScore(this.shownScore);
  }

  /** Heat meter: quiet in the tutorial, climbing in every incident room. */
  private updateHeat(): void {
    const game = this.game;
    const show = game.state === 'playing' && game.heat.active;
    this.heatBox.classList.toggle('hidden', !show);
    if (!show) {
      this.lastHeat = '';
      return;
    }
    const heat = Math.round(game.heat.heat);
    const tier = game.heat.tier;
    const released = game.heat.released;
    const name = game.room.incidentSpec?.name ?? 'FINAL SURGE';
    const key = `${heat}|${tier}|${released}|${name}`;
    if (key === this.lastHeat) return;
    this.lastHeat = key;
    this.heatFill.style.width = `${Math.max(0, Math.min(100, game.heat.heat))}%`;
    this.heatPct.textContent = `${heat}%`;
    this.heatName.textContent = name;
    this.heatTier.textContent = released ? 'INBOUND' : tier === 0 ? 'QUIET' : tier === 1 ? 'THEY NOTICED' : 'LOSING IT';
    this.heatBox.dataset.tier = String(tier);
    this.heatBox.classList.toggle('released', released);
    this.heatBox.setAttribute('aria-label', `Heat ${heat} percent, ${this.heatTier.textContent.toLowerCase()}`);
  }

  /** One health bar for the room's current Headliner or Enforcer. */
  private updateBoss(): void {
    const game = this.game;
    const boss = game.room.incidentEnemy;
    const show = game.state === 'playing' && boss !== null && !boss.defeated;
    this.bossBox.classList.toggle('hidden', !show);
    if (!show || !boss) {
      this.lastBoss = '';
      this.lastBossUid = -1;
      return;
    }
    const maxHp = Math.max(1, boss.type.hp);
    const ratio = Math.max(0, Math.min(1, boss.hp / maxHp));
    const key = `${boss.uid}|${Math.round(ratio * 1000)}|${boss.phaseIndex}`;
    if (key === this.lastBoss) return;
    this.lastBoss = key;
    this.bossBox.dataset.kind = boss.incident ?? 'headliner';
    this.bossName.textContent = game.room.incidentSpec?.name ?? boss.type.name;
    this.bossTag.textContent = boss.incident === 'enforcer' ? 'ENFORCER' : 'HEADLINER';
    this.bossFill.style.width = `${ratio * 100}%`;
    this.bossBox.classList.toggle('phase-2', boss.phaseIndex >= 1);
    if (boss.uid !== this.lastBossUid) {
      this.lastBossUid = boss.uid;
      const phases = boss.incident === 'headliner' ? boss.type.phases ?? [] : [];
      this.bossPips.replaceChildren(...phases.map(() => el('span', 'boss-pip b2-hud__bosspip')));
    }
    const pips = this.bossPips.children;
    for (let i = 0; i < pips.length; i++) {
      pips[i]!.classList.toggle('lit', i < boss.phaseIndex);
    }
  }

  frame(dt: number): void {
    const game = this.game;
    const last = this.last;

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bannerBox.classList.remove('show');
    }
    if (this.incomingTimer > 0) {
      this.incomingTimer -= dt;
      if (this.incomingTimer <= 0) this.incomingBox.classList.remove('show');
    }
    if (this.stampTimer > 0) {
      this.stampTimer -= dt;
      if (this.stampTimer <= 0) this.stampBox.classList.remove('show');
    }
    if (this.unlockTimer > 0) {
      this.unlockTimer -= dt;
      if (this.unlockTimer <= 0) this.unlockBox.classList.remove('show');
    }
    // Whichever device was touched last decides which controls are on screen.
    const touch = game.input.touch;
    if (touch !== last.touch) {
      last.touch = touch;
      document.body.classList.toggle('touch', touch);
    }
    this.updateCoach(touch);
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.classList.remove('show');
    } else if (this.toastQueue.length > 0) {
      this.toastTitle.textContent = this.toastQueue.shift() ?? '';
      this.toastCount.textContent = `${game.discoveries.count}/${DISCOVERY_BY_ID.size}`;
      this.toast.classList.add('show');
      this.toastTimer = 2.8;
    }

    const cinema = game.cinema > 0;
    if (cinema !== last.cinema) {
      last.cinema = cinema;
      document.body.classList.toggle('cinema', cinema);
    }

    const room = game.room;
    const roomText = room.daily ? 'D' : String(room.index + 1);
    if (roomText !== last.room) {
      last.room = roomText;
      this.roomNum.textContent = roomText;
    }
    const carrying = game.player.held !== null;
    if (carrying !== last.carrying) {
      last.carrying = carrying;
      document.body.classList.toggle('carrying', carrying);
    }

    const hp = game.player.hp;
    if (hp !== last.hp) {
      const first = last.hp < 0;
      const healed = hp > last.hp;
      last.hp = hp;
      this.updateHealth(hp, game.player.maxHp, first);
      if (!first) {
        // One-shot thump: shake on a hit, pop on a heal. The class comes off so
        // the low-health pulse can take over again afterwards.
        window.clearTimeout(this.healthTimer);
        this.healthBar.classList.remove('hit', 'heal');
        void this.healthBar.offsetWidth;
        this.healthBar.classList.add(healed ? 'heal' : 'hit');
        this.healthTimer = window.setTimeout(() => this.healthBar.classList.remove('hit', 'heal'), 500);
      }
    }

    // Mugshots stay greyed until that intruder has actually come through the door.
    const pending = room.pending.length;
    if (pending !== last.pending) {
      last.pending = pending;
      const entered = this.mugs.length - pending;
      this.mugs.forEach((mug, i) => {
        if (!mug.out) mug.node.classList.toggle('waiting', i >= entered);
      });
    }

    const challenge = game.challenges.current;
    const status = game.challenges.status();
    const challengeKey = challenge ? `${challenge.id}:${status}` : '';
    if (challengeKey !== last.challenge) {
      last.challenge = challengeKey;
      this.sticky.classList.toggle('hidden', !challenge);
      this.sticky.classList.toggle('failed', status === 'failed');
      this.stickyText.textContent = challenge ? challenge.short.toLowerCase() : '';
      this.sticky.title = challenge ? challenge.text.toLowerCase() : '';
    }

    // The total rolls up like a till instead of jumping.
    const score = game.score.score;
    if (this.shownScore !== score) {
      const gap = score - this.shownScore;
      this.shownScore = Math.abs(gap) < 3 ? score : this.shownScore + gap * Math.min(1, dt * 9);
      this.score.textContent = formatScore(this.shownScore);
      this.score.classList.toggle('rolling', this.shownScore !== score);
    }

    const combo = game.score.combo;
    if (combo !== last.combo) {
      last.combo = combo;
      this.combo.classList.toggle('on', combo > 1);
      this.comboValue.textContent = `x${combo}`;
      this.combo.classList.remove('bump');
      void this.combo.offsetWidth;
      if (combo > 1) this.combo.classList.add('bump');
    }
    if (combo > 1) {
      const t = Math.max(0, Math.min(1, game.score.comboTimer / COMBO_WINDOW));
      if (Math.abs(t - last.comboT) > 0.012) {
        last.comboT = t;
        this.combo.style.setProperty('--t', t.toFixed(3));
      }
    }

    // Bought abilities as kit item slots with a radial cooldown sweep, plus the scrap purse.
    const owned = game.abilities.ownedList();
    const ownedKey = owned.map((a) => a.id).join(',');
    if (ownedKey !== last.powers) {
      last.powers = ownedKey;
      this.powerChips.clear();
      this.powerCool.clear();
      this.powers.replaceChildren(
        ...owned.map((a) => {
          const chip = el('span', `power-chip power-${a.id} b2-hud__power`);
          chip.setAttribute('role', 'img');
          chip.setAttribute('aria-label', `${a.name}, key ${a.key}, ready`);
          chip.title = `${a.name} · ${a.key}`;
          const iconWrap = el('span', 'power-icon b2-hud__powericon');
          const icon = el('img', 'b2-hud__powerart');
          icon.src = POWER_ART[a.id];
          icon.alt = '';
          icon.decoding = 'async';
          iconWrap.append(icon);
          chip.append(iconWrap, el('span', 'power-sweep'), el('span', 'power-key b2-hud__powerkey', a.key));
          const left = game.abilities.remaining(a.id);
          const cool = game.abilities.cooldownFor(a);
          const t = cool > 0 ? Math.max(0, Math.min(1, left / cool)) : 0;
          chip.style.setProperty('--cool', t.toFixed(3));
          chip.classList.toggle('cool', t > 0);
          this.powerChips.set(a.id, chip);
          this.powerCool.set(a.id, t);
          return chip;
        }),
      );
    }
    for (const a of owned) {
      const chip = this.powerChips.get(a.id);
      if (!chip) continue;
      const left = game.abilities.remaining(a.id);
      const cool = game.abilities.cooldownFor(a);
      const t = cool > 0 ? Math.max(0, Math.min(1, left / cool)) : 0;
      const was = this.powerCool.get(a.id) ?? 0;
      chip.style.setProperty('--cool', t.toFixed(3));
      chip.classList.toggle('cool', t > 0);
      chip.setAttribute('aria-label', t > 0 ? `${a.name}, recharging` : `${a.name}, ready`);
      if (was > 0 && t <= 0) {
        // Just finished cooling: one pop, then back to the idle glow.
        chip.classList.remove('ready');
        void chip.offsetWidth;
        chip.classList.add('ready');
        window.setTimeout(() => chip.classList.remove('ready'), 550);
      }
      this.powerCool.set(a.id, t);
    }
    const scrap = game.save.data.scrap;
    if (scrap !== last.scrap) {
      last.scrap = scrap;
      this.scrapSlip.textContent = scrap > 0 ? String(scrap) : '';
      this.scrapSlip.classList.toggle('is-empty', scrap <= 0);
    }
    this.updateHeat();
    this.updateBoss();
  }
}
