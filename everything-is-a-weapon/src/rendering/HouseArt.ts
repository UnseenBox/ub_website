import { INK } from '../core/constants';
import { TAU, easeInQuad } from '../core/math';
import { hash, onTop, prism, roundRectPath, type Ctx, type PathFn } from './draw';
import { registerObjectArt, type ArtContext } from './ObjectArt';

/**
 * Drawings for the kitchen, bathroom, living room, bedroom and garage objects.
 * Same technique as the core set: flat shapes extruded up the screen, then details on the
 * top face (which turn with the object) and on the front face (drawn only when it faces us).
 */

type Art = (a: ArtContext) => void;

const STEEL = '#aab4c4';
const STEEL_DARK = '#6d7689';
const CUSHIONS = ['#e56b6f', '#6d9dc5', '#f2c14e', '#7fb069'];
const PAINTS = ['#ff5a8a', '#4ad6e8', '#ffd23f', '#9be564'];

const circle = (r: number): PathFn => (c) => c.arc(0, 0, r, 0, TAU);
const box = (hw: number, hh: number, radius = 3): PathFn => (c) => roundRectPath(c, -hw, -hh, hw * 2, hh * 2, radius);
const rect = (x0: number, y0: number, w: number, h: number, radius = 2): PathFn => (c) => roundRectPath(c, x0, y0, w, h, radius);

/** True when the object's front face is turned towards the camera. */
const facesCamera = (angle: number): boolean => Math.cos(angle) > 0.6;

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

/** A coloured stripe round the camera-facing half of a cylinder. */
function band(ctx: Ctx, x: number, y: number, r: number, color: string, width: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r - 1, 0.12 * Math.PI, 0.88 * Math.PI);
  ctx.stroke();
}

// ───────────── kitchen ─────────────

const pan: Art = ({ ctx, x, y, z, angle, tone }) => {
  onTop(ctx, x, y, angle, z + 3, (c) => {
    c.fillStyle = '#2a2540';
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.beginPath();
    roundRectPath(c, 9, -3, 19, 6, 3);
    c.fill();
    c.stroke();
  });
  prism(ctx, x, y, angle, z, z + 5, circle(11), tone(STEEL_DARK), tone(STEEL), INK, 3.5);
  onTop(ctx, x, y, angle, z + 5, (c) => {
    c.fillStyle = tone('#3b3550');
    c.beginPath();
    c.arc(0, 0, 8.5, 0, TAU);
    c.fill();
    c.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 0, 6, Math.PI * 1.1, Math.PI * 1.5);
    c.stroke();
  });
};

const saucepan: Art = ({ ctx, x, y, z, angle, tone }) => {
  onTop(ctx, x, y, angle, z + 6, (c) => {
    c.fillStyle = '#2a2540';
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.beginPath();
    roundRectPath(c, 8, -2.5, 16, 5, 2.5);
    c.fill();
    c.stroke();
  });
  prism(ctx, x, y, angle, z, z + 9, circle(10), tone(STEEL_DARK), tone(STEEL));
  onTop(ctx, x, y, angle, z + 9, (c) => {
    c.fillStyle = tone('#4a5266');
    c.beginPath();
    c.arc(0, 0, 7.5, 0, TAU);
    c.fill();
  });
};

const plate: Art = ({ ctx, x, y, z, angle, tone }) => {
  prism(ctx, x, y, angle, z, z + 2, circle(10), tone('#d9d4c7'), tone('#ffffff'), INK, 3);
  onTop(ctx, x, y, angle, z + 2, (c) => {
    c.strokeStyle = tone('#6d9dc5');
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(0, 0, 6.5, 0, TAU);
    c.stroke();
  });
};

const toaster: Art = ({ ctx, o, x, y, z, angle, tone }) => {
  prism(ctx, x, y, angle, z, z + 12, box(11, 8, 4), tone('#8892a6'), tone('#c9d1de'), INK, 3.5);
  onTop(ctx, x, y, angle, z + 12, (c) => {
    c.fillStyle = '#2a2540';
    c.fillRect(-7, -4.5, 14, 2.8);
    c.fillRect(-7, 1.7, 14, 2.8);
    if (o.structural === 'broken') cracks(c, o.seed, 9);
    else {
      c.fillStyle = tone('#e5a35a');
      c.fillRect(-5, -4.2, 10, 2);
    }
  });
};

const toast: Art = ({ ctx, x, y, z, angle, tone }) => {
  prism(ctx, x, y, angle, z, z + 2, box(7, 6, 2.5), tone('#a8713d'), tone('#b8793b'), INK, 3);
  onTop(ctx, x, y, angle, z + 2, (c) => {
    c.fillStyle = tone('#f0c987');
    c.beginPath();
    roundRectPath(c, -5, -4, 10, 8, 2);
    c.fill();
  });
};

const banana: Art = ({ ctx, x, y, z, angle, tone }) => {
  onTop(ctx, x, y, angle, z + 3, (c) => {
    c.lineCap = 'round';
    c.strokeStyle = INK;
    c.lineWidth = 8.5;
    c.beginPath();
    c.arc(0, 9, 12, Math.PI * 1.22, Math.PI * 1.78);
    c.stroke();
    c.strokeStyle = tone('#ffd94a');
    c.lineWidth = 5;
    c.stroke();
    c.strokeStyle = tone('#7a5a1e');
    c.lineWidth = 3;
    c.beginPath();
    c.arc(0, 9, 12, Math.PI * 1.22, Math.PI * 1.25);
    c.stroke();
    c.lineCap = 'butt';
  });
};

const oilbottle: Art = ({ ctx, x, y, z, angle, tone }) => {
  ctx.globalAlpha = 0.92;
  prism(ctx, x, y, angle, z, z + 12, circle(7), tone('#b9862a'), tone('#e9b949'), INK, 3.5);
  ctx.globalAlpha = 1;
  prism(ctx, x, y, angle, z + 12, z + 18, circle(3), tone('#b9862a'), tone('#e5383b'), INK, 3);
  ctx.fillStyle = tone('#fbf6e9');
  ctx.fillRect(x - 5, y - z - 9, 10, 5);
};

const flour: Art = ({ ctx, x, y, z, angle, tone }) => {
  prism(ctx, x, y, angle, z, z + 15, box(10, 8, 2), tone('#d6ccb2'), tone('#fbf8ee'), INK, 3.5);
  onTop(ctx, x, y, angle, z + 15, (c) => {
    // the rolled-down top of the bag
    c.strokeStyle = tone('#c9c1ab');
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-8, -2);
    c.lineTo(8, -2);
    c.moveTo(-8, 2);
    c.lineTo(8, 2);
    c.stroke();
  });
  if (facesCamera(angle)) {
    ctx.fillStyle = tone('#2f4fb5');
    ctx.fillRect(x - 8, y + 8 - z - 10, 16, 5.5);
  }
};

const fridge: Art = ({ ctx, o, x, y, z, angle, tone }) => {
  if (!o.standing && o.tipProgress < 0) {
    prism(ctx, x, y, angle, z, z + 20, box(41, 26, 5), tone('#9aa5b5'), tone('#e6ebf2'));
    onTop(ctx, x, y, angle, z + 20, (c) => {
      c.strokeStyle = tone('#9aa5b5');
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(-8, -24);
      c.lineTo(-8, 24);
      c.stroke();
      c.strokeStyle = INK;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-14, 16);
      c.lineTo(-24, 16);
      c.moveTo(-2, 16);
      c.lineTo(12, 16);
      c.stroke();
    });
    return;
  }
  // toppling: the same lean as the bookshelf
  const t = o.tipProgress >= 0 ? easeInQuad(Math.min(1, o.tipProgress)) : 0;
  const height = 58 * (1 - t * 0.6);
  const ox = x + o.tipDirX * 34 * t;
  const oy = y + o.tipDirY * 34 * t;
  prism(ctx, ox, oy, angle, z, z + height, box(26, 22, 5), tone('#9aa5b5'), tone('#e6ebf2'));
  if (facesCamera(angle) && t === 0) {
    const front = y + 22 - z;
    ctx.strokeStyle = tone('#7d8799');
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 24, front - 36);
    ctx.lineTo(x + 24, front - 36);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + 17, front - 51);
    ctx.lineTo(x + 17, front - 41);
    ctx.moveTo(x + 17, front - 31);
    ctx.lineTo(x + 17, front - 14);
    ctx.stroke();
    ctx.lineCap = 'butt';
    // fridge magnets
    ctx.fillStyle = tone('#e5383b');
    ctx.fillRect(x - 16, front - 50, 5, 5);
    ctx.fillStyle = tone('#ffd23f');
    ctx.fillRect(x - 6, front - 46, 5, 5);
  }
};

const counter: Art = ({ ctx, x, y, z, angle, tone }) => {
  prism(ctx, x, y, angle, z, z + 26, box(70, 23, 3), tone('#8a5a36'), tone('#e3ded2'));
  if (facesCamera(angle)) {
    const front = y + 23 - z;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const dx of [-35, 0, 35]) {
      ctx.moveTo(x + dx, front - 22);
      ctx.lineTo(x + dx, front - 2);
    }
    ctx.stroke();
    ctx.fillStyle = tone('#ffd23f');
    for (const dx of [-42, -28, 28, 42]) {
      ctx.beginPath();
      ctx.arc(x + dx, front - 13, 2.2, 0, TAU);
      ctx.fill();
    }
  }
};

const stove: Art = ({ ctx, o, x, y, z, angle, tone }) => {
  prism(ctx, x, y, angle, z, z + 26, box(32, 23, 3), tone('#5a616c'), tone('#2f3345'));
  onTop(ctx, x, y, angle, z + 26, (c) => {
    c.lineWidth = 2.2;
    for (const [bx, by, lit] of [[-15, 0, o.tags.has('lit')], [15, -7, false], [15, 9, false]] as const) {
      c.strokeStyle = lit ? '#ff9f1c' : tone('#8892a6');
      c.beginPath();
      c.arc(bx, by, bx < 0 ? 9 : 6, 0, TAU);
      c.stroke();
      c.beginPath();
      c.arc(bx, by, bx < 0 ? 4.5 : 3, 0, TAU);
      c.stroke();
    }
  });
  if (facesCamera(angle)) {
    const front = y + 23 - z;
    ctx.fillStyle = '#17132a';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    roundRectPath(ctx, x - 22, front - 17, 44, 13, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = tone('#e3ded2');
    for (const dx of [-21, -9, 9, 21]) {
      ctx.beginPath();
      ctx.arc(x + dx, front - 22, 2, 0, TAU);
      ctx.fill();
    }
  }
};

// ───────────── bathroom ─────────────

const soap: Art = ({ ctx, x, y, z, angle, time, tone }) => {
  prism(ctx, x, y, angle, z, z + 4, box(8, 5, 3.5), tone('#ff9ec4'), tone('#ffd3e4'), INK, 3);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.strokeStyle = 'rgba(34, 27, 54, 0.4)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const a = hash(x * 0.01 + i * 3.1) * TAU + time * 0.6;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * 10, y - z - 5 + Math.sin(a) * 5, 1.8 + i * 0.5, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
};

const duck: Art = ({ ctx, x, y, z, angle, tone }) => {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const cy = y - z - 5;
  ctx.fillStyle = tone('#ffd23f');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x, cy, 9, 7, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  const hx = x + dx * 5;
  const hy = cy - 7 + dy * 2.5;
  ctx.beginPath();
  ctx.arc(hx, hy, 5.5, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = tone('#ff7b2e');
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(hx + dx * 5.5, hy + 1 + dy * 2, 3.4, 2, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(hx + dx * 1.5, hy - 1.5, 1.2, 0, TAU);
  ctx.fill();
};

const hairdryer: Art = ({ ctx, o, x, y, z, angle, tone }) => {
  onTop(ctx, x, y, angle, z + 5, (c) => {
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.fillStyle = tone('#3b3550');
    c.beginPath();
    roundRectPath(c, -5, 2, 6, 11, 2.5);
    c.fill();
    c.stroke();
    c.fillStyle = tone('#a48cf2');
    c.beginPath();
    roundRectPath(c, -10, -5, 16, 10, 5);
    c.fill();
    c.stroke();
    c.fillStyle = tone('#3b3550');
    c.beginPath();
    roundRectPath(c, 5, -3.5, 6, 7, 1.5);
    c.fill();
    c.stroke();
    if (o.structural === 'broken') cracks(c, o.seed, 8);
  });
};

const plunger: Art = ({ ctx, x, y, z, angle, tone }) => {
  prism(ctx, x, y, angle, z, z + 7, circle(7), tone('#a32626'), tone('#d94a3a'), INK, 3.5);
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x, y - z - 7);
  ctx.lineTo(x + Math.cos(angle) * 3, y - z - 25);
  ctx.stroke();
  ctx.strokeStyle = tone('#c98a4b');
  ctx.lineWidth = 2.8;
  ctx.stroke();
  ctx.lineCap = 'butt';
};

const mirror: Art = ({ ctx, x, y, z, angle, tone }) => {
  prism(ctx, x, y, angle, z, z + 34, box(15, 4, 2), tone('#8f5a2c'), tone('#c98a4b'));
  if (facesCamera(angle)) {
    const front = y + 4 - z;
    ctx.fillStyle = tone('#cfeef5');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    roundRectPath(ctx, x - 12, front - 31, 24, 27, 3);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 7, front - 13);
    ctx.lineTo(x + 2, front - 26);
    ctx.moveTo(x - 1, front - 11);
    ctx.lineTo(x + 5, front - 20);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
};

const toilet: Art = ({ ctx, o, x, y, z, angle, time, tone }) => {
  const broken = o.structural === 'broken';
  prism(ctx, x, y, angle, z, z + 26, rect(-15, -20, 30, 12), tone('#cfd8e4'), tone('#ffffff'));
  prism(ctx, x, y, angle, z, z + 14, rect(-13, -9, 26, 29, 11), tone('#cfd8e4'), tone('#ffffff'));
  onTop(ctx, x, y, angle, z + 14, (c) => {
    c.fillStyle = tone('#8fdcea');
    c.strokeStyle = tone('#cfd8e4');
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(0, 6, 7.5, 10, 0, 0, TAU);
    c.fill();
    c.stroke();
    if (broken) cracks(c, o.seed, 14);
  });
  if (broken) {
    // the cistern is never going to stop
    ctx.strokeStyle = 'rgba(143, 220, 234, 0.9)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const sway = Math.sin(time * 9 + i * 2) * 5;
      ctx.moveTo(x - 6 + i * 6, y - z - 26);
      ctx.quadraticCurveTo(x - 6 + i * 6 + sway, y - z - 46, x - 12 + i * 12 + sway, y - z - 34);
    }
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
};

const bathtub: Art = ({ ctx, x, y, z, angle, time, tone }) => {
  prism(ctx, x, y, angle, z, z + 20, box(62, 27, 14), tone('#cfd8e4'), tone('#ffffff'));
  onTop(ctx, x, y, angle, z + 20, (c) => {
    c.fillStyle = tone('#8fdcea');
    c.strokeStyle = tone('#b9c7d6');
    c.lineWidth = 2.5;
    c.beginPath();
    roundRectPath(c, -54, -20, 108, 40, 12);
    c.fill();
    c.stroke();
    c.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    c.lineWidth = 2.5;
    c.lineCap = 'round';
    c.beginPath();
    for (let i = 0; i < 3; i++) {
      const wx = -34 + i * 30 + Math.sin(time * 1.5 + i) * 4;
      c.moveTo(wx, -4 + i * 5);
      c.quadraticCurveTo(wx + 8, -8 + i * 5, wx + 16, -4 + i * 5);
    }
    c.stroke();
    c.lineCap = 'butt';
    // taps
    c.fillStyle = tone(STEEL);
    c.strokeStyle = INK;
    c.lineWidth = 2;
    for (const ty of [-7, 7]) {
      c.beginPath();
      c.arc(-57, ty, 3.5, 0, TAU);
      c.fill();
      c.stroke();
    }
  });
};

// ───────────── living room and bedroom ─────────────

const pillow: Art = ({ ctx, o, x, y, z, angle, tone }) => {
  const color = CUSHIONS[Math.floor(o.seed * CUSHIONS.length)] ?? '#e56b6f';
  prism(ctx, x, y, angle, z, z + 6, box(13, 10, 6), tone('#3b3550'), tone(color), INK, 3.5);
  onTop(ctx, x, y, angle, z + 6, (c) => {
    c.strokeStyle = 'rgba(34, 27, 54, 0.35)';
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(-9, -6);
    c.lineTo(0, 0);
    c.lineTo(9, -6);
    c.moveTo(-9, 6);
    c.lineTo(0, 0);
    c.lineTo(9, 6);
    c.stroke();
    c.fillStyle = tone('#fff3d6');
    c.beginPath();
    c.arc(0, 0, 2, 0, TAU);
    c.fill();
  });
};

const tv: Art = ({ ctx, o, x, y, z, angle, time, tone }) => {
  prism(ctx, x, y, angle, z, z + 4, box(14, 7, 2), tone('#17132a'), tone('#2a2540'), INK, 3);
  prism(ctx, x, y, angle, z + 4, z + 34, box(26, 4, 2), tone('#17132a'), tone('#3b3550'));
  if (facesCamera(angle)) {
    const front = y + 4 - z;
    const broken = o.structural === 'broken';
    ctx.fillStyle = broken ? '#15131f' : '#24456b';
    ctx.beginPath();
    roundRectPath(ctx, x - 23, front - 31, 46, 24, 2);
    ctx.fill();
    if (broken) {
      ctx.save();
      ctx.translate(x, front - 19);
      cracks(ctx, o.seed, 16);
      ctx.restore();
    } else {
      // late-night telly: rolling static
      ctx.fillStyle = 'rgba(127, 243, 255, 0.5)';
      const roll = (time * 18) % 24;
      ctx.fillRect(x - 23, front - 31 + roll, 46, 2.5);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      for (let i = 0; i < 6; i++) {
        const sx = x - 21 + hash(Math.floor(time * 12) + i * 3.7) * 40;
        const sy = front - 29 + hash(Math.floor(time * 12) * 1.3 + i) * 20;
        ctx.fillRect(sx, sy, 3, 1.5);
      }
    }
  }
};

const vase: Art = ({ ctx, x, y, z, angle, time, tone }) => {
  prism(ctx, x, y, angle, z, z + 15, circle(9), tone('#2f5f8a'), tone('#6fa8d6'), INK, 3.5);
  prism(ctx, x, y, angle, z + 15, z + 20, circle(5), tone('#2f5f8a'), tone('#8fdcea'), INK, 3);
  band(ctx, x, y - z - 7, 9, tone('#fbf6e9'), 2.5);
  const sway = Math.sin(time * 1.4 + x) * 1.5;
  const blooms = ['#ff5a8a', '#ffd23f', '#ffffff'];
  for (let i = 0; i < 3; i++) {
    const fx = x + (i - 1) * 7 + sway;
    const fy = y - z - 34 - (i === 1 ? 5 : 0);
    ctx.strokeStyle = '#3f8f4a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + (i - 1) * 2, y - z - 20);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    ctx.fillStyle = tone(blooms[i]!);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(fx, fy, 4, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
};

const sofa: Art = ({ ctx, x, y, z, angle, tone }) => {
  const dark = tone('#3f5a73');
  const mid = tone('#5f7f9b');
  const light = tone('#7b9bb8');
  // whichever of the back and the seat is lower on screen is nearer the camera
  const back = (): void => prism(ctx, x, y, angle, z, z + 26, rect(-58, -24, 116, 13, 5), dark, mid);
  const seat = (): void => {
    prism(ctx, x, y, angle, z, z + 13, rect(-58, -12, 116, 36, 5), dark, light);
    onTop(ctx, x, y, angle, z + 13, (c) => {
      c.strokeStyle = 'rgba(34, 27, 54, 0.3)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, -10);
      c.lineTo(0, 22);
      c.stroke();
    });
    prism(ctx, x, y, angle, z, z + 20, rect(-58, -12, 12, 36, 5), dark, mid);
    prism(ctx, x, y, angle, z, z + 20, rect(46, -12, 12, 36, 5), dark, mid);
  };
  if (Math.cos(angle) > 0) {
    back();
    seat();
  } else {
    seat();
    back();
  }
};

const bed: Art = ({ ctx, x, y, z, angle, tone }) => {
  const frame = tone('#8f5a2c');
  const head = (): void => prism(ctx, x, y, angle, z, z + 28, rect(-44, -64, 88, 8, 3), frame, tone('#c98a4b'));
  const mattress = (): void => {
    prism(ctx, x, y, angle, z, z + 15, rect(-44, -57, 88, 121, 6), frame, tone('#fbf6e9'));
    onTop(ctx, x, y, angle, z + 15, (c) => {
      // the duvet, thrown back in a hurry
      c.fillStyle = tone('#3fa7a3');
      c.beginPath();
      c.moveTo(-42, -8);
      c.lineTo(20, -8);
      c.lineTo(42, -26);
      c.lineTo(42, 62);
      c.lineTo(-42, 62);
      c.closePath();
      c.fill();
      c.fillStyle = tone('#2f8a86');
      c.beginPath();
      c.moveTo(20, -8);
      c.lineTo(42, -26);
      c.lineTo(42, -8);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-42, 22);
      c.lineTo(42, 22);
      c.moveTo(-42, 40);
      c.lineTo(42, 40);
      c.stroke();
    });
  };
  if (Math.cos(angle) > 0) {
    head();
    mattress();
  } else {
    mattress();
    head();
  }
};

const alarmclock: Art = ({ ctx, o, x, y, z, angle, time, tone }) => {
  const ringing = o.ringing > 0;
  const shake = ringing ? Math.sin(time * 70) * 2.2 : 0;
  const cx = x + shake;
  prism(ctx, cx, y, angle, z, z + 7, circle(7), tone('#a32626'), tone('#e5383b'), INK, 3.5);
  // twin bells
  ctx.fillStyle = tone(STEEL);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + side * 5.5, y - z - 12, 3.4, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  onTop(ctx, cx, y, angle, z + 7, (c) => {
    c.fillStyle = '#fbf6e9';
    c.beginPath();
    c.arc(0, 0, 5, 0, TAU);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(0, -3.4);
    c.moveTo(0, 0);
    c.lineTo(2.6, 0);
    c.stroke();
  });
  if (ringing) {
    ctx.strokeStyle = '#ffe36e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const side of [-1, 1]) {
      ctx.moveTo(x + side * 12, y - z - 16);
      ctx.lineTo(x + side * 17, y - z - 21);
      ctx.moveTo(x + side * 13, y - z - 9);
      ctx.lineTo(x + side * 19, y - z - 9);
    }
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
};

const teddy: Art = ({ ctx, x, y, z, angle, tone }) => {
  const dx = Math.cos(angle);
  const cy = y - z - 5;
  const fur = tone('#b07a45');
  ctx.fillStyle = fur;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x, cy, 9, 7.5, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  const hx = x + dx * 3;
  const hy = cy - 9;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(hx + side * 5.5, hy - 4.5, 3, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(hx, hy, 6.5, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = tone('#e6c79a');
  ctx.beginPath();
  ctx.ellipse(hx + dx * 1.5, hy + 2, 3.2, 2.4, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(hx - 2.4 + dx * 1.5, hy - 1.5, 1, 0, TAU);
  ctx.arc(hx + 2.4 + dx * 1.5, hy - 1.5, 1, 0, TAU);
  ctx.fill();
};

// ───────────── garage ─────────────

const tire: Art = ({ ctx, x, y, z, angle, tone }) => {
  prism(ctx, x, y, angle, z, z + 9, circle(15), tone('#17132a'), tone('#3b3550'));
  onTop(ctx, x, y, angle, z + 9, (c) => {
    c.fillStyle = tone(STEEL_DARK);
    c.beginPath();
    c.arc(0, 0, 8, 0, TAU);
    c.fill();
    c.fillStyle = '#17132a';
    c.beginPath();
    c.arc(0, 0, 4.5, 0, TAU);
    c.fill();
    c.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    c.lineWidth = 1.6;
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      c.moveTo(Math.cos(a) * 10.5, Math.sin(a) * 10.5);
      c.lineTo(Math.cos(a) * 14, Math.sin(a) * 14);
    }
    c.stroke();
  });
};

const skateboard: Art = ({ ctx, x, y, z, angle, tone }) => {
  onTop(ctx, x, y, angle, z, (c) => {
    c.fillStyle = INK;
    for (const [wx, wy] of [[-11, -6.5], [11, -6.5], [-11, 6.5], [11, 6.5]] as const) {
      c.beginPath();
      c.arc(wx, wy, 3, 0, TAU);
      c.fill();
    }
  });
  prism(ctx, x, y, angle, z + 3, z + 5, box(18, 6, 6), tone('#b8482f'), tone('#2a2540'), INK, 3);
  onTop(ctx, x, y, angle, z + 5, (c) => {
    c.strokeStyle = tone('#ffd23f');
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-9, 0);
    c.lineTo(9, 0);
    c.stroke();
  });
};

const paintcan: Art = ({ ctx, o, x, y, z, angle, tone }) => {
  const color = PAINTS[Math.floor(o.seed * PAINTS.length)] ?? '#ff5a8a';
  prism(ctx, x, y, angle, z, z + 13, circle(10), tone(STEEL_DARK), tone(STEEL));
  band(ctx, x, y - z - 5, 10, tone(color), 6);
  onTop(ctx, x, y, angle, z + 13, (c) => {
    c.fillStyle = tone(color);
    c.beginPath();
    c.arc(0, 0, 6.5, 0, TAU);
    c.fill();
  });
};

const jerrycan: Art = ({ ctx, x, y, z, angle, tone }) => {
  prism(ctx, x, y, angle, z, z + 17, box(11, 8, 3), tone('#a32626'), tone('#e5484d'));
  onTop(ctx, x, y, angle, z + 17, (c) => {
    c.strokeStyle = tone('#a32626');
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-8, -5);
    c.lineTo(4, 5);
    c.moveTo(4, -5);
    c.lineTo(-8, 5);
    c.stroke();
    c.fillStyle = tone('#ffd23f');
    c.strokeStyle = INK;
    c.lineWidth = 1.8;
    c.beginPath();
    c.arc(7.5, -4, 2.8, 0, TAU);
    c.fill();
    c.stroke();
  });
  if (facesCamera(angle)) {
    // flame warning
    const front = y + 8 - z;
    ctx.fillStyle = tone('#ffd23f');
    ctx.beginPath();
    ctx.moveTo(x, front - 13);
    ctx.quadraticCurveTo(x + 5, front - 8, x, front - 4);
    ctx.quadraticCurveTo(x - 5, front - 8, x, front - 13);
    ctx.fill();
  }
};

const toolbox: Art = ({ ctx, o, x, y, z, angle, tone }) => {
  const broken = o.structural === 'broken';
  prism(ctx, x, y, angle, z, z + 13, box(18, 10, 3), tone('#22408f'), tone(broken ? '#17132a' : '#4a6fd6'));
  onTop(ctx, x, y, angle, z + 13, (c) => {
    if (broken) {
      cracks(c, o.seed, 13);
      return;
    }
    c.strokeStyle = INK;
    c.lineWidth = 5.5;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-8, 0);
    c.lineTo(8, 0);
    c.stroke();
    c.strokeStyle = tone(STEEL);
    c.lineWidth = 2.5;
    c.stroke();
    c.lineCap = 'butt';
    c.fillStyle = tone('#ffd23f');
    c.fillRect(-15, -2, 3, 4);
    c.fillRect(12, -2, 3, 4);
  });
};

const wrench: Art = ({ ctx, x, y, z, angle, tone }) => {
  onTop(ctx, x, y, angle, z + 2, (c) => {
    const shape = (): void => {
      c.beginPath();
      c.moveTo(-10, -1.8);
      c.lineTo(5, -1.8);
      c.lineTo(7, -4.5);
      c.lineTo(11, -4.5);
      c.lineTo(8.5, -1.5);
      c.lineTo(8.5, 1.5);
      c.lineTo(11, 4.5);
      c.lineTo(7, 4.5);
      c.lineTo(5, 1.8);
      c.lineTo(-10, 1.8);
      c.closePath();
    };
    c.lineJoin = 'round';
    shape();
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.stroke();
    c.fillStyle = tone(STEEL);
    c.fill();
  });
};

const ARTS: Readonly<Record<string, Art>> = {
  pan, helmet: saucepan, plate, toaster, toast, banana, oilbottle, flour, fridge, counter, stove,
  soap, duck, hairdryer, plunger, mirror, toilet, bathtub,
  pillow, tv, vase, sofa, bed, alarmclock, teddy,
  tire, skateboard, paintcan, jerrycan, toolbox, wrench,
};

/** Called once at start-up; replaces the generic fallback drawing for every house object. */
export function registerHouseArt(): void {
  for (const [id, draw] of Object.entries(ARTS)) registerObjectArt(id, draw);
}
