import { INK } from '../core/constants';
import { TAU, easeInQuad } from '../core/math';
import type { PhysicsObject } from '../entities/PhysicsObject';
import { hash, mix, onTop, prism, roundRectPath, type Ctx, type PathFn } from './draw';

/** Everything an object drawing needs: interpolated pose plus a colour toner for state. */
export interface ArtContext {
  readonly ctx: Ctx;
  readonly o: PhysicsObject;
  /** Ground position (height is passed separately as `z`). */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly angle: number;
  readonly time: number;
  /** Applies charring / hit-flash / electrified tint to a base colour. */
  readonly tone: (color: string) => string;
}

type ArtFn = (a: ArtContext) => void;

const BOOK_COVERS = ['#3f7cac', '#c8553d', '#5b8e5a', '#8e5b9c', '#d99a2b'];

function shapePath(o: PhysicsObject): PathFn {
  const s = o.body.shape;
  if (s.kind === 'circle') return (c) => c.arc(0, 0, s.r, 0, TAU);
  return (c) => roundRectPath(c, -s.hw, -s.hh, s.hw * 2, s.hh * 2, Math.min(4, s.hh));
}

function cracks(c: Ctx, seed: number, extent: number): void {
  c.strokeStyle = INK;
  c.lineWidth = 1.5;
  c.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = hash(seed * 7 + i) * TAU;
    const r = extent * (0.5 + hash(seed * 3 + i) * 0.5);
    c.moveTo(0, 0);
    c.lineTo(Math.cos(a) * r * 0.5 + 2, Math.sin(a) * r * 0.5 - 2);
    c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  c.stroke();
}

const chair: ArtFn = ({ ctx, o, x, y, z, angle, tone }) => {
  const seat: PathFn = (c) => roundRectPath(c, -13, -15, 30, 30, 5);
  const back: PathFn = (c) => roundRectPath(c, -18, -16, 8, 32, 3);
  const drawBack = (): void => prism(ctx, x, y, angle, z, z + 27, back, tone('#8f5a2c'), tone('#c98a4b'));
  const drawSeat = (): void => {
    prism(ctx, x, y, angle, z, z + 12, seat, tone('#8f5a2c'), tone('#c98a4b'));
    onTop(ctx, x, y, angle, z + 12, (c) => {
      c.fillStyle = tone('#3fa7a3');
      c.beginPath();
      roundRectPath(c, -8, -10, 20, 20, 4);
      c.fill();
      if (o.structural === 'damaged') cracks(c, o.seed, 14);
    });
  };
  // Whichever part is lower on screen is nearer the camera and must be drawn last.
  if (Math.sin(angle) * -14 > 0) {
    drawSeat();
    drawBack();
  } else {
    drawBack();
    drawSeat();
  }
};

const table: ArtFn = ({ ctx, x, y, z, angle, tone }) => {
  const top: PathFn = (c) => roundRectPath(c, -64, -38, 128, 76, 7);
  // Legs are just dark feet peeking out under the slab.
  ctx.fillStyle = INK;
  for (const [lx, ly] of [[-54, -28], [54, -28], [-54, 28], [54, 28]] as const) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const wx = x + lx * c - ly * s;
    const wy = y + lx * s + ly * c;
    ctx.fillRect(wx - 4, wy - z - 13, 8, 14);
  }
  prism(ctx, x, y, angle, z + 14, z + 22, top, tone('#9a6535'), tone('#dba56a'));
  onTop(ctx, x, y, angle, z + 22, (c) => {
    c.strokeStyle = tone('#c08d55');
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-56, -13);
    c.lineTo(56, -13);
    c.moveTo(-56, 13);
    c.lineTo(56, 13);
    c.stroke();
  });
};

function lampShape(ctx: Ctx, bx: number, by: number, hx: number, hy: number, lit: boolean, broken: boolean, tone: (c: string) => string): void {
  const dx = hx - bx;
  const dy = hy - by;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // base
  ctx.fillStyle = tone('#4b4660');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(bx, by, 10, 7, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // pole
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.strokeStyle = tone('#aab4c4');
  ctx.lineWidth = 3;
  ctx.stroke();
  // shade: a trapezoid whose narrow end points away from the base
  const px = -uy;
  const py = ux;
  const near = 15;
  const far = 9;
  const depth = 20;
  ctx.beginPath();
  ctx.moveTo(hx - ux * 4 + px * near, hy - uy * 4 + py * near);
  ctx.lineTo(hx + ux * depth + px * far, hy + uy * depth + py * far);
  if (broken) {
    ctx.lineTo(hx + ux * (depth - 7) + px * 3, hy + uy * (depth - 7) + py * 3);
    ctx.lineTo(hx + ux * (depth - 1) - px * 2, hy + uy * (depth - 1) - py * 2);
  }
  ctx.lineTo(hx + ux * depth - px * far, hy + uy * depth - py * far);
  ctx.lineTo(hx - ux * 4 - px * near, hy - uy * 4 - py * near);
  ctx.closePath();
  ctx.fillStyle = tone(broken ? '#8d8676' : lit ? '#ffe9a6' : '#e8dcb8');
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = INK;
  ctx.fill();
  ctx.stroke();
  ctx.lineCap = 'butt';
}

const lamp: ArtFn = ({ ctx, o, x, y, z, angle, tone }) => {
  const spec = o.def.tip;
  const length = spec ? spec.length : 60;
  const broken = o.structural === 'broken';
  if (o.standing) {
    ctx.fillStyle = 'rgba(255, 221, 120, 0.13)';
    ctx.beginPath();
    ctx.ellipse(x, y, 52, 38, 0, 0, TAU);
    ctx.fill();
    lampShape(ctx, x, y - z, x, y - z - length + 14, true, false, tone);
    return;
  }
  if (o.tipProgress >= 0) {
    // Swing from upright to flat on the floor.
    const t = easeInQuad(Math.min(1, o.tipProgress)) * (Math.PI / 2);
    const reach = length - 14;
    const hx = x + o.tipDirX * reach * Math.sin(t);
    const hy = y + o.tipDirY * reach * Math.sin(t) - reach * Math.cos(t);
    lampShape(ctx, x, y, hx, hy, true, false, tone);
    return;
  }
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const half = length / 2;
  lampShape(ctx, x - c * half, y - s * half - z, x + c * (half - 14), y + s * (half - 14) - z, !broken, broken, tone);
};

const shoe: ArtFn = ({ ctx, x, y, z, angle, tone }) => {
  const sole: PathFn = (c) => roundRectPath(c, -11, -6, 22, 12, 6);
  prism(ctx, x, y, angle, z, z + 6, sole, tone('#f4efe2'), tone('#ff6b4a'), INK, 3.5);
  onTop(ctx, x, y, angle, z + 6, (c) => {
    c.fillStyle = tone('#ffd0c2');
    c.beginPath();
    c.arc(7, 0, 4, 0, TAU);
    c.fill();
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(-5, 0, 4.5, 3.5, 0, 0, TAU);
    c.fill();
    c.strokeStyle = '#ffffff';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(0, -3);
    c.lineTo(0, 3);
    c.moveTo(3, -3);
    c.lineTo(3, 3);
    c.stroke();
  });
};

const book: ArtFn = ({ ctx, o, x, y, z, angle, tone }) => {
  const cover = BOOK_COVERS[Math.floor(o.seed * BOOK_COVERS.length)] ?? '#3f7cac';
  const path: PathFn = (c) => roundRectPath(c, -12, -9, 24, 18, 2);
  prism(ctx, x, y, angle, z, z + 5, path, tone('#f4efe2'), tone(cover), INK, 3.5);
  onTop(ctx, x, y, angle, z + 5, (c) => {
    c.fillStyle = 'rgba(0,0,0,0.22)';
    c.fillRect(-12, -9, 4, 18);
    c.fillStyle = tone('#fff3d6');
    c.fillRect(-4, -4, 12, 3);
    c.fillRect(-4, 1, 8, 2);
  });
};

const computer: ArtFn = ({ ctx, o, x, y, z, angle, time, tone }) => {
  const body: PathFn = (c) => roundRectPath(c, -19, -15, 38, 30, 5);
  prism(ctx, x, y, angle, z, z + 17, body, tone('#a39d90'), tone('#e6e1d3'));
  onTop(ctx, x, y, angle, z + 17, (c) => {
    const broken = o.structural === 'broken';
    const flicker = o.structural === 'damaged' && hash(Math.floor(time * 14)) > 0.5;
    c.fillStyle = broken || flicker ? '#15131f' : '#24456b';
    c.beginPath();
    roundRectPath(c, -14, -10, 28, 20, 3);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2;
    c.stroke();
    if (broken) {
      cracks(c, o.seed, 13);
    } else if (!flicker) {
      c.fillStyle = '#7ff3ff';
      c.fillRect(-10, -6, 12, 2);
      c.fillRect(-10, -2, 18, 2);
      c.fillRect(-10, 2, 8, 2);
      if (Math.floor(time * 2) % 2 === 0) c.fillRect(0, 2, 3, 2);
    }
  });
};

const trashcan: ArtFn = ({ ctx, o, x, y, z, angle, tone }) => {
  const r = 15;
  const path: PathFn = (c) => c.arc(0, 0, r, 0, TAU);
  prism(ctx, x, y, angle, z, z + 20, path, tone('#7c869b'), tone('#c3cbda'));
  // ribs on the visible side
  ctx.strokeStyle = tone('#5f687c');
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const off of [-8, 0, 8]) {
    const sy = Math.sqrt(r * r - off * off);
    ctx.moveTo(x + off, y - z + sy - 2);
    ctx.lineTo(x + off, y - z + sy - 18);
  }
  ctx.stroke();
  onTop(ctx, x, y, angle, z + 20, (c) => {
    c.fillStyle = '#2f3345';
    c.beginPath();
    c.arc(0, 0, 11, 0, TAU);
    c.fill();
    if (o.structural !== 'broken') {
      c.fillStyle = tone('#f4efe2');
      c.beginPath();
      c.arc(-3, 2, 4.5, 0, TAU);
      c.arc(4, -3, 3.5, 0, TAU);
      c.fill();
    } else {
      cracks(c, o.seed, 12);
    }
  });
};

const bottle: ArtFn = ({ ctx, x, y, z, angle, tone }) => {
  ctx.globalAlpha = 0.9;
  prism(ctx, x, y, angle, z, z + 11, (c) => c.arc(0, 0, 7, 0, TAU), tone('#3f9e85'), tone('#7fe0c4'), INK, 3.5);
  prism(ctx, x, y, angle, z + 11, z + 18, (c) => c.arc(0, 0, 3, 0, TAU), tone('#3f9e85'), tone('#fff3d6'), INK, 3);
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(x - 4, y - z - 9, 2, 6);
};

const flowerpot: ArtFn = ({ ctx, x, y, z, angle, time, tone }) => {
  prism(ctx, x, y, angle, z, z + 12, (c) => c.arc(0, 0, 13, 0, TAU), tone('#a14e2b'), tone('#d9764a'));
  onTop(ctx, x, y, angle, z + 12, (c) => {
    c.fillStyle = '#4d3320';
    c.beginPath();
    c.arc(0, 0, 9.5, 0, TAU);
    c.fill();
  });
  // leaves stay upright on screen regardless of the pot's rotation
  const sway = Math.sin(time * 1.7 + x) * 0.08;
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.55 + sway;
    const lx = x + Math.cos(a) * 13;
    const ly = y - z - 14 + Math.sin(a) * 15;
    ctx.fillStyle = tone(i % 2 === 0 ? '#5fae57' : '#7cc96f');
    ctx.beginPath();
    ctx.ellipse(lx, ly, 9, 4.5, a, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
};

const fan: ArtFn = ({ ctx, o, x, y, z, angle, time, tone }) => {
  const body: PathFn = (c) => roundRectPath(c, -12, -16, 24, 32, 5);
  prism(ctx, x, y, angle, z, z + 22, body, tone('#8c86a3'), tone('#e8e4f0'));
  const powered = o.tags.has('powered');
  onTop(ctx, x, y, angle, z + 22, (c) => {
    c.fillStyle = '#35314a';
    c.beginPath();
    c.arc(0, 0, 9.5, 0, TAU);
    c.fill();
    c.fillStyle = tone('#4ad6e8');
    const spin = powered ? time * 22 : o.seed * 6;
    for (let i = 0; i < 3; i++) {
      const a = spin + (i * TAU) / 3;
      c.beginPath();
      c.ellipse(Math.cos(a) * 4.5, Math.sin(a) * 4.5, 5, 2.4, a, 0, TAU);
      c.fill();
    }
    // nozzle marks the direction it blows
    c.fillStyle = INK;
    c.beginPath();
    c.moveTo(12, -7);
    c.lineTo(17, 0);
    c.lineTo(12, 7);
    c.closePath();
    c.fill();
  });
};

function band(ctx: Ctx, x: number, y: number, r: number, color: string, width: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r - 1, 0.12 * Math.PI, 0.88 * Math.PI);
  ctx.stroke();
}

const extinguisher: ArtFn = ({ ctx, o, x, y, z, angle, tone }) => {
  prism(ctx, x, y, angle, z, z + 23, (c) => c.arc(0, 0, 10, 0, TAU), tone('#b32a2a'), tone('#e84a4a'));
  band(ctx, x, y - z - 10, 10, tone('#fff3d6'), 5);
  onTop(ctx, x, y, angle, z + 23, (c) => {
    c.fillStyle = INK;
    c.beginPath();
    c.arc(0, 0, 4.5, 0, TAU);
    c.fill();
    c.fillRect(0, -2, 12, 4);
    if (o.structural !== 'intact') cracks(c, o.seed, 9);
  });
};

const candle: ArtFn = ({ ctx, o, x, y, z, angle, tone }) => {
  prism(ctx, x, y, angle, z, z + 10, (c) => c.arc(0, 0, 6, 0, TAU), tone('#d8cfb6'), tone('#fff7df'), INK, 3.5);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - z - 10);
  ctx.lineTo(x, y - z - 14);
  ctx.stroke();
  if (o.tags.has('lit')) {
    ctx.fillStyle = 'rgba(255, 190, 90, 0.16)';
    ctx.beginPath();
    ctx.ellipse(x, y, 30, 22, 0, 0, TAU);
    ctx.fill();
  }
};

const spraycan: ArtFn = ({ ctx, x, y, z, angle, tone }) => {
  prism(ctx, x, y, angle, z, z + 14, (c) => c.arc(0, 0, 7, 0, TAU), tone('#d96a1c'), tone('#ff9a3d'), INK, 3.5);
  band(ctx, x, y - z - 6, 7, INK, 3);
  prism(ctx, x, y, angle, z + 14, z + 17, (c) => c.arc(0, 0, 3.5, 0, TAU), tone('#e8e4f0'), tone('#ffffff'), INK, 2.5);
};

const bookshelf: ArtFn = ({ ctx, o, x, y, z, angle, tone }) => {
  if (!o.standing && o.tipProgress < 0) {
    const flat: PathFn = (c) => roundRectPath(c, -38, -46, 76, 92, 4);
    prism(ctx, x, y, angle, z, z + 9, flat, tone('#7a4a22'), tone('#a8713d'));
    onTop(ctx, x, y, angle, z + 9, (c) => {
      c.strokeStyle = tone('#8f5a2c');
      c.lineWidth = 2;
      c.beginPath();
      for (const lx of [-14, 10]) {
        c.moveTo(lx, -40);
        c.lineTo(lx, 40);
      }
      c.stroke();
    });
    return;
  }
  // While toppling, the case leans by shrinking its height and sliding towards the fall direction.
  const t = o.tipProgress >= 0 ? easeInQuad(Math.min(1, o.tipProgress)) : 0;
  const height = 44 * (1 - t * 0.8);
  const ox = x + o.tipDirX * 34 * t;
  const oy = y + o.tipDirY * 34 * t;
  const frame: PathFn = (c) => roundRectPath(c, -46, -13, 92, 26, 3);
  prism(ctx, ox, oy, angle, z, z + height, frame, tone('#7a4a22'), tone('#a8713d'));
  onTop(ctx, ox, oy, angle, z + height, (c) => {
    c.fillStyle = '#3a2412';
    c.fillRect(-42, -9, 84, 18);
    let bx = -40;
    for (let i = 0; bx < 38; i++) {
      const w = 5 + hash(o.seed * 50 + i) * 5;
      c.fillStyle = tone(BOOK_COVERS[i % BOOK_COVERS.length]!);
      c.fillRect(bx, -8, Math.min(w, 40 - bx), 16);
      bx += w + 1;
    }
  });
  if (Math.cos(angle) > 0.7 && t === 0) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (const h of [14, 29]) {
      ctx.moveTo(x - 44, y + 12 - z - h);
      ctx.lineTo(x + 44, y + 12 - z - h);
    }
    ctx.stroke();
  }
};

const ball: ArtFn = ({ ctx, x, y, z, angle, tone }) => {
  const cy = y - z - 9;
  ctx.fillStyle = tone('#ff5a8a');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(x, cy, 9, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = tone('#ffd23f');
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x, cy, 8, 3.5, angle, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.arc(x - 3, cy - 4, 2.2, 0, TAU);
  ctx.fill();
};

const plank: ArtFn = ({ ctx, x, y, z, angle, tone }) => {
  prism(ctx, x, y, angle, z, z + 3, (c) => roundRectPath(c, -17, -4, 34, 8, 2), tone('#8f5a2c'), tone('#c98a4b'), INK, 3.5);
  onTop(ctx, x, y, angle, z + 3, (c) => {
    c.strokeStyle = tone('#a8713d');
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(-12, 0);
    c.lineTo(12, 0);
    c.stroke();
  });
};

const paperball: ArtFn = ({ ctx, o, x, y, z, angle, tone }) => {
  prism(ctx, x, y, angle, z, z + 4, (c) => c.arc(0, 0, 6, 0, TAU), tone('#c9c1ab'), tone('#fbf8ee'), INK, 3);
  onTop(ctx, x, y, angle, z + 4, (c) => {
    c.strokeStyle = tone('#b5ad98');
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(-3, -2);
    c.lineTo(1, 0);
    c.lineTo(-1, 3);
    c.moveTo(2, -3);
    c.lineTo(3, 1);
    c.stroke();
  });
  void o;
};

const helmet: ArtFn = ({ ctx, x, y, z, angle, tone }) => {
  prism(ctx, x, y, angle, z, z + 7, (c) => c.arc(0, 0, 10, 0, TAU), tone('#c9971a'), tone('#ffd23f'));
  onTop(ctx, x, y, angle, z + 7, (c) => {
    c.strokeStyle = tone('#c9971a');
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-9, 0);
    c.lineTo(9, 0);
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.beginPath();
    c.arc(-3, -4, 2.5, 0, TAU);
    c.fill();
  });
};

/** Used for any object without bespoke art: its collider, extruded, in its material colours. */
const generic: ArtFn = ({ ctx, o, x, y, z, angle, tone }) => {
  prism(ctx, x, y, angle, z, z + o.def.height, shapePath(o), tone(o.material.shade), tone(o.material.color));
};

const ART: Record<string, ArtFn> = {
  chair, table, lamp, shoe, book, computer, trashcan, bottle, flowerpot, fan, extinguisher, candle, spraycan,
  bookshelf, ball, plank, paperball, helmet,
};

/** Register art for a new object id (see README, "How to add a new object"). */
export function registerObjectArt(key: string, draw: ArtFn): void {
  ART[key] = draw;
}

const CHARRED = '#2a2330';

export function drawObject(ctx: Ctx, o: PhysicsObject, x: number, y: number, z: number, angle: number, time: number): void {
  const char = o.burning ? 0.25 + 0.6 * (1 - o.burnLeft / o.burnTotal) : Math.min(0.3, o.igniteExposure * 0.3);
  const flash = o.hitFlash;
  const live = o.tags.has('energized') && hash(Math.floor(time * 20) + o.seed * 9) > 0.4;
  const tone = (color: string): string => {
    let c = char > 0.02 ? mix(color, CHARRED, char) : color;
    if (live) c = mix(color, '#fff7a8', 0.6);
    if (flash > 0.05) c = mix(color, '#ffffff', flash * 0.75);
    return c;
  };
  const draw = ART[o.def.art ?? o.def.id] ?? generic;

  const squash = o.squash;
  if (squash > 0.02) {
    // Squash about the ground contact point so the object stays planted.
    ctx.save();
    ctx.translate(x, y - z);
    ctx.scale(1 + squash * 0.14, 1 - squash * 0.14);
    ctx.translate(-x, -(y - z));
    draw({ ctx, o, x, y, z, angle, time, tone });
    ctx.restore();
  } else {
    draw({ ctx, o, x, y, z, angle, time, tone });
  }
}

/** A halo around the object's silhouette, drawn underneath it. */
export function drawObjectHalo(ctx: Ctx, o: PhysicsObject, x: number, y: number, z: number, angle: number, color: string, width: number): void {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  if (o.def.id === 'lamp') {
    const length = o.def.tip ? o.def.tip.length : 60;
    ctx.lineWidth = width + 16;
    ctx.beginPath();
    if (o.standing) {
      ctx.moveTo(x, y - z);
      ctx.lineTo(x, y - z - length);
    } else {
      const c = Math.cos(angle) * (length / 2);
      const s = Math.sin(angle) * (length / 2);
      ctx.moveTo(x - c, y - s - z);
      ctx.lineTo(x + c, y + s - z);
    }
    ctx.stroke();
    ctx.lineCap = 'butt';
    return;
  }
  const path = shapePath(o);
  const height = o.def.id === 'table' ? 22 : o.def.height;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  ctx.lineWidth = width + 6;
  for (let h = 0; h <= height; h += 4) {
    ctx.save();
    ctx.transform(c, s, -s, c, x, y - z - h);
    ctx.beginPath();
    path(ctx);
    ctx.stroke();
    ctx.restore();
  }
  ctx.lineCap = 'butt';
}
