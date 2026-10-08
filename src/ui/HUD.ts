import { VIEW } from '../core/Tuning';
import { clamp01 } from '../core/Mathx';
import type { CursorStateName } from '../cursor/CursorState';
import { el, formatClock } from './Dom';
import { ICON_PATHS, INK, iconSvg, installInkDefs, svg } from './Ink';

/** One creature's presence on the sweep, as the HUD needs to know it. */
export interface ThreatMark {
  /** Logical x, used to place it along the sweep. */
  x: number;
  /** 0..1 how alarmed it is. */
  tell: number;
  /** True while it is actually coming for you. */
  hunting: boolean;
  asleep: boolean;
}

export interface HudState {
  roomLabel: string;
  roomName: string;
  objective: string;
  seconds: number;
  heat: number;
  cursorState: CursorStateName;
  detections: number;
  hint: string;
  carrying: boolean;
  sneaking: boolean;
  hidden: boolean;
  threats: readonly ThreatMark[];
  modifiers: readonly string[];
}

const SWEEP_W = 420;
const SWEEP_H = 26;

/**
 * The instrument panel of a surveillance rig somebody has been scratching notes
 * on for years. No bars, no numbers you have to read: a ruled sweep across the
 * top of the frame with a mark for every creature in the room, placed by where
 * it stands and lit by how interested it is.
 *
 * It tells you the one thing the world cannot: that something off to your right,
 * outside the light, has started paying attention.
 */
export class HUD {
  readonly root: HTMLElement;
  private readonly roomLabel: HTMLElement;
  private readonly roomName: HTMLElement;
  private readonly objective: HTMLElement;
  private readonly clock: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly mods: HTMLElement;

  private readonly sweep: SVGSVGElement;
  private readonly sweepMarks: SVGGElement;
  private readonly markPool: SVGGElement[] = [];

  private readonly eyeShape: SVGPathElement;
  private readonly eyeIcon: HTMLElement;
  private readonly keyIcon: HTMLElement;
  private readonly footIcon: HTMLElement;
  private readonly hiddenIcon: HTMLElement;

  private lastHint = '';

  constructor(parent: HTMLElement) {
    installInkDefs();
    this.root = el('div', 'hud');

    // --- the sweep --------------------------------------------------------
    const sweepWrap = el('div', 'hud-sweep');
    this.sweep = svg('svg', {
      viewBox: `0 0 ${SWEEP_W} ${SWEEP_H}`,
      width: SWEEP_W,
      height: SWEEP_H,
    });
    this.sweep.style.filter = INK.roughSoft;

    const rule = svg('g', { stroke: 'currentColor', fill: 'none', 'stroke-linecap': 'round' });
    rule.append(svg('path', { d: `M4 18 L${SWEEP_W - 4} 18`, 'stroke-width': 1.1, opacity: 0.55 }));
    // Ticks: tall at the ends and the centre, short in between.
    for (let i = 0; i <= 16; i++) {
      const x = 4 + (i / 16) * (SWEEP_W - 8);
      const major = i % 4 === 0;
      rule.append(
        svg('path', {
          d: `M${x.toFixed(1)} 18 L${x.toFixed(1)} ${major ? 10 : 14}`,
          'stroke-width': major ? 1.3 : 0.9,
          opacity: major ? 0.75 : 0.4,
        }),
      );
    }
    this.sweep.append(rule);

    this.sweepMarks = svg('g');
    this.sweep.append(this.sweepMarks);
    sweepWrap.append(this.sweep);

    // --- corners ----------------------------------------------------------
    const topLeft = el('div', 'hud-corner tl');
    this.roomLabel = el('div', 'hud-room-label');
    this.roomName = el('div', 'hud-room-name');
    topLeft.append(this.roomLabel, this.roomName);

    const topCentre = el('div', 'hud-objective-wrap');
    this.objective = el('div', 'hud-objective');
    topCentre.append(this.objective);

    const topRight = el('div', 'hud-corner tr');
    this.clock = el('div', 'hud-clock');
    const icons = el('div', 'hud-icons');

    // The eye is the heat readout: it opens as something starts to look at you.
    this.eyeIcon = el('span', 'hud-icon eye');
    const eye = svg('svg', {
      viewBox: '0 0 26 22',
      width: 26,
      height: 22,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1.6,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    });
    this.eyeShape = svg('path', { d: ICON_PATHS.eye(0.18) });
    eye.append(
      svg('path', { d: ICON_PATHS.waveLeft, opacity: 0.55 }),
      svg('path', { d: ICON_PATHS.waveRight, opacity: 0.55 }),
      this.eyeShape,
      svg('path', { d: ICON_PATHS.pupil, fill: 'currentColor', stroke: 'none' }),
    );
    eye.style.filter = INK.rough;
    this.eyeIcon.append(eye);

    this.keyIcon = el('span', 'hud-icon key');
    this.keyIcon.append(iconSvg(ICON_PATHS.key, 24));
    this.footIcon = el('span', 'hud-icon foot');
    this.footIcon.append(iconSvg(ICON_PATHS.foot, 20));
    this.hiddenIcon = el('span', 'hud-icon hide');
    this.hiddenIcon.append(iconSvg(ICON_PATHS.hidden, 24));

    icons.append(this.eyeIcon, this.footIcon, this.keyIcon, this.hiddenIcon);
    this.mods = el('div', 'hud-mods');
    topRight.append(this.clock, icons, this.mods);

    this.hint = el('div', 'hud-hint');

    this.root.append(sweepWrap, topLeft, topCentre, topRight, this.hint);
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
    this.mods.textContent = s.modifiers.join('  ');

    const tone =
      s.cursorState === 'PANICKING' || s.cursorState === 'DETECTED'
        ? 'hot'
        : s.cursorState === 'SUSPICIOUS'
          ? 'warm'
          : 'cool';
    this.root.dataset.tone = tone;

    // The eye widens with the worst awareness in the room.
    this.eyeShape.setAttribute('d', ICON_PATHS.eye(0.14 + clamp01(s.heat) * 0.86));
    this.eyeIcon.dataset.heat = s.heat > 0.72 ? 'hot' : s.heat > 0.3 ? 'warm' : 'cool';

    this.keyIcon.dataset.on = String(s.carrying);
    this.footIcon.dataset.on = String(s.sneaking);
    this.hiddenIcon.dataset.on = String(s.hidden);
    this.roomLabel.dataset.seen = s.detections > 0 ? 'true' : '';

    this.drawThreats(s.threats);

    if (s.hint !== this.lastHint) {
      this.lastHint = s.hint;
      this.hint.textContent = s.hint;
      this.hint.style.opacity = s.hint ? '1' : '0';
    }
  }

  /** One mark per creature, placed along the sweep by where it stands. */
  private drawThreats(threats: readonly ThreatMark[]): void {
    while (this.markPool.length < threats.length) {
      const g = svg('g');
      g.append(
        svg('path', { d: 'M0 -7 L4 1 L0 5 L-4 1 Z', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }),
        svg('path', { d: 'M0 7 L0 12', 'stroke-width': 1.1, 'stroke-linecap': 'round' }),
      );
      this.sweepMarks.append(g);
      this.markPool.push(g);
    }

    for (let i = 0; i < this.markPool.length; i++) {
      const g = this.markPool[i];
      const t = threats[i];
      if (!t) {
        g.style.display = 'none';
        continue;
      }
      g.style.display = '';
      const x = 4 + clamp01(t.x / VIEW.width) * (SWEEP_W - 8);
      g.setAttribute('transform', `translate(${x.toFixed(1)} 11)`);

      const tell = clamp01(t.tell);
      const colour = t.asleep
        ? 'var(--eye-dim)'
        : t.hunting || tell >= 0.95
          ? 'var(--alarm)'
          : tell >= 0.8
            ? '#ff9a5a'
            : tell >= 0.55
              ? 'var(--warm)'
              : tell >= 0.28
                ? '#e4e97d'
                : 'var(--eye-dim)';
      const body = g.children[0] as SVGPathElement;
      const stem = g.children[1] as SVGPathElement;
      body.setAttribute('stroke', colour);
      body.setAttribute('fill', tell > 0.5 ? colour : 'none');
      body.setAttribute('opacity', String(0.45 + tell * 0.55));
      stem.setAttribute('stroke', colour);
      stem.setAttribute('opacity', String(0.25 + tell * 0.6));
      const scale = 0.8 + tell * 0.5;
      g.setAttribute('transform', `translate(${x.toFixed(1)} 11) scale(${scale.toFixed(2)})`);
    }
  }
}
