import { INK } from '../core/constants';
import { TAU } from '../core/math';
import type { Enemy } from '../entities/Enemy';
import type { EnemyTypeId } from '../entities/EnemyTypes';
import { hash, mix, onTop, prism, type Ctx } from './draw';

/**
 * THE MOVERS — a removal crew of living cardboard boxes, sent by the landlord at 3 a.m.
 * to pack up your flat with you still in it.
 *
 *   Box        the standard mover: kraft card, parcel tape, eyes glaring out of the hand-hole
 *   Express    a padded envelope on legs; the flap is a permanent frown
 *   Crate      slatted timber, something staring out from between the planks
 *   Pan Head   a Box that has already looted your saucepan and is wearing it
 *   Bailiff    wears a tie, hides behind the eviction notice
 *   Tangle     a box of Christmas lights that should not have been plugged in
 *
 * Each is drawn in passes (legs → body → tape and flaps → face → props) and every pass reacts
 * to state: flaps perk up before a lunge, the eyes follow you, the lid bursts when it is beaten.
 */

interface Build {
  hw: number;
  hd: number;
  h: number;
  side: string;
  top: string;
}

const KRAFT = '#c9a070';
const KRAFT_DARK = '#9c7446';
const KRAFT_LIGHT = '#dfbd8c';
const TAPE = '#ecdcab';
const STEEL = '#aab4c4';
const STEEL_DARK = '#6d7689';

const BUILDS: Readonly<Record<EnemyTypeId, Build>> = {
  basic: { hw: 15, hd: 10, h: 23, side: KRAFT_DARK, top: KRAFT },
  fast: { hw: 13, hd: 3.5, h: 26, side: '#d8ccac', top: '#f6eed8' },
  heavy: { hw: 23, hd: 14, h: 32, side: '#7a4f28', top: '#b07a45' },
  helmet: { hw: 15, hd: 10, h: 23, side: KRAFT_DARK, top: KRAFT },
  shield: { hw: 15, hd: 10, h: 24, side: '#86623c', top: '#b58d60' },
  electric: { hw: 15, hd: 10, h: 23, side: KRAFT_DARK, top: KRAFT },
  fragile: { hw: 13, hd: 9, h: 22, side: '#b3c4d2', top: '#dfeaf2' },
  nested: { hw: 19, hd: 12, h: 28, side: KRAFT_DARK, top: KRAFT },
  // drawn as a Box at 60% size
  mini: { hw: 15, hd: 10, h: 23, side: '#b08a5a', top: '#d9b687' },
  kaboom: { hw: 15, hd: 10, h: 23, side: '#c9483f', top: '#ef7a6c' },
  trolley: { hw: 15, hd: 10, h: 25, side: '#86623c', top: '#b58d60' },
  boss: { hw: 26, hd: 16, h: 38, side: '#4a3560', top: '#6b4d86' },
};

const BULBS = ['#ff5a4e', '#ffd23f', '#6fe0c2', '#4ad6e8', '#ff9ec4'];

type Tone = (color: string) => string;

function legs(ctx: Ctx, x: number, y: number, phase: number, spread: number, size: number): void {
  const swing = Math.sin(phase) * 4;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(x - spread, y + swing, size, size * 0.7, 0, 0, TAU);
  ctx.ellipse(x + spread, y - swing, size, size * 0.7, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - spread, y + swing);
  ctx.lineTo(x - spread * 0.8, y - 6);
  ctx.moveTo(x + spread, y - swing);
  ctx.lineTo(x + spread * 0.8, y - 6);
  ctx.stroke();
}

function mitt(ctx: Ctx, fromX: number, fromY: number, x: number, y: number, color: string): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(x, y, 4.2, 0, TAU);
  ctx.fill();
  ctx.stroke();
}

/** A pair of eyes glaring out of a dark opening. */
function eyes(ctx: Ctx, cx: number, cy: number, gap: number, lookX: number, lookY: number, size: number, dead: boolean): void {
  for (const side of [-1, 1]) {
    const ex = cx + gap * side;
    if (dead) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(ex - 2.3, cy - 2.3);
      ctx.lineTo(ex + 2.3, cy + 2.3);
      ctx.moveTo(ex + 2.3, cy - 2.3);
      ctx.lineTo(ex - 2.3, cy + 2.3);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex, cy, size, size * 1.08, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(ex + lookX * 1.2, cy + lookY * 0.9, size * 0.5, 0, TAU);
    ctx.fill();
  }
}

/** Jagged tear for a mouth; it gapes open when the mover is winding up to lunge. */
function tearMouth(ctx: Ctx, cx: number, cy: number, width: number, open: number): void {
  ctx.lineJoin = 'miter';
  if (open > 0.15) {
    const gape = 2 + open * 4.5;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(cx - width, cy);
    for (let i = 1; i <= 6; i++) ctx.lineTo(cx - width + (width * 2 * i) / 6, cy + (i % 2 === 0 ? 0 : -1.6));
    for (let i = 6; i >= 0; i--) ctx.lineTo(cx - width + (width * 2 * i) / 6, cy + gape + (i % 2 === 0 ? 1.6 : 0));
    ctx.closePath();
    ctx.fill();
    return;
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(cx - width, cy);
  for (let i = 1; i <= 6; i++) ctx.lineTo(cx - width + (width * 2 * i) / 6, cy + (i % 2 === 0 ? 0 : 2));
  ctx.stroke();
}

function xray(ctx: Ctx, x: number, top: number, bottom: number, width: number): void {
  // cartoon x-ray: for a split second you can see what is packed inside
  const bone = '#fffbe0';
  const r = Math.min(width * 0.38, 7);
  ctx.fillStyle = bone;
  ctx.beginPath();
  ctx.ellipse(x, top + r + 2, r, r * 0.9, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1a1530';
  ctx.beginPath();
  ctx.arc(x - r * 0.38, top + r + 1, r * 0.24, 0, TAU);
  ctx.arc(x + r * 0.38, top + r + 1, r * 0.24, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = bone;
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(x, top + r * 2 + 2);
  ctx.lineTo(x, bottom - 3);
  for (let i = 0; i < 2; i++) {
    const ry = top + r * 2 + 6 + i * 4;
    if (ry > bottom - 3) break;
    ctx.moveTo(x - r, ry + 1.5);
    ctx.quadraticCurveTo(x, ry - 2, x + r, ry + 1.5);
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
}

/** What marks out the later arrivals: stickers, fuses, wheels, boxes inside boxes. */
function newcomerProps(
  ctx: Ctx, e: Enemy, x: number, y: number, faceTop: number, faceBottom: number, topY: number,
  hw: number, hd: number, time: number, tone: Tone, away: boolean,
): void {
  const id = e.type.id;
  const faceH = faceBottom - faceTop;
  if (id === 'fragile') {
    // a red band right round it, and the wine glass symbol
    ctx.fillStyle = tone('#e5383b');
    ctx.fillRect(x - hw + 1, faceBottom - 8.5, hw * 2 - 2, 6);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) ctx.fillRect(x - hw + 3.5 + i * 5.6, faceBottom - 6.3, 3.6, 1.5);
    if (!away) {
      ctx.strokeStyle = tone('#e5383b');
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const gx = x - hw + 5;
      const gy = faceTop + 4;
      ctx.moveTo(gx - 2.4, gy);
      ctx.lineTo(gx + 2.4, gy);
      ctx.lineTo(gx, gy + 3.5);
      ctx.closePath();
      ctx.moveTo(gx, gy + 3.5);
      ctx.lineTo(gx, gy + 6.5);
      ctx.moveTo(gx - 2, gy + 6.5);
      ctx.lineTo(gx + 2, gy + 6.5);
      ctx.stroke();
    }
  } else if (id === 'nested') {
    // the outlines of the boxes inside it
    ctx.strokeStyle = 'rgba(34, 27, 54, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    for (const inset of [3, 6.5]) ctx.strokeRect(x - hw + inset, faceTop + inset, hw * 2 - inset * 2, faceH - inset * 2 + 1);
    ctx.setLineDash([]);
    ctx.fillStyle = tone('#fbf6e9');
    ctx.fillRect(x - hw + 2, faceBottom - 8, 11, 6);
    ctx.fillStyle = INK;
    ctx.font = '700 5px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('x3', x - hw + 3.5, faceBottom - 3.2);
  } else if (id === 'kaboom') {
    // hazard diamond on the front
    if (!away) {
      const dx = x + hw - 7;
      const dy = faceBottom - 8;
      ctx.fillStyle = tone('#ffd23f');
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(dx, dy - 5.5);
      ctx.lineTo(dx + 5.5, dy);
      ctx.lineTo(dx, dy + 5.5);
      ctx.lineTo(dx - 5.5, dy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.fillRect(dx - 0.8, dy - 3, 1.6, 3.6);
      ctx.fillRect(dx - 0.8, dy + 1.6, 1.6, 1.5);
    }
    // a rocket stick poking out of the lid, fuse already lit
    const sx = x + 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(sx, topY + 2);
    ctx.lineTo(sx + 3, topY - 12);
    ctx.stroke();
    ctx.strokeStyle = tone('#4ad6e8');
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.lineCap = 'butt';
    if (!e.defeated) {
      const flick = hash(Math.floor(time * 18) + e.seed);
      ctx.fillStyle = flick > 0.5 ? '#fff27a' : '#ff9f1c';
      ctx.beginPath();
      ctx.arc(sx + 3 + (flick - 0.5) * 3, topY - 14 - flick * 2, 2 + flick * 1.6, 0, TAU);
      ctx.fill();
    }
  } else if (id === 'boss') {
    // the Landlord wears a gold band with three spikes: do not mistake him for furniture
    ctx.fillStyle = tone('#ffd23f');
    ctx.fillRect(x - hw + 2, faceTop + 2, hw * 2 - 4, 6);
    ctx.beginPath();
    for (const off of [-hw + 7, 0, hw - 7]) {
      const px = x + off;
      ctx.moveTo(px - 4, faceTop + 2);
      ctx.lineTo(px, faceTop - 5);
      ctx.lineTo(px + 4, faceTop + 2);
      ctx.closePath();
    }
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(x - hw + 2, faceTop + 2, hw * 2 - 4, 6);
  } else if (id === 'trolley') {

  // wheels, and a strap holding the box on
    ctx.fillStyle = tone('#2a2540');
    ctx.fillRect(x - hw, faceTop + faceH * 0.5, hw * 2, 3);
    const roll = e.walkPhase * 1.5;
    for (const side of [-1, 1]) {
      const wx = x + side * (hw + 2);
      const wy = y + hd + 1;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(wx, wy, 6.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = tone('#aab4c4');
      ctx.beginPath();
      ctx.arc(wx, wy, 2.6, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = tone('#aab4c4');
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(wx + Math.cos(roll) * 5, wy + Math.sin(roll) * 5);
      ctx.lineTo(wx - Math.cos(roll) * 5, wy - Math.sin(roll) * 5);
      ctx.stroke();
    }
  }
}

export function drawEnemy(ctx: Ctx, e: Enemy, x: number, y: number, time: number): void {
  const type = e.type;
  const id = type.id;
  const build = BUILDS[id];
  const { hw, hd, h } = build;
  const fx = Math.cos(e.facing);
  const fy = Math.sin(e.facing);
  const px = -fy;
  const py = fx;

  const shocked = e.shockTimer > 0;
  const shockFrame = shocked && Math.floor(time * 24) % 2 === 0;
  const flash = e.hitFlash;
  const tone: Tone = (c) => {
    if (shockFrame) return '#1a1530';
    if (e.burn > 0) return mix(c, '#3a2a2a', 0.4);
    return flash > 0.05 ? mix(c, '#ffffff', flash * 0.85) : c;
  };
  const windup = e.windupProgress;
  const hop = e.defeated ? 0 : Math.abs(Math.sin(e.walkPhase)) * 2.2;
  const lift = 3 + hop;

  ctx.save();
  if (e.defeated) {
    // beaten flat: the box tumbles and collapses like it has been broken down for recycling
    const flat = Math.min(1, (1.35 - e.removeIn) / 0.5);
    ctx.globalAlpha = Math.min(1, e.removeIn / 0.35);
    ctx.translate(x, y - h * 0.3);
    ctx.rotate(e.spin * 0.6);
    ctx.scale(1 + flat * 0.25, 1 - flat * 0.55);
    ctx.translate(-x, -(y - h * 0.3));
  } else {
    const squash = e.squash;
    const tumble = e.tumble > 0 ? Math.sin(e.tumble * 9) * 0.5 : 0;
    const jitterX = shocked ? (hash(time * 60) - 0.5) * 5 : 0;
    ctx.translate(x + jitterX - fx * windup * 6, y - fy * windup * 6);
    if (tumble !== 0) ctx.rotate(tumble);
    ctx.scale(1 + squash * 0.2 + windup * 0.07, 1 - squash * 0.18 - windup * 0.07);
    ctx.translate(-x, -y);
  }

  if (id === 'mini') {
    ctx.translate(x, y);
    ctx.scale(0.62, 0.62);
    ctx.translate(-x, -y);
  }

  const faceTop = y + hd - h - hop;
  const faceBottom = y + hd - lift;
  const topY = y - h - hop;
  const away = fy < -0.6 && !e.defeated;

  if (id === 'trolley' && !e.defeated) {
    // the sack truck: two handles behind, two fat wheels at the bottom
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      const hx = x + side * (hw - 3);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(hx, y + hd - 2);
      ctx.lineTo(hx, y - h - hop - 15);
      ctx.lineTo(hx - fx * 7, y - h - hop - 18);
      ctx.stroke();
      ctx.strokeStyle = tone('#e5383b');
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }

  if (!e.defeated) legs(ctx, x, y + hd + 1, e.walkPhase, hw * 0.5, id === 'heavy' ? 6.5 : id === 'fast' ? 4 : 5);

  // the Bailiff's notice board is carried in front, so it is drawn behind the body when he faces away
  const board = (): void => {
    const bx = x + fx * (hw + 7);
    const by = y + hd - 4 + fy * 12 - hop;
    const ax0 = bx + px * 17;
    const ay0 = by + py * 9;
    const ax1 = bx - px * 17;
    const ay1 = by - py * 9;
    const tall = 27;
    ctx.lineJoin = 'round';
    ctx.fillStyle = e.blockFlash > 0.1 ? '#ffffff' : tone('#fbf6e9');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ax0, ay0);
    ctx.lineTo(ax1, ay1);
    ctx.lineTo(ax1, ay1 - tall);
    ctx.lineTo(ax0, ay0 - tall);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // red header and a few lines of small print
    ctx.strokeStyle = tone('#e5383b');
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(ax0 + (ax1 - ax0) * 0.1, ay0 + (ay1 - ay0) * 0.1 - tall + 6);
    ctx.lineTo(ax0 + (ax1 - ax0) * 0.9, ay0 + (ay1 - ay0) * 0.9 - tall + 6);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(34, 27, 54, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const ly = -tall + 13 + i * 4.5;
      ctx.moveTo(ax0 + (ax1 - ax0) * 0.15, ay0 + (ay1 - ay0) * 0.15 + ly);
      ctx.lineTo(ax0 + (ax1 - ax0) * (i === 2 ? 0.6 : 0.85), ay0 + (ay1 - ay0) * (i === 2 ? 0.6 : 0.85) + ly);
    }
    ctx.stroke();
  };
  if (type.shield && !e.defeated && fy < -0.1) board();

  // ── body ──
  const outline = (c: Ctx): void => c.rect(-hw, -hd, hw * 2, hd * 2);
  prism(ctx, x, y, 0, lift, h + hop, outline, tone(build.side), tone(build.top));

  // ── top: tape, lid, flaps ──
  if (id !== 'fast' && id !== 'heavy') {
    onTop(ctx, x, y, 0, h + hop, (c) => {
      c.fillStyle = tone(id === 'electric' ? '#ffd23f' : TAPE);
      c.fillRect(-4, -hd, 8, hd * 2);
    });
    // side flaps stand up like ears, and perk when the mover is about to lunge
    const perk = Math.sin(e.walkPhase * 2) * 2 + windup * 7 + flash * 4 + (e.defeated ? 8 : 0);
    ctx.fillStyle = tone(KRAFT_LIGHT);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    for (const side of [-1, 1]) {
      const ex = x + hw * side;
      ctx.beginPath();
      ctx.moveTo(ex, topY - hd + 1);
      ctx.lineTo(ex, topY + hd - 1);
      ctx.lineTo(ex + side * 8, topY + hd - 6 - perk);
      ctx.lineTo(ex + side * 8, topY - hd - 3 - perk);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else if (id === 'heavy') {
    onTop(ctx, x, y, 0, h + hop, (c) => {
      c.strokeStyle = tone('#7a4f28');
      c.lineWidth = 2;
      c.beginPath();
      for (const lx of [-11, 0, 11]) {
        c.moveTo(lx, -hd);
        c.lineTo(lx, hd);
      }
      c.stroke();
    });
  }

  // ── front face ──
  const cx = x + fx * (id === 'fast' ? 2.5 : 4);
  const faceH = faceBottom - faceTop;
  if (shockFrame) {
    xray(ctx, x, faceTop + 2, faceBottom, hw);
  } else if (id === 'fast') {
    // airmail border
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = tone('#e5383b');
    ctx.strokeRect(x - hw + 2.5, faceTop + 2.5, hw * 2 - 5, faceH - 4);
    ctx.lineDashOffset = 5;
    ctx.strokeStyle = tone('#2f4fb5');
    ctx.strokeRect(x - hw + 2.5, faceTop + 2.5, hw * 2 - 5, faceH - 4);
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    // the flap is a scowl
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x - hw + 3, faceTop + 4);
    ctx.lineTo(cx, faceTop + faceH * 0.42);
    ctx.lineTo(x + hw - 3, faceTop + 4);
    ctx.stroke();
    if (!away) {
      const ey = faceTop + faceH * 0.56;
      ctx.fillStyle = INK;
      for (const side of [-1, 1]) {
        const ex = cx + 4.6 * side;
        if (e.defeated) {
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(ex - 2, ey - 2);
          ctx.lineTo(ex + 2, ey + 2);
          ctx.moveTo(ex + 2, ey - 2);
          ctx.lineTo(ex - 2, ey + 2);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.ellipse(ex + fx, ey + fy * 0.8, 2, 2.8, 0, 0, TAU);
          ctx.fill();
        }
      }
      tearMouth(ctx, cx, faceTop + faceH * 0.76, 3.5, windup);
    }
    // postage stamp
    ctx.fillStyle = tone('#e5383b');
    ctx.fillRect(x + hw - 9, faceTop + 5, 5, 6);
    if (!e.defeated) {
      // it never stops moving
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const ly = faceTop + 6 + i * 7;
        const len = 7 + hash(Math.floor(time * 12) + i) * 8;
        ctx.moveTo(x - fx * (hw + 4) - px * 2, ly);
        ctx.lineTo(x - fx * (hw + 4 + len) - px * 2, ly);
      }
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
  } else if (id === 'heavy') {
    // slats, with something staring out of the gap
    const gapY = faceTop + faceH * 0.36;
    ctx.fillStyle = shockFrame ? '#1a1530' : '#17132a';
    ctx.fillRect(x - hw + 2, gapY - 4, hw * 2 - 4, 9);
    if (!away) eyes(ctx, cx, gapY + 0.5, 6.5, fx, fy, 3.2, e.defeated);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const fraction of [0.62, 0.82]) {
      ctx.moveTo(x - hw + 1, faceTop + faceH * fraction);
      ctx.lineTo(x + hw - 1, faceTop + faceH * fraction);
    }
    ctx.stroke();
    // steel corner brackets
    ctx.fillStyle = tone(STEEL);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + side * (hw - 1), faceTop + 1);
      ctx.lineTo(x + side * (hw - 9), faceTop + 1);
      ctx.lineTo(x + side * (hw - 1), faceTop + 9);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + side * (hw - 1), faceBottom - 1);
      ctx.lineTo(x + side * (hw - 9), faceBottom - 1);
      ctx.lineTo(x + side * (hw - 1), faceBottom - 9);
      ctx.closePath();
      ctx.fill();
    }
    // "this way up"
    ctx.strokeStyle = 'rgba(34, 27, 54, 0.7)';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    for (const ox of [-13, -6]) {
      ctx.moveTo(x + ox - 3, faceBottom - 6);
      ctx.lineTo(x + ox, faceBottom - 10);
      ctx.lineTo(x + ox + 3, faceBottom - 6);
    }
    ctx.stroke();
  } else {
    // parcel tape running down the front
    ctx.fillStyle = tone(id === 'electric' ? '#ffd23f' : TAPE);
    ctx.fillRect(x - 4, faceTop + 1, 8, faceH - 1);
    if (away) {
      // from behind: a shipping label and a barcode
      ctx.fillStyle = tone('#fbf6e9');
      ctx.fillRect(x - 9, faceTop + 6, 18, 10);
      ctx.fillStyle = INK;
      for (let i = 0; i < 6; i++) ctx.fillRect(x - 7 + i * 2.6, faceTop + 8, i % 2 === 0 ? 1.6 : 0.9, 6);
    } else {
      // eyes in the hand-hole
      const slotY = faceTop + faceH * 0.36;
      ctx.fillStyle = '#17132a';
      ctx.beginPath();
      ctx.ellipse(cx, slotY, 10, 4.8, 0, 0, TAU);
      ctx.fill();
      eyes(ctx, cx, slotY + 0.4, 4.4, fx, fy, 2.9, e.defeated);
      if (!e.defeated) {
        // heavy lid cut straight across: permanently unimpressed
        ctx.fillStyle = tone(build.side);
        ctx.beginPath();
        ctx.moveTo(cx - 10.5, slotY - 5.5);
        ctx.lineTo(cx + 10.5, slotY - 5.5);
        ctx.lineTo(cx + 10.5, slotY - 2.6);
        ctx.lineTo(cx, slotY - 0.6 - windup * 1.5);
        ctx.lineTo(cx - 10.5, slotY - 2.6);
        ctx.closePath();
        ctx.fill();
      }
      tearMouth(ctx, cx, faceTop + faceH * 0.68, 5, windup);
    }
    if (id === 'shield' && !away) {
      // a tie makes it official
      const ty = faceTop + faceH * 0.56;
      ctx.fillStyle = tone('#2f4fb5');
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x - 2.5, ty + 5);
      ctx.lineTo(x + 2.5, ty + 5);
      ctx.lineTo(x + 3.5, ty + 12);
      ctx.lineTo(x, ty + 15);
      ctx.lineTo(x - 3.5, ty + 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (id !== 'electric') {
      // FRAGILE sticker
      ctx.fillStyle = tone('#e5383b');
      ctx.fillRect(x + hw - 11, faceBottom - 9, 8, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + hw - 9.5, faceBottom - 6.5, 5, 1.4);
    }
  }

  if (!shockFrame) newcomerProps(ctx, e, x, y, faceTop, faceBottom, topY, hw, hd, time, tone, away);

  // ── props ──
  if (id === 'electric' && !shockFrame) {
    // a string of fairy lights wound round the box, blinking out of order
    ctx.strokeStyle = '#235a3c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const wx = x - hw - 3 + t * (hw * 2 + 6);
      const wy = faceTop + faceH * 0.9 + Math.sin(t * 9 + 1) * 3 - t * 5;
      if (i === 0) ctx.moveTo(wx, wy);
      else ctx.lineTo(wx, wy);
    }
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const t = (i + 0.5) / 5;
      const bx = x - hw - 3 + t * (hw * 2 + 6);
      const by = faceTop + faceH * 0.9 + Math.sin(t * 9 + 1) * 3 - t * 5 + 3;
      const lit = Math.floor(time * 5 + i * 1.7) % 2 === 0;
      const color = BULBS[i % BULBS.length]!;
      if (lit) {
        ctx.fillStyle = 'rgba(255, 255, 220, 0.3)';
        ctx.beginPath();
        ctx.arc(bx, by, 6, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = lit ? color : mix(color, '#2a2330', 0.55);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.ellipse(bx, by, 2.4, 3.1, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    // the loose plug that causes all the trouble
    const plugX = x + hw + 7;
    const plugY = faceBottom - 4 + Math.sin(time * 6) * 2;
    ctx.strokeStyle = '#235a3c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + hw + 3, faceTop + faceH * 0.5);
    ctx.quadraticCurveTo(plugX + 6, faceTop + faceH * 0.7, plugX, plugY);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.fillRect(plugX - 2.5, plugY - 1, 5, 5);
  }

  if (e.helmetHp > 0) {
    // your saucepan, upside down, handle sticking out sideways
    const panY = topY - 3;
    const handle = px >= 0 ? 1 : -1;
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x + handle * 10, panY - 2);
    ctx.lineTo(x + handle * 28, panY - 5);
    ctx.stroke();
    ctx.strokeStyle = '#3b3550';
    ctx.lineWidth = 3.4;
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = tone(STEEL_DARK);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, panY + 3, hw + 2, hd * 0.8, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = tone(STEEL);
    ctx.beginPath();
    ctx.ellipse(x, panY - 3, hw + 1, hd * 0.78, 0, 0, TAU);
    ctx.rect(x - hw - 1, panY - 3, hw * 2 + 2, 6);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, panY - 3, hw + 1, hd * 0.78, 0, Math.PI, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - hw - 1, panY - 3);
    ctx.lineTo(x - hw - 1, panY + 3);
    ctx.moveTo(x + hw + 1, panY - 3);
    ctx.lineTo(x + hw + 1, panY + 3);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x - 5, panY - 4, 5, Math.PI * 1.1, Math.PI * 1.5);
    ctx.stroke();
  }

  // ── something over its head, or hanging off its face ──
  if (e.plunged > 0 && !e.defeated && (e.wearing === 'trashcan' || e.wearing === 'bucket')) {
    // upside down over the top of the box, a good deal lower than a hat
    const bin = e.wearing === 'trashcan';
    const rimY = faceTop + faceH * 0.5;
    const capY = topY - (bin ? 13 : 9);
    const wobble = Math.sin(time * 13) * 1.6;
    const bw = hw + (bin ? 5 : 3);
    ctx.fillStyle = tone(bin ? '#7c869b' : STEEL_DARK);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - bw - 2 + wobble, rimY);
    ctx.lineTo(x - bw + 3 + wobble, capY);
    ctx.lineTo(x + bw - 3 + wobble, capY);
    ctx.lineTo(x + bw + 2 + wobble, rimY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = tone(bin ? '#c3cbda' : STEEL);
    ctx.beginPath();
    ctx.ellipse(x + wobble, capY, bw - 3, 5, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    if (bin) {
      ctx.strokeStyle = tone('#5f687c');
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const off of [-0.5, 0, 0.5]) {
        ctx.moveTo(x + wobble + off * bw, capY + 7);
        ctx.lineTo(x + wobble + off * (bw + 3), rimY - 3);
      }
      ctx.stroke();
    }
  } else if (e.plunged > 0 && !e.defeated && e.wearing === 'teddy') {
    // arms round its face and not letting go
    const ty = faceTop + faceH * 0.42 + Math.sin(time * 12) * 1.2;
    const fur = tone('#b07a45');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(cx - 6, ty);
    ctx.lineTo(cx - hw - 1, ty - 3);
    ctx.moveTo(cx + 6, ty);
    ctx.lineTo(cx + hw + 1, ty - 3);
    ctx.stroke();
    ctx.strokeStyle = fur;
    ctx.lineWidth = 4.4;
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = fur;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(cx, ty + 4, 8.5, 9, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + side * 6, ty - 8.5, 3, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, ty - 4, 6.5, 0, TAU);
    ctx.fill();
    ctx.stroke();
  } else if (e.plunged > 0 && !e.defeated) {
    const py0 = faceTop + faceH * 0.4;
    ctx.fillStyle = tone('#c2352f');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(cx, py0, 9, 6.5, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    const wobble = Math.sin(time * 14) * 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(cx, py0);
    ctx.lineTo(cx + wobble, py0 + 19);
    ctx.stroke();
    ctx.strokeStyle = '#c98a4b';
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  // ── arms ──
  if (!e.defeated && id !== 'fast') {
    const armY = faceTop + faceH * 0.55;
    const swing = Math.sin(e.walkPhase) * 3;
    const raise = windup * 12;
    const reach = e.ai === 'lunge' ? 9 : 0;
    const color = tone(id === 'heavy' ? '#7a4f28' : KRAFT_DARK);
    if (!type.shield) mitt(ctx, x - hw, armY, x - hw - 6 + fx * reach, armY + 4 + swing - raise + fy * reach * 0.6, color);
    mitt(ctx, x + hw, armY, x + hw + 6 + fx * reach, armY + 4 - swing - raise + fy * reach * 0.6, color);
  }

  if (type.shield && !e.defeated && fy >= -0.1) board();
  ctx.restore();

  if (e.defeated) return;

  // overhead status
  const top = topY - 16 - (e.helmetHp > 0 ? 8 : 0);
  if (e.ai === 'windup') {
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    const s = 1 + windup * 0.5;
    ctx.beginPath();
    ctx.moveTo(x - 3 * s, top - 14 * s);
    ctx.lineTo(x + 3 * s, top - 14 * s);
    ctx.lineTo(x + 1.5 * s, top - 4 * s);
    ctx.lineTo(x - 1.5 * s, top - 4 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, top, 2.2 * s, 0, TAU);
    ctx.fill();
    ctx.stroke();
  } else if (e.stun > 0.15 || e.confuse > 0) {
    for (let i = 0; i < 3; i++) {
      const a = time * 6 + (i * TAU) / 3;
      ctx.fillStyle = i === 0 ? '#ffffff' : '#ffd23f';
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 11, top + Math.sin(a) * 4, 2.6, 0, TAU);
      ctx.fill();
    }
  } else if (e.ai === 'idle' || e.ai === 'investigate') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.font = '800 16px sans-serif';
    ctx.textAlign = 'center';
    const mark = e.lured ? '♪' : '?';
    ctx.strokeText(mark, x, top);
    ctx.fillText(mark, x, top);
  }

  // what is left of it, as a strip of parcel tape running out
  if (e.hp < type.hp) {
    const w = hw * 1.8;
    const ratio = Math.max(0, e.hp / type.hp);
    ctx.fillStyle = INK;
    ctx.fillRect(x - w / 2 - 1.5, y + hd + 9, w + 3, 6);
    ctx.fillStyle = ratio > 0.4 ? TAPE : '#ff5a4e';
    ctx.fillRect(x - w / 2, y + hd + 10.5, w * ratio, 3);
  }
}
