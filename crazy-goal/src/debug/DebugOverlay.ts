import type { Game } from '../core/Game';
import { TAU } from '../core/math';

/** F3 in development builds: live numbers, plus the real collision shapes over the art. */
export class DebugOverlay {
  enabled = false;

  toggle(): void {
    this.enabled = !this.enabled;
  }

  drawWorld(ctx: CanvasRenderingContext2D, g: Game): void {
    ctx.lineWidth = 1.5;
    for (const b of [...g.level.world.statics, ...g.level.world.movers]) {
      if (b.layer === 0) continue;
      ctx.strokeStyle = b.surface === 'net' ? '#ff5fd2' : '#00e5ff';
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      ctx.beginPath();
      if (b.shape.kind === 'circle') ctx.arc(0, 0, b.shape.r, 0, TAU);
      else ctx.rect(-b.shape.hw, -b.shape.hh, b.shape.hw * 2, b.shape.hh * 2);
      ctx.stroke();
      ctx.restore();
    }
    const goal = g.level.goal;
    ctx.strokeStyle = '#ffe14a';
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(goal.leftPostX, goal.backY - 4, goal.rightPostX - goal.leftPostX, goal.lineY - 6 - (goal.backY - 4));
    ctx.setLineDash([]);

    const b = g.ball.body;
    ctx.strokeStyle = '#ff3b3b';
    ctx.beginPath();
    ctx.arc(b.x, b.y, g.ball.radius, 0, TAU);
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x + b.vx * 0.1, b.y + b.vy * 0.1);
    ctx.stroke();
  }

  drawScreen(ctx: CanvasRenderingContext2D, g: Game, dpr: number): void {
    const b = g.ball.body;
    const lines = [
      `fps ${g.loop.fps.toFixed(0)}  time x${g.time.scale.toFixed(2)}`,
      `state ${g.state}${g.paused ? ' (paused)' : ''}  level ${g.level.def.id}`,
      `bodies ${g.level.world.statics.length + 1}  contacts ${g.level.world.contactCount}`,
      `ball ${b.x.toFixed(1)}, ${b.y.toFixed(1)}`,
      `vel ${b.vx.toFixed(0)}, ${b.vy.toFixed(0)}  speed ${g.ball.speed.toFixed(0)}  spin ${b.angVel.toFixed(1)}`,
      `power ${(g.shot.power * 100).toFixed(0)}%  launch ${g.shot.speed.toFixed(0)}`,
      `bounces ${g.analyzer.bounces}  particles ${g.particles.active}`,
      `goal ${g.state === 'goal' ? 'SCORED' : 'open'}  best ${g.record.best}  movers ${g.level.world.movers.length}`,
    ];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(10, 10, 330, lines.length * 17 + 14);
    ctx.font = '12px ui-monospace, Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#b6ff5a';
    lines.forEach((line, i) => ctx.fillText(line, 18, 18 + i * 17));
    ctx.textBaseline = 'alphabetic';
  }
}
