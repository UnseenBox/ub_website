import type { Goal } from '../goal/Goal';
import type { GoalNet } from '../goal/GoalNet';
import { C, rgba } from './Palette';

/** The ground inside the goal: a doorway's worth of shade. Painted once into the static layer. */
export function paintGoalFloor(ctx: CanvasRenderingContext2D, g: Goal): void {
  ctx.beginPath();
  ctx.moveTo(g.leftPostX, g.lineY);
  ctx.lineTo(g.leftPostX + g.taper, g.backY);
  ctx.lineTo(g.rightPostX - g.taper, g.backY);
  ctx.lineTo(g.rightPostX, g.lineY);
  ctx.closePath();
  ctx.fillStyle = C.recess;
  ctx.fill();

  // The back net, hanging from the top edge down to the ground.
  ctx.strokeStyle = rgba(C.white, 0.22);
  ctx.lineWidth = 1.5;
  const left = g.leftPostX + g.taper;
  const right = g.rightPostX - g.taper;
  for (let x = left; x <= right + 0.5; x += (right - left) / 16) {
    ctx.beginPath();
    ctx.moveTo(x, g.backY);
    ctx.lineTo(x, g.backTopY);
    ctx.stroke();
  }
}

/** Chalk arrows on the ground pointing into the goal: the "this way" cue, readable without colour. */
export function drawGoalCue(ctx: CanvasRenderingContext2D, g: Goal, time: number, strength: number): void {
  if (strength <= 0) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 5;
  for (let i = 0; i < 3; i++) {
    // Each chevron brightens in turn, nearest the goal last, so the row reads as motion.
    const phase = (time * 1.4 - i * 0.22) % 1;
    const pulse = Math.max(0, 1 - Math.abs(((phase + 1) % 1) - 0.5) * 4);
    const y = g.lineY + 34 + (2 - i) * 20;
    ctx.strokeStyle = rgba(C.chalk, (0.3 + 0.6 * pulse) * strength);
    ctx.beginPath();
    ctx.moveTo(g.cx - 20, y + 9);
    ctx.lineTo(g.cx, y - 5);
    ctx.lineTo(g.cx + 20, y + 9);
    ctx.stroke();
  }
}

/** The roof of the net, with its live ripple. Drawn over a ball that is inside the goal. */
export function drawNet(ctx: CanvasRenderingContext2D, net: GoalNet): void {
  const { cols, rows, restX, restY, ox, oy } = net;
  ctx.strokeStyle = rgba(C.white, 0.7);
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      if (i === 0) ctx.moveTo(restX[k] + ox[k], restY[k] + oy[k]);
      else ctx.lineTo(restX[k] + ox[k], restY[k] + oy[k]);
    }
  }
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const k = j * cols + i;
      if (j === 0) ctx.moveTo(restX[k] + ox[k], restY[k] + oy[k]);
      else ctx.lineTo(restX[k] + ox[k], restY[k] + oy[k]);
    }
  }
  ctx.stroke();

  // The loose back edge, a little heavier so the billow has a clear outline.
  ctx.strokeStyle = C.white;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < cols; i++) {
    const k = (rows - 1) * cols + i;
    if (i === 0) ctx.moveTo(restX[k] + ox[k], restY[k] + oy[k]);
    else ctx.lineTo(restX[k] + ox[k], restY[k] + oy[k]);
  }
  ctx.stroke();
}

function bar(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, width: number, color: string): void {
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  // A thin shaded edge instead of an outline: it stays crisp against whitewash.
  ctx.strokeStyle = rgba(C.navy, 0.45);
  ctx.lineWidth = width + 3;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Posts, crossbar and the side supports. `flash` (0 to 1) lights the frame when a goal goes in. */
export function drawGoalFrame(ctx: CanvasRenderingContext2D, g: Goal, flash: number, band: string = C.blue): void {
  const r = g.postR;
  const top = g.barY;
  const frame = flash > 0 ? C.sun : C.white;

  for (const side of [-1, 1]) {
    const px = side < 0 ? g.leftPostX : g.rightPostX;
    const bx = px - side * g.taper;
    // Side of the net: a few threads between the post and the back support.
    ctx.strokeStyle = rgba(C.white, 0.45);
    ctx.lineWidth = 1.5;
    for (let i = 1; i <= 3; i++) {
      const f = i / 4;
      ctx.beginPath();
      ctx.moveTo(px - side * g.taper * f, g.lineY + (g.backY - g.lineY) * f);
      ctx.lineTo(px - side * g.taper * f, top + (g.backTopY - top) * f);
      ctx.stroke();
    }
    bar(ctx, bx, g.backY, bx, g.backTopY, 3, C.whiteShade);
    bar(ctx, px, top, bx, g.backTopY, 4, C.whiteShade);
  }

  for (const px of [g.leftPostX, g.rightPostX]) {
    // A post is a cylinder: a shaded edge, the body, and bands of blue paint like a barber's pole.
    ctx.fillStyle = rgba(C.navy, 0.45);
    ctx.beginPath();
    ctx.arc(px, g.postY, r + 1.5, 0, Math.PI);
    ctx.fill();
    ctx.fillRect(px - r - 1.5, top, r * 2 + 3, g.postY - top);
    ctx.fillStyle = frame;
    ctx.beginPath();
    ctx.arc(px, g.postY, r, 0, Math.PI);
    ctx.fill();
    ctx.fillRect(px - r, top, r * 2, g.postY - top);
    // The bands are the owner's colour in a duel.
    ctx.fillStyle = band;
    for (let y = g.postY - 12; y > top + 6; y -= 18) ctx.fillRect(px - r, y, r * 2, 7);
    ctx.fillStyle = rgba(C.shadow, 0.2);
    ctx.fillRect(px + r * 0.3, top, r * 0.7, g.postY - top);
  }

  bar(ctx, g.leftPostX, top, g.rightPostX, top, 9, frame);
  ctx.lineCap = 'butt';
}
