import type { Game, ShotPath } from '../core/Game';
import { Tyre, TYRE_RADIUS } from '../mechanics/Tyre';
import { BOOST_TRAIL, drawBoostOver, drawBoostUnder, drawMagnetField, drawScorch, drawSmoke } from './AbilityArt';
import { drawAimGround, drawAimOver, drawTutorialGhost } from './AimArt';
import { drawBlock, paintBackdrop, paintGround, paintStaticShadows } from './ArenaArt';
import { drawBall, drawBallShadow, drawTrail } from './BallArt';
import { drawTag } from './DuelArt';
import type { Camera, ViewRect } from './Camera';
import { drawGoalCue, drawGoalFrame, drawNet, paintGoalFloor } from './GoalArt';
import { drawMechanicGround, drawMechanicSolid, paintMechanicShadows } from './MechanicArt';
import { C, rgba, SHADOW_ALPHA } from './Palette';

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
    paintGround(ctx, g.level);
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
      const { arena } = g.level.def;
      const goal = g.level.goal;
      ctx.save();
      // Only the street takes shadow; the rooftops beyond the walls are higher than the things casting it.
      ctx.beginPath();
      ctx.rect(arena.x, arena.y, arena.w, arena.h);
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
    for (const m of level.mechanics) {
      drawMechanicGround(ctx, m, time);
      if (m instanceof Tyre && m.gone) drawScorch(ctx, m.x, m.y, TYRE_RADIUS * 2, TYRE_RADIUS * 2, 0);
    }
    for (const b of level.blocks) if (b.gone) drawScorch(ctx, b.x, b.y, b.w, b.h, b.angle);
    if (boost === 'magnet') drawMagnetField(ctx, goal, time, bx, by, level.magnetOn && !aiming && g.state !== 'ready');
    drawPath(ctx, g.lastPath, look ? look.attacker : C.chalk);
    drawGoalCue(ctx, goal, time, g.state === 'ready' || aiming ? 1 : 0.35);
    if (aiming) drawAimGround(ctx, ball, bx, by, shot);
    drawTrail(ctx, g.trail, ball.radius, boost ? BOOST_TRAIL[boost] : C.white);
    drawBallShadow(ctx, ball, bx, by);

    // Solids. Anything whose base is further up the screen than the ball goes behind it.
    const inGoal = ball.renderY < goal.lineY - 2;
    const sortY = Math.max(ball.renderY, goal.lineY + 1);
    for (const b of level.blocks) if (b.y < sortY && !b.gone) drawBlock(ctx, b);
    for (const m of level.mechanics) if (m.sortY !== null && m.sortY < sortY) drawMechanicSolid(ctx, m, time);
    const patch = look ? look.attacker : g.skin.patch;
    // A burning ball stops burning once it has gone through something.
    const lit = boost !== null && !(boost === 'fire' && level.fireSpent) ? boost : null;
    const paintBall = (): void => {
      if (lit) drawBoostUnder(ctx, ball, bx, by, lit, time);
      drawBall(ctx, ball, bx, by, patch, g.skin.base);
      if (lit) drawBoostOver(ctx, ball, bx, by, lit, time);
    };
    if (inGoal) paintBall();
    drawNet(ctx, g.net);
    drawGoalFrame(ctx, goal, g.goalFlash, look ? look.defender : C.blue);
    if (!inGoal) paintBall();
    for (const b of level.blocks) if (b.y >= sortY && !b.gone) drawBlock(ctx, b);
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

    cam.applyHud(ctx);
    g.hud.draw(ctx, g);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (g.goalFlash > 0.5) {
      // One bright frame or two as the ball crosses the line.
      ctx.fillStyle = rgba('#ffffff', (g.goalFlash - 0.5) * 0.7);
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    if (g.debug.enabled) g.debug.drawScreen(ctx, g, cam.dpr);
  }
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
