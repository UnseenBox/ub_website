import { TAU } from '../core/math';
import { Bell, BELL_RADIUS } from '../mechanics/Bell';
import { Bumper, BUMPER_RADIUS } from '../mechanics/Bumper';
import { Cat, CAT_RADIUS } from '../mechanics/Cat';
import { Fan } from '../mechanics/Fan';
import { Glass } from '../mechanics/Glass';
import type { Mechanic } from '../mechanics/Mechanic';
import { Pipe, PIPE_RADIUS } from '../mechanics/Pipe';
import { Scooter, SCOOTER_LENGTH, SCOOTER_WIDTH } from '../mechanics/Scooter';
import { Spinner, SPINNER_THICKNESS } from '../mechanics/Spinner';
import { Tyre, TYRE_RADIUS } from '../mechanics/Tyre';
import { Sand, Slope } from '../mechanics/Zones';
import { SUN_X, SUN_Y } from './ArenaArt';
import { roundRect } from './DrawUtils';
import { C, rgba, SHADOW_ALPHA } from './Palette';

const GLASS_LIFT = 38;
const GATE_LIFT = 30;
const BELL_LIFT = 30;

/** Shadows of the mechanics that never move, drawn opaque into the static shadow layer. */
export function paintMechanicShadows(ctx: CanvasRenderingContext2D, mechanics: readonly Mechanic[]): void {
  ctx.fillStyle = C.shadow;
  ctx.strokeStyle = C.shadow;
  ctx.lineCap = 'round';
  for (const m of mechanics) {
    if (m instanceof Tyre) {
      if (m.gone) continue;
      ctx.lineWidth = TYRE_RADIUS * 2;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x + 18 * SUN_X, m.y + 18 * SUN_Y);
      ctx.stroke();
    } else if (m instanceof Bumper) {
      if (m.gone) continue;
      ctx.lineWidth = BUMPER_RADIUS * 2;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x + 22 * SUN_X, m.y + 22 * SUN_Y);
      ctx.stroke();
    } else if (m instanceof Bell) {
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(m.def.x, m.def.y);
      ctx.lineTo(m.def.x + BELL_LIFT * SUN_X, m.def.y + BELL_LIFT * SUN_Y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(m.def.x + BELL_LIFT * SUN_X, m.def.y + BELL_LIFT * SUN_Y, 15, 0, TAU);
      ctx.fill();
    }
  }
}

/** Things that lie flat: drawn straight after the ground, under every solid. */
export function drawMechanicGround(ctx: CanvasRenderingContext2D, m: Mechanic, time: number): void {
  if (m instanceof Sand) drawSand(ctx, m);
  else if (m instanceof Slope) (m.boost ? drawBoost : drawSlope)(ctx, m, time);
  else if (m instanceof Fan) drawFan(ctx, m, time);
  else if (m instanceof Pipe) drawPipe(ctx, m, time);
  else if (m instanceof Bell) {
    // The ring the kids chalked round the bell post.
    ctx.strokeStyle = rgba(C.chalk, 0.6);
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(m.def.x, m.def.y, BELL_RADIUS + 9, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (m instanceof Scooter || m instanceof Cat || m instanceof Glass) {
    drawMovingShadow(ctx, m);
  } else if (m instanceof Bumper || m instanceof Spinner) {
    drawMovingShadow(ctx, m);
  }
}

/** Things that stand up: drawn in depth order with the ball. */
export function drawMechanicSolid(ctx: CanvasRenderingContext2D, m: Mechanic, time: number): void {
  if (m instanceof Tyre) {
    if (!m.gone) drawTyre(ctx, m);
  } else if (m instanceof Bumper) {
    if (!m.gone) drawBumper(ctx, m, time);
  } else if (m instanceof Spinner) drawSpinner(ctx, m);
  else if (m instanceof Scooter) drawScooter(ctx, m, time);
  else if (m instanceof Glass) drawGlass(ctx, m);
  else if (m instanceof Bell) drawBell(ctx, m);
  else if (m instanceof Cat) drawCat(ctx, m, time);
}

function drawMovingShadow(ctx: CanvasRenderingContext2D, m: Mechanic): void {
  ctx.fillStyle = rgba(C.shadow, SHADOW_ALPHA);
  if (m instanceof Scooter) {
    const b = m.body;
    ctx.save();
    ctx.translate(b.x + 20 * SUN_X, b.y + 20 * SUN_Y);
    ctx.rotate(b.angle);
    roundRect(ctx, -SCOOTER_LENGTH / 2, -SCOOTER_WIDTH / 2 + 4, SCOOTER_LENGTH, SCOOTER_WIDTH - 8, 16);
    ctx.fill();
    ctx.restore();
  } else if (m instanceof Spinner) {
    const b = m.body;
    ctx.save();
    ctx.translate(b.x + 16 * SUN_X, b.y + 16 * SUN_Y);
    ctx.rotate(b.angle);
    roundRect(ctx, -m.w / 2, -SPINNER_THICKNESS / 2 + 3, m.w, SPINNER_THICKNESS - 6, 12);
    ctx.fill();
    ctx.restore();
  } else if (m instanceof Bumper) {
    ctx.beginPath();
    ctx.ellipse(m.x + 11, m.y + 9, BUMPER_RADIUS * 0.95, BUMPER_RADIUS * 0.9, 0, 0, TAU);
    ctx.fill();
  } else if (m instanceof Cat) {
    ctx.beginPath();
    ctx.ellipse(m.body.x + 9, m.body.y + 8, CAT_RADIUS * 0.95, CAT_RADIUS * 0.9, 0, 0, TAU);
    ctx.fill();
  } else if (m instanceof Glass && !m.broken) {
    // Glass throws a pale shadow: light goes through it.
    const b = m.body;
    const hw = m.def.w / 2;
    const ax = b.x - b.cos * hw;
    const ay = b.y - b.sin * hw;
    const bx = b.x + b.cos * hw;
    const by = b.y + b.sin * hw;
    ctx.fillStyle = rgba(C.shadow, 0.1);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx + GLASS_LIFT * SUN_X, by + GLASS_LIFT * SUN_Y);
    ctx.lineTo(ax + GLASS_LIFT * SUN_X, ay + GLASS_LIFT * SUN_Y);
    ctx.closePath();
    ctx.fill();
  }
}

/** Fill and ridge colour of each kind of ground. */
const GROUND: Readonly<Record<Sand['kind'], readonly [string, string]>> = {
  sand: [C.sand, C.woodDark],
  grass: ['#58a84a', '#2f6f2c'],
  water: ['#6cc4ee', '#ffffff'],
  ice: ['#e3f5fc', '#7fc3e2'],
};

/** A strip of arrows marching the way they push. */
function drawBoost(ctx: CanvasRenderingContext2D, m: Slope, time: number): void {
  const r = m.rect;
  ctx.save();
  ctx.translate(r.x, r.y);
  roundRect(ctx, -r.w / 2, -r.h / 2, r.w, r.h, 16);
  ctx.fillStyle = '#e2472b';
  ctx.fill();
  ctx.clip();
  ctx.rotate(m.angle);
  ctx.strokeStyle = C.sun;
  ctx.lineWidth = 10;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const span = Math.max(r.w, r.h);
  for (let d = -span + ((time * 170) % 62); d < span; d += 62) {
    ctx.beginPath();
    ctx.moveTo(d - 16, -28);
    ctx.lineTo(d + 12, 0);
    ctx.lineTo(d - 16, 28);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSand(ctx: CanvasRenderingContext2D, m: Sand): void {
  const [fill, ridge] = GROUND[m.kind];
  const r = m.rect;
  const x = r.x - r.w / 2;
  const y = r.y - r.h / 2;
  const radius = Math.min(r.w, r.h) * 0.42;
  roundRect(ctx, x - 8, y - 6, r.w + 16, r.h + 12, radius + 6);
  ctx.fillStyle = rgba(fill, 0.55);
  ctx.fill();
  roundRect(ctx, x, y, r.w, r.h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  // Raked ridges, and a brighter crown where the pile is deepest.
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = rgba(ridge, m.kind === 'sand' ? 0.16 : 0.4);
  ctx.lineWidth = 3;
  for (let d = -r.h; d < r.w; d += 22) {
    ctx.beginPath();
    ctx.moveTo(x + d, y + r.h);
    ctx.quadraticCurveTo(x + d + r.h * 0.6, y + r.h * 0.6, x + d + r.h, y);
    ctx.stroke();
  }
  ctx.fillStyle = rgba('#ffffff', 0.28);
  ctx.beginPath();
  ctx.ellipse(r.x - r.w * 0.08, r.y - r.h * 0.1, r.w * 0.3, r.h * 0.26, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Someone upstairs is washing the street: the water shows which way the ground falls. */
function drawSlope(ctx: CanvasRenderingContext2D, m: Slope, time: number): void {
  const r = m.rect;
  const x = r.x - r.w / 2;
  const y = r.y - r.h / 2;
  ctx.save();
  roundRect(ctx, x, y, r.w, r.h, 26);
  ctx.fillStyle = rgba(C.water, 0.3);
  ctx.fill();
  ctx.clip();

  // Rivulets: short bright strokes drifting downhill, wrapping round.
  ctx.translate(r.x, r.y);
  ctx.rotate(m.angle);
  const span = Math.hypot(r.w, r.h);
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const lane = ((i * 0.618) % 1) * span - span / 2;
    const offset = (((i * 0.37 + time * (0.16 + (i % 5) * 0.03)) % 1) + 1) % 1;
    const along = offset * span - span / 2;
    const len = 26 + (i % 4) * 14;
    ctx.strokeStyle = rgba('#ffffff', 0.25 + 0.45 * Math.sin(offset * Math.PI));
    ctx.lineWidth = 3 + (i % 3);
    ctx.beginPath();
    ctx.moveTo(along, lane);
    ctx.lineTo(along + len, lane);
    ctx.stroke();
  }
  // Arrows on the ground, for anyone who does not read water.
  ctx.strokeStyle = rgba(C.blue, 0.5);
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  for (let k = -1; k <= 1; k++) {
    const ax = k * span * 0.24 + ((time * 40) % 20);
    ctx.beginPath();
    ctx.moveTo(ax - 12, -16);
    ctx.lineTo(ax + 6, 0);
    ctx.lineTo(ax - 12, 16);
    ctx.stroke();
  }
  ctx.restore();
}

/** A fan zone: pale wind with fast streaks blowing along its angle, plus a fan box at the tail. */
function drawFan(ctx: CanvasRenderingContext2D, m: Fan, time: number): void {
  const r = m.rect;
  const x = r.x - r.w / 2;
  const y = r.y - r.h / 2;
  ctx.save();
  roundRect(ctx, x, y, r.w, r.h, 26);
  ctx.fillStyle = rgba('#ffffff', 0.32);
  ctx.fill();
  ctx.clip();
  ctx.translate(r.x, r.y);
  ctx.rotate(m.angle);
  const span = Math.hypot(r.w, r.h);
  ctx.lineCap = 'round';
  for (let i = 0; i < 22; i++) {
    const lane = ((i * 0.618) % 1) * span - span / 2;
    const speed = 0.5 + (i % 4) * 0.22;
    const offset = (((i * 0.41 + time * speed) % 1) + 1) % 1;
    const along = offset * span - span / 2;
    const len = 40 + (i % 5) * 18;
    ctx.strokeStyle = rgba(C.blueLite, 0.3 + 0.4 * Math.sin(offset * Math.PI));
    ctx.lineWidth = 4 + (i % 3) * 2;
    ctx.beginPath();
    ctx.moveTo(along, lane);
    ctx.lineTo(along + len, lane);
    ctx.stroke();
    // Arrowhead on every other streak.
    if (i % 2 === 0) {
      ctx.strokeStyle = rgba(C.blue, 0.55);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(along + len - 12, lane - 8);
      ctx.lineTo(along + len, lane);
      ctx.lineTo(along + len - 12, lane + 8);
      ctx.stroke();
    }
  }
  ctx.restore();

  // The fan box at the upwind edge.
  ctx.save();
  const fx = r.x - Math.cos(m.angle) * (Math.max(r.w, r.h) / 2 - 14);
  const fy = r.y - Math.sin(m.angle) * (Math.max(r.w, r.h) / 2 - 14);
  ctx.translate(fx, fy);
  ctx.rotate(m.angle);
  roundRect(ctx, -24, -24, 48, 48, 12);
  ctx.fillStyle = C.navy;
  ctx.fill();
  roundRect(ctx, -18, -18, 36, 36, 9);
  ctx.fillStyle = C.blue;
  ctx.fill();
  const spin = time * 9;
  ctx.strokeStyle = C.white;
  ctx.lineWidth = 4;
  for (let k = 0; k < 3; k++) {
    const a = spin + (k * TAU) / 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(Math.cos(a) * 10, Math.sin(a) * 10, Math.cos(a + 0.7) * 14, Math.sin(a + 0.7) * 14);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBumper(ctx: CanvasRenderingContext2D, m: Bumper, time: number): void {
  const pulse = 1 + m.hit * 0.12 + Math.sin(time * 3 + m.x) * 0.015;
  const r = BUMPER_RADIUS * pulse;
  // Base plate.
  ctx.fillStyle = C.navy;
  ctx.beginPath();
  ctx.arc(m.x, m.y - 4, r + 6, 0, TAU);
  ctx.fill();
  // Red body with white cap.
  ctx.fillStyle = m.hit > 0.4 ? '#ff6a5a' : '#e2472b';
  ctx.beginPath();
  ctx.arc(m.x, m.y - 10, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fbf7ee';
  ctx.beginPath();
  ctx.arc(m.x, m.y - 14, r * 0.62, 0, TAU);
  ctx.fill();
  ctx.fillStyle = m.hit > 0 ? C.sun : '#e2472b';
  ctx.beginPath();
  ctx.arc(m.x, m.y - 14, r * 0.34, 0, TAU);
  ctx.fill();
  // Highlight.
  ctx.fillStyle = rgba('#ffffff', 0.75);
  ctx.beginPath();
  ctx.ellipse(m.x - r * 0.3, m.y - 14 - r * 0.35, r * 0.16, r * 0.1, -0.7, 0, TAU);
  ctx.fill();
  if (m.hit > 0) {
    ctx.strokeStyle = rgba(C.sun, m.hit);
    ctx.lineWidth = 4 + 5 * m.hit;
    ctx.beginPath();
    ctx.arc(m.x, m.y - 12, r + 12 * (1 - m.hit), 0, TAU);
    ctx.stroke();
  }
}

function drawSpinner(ctx: CanvasRenderingContext2D, m: Spinner): void {
  const b = m.body;
  // Centre post.
  ctx.fillStyle = C.navy;
  ctx.beginPath();
  ctx.arc(m.x, m.y - 6, 20, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.sun;
  ctx.beginPath();
  ctx.arc(m.x, m.y - 10, 14, 0, TAU);
  ctx.fill();
  // The bar, as stacked slices for volume.
  for (let k = 0; k <= 14; k += 4) {
    ctx.save();
    ctx.translate(m.x, m.y - k);
    ctx.rotate(b.angle);
    roundRect(ctx, -m.w / 2, -SPINNER_THICKNESS / 2, m.w, SPINNER_THICKNESS, 13);
    ctx.fillStyle = k < 14 ? C.blueDark : m.hit > 0 ? C.sun : C.blue;
    ctx.fill();
    ctx.restore();
  }
  // Hazard stripes on the top face.
  ctx.save();
  ctx.translate(m.x, m.y - 16);
  ctx.rotate(b.angle);
  ctx.fillStyle = rgba(C.sun, 0.9);
  for (let d = -m.w / 2 + 14; d < m.w / 2 - 6; d += 28) {
    ctx.save();
    ctx.translate(d, 0);
    ctx.rotate(0.5);
    ctx.fillRect(-4, -SPINNER_THICKNESS / 2 + 4, 8, SPINNER_THICKNESS - 8);
    ctx.restore();
  }
  ctx.restore();
}

function hole(ctx: CanvasRenderingContext2D, x: number, y: number, ring: string): void {
  ctx.fillStyle = C.stoneDark;
  ctx.beginPath();
  ctx.arc(x, y, PIPE_RADIUS + 7, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#231f1c';
  ctx.beginPath();
  ctx.arc(x, y, PIPE_RADIUS, 0, TAU);
  ctx.fill();
  // The lit far lip of the shaft.
  ctx.strokeStyle = rgba('#ffffff', 0.16);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, y, PIPE_RADIUS - 4, 0.15 * Math.PI, 0.7 * Math.PI);
  ctx.stroke();
  ctx.strokeStyle = ring;
  ctx.lineWidth = 5;
  ctx.setLineDash([12, 7]);
  ctx.beginPath();
  ctx.arc(x, y, PIPE_RADIUS + 15, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPipe(ctx: CanvasRenderingContext2D, m: Pipe, time: number): void {
  // A chalk trail between the two, so the pairing is never a guess.
  ctx.strokeStyle = rgba(C.chalk, 0.4);
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.setLineDash([4, 16]);
  ctx.lineDashOffset = -time * 40;
  ctx.beginPath();
  ctx.moveTo(m.x, m.y);
  ctx.lineTo(m.outX, m.outY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;

  hole(ctx, m.x, m.y, C.blue);
  hole(ctx, m.outX, m.outY, C.sun);
  // The way in: an arrow pointing down the hole.
  ctx.fillStyle = C.blue;
  const bob = Math.sin(time * 5) * 3;
  ctx.beginPath();
  ctx.moveTo(m.x - 9, m.y - 7 + bob);
  ctx.lineTo(m.x + 9, m.y - 7 + bob);
  ctx.lineTo(m.x, m.y + 8 + bob);
  ctx.closePath();
  ctx.fill();
  // The cover of the exit, slid to one side.
  const cx = m.outX + PIPE_RADIUS + 30;
  const cy = m.outY - 10;
  ctx.fillStyle = rgba(C.shadow, SHADOW_ALPHA);
  ctx.beginPath();
  ctx.arc(cx + 5, cy + 4, PIPE_RADIUS, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#7e7a78';
  ctx.beginPath();
  ctx.arc(cx, cy, PIPE_RADIUS, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#625e5c';
  ctx.lineWidth = 3;
  for (let i = -2; i <= 2; i++) {
    const half = Math.sqrt(Math.max(0, (PIPE_RADIUS - 5) ** 2 - (i * 9) ** 2));
    ctx.beginPath();
    ctx.moveTo(cx - half, cy + i * 9);
    ctx.lineTo(cx + half, cy + i * 9);
    ctx.stroke();
  }
  if (m.flash > 0) {
    ctx.strokeStyle = rgba(C.sun, m.flash);
    ctx.lineWidth = 6 * m.flash + 1;
    ctx.beginPath();
    ctx.arc(m.outX, m.outY, PIPE_RADIUS + 60 * (1 - m.flash), 0, TAU);
    ctx.stroke();
  }
}

function drawTyre(ctx: CanvasRenderingContext2D, m: Tyre): void {
  // Three tyres in a stack, squashing and springing back when struck.
  const wobble = 1 + Math.sin(m.hit * 14) * m.hit * 0.14;
  const r = TYRE_RADIUS * wobble;
  for (let k = 0; k <= 18; k += 3) {
    ctx.fillStyle = k % 6 === 0 ? C.rubber : '#30333e';
    ctx.beginPath();
    ctx.arc(m.x, m.y - k, r, 0, TAU);
    ctx.fill();
  }
  const y = m.y - 18;
  ctx.fillStyle = C.rubberLite;
  ctx.beginPath();
  ctx.arc(m.x, y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.rubber;
  ctx.beginPath();
  ctx.arc(m.x, y, r * 0.8, 0, TAU);
  ctx.fill();
  // Tread.
  ctx.strokeStyle = rgba('#000000', 0.3);
  ctx.lineWidth = 3;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    ctx.beginPath();
    ctx.moveTo(m.x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82);
    ctx.lineTo(m.x + Math.cos(a + 0.12) * r * 0.98, y + Math.sin(a + 0.12) * r * 0.98);
    ctx.stroke();
  }
  ctx.fillStyle = '#1c1d24';
  ctx.beginPath();
  ctx.arc(m.x, y, r * 0.42, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba('#ffffff', 0.35);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(m.x, y, r * 0.62, 1.1 * Math.PI, 1.6 * Math.PI);
  ctx.stroke();
  if (m.hit > 0) {
    ctx.strokeStyle = rgba(C.sun, m.hit);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(m.x, y, r + 10 * (1 - m.hit), 0, TAU);
    ctx.stroke();
  }
}

/** A delivery scooter and its rider, from above. */
function drawScooter(ctx: CanvasRenderingContext2D, m: Scooter, time: number): void {
  const b = m.body;
  const rattle = Math.sin(time * 38) * 0.6;
  const slice = (lift: number, draw: () => void): void => {
    ctx.save();
    ctx.translate(b.x, b.y - lift + rattle);
    ctx.rotate(b.angle);
    // It rides nose first in both directions.
    ctx.scale(m.heading, 1);
    draw();
    ctx.restore();
  };
  slice(0, () => {
    ctx.fillStyle = C.rubber;
    roundRect(ctx, 34, -6, 24, 12, 6);
    ctx.fill();
    roundRect(ctx, -56, -6, 24, 12, 6);
    ctx.fill();
  });
  for (let k = 4; k <= 16; k += 4) {
    slice(k, () => {
      roundRect(ctx, -50, -15, 96, 30, 14);
      ctx.fillStyle = C.blueDark;
      ctx.fill();
    });
  }
  slice(18, () => {
    roundRect(ctx, -50, -15, 96, 30, 14);
    ctx.fillStyle = m.hit > 0 ? C.blueLite : C.blue;
    ctx.fill();
    // Handlebars and front shield.
    ctx.strokeStyle = C.navy;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(30, -23);
    ctx.lineTo(30, 23);
    ctx.stroke();
    ctx.fillStyle = C.white;
    roundRect(ctx, 32, -10, 14, 20, 6);
    ctx.fill();
  });
  slice(26, () => {
    // Delivery box on the back.
    ctx.fillStyle = C.terraDark;
    ctx.fillRect(-52, -18, 30, 36);
    ctx.fillStyle = C.terra;
    ctx.fillRect(-52, -18, 30, 30);
    ctx.fillStyle = C.white;
    ctx.fillRect(-45, -9, 16, 12);
    // Rider: shoulders, then helmet.
    ctx.fillStyle = C.white;
    ctx.beginPath();
    ctx.ellipse(-4, 0, 13, 19, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(2, -15);
    ctx.lineTo(28, -19);
    ctx.moveTo(2, 15);
    ctx.lineTo(28, 19);
    ctx.stroke();
    ctx.fillStyle = C.sun;
    ctx.beginPath();
    ctx.arc(2, 0, 12, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgba(C.navy, 0.75);
    ctx.beginPath();
    ctx.arc(2, 0, 12, -0.6, 0.6);
    ctx.lineTo(2, 0);
    ctx.fill();
  });
}

function drawGlass(ctx: CanvasRenderingContext2D, m: Glass): void {
  const b = m.body;
  const hw = m.def.w / 2;
  const ax = b.x - b.cos * hw;
  const ay = b.y - b.sin * hw;
  const bx = b.x + b.cos * hw;
  const by = b.y + b.sin * hw;

  // The trestle feet it stands in.
  ctx.fillStyle = C.woodDark;
  for (const [x, y] of [[ax, ay], [bx, by]]) {
    ctx.fillRect(x - 7, y - 5, 14, 16);
    ctx.fillStyle = C.wood;
    ctx.fillRect(x - 7, y - 9, 14, 10);
    ctx.fillStyle = C.woodDark;
  }

  if (m.broken) {
    // Teeth of glass left in the feet.
    ctx.fillStyle = rgba(C.water, 0.7);
    for (const [x, dir] of [[ax, 1], [bx, -1]] as const) {
      const y = x === ax ? ay : by;
      ctx.beginPath();
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x + dir * 20, y - 4);
      ctx.lineTo(x + dir * 9, y - 18);
      ctx.lineTo(x + dir * 5, y - 12);
      ctx.lineTo(x, y - 26);
      ctx.closePath();
      ctx.fill();
    }
    return;
  }

  ctx.beginPath();
  ctx.moveTo(ax, ay - 4);
  ctx.lineTo(bx, by - 4);
  ctx.lineTo(bx, by - GLASS_LIFT);
  ctx.lineTo(ax, ay - GLASS_LIFT);
  ctx.closePath();
  ctx.fillStyle = rgba(C.water, 0.42);
  ctx.fill();
  ctx.strokeStyle = rgba('#ffffff', 0.9);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // Reflections.
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = rgba('#ffffff', 0.55);
  ctx.lineWidth = 7;
  for (const f of [0.18, 0.26, 0.7]) {
    const x = ax + (bx - ax) * f;
    const y = ay + (by - ay) * f;
    ctx.beginPath();
    ctx.moveTo(x - 14, y);
    ctx.lineTo(x + 26, y - GLASS_LIFT - 6);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBell(ctx: CanvasRenderingContext2D, m: Bell): void {
  const { x, y, gate } = m.def;

  // The shutter. It rolls up into its box, so it gets shorter and paler as it opens.
  const shut = 1 - m.open;
  const gx = gate.x - gate.w / 2;
  const gy = gate.y - gate.h / 2;
  if (shut > 0.02) {
    const lift = GATE_LIFT * shut;
    ctx.globalAlpha = 0.35 + 0.65 * shut;
    ctx.fillStyle = rgba(C.shadow, SHADOW_ALPHA * shut);
    ctx.fillRect(gx + lift * SUN_X, gy + lift * SUN_Y, gate.w, gate.h);
    ctx.fillStyle = C.blueDark;
    ctx.fillRect(gx, gy + gate.h - lift, gate.w, lift);
    ctx.fillStyle = C.blue;
    ctx.fillRect(gx, gy - lift, gate.w, gate.h);
    ctx.strokeStyle = rgba('#ffffff', 0.3);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let sy = gy - lift + 6; sy < gy - lift + gate.h; sy += 8) {
      ctx.moveTo(gx + 4, sy);
      ctx.lineTo(gx + gate.w - 4, sy);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else {
    // Rolled up: just the track it runs in.
    ctx.fillStyle = rgba(C.blueDark, 0.35);
    ctx.fillRect(gx, gy, gate.w, 4);
    ctx.fillRect(gx, gy + gate.h - 4, gate.w, 4);
  }

  // Post, then the bell on top of it.
  for (let k = 0; k <= BELL_LIFT; k += 3) {
    ctx.fillStyle = C.blueDark;
    ctx.beginPath();
    ctx.arc(x, y - k, 7, 0, TAU);
    ctx.fill();
  }
  const sway = Math.sin(m.swing * 22) * m.swing * 7;
  const by = y - BELL_LIFT;
  ctx.fillStyle = C.sunDark;
  ctx.beginPath();
  ctx.arc(x + sway, by + 3, 17, 0, TAU);
  ctx.fill();
  ctx.fillStyle = m.rung ? C.sun : C.brass;
  ctx.beginPath();
  ctx.arc(x + sway, by, 17, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.sunDark;
  ctx.beginPath();
  ctx.arc(x + sway * 1.6, by, 5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = rgba('#ffffff', 0.7);
  ctx.beginPath();
  ctx.ellipse(x + sway - 6, by - 7, 6, 3, -0.7, 0, TAU);
  ctx.fill();
  if (m.swing > 0) {
    ctx.strokeStyle = rgba(C.sun, m.swing);
    ctx.lineWidth = 4;
    for (const r of [28, 40]) {
      ctx.beginPath();
      ctx.arc(x, by, r + (1 - m.swing) * 22, 0, TAU);
      ctx.stroke();
    }
  }
}

/** Mimi, from above, facing down the alley at whoever is about to shoot. */
function drawCat(ctx: CanvasRenderingContext2D, m: Cat, time: number): void {
  const b = m.body;
  const lean = m.lean;
  const reach = m.pounce;
  ctx.save();
  ctx.translate(b.x, b.y - 5);
  ctx.rotate(lean * 0.22);

  // Tail, curling behind her.
  ctx.strokeStyle = C.catDark;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  const wag = Math.sin(time * 3.2) * 12;
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.quadraticCurveTo(-18 + wag, -36, -22 + wag * 1.4, -22);
  ctx.stroke();

  // Body, with tabby stripes.
  ctx.fillStyle = C.cat;
  ctx.beginPath();
  ctx.ellipse(0, -4, 21 + reach * 4, 23 - reach * 3, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = C.catDark;
  ctx.lineWidth = 4;
  for (const sy of [-16, -8, 0]) {
    ctx.beginPath();
    ctx.moveTo(-12, sy);
    ctx.quadraticCurveTo(0, sy - 5, 12, sy);
    ctx.stroke();
  }

  // Front paws: tucked in, or flung wide when she blocks one.
  ctx.fillStyle = C.white;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * (10 + reach * 18), 21 + reach * 3, 6, 8, side * reach * 0.8, 0, TAU);
    ctx.fill();
  }

  // Head.
  const hx = lean * 5;
  const hy = 12;
  ctx.fillStyle = C.cat;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(hx + side * 6, hy - 9);
    ctx.lineTo(hx + side * 17, hy - 13);
    ctx.lineTo(hx + side * 13, hy + 1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(hx, hy, 14, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.white;
  ctx.beginPath();
  ctx.ellipse(hx, hy + 7, 7, 5, 0, 0, TAU);
  ctx.fill();
  // Eyes: wide when she pounces.
  ctx.fillStyle = C.navy;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(hx + side * 6, hy + 1, 2.4, 2.4 + reach * 1.5, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = C.terra;
  ctx.beginPath();
  ctx.arc(hx, hy + 6, 1.8, 0, TAU);
  ctx.fill();
  ctx.restore();
}
