/**
 * Generates the sample artwork shipped in /public/media.
 *   node scripts/generate-art.mjs
 *
 * Each world is composed procedurally as SVG (seeded, deterministic) and
 * rasterised to WebP with sharp. Replace these with real key art by pointing
 * the content at Google Drive URLs from the admin panel.
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", "media");

/* ---------------------------------------------------------------- utils */

const mulberry32 = (a) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const hash = (s) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};
const f = (n) => Math.round(n * 10) / 10;

class Ctx {
  constructor(w, h, seed) {
    this.w = w;
    this.h = h;
    this.r = mulberry32(seed);
    this.defs = [];
    this.n = 0;
    this.m = Math.min(w, h);
  }
  rand(a = 0, b = 1) {
    return a + (b - a) * this.r();
  }
  pick(arr) {
    return arr[Math.floor(this.r() * arr.length)];
  }
  id(p) {
    return `${p}${this.n++}`;
  }
}

const stopsXml = (stops) =>
  stops.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`).join("");

function linear(ctx, stops, { x1 = 0, y1 = 0, x2 = 0, y2 = 1 } = {}) {
  const id = ctx.id("lg");
  ctx.defs.push(`<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopsXml(stops)}</linearGradient>`);
  return `url(#${id})`;
}
function radial(ctx, stops, { cx = 0.5, cy = 0.5, r = 0.5 } = {}) {
  const id = ctx.id("rg");
  ctx.defs.push(`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stopsXml(stops)}</radialGradient>`);
  return `url(#${id})`;
}
const bg = (ctx, fill) => `<rect width="${ctx.w}" height="${ctx.h}" fill="${fill}"/>`;
function glow(ctx, cx, cy, rad, color, op = 1) {
  const fill = radial(ctx, [[0, color, op], [0.3, color, op * 0.45], [1, color, 0]]);
  return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rad)}" fill="${fill}"/>`;
}
function ridge(ctx, baseY, amp, fill, { op = 1, freq = 1, jag = 0, steps = 120 } = {}) {
  const p = [ctx.rand(0, 6.3), ctx.rand(0, 6.3), ctx.rand(0, 6.3)];
  let d = `M0 ${ctx.h}`;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2 * freq;
    const n =
      0.55 * Math.sin(t * 1.3 + p[0]) + 0.3 * Math.sin(t * 3.1 + p[1]) + 0.15 * Math.sin(t * 7.7 + p[2]) +
      (jag ? (ctx.r() - 0.5) * jag : 0);
    d += ` L${f((ctx.w * i) / steps)} ${f(baseY - amp * n)}`;
  }
  return `<path d="${d} L${ctx.w} ${ctx.h} Z" fill="${fill}" opacity="${op}"/>`;
}
function stars(ctx, count, maxY, color = "#ffffff") {
  let s = "";
  const k = ctx.m / 1000;
  for (let i = 0; i < count; i++) {
    s += `<circle cx="${f(ctx.rand(0, ctx.w))}" cy="${f(ctx.rand(0, maxY))}" r="${f(ctx.rand(0.5, 1.8) * k)}" fill="${color}" opacity="${f(ctx.rand(0.15, 0.9))}"/>`;
  }
  return s;
}
function wobble(ctx, cx, cy, rx, ry, amt = 0.05) {
  const p = ctx.rand(0, 6.3);
  let d = "";
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const k = 1 + amt * Math.sin(a * 3 + p) + amt * 0.5 * Math.sin(a * 7 - p);
    d += `${i ? "L" : "M"}${f(cx + Math.cos(a) * rx * k)} ${f(cy + Math.sin(a) * ry * k)}`;
  }
  return d + "Z";
}
function finish(ctx) {
  const g = ctx.id("gr");
  ctx.defs.push(
    `<filter id="${g}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>`,
  );
  const vig = radial(ctx, [[0, "#000", 0], [0.6, "#000", 0.12], [1, "#000", 0.78]], { r: 0.75 });
  return `<rect width="${ctx.w}" height="${ctx.h}" fill="${vig}"/><rect width="${ctx.w}" height="${ctx.h}" filter="url(#${g})" opacity="0.07"/>`;
}
const silhouette = (x, y, s, color) =>
  `<g fill="${color}"><circle cx="${f(x)}" cy="${f(y - s * 1.75)}" r="${f(s * 0.28)}"/><rect x="${f(x - s * 0.26)}" y="${f(y - s * 1.45)}" width="${f(s * 0.52)}" height="${f(s * 1.45)}" rx="${f(s * 0.2)}"/></g>`;

/* ---------------------------------------------------------------- worlds */

const worlds = {
  cartographer(ctx, v) {
    const { w, h, m } = ctx;
    let s = bg(ctx, linear(ctx, [[0, "#07061a"], [0.45, "#1a1650"], [0.75, "#5a44a8"], [1, "#120e2e"]]));
    s += stars(ctx, 220, h * 0.55, "#dcd4ff");
    const mx = w * ctx.rand(0.2, 0.8), my = h * ctx.rand(0.14, 0.28);
    s += glow(ctx, mx, my, m * 0.55, "#b9a8ff", 0.5) + `<circle cx="${f(mx)}" cy="${f(my)}" r="${f(m * 0.05)}" fill="#f1edff"/>`;
    const ix = w * ctx.rand(0.35, 0.65), iy = h * 0.4, iw = m * ctx.rand(0.38, 0.52);
    s += `<path d="M${f(ix - iw / 2)} ${f(iy)} Q${f(ix)} ${f(iy - iw * 0.14)} ${f(ix + iw / 2)} ${f(iy)} L${f(ix + iw * 0.18)} ${f(iy + iw * 0.45)} L${f(ix)} ${f(iy + iw * 0.8)} L${f(ix - iw * 0.22)} ${f(iy + iw * 0.4)} Z" fill="#0b0920"/>`;
    s += `<path d="M${f(ix - iw / 2)} ${f(iy)} Q${f(ix)} ${f(iy - iw * 0.14)} ${f(ix + iw / 2)} ${f(iy)}" stroke="#cfc2ff" stroke-width="${f(m / 400)}" fill="none" opacity=".7"/>`;
    for (let k = 0; k < 4; k++) s += `<path d="M${f(ix - iw * 0.3 + k * iw * 0.15)} ${f(iy - iw * 0.02)} l0 ${f(-iw * ctx.rand(0.05, 0.14))}" stroke="#cfc2ff" stroke-width="${f(m / 500)}" opacity=".5"/>`;
    s += ridge(ctx, h * 0.72, h * 0.07, "#2a2263", { op: 0.95 });
    for (let k = 0; k < 11; k++)
      s += `<path d="${wobble(ctx, w * 0.5, h * 1.02, w * (0.08 + k * 0.075), h * (0.035 + k * 0.028), 0.06)}" stroke="#b8a9ff" stroke-width="${f(m / 700)}" fill="none" opacity="${f(0.28 - k * 0.018)}"/>`;
    s += ridge(ctx, h * 0.84, h * 0.05, "#15113a");
    s += ridge(ctx, h * 0.95, h * 0.04, "#07061a");
    const fx = w * (v % 2 ? 0.74 : 0.26), fy = h * 0.86;
    s += silhouette(fx, fy, m * 0.03, "#050414");
    s += `<path d="M${f(fx)} ${f(fy - m * 0.08)} Q${f((fx + ix) / 2)} ${f(h * 0.5)} ${f(ix)} ${f(iy + iw * 0.8)}" stroke="#ece6ff" stroke-width="${f(m / 600)}" stroke-dasharray="${f(m / 120)} ${f(m / 60)}" fill="none" opacity=".5"/>`;
    return s;
  },

  salt(ctx) {
    const { w, h, m } = ctx;
    const horizon = h * 0.64;
    let s = bg(ctx, linear(ctx, [[0, "#040304"], [0.35, "#170c06"], [0.64, "#4a2a12"], [0.645, "#0a0806"], [1, "#030405"]]));
    for (let i = 0; i < 6; i++) {
      const t = i / 6, aw = w * (0.62 - t * 0.09), cx = w / 2, top = h * (0.08 + t * 0.07);
      s += `<path d="M${f(cx - aw / 2)} ${f(horizon)} L${f(cx - aw / 2)} ${f(top + aw * 0.35)} Q${f(cx)} ${f(top - aw * 0.1)} ${f(cx + aw / 2)} ${f(top + aw * 0.35)} L${f(cx + aw / 2)} ${f(horizon)}" stroke="#ecdcc0" stroke-width="${f(m * 0.012 * (1 - t))}" fill="none" opacity="${f(0.05 + t * 0.05)}"/>`;
    }
    let ceil = `M0 0 L${w} 0`;
    for (let i = 40; i >= 0; i--) ceil += ` L${f((w * i) / 40)} ${f(h * (0.05 + (i % 3 === 0 ? ctx.rand(0.04, 0.12) : ctx.rand(0, 0.04))))}`;
    s += `<path d="${ceil} Z" fill="#020202"/>`;
    for (let i = 0; i < 16; i++) {
      const x = ctx.rand(w * 0.05, w * 0.95), y = ctx.rand(h * 0.28, horizon - h * 0.04), r = m * ctx.rand(0.004, 0.011);
      s += glow(ctx, x, y, r * 14, "#ffb35c", 0.55) + `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#ffe0a8"/>`;
      const refl = linear(ctx, [[0, "#ffb35c", 0.45], [1, "#ffb35c", 0]]);
      s += `<rect x="${f(x - r)}" y="${f(horizon)}" width="${f(r * 2)}" height="${f((horizon - y) * 0.9)}" fill="${refl}"/>`;
    }
    s += `<rect y="${f(horizon - h * 0.03)}" width="${w}" height="${f(h * 0.06)}" fill="${linear(ctx, [[0, "#d9a36a", 0], [0.5, "#d9a36a", 0.12], [1, "#d9a36a", 0]])}"/>`;
    const bx = w * ctx.rand(0.3, 0.7), by = horizon + h * 0.08, bw = m * 0.16;
    s += `<path d="M${f(bx - bw / 2)} ${f(by)} Q${f(bx)} ${f(by + bw * 0.25)} ${f(bx + bw / 2)} ${f(by)} Z" fill="#010101"/>` + silhouette(bx, by, m * 0.028, "#010101");
    s += glow(ctx, bx + bw * 0.3, by - m * 0.05, m * 0.08, "#ffc070", 0.8);
    return s;
  },

  kinetic(ctx) {
    const { w, h, m } = ctx;
    let s = bg(ctx, linear(ctx, [[0, "#03100e"], [0.4, "#0a3a32"], [0.72, "#2d8c70"], [1, "#062520"]]));
    const sx = w * ctx.rand(0.3, 0.7), sy = h * 0.52;
    s += glow(ctx, sx, sy, m * 0.7, "#c9ffe4", 0.55) + `<circle cx="${f(sx)}" cy="${f(sy)}" r="${f(m * 0.12)}" fill="#e8fff2" opacity=".9"/>`;
    for (let i = 0; i < 7; i++) {
      const cx = ctx.rand(0, w), cy = ctx.rand(h * 0.15, h * 0.7), r = m * ctx.rand(0.03, 0.09);
      s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" stroke="#a8ffd8" stroke-width="${f(r * 0.3)}" stroke-dasharray="${f(r * 0.22)} ${f(r * 0.22)}" fill="none" opacity=".35"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.3)}" fill="#a8ffd8" opacity=".25"/>`;
    }
    s += ridge(ctx, h * 0.76, h * 0.05, "#0b4a3d");
    for (let i = 0; i < 18; i++) {
      const x = ctx.rand(0, w), base = h * ctx.rand(0.8, 0.95), top = base - h * ctx.rand(0.15, 0.45), bend = m * ctx.rand(-0.12, 0.12);
      s += `<path d="M${f(x)} ${f(base)} C${f(x + bend)} ${f((base + top) / 2)} ${f(x - bend)} ${f(top + (base - top) * 0.2)} ${f(x + bend * 0.5)} ${f(top)}" stroke="#062a22" stroke-width="${f(m * 0.006)}" fill="none"/>`;
      for (let k = 0; k < 4; k++) {
        const ly = top + (base - top) * (k / 5);
        s += `<circle cx="${f(x + bend * ctx.rand(-0.5, 0.8))}" cy="${f(ly)}" r="${f(m * ctx.rand(0.008, 0.022))}" fill="${ctx.pick(["#5fd3a4", "#2bd67b", "#8f5bff"])}" opacity="${f(ctx.rand(0.5, 0.95))}"/>`;
      }
    }
    s += ridge(ctx, h * 0.97, h * 0.03, "#021310");
    return s;
  },

  orbit(ctx) {
    const { w, h, m } = ctx;
    const big = Math.max(w, h);
    let s = bg(ctx, radial(ctx, [[0, "#15122b"], [1, "#020206"]], { cy: 0.3, r: 0.9 }));
    s += stars(ctx, 520, h, "#e6e8ff");
    const pr = big * 0.8, py = h + pr * 0.62;
    s += glow(ctx, w / 2, py, pr * 1.12, "#9aa5ff", 0.35);
    s += `<circle cx="${f(w / 2)}" cy="${f(py)}" r="${f(pr)}" fill="${linear(ctx, [[0, "#d4d8ff"], [0.12, "#6a67b8"], [0.4, "#0a0a18"]])}"/>`;
    const cx = w * ctx.rand(0.3, 0.7), cy = h * ctx.rand(0.28, 0.42), rr = m * ctx.rand(0.16, 0.24), rot = ctx.rand(-25, 25);
    s += `<g transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})">`;
    s += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rr)}" ry="${f(rr * 0.32)}" stroke="#e3e6ff" stroke-width="${f(rr * 0.07)}" fill="none" opacity=".85"/>`;
    s += `<rect x="${f(cx - rr * 0.06)}" y="${f(cy - rr * 0.5)}" width="${f(rr * 0.12)}" height="${f(rr)}" fill="#c7ccf5"/>`;
    for (const side of [-1, 1]) {
      const px = cx + side * rr * 1.25;
      s += `<rect x="${f(px - rr * 0.22)}" y="${f(cy - rr * 0.08)}" width="${f(rr * 0.44)}" height="${f(rr * 0.16)}" fill="#1d2150" stroke="#8f9bff" stroke-width="${f(rr * 0.01)}"/>`;
      s += `<line x1="${f(cx + side * rr)}" y1="${f(cy)}" x2="${f(px - side * rr * 0.22)}" y2="${f(cy)}" stroke="#c7ccf5" stroke-width="${f(rr * 0.02)}"/>`;
    }
    s += `</g>`;
    s += glow(ctx, cx + rr * 0.4, cy - rr * 0.2, m * 0.06, "#ffffff", 0.9);
    s += `<rect x="0" y="${f(cy - rr * 0.2 - m * 0.001)}" width="${w}" height="${f(m * 0.002)}" fill="${linear(ctx, [[0, "#fff", 0], [0.5, "#fff", 0.35], [1, "#fff", 0]], { x2: 1, y2: 0 })}"/>`;
    return s;
  },

  bitflock(ctx) {
    const { w, h } = ctx;
    const p = Math.max(6, Math.round(w / 110));
    let s = bg(ctx, linear(ctx, [[0, "#070009"], [0.55, "#2c0232"], [1, "#050005"]]));
    const cx = w / 2, cy = h * 0.58, R = Math.min(w, h) * 0.26;
    for (let y = -R; y < R; y += p) for (let x = -R; x < R; x += p) {
      if (x * x + y * y > R * R) continue;
      const band = Math.floor((y + R) / (p * 3));
      if (y > 0 && band % 2 === 1) continue;
      s += `<rect x="${f(cx + x)}" y="${f(cy + y)}" width="${p - 1}" height="${p - 1}" fill="${y < 0 ? "#ff5fd2" : "#8f5bff"}" opacity="${f(0.55 + (-y / R) * 0.35)}"/>`;
    }
    const bird = [[0, 0], [1, 1], [2, 2], [3, 1], [4, 0]];
    for (let i = 0; i < 46; i++) {
      const bx = ctx.rand(0, w), by = ctx.rand(h * 0.05, h * 0.55), sc = ctx.pick([1, 1, 2]);
      const col = ctx.pick(["#ffffff", "#ffd1f3", "#ff5fd2"]);
      for (const [dx, dy] of bird) {
        s += `<rect x="${f(bx + dx * p * sc + p)}" y="${f(by + dy * p * sc)}" width="${p * sc}" height="${p * sc}" fill="#5ff3ff" opacity=".35"/>`;
        s += `<rect x="${f(bx + dx * p * sc)}" y="${f(by + dy * p * sc)}" width="${p * sc}" height="${p * sc}" fill="${col}"/>`;
      }
    }
    for (let y = h * 0.72; y < h; y += p) for (let x = 0; x < w; x += p) {
      if (ctx.r() > (y - h * 0.72) / (h * 0.28)) continue;
      s += `<rect x="${f(x)}" y="${f(y)}" width="${p}" height="${p}" fill="#12001a"/>`;
    }
    for (let y = 0; y < h; y += 4) s += `<rect y="${y}" width="${w}" height="1.2" fill="#000" opacity=".25"/>`;
    return s;
  },

  ashfall(ctx) {
    const { w, h, m } = ctx;
    let s = bg(ctx, linear(ctx, [[0, "#070302"], [0.5, "#241008"], [1, "#0b0503"]]));
    const cx = w * ctx.rand(0.42, 0.58), aw = m * 0.17, floor = h * 0.82, ay = h * 0.34;
    s += glow(ctx, cx, h * 0.5, m * 0.9, "#ff6a2b", 0.5);
    s += `<path d="M${f(cx - aw)} ${f(floor)} L${f(cx - aw)} ${f(ay)} Q${f(cx)} ${f(ay - aw * 1.3)} ${f(cx + aw)} ${f(ay)} L${f(cx + aw)} ${f(floor)} Z" fill="${linear(ctx, [[0, "#ffd2a8"], [0.5, "#ff8a4a"], [1, "#b8360f"]])}"/>`;
    s += silhouette(cx, floor, m * 0.05, "#1a0703");
    for (const side of [-1, 1]) for (let i = 0; i < 8; i++) {
      const t = i / 8, width = m * (0.07 + t * 0.08), gap = m * 0.02;
      const x = side < 0 ? cx - aw - gap - (i + 1) * (width + gap) : cx + aw + gap + i * (width + gap);
      const top = h * (0.2 - t * 0.2), bottom = floor + h * t * 0.2;
      s += `<rect x="${f(x)}" y="${f(top)}" width="${f(width)}" height="${f(bottom - top)}" fill="#0a0402"/>`;
      for (let k = 1; k < 9; k++) {
        const yy = top + ((bottom - top) * k) / 9;
        s += `<rect x="${f(x)}" y="${f(yy)}" width="${f(width)}" height="${f(m * 0.004)}" fill="#3b1a0c" opacity=".8"/>`;
        let bx = x + width * 0.05;
        while (bx < x + width * 0.9) {
          const bw = width * ctx.rand(0.05, 0.12), bh = ((bottom - top) / 9) * ctx.rand(0.5, 0.85);
          s += `<rect x="${f(bx)}" y="${f(yy - bh)}" width="${f(bw)}" height="${f(bh)}" fill="${ctx.pick(["#2a120a", "#3a1a0e", "#1b0b06", "#4a2412"])}" opacity="${f(0.4 + (1 - t) * 0.5)}"/>`;
          bx += bw * 1.1;
        }
      }
    }
    s += `<rect y="${f(floor)}" width="${w}" height="${f(h - floor)}" fill="${linear(ctx, [[0, "#3a1408"], [1, "#050201"]])}"/>`;
    for (let i = 0; i < 700; i++)
      s += `<circle cx="${f(ctx.rand(0, w))}" cy="${f(ctx.rand(0, h))}" r="${f(m * ctx.rand(0.0008, 0.004))}" fill="${ctx.pick(["#ffd9c2", "#ff9a63", "#9a8a80"])}" opacity="${f(ctx.rand(0.2, 0.85))}"/>`;
    return s;
  },

  glasshouse(ctx) {
    const { w, h, m } = ctx;
    let s = bg(ctx, linear(ctx, [[0, "#02040a"], [0.6, "#04181a"], [1, "#020607"]]));
    s += stars(ctx, 300, h * 0.8, "#dffff0");
    s += glow(ctx, w * 0.85, h * 0.15, m * 0.35, "#8f5bff", 0.45);
    const cx = w / 2, base = h * 0.74, rx = m * 0.42, ry = m * 0.36;
    s += glow(ctx, cx, base - ry * 0.4, rx * 1.4, "#7dffb2", 0.35);
    s += `<path d="M${f(cx - rx)} ${f(base)} A${f(rx)} ${f(ry)} 0 0 1 ${f(cx + rx)} ${f(base)} Z" fill="#7dffb2" opacity=".08"/>`;
    for (let k = 1; k < 8; k++) {
      const r2 = rx * (k / 8);
      s += `<path d="M${f(cx - r2)} ${f(base)} A${f(r2)} ${f(ry)} 0 0 1 ${f(cx + r2)} ${f(base)}" stroke="#b8ffd6" stroke-width="${f(m / 700)}" fill="none" opacity=".35"/>`;
    }
    for (let k = 1; k < 6; k++) {
      const yy = base - ry * (k / 6), half = rx * Math.sqrt(1 - (k / 6) ** 2);
      s += `<line x1="${f(cx - half)}" y1="${f(yy)}" x2="${f(cx + half)}" y2="${f(yy)}" stroke="#b8ffd6" stroke-width="${f(m / 800)}" opacity=".3"/>`;
    }
    for (let i = 0; i < 26; i++) {
      const x = cx + ctx.rand(-rx * 0.8, rx * 0.8), top = base - ctx.rand(0.05, 0.6) * ry;
      s += `<line x1="${f(x)}" y1="${f(base)}" x2="${f(x + ctx.rand(-10, 10))}" y2="${f(top)}" stroke="#0f5132" stroke-width="${f(m * 0.004)}"/><circle cx="${f(x)}" cy="${f(top)}" r="${f(m * ctx.rand(0.008, 0.02))}" fill="${ctx.pick(["#2bd67b", "#7dffb2", "#ff6b6b"])}" opacity=".85"/>`;
    }
    s += `<rect x="${f(cx - rx * 1.3)}" y="${f(base)}" width="${f(rx * 2.6)}" height="${f(h * 0.05)}" fill="#0a1114"/><rect x="${f(cx - rx * 1.3)}" y="${f(base)}" width="${f(rx * 2.6)}" height="${f(m * 0.004)}" fill="#7dffb2" opacity=".7"/>`;
    s += `<rect y="${f(base + h * 0.05)}" width="${w}" height="${h}" fill="#010304"/>`;
    return s;
  },

  ninedoors(ctx, v) {
    const { w, h, m } = ctx;
    const vx = w / 2, vy = h * 0.46;
    let s = bg(ctx, "#050308");
    s += `<path d="M0 ${h} L${f(vx - w * 0.02)} ${f(vy + h * 0.02)} L${f(vx + w * 0.02)} ${f(vy + h * 0.02)} L${w} ${h} Z" fill="${linear(ctx, [[0, "#1a1426"], [1, "#07050c"]])}"/>`;
    s += `<path d="M0 0 L${f(vx - w * 0.02)} ${f(vy - h * 0.02)} L${f(vx + w * 0.02)} ${f(vy - h * 0.02)} L${w} 0 Z" fill="#08060d"/>`;
    const lit = 2 + (v % 5);
    for (let i = 8; i >= 0; i--) {
      const sc = 1 / (1 + i * 0.55), side = i % 2 ? 1 : -1;
      const dw = w * 0.1 * sc, dh = h * 0.42 * sc;
      const x = vx + side * w * 0.38 * sc - (side < 0 ? dw : 0), y = vy + h * 0.5 * sc - dh;
      s += `<rect x="${f(x)}" y="${f(y)}" width="${f(dw)}" height="${f(dh)}" fill="#0e0a16" stroke="#2c2344" stroke-width="${f(m * 0.003 * sc)}"/>`;
      s += `<circle cx="${f(x + (side < 0 ? dw * 0.85 : dw * 0.15))}" cy="${f(y + dh * 0.55)}" r="${f(m * 0.004 * sc)}" fill="#5b4f7a"/>`;
      if (i === lit) {
        s += glow(ctx, x + dw / 2, y + dh, dw * 1.6, "#a78bfa", 0.8);
        s += `<rect x="${f(x)}" y="${f(y + dh - m * 0.004 * sc)}" width="${f(dw)}" height="${f(m * 0.006 * sc)}" fill="#e2d6ff"/>`;
      }
      s += glow(ctx, vx, vy - h * 0.48 * sc + h * 0.02, m * 0.05 * sc, "#fff3d6", 0.35);
    }
    s += glow(ctx, vx, vy, m * 0.25, "#3a2d66", 0.6);
    return s;
  },

  /* ------------------------------ experiences */

  lumen(ctx) {
    const { w, h, m } = ctx;
    let s = bg(ctx, linear(ctx, [[0, "#06040c"], [1, "#0d0818"]]));
    for (let i = 0; i < 26; i++) {
      const y0 = ctx.rand(h * 0.1, h * 0.9), y1 = ctx.rand(h * 0.1, h * 0.9), col = ctx.pick(["#b794ff", "#8f5bff", "#ffffff", "#6d8bff"]);
      const d = `M${f(-w * 0.1)} ${f(y0)} C${f(w * 0.3)} ${f(ctx.rand(0, h))} ${f(w * 0.7)} ${f(ctx.rand(0, h))} ${f(w * 1.1)} ${f(y1)}`;
      s += `<path d="${d}" stroke="${col}" stroke-width="${f(m * 0.03)}" fill="none" opacity=".06"/><path d="${d}" stroke="${col}" stroke-width="${f(m * ctx.rand(0.002, 0.006))}" fill="none" opacity="${f(ctx.rand(0.4, 0.9))}"/>`;
    }
    s += `<rect y="${f(h * 0.78)}" width="${w}" height="${f(h * 0.22)}" fill="${linear(ctx, [[0, "#000", 0], [1, "#000", 0.9]])}"/>`;
    for (let i = 0; i < 7; i++) s += silhouette(ctx.rand(w * 0.05, w * 0.95), h * ctx.rand(0.9, 1.0), m * ctx.rand(0.06, 0.12), "#020104");
    return s;
  },

  tides(ctx) {
    const { w, h, m } = ctx;
    const hz = h * 0.55;
    let s = bg(ctx, linear(ctx, [[0, "#0a0b24"], [0.55, "#4b3a8a"], [0.551, "#0b0d1c"], [1, "#030308"]]));
    s += glow(ctx, w * 0.7, hz, m * 0.6, "#ffb0c8", 0.3);
    for (let i = 0; i < 10; i++) {
      const y = hz + (h - hz) * (i / 10) ** 1.6;
      s += `<line x1="${f(w * 0.2 - i * w * 0.06)}" y1="${f(y)}" x2="${f(w * 0.45 + i * w * 0.02)}" y2="${f(y)}" stroke="#2a2440" stroke-width="${f(m * 0.004 * (1 + i * 0.3))}"/>`;
    }
    const sx = w * 0.62, sy = hz + h * 0.02, sl = m * 0.5;
    const hull = `M${f(sx - sl / 2)} ${f(sy - sl * 0.1)} L${f(sx + sl / 2)} ${f(sy - sl * 0.1)} L${f(sx + sl * 0.38)} ${f(sy + sl * 0.05)} L${f(sx - sl * 0.38)} ${f(sy + sl * 0.05)} Z`;
    s += `<path d="${hull}" stroke="#8fe8ff" stroke-width="${f(m * 0.003)}" fill="#8fe8ff" fill-opacity=".05"/>`;
    for (const k of [-0.2, 0.05, 0.28]) {
      s += `<line x1="${f(sx + sl * k)}" y1="${f(sy - sl * 0.1)}" x2="${f(sx + sl * k)}" y2="${f(sy - sl * 0.62)}" stroke="#8fe8ff" stroke-width="${f(m * 0.003)}" opacity=".8"/>`;
      s += `<path d="M${f(sx + sl * k)} ${f(sy - sl * 0.58)} L${f(sx + sl * (k + 0.16))} ${f(sy - sl * 0.2)} L${f(sx + sl * k)} ${f(sy - sl * 0.2)} Z" stroke="#b794ff" stroke-width="${f(m * 0.002)}" fill="#b794ff" fill-opacity=".08"/>`;
    }
    for (let i = 0; i < 40; i++) s += `<circle cx="${f(sx + ctx.rand(-sl / 2, sl / 2))}" cy="${f(sy + ctx.rand(-sl * 0.6, 0))}" r="${f(m * 0.003)}" fill="#8fe8ff" opacity=".6"/>`;
    return s;
  },

  jam(ctx) {
    const { w, h, m } = ctx;
    let s = bg(ctx, "#050409");
    for (let row = 0; row < 3; row++) for (let i = 0; i < 7; i++) {
      const sw = w * 0.1 * (1 + row * 0.25), x = w * 0.06 + i * w * 0.135 - row * w * 0.02 + ctx.rand(-10, 10), y = h * (0.25 + row * 0.2);
      const col = ctx.pick(["#8f5bff", "#5b8cff", "#ff5fd2", "#5fd3a4"]);
      s += glow(ctx, x + sw / 2, y + sw * 0.3, sw, col, 0.35) + `<rect x="${f(x)}" y="${f(y)}" width="${f(sw)}" height="${f(sw * 0.6)}" rx="${f(sw * 0.03)}" fill="${col}" opacity=".85"/>`;
      s += `<rect x="${f(x + sw * 0.08)}" y="${f(y + sw * 0.1)}" width="${f(sw * ctx.rand(0.3, 0.7))}" height="${f(sw * 0.04)}" fill="#fff" opacity=".6"/>`;
    }
    for (let i = 0; i < 12; i++) s += silhouette(ctx.rand(0, w), h * ctx.rand(0.95, 1.1), m * ctx.rand(0.12, 0.2), "#020104");
    return s;
  },

  fractions(ctx) {
    const { w, h, m } = ctx;
    let s = bg(ctx, linear(ctx, [[0, "#140b30"], [1, "#2b1650"]]));
    for (let i = 0; i < 9; i++) {
      const cx = ctx.rand(0, w), cy = ctx.rand(0, h), r = m * ctx.rand(0.06, 0.16), parts = ctx.pick([3, 4, 5, 8]), filled = Math.ceil(ctx.rand(1, parts - 1));
      for (let k = 0; k < parts; k++) {
        const a0 = (k / parts) * Math.PI * 2, a1 = ((k + 1) / parts) * Math.PI * 2;
        const d = `M${f(cx)} ${f(cy)} L${f(cx + Math.cos(a0) * r)} ${f(cy + Math.sin(a0) * r)} A${f(r)} ${f(r)} 0 0 1 ${f(cx + Math.cos(a1) * r)} ${f(cy + Math.sin(a1) * r)} Z`;
        s += `<path d="${d}" fill="${k < filled ? ctx.pick(["#ffb35c", "#b794ff", "#ff7aa8"]) : "#1c1240"}" stroke="#0c0620" stroke-width="${f(r * 0.04)}"/>`;
      }
    }
    s += ridge(ctx, h * 0.85, h * 0.12, "#0a0520", { jag: 0.4 });
    return s;
  },

  shader(ctx) {
    const { w, h, m } = ctx;
    let s = bg(ctx, "#04030a");
    const p = ctx.rand(0, 6);
    for (let i = 0; i < 60; i++) {
      let d = "";
      for (let k = 0; k <= 60; k++) {
        const x = (w * k) / 60;
        const y = h * (i / 60) + Math.sin(k * 0.18 + i * 0.12 + p) * h * 0.08 + Math.sin(k * 0.05 - i * 0.3) * h * 0.05;
        d += `${k ? "L" : "M"}${f(x)} ${f(y)}`;
      }
      const t = i / 60;
      s += `<path d="${d}" stroke="${t < 0.5 ? "#8f5bff" : "#5ff3ff"}" stroke-width="${f(m * 0.0025)}" fill="none" opacity="${f(0.15 + Math.sin(t * Math.PI) * 0.7)}"/>`;
    }
    return s;
  },

  ink(ctx) {
    const { w, h, m } = ctx;
    let s = bg(ctx, "#0c0b10");
    for (let i = 0; i < 5; i++) {
      const cx = ctx.rand(w * 0.2, w * 0.8), cy = ctx.rand(h * 0.2, h * 0.8), pw = m * 0.55, ph = pw * 0.72, rot = ctx.rand(-18, 18);
      s += `<g transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})"><rect x="${f(cx - pw / 2 + m * 0.01)}" y="${f(cy - ph / 2 + m * 0.015)}" width="${f(pw)}" height="${f(ph)}" fill="#000" opacity=".5"/><rect x="${f(cx - pw / 2)}" y="${f(cy - ph / 2)}" width="${f(pw)}" height="${f(ph)}" fill="#e9e3d4"/>`;
      for (let k = 0; k < 7; k++)
        s += `<path d="${wobble(ctx, cx + ctx.rand(-pw * 0.1, pw * 0.1), cy, pw * (0.06 + k * 0.05), ph * (0.05 + k * 0.05), 0.12)}" stroke="#1b1740" stroke-width="${f(m * 0.0022)}" fill="none" opacity=".75"/>`;
      s += `</g>`;
    }
    s += `<circle cx="${f(w * 0.82)}" cy="${f(h * 0.78)}" r="${f(m * 0.08)}" stroke="#6b3e1e" stroke-width="${f(m * 0.008)}" fill="none" opacity=".35"/>`;
    return s;
  },

  fire(ctx) {
    const { w, h, m } = ctx;
    let s = bg(ctx, linear(ctx, [[0, "#050303"], [1, "#1a0803"]]));
    s += glow(ctx, w * ctx.rand(0.3, 0.7), h * 0.95, m * 0.9, "#ff6a1f", 0.8);
    for (let i = 0; i < 60; i++) s += `<circle cx="${f(ctx.rand(0, w))}" cy="${f(ctx.rand(0, h * 0.8))}" r="${f(m * ctx.rand(0.05, 0.2))}" fill="#6b5f5a" opacity="${f(ctx.rand(0.02, 0.07))}"/>`;
    const x = w * 0.35, y = h, s2 = m * 0.32;
    s += silhouette(x, y, s2, "#070302");
    s += `<rect x="${f(x - s2 * 0.26)}" y="${f(y - s2 * 1.84)}" width="${f(s2 * 0.52)}" height="${f(s2 * 0.18)}" rx="${f(s2 * 0.05)}" fill="#1b1b22"/><rect x="${f(x - s2 * 0.2)}" y="${f(y - s2 * 1.8)}" width="${f(s2 * 0.4)}" height="${f(s2 * 0.03)}" fill="#8f5bff"/>`;
    for (let i = 0; i < 160; i++) s += `<circle cx="${f(ctx.rand(0, w))}" cy="${f(ctx.rand(h * 0.3, h))}" r="${f(m * ctx.rand(0.001, 0.004))}" fill="#ffb070" opacity="${f(ctx.rand(0.3, 1))}"/>`;
    return s;
  },

  choir(ctx) {
    const { w, h, m } = ctx;
    let s = bg(ctx, "#030207");
    const cols = 64, rows = Math.round((cols * h) / w), step = w / cols, p = ctx.rand(0, 6);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const v = Math.sin(x * 0.25 + p + Math.sin(y * 0.22) * 2) * 0.5 + 0.5;
      const amp = Math.abs(y - rows / 2 - Math.sin(x * 0.2 + p) * rows * 0.25) < rows * 0.18 * v ? 1 : 0.15;
      const b = v * amp;
      s += `<circle cx="${f(step * (x + 0.5))}" cy="${f(step * (y + 0.5))}" r="${f(step * (0.12 + b * 0.28))}" fill="${b > 0.7 ? "#f1e9ff" : "#8f5bff"}" opacity="${f(0.15 + b * 0.85)}"/>`;
    }
    s += silhouette(w * 0.5, h * 1.02, m * 0.28, "#010103");
    return s;
  },
};

/* ---------------------------------------------------------------- render */

async function render(file, world, w, h, seedKey, variant = 0) {
  const ctx = new Ctx(w, h, hash(seedKey));
  let body = worlds[world](ctx, variant);
  if (variant >= 2) {
    const scale = 1.25 + variant * 0.08;
    const ox = ctx.rand(0, w * (scale - 1)), oy = ctx.rand(0, h * (scale - 1));
    body = `<g transform="translate(${f(-ox)} ${f(-oy)}) scale(${scale})">${body}</g>`;
  }
  const tail = finish(ctx);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${ctx.defs.join("")}</defs>${body}${tail}</svg>`;
  await mkdir(path.dirname(file), { recursive: true });
  await sharp(Buffer.from(svg)).webp({ quality: 82, effort: 5 }).toFile(file);
}

const games = {
  "the-quiet-cartographer": "cartographer",
  "salt-and-lantern": "salt",
  "kinetic-garden": "kinetic",
  "pale-orbit": "orbit",
  "bit-flock": "bitflock",
  "ashfall-archive": "ashfall",
  "glasshouse-protocol": "glasshouse",
  "nine-doors-down": "ninedoors",
};

const experiences = {
  "lumen-hall": "lumen",
  "museum-of-tides": "tides",
  "global-game-jam-2025": "jam",
  "fractions-with-dragons": "fractions",
  "shader-studies": "shader",
  "inside-the-ink-pipeline": "ink",
  "fire-response-simulator": "fire",
  "pixel-choir": "choir",
};

async function main() {
  const jobs = [];
  for (const [slug, world] of Object.entries(games)) {
    const dir = path.join(OUT, "games", slug);
    jobs.push(render(path.join(dir, "poster.webp"), world, 1000, 1500, `${slug}:poster`, 0));
    jobs.push(render(path.join(dir, "cover.webp"), world, 2400, 1260, `${slug}:cover`, 1));
    for (let i = 1; i <= 4; i++) jobs.push(render(path.join(dir, `shot-${i}.webp`), world, 1920, 1080, `${slug}:shot${i}`, i));
  }
  for (const [slug, world] of Object.entries(experiences)) {
    const dir = path.join(OUT, "experiences", slug);
    jobs.push(render(path.join(dir, "cover.webp"), world, 1600, 1200, `${slug}:cover`, 0));
    for (let i = 1; i <= 3; i++) jobs.push(render(path.join(dir, `image-${i}.webp`), world, 1600, 1000, `${slug}:img${i}`, i));
  }
  // Default Open Graph image
  jobs.push(
    (async () => {
      const w = 1200, h = 630;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><radialGradient id="g" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#8f5bff" stop-opacity=".55"/><stop offset="1" stop-color="#8f5bff" stop-opacity="0"/></radialGradient></defs><rect width="${w}" height="${h}" fill="#050407"/><rect width="${w}" height="${h}" fill="url(#g)"/><rect x="80" y="318" width="1040" height="2" fill="#c9b3ff"/><rect x="540" y="200" width="120" height="120" fill="none" stroke="#ece8f5" stroke-width="10"/><rect x="630" y="200" width="30" height="30" fill="#050407"/><rect x="590" y="250" width="20" height="20" fill="#8f5bff"/><text x="600" y="430" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="64" font-weight="900" letter-spacing="10" fill="#ece8f5">UNSEENBOX</text><text x="600" y="480" text-anchor="middle" font-family="Consolas, monospace" font-size="20" letter-spacing="6" fill="#a99fbf">GAMES · CREATIVE TECHNOLOGY · IMAGINATION</text></svg>`;
      await mkdir(path.join(OUT, "og"), { recursive: true });
      await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(path.join(OUT, "og", "default.png"));
    })(),
  );
  await Promise.all(jobs);
  await writeFile(path.join(OUT, "README.md"), "Generated by scripts/generate-art.mjs — sample artwork, replace freely.\n");
  console.log(`Generated ${jobs.length} images in public/media`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
