import { INK } from '../core/constants';
import { TAU, easeInQuad } from '../core/math';
import { hash, onTop, prism, roundRectPath, type Ctx, type PathFn } from './draw';
import { registerObjectArt, type ArtContext } from './ObjectArt';

/**
 * Drawings for the gadgets (objects/GadgetObjects.ts). Same recipe as the rest of the flat:
 * a flat shape extruded up the screen, details on the top face, and a front face only when
 * it is turned towards the camera. Most of these also show what state they are in — armed,
 * lit, playing, full — because that state is the whole point of them.
 */

type Art = (a: ArtContext) => void;

const STEEL = '#aab4c4';
const STEEL_DARK = '#6d7689';
const DARK = '#2a2540';
const DARKER = '#17132a';

const circle = (r: number): PathFn => (c) => c.arc(0, 0, r, 0, TAU);
const box = (hw: number, hh: number, radius = 3): PathFn => (c) => roundRectPath(c, -hw, -hh, hw * 2, hh * 2, radius);
const rect = (x0: number, y0: number, w: number, h: number, radius = 2): PathFn => (c) => roundRectPath(c, x0, y0, w, h, radius);
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

/** A line with an ink outline: handles, sticks, poles. */
function pole(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, width: number): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + 3.2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.lineCap = 'butt';
}

// ───────────── things that move by themselves ─────────────

const hoover: Art = ({ ctx, o, x, y, z, angle, time, tone }) => {
  const broken = o.structural === 'broken';
  prism(ctx, x, y, angle, z, z + 7, circle(15), tone(DARK), tone('#e8e4f0'));
  onTop(ctx, x, y, angle, z + 7, (c) => {
    // the bumper wraps the front half
    c.strokeStyle = tone('#3b3550');
    c.lineWidth = 4;
    c.beginPath();
    c.arc(0, 0, 12.5, -1.05, 1.05);
    c.stroke();
    c.fillStyle = tone('#bdb7cf');
    c.beginPath();
    c.arc(-1, 0, 7.5, 0, TAU);
    c.fill();
    c.strokeStyle = tone('#8c86a3');
    c.lineWidth = 1.5;
    c.stroke();
    // one button, one eye
    c.fillStyle = broken ? DARKER : Math.floor(time * 2 + o.seed * 4) % 2 === 0 ? '#9be564' : '#5fae57';
    c.beginPath();
    c.arc(3, 0, 2.7, 0, TAU);
    c.fill();
    c.fillStyle = INK;
    c.beginPath();
    c.arc(-5, 0, 2.2, 0, TAU);
    c.fill();
    if (broken) cracks(c, o.seed, 12);
  });
};

const teeth: Art = ({ ctx, o, x, y, z, angle, time, tone }) => {
  const running = o.active > 0 && !o.held;
  const hop = running ? Math.abs(Math.sin(time * 21 + o.seed * 6)) * 4 : 0;
  const open = running ? 1 + (0.5 + 0.5 * Math.sin(time * 34)) * 4.5 : 1.5;
  const dx = Math.cos(angle) >= 0 ? 1 : -1;
  const cy = y - z - 5 - hop;

  // the wind-up key sticks out of the back
  pole(ctx, x - dx * 6, cy, x - dx * 13, cy, tone(STEEL), 2);
  ctx.fillStyle = tone('#e5383b');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x - dx * 15.5, cy, 2.6, running ? 1.5 + Math.abs(Math.sin(time * 16)) * 3.2 : 4.2, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();

  const jaw = (jy: number, toothDir: number): void => {
    ctx.fillStyle = tone('#ff8fa3');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(x, jy, 9, 4.6, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = tone('#ffffff');
    ctx.lineWidth = 1.2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.rect(x + i * 3 - 1.4, toothDir > 0 ? jy : jy - 4, 2.8, 4);
      ctx.fill();
      ctx.stroke();
    }
  };
  jaw(cy + 2, -1);
  jaw(cy - 3 - open, 1);
};

const boomerang: Art = ({ ctx, x, y, z, angle, tone }) => {
  onTop(ctx, x, y, angle, z + 2, (c) => {
    c.lineCap = 'round';
    c.lineJoin = 'round';
    const arms = (): void => {
      c.beginPath();
      c.moveTo(-12, 5);
      c.lineTo(0, -5);
      c.lineTo(12, 5);
    };
    arms();
    c.strokeStyle = INK;
    c.lineWidth = 9.5;
    c.stroke();
    c.strokeStyle = tone('#e0a868');
    c.lineWidth = 6;
    c.stroke();
    // painted tips and a stripe at the elbow
    c.strokeStyle = tone('#e5383b');
    c.beginPath();
    c.moveTo(-12, 5);
    c.lineTo(-9.5, 2.9);
    c.moveTo(12, 5);
    c.lineTo(9.5, 2.9);
    c.stroke();
    c.strokeStyle = tone('#2f7f86');
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(-3, -1.2);
    c.lineTo(0, -3.8);
    c.lineTo(3, -1.2);
    c.stroke();
    c.lineCap = 'butt';
  });
};

const fish: Art = ({ ctx, o, x, y, z, angle, time, tone }) => {
  const thrash = o.active > 0 ? Math.sin(time * 26 + o.seed * 9) : 0;
  onTop(ctx, x, y, angle + thrash * 0.25, z + 3, (c) => {
    c.strokeStyle = INK;
    c.lineWidth = 2.6;
    c.lineJoin = 'round';
    // tail
    c.fillStyle = tone('#ff9f1c');
    c.beginPath();
    c.moveTo(-6, 0);
    c.lineTo(-13, -5 + thrash * 3);
    c.lineTo(-11, 0 + thrash * 3);
    c.lineTo(-13, 5 + thrash * 3);
    c.closePath();
    c.fill();
    c.stroke();
    // body
    c.fillStyle = tone('#ff7b2e');
    c.beginPath();
    c.ellipse(0, 0, 8.5, 5, 0, 0, TAU);
    c.fill();
    c.stroke();
    c.strokeStyle = tone('#ffd9b0');
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(-1, 0, 3.6, -0.9, 0.9);
    c.stroke();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(4.5, -1.2, 2, 0, TAU);
    c.fill();
    c.fillStyle = INK;
    c.beginPath();
    c.arc(5, -1.2, 1, 0, TAU);
    c.fill();
  });
};

// ───────────── things that wait ─────────────

const mousetrap: Art = ({ ctx, o, x, y, z, angle, tone }) => {
  const armed = o.tags.has('armed');
  const shut = o.sprung;
  prism(ctx, x, y, angle, z, z + 2.5, box(9, 6, 1.5), tone('#a8713d'), tone('#e0a868'), INK, 3);
  onTop(ctx, x, y, angle, z + 2.5, (c) => {
    // the spring across the middle
    c.strokeStyle = tone(STEEL_DARK);
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(0, -5);
    c.lineTo(0, 5);
    c.stroke();
    if (!shut) {
      c.fillStyle = tone('#ffd23f');
      c.strokeStyle = INK;
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(3, -3);
      c.lineTo(7.5, 0);
      c.lineTo(3, 3);
      c.closePath();
      c.fill();
      c.stroke();
    }
    // the bar: pulled back when set, slammed forward when sprung
    c.strokeStyle = INK;
    c.lineWidth = 3.4;
    c.beginPath();
    if (shut) c.rect(0.5, -4.5, 7.5, 9);
    else c.rect(-8, -4.5, 7.5, 9);
    c.stroke();
    c.strokeStyle = tone(armed ? '#ffffff' : STEEL);
    c.lineWidth = 1.5;
    c.stroke();
  });
};

const rake: Art = ({ ctx, o, x, y, z, angle, tone }) => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const hx = x + c * 24;
  const hy = y + s * 24 - z;
  // stepped on: the handle whips up to face height and drops back
  const up = Math.sin(Math.PI * Math.min(1, o.sprungAnim));
  const tx = x - c * 30 + (hx - (x - c * 30)) * up * 0.92;
  const ty = y - s * 30 - z + (hy - 52 - (y - s * 30 - z)) * up;
  // the head: a bar across with teeth
  const px = -s;
  const py = c;
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(hx + px * 10, hy + py * 10);
  ctx.lineTo(hx - px * 10, hy - py * 10);
  ctx.stroke();
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  for (let i = -2; i <= 2; i++) {
    ctx.moveTo(hx + px * i * 5, hy + py * i * 5);
    ctx.lineTo(hx + px * i * 5 + c * 6, hy + py * i * 5 + s * 6);
  }
  ctx.stroke();
  ctx.strokeStyle = tone('#5fae57');
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(hx + px * 10, hy + py * 10);
  ctx.lineTo(hx - px * 10, hy - py * 10);
  ctx.stroke();
  ctx.lineCap = 'butt';
  pole(ctx, hx, hy, tx, ty, tone('#c98a4b'), 2.8);
};

// ───────────── things that pull, power and pour ─────────────

const magnet: Art = ({ ctx, o, x, y, z, angle, time, tone }) => {
  const live = !o.held;
  const shoe = (c: Ctx): void => {
    c.beginPath();
    c.moveTo(9, -6.5);
    c.lineTo(-2, -6.5);
    c.arc(-2, 0, 6.5, -Math.PI / 2, Math.PI / 2, true);
    c.lineTo(9, 6.5);
  };
  for (const [lift, top] of [[0, false], [3, false], [6, true]] as const) {
    onTop(ctx, x, y, angle, z + lift, (c) => {
      c.lineCap = 'butt';
      shoe(c);
      c.strokeStyle = INK;
      c.lineWidth = 9;
      c.stroke();
      shoe(c);
      c.strokeStyle = tone(top ? '#e5383b' : '#a32626');
      c.lineWidth = 5.6;
      c.stroke();
      // bare steel at the poles
      c.strokeStyle = tone(top ? '#e6ebf2' : STEEL_DARK);
      c.beginPath();
      c.moveTo(5, -6.5);
      c.lineTo(9, -6.5);
      c.moveTo(5, 6.5);
      c.lineTo(9, 6.5);
      c.stroke();
    });
  }
  if (!live) return;
  // lines of force twitching between the poles
  onTop(ctx, x, y, angle, z + 6, (c) => {
    c.strokeStyle = 'rgba(127, 243, 255, 0.85)';
    c.lineWidth = 1.5;
    c.beginPath();
    for (let i = 0; i < 2; i++) {
      const bulge = 6 + i * 6 + Math.sin(time * 9 + i * 2) * 2;
      c.moveTo(11, -6.5);
      c.quadraticCurveTo(11 + bulge, 0, 11, 6.5);
    }
    c.stroke();
  });
};

const battery: Art = ({ ctx, x, y, z, angle, time, tone }) => {
  prism(ctx, x, y, angle, z, z + 12, box(14, 9, 2.5), tone(DARKER), tone('#3b3550'));
  onTop(ctx, x, y, angle, z + 12, (c) => {
    c.fillStyle = tone('#ffd23f');
    c.fillRect(-13, -2, 26, 4);
    for (const [tx, color] of [[-8, '#e5383b'], [8, '#2f4fb5']] as const) {
      c.fillStyle = tone(color);
      c.strokeStyle = INK;
      c.lineWidth = 1.8;
      c.beginPath();
      c.arc(tx, -5, 3, 0, TAU);
      c.fill();
      c.stroke();
    }
    // a lazy arc between the terminals now and then
    const slice = Math.floor(time * 9);
    if (hash(slice + x * 0.01) > 0.62) {
      c.strokeStyle = '#fff7a8';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(-5, -5);
      c.lineTo(-2, -7 + hash(slice) * 4);
      c.lineTo(2, -3 - hash(slice * 2) * 4);
      c.lineTo(5, -5);
      c.stroke();
    }
  });
  if (facesCamera(angle)) {
    const front = y + 9 - z;
    ctx.fillStyle = tone('#fbf6e9');
    ctx.fillRect(x - 9, front - 9, 18, 5);
    ctx.fillStyle = INK;
    ctx.fillRect(x - 6, front - 7.2, 4, 1.4);
    ctx.fillRect(x + 2, front - 7.2, 4, 1.4);
    ctx.fillRect(x + 3.3, front - 8.5, 1.4, 4);
  }
};

const bucket: Art = ({ ctx, o, x, y, z, angle, time, tone }) => {
  const full = o.tags.has('full');
  prism(ctx, x, y, angle, z, z + 14, circle(11), tone(STEEL_DARK), tone(STEEL));
  onTop(ctx, x, y, angle, z + 14, (c) => {
    c.fillStyle = full ? tone('#4ad6e8') : tone('#3b4152');
    c.beginPath();
    c.arc(0, 0, 8.6, 0, TAU);
    c.fill();
    if (!full) return;
    c.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    c.lineWidth = 1.8;
    c.lineCap = 'round';
    c.beginPath();
    const slosh = Math.sin(time * 3 + o.seed * 5) * 1.5;
    c.moveTo(-5, -1 + slosh);
    c.quadraticCurveTo(-2, -4 + slosh, 1, -1 + slosh);
    c.moveTo(0, 3 - slosh);
    c.quadraticCurveTo(2.5, 1 - slosh, 5, 3 - slosh);
    c.stroke();
    c.lineCap = 'butt';
  });
  // the wire handle, flopped over the rim
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(x, y - z - 14, 11, 7, 0, Math.PI * 0.08, Math.PI * 0.92);
  ctx.stroke();
};

// ───────────── things on a timer ─────────────

const firework: Art = ({ ctx, o, x, y, z, angle, time, tone }) => {
  const lit = o.fuseLeft > 0;
  onTop(ctx, x, y, angle, z + 3, (c) => {
    c.lineJoin = 'round';
    // the stick
    c.strokeStyle = INK;
    c.lineWidth = 3.6;
    c.beginPath();
    c.moveTo(-15, 2.5);
    c.lineTo(-1, 2.5);
    c.stroke();
    c.strokeStyle = tone('#c98a4b');
    c.lineWidth = 1.6;
    c.stroke();
    // the tube
    c.fillStyle = tone('#e5383b');
    c.strokeStyle = INK;
    c.lineWidth = 2.8;
    c.beginPath();
    roundRectPath(c, -4, -4, 13, 8, 1.5);
    c.fill();
    c.stroke();
    c.fillStyle = tone('#fbf6e9');
    c.fillRect(-1, -3, 2.4, 6);
    c.fillRect(4, -3, 2.4, 6);
    // the nose cone
    c.fillStyle = tone('#ffd23f');
    c.beginPath();
    c.moveTo(9, -4.6);
    c.lineTo(15.5, 0);
    c.lineTo(9, 4.6);
    c.closePath();
    c.fill();
    c.stroke();
    // the blue touchpaper
    c.strokeStyle = lit ? '#ffe45c' : tone('#2f4fb5');
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-4, -1);
    c.quadraticCurveTo(-8, -6, -11, -3);
    c.stroke();
    if (lit) {
      const f = 2.5 + hash(Math.floor(time * 30)) * 2.5;
      c.fillStyle = '#fff7c2';
      c.beginPath();
      c.arc(-11, -3, f, 0, TAU);
      c.fill();
    }
  });
};

const cooker: Art = ({ ctx, o, x, y, z, angle, time, tone }) => {
  const lit = o.fuseLeft > 0;
  // it shakes harder the closer it gets
  const rattle = lit ? (1 - Math.min(1, o.fuseLeft / 2.5)) * 2.2 + 0.6 : 0;
  const sx = x + (lit ? Math.sin(time * 71) * rattle : 0);
  onTop(ctx, sx, y, angle, z + 8, (c) => {
    c.fillStyle = DARKER;
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    for (const side of [-1, 1]) {
      c.beginPath();
      roundRectPath(c, side * 14 - 4, -3, 8, 6, 2.5);
      c.fill();
      c.stroke();
    }
  });
  prism(ctx, sx, y, angle, z, z + 11, circle(12), tone(STEEL_DARK), tone(STEEL));
  prism(ctx, sx, y, angle, z + 11, z + 13, circle(10.5), tone('#8892a6'), tone(lit ? '#ffb4a8' : '#cfd6e2'), INK, 2.6);
  onTop(ctx, sx, y, angle, z + 13, (c) => {
    c.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 0, 7, Math.PI * 1.1, Math.PI * 1.5);
    c.stroke();
    // the weight on the valve
    c.fillStyle = lit ? '#e5383b' : DARKER;
    c.strokeStyle = INK;
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 0, 3.4, 0, TAU);
    c.fill();
    c.stroke();
  });
  if (!lit) return;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = -1; i <= 1; i++) {
    const sway = Math.sin(time * 15 + i * 2.1) * 4;
    const top = y - z - 13;
    ctx.moveTo(sx + i * 2, top - 4);
    ctx.quadraticCurveTo(sx + i * 7 + sway, top - 16, sx + i * 11 - sway, top - 26 - rattle * 4);
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
};

const boombox: Art = ({ ctx, o, x, y, z, angle, time, tone }) => {
  const playing = o.tags.has('playing');
  const broken = o.structural === 'broken';
  const thump = playing ? 0.5 + 0.5 * Math.sin(time * 21) : 0;
  prism(ctx, x, y, angle, z, z + 12, box(17, 8, 3), tone(DARKER), tone('#3b3550'));
  onTop(ctx, x, y, angle, z + 12, (c) => {
    // carry handle and a row of chunky buttons
    c.strokeStyle = INK;
    c.lineWidth = 5;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-10, -3);
    c.lineTo(10, -3);
    c.stroke();
    c.strokeStyle = tone(STEEL);
    c.lineWidth = 2.2;
    c.stroke();
    c.lineCap = 'butt';
    const buttons = ['#e5383b', '#ffd23f', '#9be564', '#4ad6e8'];
    for (let i = 0; i < 4; i++) {
      c.fillStyle = tone(buttons[i]!);
      c.fillRect(-9 + i * 5, 2, 3.4, 3.4);
    }
    if (broken) cracks(c, o.seed, 12);
  });
  if (!facesCamera(angle)) return;
  const front = y + 8 - z;
  for (const side of [-1, 1]) {
    const r = 4.6 + thump * 1.3;
    ctx.fillStyle = tone('#8892a6');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(x + side * 10.5, front - 6, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = DARKER;
    ctx.beginPath();
    ctx.arc(x + side * 10.5, front - 6, r * 0.45, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = broken ? DARKER : playing ? '#9be564' : tone('#fbf6e9');
  ctx.fillRect(x - 3.5, front - 9, 7, 4);
};

// ───────────── things full of water ─────────────

const fishtank: Art = ({ ctx, o, x, y, z, angle, time, tone }) => {
  prism(ctx, x, y, angle, z, z + 3, box(22, 13, 2), tone(DARKER), tone(DARK));
  ctx.globalAlpha = 0.86;
  prism(ctx, x, y, angle, z + 3, z + 21, box(22, 13, 2), tone('#3fa7c4'), tone('#9cecf5'));
  ctx.globalAlpha = 1;
  onTop(ctx, x, y, angle, z + 21, (c) => {
    c.strokeStyle = tone(DARK);
    c.lineWidth = 2.6;
    c.beginPath();
    roundRectPath(c, -21, -12, 42, 24, 2);
    c.stroke();
    // two residents doing laps
    for (let i = 0; i < 2; i++) {
      const a = time * (0.9 + i * 0.35) + i * 3 + o.seed * 6;
      const fx = Math.cos(a) * (11 - i * 3);
      const fy = Math.sin(a) * (5 - i);
      const heading = a + Math.PI / 2;
      c.save();
      c.translate(fx, fy);
      c.rotate(heading);
      c.fillStyle = tone(i === 0 ? '#ff7b2e' : '#ffd23f');
      c.beginPath();
      c.ellipse(0, 0, 4.4, 2.4, 0, 0, TAU);
      c.moveTo(-3.5, 0);
      c.lineTo(-7, -2.6);
      c.lineTo(-7, 2.6);
      c.closePath();
      c.fill();
      c.restore();
    }
    c.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    c.lineWidth = 2;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-16, -8);
    c.lineTo(-9, -8);
    c.stroke();
    c.lineCap = 'butt';
    if (o.structural === 'damaged') cracks(c, o.seed, 16);
  });
  if (facesCamera(angle)) {
    // weed and bubbles against the front glass
    const front = y + 13 - z;
    ctx.strokeStyle = tone('#3f8f4a');
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const dx of [-13, 12]) {
      const sway = Math.sin(time * 1.6 + dx) * 2.5;
      ctx.moveTo(x + dx, front - 5);
      ctx.quadraticCurveTo(x + dx + sway, front - 11, x + dx - sway, front - 17);
    }
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let i = 0; i < 3; i++) {
      const t = (time * 0.5 + i * 0.37) % 1;
      ctx.beginPath();
      ctx.arc(x + 2 + i * 4, front - 5 - t * 13, 1.2 + i * 0.3, 0, TAU);
      ctx.fill();
    }
  }
};

const watercooler: Art = ({ ctx, o, x, y, z, angle, time, tone }) => {
  if (!o.standing && o.tipProgress < 0) {
    // on its side: cabinet one end, empty bottle the other
    prism(ctx, x, y, angle, z, z + 11, rect(-28, -11, 31, 22, 4), tone('#b9c2d0'), tone('#f1f3f7'));
    ctx.globalAlpha = 0.8;
    prism(ctx, x, y, angle, z, z + 9, rect(3, -9, 25, 18, 8), tone('#6fb9d6'), tone('#c6eef7'), INK, 3.5);
    ctx.globalAlpha = 1;
    return;
  }
  const t = o.tipProgress >= 0 ? easeInQuad(Math.min(1, o.tipProgress)) : 0;
  const squat = 1 - t * 0.7;
  const ox = x + o.tipDirX * 26 * t;
  const oy = y + o.tipDirY * 26 * t;
  prism(ctx, ox, oy, angle, z, z + 28 * squat, circle(12), tone('#b9c2d0'), tone('#f1f3f7'));
  ctx.globalAlpha = 0.82;
  prism(ctx, ox, oy, angle, z + 28 * squat, z + 46 * squat, circle(9), tone('#4fb4d8'), tone('#9cecf5'), INK, 3.5);
  ctx.globalAlpha = 1;
  prism(ctx, ox, oy, angle, z + 46 * squat, z + 49 * squat, circle(5), tone('#2f7f9e'), tone('#6fb9d6'), INK, 2.6);
  if (t > 0) return;
  // a bubble going up the bottle every so often
  const rise = (time * 0.45 + o.seed) % 1;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.arc(x - 2 + Math.sin(rise * 9) * 2, y - z - 30 - rise * 14, 1.8, 0, TAU);
  ctx.fill();
  // taps
  const front = y + 11 - z;
  for (const [dx, color] of [[-4, '#e5383b'], [4, '#2f4fb5']] as const) {
    ctx.fillStyle = tone(color);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x + dx, front - 19, 2.4, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
};

// ───────────── things that roll, sweep and scorch ─────────────

const officechair: Art = ({ ctx, x, y, z, angle, tone }) => {
  // five-star base on castors
  onTop(ctx, x, y, angle, z, (c) => {
    c.strokeStyle = INK;
    c.lineWidth = 4.5;
    c.lineCap = 'round';
    c.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.3;
      c.moveTo(0, 0);
      c.lineTo(Math.cos(a) * 14, Math.sin(a) * 14);
    }
    c.stroke();
    c.lineCap = 'butt';
    c.fillStyle = DARKER;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.3;
      c.beginPath();
      c.arc(Math.cos(a) * 14, Math.sin(a) * 14, 3, 0, TAU);
      c.fill();
    }
  });
  const back = (): void => prism(ctx, x, y, angle, z + 12, z + 28, rect(-15, -10, 5, 20, 2.5), tone(DARKER), tone('#3b3550'));
  const seat = (): void => {
    prism(ctx, x, y, angle, z + 8, z + 13, circle(12), tone(DARKER), tone('#2f7f86'));
    onTop(ctx, x, y, angle, z + 13, (c) => {
      c.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, 0, 7.5, Math.PI * 1.1, Math.PI * 1.6);
      c.stroke();
    });
  };
  if (Math.sin(angle) * -12 > 0) {
    seat();
    back();
  } else {
    back();
    seat();
  }
};

const bowlingball: Art = ({ ctx, x, y, z, angle, tone }) => {
  const cy = y - z - 10;
  ctx.fillStyle = tone('#3b2f6b');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(x, cy, 11, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // marbling
  ctx.strokeStyle = tone('#6a57b0');
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + 3, cy + 4, 7, Math.PI * 0.9, Math.PI * 1.5);
  ctx.stroke();
  // finger holes roll round with the ball
  ctx.fillStyle = DARKER;
  const roll = Math.cos(angle);
  const tilt = Math.sin(angle);
  for (const [hx, hy] of [[-2.6, -2.6], [2.6, -2.6], [0, 2.2]] as const) {
    ctx.beginPath();
    ctx.arc(x + roll * 4 + hx, cy + tilt * 3 + hy - 1, 1.7, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.beginPath();
  ctx.arc(x - 4.5, cy - 5, 2.4, 0, TAU);
  ctx.fill();
};

const broom: Art = ({ ctx, x, y, z, angle, tone }) => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  pole(ctx, x - c * 30, y - s * 30 - z - 2, x + c * 16, y + s * 16 - z - 2, tone('#c98a4b'), 2.8);
  prism(ctx, x, y, angle, z, z + 4, rect(15, -9, 15, 18, 2), tone('#b8892a'), tone('#f2c14e'), INK, 3.2);
  onTop(ctx, x, y, angle, z + 4, (k) => {
    k.strokeStyle = tone('#b8892a');
    k.lineWidth = 1.4;
    k.beginPath();
    for (let i = -6; i <= 6; i += 3) {
      k.moveTo(19, i);
      k.lineTo(29, i);
    }
    k.stroke();
    k.fillStyle = tone('#e5383b');
    k.fillRect(15.5, -8, 3, 16);
  });
};

const iron: Art = ({ ctx, o, x, y, z, angle, time, tone }) => {
  const broken = o.structural === 'broken';
  const sole: PathFn = (c) => {
    c.moveTo(12, 0);
    c.quadraticCurveTo(4, -7, -9, -7);
    c.lineTo(-11, -5);
    c.lineTo(-11, 5);
    c.lineTo(-9, 7);
    c.quadraticCurveTo(4, 7, 12, 0);
    c.closePath();
  };
  prism(ctx, x, y, angle, z, z + 3, sole, tone(STEEL_DARK), tone(STEEL), INK, 3.2);
  prism(ctx, x, y, angle, z + 3, z + 8, sole, tone('#2f7f9e'), tone('#4ad6e8'), INK, 2.6);
  onTop(ctx, x, y, angle, z + 10, (c) => {
    c.lineCap = 'round';
    c.strokeStyle = INK;
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(-8, 0);
    c.lineTo(3, 0);
    c.stroke();
    c.strokeStyle = tone(DARK);
    c.lineWidth = 3;
    c.stroke();
    c.lineCap = 'butt';
    c.fillStyle = broken ? DARKER : Math.floor(time * 3) % 2 === 0 ? '#ff5a4e' : '#a32626';
    c.beginPath();
    c.arc(7, 0, 1.6, 0, TAU);
    c.fill();
    if (broken) cracks(c, o.seed, 9);
  });
  if (broken) return;
  // heat coming off the plate
  ctx.strokeStyle = 'rgba(255, 159, 28, 0.55)';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = -1; i <= 1; i++) {
    const sway = Math.sin(time * 6 + i * 1.7) * 2;
    ctx.moveTo(x + i * 6, y - z - 12);
    ctx.quadraticCurveTo(x + i * 6 + sway, y - z - 17, x + i * 6 - sway, y - z - 21);
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
};

const ARTS: Readonly<Record<string, Art>> = {
  hoover, teeth, boomerang, fish, mousetrap, rake, magnet, battery, bucket, firework, cooker, boombox,
  fishtank, watercooler, officechair, bowlingball, broom, iron,
};

/** Called once at start-up; replaces the generic fallback drawing for every gadget. */
export function registerGadgetArt(): void {
  for (const [id, draw] of Object.entries(ARTS)) registerObjectArt(id, draw);
}
