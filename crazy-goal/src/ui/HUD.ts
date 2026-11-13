import type { DuelScore, Game } from '../core/Game';
import { rtl, tr } from '../core/i18n';
import { clamp01, easeOutBack, easeOutCubic, lerp, TAU } from '../core/math';
import { CELEBRATION_TIMING } from '../goal/GoalCelebration';
import { MISS_LABEL } from '../goal/GoalDetector';
import { formatScore, roundRect, signText, text, wrapText } from '../rendering/DrawUtils';
import { C, FONT, rgba } from '../rendering/Palette';
import { nextStarTarget, starHint } from '../progression/Progression';
import arcadeStarUrl from '../assets/ui/arcade-star.png';
import arcadeCoinUrl from '../assets/ui/arcade-coin.png';

const arcadeStar = new Image();
arcadeStar.src = arcadeStarUrl;
const arcadeCoin = new Image();
arcadeCoin.src = arcadeCoinUrl;

const CARD_W = 440;
const CARD_PAD = 26;
const LINE_H = 30;
/** Extra card height for the next-star line and its hint. */
const NEXT_H = 52;
/** Extra height for the coins-earned line, drawn only when the goal paid something. */
const COINS_H = 28;
/** Extra height for the stars-to-the-next-ball line. */
const BALL_H = 26;
/** Gap between the alley wall and the duel's scoreboard. */
const PLAQUE_GAP = 46;

/**
 * The HUD's glass: a navy pill with a drop below it, a lit rim and a sheen across the top half, so the
 * scoreboard and tips read as raised plates over the pitch, like the buttons round them.
 */
function hudPill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.save();
  roundRect(ctx, x, y + 3, w, h, r);
  ctx.fillStyle = rgba('#000000', 0.3);
  ctx.fill();
  roundRect(ctx, x, y, w, h, r);
  const body = ctx.createLinearGradient(0, y, 0, y + h);
  body.addColorStop(0, rgba('#2a3a6a', 0.96));
  body.addColorStop(1, rgba('#111a33', 0.96));
  ctx.fillStyle = body;
  ctx.fill();
  ctx.clip();
  const sheen = ctx.createLinearGradient(0, y, 0, y + h * 0.5);
  sheen.addColorStop(0, rgba('#ffffff', 0.14));
  sheen.addColorStop(1, rgba('#ffffff', 0));
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, w, h * 0.5);
  ctx.restore();
  ctx.save();
  roundRect(ctx, x + 1, y + 1, w - 2, h - 2, Math.max(0, r - 1));
  ctx.strokeStyle = rgba('#ffffff', 0.24);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/**
 * Everything written on screen during play, drawn on the canvas in steady world units.
 * Solo play keeps the street bare: just the prompts, the miss call and the goal celebration.
 * Duels keep a white board with the running score. On small screens each piece is enlarged
 * by the camera's `hudScale`.
 */
export class Hud {
  /**
   * The duel's cards are pinned beside the alley when the window is wide; this is the
   * spot they hang from, in world units. There is no plaque in the way any more.
   */
  readonly column = { x: 0, y: 0, w: 0 };

  draw(ctx: CanvasRenderingContext2D, g: Game): void {
    const cam = g.camera;
    const u = cam.hudScale;
    const { arena } = g.level.def;
    const arenaRight = arena.x + arena.w;
    // Landscape: beside the alley. Portrait: the duel's white board goes above the goal.
    const w = cam.portrait ? Math.min(250, (arena.w / 2 - 8) / u) : 250;
    const left = cam.portrait ? arena.x : arena.x - PLAQUE_GAP - w * u;
    const right = cam.portrait ? arenaRight : arenaRight + PLAQUE_GAP + w * u;
    // On a tall phone there is spare room above the frame: the duel board moves up into it, clear of the goal.
    const top = cam.portrait ? Math.max(cam.visible.y + 14, arena.y - 475) : arena.y + 14;

    this.column.x = left;
    this.column.y = top + 18 * u;
    this.column.w = w * u;

    if (g.duelScore) {
      ctx.save();
      ctx.translate(right - w * u, top);
      ctx.scale(u, u);
      this.drawDuelPlaque(ctx, g.duelScore, w);
      ctx.restore();
    }

    if (!cam.portrait && !g.input.pointer.touch && !g.duelScore) {
      ctx.save();
      ctx.translate(left, top + 18 * u);
      ctx.scale(u, u);
      this.drawKeys(ctx, g, w);
      ctx.restore();
    }
    if (g.state === 'menu') return;

    if (g.tip && (g.state === 'ready' || g.state === 'aiming') && !g.paused) this.drawTip(ctx, g, u, g.tip.text);
    // What each star needs, in the corner of the screen where nothing else is, and only while aiming.
    if ((g.state === 'ready' || g.state === 'aiming') && !g.paused && g.shotRule === 'free' && g.level.index >= 0 && !g.duel.active && !g.guideDef()) {
      // (A lesson has its coach card up there instead: the stars are for later.)
      const keys = !cam.portrait && !g.input.pointer.touch;
      this.drawTargets(ctx, g, u, left, top + 18 * u + (keys ? (40 + this.keyList(g).length * 28) * u : 0));
    }
    if (g.state === 'missed') this.drawMiss(ctx, g, u);
    if (g.banner && g.banner.t < g.banner.dur) this.drawBannerText(ctx, g, u);
    if (g.state === 'flight') this.drawComboBadge(ctx, g, u);
    if (g.celebration.active) {
      this.drawCard(ctx, g, u);
      this.drawBanner(ctx, g);
    }
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

  /** The keys worth showing: the free-kick keys only where those moves are on offer. */
  private keyList(g: Game): ReadonlyArray<readonly [string, string]> {
    const parts = g.kickParts();
    return [
      ['R', 'RETRY'],
      ['ESC', 'PAUSE'],
      ['M', g.audio.muted ? 'SOUND IS OFF' : 'SOUND'],
      ...(parts.air ? ([['F', 'AIR']] as const) : []),
      ...(parts.bend ? ([['Q E', 'BEND']] as const) : []),
    ];
  }

  private drawKeys(ctx: CanvasRenderingContext2D, g: Game, w: number): void {
    const keys = this.keyList(g);
    hudPill(ctx, 0, 0, w, 26 + keys.length * 28, 14);
    keys.forEach(([key, label], i) => {
      const ky = 32 + i * 28;
      const kw = key.length > 1 ? 44 : 26;
      // Each key a little raised keycap: a dark lip under a pale top.
      roundRect(ctx, 20, ky - 13, kw, 21, 6);
      ctx.fillStyle = rgba('#000000', 0.35);
      ctx.fill();
      roundRect(ctx, 20, ky - 15, kw, 21, 6);
      ctx.fillStyle = '#eef1fa';
      ctx.fill();
      text(ctx, key, 20 + kw / 2, ky, { size: 10, color: C.navy, align: 'center', weight: 900 });
      text(ctx, label, 76, ky, { size: 10, color: rgba(C.white, 0.9), weight: 700, spacing: 1.5 });
    });
  }

  /**
   * The star targets: `★ GOAL · ★★ 1,400 · ★★★ 2,600`, the stars already won on this level lit.
   * A row above the goal on a phone, a small card in the left column beside the alley otherwise.
   */
  private drawTargets(ctx: CanvasRenderingContext2D, g: Game, u: number, left: number, colTop: number): void {
    const cam = g.camera;
    const { arena } = g.level.def;
    const [two, three] = g.level.def.stars;
    const earned = g.record.stars;
    const segs: ReadonlyArray<{ n: number; label: string }> = [
      { n: 1, label: tr('GOAL') },
      { n: 2, label: formatScore(two) },
      { n: 3, label: formatScore(three) },
    ];
    const STAR = 17;
    const FS = 13;
    // The first star not yet won is the one to play for: its chip is lit.
    const next = Math.min(3, earned + 1);
    const drawStars = (n: number, x: number, cy: number, on: boolean): void => {
      ctx.globalAlpha = on ? 1 : 0.4;
      for (let k = 0; k < n; k++) ctx.drawImage(arcadeStar, x + k * (STAR - 3), cy - STAR / 2, STAR, STAR);
      ctx.globalAlpha = 1;
    };
    ctx.save();
    if (!cam.portrait) {
      // A card of three rows in the left column.
      const w = 200;
      const rowH = 32;
      const h = rowH * 3 + 14;
      ctx.translate(left, colTop);
      ctx.scale(u, u);
      hudPill(ctx, 0, 0, w, h, 14);
      segs.forEach((seg, i) => {
        const cy = 7 + rowH * i + rowH / 2;
        const on = earned >= seg.n;
        if (seg.n === next && !on) {
          roundRect(ctx, 6, cy - rowH / 2 + 2, w - 12, rowH - 4, 9);
          ctx.fillStyle = rgba(C.sun, 0.16);
          ctx.fill();
        }
        if (i > 0) {
          ctx.fillStyle = rgba(C.white, 0.1);
          ctx.fillRect(14, cy - rowH / 2, w - 28, 1.5);
        }
        drawStars(seg.n, 16, cy, on);
        text(ctx, seg.label, w - 16, cy + 1, { size: FS, color: on ? C.sun : rgba(C.white, 0.85), align: 'right', baseline: 'middle', weight: 900, spacing: 1 });
      });
    } else {
      // One row, centred above the goal and kept inside the alley's width.
      const GAP = 20;
      const PAD = 18;
      ctx.font = `900 ${FS}px ${FONT}`;
      const widths = segs.map((seg) => seg.n * (STAR - 3) + 3 + 8 + ctx.measureText(seg.label).width);
      const w = widths.reduce((a, b) => a + b, 0) + GAP * 2 + PAD * 2;
      const h = 38;
      const fit = Math.min(1, (arena.w + 90) / (w * u));
      ctx.translate(arena.x + arena.w / 2, Math.max(cam.visible.y + 74 * u, arena.y - 215));
      ctx.scale(u * fit, u * fit);
      hudPill(ctx, -w / 2, -h / 2, w, h, h / 2);
      const order = rtl ? [...segs].reverse() : segs;
      let x = -w / 2 + PAD;
      order.forEach((seg, i) => {
        const on = earned >= seg.n;
        const segW = widths[segs.indexOf(seg)];
        if (seg.n === next && !on) {
          roundRect(ctx, x - GAP / 2 + 3, -h / 2 + 5, segW + GAP - 6, h - 10, (h - 10) / 2);
          ctx.fillStyle = rgba(C.sun, 0.16);
          ctx.fill();
        }
        if (i > 0) {
          ctx.fillStyle = rgba(C.white, 0.14);
          ctx.fillRect(x - GAP / 2 - 0.75, -h / 2 + 10, 1.5, h - 20);
        }
        drawStars(seg.n, x, 0, on);
        const sw = seg.n * (STAR - 3) + 3 + 8;
        text(ctx, seg.label, x + sw, 1, { size: FS, color: on ? C.sun : rgba(C.white, 0.85), baseline: 'middle', weight: 900, spacing: 1 });
        x += segW + GAP;
      });
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';
  }

  /** A one-time scoring tip: up to two lines in a pill under the kerb, until the next shot. */
  private drawTip(ctx: CanvasRenderingContext2D, g: Game, u: number, str: string): void {
    const { arena } = g.level.def;
    const size = 12 * u;
    const maxW = (arena.w + 60) * Math.min(1, 1.15 / Math.max(1, u));
    ctx.font = `900 ${size}px ${FONT}`;
    const lines = wrapText(ctx, tr(str), maxW - size * 2.4);
    const lineH = size * 1.45;
    const w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + size * 2.4);
    const h = lines.length * lineH + size * 1.1;
    const cx = arena.x + arena.w / 2;
    const top = arena.y + arena.h + 10 + Math.sin(g.time.elapsed * 3) * 1.5;
    ctx.globalAlpha = clamp01(g.stateT * 6 + 0.5);
    hudPill(ctx, cx - w / 2, top, w, h, Math.min(h / 2, 18 * u));
    ctx.fillStyle = C.sun;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((line, i) => ctx.fillText(line, cx, top + size * 0.55 + lineH * (i + 0.5)));
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';
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

  /**
   * The live combo ribbon under the kerb. It grows with every counted touch, takes the colour
   * of the climbing combo, and names the last trick while the word is still fresh.
   */
  private drawComboBadge(ctx: CanvasRenderingContext2D, g: Game, u: number): void {
    const juice = g.juice;
    if (juice.combo < 2) return;
    const { arena } = g.level.def;
    const colour = juice.comboColor();
    const label = `x${juice.combo} COMBO`;
    const word = juice.trickT < 1.15 ? juice.trickText : '';
    const pulse = 1 + 0.22 * juice.comboPulse;
    ctx.save();
    ctx.translate(arena.x + arena.w / 2, arena.y + arena.h + 28);
    ctx.rotate(-0.03);
    ctx.scale(u * pulse, u * pulse);
    ctx.font = `900 18px ${FONT}`;
    const labelW = ctx.measureText(label).width;
    ctx.font = `900 11px ${FONT}`;
    const wordW = word ? ctx.measureText(tr(word)).width : 0;
    const w = Math.max(labelW, wordW) + 38;
    const h = word ? 52 : 34;
    roundRect(ctx, -w / 2 + 4, -h / 2 + 5, w, h, 11);
    ctx.fillStyle = rgba(C.shadow, 0.35);
    ctx.fill();
    roundRect(ctx, -w / 2, -h / 2, w, h, 11);
    ctx.fillStyle = rgba(C.ink, 0.94);
    ctx.fill();
    ctx.strokeStyle = rgba(colour, 0.9);
    ctx.lineWidth = 2.5;
    ctx.stroke();
    if (word) text(ctx, juice.trickText, 0, -8, { size: 11, color: juice.trickColor, align: 'center', baseline: 'middle', spacing: 1.5 });
    text(ctx, label, 0, word ? 12 : 1, { size: 18, color: colour, align: 'center', baseline: 'middle', spacing: 1.5 });
    ctx.restore();
    ctx.globalAlpha = 1;
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
    // The hit still rings through the lettering for a moment after the goal.
    const rush = g.juice.goalRush;
    const shake = 7 * rush;
    ctx.save();
    ctx.translate(
      arena.x + arena.w / 2 + Math.sin(t * 63) * shake,
      lerp(arena.y + 300, arena.y + 172, settle) + Math.cos(t * 51) * shake * 0.7,
    );
    ctx.rotate(-0.06 + Math.sin(t * 43) * 0.02 * rush);
    const scale = slam * fit * lerp(1, 0.52, settle);
    ctx.scale(scale, scale);
    ctx.globalAlpha = clamp01(t / 0.05);
    ctx.font = `900 150px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    signText(ctx, 'GOAL!', 0, 0, C.sun, C.greenNight, 12, C.greenHi);
    // The best thing about the goal gets its own line before the score card takes over.
    const headline = g.celebration.card?.headline ?? '';
    const sub = headline && headline !== 'GOAL' ? clamp01((t - 0.18) / 0.12) * clamp01((CELEBRATION_TIMING.cardAt + 0.08 - t) / 0.16) : 0;
    if (sub > 0) {
      ctx.globalAlpha = sub;
      ctx.font = `900 40px ${FONT}`;
      signText(ctx, headline, 0, 116, C.white, C.terraDark, 5);
    }
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  }

  /** The result card: every style bonus, the combo, the Crazy Score counting up, and the stars. */
  private drawCard(ctx: CanvasRenderingContext2D, g: Game, hudU: number): void {
    const cel = g.celebration;
    // The card is enlarged with the HUD on a small screen, but never wider than the screen.
    const u = Math.min(hudU, (g.camera.visible.w * 0.94) / CARD_W);
    const card = cel.card;
    if (!card) return;
    const appear = clamp01((cel.t - CELEBRATION_TIMING.cardAt) / 0.22);
    if (appear <= 0) return;

    const { arena } = g.level.def;
    const cx = arena.x + arena.w / 2;
    const n = card.lines.length;
    const hasCombo = card.bounces > 0;
    // After a solo goal the card says what the next star needs (or that there is nothing left to win).
    const solo = g.shotRule === 'free' && g.level.index >= 0;
    const next = solo ? nextStarTarget(g.level.def, g.record.stars) : null;
    const coins = solo ? g.goalCoins : 0;
    const ballGap = solo ? g.ballGap : null;
    const h = 58 + n * LINE_H + (hasCombo ? 42 : 0) + 164 + (solo ? NEXT_H : 0) + (coins > 0 ? COINS_H : 0) + (ballGap !== null ? BALL_H : 0);
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

    // Chunky arcade cabinet: hard green base edge, white face, dark-green frame.
    roundRect(ctx, x + 8, y + 12, CARD_W, h, 22);
    ctx.fillStyle = rgba(C.greenNight, 0.32);
    ctx.fill();
    roundRect(ctx, x, y + 9, CARD_W, h, 22);
    ctx.fillStyle = C.greenDeep;
    ctx.fill();
    roundRect(ctx, x, y, CARD_W, h, 22);
    ctx.fillStyle = C.white;
    ctx.fill();
    ctx.strokeStyle = C.greenNight;
    ctx.lineWidth = 5;
    ctx.stroke();

    // The marquee band across the top, clipped to the card's rounded shoulders.
    const bandH = 48;
    ctx.save();
    roundRect(ctx, x, y, CARD_W, h, 22);
    ctx.clip();
    const band = ctx.createLinearGradient(0, y, 0, y + bandH);
    band.addColorStop(0, C.greenHi);
    band.addColorStop(0.45, C.greenGame);
    band.addColorStop(1, '#12a53e');
    ctx.fillStyle = band;
    ctx.fillRect(x, y, CARD_W, bandH);
    ctx.globalAlpha = 0.13;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 12;
    for (let sx = x - bandH; sx < x + CARD_W + bandH; sx += 36) {
      ctx.beginPath();
      ctx.moveTo(sx, y + bandH + 6);
      ctx.lineTo(sx + bandH + 6, y - 6);
      ctx.stroke();
    }
    ctx.globalAlpha = appear;
    ctx.strokeStyle = C.greenDeep;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y + bandH);
    ctx.lineTo(x + CARD_W, y + bandH);
    ctx.stroke();
    ctx.restore();

    text(ctx, 'CRAZY SCORE', inner, y + 32, { size: 13, color: '#f4ffe2', spacing: 3 });
    text(ctx, tr('{n} M', { n: card.metres }), innerR, y + 32, { size: 11.5, color: 'rgba(244, 255, 226, 0.85)', align: 'right', weight: 700, spacing: 1 });

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
      ctx.fillStyle = rgba(C.greenGame, 0.16);
      ctx.fill();
      text(ctx, tr('x{n} CRAZY COMBO', { n: card.combo }), inner + 4, ty + 21, { size: 13, color: C.greenNight, spacing: 1, alpha: tail });
      text(ctx, `x${card.multiplier.toFixed(2)}`, innerR - 4, ty + 21, { size: 13, color: C.navy, align: 'right', alpha: tail });
    }
    if (hasCombo) ty += 42;

    if (tail > 0) {
      // The total punches with every score line that lands.
      ctx.save();
      ctx.translate(cx, ty + 62);
      const totalPop = 1 + 0.18 * g.juice.scorePulse;
      ctx.scale(totalPop, totalPop);
      text(ctx, formatScore(cel.shownTotal), 0, 0, { size: 52, color: C.greenDeep, align: 'center', alpha: tail });
      ctx.restore();
      // Three arcade stars, each landing with a pop.
      for (let i = 0; i < 3; i++) {
        const sx = cx + (i - 1) * 52;
        const sy = ty + 100;
        const age = i < card.stars ? cel.starAge(i) : -1;
        if (age >= 0) {
          const starPop = 1 + 0.55 * g.juice.starPulse[i];
          const size = 46 * easeOutBack(clamp01(age / 0.22), 3) * starPop;
          ctx.globalAlpha = tail;
          ctx.drawImage(arcadeStar, sx - size / 2, sy - size / 2, size, size);
          if (g.juice.starPulse[i] > 0.01) {
            ctx.globalAlpha = tail;
            ctx.beginPath();
            ctx.arc(sx, sy, 27 + 18 * g.juice.starPulse[i], 0, TAU);
            ctx.strokeStyle = rgba(C.sun, 0.7 * g.juice.starPulse[i]);
            ctx.lineWidth = 3;
            ctx.stroke();
          }
        } else {
          ctx.globalAlpha = tail * 0.22;
          ctx.drawImage(arcadeStar, sx - 23, sy - 23, 46, 46);
        }
      }
      ctx.globalAlpha = 1;
      const sub = card.newBest ? 'NEW BEST' : tr('BEST {n}', { n: formatScore(card.previousBest) });
      text(ctx, sub, cx, ty + 138, { size: 11, color: card.newBest ? C.terra : rgba(C.navy, 0.5), align: 'center', weight: 700, spacing: 3, alpha: tail });
      let ny = ty + 168;
      if (coins > 0) {
        // What the goal paid: the first clear and any star won for the first time.
        const label = tr('+{n} COINS', { n: coins });
        ctx.font = `900 14px ${FONT}`;
        const lw = ctx.measureText(label).width;
        const x0 = cx - (lw + 26) / 2;
        ctx.globalAlpha = tail;
        ctx.drawImage(arcadeCoin, x0, ny - 12, 22, 22);
        ctx.globalAlpha = 1;
        text(ctx, label, x0 + 30, ny, { size: 14, color: C.terra, baseline: 'middle', weight: 900, alpha: tail });
        ny += COINS_H;
      }
      if (solo) {
        if (next) {
          // `★★ AT 1,400`, then the nudge toward it.
          const label = tr('AT {n}', { n: formatScore(next.target) });
          ctx.font = `900 14px ${FONT}`;
          const lw = ctx.measureText(label).width;
          const sw = next.star * 14 + 4;
          const x0 = cx - (sw + lw) / 2;
          for (let k = 0; k < next.star; k++) ctx.drawImage(arcadeStar, x0 + k * 14, ny - 10, 18, 18);
          text(ctx, label, x0 + sw + 6, ny + 1, { size: 14, color: C.navy, baseline: 'middle', weight: 900, alpha: tail });
          text(ctx, starHint(card), cx, ny + 24, { size: 11, color: C.terra, align: 'center', weight: 700, spacing: 1.5, alpha: tail });
        } else {
          text(ctx, 'PERFECT MATCH', cx, ny + 8, { size: 16, color: C.terra, align: 'center', weight: 900, spacing: 2, alpha: tail });
        }
        if (ballGap !== null) {
          const by = ny + (next ? 52 : 36);
          text(ctx, tr(ballGap === 1 ? '1 STAR TO THE NEXT BALL' : '{n} STARS TO THE NEXT BALL', { n: ballGap }), cx, by, { size: 10.5, color: rgba(C.navy, 0.6), align: 'center', weight: 700, spacing: 1.2, alpha: tail });
        }
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
