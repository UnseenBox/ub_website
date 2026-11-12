import type { Game, ShotPath } from '../core/Game';
import { clamp01, easeOutCubic, smoothstep, TAU } from '../core/math';
import { Tyre, TYRE_RADIUS } from '../mechanics/Tyre';
import { BOOST_TRAIL, drawBoostOver, drawBoostUnder, drawMagnetField, drawScorch, drawSmoke } from './AbilityArt';
import { drawAimGround, drawAimOver, drawTutorialGhost } from './AimArt';
import { drawBlock, drawBoundaryJoint, paintBackdrop, paintStaticShadows } from './ArenaArt';
import { drawBall, drawBallAura, drawBallShadow, drawTrail } from './BallArt';
import { drawCoin } from './CoinArt';
import { drawTag } from './DuelArt';
import type { Camera, ViewRect } from './Camera';
import { drawGoalCue, drawGoalFrame, drawNet, paintGoalFloor } from './GoalArt';
import { drawMechanicGround, drawMechanicSolid, paintMechanicShadows } from './MechanicArt';
import { C, rgba, SHADOW_ALPHA } from './Palette';
import { paintStreet, streetPath } from './StreetArt';

/** World units of static scenery kept beyond the screen edge, for shake and zoom to move into. */
const CACHE_MARGIN = 90;
/** Backing stores wider than this cost more fill rate than they are worth. */
const MAX_BACKING_WIDTH = 3200;

/**
 * Draws a frame in layers, back to front:
 *   static layer (rooftops, paving, chalk, goal floor, fixed shadows), cached offscreen
 *   ground level (flat mechanics, last shot's chalk line, goal cue, elastic, trail, ball shadow)
 *   solids, split around the ball so nearer things overlap it
 *   particles, aim UI, popups
 *   HUD, then the debug overlay
 */
export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  private cache: HTMLCanvasElement | null = null;
  private scratch: HTMLCanvasElement | null = null;
  private readonly cacheRect: ViewRect = { x: 0, y: 0, w: 1, h: 1 };
  private dirty = true;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: Camera,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
  }

  /** Matches the backing store to the element's size and the display's pixel density. */
  resize(): void {
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2, MAX_BACKING_WIDTH / w);
    const pw = Math.round(w * dpr);
    const ph = Math.round(h * dpr);
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw;
      this.canvas.height = ph;
    }
    this.camera.resize(w, h, dpr);
    this.dirty = true;
  }

  /** Call when anything in the static layer changed (fonts arrived, level swapped). */
  invalidate(): void {
    this.dirty = true;
  }

  private rebuild(g: Game): void {
    const cam = this.camera;
    const k = cam.scale * cam.dpr;
    // Whole device pixels, so the cached layer lands 1:1 on the screen and stays sharp.
    const marginPx = Math.round(CACHE_MARGIN * k);
    const w = this.canvas.width + marginPx * 2;
    const h = this.canvas.height + marginPx * 2;
    const cache = this.cache ?? document.createElement('canvas');
    cache.width = w;
    cache.height = h;
    const r = this.cacheRect;
    r.x = cam.visible.x - marginPx / k;
    r.y = cam.visible.y - marginPx / k;
    r.w = w / k;
    r.h = h / k;

    const ctx = cache.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(k, 0, 0, k, -r.x * k, -r.y * k);
    paintBackdrop(ctx, r, g.level);
    paintStreet(ctx, g.level);
    paintGoalFloor(ctx, g.level.goal);

    // Shadows are drawn solid on a scratch canvas and laid down in one pass, so where two
    // of them overlap the ground does not get twice as dark.
    const scratch = this.scratch ?? document.createElement('canvas');
    scratch.width = w;
    scratch.height = h;
    const sctx = scratch.getContext('2d');
    if (sctx) {
      sctx.setTransform(k, 0, 0, k, -r.x * k, -r.y * k);
      paintStaticShadows(sctx, g.level);
      paintMechanicShadows(sctx, g.level.mechanics);
      const goal = g.level.goal;
      ctx.save();
      // Only the street takes shadow; the rooftops beyond the walls are higher than the things casting it.
      streetPath(ctx, g.level);
      ctx.rect(goal.leftPostX, goal.backY, goal.rightPostX - goal.leftPostX, goal.depth);
      ctx.clip();
      ctx.globalAlpha = SHADOW_ALPHA;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(scratch, 0, 0);
      ctx.restore();
    }
    this.scratch = scratch;
    this.cache = cache;
    this.dirty = false;
  }

  render(g: Game): void {
    if (this.dirty || !this.cache) this.rebuild(g);
    const ctx = this.ctx;
    const cam = this.camera;
    const { level, ball, shot } = g;
    const goal = level.goal;
    const time = g.time.elapsed;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    cam.applyWorld(ctx);
    if (this.cache) {
      const r = this.cacheRect;
      ctx.drawImage(this.cache, r.x, r.y, r.w, r.h);
    }

    const aiming = g.state === 'aiming';
    const bx = ball.renderX + g.aimDraw.x;
    const by = ball.renderY + g.aimDraw.y;

    // Ground level.
    const look = g.duelLook;
    const boost = g.shownBoost;
    const juice = g.juice;
    // A burning ball stops burning once it has gone through something.
    const lit = boost !== null && !(boost === 'fire' && level.fireSpent) ? boost : null;
    const auraColour = lit ? BOOST_TRAIL[lit] : juice.combo >= 2 ? juice.comboColor() : C.sun;
    // At rest the ball is just a ball; the halo only burns once it is moving or lit.
    const aura = lit
      ? 0.5 + 0.5 * smoothstep(280, 1500, ball.speed)
      : smoothstep(480, 1850, ball.speed) * (0.55 + 0.45 * Math.min(1, juice.combo / 6));
    const trailColour = boost ? BOOST_TRAIL[boost] : juice.combo >= 2 ? juice.comboColor() : C.white;
    for (const m of level.mechanics) {
      drawMechanicGround(ctx, m, time);
      if (m instanceof Tyre && m.gone) drawScorch(ctx, m.x, m.y, TYRE_RADIUS * 2, TYRE_RADIUS * 2, 0);
    }
    for (const b of level.blocks) if (b.gone) drawScorch(ctx, b.x, b.y, b.w, b.h, b.angle);
    if (boost === 'magnet') drawMagnetField(ctx, goal, time, bx, by, level.magnetOn && !aiming && g.state !== 'ready');
    drawPath(ctx, g.lastPath, look ? look.attacker : C.chalk);
    drawGoalCue(ctx, goal, time, g.state === 'ready' || aiming ? 1 : 0.35);
    if (aiming) drawAimGround(ctx, ball, bx, by, shot);
    if (g.coinVisible) drawCoin(ctx, g.coinX, g.coinY, time, g.record.coin);
    drawTrail(ctx, g.trail, ball.radius, trailColour);
    drawBallShadow(ctx, ball, bx, by);

    // Solids. Anything whose base is further up the screen than the ball goes behind it.
    const inGoal = ball.renderY < goal.lineY - 2;
    const sortY = Math.max(ball.renderY, goal.lineY + 1);
    for (const b of level.blocks) if (b.y < sortY && !b.gone) drawBlock(ctx, b);
    for (const j of level.boundaryJoints) if (!j.kerb && j.y < sortY) drawBoundaryJoint(ctx, j);
    for (const m of level.mechanics) if (m.sortY !== null && m.sortY < sortY) drawMechanicSolid(ctx, m, time);
    const patch = look ? look.attacker : g.skin.patch;
    const paintBall = (): void => {
      drawBallAura(ctx, ball, bx, by, auraColour, aura);
      if (lit) drawBoostUnder(ctx, ball, bx, by, lit, time);
      drawBall(ctx, ball, bx, by, patch, g.skin.base);
      if (lit) drawBoostOver(ctx, ball, bx, by, lit, time);
    };
    if (inGoal) paintBall();
    drawNet(ctx, g.net);
    drawGoalFrame(ctx, goal, g.goalFlash, look ? look.defender : C.blue);
    if (!inGoal) paintBall();
    for (const b of level.blocks) if (b.y >= sortY && !b.gone) drawBlock(ctx, b);
    for (const j of level.boundaryJoints) if (!j.kerb && j.y >= sortY) drawBoundaryJoint(ctx, j);
    for (const m of level.mechanics) if (m.sortY !== null && m.sortY >= sortY) drawMechanicSolid(ctx, m, time);

    g.particles.draw(ctx);
    if (aiming) drawAimOver(ctx, ball, bx, by, shot, g.preview, time);
    if (g.state === 'ready' && level.index === 0 && g.record.goals === 0 && g.stateT > 0.5) drawTutorialGhost(ctx, ball, g.stateT - 0.5);
    drawSmoke(ctx, level.def.arena, g.smoke, time);
    g.popups.draw(ctx);
    if (look) {
      // Name tags: whose goal this is, and whose ball.
      drawTag(ctx, look.goalTag, goal.cx, goal.backTopY - 4, look.defender);
      if (look.ballTag && by > goal.lineY + 60 && (g.state === 'ready' || g.state === 'replay')) drawTag(ctx, look.ballTag, bx, by - ball.radius - (lit === 'fire' ? 34 : 4), look.attacker, Math.sin(time * 5) * 2);
    }
    if (g.debug.enabled) g.debug.drawWorld(ctx, g);

    // Screen-space spectacle: speed streaks, combo glow and the goal letterbox, all under the HUD.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Reduced motion keeps the information but takes most of the movement out.
    const motion = juice.reduced ? 0.3 : 1;
    drawSpeedLines(ctx, this.canvas.width, this.canvas.height, juice.speedLines * motion, time);
    drawEdgeGlow(ctx, this.canvas.width, this.canvas.height, juice.edgeGlow * motion, juice.comboColor());
    drawCinematic(ctx, this.canvas.width, this.canvas.height, juice.cinematic);

    cam.applyHud(ctx);
    g.hud.draw(ctx, g);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (juice.flashAlpha > 0.002) {
      ctx.fillStyle = rgba(juice.flashColor, juice.flashAlpha);
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    if (g.goalFlash > 0.5) {
      // One bright frame or two as the ball crosses the line.
      ctx.fillStyle = rgba('#ffffff', (g.goalFlash - 0.5) * 0.7);
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    if (g.debug.enabled) g.debug.drawScreen(ctx, g, cam.dpr);
  }
}

/** Streaks rushing out of the middle of the screen, driven by the speed of the shot. */
function drawSpeedLines(ctx: CanvasRenderingContext2D, w: number, h: number, strength: number, time: number): void {
  if (strength <= 0.01) return;
  const cx = w / 2;
  const cy = h / 2;
  const near = Math.min(w, h) * 0.3;
  const far = Math.hypot(w, h) * 0.58;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 20; i++) {
    const raw = Math.sin(i * 91.7 + 3.1) * 43758.5453;
    const seed = raw - Math.floor(raw);
    const angle = (i / 20) * TAU + seed * 0.22 + Math.sin(time * 0.7 + i) * 0.025;
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    const inner = near + seed * near * 0.55;
    const len = (0.08 + 0.3 * seed) * far * strength;
    const x0 = cx + ca * inner;
    const y0 = cy + sa * inner;
    const x1 = cx + ca * (inner + len);
    const y1 = cy + sa * (inner + len);
    const alpha = (0.06 + 0.22 * seed) * strength;
    // A dark edge under the white keeps the streak visible on pale walls and paving.
    ctx.strokeStyle = rgba(C.ink, alpha * 0.5);
    ctx.lineWidth = (2.4 + 4.6 * seed) * (0.55 + 0.45 * strength);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = rgba(C.white, alpha);
    ctx.lineWidth = (1.1 + 3.2 * seed) * (0.55 + 0.45 * strength);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.restore();
}

/** A coloured halo around the edge of the frame that climbs with the combo. */
function drawEdgeGlow(ctx: CanvasRenderingContext2D, w: number, h: number, strength: number, colour: string): void {
  if (strength <= 0.01) return;
  const cx = w / 2;
  const cy = h / 2;
  const inner = Math.min(w, h) * 0.3;
  const outer = Math.hypot(w, h) * 0.6;
  const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  grad.addColorStop(0, rgba(colour, 0));
  grad.addColorStop(0.6, rgba(colour, 0.035 * strength));
  grad.addColorStop(1, rgba(colour, 0.34 * strength));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // One crisp inner line, so the glow reads as a frame and not just a tint.
  const inset = Math.max(2, Math.min(w, h) * 0.012);
  ctx.strokeStyle = rgba(colour, 0.42 * strength);
  ctx.lineWidth = inset;
  ctx.strokeRect(inset / 2, inset / 2, w - inset, h - inset);
}

/** The goal letterbox: bars slam in as the ball crosses the line and slide away after. */
function drawCinematic(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number): void {
  if (amount <= 0.001) return;
  const t = easeOutCubic(clamp01(amount));
  const bar = (h * 0.16 + 20) * t;
  ctx.fillStyle = C.ink;
  ctx.fillRect(0, 0, w, bar);
  ctx.fillRect(0, h - bar, w, bar);
  ctx.fillStyle = rgba(C.sun, 0.85 * t);
  ctx.fillRect(0, bar - 2, w, 2);
  ctx.fillRect(0, h - bar, w, 2);
}

/** The last shot, chalked where it went. Seeing your miss is how you fix it. */
function drawPath(ctx: CanvasRenderingContext2D, path: ShotPath, color: string): void {
  if (path.count < 2) return;
  const p = path.points;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const tinted = color !== C.chalk;
  ctx.strokeStyle = rgba(color, tinted ? 0.85 : 0.5);
  ctx.lineWidth = tinted ? 5 : 4;
  ctx.setLineDash([3, 13]);
  ctx.beginPath();
  let pen = false;
  for (let i = 0; i < path.count; i++) {
    const x = p[i * 2];
    const y = p[i * 2 + 1];
    if (Number.isNaN(x)) {
      pen = false;
    } else if (!pen) {
      ctx.moveTo(x, y);
      pen = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // A cross where it ended up.
  const ex = p[(path.count - 1) * 2];
  const ey = p[(path.count - 1) * 2 + 1];
  ctx.strokeStyle = rgba(color, tinted ? 0.95 : 0.7);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(ex - 8, ey - 8);
  ctx.lineTo(ex + 8, ey + 8);
  ctx.moveTo(ex + 8, ey - 8);
  ctx.lineTo(ex - 8, ey + 8);
  ctx.stroke();
}
