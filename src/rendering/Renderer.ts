import { VIEW } from '../core/Tuning';
import { clamp01 } from '../core/Mathx';
import type { LogicalPoint } from '../input/InputManager';
import type { CursorController } from '../cursor/CursorController';
import type { Player } from '../player/Player';
import type { Room } from '../world/Room';
import type { NoiseSystem } from '../interactions/NoiseSystem';
import type { InteractionSystem } from '../interactions/InteractionSystem';
import type { ParticleSystem } from '../particles/ParticleSystem';
import type { Settings } from '../save/SaveManager';
import { Camera } from './Camera';
import { Lighting } from './Lighting';
import { drawCursor, drawDecoy, drawLostCursor } from './CursorArt';
import { PALETTE, circle, halo, withAlpha, type Ctx } from './DrawUtils';
import {
  drawAttentionLine,
  drawBlood,
  drawEnemyBody,
  drawEnemyEye,
  drawFloor,
  drawLightFixtures,
  drawNoise,
  drawObjectBody,
  drawObjectEmissive,
  drawPlayer,
  drawPlayerMarker,
  drawWalls,
} from './SceneArt';

export interface RenderInput {
  room: Room | null;
  player: Player;
  cursor: CursorController;
  noise: NoiseSystem;
  particles: ParticleSystem;
  interactions: InteractionSystem | null;
  settings: Settings;
  time: number;
  /** 0 = fully black, 1 = fully visible. Drives the fade into and out of a room. */
  reveal: number;
  noticeFlash: number;
  debug: boolean;
  cursorLost: boolean;
}

/**
 * Owns the canvas, the device pixel ratio, and the order things are drawn in.
 *
 * The order is the art direction. There are three phases: everything the light
 * touches is painted first in pale greys, then the light map multiplies over it,
 * and only then are the things that make their own light drawn on top. A
 * creature's body goes in phase one and its eye goes in phase three, which is
 * why it reads as a hole in the room with something lit inside it.
 */
export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: Ctx;
  readonly camera = new Camera();
  private readonly lighting = new Lighting();
  private dpr = 1;
  private scale = 1;
  /** Pushed up by scripted blackouts; 0 normally. */
  blackout = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('This browser cannot provide a 2D canvas context.');
    this.ctx = ctx;
    this.resize();
  }

  resize(): void {
    const maxW = Math.max(320, window.innerWidth);
    const maxH = Math.max(240, window.innerHeight);
    const scale = Math.min(maxW / VIEW.width, maxH / VIEW.height);
    this.scale = scale;
    this.dpr = Math.min(2.5, window.devicePixelRatio || 1);

    const cssW = Math.floor(VIEW.width * scale);
    const cssH = Math.floor(VIEW.height * scale);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    const backingW = Math.floor(cssW * this.dpr);
    const backingH = Math.floor(cssH * this.dpr);
    if (this.canvas.width !== backingW || this.canvas.height !== backingH) {
      this.canvas.width = backingW;
      this.canvas.height = backingH;
    }
  }

  toLogical = (clientX: number, clientY: number): LogicalPoint => {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / Math.max(1, rect.width)) * VIEW.width;
    const y = ((clientY - rect.top) / Math.max(1, rect.height)) * VIEW.height;
    const margin = 2;
    const inside =
      clientX >= rect.left - margin &&
      clientX <= rect.right + margin &&
      clientY >= rect.top - margin &&
      clientY <= rect.bottom + margin;
    return { x, y, inside };
  };

  get viewScale(): number {
    return this.scale;
  }

  draw(input: RenderInput): void {
    const ctx = this.ctx;
    const scale = this.scale * this.dpr;

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = PALETTE.void;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    const room = input.room;
    if (!room) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      return;
    }

    ctx.save();
    this.camera.apply(ctx);

    // --- phase one: everything the light is allowed to touch ----------------
    drawFloor(ctx, room);
    drawWalls(ctx, room.walls, room);

    const hovered = input.interactions?.hovered ?? null;
    for (const o of room.objects) {
      if (o.def.art === 'table' || o.def.art === 'block') drawObjectBody(ctx, o, room);
    }
    for (const o of room.objects) {
      if (o.def.art !== 'table' && o.def.art !== 'block') drawObjectBody(ctx, o, room);
    }

    drawPlayer(ctx, input.player, room);
    for (const e of room.enemies) drawEnemyBody(ctx, e);
    input.particles.draw(ctx);

    // --- phase two: the light itself ----------------------------------------
    this.lighting.apply(ctx, room, this.blackout);
    this.lighting.drawBloom(ctx, room, this.blackout);

    // --- phase three: everything that makes its own light -------------------
    drawLightFixtures(ctx, room);
    drawBlood(ctx, room.blood);
    drawNoise(ctx, input.noise.ripples);

    for (const e of room.enemies) {
      if (e.awareness > 0.3) {
        const tx = e.lureTimer > 0 ? e.lureX : e.lastAttentionX;
        const ty = e.lureTimer > 0 ? e.lureY : e.lastAttentionY;
        drawAttentionLine(ctx, e, tx, ty);
      }
    }

    for (const o of room.objects) {
      drawObjectEmissive(ctx, o, hovered === o, input.player.canReach(o.x, o.y, o.def.reachBonus));
    }
    this.drawMirrorReadout(ctx, room);

    for (const e of room.enemies) drawEnemyEye(ctx, e);

    drawPlayerMarker(ctx, input.player, input.time);
    this.drawReachRing(ctx, input);

    for (const decoy of input.cursor.decoys) drawDecoy(ctx, decoy, input.time);

    if (input.cursorLost) {
      drawLostCursor(ctx, input.cursor.x, input.cursor.y, input.time);
    } else {
      drawCursor(ctx, input.cursor, {
        highContrast: input.settings.highContrastCursor,
        reducedEffects: input.settings.reducedEffects,
      });
    }

    ctx.restore();

    // --- phase four: the frame ----------------------------------------------
    this.lighting.drawVignette(ctx, room.tension, input.settings.reducedEffects);
    if (!input.settings.reducedEffects) this.lighting.drawGrain(ctx, 0.035);

    if (input.noticeFlash > 0.01 && !input.settings.reducedEffects) {
      ctx.fillStyle = withAlpha(PALETTE.blood, input.noticeFlash * 0.2);
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }

    if (input.reveal < 1) {
      ctx.fillStyle = withAlpha(PALETTE.void, 1 - clamp01(input.reveal));
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** A faint ring showing how far the body can actually reach. */
  private drawReachRing(ctx: Ctx, input: RenderInput): void {
    const hovered = input.interactions?.hovered;
    if (!hovered || input.player.hidden) return;
    if (!hovered.def.interactable) return;
    if (input.player.canReach(hovered.x, hovered.y, hovered.def.reachBonus)) return;
    ctx.save();
    ctx.setLineDash([2, 7]);
    ctx.strokeStyle = withAlpha(PALETTE.fogDim, 0.35);
    ctx.lineWidth = 1;
    circle(ctx, input.player.x, input.player.y, 46);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * An angled mirror reports the state of every creature in the room, which is
   * how the player buys information without spending attention on it.
   */
  private drawMirrorReadout(ctx: Ctx, room: Room): void {
    for (const o of room.objects) {
      if (o.kind !== 'MIRROR' || o.state !== 'on') continue;
      const slots = room.enemies.length;
      for (let i = 0; i < slots; i++) {
        const e = room.enemies[i];
        const y = o.y - o.h * 0.5 + 8 + (i * (o.h - 16)) / Math.max(1, slots - 1 || 1);
        const tell = clamp01(e.tell);
        const col = tell > 0.8 ? PALETTE.alarm : tell > 0.4 ? PALETTE.warm : PALETTE.eyeDim;
        ctx.fillStyle = withAlpha(col, 0.6 + tell * 0.4);
        circle(ctx, o.x, y, 1.8 + tell * 1.6);
        ctx.fill();
        if (tell > 0.5) halo(ctx, o.x, y, 12, col, 0.25);
      }
    }
  }

  withCamera(fn: (ctx: Ctx) => void): void {
    const ctx = this.ctx;
    const scale = this.scale * this.dpr;
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.camera.apply(ctx);
    fn(ctx);
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  withScreen(fn: (ctx: Ctx) => void): void {
    const ctx = this.ctx;
    const scale = this.scale * this.dpr;
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    fn(ctx);
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
