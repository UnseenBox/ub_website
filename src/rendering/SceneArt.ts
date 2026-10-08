import { AWARENESS, VIEW } from '../core/Tuning';
import { TAU, clamp01, type Rect } from '../core/Mathx';
import type { Enemy } from '../enemies/Enemy';
import type { Player } from '../player/Player';
import type { Room } from '../world/Room';
import type { WorldObject } from '../world/WorldObject';
import type { NoiseRipple } from '../interactions/NoiseSystem';
import {
  PALETTE,
  arcMeter,
  circle,
  halo,
  hashNoise,
  roundRect,
  taperedLine,
  withAlpha,
  type Ctx,
} from './DrawUtils';

/** Floor: flat dark slab with a faint tile grid and a little baked-in grain. */
export function drawFloor(ctx: Ctx, room: Room): void {
  ctx.fillStyle = PALETTE.floor;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  ctx.save();
  ctx.strokeStyle = withAlpha(PALETTE.wallEdge, 0.14);
  ctx.lineWidth = 1;
  const tile = 48;
  ctx.beginPath();
  for (let x = tile; x < VIEW.width; x += tile) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, VIEW.height);
  }
  for (let y = tile; y < VIEW.height; y += tile) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(VIEW.width, y + 0.5);
  }
  ctx.stroke();

  // Static grain so the dark has texture without shimmering between frames.
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 220; i++) {
    const n = hashNoise(i * 1.7, i * 3.1);
    const x = n * VIEW.width;
    const y = hashNoise(i * 5.3, i * 0.9) * VIEW.height;
    ctx.fillStyle = n > 0.5 ? PALETTE.wallEdge : PALETTE.void;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  void room;
}

/** Walls: a solid face with a lit top edge, so the room reads as extruded. */
export function drawWalls(ctx: Ctx, walls: readonly Rect[]): void {
  for (const w of walls) {
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = PALETTE.wallTop;
    ctx.fillRect(w.x, w.y, w.w, Math.min(5, w.h));
    ctx.fillStyle = withAlpha(PALETTE.wallEdge, 0.5);
    ctx.fillRect(w.x, w.y + w.h - 2, w.w, 2);
    ctx.fillStyle = withAlpha(PALETTE.void, 0.55);
    ctx.fillRect(w.x, w.y + w.h, w.w, 6);
  }
}

function shadowBlob(ctx: Ctx, x: number, y: number, rx: number, ry: number, alpha: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
  g.addColorStop(0, `rgba(2,3,6,${alpha})`);
  g.addColorStop(1, 'rgba(2,3,6,0)');
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / Math.max(0.001, rx));
  ctx.translate(-x, -y);
  ctx.fillStyle = g;
  circle(ctx, x, y, rx);
  ctx.fill();
  ctx.restore();
}

// --- props -----------------------------------------------------------------

export function drawObject(ctx: Ctx, o: WorldObject, hovered: boolean, reachable: boolean): void {
  if (!o.revealed || o.taken) return;
  const t = o.animPhase;
  const x = o.x;
  const y = o.y;
  const w = o.w;
  const h = o.h;

  shadowBlob(ctx, x, y + h * 0.42, w * 0.6, h * 0.22, 0.4);

  ctx.save();
  switch (o.def.art) {
    case 'switch':
      drawSwitch(ctx, o, x, y, w, h);
      break;
    case 'panel':
      drawPanel(ctx, o, x, y, w, h);
      break;
    case 'lamp':
      drawLamp(ctx, o, x, y, w, h, t);
      break;
    case 'door':
      drawDoor(ctx, o, x, y, w, h);
      break;
    case 'exit':
      drawExit(ctx, o, x, y, w, h, t);
      break;
    case 'button':
      drawButton(ctx, o, x, y, w);
      break;
    case 'key':
      drawKey(ctx, x, y, t);
      break;
    case 'drawer':
      drawDrawer(ctx, o, x, y, w, h);
      break;
    case 'phone':
      drawPhone(ctx, o, x, y, w, h, t);
      break;
    case 'radio':
      drawRadio(ctx, o, x, y, w, h, t);
      break;
    case 'screen':
      drawScreen(ctx, o, x, y, w, h, t);
      break;
    case 'projector':
      drawProjector(ctx, o, x, y, w, h, t);
      break;
    case 'mirror':
      drawMirror(ctx, o, x, y, w, h);
      break;
    case 'clock':
      drawClock(ctx, o, x, y, w, t);
      break;
    case 'fan':
      drawFan(ctx, o, x, y, w, t);
      break;
    case 'vent':
      drawVent(ctx, o, x, y, w, h);
      break;
    case 'locker':
      drawLocker(ctx, o, x, y, w, h);
      break;
    case 'table':
      drawTable(ctx, o, x, y, w, h);
      break;
    case 'chair':
      drawChair(ctx, x, y, w, h);
      break;
    case 'glass':
      drawGlass(ctx, o, x, y, w, h);
      break;
    case 'trinket':
      drawTrinket(ctx, o, x, y, w, h, t);
      break;
    case 'alarm':
      drawAlarm(ctx, o, x, y, w, t);
      break;
    case 'block':
    default:
      drawBlock(ctx, x, y, w, h);
      break;
  }
  ctx.restore();

  if (o.busy) drawProgress(ctx, o);

  if (hovered && o.def.interactable && !o.taken) {
    const col = reachable ? PALETTE.eye : PALETTE.fogDim;
    ctx.save();
    ctx.strokeStyle = withAlpha(col, reachable ? 0.85 : 0.4);
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.lineDashOffset = -t * 14;
    roundRect(ctx, x - w * 0.5 - 4, y - h * 0.5 - 4, w + 8, h + 8, 3);
    ctx.stroke();
    ctx.restore();
  }
}

function body(ctx: Ctx, x: number, y: number, w: number, h: number, r = 2): void {
  roundRect(ctx, x - w * 0.5, y - h * 0.5, w, h, r);
  ctx.fillStyle = PALETTE.prop;
  ctx.fill();
  ctx.strokeStyle = withAlpha(PALETTE.propEdge, 0.8);
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawSwitch(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, h: number): void {
  body(ctx, x, y, w, h, 2);
  const on = o.state === 'on';
  ctx.fillStyle = on ? withAlpha(PALETTE.warm, 0.9) : withAlpha(PALETTE.fogDim, 0.55);
  ctx.fillRect(x - w * 0.22, on ? y - h * 0.34 : y + h * 0.04, w * 0.44, h * 0.3);
  if (on) halo(ctx, x, y, 18, PALETTE.warm, 0.2);
}

function drawPanel(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, h: number): void {
  body(ctx, x, y, w, h, 2);
  ctx.strokeStyle = withAlpha(PALETTE.propEdge, 0.7);
  for (let i = 0; i < 3; i++) {
    const yy = y - h * 0.3 + i * h * 0.3;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.3, yy);
    ctx.lineTo(x + w * 0.3, yy);
    ctx.stroke();
  }
  const on = o.state === 'on';
  ctx.fillStyle = on ? withAlpha(PALETTE.warm, 0.9) : withAlpha(PALETTE.alarm, 0.7);
  circle(ctx, x, y + h * 0.38, 2.4);
  ctx.fill();
}

function drawLamp(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, h: number, t: number): void {
  ctx.strokeStyle = PALETTE.propEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.45);
  ctx.lineTo(x, y - h * 0.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, y - h * 0.1);
  ctx.lineTo(x + w * 0.5, y - h * 0.1);
  ctx.lineTo(x + w * 0.3, y - h * 0.45);
  ctx.lineTo(x - w * 0.3, y - h * 0.45);
  ctx.closePath();
  ctx.fillStyle = o.isOn ? withAlpha(PALETTE.warm, 0.5) : PALETTE.prop;
  ctx.fill();
  ctx.stroke();
  if (o.isOn) halo(ctx, x, y - h * 0.1, 34 + Math.sin(t * 2) * 2, PALETTE.warm, 0.3);
}

function drawDoor(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, h: number): void {
  const open = o.open;
  ctx.save();
  ctx.translate(x, y - h * 0.5);
  ctx.rotate(-open * 1.1);
  roundRect(ctx, -w * 0.5, 0, w, h, 1);
  ctx.fillStyle = PALETTE.wall;
  ctx.fill();
  ctx.strokeStyle = withAlpha(PALETTE.propEdge, 0.9);
  ctx.stroke();
  ctx.fillStyle = withAlpha(PALETTE.propLit, 0.6);
  circle(ctx, w * 0.1, h * 0.55, 1.8);
  ctx.fill();
  ctx.restore();
}

function drawExit(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, h: number, t: number): void {
  const open = o.state === 'open';
  roundRect(ctx, x - w * 0.5, y - h * 0.5, w, h, 2);
  ctx.fillStyle = open ? withAlpha(PALETTE.eye, 0.16) : PALETTE.void;
  ctx.fill();
  ctx.strokeStyle = open ? withAlpha(PALETTE.eye, 0.9) : withAlpha(PALETTE.fogDim, 0.6);
  ctx.lineWidth = open ? 2 : 1;
  ctx.stroke();
  if (open) {
    halo(ctx, x, y, 54 + Math.sin(t * 2.4) * 5, PALETTE.eye, 0.22);
  } else {
    ctx.fillStyle = withAlpha(PALETTE.alarm, 0.75);
    ctx.fillRect(x - 4, y - 2, 8, 5);
    ctx.strokeStyle = withAlpha(PALETTE.alarm, 0.75);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x, y - 2, 3, Math.PI, 0);
    ctx.stroke();
  }
}

function drawButton(ctx: Ctx, o: WorldObject, x: number, y: number, w: number): void {
  circle(ctx, x, y, w * 0.5);
  ctx.fillStyle = PALETTE.prop;
  ctx.fill();
  ctx.strokeStyle = PALETTE.propEdge;
  ctx.stroke();
  circle(ctx, x, y, w * 0.26);
  ctx.fillStyle = o.isOn ? withAlpha(PALETTE.eye, 0.95) : withAlpha(PALETTE.alarm, 0.6);
  ctx.fill();
  if (o.isOn) halo(ctx, x, y, 16, PALETTE.eye, 0.3);
}

function drawKey(ctx: Ctx, x: number, y: number, t: number): void {
  const bob = Math.sin(t * 2) * 1.2;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.strokeStyle = PALETTE.warm;
  ctx.lineWidth = 1.8;
  circle(ctx, -5, 0, 3.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-1.6, 0);
  ctx.lineTo(7, 0);
  ctx.moveTo(4, 0);
  ctx.lineTo(4, 3.4);
  ctx.moveTo(6.6, 0);
  ctx.lineTo(6.6, 2.6);
  ctx.stroke();
  ctx.restore();
  halo(ctx, x, y + bob, 24, PALETTE.warm, 0.3);
}

function drawDrawer(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, h: number): void {
  body(ctx, x, y, w, h, 2);
  const slide = o.open * 8;
  roundRect(ctx, x - w * 0.42, y - h * 0.22 + slide, w * 0.84, h * 0.46, 1);
  ctx.fillStyle = o.open > 0.4 ? PALETTE.void : PALETTE.floorAlt;
  ctx.fill();
  ctx.strokeStyle = withAlpha(PALETTE.propEdge, 0.9);
  ctx.stroke();
  ctx.fillStyle = PALETTE.propLit;
  ctx.fillRect(x - 5, y + h * 0.02 + slide, 10, 2);
}

function drawPhone(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, h: number, t: number): void {
  const ringing = o.state === 'ringing';
  const shake = ringing ? Math.sin(t * 40) * 1.4 : 0;
  ctx.save();
  ctx.translate(shake, 0);
  body(ctx, x, y, w, h, 3);
  ctx.fillStyle = withAlpha(PALETTE.propLit, 0.8);
  roundRect(ctx, x - w * 0.42, y - h * 0.62, w * 0.84, h * 0.4, 3);
  ctx.fill();
  ctx.restore();
  if (ringing) {
    const r = 18 + ((t * 90) % 46);
    ctx.strokeStyle = withAlpha(PALETTE.warm, Math.max(0, 0.6 - r / 70));
    ctx.lineWidth = 1.5;
    circle(ctx, x, y, r);
    ctx.stroke();
    halo(ctx, x, y, 40, PALETTE.warm, 0.3);
  }
}

function drawRadio(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, h: number, t: number): void {
  body(ctx, x, y, w, h, 2);
  ctx.fillStyle = withAlpha(PALETTE.void, 0.8);
  roundRect(ctx, x - w * 0.4, y - h * 0.26, w * 0.44, h * 0.54, 1);
  ctx.fill();
  ctx.strokeStyle = withAlpha(o.isOn ? PALETTE.eye : PALETTE.propEdge, 0.9);
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const bar = o.isOn ? 2 + Math.abs(Math.sin(t * 6 + i)) * 5 : 2;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.34 + i * 5, y + h * 0.2);
    ctx.lineTo(x - w * 0.34 + i * 5, y + h * 0.2 - bar);
    ctx.stroke();
  }
  circle(ctx, x + w * 0.28, y, 3);
  ctx.strokeStyle = o.isOn ? PALETTE.eye : PALETTE.propEdge;
  ctx.stroke();
  if (o.isOn) halo(ctx, x, y, 30, PALETTE.eye, 0.14);
}

function drawScreen(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, h: number, t: number): void {
  body(ctx, x, y, w, h, 2);
  const on = o.isOn;
  const flick = on ? 0.5 + Math.abs(Math.sin(t * 13)) * 0.5 : 0;
  roundRect(ctx, x - w * 0.4, y - h * 0.34, w * 0.8, h * 0.6, 1);
  ctx.fillStyle = on ? withAlpha(PALETTE.cold, 0.35 + flick * 0.3) : PALETTE.void;
  ctx.fill();
  if (on) {
    ctx.strokeStyle = withAlpha(PALETTE.cold, 0.5);
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const yy = y - h * 0.26 + i * h * 0.18 + ((t * 30) % (h * 0.18));
      ctx.beginPath();
      ctx.moveTo(x - w * 0.36, yy);
      ctx.lineTo(x + w * 0.36, yy);
      ctx.stroke();
    }
    halo(ctx, x, y, 56, PALETTE.cold, 0.25);
  }
}

function drawProjector(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, h: number, t: number): void {
  body(ctx, x, y, w, h, 3);
  circle(ctx, x + w * 0.34, y, 4);
  ctx.fillStyle = o.isOn ? withAlpha(PALETTE.cold, 0.9) : PALETTE.void;
  ctx.fill();
  if (o.isOn) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const len = 150;
    ctx.fillStyle = withAlpha(PALETTE.cold, 0.07 + Math.sin(t * 9) * 0.02);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.34, y);
    ctx.lineTo(x + w * 0.34 + len, y - 42);
    ctx.lineTo(x + w * 0.34 + len, y + 42);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    halo(ctx, x, y, 34, PALETTE.cold, 0.2);
  }
}

function drawMirror(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, h: number): void {
  roundRect(ctx, x - w * 0.5, y - h * 0.5, w, h, 2);
  const g = ctx.createLinearGradient(x - w * 0.5, y - h * 0.5, x + w * 0.5, y + h * 0.5);
  g.addColorStop(0, withAlpha(PALETTE.cold, 0.22));
  g.addColorStop(0.5, withAlpha(PALETTE.fog, 0.1));
  g.addColorStop(1, withAlpha(PALETTE.cold, 0.3));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = withAlpha(o.isOn ? PALETTE.eye : PALETTE.propEdge, 0.9);
  ctx.lineWidth = o.isOn ? 1.6 : 1;
  ctx.stroke();
  if (o.isOn) halo(ctx, x, y, 44, PALETTE.eye, 0.14);
}

function drawClock(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, t: number): void {
  circle(ctx, x, y, w * 0.5);
  ctx.fillStyle = PALETTE.prop;
  ctx.fill();
  ctx.strokeStyle = PALETTE.propEdge;
  ctx.stroke();
  if (o.isOn) {
    const a = t * 1.2;
    ctx.strokeStyle = withAlpha(PALETTE.fog, 0.7);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * w * 0.3, y + Math.sin(a) * w * 0.3);
    ctx.stroke();
  }
}

function drawFan(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, t: number): void {
  circle(ctx, x, y, w * 0.5);
  ctx.fillStyle = PALETTE.prop;
  ctx.fill();
  ctx.strokeStyle = PALETTE.propEdge;
  ctx.stroke();
  const spin = o.isOn ? t * 9 : t * 0.2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.strokeStyle = withAlpha(PALETTE.propLit, o.isOn ? 0.5 : 0.8);
  ctx.lineWidth = 2.4;
  for (let i = 0; i < 3; i++) {
    ctx.rotate(TAU / 3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w * 0.36, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawVent(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, h: number): void {
  body(ctx, x, y, w, h, 1);
  ctx.strokeStyle = withAlpha(o.state === 'open' ? PALETTE.void : PALETTE.propEdge, 0.9);
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 4; i++) {
    const yy = y - h * 0.3 + i * h * 0.2;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.36, yy);
    ctx.lineTo(x + w * 0.36, yy);
    ctx.stroke();
  }
  if (o.state === 'open') {
    ctx.fillStyle = withAlpha(PALETTE.void, 0.85);
    ctx.fillRect(x - w * 0.36, y - h * 0.34, w * 0.72, h * 0.68);
  }
}

function drawLocker(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, h: number): void {
  body(ctx, x, y, w, h, 2);
  const openAmt = o.open;
  ctx.fillStyle = withAlpha(PALETTE.void, 0.9 * openAmt);
  ctx.fillRect(x - w * 0.42, y - h * 0.42, w * 0.84, h * 0.84);
  ctx.save();
  ctx.translate(x - w * 0.42, y);
  ctx.rotate(-openAmt * 1.0);
  ctx.fillStyle = PALETTE.prop;
  ctx.fillRect(0, -h * 0.42, w * 0.84, h * 0.84);
  ctx.strokeStyle = withAlpha(PALETTE.propEdge, 0.9);
  ctx.strokeRect(0, -h * 0.42, w * 0.84, h * 0.84);
  ctx.fillStyle = PALETTE.propLit;
  ctx.fillRect(w * 0.7, -3, 3, 7);
  ctx.restore();
  if (o.occupied) {
    ctx.fillStyle = withAlpha(PALETTE.eye, 0.35);
    ctx.fillRect(x - 2, y - h * 0.2, 4, h * 0.4);
  }
}

function drawTable(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, h: number): void {
  roundRect(ctx, x - w * 0.5, y - h * 0.5, w, h, 3);
  ctx.fillStyle = withAlpha(PALETTE.prop, 0.92);
  ctx.fill();
  ctx.strokeStyle = withAlpha(PALETTE.propEdge, 0.85);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = withAlpha(PALETTE.void, 0.5);
  const legs = [
    [x - w * 0.42, y - h * 0.36],
    [x + w * 0.36, y - h * 0.36],
    [x - w * 0.42, y + h * 0.28],
    [x + w * 0.36, y + h * 0.28],
  ];
  for (const [lx, ly] of legs) ctx.fillRect(lx, ly, 6, 8);
  if (o.occupied) {
    ctx.fillStyle = withAlpha(PALETTE.eye, 0.22);
    roundRect(ctx, x - w * 0.3, y - h * 0.22, w * 0.6, h * 0.5, 3);
    ctx.fill();
  }
}

function drawBlock(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  roundRect(ctx, x - w * 0.5, y - h * 0.5, w, h, 2);
  ctx.fillStyle = PALETTE.prop;
  ctx.fill();
  ctx.strokeStyle = withAlpha(PALETTE.propEdge, 0.8);
  ctx.stroke();
  ctx.strokeStyle = withAlpha(PALETTE.wallEdge, 0.4);
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5 + 3, y - h * 0.5 + 3);
  ctx.lineTo(x + w * 0.5 - 3, y - h * 0.5 + 3);
  ctx.stroke();
}

function drawChair(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  roundRect(ctx, x - w * 0.4, y - h * 0.2, w * 0.8, h * 0.6, 2);
  ctx.fillStyle = PALETTE.prop;
  ctx.fill();
  ctx.strokeStyle = PALETTE.propEdge;
  ctx.stroke();
  ctx.fillRect(x - w * 0.4, y - h * 0.5, w * 0.8, 4);
}

function drawGlass(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, h: number): void {
  if (o.state === 'broken') {
    ctx.strokeStyle = withAlpha(PALETTE.cold, 0.45);
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + o.animPhase * 0.1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * w, y + Math.sin(a) * w * 0.6);
      ctx.stroke();
    }
    return;
  }
  roundRect(ctx, x - w * 0.5, y - h * 0.5, w, h, 2);
  ctx.fillStyle = withAlpha(PALETTE.cold, 0.2);
  ctx.fill();
  ctx.strokeStyle = withAlpha(PALETTE.cold, 0.55);
  ctx.stroke();
}

function drawTrinket(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, h: number, t: number): void {
  const bob = Math.sin(t * 1.6) * 1;
  roundRect(ctx, x - w * 0.5, y - h * 0.5 + bob, w, h, 1);
  ctx.fillStyle = withAlpha(PALETTE.warm, 0.25);
  ctx.fill();
  ctx.strokeStyle = withAlpha(PALETTE.warm, 0.7);
  ctx.stroke();
  halo(ctx, x, y + bob, 16, PALETTE.warm, 0.15);
  void o;
}

function drawAlarm(ctx: Ctx, o: WorldObject, x: number, y: number, w: number, t: number): void {
  circle(ctx, x, y, w * 0.5);
  ctx.fillStyle = o.isOn ? withAlpha(PALETTE.alarm, 0.7) : PALETTE.prop;
  ctx.fill();
  ctx.strokeStyle = PALETTE.alarm;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  if (o.isOn) {
    const r = 20 + ((t * 170) % 90);
    ctx.strokeStyle = withAlpha(PALETTE.alarm, Math.max(0, 0.7 - r / 110));
    circle(ctx, x, y, r);
    ctx.stroke();
  }
}

function drawProgress(ctx: Ctx, o: WorldObject): void {
  const w = 26;
  const y = o.y - o.h * 0.5 - 10;
  ctx.fillStyle = withAlpha(PALETTE.void, 0.75);
  ctx.fillRect(o.x - w * 0.5, y, w, 3);
  ctx.fillStyle = PALETTE.eye;
  ctx.fillRect(o.x - w * 0.5, y, w * clamp01(o.progress), 3);
}

// --- the character ---------------------------------------------------------

export function drawPlayer(ctx: Ctx, p: Player): void {
  if (p.hidden) return;
  const breathe = Math.sin(p.breathPhase) * 0.6;
  const swing = Math.sin(p.walkPhase) * 3.4;
  const lean = Math.cos(p.facing) * 1.2;

  shadowBlob(ctx, p.x, p.y + 9, 11, 4, 0.55);
  // A standing pool of light under the character. It is the one thing the player
  // must never lose track of, however dark the room gets.
  halo(ctx, p.x, p.y + 2, 26, PALETTE.player, 0.07);

  ctx.save();
  ctx.translate(p.x, p.y);

  // Legs
  ctx.strokeStyle = withAlpha('#1a2530', 0.95);
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-2, 2);
  ctx.lineTo(-2 + swing * 0.5, 9);
  ctx.moveTo(2, 2);
  ctx.lineTo(2 - swing * 0.5, 9);
  ctx.stroke();

  // Torso: a tapered silhouette, deliberately plain, but rimmed so it reads.
  ctx.fillStyle = p.dead ? withAlpha(PALETTE.alarm, 0.6) : '#44586a';
  taperedLine(ctx, lean * 0.5, -10 + breathe, 0, 4, 5.4, 4);
  ctx.fill();
  ctx.strokeStyle = withAlpha(PALETTE.player, 0.6);
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // Head
  ctx.fillStyle = p.dead ? withAlpha(PALETTE.alarm, 0.5) : '#566c7e';
  circle(ctx, lean * 0.7, -14 + breathe, 4.4);
  ctx.fill();
  ctx.strokeStyle = withAlpha(PALETTE.player, 0.7);
  ctx.stroke();

  if (p.panic > 0.4) {
    halo(ctx, 0, -6, 26, PALETTE.alarm, (p.panic - 0.4) * 0.22);
  }
  ctx.restore();
}

/** A small pale glimmer where a hidden character is, so the player keeps track. */
export function drawHiddenMarker(ctx: Ctx, x: number, y: number, t: number): void {
  const a = 0.18 + Math.sin(t * 2.2) * 0.07;
  halo(ctx, x, y, 16, PALETTE.eye, a);
}

// --- creatures -------------------------------------------------------------

function eyeColor(tell: number, asleep: boolean): string {
  if (asleep) return PALETTE.eyeDim;
  if (tell >= 0.95) return PALETTE.alarm;
  if (tell >= AWARENESS.alert) return '#ff9a5a';
  if (tell >= AWARENESS.investigate) return PALETTE.warm;
  if (tell >= AWARENESS.suspicious) return '#d9e07a';
  return PALETTE.eyeDim;
}

export function drawEnemy(ctx: Ctx, e: Enemy): void {
  const tell = e.tell;
  const asleep = e.looksAsleep && e.state.current === 'IDLE';
  const col = eyeColor(tell, asleep);
  const t = e.animPhase;
  const breathe = Math.sin(t * (asleep ? 0.9 : 1.8 + tell * 3)) * (asleep ? 1.6 : 0.9);
  const h = e.def.height;

  shadowBlob(ctx, e.x, e.y + h * 0.12, e.def.awareness.bodyRadius * 1.4, 5, 0.55);

  ctx.save();
  ctx.translate(e.x, e.y);

  switch (e.def.kind) {
    case 'HOUND':
      drawHound(ctx, e, col, breathe, t);
      break;
    case 'SLEEPER':
      drawSleeper(ctx, e, col, breathe, asleep);
      break;
    case 'MIRROR':
      drawMirrorCreature(ctx, e, col, breathe);
      break;
    case 'SCOUT':
      drawScout(ctx, e, col, breathe, t);
      break;
    case 'PARASITE':
      drawParasite(ctx, e, col, breathe, t);
      break;
    case 'ANALYST':
      drawTall(ctx, e, col, breathe, h, 'analyst');
      break;
    case 'MIMIC':
      drawTall(ctx, e, col, breathe, h, 'mimic');
      break;
    case 'LIAR':
      drawTall(ctx, e, col, breathe, h, 'liar');
      break;
    case 'WATCHER':
    default:
      drawTall(ctx, e, col, breathe, h, 'watcher');
      break;
  }

  ctx.restore();

  // The tell: a thin arc, never a bar. It can lie, and for a Liar it does.
  if (tell > 0.04) {
    arcMeter(ctx, e.x, e.y - e.def.height * 0.75, 15, clamp01(tell), col, 0.55 + tell * 0.4, 2);
  }
  if (e.flinch > 0.02) {
    halo(ctx, e.x, e.y - e.def.height * 0.4, 46, col, e.flinch * 0.18);
  }
}

/** The upright silhouettes. One routine, four different heads. */
function drawTall(
  ctx: Ctx,
  e: Enemy,
  col: string,
  breathe: number,
  h: number,
  variant: 'watcher' | 'liar' | 'mimic' | 'analyst',
): void {
  const sway = Math.sin(e.animPhase * 0.7) * 1.4;
  const top = -h + breathe;

  ctx.fillStyle = '#0a1016';
  taperedLine(ctx, sway * 0.5, top + 12, 0, 8, 9, 13);
  ctx.fill();
  ctx.strokeStyle = withAlpha(col, 0.22);
  ctx.lineWidth = 1;
  ctx.stroke();

  // Thin arms hanging, which lift as it grows alarmed.
  const lift = clamp01(e.tell) * 0.8;
  ctx.strokeStyle = '#0a1016';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-7, top + 20);
  ctx.lineTo(-11 - lift * 5, top + 36 - lift * 12);
  ctx.moveTo(7, top + 20);
  ctx.lineTo(11 + lift * 5, top + 36 - lift * 12);
  ctx.stroke();

  // Head, rotated to the gaze. This is the single most readable thing on screen.
  ctx.save();
  ctx.translate(sway * 0.7, top + 4);
  ctx.rotate(e.facing + Math.PI * 0.5);

  if (variant === 'analyst') {
    ctx.fillStyle = '#0d141b';
    roundRect(ctx, -11, -6, 22, 12, 2);
    ctx.fill();
    ctx.strokeStyle = withAlpha(col, 0.5);
    ctx.stroke();
    ctx.strokeStyle = withAlpha(col, 0.8);
    ctx.lineWidth = 1;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 3, 1);
      ctx.lineTo(i * 3, 5);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#0d141b';
    circle(ctx, 0, 0, 8.5);
    ctx.fill();
    ctx.strokeStyle = withAlpha(col, 0.4);
    ctx.stroke();
  }

  // The aperture: a slit that opens with awareness.
  const open = 1.4 + clamp01(e.tell) * 4.2;
  ctx.fillStyle = col;
  ctx.shadowColor = col;
  ctx.shadowBlur = 10 + clamp01(e.tell) * 18;
  if (variant === 'mimic') {
    // A head shaped like a pointer. Nothing else in the game looks like this.
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.lineTo(-3.4, -5);
    ctx.lineTo(0, -2.6);
    ctx.lineTo(3.4, -5);
    ctx.closePath();
    ctx.fill();
  } else if (variant === 'liar') {
    ctx.fillRect(-5.5, 3.2 - open * 0.5, 4.5, open);
    ctx.globalAlpha = 0.35;
    ctx.fillRect(1, 3.2 - 1.2, 4.5, 2.4);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillRect(-5, 3.4 - open * 0.5, 10, open);
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawHound(ctx: Ctx, e: Enemy, col: string, breathe: number, t: number): void {
  const gait = Math.sin(t * (4 + e.moveSpeedNow * 0.06)) * 3;
  ctx.save();
  ctx.rotate(e.facing);

  ctx.strokeStyle = '#0a1016';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const bx = -10 + (i % 2) * 20;
    const by = i < 2 ? -7 : 7;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + (i % 2 ? gait : -gait), by + 9);
    ctx.stroke();
  }

  ctx.fillStyle = '#0a1016';
  ctx.beginPath();
  ctx.ellipse(0, 0, 21, 9 + breathe * 0.4, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = withAlpha(col, 0.22);
  ctx.lineWidth = 1;
  ctx.stroke();

  // Low head thrust forward, nose first.
  ctx.fillStyle = '#0d141b';
  ctx.beginPath();
  ctx.ellipse(21, 0, 9, 6, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = col;
  ctx.shadowColor = col;
  ctx.shadowBlur = 8 + clamp01(e.tell) * 16;
  ctx.fillRect(24, -1.4 - clamp01(e.tell) * 1.4, 5, 2.8 + clamp01(e.tell) * 2.8);
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawSleeper(ctx: Ctx, e: Enemy, col: string, breathe: number, asleep: boolean): void {
  const rise = asleep ? 0 : 10;
  ctx.fillStyle = '#0a1016';
  ctx.beginPath();
  ctx.ellipse(0, -8 - rise * 0.4, 24, 14 + breathe + rise * 0.5, 0, Math.PI, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, -8 - rise * 0.4, 24, 6, 0, 0, Math.PI);
  ctx.fill();
  ctx.strokeStyle = withAlpha(col, 0.2);
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.save();
  ctx.translate(0, -14 - rise * 0.5);
  ctx.rotate(e.facing + Math.PI * 0.5);
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.8;
  ctx.shadowColor = col;
  ctx.shadowBlur = asleep ? 3 : 12;
  if (asleep) {
    // A closed eye is a line. Trust it at your own risk.
    ctx.beginPath();
    ctx.moveTo(-6, 2);
    ctx.lineTo(6, 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(0, 2, 6, 2.2 + clamp01(e.tell) * 2.4, 0, 0, TAU);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawMirrorCreature(ctx: Ctx, e: Enemy, col: string, breathe: number): void {
  const h = e.def.height;
  ctx.fillStyle = '#080d12';
  taperedLine(ctx, 0, -h + breathe, 0, 6, 5, 9);
  ctx.fill();
  ctx.strokeStyle = withAlpha(col, 0.25);
  ctx.lineWidth = 1;
  ctx.stroke();

  // A razor of attention. When it is on you, you know.
  ctx.save();
  ctx.translate(0, -h * 0.62);
  ctx.rotate(e.facing);
  ctx.fillStyle = col;
  ctx.shadowColor = col;
  ctx.shadowBlur = 12 + clamp01(e.tell) * 26;
  ctx.fillRect(0, -1.1, 15 + clamp01(e.tell) * 16, 2.2);
  circle(ctx, 0, 0, 4.2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawScout(ctx: Ctx, e: Enemy, col: string, breathe: number, t: number): void {
  const h = e.def.height;
  const hop = Math.abs(Math.sin(t * 5)) * (e.moveSpeedNow > 4 ? 2.4 : 0.4);
  ctx.save();
  ctx.translate(0, -hop);
  ctx.strokeStyle = '#0a1016';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a = e.facing + Math.PI + (i - 1) * 0.7;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.4);
    ctx.lineTo(Math.cos(a) * 9, -h * 0.4 + 12 + Math.sin(a) * 3);
    ctx.stroke();
  }
  ctx.fillStyle = '#0d141b';
  circle(ctx, 0, -h * 0.55 + breathe, 9);
  ctx.fill();
  ctx.strokeStyle = withAlpha(col, 0.35);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.save();
  ctx.translate(0, -h * 0.55 + breathe);
  ctx.rotate(e.facing);
  ctx.fillStyle = col;
  ctx.shadowColor = col;
  ctx.shadowBlur = 10 + clamp01(e.tell) * 20;
  circle(ctx, 5, 0, 2.6 + clamp01(e.tell) * 1.6);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
  ctx.restore();
}

function drawParasite(ctx: Ctx, e: Enemy, col: string, breathe: number, t: number): void {
  const h = e.def.height;
  ctx.fillStyle = '#0a1016';
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.45, 16 + breathe * 0.5, h * 0.45 + breathe, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = withAlpha(col, 0.2);
  ctx.lineWidth = 1;
  ctx.stroke();

  // Many small eyes, all of which would like to be looked at.
  const count = 7;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + Math.sin(t * 0.4 + i) * 0.1;
    const r = 10;
    const x = Math.cos(a) * r;
    const y = -h * 0.45 + Math.sin(a) * r * 1.2;
    const open = 1 + clamp01(e.tell) * 2.2 + Math.sin(t * 1.3 + i * 2) * 0.4;
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 6 + clamp01(e.tell) * 14;
    circle(ctx, x, y, open);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

// --- feedback --------------------------------------------------------------

/** Expanding rings where sound happened. Subtle, but it explains every reaction. */
export function drawNoise(ctx: Ctx, ripples: readonly NoiseRipple[]): void {
  ctx.save();
  for (const r of ripples) {
    const t = r.age / 1.1;
    if (t >= 1) continue;
    const radius = 6 + t * Math.min(220, r.level * 20);
    const alpha = (1 - t) * (0.1 + Math.min(0.3, r.level / 40));
    ctx.strokeStyle = withAlpha(r.byPlayer ? PALETTE.fog : PALETTE.warm, alpha);
    ctx.lineWidth = 1 + (1 - t) * 1.2;
    circle(ctx, r.x, r.y, radius);
    ctx.stroke();
  }
  ctx.restore();
}

/** A creature's sight line to what it is reacting to, shown only when it matters. */
export function drawAttentionLine(ctx: Ctx, e: Enemy, tx: number, ty: number): void {
  const strength = clamp01((e.awareness - AWARENESS.suspicious) / 0.5);
  if (strength <= 0.01) return;
  ctx.save();
  ctx.strokeStyle = withAlpha(eyeColor(e.tell, false), strength * 0.22);
  ctx.setLineDash([2, 8]);
  ctx.lineDashOffset = -e.animPhase * 26;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(e.x, e.y - e.def.height * 0.6);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.restore();
}
