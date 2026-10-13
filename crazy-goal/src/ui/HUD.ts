import type { DuelScore, Game } from '../core/Game';
import { rtl, tr } from '../core/i18n';
import { clamp01, easeOutBack, easeOutCubic, lerp } from '../core/math';
import { CELEBRATION_TIMING } from '../goal/GoalCelebration';
import { MISS_LABEL } from '../goal/GoalDetector';
import { formatScore, roundRect, signText, text, tileStar, wrapText } from '../rendering/DrawUtils';
import { C, FONT, rgba } from '../rendering/Palette';

const CARD_W = 440;
const CARD_PAD = 26;
const LINE_H = 30;
/** Gap between the alley wall and a plaque. */
const PLAQUE_GAP = 46;

/**
 * Everything written on screen during play, drawn on the canvas in steady world units.
 * The fixed panels are blue enamel street plaques, like the ones on every corner of the
 * quarter. On small screens each piece is enlarged by the camera's `hudScale`.
 */
export class Hud {
  private hintLines: string[] | null = null;
  private hintWidth = 0;
  /**
   * The free strip under the left-hand plaque, in world units: where it starts and how wide
   * it is. The duel puts its cards there when the window is wide.
   */
  readonly column = { x: 0, y: 0, w: 0 };

  /** Text measurements are stale after a font loads or the level changes. */
  invalidate(): void {
    this.hintLines = null;
  }

  draw(ctx: CanvasRenderingContext2D, g: Game): void {
    const cam = g.camera;
    const u = cam.hudScale;
    const { arena } = g.level.def;
    const arenaRight = arena.x + arena.w;
    // Landscape: beside the alley. Portrait: above the goal, narrower so two fit side by side.
    const w = cam.portrait ? Math.min(250, (arena.w / 2 - 8) / u) : 250;
    const left = cam.portrait ? arena.x : arena.x - PLAQUE_GAP - w * u;
    const right = cam.portrait ? arenaRight : arenaRight + PLAQUE_GAP + w * u;
    // On a tall phone there is spare room above the frame: the plaques move up into it, clear of the goal.
    const top = cam.portrait ? Math.max(cam.visible.y + 14, arena.y - 475) : arena.y + 14;

    ctx.save();
    ctx.translate(left, top);
    ctx.scale(u, u);
    const leftH = this.drawLevelPlaque(ctx, g, w);
    ctx.restore();
    this.column.x = left;
    this.column.y = top + (leftH + 18) * u;
    this.column.w = w * u;

    ctx.save();
    ctx.translate(right - w * u, top);
    ctx.scale(u, u);
    if (g.duelScore) this.drawDuelPlaque(ctx, g.duelScore, w);
    else this.drawScorePlaque(ctx, g, w);
    ctx.restore();

    if (!cam.portrait && !g.input.pointer.touch && !g.duelScore) {
      ctx.save();
      ctx.translate(left, top + (leftH + 18) * u);
      ctx.scale(u, u);
      this.drawKeys(ctx, g, w);
      ctx.restore();
    }
    if (g.state === 'menu') return;

    if (g.level.index === 0 && g.record.goals === 0 && (g.state === 'ready' || g.state === 'aiming')) this.drawPrompt(ctx, g, u);
    if (g.state === 'missed') this.drawMiss(ctx, g, u);
    if (g.banner && g.banner.t < g.banner.dur) this.drawBannerText(ctx, g, u);
    if (g.celebration.active) {
      this.drawCard(ctx, g, u);
      this.drawBanner(ctx, g);
    }
  }

  /** A blue enamel plaque with its white inner line and a soft shadow. */
  private plaque(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    roundRect(ctx, 6, 7, w, h, 14);
    ctx.fillStyle = rgba(C.shadow, 0.3);
    ctx.fill();
    roundRect(ctx, 0, 0, w, h, 14);
    ctx.fillStyle = C.blue;
    ctx.fill();
    roundRect(ctx, 6, 6, w - 12, h - 12, 9);
    ctx.strokeStyle = rgba(C.white, 0.9);
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawLevelPlaque(ctx: CanvasRenderingContext2D, g: Game, w: number): number {
    const def = g.level.def;
    const inner = w - 44;
    ctx.font = `500 11.5px ${FONT}`;
    if (!this.hintLines || this.hintWidth !== inner) {
      this.hintLines = wrapText(ctx, tr(def.hint), inner);
      this.hintWidth = inner;
    }
    const h = 108 + this.hintLines.length * 17;
    this.plaque(ctx, w, h);

    const i = g.level.index;
    const chapter = i < 0 ? 'DUEL' : i < 12 ? tr('THE HOUMA') : i < 24 ? tr('NEW GROUNDS') : i < 36 ? tr('CRAZY LEAGUE') : i < 48 ? tr('LEGENDS') : i < 60 ? tr('STREET KINGS') : i < 72 ? tr('NIGHT LEAGUE') : i < 84 ? tr('GOLDEN HOUR') : i < 96 ? tr('HALL OF FAME') : tr('THE FINALS');
    // "Houma" is the neighbourhood; each of its hundred streets gets a number.
    text(ctx, g.hudLabel ?? `${chapter} · ${tr('HOUMA {n}', { n: String(g.level.index + 1).padStart(2, '0') })}`, 22, 32, { size: 10, color: C.sun, spacing: 2 });
    // The name shrinks to fit rather than wrapping.
    let size = 25;
    ctx.font = `900 ${size}px ${FONT}`;
    const measured = ctx.measureText(tr(def.name)).width;
    if (measured > inner) size = Math.max(13, (size * inner) / measured);
    text(ctx, def.name, 22, 64, { size, color: C.white });
    this.hintLines.forEach((line, i) => text(ctx, line, 22, 88 + i * 17, { size: 11.5, color: rgba(C.white, 0.82), weight: 500 }));
    // Attempts under the hint: proof of effort.
    const rec = g.record;
    if (rec.attempts > 0) text(ctx, `◉ ${rec.attempts} · ◎ ${rec.goals}`, 22, 92 + this.hintLines.length * 17, { size: 10, color: rgba(C.white, 0.6), weight: 700, spacing: 1.5 });
    return h;
  }

  private drawScorePlaque(ctx: CanvasRenderingContext2D, g: Game, w: number): void {
    const [two, three] = g.level.def.stars;
    const rec = g.record;
    this.plaque(ctx, w, 196);
    const r = w - 22;
    text(ctx, 'BEST', r, 36, { size: 12, color: C.sun, align: 'right', spacing: 3 });
    text(ctx, formatScore(rec.best), r, 76, { size: 32, color: C.white, align: 'right' });

    // Stars earned on this alley: filled in yellow, otherwise just an outline.
    for (let i = 0; i < 3; i++) {
      tileStar(ctx, r - 14 - (2 - i) * 34, 104, 13);
      if (i < rec.stars) {
        ctx.fillStyle = C.sun;
        ctx.fill();
      } else {
        ctx.strokeStyle = rgba(C.white, 0.5);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    const next = rec.stars >= 3 ? 0 : rec.stars === 1 ? two : rec.stars === 2 ? three : two;
    const goalLine = rec.stars >= 3 ? 'ALL THREE STARS' : rec.stars === 0 ? 'SCORE FOR A STAR' : tr('NEXT STAR {n}', { n: formatScore(next) });
    text(ctx, goalLine, r, 140, { size: 10.5, color: rgba(C.white, 0.85), align: 'right', weight: 700, spacing: 1.5 });
    // Progress bar to the next star.
    if (rec.stars < 3 && next > 0) {
      const pct = Math.min(1, rec.best / next);
      const bw = w - 44;
      const bx = 22;
      const by = 150;
      roundRect(ctx, bx, by, bw, 8, 4);
      ctx.fillStyle = rgba(C.white, 0.25);
      ctx.fill();
      if (pct > 0) {
        roundRect(ctx, bx, by, Math.max(8, bw * pct), 8, 4);
        ctx.fillStyle = C.sun;
        ctx.fill();
      }
    }
    text(ctx, g.audio.muted ? 'SOUND OFF' : tr('LAST {n}', { n: formatScore(g.lastScore) }), r, 180, { size: 10.5, color: rgba(C.white, 0.6), align: 'right', weight: 700, spacing: 1.5 });
  }

  /**
   * The duel scoreboard. It is a white plaque, unlike the others, so that both players'
   * colours show on it: the score in two colours, and under each name a mark for every round.
   */
  private drawDuelPlaque(ctx: CanvasRenderingContext2D, score: DuelScore, w: number): void {
    const h = 146;
    roundRect(ctx, 6, 7, w, h, 14);
    ctx.fillStyle = rgba(C.shadow, 0.3);
    ctx.fill();
    roundRect(ctx, 0, 0, w, h, 14);
    ctx.fillStyle = C.white;
    ctx.fill();
    roundRect(ctx, 6, 6, w - 12, h - 12, 9);
    ctx.strokeStyle = rgba(C.navy, 0.25);
    ctx.lineWidth = 2;
    ctx.stroke();

    const r = w - 22;
    const goals = (list: readonly (boolean | null)[]): number => list.filter((v) => v === true).length;
    text(ctx, 'DUEL', 22, 38, { size: 12, color: C.navy, spacing: 3 });

    // The score, each number in its owner's colour.
    const theirs = String(goals(score.theirs));
    const mine = String(goals(score.mine));
    ctx.font = `900 26px ${FONT}`;
    const tw = ctx.measureText(theirs).width;
    const cw = ctx.measureText(' : ').width;
    text(ctx, theirs, r, 43, { size: 26, color: score.theirColor, align: 'right' });
    text(ctx, ' : ', r - tw, 41, { size: 26, color: rgba(C.navy, 0.5), align: 'right' });
    text(ctx, mine, r - tw - cw, 43, { size: 26, color: score.mineColor, align: 'right' });

    const rows: ReadonlyArray<readonly [string, readonly (boolean | null)[], string]> = [
      ['YOU', score.mine, score.mineColor],
      [score.opponent.slice(0, 14), score.theirs, score.theirColor],
    ];
    rows.forEach(([label, list, color], row) => {
      const y = 66 + row * 38;
      roundRect(ctx, 20, y - 9, 12, 12, 4);
      ctx.fillStyle = color;
      ctx.fill();
      text(ctx, label, 38, y + 1, { size: 9.5, color: C.navy, weight: 900, spacing: 1.2 });
      // One mark per round, spread across the plaque.
      const step = (r - 22 - 12) / Math.max(1, list.length - 1);
      list.forEach((result, k) => {
        const x = 28 + k * step;
        const my = y + 16;
        ctx.beginPath();
        ctx.arc(x, my, 6.5, 0, Math.PI * 2);
        if (result === true) {
          ctx.fillStyle = color;
          ctx.fill();
          // A tick as well as the colour, so a goal never depends on colour alone.
          ctx.strokeStyle = C.white;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x - 3.2, my);
          ctx.lineTo(x - 0.8, my + 2.8);
          ctx.lineTo(x + 3.6, my - 2.8);
          ctx.stroke();
        } else {
          ctx.strokeStyle = rgba(C.navy, result === false ? 0.75 : 0.22);
          ctx.lineWidth = 1.8;
          ctx.stroke();
          if (result === false) {
            ctx.beginPath();
            ctx.moveTo(x - 2.8, my - 2.8);
            ctx.lineTo(x + 2.8, my + 2.8);
            ctx.moveTo(x + 2.8, my - 2.8);
            ctx.lineTo(x - 2.8, my + 2.8);
            ctx.stroke();
          } else if (k === score.round) {
            // The round being played now.
            ctx.fillStyle = rgba(C.sun, 0.95);
            ctx.beginPath();
            ctx.arc(x, my, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });
    });
  }

  /** A line the duel wants to shout: "YOUR TRAP HELD!", "TOO TIGHT". */
  private drawBannerText(ctx: CanvasRenderingContext2D, g: Game, u: number): void {
    const banner = g.banner;
    if (!banner) return;
    const { arena } = g.level.def;
    const t = banner.t;
    const size = 44 * Math.min(u, 1.3);
    ctx.font = `900 ${size}px ${FONT}`;
    // Long lines shrink to the width of the alley.
    const fit = Math.min(1, (arena.w - 60) / ctx.measureText(banner.text).width);
    const scale = easeOutBack(clamp01(t / 0.18), 2.2) * fit;
    ctx.save();
    ctx.translate(arena.x + arena.w / 2, arena.y + arena.h * 0.56);
    ctx.rotate(-0.04);
    ctx.scale(scale, scale);
    ctx.globalAlpha = clamp01(t / 0.06) * clamp01((banner.dur - t) / 0.4);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    signText(ctx, banner.text, 0, 0, banner.good ? C.sun : C.white, C.navy, 6);
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  }

  private drawKeys(ctx: CanvasRenderingContext2D, g: Game, w: number): void {
    const keys: ReadonlyArray<readonly [string, string]> = [
      ['R', 'RETRY'],
      ['ESC', 'PAUSE'],
      ['M', g.audio.muted ? 'SOUND IS OFF' : 'SOUND'],
    ];
    roundRect(ctx, 0, 0, w, 110, 14);
    ctx.fillStyle = rgba(C.white, 0.88);
    ctx.fill();
    keys.forEach(([key, label], i) => {
      const ky = 32 + i * 28;
      const kw = key.length > 1 ? 44 : 26;
      roundRect(ctx, 20, ky - 15, kw, 21, 6);
      ctx.strokeStyle = rgba(C.navy, 0.55);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      text(ctx, key, 20 + kw / 2, ky, { size: 10, color: C.navy, align: 'center', weight: 700 });
      text(ctx, label, 76, ky, { size: 10, color: C.navy, weight: 700, spacing: 1.5 });
    });
  }

  private pill(ctx: CanvasRenderingContext2D, str: string, cx: number, cy: number, size: number, alpha: number): void {
    str = tr(str);
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.letterSpacing = rtl ? '0px' : '1.5px';
    const w = ctx.measureText(str).width + size * 2.2;
    const h = size * 2.3;
    ctx.globalAlpha = alpha;
    roundRect(ctx, cx - w / 2, cy - h / 2, w, h, h / 2);
    ctx.fillStyle = C.navy;
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.sun;
    ctx.fillText(str, cx + 0.75, cy + size * 0.06);
    ctx.globalAlpha = 1;
    ctx.letterSpacing = '0px';
    ctx.textBaseline = 'alphabetic';
  }

  /** The whole tutorial: one line, on the first alley only, that changes with what the player is doing. */
  private drawPrompt(ctx: CanvasRenderingContext2D, g: Game, u: number): void {
    const { arena } = g.level.def;
    const label = g.state === 'ready' ? 'DRAG BACK TO AIM' : g.shot.armed ? 'LET GO TO SHOOT' : 'KEEP PULLING';
    const bob = Math.sin(g.time.elapsed * 4) * 2;
    const size = 13 * u;
    this.pill(ctx, label, arena.x + arena.w / 2, arena.y + arena.h + 30 + size * 1.15 + bob, size, clamp01(g.stateT * 6 + 0.4));
  }

  private drawMiss(ctx: CanvasRenderingContext2D, g: Game, u: number): void {
    const { arena } = g.level.def;
    const t = g.stateT;
    const near = g.missKind !== 'miss';
    const size = (near ? 54 : 46) * Math.min(u, 1.3);
    const scale = easeOutBack(clamp01(t / 0.16), 2.4);
    ctx.save();
    ctx.translate(arena.x + arena.w / 2, arena.y + 230);
    ctx.rotate(near ? -0.05 : 0);
    ctx.scale(scale, scale);
    ctx.globalAlpha = clamp01(t / 0.05);
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    signText(ctx, MISS_LABEL[g.missKind], 0, 0, near ? C.sun : C.white, C.navy, 6);
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  }

  private drawBanner(ctx: CanvasRenderingContext2D, g: Game): void {
    const { arena } = g.level.def;
    const t = g.celebration.t;
    // Slam in oversized, ring once, then step aside for the score card.
    const slam = t < 0.2 ? lerp(2.1, 1, easeOutCubic(t / 0.2)) : 1 + 0.05 * Math.sin((t - 0.2) * 16) * Math.exp(-(t - 0.2) * 6);
    const settle = easeOutCubic(clamp01((t - CELEBRATION_TIMING.cardAt + 0.1) / 0.3));
    // On a narrow alley the banner is sized to the alley rather than to the type.
    const fit = Math.min(1, arena.w / 760);
    ctx.save();
    ctx.translate(arena.x + arena.w / 2, lerp(arena.y + 300, arena.y + 172, settle));
    ctx.rotate(-0.06);
    const scale = slam * fit * lerp(1, 0.52, settle);
    ctx.scale(scale, scale);
    ctx.globalAlpha = clamp01(t / 0.05);
    ctx.font = `900 150px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    signText(ctx, 'GOAL!', 0, 0, C.sun, C.navy, 12, C.blue);
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  }

  /** The result card: every style bonus, the combo, the Crazy Score counting up, and the stars. */
  private drawCard(ctx: CanvasRenderingContext2D, g: Game, u: number): void {
    const cel = g.celebration;
    const card = cel.card;
    if (!card) return;
    const appear = clamp01((cel.t - CELEBRATION_TIMING.cardAt) / 0.22);
    if (appear <= 0) return;

    const { arena } = g.level.def;
    const cx = arena.x + arena.w / 2;
    const n = card.lines.length;
    const hasCombo = card.bounces > 0;
    const h = 58 + n * LINE_H + (hasCombo ? 42 : 0) + 164;
    // The card is laid out at its natural size around (cx, cy) and enlarged as one piece.
    const cy = arena.y + 232 + (h * u) / 2;
    const x = cx - CARD_W / 2;
    const y = cy - h / 2;
    const inner = x + CARD_PAD;
    const innerR = x + CARD_W - CARD_PAD;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.012);
    const pop = lerp(0.84, 1, easeOutBack(appear)) * u;
    ctx.scale(pop, pop);
    ctx.translate(-cx, -cy);
    ctx.globalAlpha = appear;

    roundRect(ctx, x + 8, y + 10, CARD_W, h, 22);
    ctx.fillStyle = rgba(C.shadow, 0.35);
    ctx.fill();
    roundRect(ctx, x, y, CARD_W, h, 22);
    ctx.fillStyle = C.white;
    ctx.fill();
    ctx.strokeStyle = C.blue;
    ctx.lineWidth = 4;
    ctx.stroke();

    text(ctx, 'CRAZY SCORE', inner, y + 36, { size: 12, color: C.blue, spacing: 3 });
    text(ctx, tr('{n} M', { n: card.metres }), innerR, y + 36, { size: 12, color: rgba(C.navy, 0.55), align: 'right', weight: 700, spacing: 1 });
    ctx.fillStyle = rgba(C.blue, 0.2);
    ctx.fillRect(inner, y + 48, CARD_W - CARD_PAD * 2, 2);

    for (let i = 0; i < n; i++) {
      const age = cel.lineAge(i);
      if (age < 0) continue;
      const a = clamp01(age / 0.14);
      const slide = (1 - easeOutCubic(a)) * 22;
      const ly = y + 58 + i * LINE_H + 22;
      const line = card.lines[i];
      text(ctx, line.label, inner - slide, ly, { size: 15, color: C.navy, alpha: a * appear });
      text(ctx, `+${formatScore(line.points)}`, innerR, ly, { size: 15, color: C.terra, align: 'right', alpha: a * appear });
    }

    const tail = clamp01(cel.lineAge(n) / 0.15) * appear;
    let ty = y + 58 + n * LINE_H + 10;
    if (hasCombo && tail > 0) {
      ctx.globalAlpha = tail;
      roundRect(ctx, inner - 8, ty, CARD_W - CARD_PAD * 2 + 16, 30, 9);
      ctx.fillStyle = rgba(C.blue, 0.13);
      ctx.fill();
      text(ctx, tr('x{n} CRAZY COMBO', { n: card.combo }), inner + 4, ty + 21, { size: 13, color: C.blue, spacing: 1, alpha: tail });
      text(ctx, `x${card.multiplier.toFixed(2)}`, innerR - 4, ty + 21, { size: 13, color: C.navy, align: 'right', alpha: tail });
    }
    if (hasCombo) ty += 42;

    if (tail > 0) {
      text(ctx, formatScore(cel.shownTotal), cx, ty + 62, { size: 52, color: C.blue, align: 'center', alpha: tail });
      // Three tile stars, each landing with a pop.
      for (let i = 0; i < 3; i++) {
        const sx = cx + (i - 1) * 52;
        const sy = ty + 100;
        const age = i < card.stars ? cel.starAge(i) : -1;
        ctx.globalAlpha = tail;
        if (age >= 0) {
          tileStar(ctx, sx, sy, 20 * easeOutBack(clamp01(age / 0.22), 3));
          ctx.fillStyle = C.sun;
          ctx.fill();
          ctx.strokeStyle = C.sunDark;
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          tileStar(ctx, sx, sy, 18);
          ctx.strokeStyle = rgba(C.navy, 0.22);
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      const sub = card.newBest ? 'NEW BEST' : tr('BEST {n}', { n: formatScore(card.previousBest) });
      text(ctx, sub, cx, ty + 138, { size: 11, color: card.newBest ? C.terra : rgba(C.navy, 0.5), align: 'center', weight: 700, spacing: 3, alpha: tail });
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
