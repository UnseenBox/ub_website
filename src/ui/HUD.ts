import { el, formatClock } from './Dom';
import type { CursorStateName } from '../cursor/CursorState';

export interface HudState {
  roomLabel: string;
  roomName: string;
  objective: string;
  seconds: number;
  score: number;
  /** 0..1 worst awareness in the room. */
  heat: number;
  cursorState: CursorStateName;
  detections: number;
  /** One short line of teaching, or empty. */
  hint: string;
  carrying: boolean;
  modifiers: readonly string[];
}

/**
 * The HUD says as little as it can get away with.
 *
 * No health bar, no awareness meter. Danger is communicated by the room: the
 * creature's eye, the cursor's pulse, the vignette and the heartbeat. The only
 * concession is a hairline across the top of the screen, which is easy to read
 * out of the corner of an eye and easy to ignore.
 */
export class HUD {
  readonly root: HTMLElement;
  private readonly roomLabel: HTMLElement;
  private readonly roomName: HTMLElement;
  private readonly objective: HTMLElement;
  private readonly clock: HTMLElement;
  private readonly score: HTMLElement;
  private readonly thread: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly badge: HTMLElement;
  private readonly mods: HTMLElement;
  private lastHint = '';

  constructor(parent: HTMLElement) {
    this.root = el('div', 'hud');

    this.thread = el('div', 'hud-thread');

    const topLeft = el('div', 'hud-corner tl');
    this.roomLabel = el('div', 'hud-room-label');
    this.roomName = el('div', 'hud-room-name');
    topLeft.append(this.roomLabel, this.roomName);

    const topCentre = el('div', 'hud-objective-wrap');
    this.objective = el('div', 'hud-objective');
    this.badge = el('div', 'hud-badge');
    topCentre.append(this.objective, this.badge);

    const topRight = el('div', 'hud-corner tr');
    this.clock = el('div', 'hud-clock');
    this.score = el('div', 'hud-score');
    this.mods = el('div', 'hud-mods');
    topRight.append(this.clock, this.score, this.mods);

    this.hint = el('div', 'hud-hint');

    this.root.append(this.thread, topLeft, topCentre, topRight, this.hint);
    parent.append(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? 'block' : 'none';
  }

  update(s: HudState): void {
    this.roomLabel.textContent = s.roomLabel;
    this.roomName.textContent = s.roomName;
    this.objective.textContent = s.objective;
    this.clock.textContent = formatClock(s.seconds);
    this.score.textContent = s.score > 0 ? String(s.score) : '';

    const tone =
      s.cursorState === 'PANICKING' || s.cursorState === 'DETECTED'
        ? 'hot'
        : s.cursorState === 'SUSPICIOUS'
          ? 'warm'
          : 'cool';
    this.thread.dataset.tone = tone;
    this.thread.style.transform = `scaleX(${Math.max(0.02, Math.min(1, s.heat)).toFixed(3)})`;
    this.thread.style.opacity = String(0.25 + Math.min(1, s.heat) * 0.75);

    this.badge.textContent = s.carrying ? 'KEY' : '';
    this.badge.style.opacity = s.carrying ? '1' : '0';

    this.mods.textContent = s.modifiers.join('  ');

    if (s.hint !== this.lastHint) {
      this.lastHint = s.hint;
      this.hint.textContent = s.hint;
      this.hint.style.opacity = s.hint ? '1' : '0';
    }

    if (s.detections > 0) {
      this.roomLabel.dataset.seen = 'true';
    } else {
      delete this.roomLabel.dataset.seen;
    }
  }
}
