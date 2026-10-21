import { moveKeysLabel } from '../../input/KeyLabels';
import type { Game } from '../../core/Game';
import { ANNOUNCEMENTS_VISIBLE } from '../../core/constants';
import { ENEMY_TYPES, type EnemyTypeId } from '../../entities/EnemyTypes';
import type { Enemy } from '../../entities/Enemy';
import type { IncidentKind } from '../../gameplay/Incidents';
import type { GuideIcon } from '../../gameplay/Tutorial';
import { DISCOVERY_BY_ID } from '../../gameplay/Discoveries';
import { COMBO_WINDOW } from '../../gameplay/ScoreSystem';
import { el, formatScore, ransom } from '../dom';

interface Mug {
  node: HTMLElement;
  type: EnemyTypeId;
  incident: IncidentKind | null;
  out: boolean;
}

/**
 * The in-game overlay, built as things lying around the flat rather than a status bar:
 * a luggage tag for the room, a liquid health bar for the player, a police-style
 * line-up of the intruders, a sticky note for the bonus, and a till receipt for the
 * damage bill. DOM writes only happen when a value actually changes.
 */
export class HUD {
  private readonly root: HTMLElement;
  private readonly roomNum: HTMLElement;
  private readonly healthBar: HTMLElement;
  private readonly healthFill: HTMLElement;
  private readonly healthGhost: HTMLElement;
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
    this.root = el('div', 'hud hidden');
    const top = el('div', 'hud-top');

    // ── left: room tag + health bar ──
    const left = el('div', 'hud-left');
    const tag = el('div', 'room-tag');
    tag.setAttribute('aria-label', 'Room');
    tag.append(el('span', 'room-tag-hole'), (this.roomNum = el('span', 'room-tag-num', '1')));
    const bar = el('div', 'healthbar');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', 'Health');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(game.player.maxHp));
    this.healthGhost = el('span', 'health-ghost');
    this.healthFill = el('span', 'health-fill');
    this.healthFill.append(el('span', 'health-shine'));
    const ticks = el('span', 'health-ticks');
    for (let i = 1; i < game.player.maxHp; i++) {
      const tick = el('span', 'health-tick');
      tick.style.left = `${(i / game.player.maxHp) * 100}%`;
      ticks.append(tick);
    }
    bar.append(this.healthGhost, this.healthFill, ticks);
    this.healthBar = bar;
    this.updateHealth(game.player.hp, game.player.maxHp, true);

    // Heat is a torn meter under the room tag: it fills as the player makes a mess.
    this.heatBox = el('div', 'hud-heat hidden');
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
    left.append(tag, this.heatBox, bar);

    // ── centre: the line-up + bonus note ──
    const center = el('div', 'hud-center');
    this.lineup = el('div', 'lineup');
    this.sticky = el('div', 'sticky hidden');
    this.stickyText = el('span', 'sticky-text');
    this.sticky.append(el('span', 'sticky-box'), this.stickyText);
    center.append(this.lineup, this.sticky);

    // ── right: receipt + combo sticker + pause ──
    const right = el('div', 'hud-right');
    this.combo = el('div', 'combo-sticker');
    this.comboValue = el('span', 'combo-value');
    this.combo.append(el('span', 'combo-ring'), this.comboValue);
    const receipt = el('div', 'receipt');
    receipt.setAttribute('aria-label', 'Damage');
    receipt.append((this.score = el('span', 'receipt-total', '0')));
    // The sticker rides on the bill, but outside it: the receipt's zigzag clip would cut it.
    const bill = el('div', 'bill');
    bill.append(receipt, this.combo);
    this.powers = el('div', 'powers');
    this.scrapSlip = el('span', 'scrap-slip', '');
    const tools = el('div', 'tools');
    tools.append(this.scrapSlip, this.powers);
    const pause = el('button', 'hud-pause');
    pause.type = 'button';
    pause.setAttribute('aria-label', 'Pause');
    pause.append(el('span'), el('span'));
    pause.addEventListener('click', onPause);
    right.append(bill, tools, pause);

    top.append(left, center, right);

    this.bannerBox = el('div', 'hud-banner');
    this.incomingBox = el('div', 'hud-incoming');
    this.bossBox = el('div', 'hud-boss hidden');
    this.bossName = el('span', 'boss-name', '');
    this.bossTag = el('span', 'boss-tag', '');
    this.bossFill = el('span', 'boss-fill');
    this.bossPips = el('span', 'boss-pips');
    const bossHead = el('div', 'boss-head');
    bossHead.append(this.bossName, this.bossTag);
    const bossTrack = el('div', 'boss-track');
    bossTrack.append(this.bossFill, this.bossPips);
    this.bossBox.append(bossHead, bossTrack);
    this.stampBox = el('div', 'hud-stamp');
    this.toast = el('div', 'hud-toast');
    this.toastTitle = el('div', 'toast-title');
    this.toastCount = el('span', 'toast-count');
    this.toast.append(el('span', 'pin'), this.toastCount, this.toastTitle);

    // The coach shows the controls for whatever the tutorial is teaching; skip is always on offer.
    this.coach = el('div', 'coach');
    this.unlockBox = el('div', 'hud-unlock');
    const skip = el('button', 'coach-skip', 'SKIP');
    skip.type = 'button';
    skip.addEventListener('click', () => game.tutorial.skip());

    this.root.append(
      top, this.bannerBox, this.incomingBox, this.bossBox, this.stampBox, this.toast, this.coach, skip, this.unlockBox,
      el('div', 'cinema-bar top'), el('div', 'cinema-bar bottom'),
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
      node.append(el('span', 'mug-face'));
      if (incident === 'enforcer') node.append(el('span', 'mug-crown', '♛'));
      this.lineup.append(node);
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

  /** The level-up card: a sticky note slapped on the screen for a few seconds.
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

  /** Paints the health bar: green while healthy, orange past half, red when critical. */
  private updateHealth(hp: number, max: number, snap = false): void {
    const ratio = Math.max(0, Math.min(1, hp / max));
    this.healthBar.dataset.state = ratio >= 0.6 ? 'full' : ratio > 0.3 ? 'mid' : 'low';
    this.healthBar.setAttribute('aria-valuenow', String(hp));
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
      this.bossPips.replaceChildren(...phases.map(() => el('span', 'boss-pip')));
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

    // Bought abilities as icon orbs with a radial cooldown sweep, plus the scrap purse.
    const owned = game.abilities.ownedList();
    const ownedKey = owned.map((a) => a.id).join(',');
    if (ownedKey !== last.powers) {
      last.powers = ownedKey;
      this.powerChips.clear();
      this.powerCool.clear();
      this.powers.replaceChildren(
        ...owned.map((a) => {
          const chip = el('span', `power-chip power-${a.id}`);
          chip.setAttribute('role', 'img');
          chip.setAttribute('aria-label', `${a.name}, ready`);
          chip.title = a.name;
          chip.append(el('span', 'power-icon'), el('span', 'power-sweep'));
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
    }
    this.updateHeat();
    this.updateBoss();
  }
}
