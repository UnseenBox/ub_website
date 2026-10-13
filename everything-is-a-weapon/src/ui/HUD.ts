import { moveKeysLabel, onKeyLabelsChange } from '../input/KeyLabels';
import type { Game } from '../core/Game';
import { ENEMY_TYPES, type EnemyTypeId } from '../entities/EnemyTypes';
import type { GuideIcon } from '../gameplay/Tutorial';
import { DISCOVERY_BY_ID } from '../gameplay/Discoveries';
import { COMBO_WINDOW } from '../gameplay/ScoreSystem';
import { el, formatScore, ransom } from './dom';

interface Mug {
  node: HTMLElement;
  type: EnemyTypeId;
  out: boolean;
}

/**
 * The in-game overlay, built as things lying around the flat rather than a status bar:
 * a luggage tag for the room, sticking plasters for health, a police-style line-up of the
 * intruders, a sticky note for the bonus, and a till receipt for the damage bill.
 * DOM writes only happen when a value actually changes.
 */
export class HUD {
  private readonly root: HTMLElement;
  private readonly roomNum: HTMLElement;
  private readonly roomName: HTMLElement;
  private readonly plasters: HTMLElement[] = [];
  private readonly lineup: HTMLElement;
  private readonly sticky: HTMLElement;
  private readonly stickyText: HTMLElement;
  private readonly score: HTMLElement;
  private readonly combo: HTMLElement;
  private readonly comboValue: HTMLElement;
  private readonly powers: HTMLElement;
  private readonly scrapSlip: HTMLElement;
  private readonly bannerBox: HTMLElement;
  private readonly stampBox: HTMLElement;
  private readonly toast: HTMLElement;
  private readonly toastTitle: HTMLElement;
  private readonly toastCount: HTMLElement;
  private readonly coach: HTMLElement;
  private readonly unlockBox: HTMLElement;
  private readonly point = { x: 0, y: 0 };
  private unlockTimer = 0;

  private mugs: Mug[] = [];
  private last = { room: '', name: '', hp: -1, pending: -1, challenge: '', combo: -1, carrying: false, cinema: false, comboT: -1, powers: '', coach: '', touch: false };
  private shownScore = 0;
  private bannerTimer = 0;
  private bannerSeed = 1;
  private stampTimer = 0;
  private toastTimer = 0;
  private readonly toastQueue: string[] = [];

  constructor(private readonly game: Game, parent: HTMLElement, onPause: () => void) {
    this.root = el('div', 'hud hidden');
    const top = el('div', 'hud-top');

    // ── left: room tag + plasters ──
    const left = el('div', 'hud-left');
    const tag = el('div', 'room-tag');
    tag.append(el('span', 'room-tag-hole'), el('span', 'room-tag-label', 'ROOM'), (this.roomNum = el('span', 'room-tag-num', '1')));
    this.roomName = el('div', 'room-name', '');
    const plasterRow = el('div', 'plasters');
    plasterRow.setAttribute('aria-label', 'Health');
    for (let i = 0; i < game.player.maxHp; i++) {
      const plaster = el('span', 'plaster');
      plaster.style.setProperty('--tilt', `${[-9, 6, -4, 10, -7][i % 5]}deg`);
      this.plasters.push(plaster);
      plasterRow.append(plaster);
    }
    left.append(tag, this.roomName, plasterRow);

    // ── centre: the line-up + bonus note ──
    const center = el('div', 'hud-center');
    this.lineup = el('div', 'lineup');
    this.sticky = el('div', 'sticky hidden');
    this.stickyText = el('span', 'sticky-text');
    this.sticky.append(el('span', 'sticky-box'), this.stickyText);
    center.append(this.lineup, this.sticky);

    // ── right: receipt + combo sticker + pause ──
    const right = el('div', 'hud-right');
    const receipt = el('div', 'receipt');
    receipt.append(el('span', 'receipt-label', 'DAMAGE'), (this.score = el('span', 'receipt-total', '0')));
    this.powers = el('div', 'powers');
    this.scrapSlip = el('span', 'scrap-slip', '');
    this.combo = el('div', 'combo-sticker');
    this.comboValue = el('span', 'combo-value');
    this.combo.append(el('span', 'combo-ring'), this.comboValue);
    const pause = el('button', 'hud-pause');
    pause.type = 'button';
    pause.setAttribute('aria-label', 'Pause');
    pause.append(el('span'), el('span'));
    pause.addEventListener('click', onPause);
    right.append(receipt, this.powers, this.scrapSlip, this.combo, pause);

    top.append(left, center, right);

    this.bannerBox = el('div', 'hud-banner');
    this.stampBox = el('div', 'hud-stamp');
    this.toast = el('div', 'hud-toast');
    this.toastTitle = el('div', 'toast-title');
    this.toastCount = el('span', 'toast-count');
    const toastHead = el('div', 'toast-head');
    toastHead.append(el('span', '', 'NEW EVIDENCE'), this.toastCount);
    this.toast.append(el('span', 'pin'), toastHead, this.toastTitle);

    const hint = el('div', 'hud-hint');
    const moveKey = el('kbd', '', moveKeysLabel());
    onKeyLabelsChange(() => (moveKey.textContent = moveKeysLabel()));
    const moveItem = el('span', 'hint-item');
    moveItem.append(moveKey, el('span', '', 'move'));
    hint.append(moveItem);
    for (const [key, action] of [['CLICK', 'grab'], ['HOLD + LET GO', 'throw'], ['RIGHT CLICK', 'drop'], ['SPACE', 'dodge'], ['R', 'restart'], ['P', 'pause']]) {
      const item = el('span', 'hint-item');
      item.append(el('kbd', '', key), el('span', '', action));
      hint.append(item);
    }

    // The coach shows the controls for whatever the tutorial is teaching; skip is always on offer.
    this.coach = el('div', 'coach');
    this.unlockBox = el('div', 'hud-unlock');
    const skip = el('button', 'coach-skip', 'SKIP LESSONS');
    skip.type = 'button';
    skip.addEventListener('click', () => game.tutorial.skip());

    this.root.append(
      top, this.bannerBox, this.stampBox, this.toast, hint, this.coach, skip, this.unlockBox,
      el('div', 'cinema-bar top'), el('div', 'cinema-bar bottom'),
    );
    parent.append(this.root);

    game.bus.on('ROOM_START', () => this.buildLineup());
    game.bus.on('ENEMY_DEFEATED', (e) => this.crossOut(e.enemy.type.id));
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  /** One mugshot per intruder expected in this room, in the order they will arrive. */
  private buildLineup(): void {
    this.lineup.replaceChildren(el('span', 'lineup-label', 'WANTED'));
    // Whoever is still outside: the room's list and its boss, minus anyone a replayed lesson left out.
    const specs = [...this.game.room.pending];
    this.mugs = specs.map((spec) => {
      const type = ENEMY_TYPES[spec.type];
      const node = el('span', `mug mug-${spec.type} waiting`);
      node.style.setProperty('--mug', type.color);
      node.title = type.name;
      node.append(el('span', 'mug-face'));
      this.lineup.append(node);
      return { node, type: spec.type, out: false };
    });
    this.last.pending = -1;
  }

  private crossOut(type: EnemyTypeId): void {
    const mug = this.mugs.find((m) => !m.out && m.type === type && !m.node.classList.contains('waiting')) ?? this.mugs.find((m) => !m.out && m.type === type);
    if (!mug) return;
    mug.out = true;
    mug.node.classList.remove('waiting');
    mug.node.classList.add('out');
  }

  /** Big ransom-note announcement. `sub` may be a chain ("A → B → C"), shown as linked tags. */
  banner(title: string, sub = '', seconds = 2): void {
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

  /** The level-up card: a sticky note slapped on the screen for a few seconds. */
  unlock(kicker: string, title: string, sub: string): void {
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

  reset(): void {
    this.bannerBox.classList.remove('show');
    this.stampBox.classList.remove('show');
    this.toast.classList.remove('show');
    this.bannerTimer = 0;
    this.stampTimer = 0;
    this.toastTimer = 0;
    this.toastQueue.length = 0;
    this.shownScore = this.game.score.score;
    this.score.textContent = formatScore(this.shownScore);
  }

  frame(dt: number): void {
    const game = this.game;
    const last = this.last;

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bannerBox.classList.remove('show');
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
    if (room.def.name !== last.name) {
      last.name = room.def.name;
      this.roomName.textContent = room.daily ? `daily · ${room.def.name.toLowerCase()}` : room.def.name.toLowerCase();
    }

    const carrying = game.player.held !== null;
    if (carrying !== last.carrying) {
      last.carrying = carrying;
      document.body.classList.toggle('carrying', carrying);
    }

    const hp = game.player.hp;
    if (hp !== last.hp) {
      last.hp = hp;
      this.plasters.forEach((plaster, i) => plaster.classList.toggle('off', i >= hp));
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
      this.stickyText.textContent = challenge ? challenge.text.toLowerCase() : '';
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

    // Bought abilities with their cooldowns, plus the scrap purse.
    const owned = game.abilities.ownedList();
    const powersKey = `${game.save.data.scrap}|${owned.map((a) => `${a.id}:${Math.ceil(game.abilities.remaining(a.id))}`).join(',')}`;
    if (powersKey !== last.powers) {
      last.powers = powersKey;
      this.scrapSlip.textContent = game.save.data.scrap > 0 || owned.length > 0 ? `SCRAP ${game.save.data.scrap}` : '';
      this.powers.replaceChildren(
        ...owned.map((a) => {
          const left = Math.ceil(game.abilities.remaining(a.id));
          const chip = el('span', left > 0 ? 'power-chip cool' : 'power-chip', left > 0 ? `${a.key} ${a.name} ${left}` : `${a.key} ${a.name}`);
          return chip;
        }),
      );
    }
  }
}
