import type { TextureId } from '../ball/Skins';
import texHex from '../assets/balls/tex-hex.webp?url';
import texHoney from '../assets/balls/tex-honey.webp?url';
import texTri from '../assets/balls/tex-tri.webp?url';
import texFlame from '../assets/balls/tex-flame.webp?url';
import texToxic from '../assets/balls/tex-toxic.webp?url';
import texStar from '../assets/balls/tex-star.webp?url';
import texIce from '../assets/balls/tex-ice.webp?url';
import texSkull from '../assets/balls/tex-skull.webp?url';

const URLS: Readonly<Record<TextureId, string>> = {
  hex: texHex,
  honey: texHoney,
  tri: texTri,
  flame: texFlame,
  toxic: texToxic,
  star: texStar,
  ice: texIce,
  skull: texSkull,
};

/** How many times the picture goes round the ball, and how many times from pole to pole. */
const REPEAT_U = 3;
const REPEAT_V = 2;
/** The ball is sampled on a square this many pixels wide; the disc fills all but a margin at its edge. */
const SIZE = 128;
const RADIUS = SIZE / 2 - 2;
const TAU = Math.PI * 2;

/** How far the picture is lifted towards white, so the balls read bright rather than murky. */
const LIFT = 0.18;
/** How far the picture's colours are pushed away from mid grey: more contrast, darks darker and lights brighter. */
const CONTRAST = 1.35;

/** Lifts every colour of the picture towards white; the alpha stays as it was. */
function lighten(p: Uint8ClampedArray): Uint8ClampedArray {
  for (let i = 0; i < p.length; i += 4) {
    for (let k = 0; k < 3; k++) p[i + k] = (p[i + k] - 128) * CONTRAST + 128 + (255 - p[i + k]) * LIFT;
  }
  return p;
}

/** A ball's picture, read into pixels once it has loaded. Until then the ball is painted the old way. */
export class BallTexture {
  pixels: Uint8ClampedArray | null = null;
  w = 0;
  h = 0;
  readonly ready: Promise<void>;

  constructor(url: string) {
    this.ready = new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const cx = c.getContext('2d', { willReadFrequently: true });
        if (cx) {
          cx.drawImage(img, 0, 0);
          this.pixels = lighten(cx.getImageData(0, 0, c.width, c.height).data);
          this.w = c.width;
          this.h = c.height;
        }
        resolve();
      };
      img.onerror = () => resolve();
      img.src = url;
    });
  }

  get loaded(): boolean {
    return this.pixels !== null;
  }
}

const cache = new Map<TextureId, BallTexture>();

/** The picture for a skin, loading it the first time it is asked for. */
export function ballTexture(id: TextureId): BallTexture {
  let t = cache.get(id);
  if (!t) {
    t = new BallTexture(URLS[id]);
    cache.set(id, t);
  }
  return t;
}

interface Geometry {
  pix: Int32Array;
  nx: Float32Array;
  ny: Float32Array;
  nz: Float32Array;
  shade: Float32Array;
  alpha: Float32Array;
  count: number;
}

/** Light from the upper left, in front; the view looks straight down the z axis, towards the viewer at z < 0. */
const LX = -0.45;
const LY = -0.6;
const LZ = -0.66;
const HX = LX;
const HY = LY;
const HZ = LZ - 1;
const HL = Math.hypot(HX, HY, HZ);

let geo: Geometry | null = null;

/**
 * Every pixel of the disc, once: where it sits on the sphere (its normal, pointing at the viewer), its light,
 * and how much of it is inside the edge. Only the picture's lookup changes from frame to frame.
 */
function geometry(): Geometry {
  if (geo) return geo;
  const pix: number[] = [];
  const nx: number[] = [];
  const ny: number[] = [];
  const nz: number[] = [];
  const shade: number[] = [];
  const alpha: number[] = [];
  for (let j = 0; j < SIZE; j++) {
    for (let i = 0; i < SIZE; i++) {
      const dx = i + 0.5 - SIZE / 2;
      const dy = j + 0.5 - SIZE / 2;
      const d = Math.hypot(dx, dy);
      if (d > RADIUS + 0.5) continue;
      let x = dx / RADIUS;
      let y = dy / RADIUS;
      const len = Math.hypot(x, y);
      if (len > 1) {
        x /= len;
        y /= len;
      }
      const z = -Math.sqrt(Math.max(0, 1 - x * x - y * y));
      const diffuse = Math.max(0, x * LX + y * LY + z * LZ);
      const half = Math.max(0, x * HX + y * HY + z * HZ) / HL;
      // Gloss: a tight bright spot where the light catches the varnish, and a broader sheen on top of it.
      const spec = Math.pow(half, 40) * 0.45 + Math.pow(half, 10) * 0.05;
      // The rim turns darker, which gives the edge of the ball its shape.
      const rim = 0.7 + 0.3 * Math.pow(-z, 0.6);
      pix.push(j * SIZE + i);
      nx.push(x);
      ny.push(y);
      nz.push(z);
      shade.push((0.5 + 0.75 * diffuse + spec) * rim);
      alpha.push(Math.min(1, Math.max(0, RADIUS + 0.5 - d)));
    }
  }
  geo = {
    pix: Int32Array.from(pix),
    nx: Float32Array.from(nx),
    ny: Float32Array.from(ny),
    nz: Float32Array.from(nz),
    shade: Float32Array.from(shade),
    alpha: Float32Array.from(alpha),
    count: pix.length,
  };
  return geo;
}

let scratch: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; image: ImageData } | null = null;

function scratchBuffer(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; image: ImageData } | null {
  if (scratch) return scratch;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  scratch = { canvas, ctx, image: ctx.createImageData(SIZE, SIZE) };
  return scratch;
}

/**
 * Paints the ball's picture on the sphere, centred on the origin of `ctx` (which already carries the ball's
 * squash and pop). `orient` holds the ball's three axes on screen, as rows: each pixel looks up the point of
 * the picture that sits under it, so the picture turns with the ball's roll.
 */
export function paintSphere(ctx: CanvasRenderingContext2D, tex: BallTexture, orient: Float32Array, r: number): void {
  const src = tex.pixels;
  const buf = scratchBuffer();
  if (!src || !buf) return;
  const g = geometry();
  const out = buf.image.data;
  const tw = tex.w;
  const th = tex.h;
  for (let k = 0; k < g.count; k++) {
    const x = g.nx[k];
    const y = g.ny[k];
    const z = g.nz[k];
    // The point on the ball, in the ball's own frame.
    const qx = orient[0] * x + orient[1] * y + orient[2] * z;
    const qy = orient[3] * x + orient[4] * y + orient[5] * z;
    const qz = orient[6] * x + orient[7] * y + orient[8] * z;
    const lon = Math.atan2(qx, -qz);
    const lat = Math.asin(Math.max(-1, Math.min(1, qy)));
    let u = (lon / TAU) * REPEAT_U + 0.5;
    u -= Math.floor(u);
    let v = (0.5 - lat / Math.PI) * REPEAT_V;
    v -= Math.floor(v);
    const tx = Math.min(tw - 1, (u * tw) | 0);
    const ty = Math.min(th - 1, (v * th) | 0);
    const si = (ty * tw + tx) * 4;
    const s = g.shade[k];
    const o = g.pix[k] * 4;
    out[o] = src[si] * s;
    out[o + 1] = src[si + 1] * s;
    out[o + 2] = src[si + 2] * s;
    out[o + 3] = g.alpha[k] * 255;
  }
  buf.ctx.putImageData(buf.image, 0, 0);
  const side = (r * (SIZE / 2)) / RADIUS;
  ctx.drawImage(buf.canvas, -side, -side, side * 2, side * 2);
  // Gloss on top: a soft sheen over the upper left, and the bright spot of a varnished ball.
  const sheen = ctx.createRadialGradient(-r * 0.35, -r * 0.4, 0, -r * 0.35, -r * 0.4, r * 0.8);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
  sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.4, -r * 0.46, r * 0.24, r * 0.13, -0.7, 0, TAU);
  ctx.fill();
}

/** The ball's axes turned by `yaw` about the vertical and then `pitch` about the horizontal: a still picture of it. */
export function tiltedOrient(yaw: number, pitch: number): Float32Array {
  const o = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  turn(o, 0, 1, 0, yaw);
  turn(o, 1, 0, 0, pitch);
  return o;
}

/** Turns each of the three axes (rows of `o`) about a unit axis, as the ball's roll does. */
export function turn(o: Float32Array, ax: number, ay: number, az: number, theta: number): void {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  for (let i = 0; i < 9; i += 3) {
    const x = o[i];
    const y = o[i + 1];
    const z = o[i + 2];
    const dot = (ax * x + ay * y + az * z) * (1 - c);
    o[i] = x * c + (ay * z - az * y) * s + ax * dot;
    o[i + 1] = y * c + (az * x - ax * z) * s + ay * dot;
    o[i + 2] = z * c + (ax * y - ay * x) * s + az * dot;
  }
}

/** A still picture of a skin's ball as a PNG, for the Balls screen. */
export async function sphereSnapshot(id: TextureId, px: number, yaw = 0.45, pitch = 0.3): Promise<string> {
  const tex = ballTexture(id);
  await tex.ready;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx || !tex.loaded) return '';
  ctx.translate(px / 2, px / 2);
  paintSphere(ctx, tex, tiltedOrient(yaw, pitch), px / 2 - 2);
  return canvas.toDataURL('image/png');
}
