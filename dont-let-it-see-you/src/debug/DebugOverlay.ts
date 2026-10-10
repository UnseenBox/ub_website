import { NOISE, VIEW } from '../core/Tuning';
import { TAU } from '../core/Mathx';
import type { LoopStats } from '../core/GameLoop';
import type { CursorController } from '../cursor/CursorController';
import type { Player } from '../player/Player';
import type { Room } from '../world/Room';
import type { NoiseSystem } from '../interactions/NoiseSystem';
import type { ParticleSystem } from '../particles/ParticleSystem';
import { sightFraction } from '../stealth/LineOfSight';
import { PALETTE, circle, cone, withAlpha, type Ctx } from '../rendering/DrawUtils';

export interface DebugInput {
  room: Room;
  cursor: CursorController;
  player: Player;
  noise: NoiseSystem;
  particles: ParticleSystem;
  stats: LoopStats;
  roomTime: number;
  seed: number;
}

/**
 * F3. Everything the awareness model is thinking, drawn on top of the room.
 *
 * This exists because the game's central rule is invisible: without a way to see
 * radii, cones and pressure breakdowns, balancing it would be guesswork. It is
 * stripped from production builds by the import.meta.env.DEV check in Game.
 */
export class DebugOverlay {
  drawWorld(ctx: Ctx, input: DebugInput): void {
    const { room, cursor } = input;

    for (const e of room.enemies) {
      const p = e.profile;

      // Awareness radius and the outer limit of provocation.
      ctx.strokeStyle = withAlpha(PALETTE.eye, 0.22);
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      circle(ctx, e.x, e.y, p.awarenessRadius);
      ctx.stroke();
      ctx.strokeStyle = withAlpha(PALETTE.eye, 0.08);
      circle(ctx, e.x, e.y, p.farRadius);
      ctx.stroke();

      // Gaze cone.
      ctx.fillStyle = withAlpha(PALETTE.warm, 0.05);
      cone(ctx, e.x, e.y, e.facing, p.gazeAngle, p.awarenessRadius);
      ctx.fill();
      ctx.strokeStyle = withAlpha(PALETTE.warm, 0.2);
      cone(ctx, e.x, e.y, e.facing, p.gazeAngle, p.awarenessRadius);
      ctx.stroke();

      // Line of sight to the cursor, stopping where it is blocked.
      const frac = sightFraction(room.blockers, e.x, e.y, cursor.x, cursor.y);
      ctx.strokeStyle = withAlpha(frac >= 1 ? PALETTE.alarm : PALETTE.fogDim, 0.4);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + (cursor.x - e.x) * frac, e.y + (cursor.y - e.y) * frac);
      ctx.stroke();

      // Where it intends to go.
      const tx = e.lureTimer > 0 ? e.lureX : e.lastAttentionX;
      const ty = e.lureTimer > 0 ? e.lureY : e.lastAttentionY;
      ctx.strokeStyle = withAlpha(e.lureTimer > 0 ? PALETTE.warm : PALETTE.eye, 0.6);
      ctx.setLineDash([3, 3]);
      circle(ctx, tx, ty, 7);
      ctx.stroke();
      ctx.setLineDash([]);

      // Awareness bar and state label.
      ctx.fillStyle = withAlpha(PALETTE.void, 0.7);
      ctx.fillRect(e.x - 26, e.y - e.def.height - 26, 52, 14);
      ctx.fillStyle = PALETTE.eye;
      ctx.fillRect(e.x - 25, e.y - e.def.height - 25, 50 * Math.min(1, e.awareness), 4);
      ctx.fillStyle = PALETTE.fog;
      ctx.font = '7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${e.state.current} ${e.awareness.toFixed(2)}`,
        e.x,
        e.y - e.def.height - 15,
      );
      ctx.textAlign = 'left';
    }

    // Noise audibility rings, which is why creatures turn around.
    for (const r of input.noise.ripples) {
      const range = r.level * NOISE.audibleScale;
      ctx.strokeStyle = withAlpha(PALETTE.warm, 0.12 * (1 - r.age / 1.1));
      ctx.setLineDash([2, 6]);
      circle(ctx, r.x, r.y, range);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Cursor history: what a trail-reading creature can see.
    const path = cursor.sensor.path;
    ctx.strokeStyle = withAlpha(PALETTE.cold, 0.4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < path.length; i++) {
      const s = path[i];
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    }
    ctx.stroke();

    // Cursor heading, which is what "pointing" means numerically.
    const d = cursor.sensor.data;
    ctx.strokeStyle = PALETTE.alarm;
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x + d.headingX * 42, d.y + d.headingY * 42);
    ctx.stroke();

    // Player reach.
    ctx.strokeStyle = withAlpha(PALETTE.player, 0.25);
    ctx.setLineDash([2, 4]);
    circle(ctx, input.player.x, input.player.y, 46);
    ctx.stroke();
    ctx.setLineDash([]);

    for (const decoy of cursor.decoys) {
      ctx.strokeStyle = withAlpha(PALETTE.cold, 0.5);
      circle(ctx, decoy.x, decoy.y, 12);
      ctx.stroke();
      ctx.fillStyle = PALETTE.cold;
      ctx.font = '7px monospace';
      ctx.fillText(`${decoy.pattern} p${decoy.potency.toFixed(2)}`, decoy.x + 14, decoy.y);
    }
  }

  drawPanel(ctx: Ctx, input: DebugInput): void {
    const d = input.cursor.sensor.data;
    const lines: string[] = [
      `fps ${input.stats.fps.toFixed(0)}  steps ${input.stats.simStepsLastFrame}  frame ${input.stats.frameMs.toFixed(1)}ms`,
      `room ${input.room.def.id}  seed ${input.seed}  t ${input.roomTime.toFixed(1)}s`,
      `cursor ${d.x.toFixed(0)},${d.y.toFixed(0)}  spd ${d.speed.toFixed(0)}  acc ${d.acceleration.toFixed(0)}`,
      `heading ${d.headingX.toFixed(2)},${d.headingY.toFixed(2)}  dwell ${d.dwellTime.toFixed(2)}s`,
      `intensity ${d.movementIntensity.toFixed(2)}  vis ${d.visibility.toFixed(2)}  noise ${d.noiseLevel.toFixed(1)}`,
      `state ${input.cursor.state}  heat ${input.cursor.heat.toFixed(2)}  clicks ${d.clickCount}`,
      `objects ${input.room.objects.length}  decoys ${input.cursor.decoys.length}  particles ${input.particles.count}`,
      `tension ${input.room.tension.toFixed(2)}  mask ${input.room.noiseMask.toFixed(2)}  dark ${input.room.darkness.toFixed(2)}`,
    ];

    for (const e of input.room.enemies) {
      const r = e.reading;
      lines.push(
        `${e.def.kind} ${e.state.current} aw ${e.awareness.toFixed(2)} p ${r.pressure.toFixed(2)} ` +
          `[prox ${r.proximity.toFixed(2)} point ${r.pointing.toFixed(2)} spd ${r.speed.toFixed(2)} ` +
          `dwell ${r.dwell.toFixed(2)} cone ${r.coneMultiplier.toFixed(2)}] ` +
          `${r.source?.id ?? 'none'}${e.lureTimer > 0 ? ` lure ${e.lureTimer.toFixed(1)}` : ''}`,
      );
    }

    ctx.save();
    ctx.font = '9px monospace';
    ctx.textBaseline = 'top';
    const padding = 6;
    const lineHeight = 11;
    let width = 0;
    for (const l of lines) width = Math.max(width, ctx.measureText(l).width);
    ctx.fillStyle = 'rgba(4,6,10,0.82)';
    ctx.fillRect(6, 6, width + padding * 2, lines.length * lineHeight + padding * 2);
    ctx.strokeStyle = withAlpha(PALETTE.eye, 0.2);
    ctx.strokeRect(6, 6, width + padding * 2, lines.length * lineHeight + padding * 2);
    ctx.fillStyle = PALETTE.fog;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], 6 + padding, 6 + padding + i * lineHeight);
    }

    // A compass rose in the corner showing the cursor's heading at a glance.
    const cx = VIEW.width - 44;
    const cy = 44;
    ctx.strokeStyle = withAlpha(PALETTE.fogDim, 0.4);
    circle(ctx, cx, cy, 20);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.alarm;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + d.headingX * 18, cy + d.headingY * 18);
    ctx.stroke();
    ctx.fillStyle = withAlpha(PALETTE.eye, 0.5);
    const intensityAngle = d.movementIntensity * TAU;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, 20, -Math.PI * 0.5, -Math.PI * 0.5 + intensityAngle);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
