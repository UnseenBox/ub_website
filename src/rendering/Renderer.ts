import { VIEW } from '../core/Tuning';
import { clamp01 } from '../core/Mathx';
import type { LogicalPoint } from '../input/InputManager';
import type { CursorController } from '../cursor/CursorController';
import type { Player } from '../player/Player';
import type { Room } from '../world/Room';
import type { WorldObject } from '../world/WorldObject';
import type { NoiseSystem } from '../interactions/NoiseSystem';
import type { InteractionSystem } from '../interactions/InteractionSystem';
import type { ParticleSystem } from '../particles/ParticleSystem';
import type { Settings } from '../save/SaveManager';
import { Camera } from './Camera';
import { Lighting } from './Lighting';
import { drawCursor, drawDecoy, drawLostCursor } from './CursorArt';
import {
  PALETTE,
  circle,
  halo,
  withAlpha,
  type Ctx,
} from './DrawUtils';
import {
  drawAttentionLine,
  drawEnemy,
  drawFloor,
  drawHiddenMarker,
  drawNoise,
  drawObject,
  drawPlayer,
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
  /** Seconds of room time, used for every procedural animation. */
  time: number;
  /** 0 = fully black, 1 = fully visible. Drives the fade into and out of a room. */
  reveal: number;
  /** The beat where a creature has noticed and the world goes quiet. */
  noticeFlash: number;
  debug: boolean;
  cursorLost: boolean;
}

/**
 * Owns the canvas, the device pixel ratio, and the order things are drawn in.
 *
 * The canvas is sized to the 16:9 logical field exactly, so the letterbox is just
 * page background and gameplay coordinates need no translation beyond the camera.
 */
export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: Ctx;
  readonly camera = new Camera();
  private readonly lighting = new Lighting();
  private dpr = 1;
  private scale = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('This browser cannot provide a 2D canvas context.');
    this.ctx = ctx;
    this.resize();
  }

  /** Fit the logical field into the window without ever stretching it. */
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

  /** Map a client point into logical game coordinates. */
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

    drawFloor(ctx, room);
    drawNoise(ctx, input.noise.ripples);
    drawWalls(ctx, room.walls);

    // Props below the characters, so a character can stand in front of furniture.
    const hovered = input.interactions?.hovered ?? null;
    for (const o of room.objects) {
      if (o.def.art === 'table' || o.def.art === 'block') {
        this.object(ctx, o, hovered, input);
      }
    }
    for (const o of room.objects) {
      if (o.def.art !== 'table' && o.def.art !== 'block') {
        this.object(ctx, o, hovered, input);
      }
    }

    this.drawMirrorReadout(ctx, room);

    for (const e of room.enemies) {
      if (e.awareness > 0.3) {
        const tx = e.lureTimer > 0 ? e.lureX : e.lastAttentionX;
        const ty = e.lureTimer > 0 ? e.lureY : e.lastAttentionY;
        drawAttentionLine(ctx, e, tx, ty);
      }
      drawEnemy(ctx, e);
    }

    drawPlayer(ctx, input.player);
    if (input.player.hidden) {
      drawHiddenMarker(ctx, input.player.x, input.player.y, input.time);
    }
    this.drawReachRing(ctx, input);

    input.particles.draw(ctx);

    // Lighting after the scene, cursor after the lighting: attention is the one
    // thing in the room that darkness never dims.
    this.lighting.drawShadows(ctx, room, 0);
    this.lighting.drawGlow(ctx, room);

    for (const decoy of input.cursor.decoys) {
      drawDecoy(ctx, decoy, input.time);
    }

    if (input.cursorLost) {
      drawLostCursor(ctx, input.cursor.x, input.cursor.y, input.time);
    } else {
      drawCursor(ctx, input.cursor, {
        highContrast: input.settings.highContrastCursor,
        reducedEffects: input.settings.reducedEffects,
      });
    }

    ctx.restore();

    this.lighting.drawVignette(ctx, room.tension, input.settings.reducedEffects);

    if (input.noticeFlash > 0.01 && !input.settings.reducedEffects) {
      ctx.fillStyle = withAlpha(PALETTE.alarm, input.noticeFlash * 0.16);
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }

    if (input.reveal < 1) {
      ctx.fillStyle = withAlpha(PALETTE.void, 1 - clamp01(input.reveal));
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  private object(ctx: Ctx, o: WorldObject, hovered: WorldObject | null, input: RenderInput): void {
    const reachable = input.player.canReach(o.x, o.y, o.def.reachBonus);
    drawObject(ctx, o, hovered === o, reachable);
  }

  /** A faint ring showing how far the body can actually reach. */
  private drawReachRing(ctx: Ctx, input: RenderInput): void {
    const hovered = input.interactions?.hovered;
    if (!hovered || input.player.hidden) return;
    if (!hovered.def.interactable) return;
    const reachable = input.player.canReach(hovered.x, hovered.y, hovered.def.reachBonus);
    if (reachable) return;
    ctx.save();
    ctx.setLineDash([2, 6]);
    ctx.strokeStyle = withAlpha(PALETTE.fogDim, 0.3);
    ctx.lineWidth = 1;
    circle(ctx, input.player.x, input.player.y, 46);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * A mirror that has been angled shows the state of every creature in the room,
   * which is how the player gets information without spending attention on it.
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
        ctx.fillStyle = withAlpha(col, 0.5 + tell * 0.5);
        circle(ctx, o.x, y, 1.6 + tell * 1.4);
        ctx.fill();
        if (tell > 0.5) halo(ctx, o.x, y, 10, col, 0.2);
      }
    }
  }

  /** Debug overlays draw in logical space, so they share the camera transform. */
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

  /** Screen-space overlay pass, in logical units but without the camera shake. */
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
