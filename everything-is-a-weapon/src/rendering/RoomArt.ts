import { INK, WALL } from '../core/constants';
import { TAU } from '../core/math';
import type { DoorSpec, RoomDefinition, RoomTheme } from '../gameplay/Room';
import type { Zone } from '../hazards/Zone';
import { hash, roundRectPath, type Ctx } from './draw';

/** How much of the back wall's thickness is drawn as its visible face. */
const FACE = 26;
const DOOR_HALF = 34;

type FloorKind = 'planks' | 'boards' | 'checker' | 'tiles' | 'carpet' | 'concrete';
type DecorKind = 'window' | 'cabinets' | 'bathroom' | 'pegboard';

interface ThemeStyle {
  floor: FloorKind;
  a: string;
  b: string;
  line: string;
  wallTop: string;
  wallFace: string;
  trim: string;
  decor: DecorKind;
}

/** Each kind of room has its own floor, wall colours and what hangs on the back wall. */
const THEMES: Readonly<Record<RoomTheme, ThemeStyle>> = {
  office: { floor: 'planks', a: '#ead9b5', b: '#e2cea4', line: '#cdb688', wallTop: '#2c6e73', wallFace: '#1f4f55', trim: '#3c8a8e', decor: 'window' },
  bedroom: { floor: 'carpet', a: '#e6d6c4', b: '#d9c6b1', line: '#cdb9a2', wallTop: '#5d4c7c', wallFace: '#43365c', trim: '#7d68a3', decor: 'window' },
  living: { floor: 'boards', a: '#e8d0a6', b: '#dec293', line: '#c4a674', wallTop: '#6f7f4a', wallFace: '#526038', trim: '#93a565', decor: 'window' },
  bathroom: { floor: 'tiles', a: '#e4f3f6', b: '#d3ebf0', line: '#ffffff', wallTop: '#4f9aa6', wallFace: '#3a7985', trim: '#8fd0d9', decor: 'bathroom' },
  kitchen: { floor: 'checker', a: '#f6f1e4', b: '#c6e6da', line: '#a8cfc1', wallTop: '#c26a4a', wallFace: '#964a30', trim: '#e08a66', decor: 'cabinets' },
  garage: { floor: 'concrete', a: '#cfcfc8', b: '#c2c2ba', line: '#a9a9a0', wallTop: '#7d8590', wallFace: '#5a616c', trim: '#9aa2ad', decor: 'pegboard' },
};

function paintFloor(ctx: Ctx, w: number, h: number, style: ThemeStyle, seed: number): void {
  ctx.fillStyle = style.a;
  ctx.fillRect(0, 0, w, h);
  switch (style.floor) {
    case 'planks': {
      const plank = 58;
      for (let i = 0, x = 0; x < w; i++, x += plank) {
        if (i % 2 === 1) {
          ctx.fillStyle = style.b;
          ctx.fillRect(x, 0, Math.min(plank, w - x), h);
        }
        ctx.fillStyle = style.line;
        ctx.fillRect(x, 0, 1.5, h);
        const offset = hash(i * 7.7 + seed) * 160;
        for (let y = offset; y < h; y += 190) ctx.fillRect(x, y, Math.min(plank, w - x), 1.5);
      }
      break;
    }
    case 'boards': {
      // wide boards running across the room
      const board = 46;
      for (let i = 0, y = 0; y < h; i++, y += board) {
        if (i % 2 === 1) {
          ctx.fillStyle = style.b;
          ctx.fillRect(0, y, w, Math.min(board, h - y));
        }
        ctx.fillStyle = style.line;
        ctx.fillRect(0, y, w, 1.5);
        const offset = hash(i * 5.3 + seed) * 220;
        for (let x = offset; x < w; x += 260) ctx.fillRect(x, y, 1.5, Math.min(board, h - y));
      }
      break;
    }
    case 'checker': {
      const tile = 60;
      for (let j = 0, y = 0; y < h; j++, y += tile) {
        for (let i = 0, x = 0; x < w; i++, x += tile) {
          if ((i + j) % 2 === 1) {
            ctx.fillStyle = style.b;
            ctx.fillRect(x, y, Math.min(tile, w - x), Math.min(tile, h - y));
          }
        }
      }
      ctx.fillStyle = style.line;
      for (let x = 0; x < w; x += tile) ctx.fillRect(x, 0, 1.5, h);
      for (let y = 0; y < h; y += tile) ctx.fillRect(0, y, w, 1.5);
      break;
    }
    case 'tiles': {
      const tile = 38;
      for (let j = 0, y = 0; y < h; j++, y += tile) {
        for (let i = 0, x = 0; x < w; i++, x += tile) {
          if (hash(i * 3.1 + j * 7.7 + seed) > 0.62) {
            ctx.fillStyle = style.b;
            ctx.fillRect(x, y, Math.min(tile, w - x), Math.min(tile, h - y));
          }
        }
      }
      ctx.fillStyle = style.line;
      for (let x = 0; x < w; x += tile) ctx.fillRect(x - 1, 0, 2.5, h);
      for (let y = 0; y < h; y += tile) ctx.fillRect(0, y - 1, w, 2.5);
      break;
    }
    case 'carpet': {
      // flecked pile: a few hundred short dashes in two tones
      const count = Math.floor((w * h) / 520);
      for (let i = 0; i < count; i++) {
        ctx.fillStyle = i % 3 === 0 ? style.line : style.b;
        const x = hash(i * 1.37 + seed) * w;
        const y = hash(i * 2.91 + seed * 1.7) * h;
        ctx.fillRect(x, y, 3 + hash(i) * 3, 1.6);
      }
      break;
    }
    case 'concrete': {
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = i % 2 === 0 ? style.b : 'rgba(255, 255, 255, 0.16)';
        ctx.beginPath();
        ctx.ellipse(hash(i * 3.3 + seed) * w, hash(i * 5.9 + seed) * h, 70 + hash(i) * 110, 40 + hash(i * 2) * 60, hash(i * 7) * 3, 0, TAU);
        ctx.fill();
      }
      // old oil stains
      ctx.fillStyle = 'rgba(34, 27, 54, 0.1)';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(hash(i * 9.1 + seed) * w, hash(i * 4.7 + seed) * h, 26 + hash(i * 3) * 30, 18 + hash(i * 5) * 16, 0, 0, TAU);
        ctx.fill();
      }
      // cracks
      ctx.strokeStyle = style.line;
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 4; i++) {
        let x = hash(i * 2.7 + seed) * w;
        let y = hash(i * 6.1 + seed) * h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          x += (hash(i * 11 + k) - 0.5) * 70;
          y += (hash(i * 13 + k * 3) - 0.3) * 50;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // hazard stripes along the front edge
      const band = 12;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, h - band, w, band);
      ctx.clip();
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(0, h - band, w, band);
      ctx.fillStyle = '#2a2540';
      for (let x = -band; x < w + band; x += 28) {
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x + 14, h);
        ctx.lineTo(x + 14 + band, h - band);
        ctx.lineTo(x + band, h - band);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      break;
    }
  }
}

/** A window onto 3 a.m.: dark sky, a moon, a couple of stars. */
function nightWindow(ctx: Ctx, x: number, curtains: string | null, seed: number): void {
  const w = 74;
  const top = -FACE + 3;
  const h = FACE - 7;
  ctx.fillStyle = '#16203f';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  roundRectPath(ctx, x - w / 2, top, w, h, 2);
  ctx.fill();
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(x + 16, top + 7, 4.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#16203f';
  ctx.beginPath();
  ctx.arc(x + 18, top + 6, 3.6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(x - 30 + hash(seed + i * 3.3) * 40, top + 3 + hash(seed + i * 1.9) * (h - 7), 1.6, 1.6);
  }
  ctx.strokeStyle = '#fbf6e9';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, top + h);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  roundRectPath(ctx, x - w / 2, top, w, h, 2);
  ctx.stroke();
  if (curtains) {
    ctx.fillStyle = curtains;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + side * (w / 2 + 3), top - 2);
      ctx.lineTo(x + side * (w / 2 - 13), top - 2);
      ctx.quadraticCurveTo(x + side * (w / 2 - 9), top + h * 0.6, x + side * (w / 2 - 17), top + h + 2);
      ctx.lineTo(x + side * (w / 2 + 3), top + h + 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
}

function pictureFrame(ctx: Ctx, x: number, seed: number): void {
  const top = -FACE + 5;
  ctx.fillStyle = '#c98a4b';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.fillRect(x - 15, top, 30, 17);
  ctx.strokeRect(x - 15, top, 30, 17);
  ctx.fillStyle = ['#6d9dc5', '#e56b6f', '#7fb069'][Math.floor(hash(seed) * 3)]!;
  ctx.fillRect(x - 11, top + 3, 22, 11);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(x + 4, top + 7, 2.5, 0, TAU);
  ctx.fill();
}

function cabinets(ctx: Ctx, x: number): void {
  const w = 96;
  const top = -FACE + 2;
  const h = FACE - 7;
  ctx.fillStyle = '#fbf6e9';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  roundRectPath(ctx, x - w / 2, top, w, h, 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (const dx of [-w / 6, w / 6]) {
    ctx.moveTo(x + dx, top);
    ctx.lineTo(x + dx, top + h);
  }
  ctx.stroke();
  ctx.fillStyle = '#e5383b';
  for (const dx of [-w / 3 + 10, -6, w / 3 - 10]) {
    ctx.beginPath();
    ctx.arc(x + dx, top + h / 2, 2, 0, TAU);
    ctx.fill();
  }
}

function towelRail(ctx: Ctx, x: number, seed: number): void {
  const y = -FACE + 9;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 30, y);
  ctx.lineTo(x + 30, y);
  ctx.stroke();
  ctx.strokeStyle = '#cfd8e4';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = ['#ff9ec4', '#f2c14e', '#6fe0c2'][Math.floor(hash(seed) * 3)]!;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.fillRect(x - 16, y - 1, 26, 15);
  ctx.strokeRect(x - 16, y - 1, 26, 15);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillRect(x - 16, y + 9, 26, 2.5);
}

function pegboard(ctx: Ctx, x: number): void {
  const w = 86;
  const top = -FACE + 3;
  const h = FACE - 8;
  ctx.fillStyle = '#c9a877';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.fillRect(x - w / 2, top, w, h);
  ctx.strokeRect(x - w / 2, top, w, h);
  ctx.fillStyle = 'rgba(34, 27, 54, 0.3)';
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 2; j++) ctx.fillRect(x - w / 2 + 6 + i * 9, top + 4 + j * 9, 1.6, 1.6);
  }
  // tool silhouettes: a hammer, a spanner, a saw
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 28, top + 4);
  ctx.lineTo(x - 28, top + h - 3);
  ctx.moveTo(x - 33, top + 5);
  ctx.lineTo(x - 22, top + 5);
  ctx.moveTo(x - 6, top + 4);
  ctx.lineTo(x - 6, top + h - 3);
  ctx.moveTo(x + 12, top + 6);
  ctx.lineTo(x + 34, top + 6);
  ctx.lineTo(x + 30, top + h - 4);
  ctx.lineTo(x + 12, top + 10);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

/**
 * Floor, rug and walls never change during a room, so they are painted once into an
 * offscreen canvas and blitted each frame.
 */
export class RoomArt {
  private cache: HTMLCanvasElement | null = null;
  private cacheKey = '';
  private readonly margin = WALL + 4;

  draw(ctx: Ctx, room: RoomDefinition, pixelScale: number): void {
    const key = `${room.id}:${room.width}x${room.height}@${pixelScale.toFixed(3)}`;
    if (!this.cache || this.cacheKey !== key) {
      this.cache = this.build(room, pixelScale);
      this.cacheKey = key;
    }
    const m = this.margin;
    ctx.drawImage(this.cache, -m, -m, room.width + m * 2, room.height + m * 2);
  }

  private build(room: RoomDefinition, pixelScale: number): HTMLCanvasElement {
    const m = this.margin;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil((room.width + m * 2) * pixelScale));
    canvas.height = Math.max(1, Math.ceil((room.height + m * 2) * pixelScale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    ctx.scale(pixelScale, pixelScale);
    ctx.translate(m, m);
    const { width: w, height: h } = room;
    const theme: RoomTheme = room.theme ?? 'office';
    const style = THEMES[theme];

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    paintFloor(ctx, w, h, style, room.seed);
    ctx.restore();

    if (room.rug) {
      const r = room.rug;
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.fillStyle = r.color;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      roundRectPath(ctx, -r.w / 2, -r.h / 2, r.w, r.h, 10);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 243, 214, 0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      roundRectPath(ctx, -r.w / 2 + 12, -r.h / 2 + 12, r.w - 24, r.h - 24, 6);
      ctx.stroke();
      if (r.w > 180 && r.h > 100) {
        ctx.lineWidth = 2;
        ctx.beginPath();
        roundRectPath(ctx, -r.w / 2 + 22, -r.h / 2 + 22, r.w - 44, r.h - 44, 4);
        ctx.stroke();
      }
      ctx.restore();
    }

    // soft shadow the back wall casts on the floor
    const shadow = ctx.createLinearGradient(0, 0, 0, 28);
    shadow.addColorStop(0, 'rgba(34, 27, 54, 0.28)');
    shadow.addColorStop(1, 'rgba(34, 27, 54, 0)');
    ctx.fillStyle = shadow;
    ctx.fillRect(0, 0, w, 28);

    // walls: top surfaces all round, plus the visible face of the back wall
    ctx.fillStyle = style.wallTop;
    ctx.fillRect(-WALL, -WALL, w + WALL * 2, WALL - FACE);
    ctx.fillRect(-WALL, -WALL, WALL, h + WALL * 2);
    ctx.fillRect(w, -WALL, WALL, h + WALL * 2);
    ctx.fillRect(-WALL, h, w + WALL * 2, WALL);
    ctx.fillStyle = style.wallFace;
    ctx.fillRect(0, -FACE, w, FACE);

    if (theme === 'bathroom') {
      // tiled to the ceiling
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x < w; x += 19) {
        ctx.moveTo(x, -FACE);
        ctx.lineTo(x, 0);
      }
      ctx.moveTo(0, -FACE / 2);
      ctx.lineTo(w, -FACE / 2);
      ctx.stroke();
    } else if (theme === 'garage') {
      // breeze blocks
      ctx.strokeStyle = 'rgba(34, 27, 54, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -FACE / 2);
      ctx.lineTo(w, -FACE / 2);
      for (let x = 0; x < w; x += 44) {
        ctx.moveTo(x, -FACE);
        ctx.lineTo(x, -FACE / 2);
        ctx.moveTo(x + 22, -FACE / 2);
        ctx.lineTo(x + 22, 0);
      }
      ctx.stroke();
    }

    ctx.fillStyle = style.trim;
    ctx.fillRect(0, -4, w, 4);
    ctx.fillRect(-WALL + 5, -WALL + 5, w + WALL * 2 - 10, 3);

    this.decorate(ctx, room, theme, style);

    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.strokeRect(-WALL + 2, -WALL + 2, w + WALL * 2 - 4, h + WALL * 2 - 4);
    ctx.strokeRect(0, 0, w, h);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -FACE);
    ctx.lineTo(w, -FACE);
    ctx.stroke();
    return canvas;
  }

  /** Hangs things on the back wall, keeping clear of doors, sockets and tall furniture. */
  private decorate(ctx: Ctx, room: RoomDefinition, theme: RoomTheme, style: ThemeStyle): void {
    const blocked: Array<{ x: number; half: number }> = [];
    for (const door of [room.entrance, room.exit]) {
      if (door.side === 'top') blocked.push({ x: door.pos, half: DOOR_HALF + 14 });
    }
    for (const zone of room.zones) if (zone.outlet) blocked.push({ x: zone.x, half: 30 });
    for (const object of room.objects) {
      // anything tall standing against the back wall would hide the decoration anyway
      if (object.y < 40 && ['bookshelf', 'fridge'].includes(object.type)) blocked.push({ x: object.x, half: 60 });
    }
    const free = (x: number, half: number): boolean =>
      x - half > 8 && x + half < room.width - 8 && blocked.every((b) => Math.abs(b.x - x) > b.half + half);

    const slots = [0.16, 0.38, 0.62, 0.84];
    slots.forEach((fraction, i) => {
      const x = room.width * fraction;
      const seed = room.seed + i * 17;
      switch (style.decor) {
        case 'window':
          if (i % 2 === 0) {
            if (free(x, 44)) nightWindow(ctx, x, theme === 'office' ? null : theme === 'bedroom' ? '#c96f8a' : '#c9a24f', seed);
          } else if (free(x, 20)) {
            pictureFrame(ctx, x, seed);
          }
          break;
        case 'cabinets':
          if (i === 3) {
            if (free(x, 44)) nightWindow(ctx, x, '#fbf6e9', seed);
          } else if (free(x, 52)) {
            cabinets(ctx, x);
          }
          break;
        case 'bathroom':
          if (i === 1) {
            if (free(x, 44)) nightWindow(ctx, x, null, seed);
          } else if (free(x, 34)) {
            towelRail(ctx, x, seed);
          }
          break;
        case 'pegboard':
          if (i % 2 === 0 && free(x, 48)) pegboard(ctx, x);
          break;
      }
    });
  }
}

/** Doors animate, so they are drawn live on top of the cached room. */
export function drawDoor(ctx: Ctx, room: RoomDefinition, door: DoorSpec, open: number, accent: string, lit: boolean, time: number): void {
  const horizontal = door.side === 'top' || door.side === 'bottom';
  let x: number;
  let y: number;
  let w: number;
  let h: number;
  if (door.side === 'top') {
    x = door.pos - DOOR_HALF;
    y = -WALL + 4;
    w = DOOR_HALF * 2;
    h = WALL - 4;
  } else if (door.side === 'bottom') {
    x = door.pos - DOOR_HALF;
    y = room.height;
    w = DOOR_HALF * 2;
    h = WALL - 4;
  } else if (door.side === 'left') {
    x = -WALL + 4;
    y = door.pos - DOOR_HALF;
    w = WALL - 4;
    h = DOOR_HALF * 2;
  } else {
    x = room.width;
    y = door.pos - DOOR_HALF;
    w = WALL - 4;
    h = DOOR_HALF * 2;
  }

  ctx.fillStyle = '#120f1c';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.fillRect(x, y, w, h);

  // the slab slides away along the wall as the door opens
  const slide = 1 - open;
  ctx.fillStyle = '#8a6240';
  if (horizontal) ctx.fillRect(x, y, w * slide, h);
  else ctx.fillRect(x, y, w, h * slide);
  if (slide > 0.3) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    if (horizontal) ctx.arc(x + w * slide - 8, y + h / 2, 3, 0, TAU);
    else ctx.arc(x + w / 2, y + h * slide - 8, 3, 0, TAU);
    ctx.fill();
  }
  ctx.strokeRect(x, y, w, h);

  // frame accent + status light
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
  const pulse = lit ? 0.6 + 0.4 * Math.sin(time * 6) : 0.25;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = accent;
  ctx.beginPath();
  if (horizontal) ctx.arc(x + w + 10, y + h / 2, 4.5, 0, TAU);
  else ctx.arc(x + w / 2, y - 10, 4.5, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Wall sockets are zones in the simulation; here they get a plate on the back wall. */
export function drawOutlet(ctx: Ctx, zone: Zone, time: number): void {
  const x = zone.x;
  const y = -10;
  ctx.fillStyle = '#fff3d6';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  roundRectPath(ctx, x - 9, y - 7, 18, 14, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.fillRect(x - 4, y - 3, 2, 6);
  ctx.fillRect(x + 2, y - 3, 2, 6);
  // warning bolt above the plate so the hazard reads without colour
  ctx.fillStyle = '#ffd23f';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 1, y - 24);
  ctx.lineTo(x - 4, y - 16);
  ctx.lineTo(x, y - 16);
  ctx.lineTo(x - 1, y - 11);
  ctx.lineTo(x + 4, y - 19);
  ctx.lineTo(x, y - 19);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (hash(Math.floor(time * 9) + zone.seed) > 0.86) {
    ctx.strokeStyle = '#fffbe0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y + 6);
    ctx.lineTo(x + (hash(time) - 0.5) * 12, y + 16);
    ctx.stroke();
  }
}
