import { TAU } from '../core/math';
import type { Block, Level } from '../levels/Level';
import { roundRect } from './DrawUtils';
import { C, rgba } from './Palette';

/** The sun is up and to the left: a thing of height h throws its shadow this far per unit of h. */
export const SUN_X = 0.75;
export const SUN_Y = 0.55;

const corners = new Float32Array(8);
const CORNER_X = [-1, 1, 1, -1] as const;
const CORNER_Y = [-1, -1, 1, 1] as const;

/** World-space corners of a block's footprint, shifted by (dx, dy). */
function footprint(b: Block, dx: number, dy: number): Float32Array {
  const c = Math.cos(b.angle);
  const s = Math.sin(b.angle);
  const hw = b.w / 2;
  const hh = b.h / 2;
  for (let i = 0; i < 4; i++) {
    const lx = CORNER_X[i] * hw;
    const ly = CORNER_Y[i] * hh;
    corners[i * 2] = b.x + dx + lx * c - ly * s;
    corners[i * 2 + 1] = b.y + dy + lx * s + ly * c;
  }
  return corners;
}

function polygon(ctx: CanvasRenderingContext2D, p: Float32Array, dx: number, dy: number): void {
  ctx.beginPath();
  ctx.moveTo(p[0] + dx, p[1] + dy);
  for (let i = 1; i < 4; i++) ctx.lineTo(p[i * 2] + dx, p[i * 2 + 1] + dy);
  ctx.closePath();
}

/** Fills the area a quad sweeps as it slides by (dx, dy): its footprint, its far copy, and between. */
function sweep(ctx: CanvasRenderingContext2D, p: Float32Array, dx: number, dy: number): void {
  polygon(ctx, p, 0, 0);
  ctx.fill();
  polygon(ctx, p, dx, dy);
  ctx.fill();
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    ctx.beginPath();
    ctx.moveTo(p[i * 2], p[i * 2 + 1]);
    ctx.lineTo(p[j * 2], p[j * 2 + 1]);
    ctx.lineTo(p[j * 2] + dx, p[j * 2 + 1] + dy);
    ctx.lineTo(p[i * 2] + dx, p[i * 2 + 1] + dy);
    ctx.closePath();
    ctx.fill();
  }
}

export function paintStaticShadows(ctx: CanvasRenderingContext2D, level: Level): void {
  ctx.fillStyle = C.shadow;
  for (const b of level.blocks) if (!b.gone) sweep(ctx, footprint(b, 0, 0), b.lift * SUN_X, b.lift * SUN_Y);
  const g = level.goal;
  // Posts and crossbar.
  ctx.lineCap = 'round';
  ctx.strokeStyle = C.shadow;
  ctx.lineWidth = g.postR * 2;
  for (const px of [g.leftPostX, g.rightPostX]) {
    ctx.beginPath();
    ctx.moveTo(px, g.postY);
    ctx.lineTo(px + g.height * SUN_X, g.postY + g.height * SUN_Y);
    ctx.stroke();
  }
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(g.leftPostX + g.height * SUN_X, g.postY + g.height * SUN_Y);
  ctx.lineTo(g.rightPostX + g.height * SUN_X, g.postY + g.height * SUN_Y);
  ctx.stroke();
}

interface BlockLook {
  top: string;
  side: string;
}

const LOOKS: Readonly<Record<Block['kind'], BlockLook>> = {
  rail: { top: C.white, side: C.whiteShade },
  kerb: { top: C.stone, side: C.stoneDark },
  wall: { top: C.white, side: C.blue },
  hedge: { top: '#5da24a', side: '#2f6f2c' },
  crate: { top: C.wood, side: C.woodDark },
  car: { top: C.sun, side: C.sunDark },
  shutter: { top: C.blueLite, side: C.blueDark },
  defender: { top: '#1b2540', side: '#101a30' },
  adboard: { top: '#1b2540', side: '#eef1f8' },
};

/** A pillar cap for a shared boundary vertex: shadow, dark body, white cap, red band. */
export function drawBoundaryJoint(ctx: CanvasRenderingContext2D, joint: { x: number; y: number }): void {
  const r = 17;
  const lift = 22;
  ctx.fillStyle = rgba(C.shadow, 0.3);
  ctx.beginPath();
  ctx.ellipse(joint.x + r * SUN_X * 0.6, joint.y + r * SUN_Y * 0.6, r * 1.15, r * 0.55, 0, 0, TAU);
  ctx.fill();
  // Pillar body, with a darker lower crescent for depth.
  ctx.fillStyle = '#10172b';
  ctx.beginPath();
  ctx.arc(joint.x, joint.y - 2, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = rgba(C.navy, 0.4);
  ctx.beginPath();
  ctx.arc(joint.x, joint.y - 2, r, Math.PI * 0.15, Math.PI * 0.85);
  ctx.fill();
  // White cap on top, rimmed in blue, with the trim dash like the wall faces.
  ctx.fillStyle = '#e8ecf5';
  ctx.beginPath();
  ctx.arc(joint.x, joint.y - lift, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba(C.terra, 0.95);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = rgba(C.terra, 0.95);
  ctx.fillRect(joint.x - 8, joint.y - lift - 1.5, 16, 3);
}

/** A solid block in the game's oblique view: footprint on the ground, top face lifted straight up. */
export function drawBlock(ctx: CanvasRenderingContext2D, b: Block, time = 0): void {
  // Recoil away from the ball, easing out with the square of the hit.
  const push = b.hit * b.hit * 5;
  const ox = -b.hitNx * push;
  const oy = -b.hitNy * push;
  if (b.kind === 'car') {
    drawTaxi(ctx, b, ox, oy);
    return;
  }
  // Boundary bands butt together like masonry; the pillar caps cover the joints.
  let blk = b;
  if (b.boundary && b.trim) {
    // An explicit outline: only the ends that meet a pillar cap give way to it.
    const [t0, t1] = b.trim;
    const sh = (t0 - t1) / 2;
    blk = { ...b, w: b.w - t0 - t1, x: b.x + Math.cos(b.angle) * sh, y: b.y + Math.sin(b.angle) * sh };
  } else if (b.boundary) {
    const shrink = b.h + 2;
    blk = { ...b, w: b.w - shrink };
  }
  const p = footprint(blk, ox, oy);
  const lift = blk.lift;
  // The boundary walls round the pitch are advertising boards.
  const board = (blk.boundary && blk.kind === 'wall') || blk.kind === 'adboard';
  // The low barrier along the near end is a dark rail with a lit edge.
  const kerbBoard = !!blk.boundary && blk.kind === 'kerb';
  const look = board ? { top: '#1b2540', side: '#eef1f8' } : kerbBoard ? { top: '#26345f', side: '#c9d1e6' } : LOOKS[blk.kind];

  // Side faces. Only those turned towards the viewer end up visible; the top covers the rest.
  ctx.fillStyle = look.side;
  // The ends of a band in one smooth outline are not faces at all: the next band carries on from them.
  const joined = !!blk.boundary && !!b.trim;
  for (let i = 0; i < 4; i++) {
    if (joined && (i === 1 || i === 3)) continue;
    const j = (i + 1) % 4;
    ctx.beginPath();
    ctx.moveTo(p[i * 2], p[i * 2 + 1]);
    ctx.lineTo(p[j * 2], p[j * 2 + 1]);
    ctx.lineTo(p[j * 2], p[j * 2 + 1] - lift);
    ctx.lineTo(p[i * 2], p[i * 2 + 1] - lift);
    ctx.closePath();
    ctx.fill();
  }
  polygon(ctx, p, 0, -lift);
  ctx.fillStyle = look.top;
  ctx.fill();

  // Surface detail, drawn in the block's own frame and clipped to its top face.
  ctx.save();
  ctx.clip();
  ctx.translate(blk.x + ox, blk.y + oy - lift);
  ctx.rotate(blk.angle);
  const hw = blk.w / 2;
  const hh = blk.h / 2;
  if (blk.kind === 'crate') {
    // Slats, and the oranges inside.
    ctx.strokeStyle = C.woodDark;
    ctx.lineWidth = 4;
    ctx.strokeRect(-hw + 4, -hh + 4, blk.w - 8, blk.h - 8);
    const cols = Math.max(1, Math.floor((blk.w - 20) / 26));
    const rows = Math.max(1, Math.floor((blk.h - 20) / 24));
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = -((cols - 1) * 26) / 2 + i * 26 + (j % 2 === 0 ? 0 : 5);
        const y = -((rows - 1) * 24) / 2 + j * 24;
        ctx.fillStyle = C.orange;
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, TAU);
        ctx.fill();
        ctx.fillStyle = rgba('#ffffff', 0.4);
        ctx.beginPath();
        ctx.arc(x - 3.5, y - 4, 3, 0, TAU);
        ctx.fill();
      }
    }
  } else if (blk.kind === 'defender') {
    // A man in the wall seen from above: broad shoulders in club colours and a head.
    ctx.fillStyle = '#2b3b6b';
    ctx.fillRect(-hw + 2, -hh + 2, blk.w - 4, blk.h - 4);
    ctx.fillStyle = rgba(C.greenHi, 0.55);
    ctx.fillRect(-hw + 2, -3, blk.w - 4, 6);
    ctx.fillStyle = '#e0b48f';
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(hw, hh) * 0.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#101a30';
    ctx.beginPath();
    ctx.arc(0, -1.5, Math.min(hw, hh) * 0.42, Math.PI, 0);
    ctx.fill();
  } else if (kerbBoard) {
    ctx.fillStyle = rgba(C.sun, 0.9);
    if (blk.w >= blk.h) ctx.fillRect(-hw, -2, blk.w, 4);
    else ctx.fillRect(-2, -hh, 4, blk.h);
  } else if (board) {
    // Advertising boards: panels of colour along the face, separated by a thin dark seam. Where the wall is one
    // outline the panels are numbered along the whole wall, so they run on round the corners.
    const along = blk.w >= blk.h;
    const len = along ? blk.w : blk.h;
    const wid = along ? blk.h : blk.w;
    const panel = 96;
    const colours = [C.terra, C.sun, C.white, '#3f8cff'] as const;
    const start = (blk.along ?? 0) + (b.trim ? b.trim[0] : 0);
    const first = blk.along === undefined ? 0 : Math.floor(start / panel);
    const last = blk.along === undefined ? Math.ceil(len / panel) : Math.floor((start + len) / panel);
    for (let k = first; k <= last; k++) {
      // The panel's span in the band's own frame, measured from the band's centre.
      const g0 = blk.along === undefined ? k * panel : k * panel - start;
      const g1 = g0 + panel;
      const s0 = Math.max(g0, 0) - len / 2;
      const s1 = Math.min(g1, len) - len / 2;
      // A seam only where a panel really ends; where it carries on into the next band the two meet with no gap.
      const seam0 = g0 >= 0 ? 2 : -0.8;
      const seam1 = g1 <= len ? 2 : -0.8;
      const size = s1 - s0 - seam0 - seam1;
      if (size <= 3) continue;
      // LED boards: every few seconds the ads rotate one panel along.
      ctx.fillStyle = colours[(k + Math.floor(time / 2.6)) % colours.length];
      if (along) ctx.fillRect(s0 + seam0, -wid / 2 + 3, size, wid - 6);
      else ctx.fillRect(-wid / 2 + 3, s0 + seam0, wid - 6, size);
      // The dark label in the middle of the panel, in the panel's own span so it lines up across bands.
      const l0 = Math.max(s0, g0 + panel * 0.18 - len / 2);
      const l1 = Math.min(s1, g0 + panel * 0.82 - len / 2);
      if (l1 > l0) {
        ctx.fillStyle = rgba('#1b2540', 0.75);
        if (along) ctx.fillRect(l0, -2, l1 - l0, 4);
        else ctx.fillRect(-2, l0, 4, l1 - l0);
      }
    }
  } else if (blk.kind === 'wall') {
    // A line of blue tile along the cap.
    ctx.fillStyle = rgba(C.blue, 0.85);
    const tile = 14;
    const along = blk.w >= blk.h;
    const len = along ? blk.w : blk.h;
    for (let d = -len / 2 + 10; d < len / 2 - 10; d += tile * 2) {
      if (along) ctx.fillRect(d, -3, tile, 6);
      else ctx.fillRect(-3, d, 6, tile);
    }
  } else if (blk.kind === 'shutter') {
    // Roller-shutter slats, and the yellow pull bar along the bottom.
    ctx.strokeStyle = rgba(C.blueDark, 0.55);
    ctx.lineWidth = 2;
    for (let y = -hh + 5; y < hh - 4; y += 6) {
      ctx.beginPath();
      ctx.moveTo(-hw + 3, y);
      ctx.lineTo(hw - 3, y);
      ctx.stroke();
    }
    ctx.fillStyle = C.sun;
    ctx.fillRect(-hw, hh - 5, blk.w, 5);
  } else if (blk.kind === 'hedge') {
    // Leafy hedge: dark scallops over the green, lighter tufts on top.
    ctx.fillStyle = rgba('#1e4d1e', 0.5);
    const cols = Math.max(2, Math.floor(blk.w / 26));
    const rows = Math.max(1, Math.floor(blk.h / 24));
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = -hw + 13 + (i * (blk.w - 26)) / Math.max(1, cols - 1);
        const y = -hh + 12 + (j * (blk.h - 24)) / Math.max(1, rows - 1);
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, TAU);
        ctx.fill();
      }
    }
    ctx.fillStyle = rgba('#bfe6a8', 0.7);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = -hw + 13 + (i * (blk.w - 26)) / Math.max(1, cols - 1) - 3;
        const y = -hh + 12 + (j * (blk.h - 24)) / Math.max(1, rows - 1) - 3;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, TAU);
        ctx.fill();
      }
    }
  } else {
    ctx.strokeStyle = rgba(C.shadow, 0.1);
    ctx.lineWidth = 2;
    ctx.strokeRect(-hw + 5, -hh + 5, blk.w - 10, blk.h - 10);
  }
  if (blk.hit > 0) {
    ctx.fillStyle = rgba(blk.kind === 'crate' ? '#ffffff' : C.sun, blk.hit * 0.45);
    ctx.fillRect(-hw, -hh, blk.w, blk.h);
  }
  ctx.restore();
}

/** The parked taxi, built as a stack of slices so its rounded body reads as a volume. */
function drawTaxi(ctx: CanvasRenderingContext2D, b: Block, ox: number, oy: number): void {
  const hw = b.w / 2;
  const hh = b.h / 2;
  const alarm = b.hit > 0 && Math.sin(b.hit * 40) > 0;
  const slice = (lift: number, draw: () => void): void => {
    ctx.save();
    ctx.translate(b.x + ox, b.y + oy - lift);
    ctx.rotate(b.angle);
    draw();
    ctx.restore();
  };
  const body = (): void => roundRect(ctx, -hw, -hh, b.w, b.h, Math.min(24, hh * 0.6));

  // Wheels on the ground.
  slice(0, () => {
    ctx.fillStyle = C.rubber;
    for (const sx of [-0.3, 0.3]) {
      for (const sy of [-1, 1]) roundRect(ctx, sx * b.w - 15, sy * hh - (sy < 0 ? 4 : 5), 30, 9, 4), ctx.fill();
    }
  });
  for (let k = 3; k <= b.lift; k += 3) {
    slice(k, () => {
      body();
      ctx.fillStyle = C.sunDark;
      ctx.fill();
    });
  }
  slice(b.lift, () => {
    body();
    ctx.fillStyle = C.sun;
    ctx.fill();
    // Cabin: rear window, roof, windscreen. The bonnet is at +x.
    const ch = b.h * 0.74;
    roundRect(ctx, -b.w * 0.36, -ch / 2, b.w * 0.62, ch, 12);
    ctx.fillStyle = rgba(C.navy, 0.82);
    ctx.fill();
    roundRect(ctx, -b.w * 0.27, -ch / 2, b.w * 0.42, ch, 8);
    ctx.fillStyle = '#ffe08a';
    ctx.fill();
    ctx.fillStyle = rgba('#ffffff', 0.35);
    ctx.fillRect(b.w * 0.17, -ch * 0.36, 4, ch * 0.3);
    // Roof sign.
    roundRect(ctx, -b.w * 0.09, -9, 20, 18, 4);
    ctx.fillStyle = C.white;
    ctx.fill();
    ctx.fillStyle = C.navy;
    ctx.fillRect(-b.w * 0.09 + 6, -5, 8, 10);
    // Lights: they flash when the alarm goes.
    ctx.fillStyle = alarm ? C.orange : C.white;
    for (const sy of [-1, 1]) roundRect(ctx, hw - 9, sy * hh * 0.62 - 6, 7, 12, 3), ctx.fill();
    ctx.fillStyle = alarm ? C.orange : C.terra;
    for (const sy of [-1, 1]) roundRect(ctx, -hw + 2, sy * hh * 0.62 - 6, 6, 12, 3), ctx.fill();
  });
}
