import { TAU, css, darken, ellipse, polygon, roundRect } from './paint';
/** Storybook cottage painted into a 520 x 300 design space. */
const INK = '#3b2616';
const CX = 280;
const APEX = 56;
const EAVE = 152;
const ROOF_L = 164;
const ROOF_R = 396;
const WALL_L = 176;
const WALL_R = 384;
const STONE_TOP = 258;
const STONE_BOT = 292;
function ink(ctx: CanvasRenderingContext2D, w = 3, color = INK): void {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}
function fillInk(ctx: CanvasRenderingContext2D, fill: string, w = 3, color = INK): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ink(ctx, w, color);
}
/** Soft plumes of smoke, drawn behind the chimney. */
function paintSmoke(ctx: CanvasRenderingContext2D): void {
  const puffs: [number, number, number, number][] = [[352, 36, 7, 0.85], [343, 40, 4.5, 0.6], [360, 34, 3.5, 0.45]];
  for (const [x, y, r, a] of puffs) {
    ctx.fillStyle = `rgba(236,232,224,${a})`;
    ellipse(ctx, x, y, r, r * 0.88);
  }
}
/** Brick chimney on the right slope, mostly hidden behind the roof plane. */
function paintChimney(ctx: CanvasRenderingContext2D): void {
  roundRect(ctx, 336, 52, 26, 70, 3);
  fillInk(ctx, css(0xa35c46), 3);
  ctx.strokeStyle = css(0x3b2616, 0.35);
  ctx.lineWidth = 1.4;
  for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(337, 52 + i * 14); ctx.lineTo(361, 52 + i * 14); ctx.stroke(); }
  roundRect(ctx, 331, 44, 36, 10, 3);
  fillInk(ctx, css(0x6e4533), 3);
}
/** Cream plaster walls with a lit left half and a shaded right half. */
function paintWalls(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(WALL_L, 0, WALL_R, 0);
  g.addColorStop(0, css(0xf7e8c7));
  g.addColorStop(0.47, css(0xf2e0ba));
  g.addColorStop(0.53, css(0xe6cda2));
  g.addColorStop(1, css(0xd3b689));
  ctx.fillStyle = g;
  ctx.fillRect(WALL_L, EAVE, WALL_R - WALL_L, STONE_TOP - EAVE);
  ink(ctx, 3);
  ctx.strokeStyle = css(0xffffff, 0.28);
  ctx.lineWidth = 2;
  const scratches: [number, number, number][] = [[186, 200, 16], [232, 216, 12], [190, 236, 14], [336, 206, 13], [352, 244, 11]];
  for (const [x, y, w] of scratches) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke(); }
}
/** Rubble stone base running under the whole front. */
function paintStoneBase(ctx: CanvasRenderingContext2D): void {
  const l = WALL_L - 5, r = WALL_R + 5;
  ctx.fillStyle = css(0x7d7568);
  ctx.fillRect(l, STONE_TOP, r - l, STONE_BOT - STONE_TOP);
  const cols = [css(0xa79d8d), css(0x9a9082), css(0xb2a897), css(0x8f8679)];
  ctx.save();
  ctx.beginPath();
  ctx.rect(l, STONE_TOP, r - l, STONE_BOT - STONE_TOP);
  ctx.clip();
  for (let row = 0; row < 2; row++) {
    let x = l - (row === 1 ? 12 : 0);
    let i = 0;
    while (x < r) {
      const w = Math.min(18 + ((i * 7) % 12), r - x);
      if (w > 8) {
        roundRect(ctx, x + 1.5, STONE_TOP + row * 17 + 1.5, w - 3, 14, 4);
        fillInk(ctx, cols[(i + row) % 4], 1.6, css(0x3b2616, 0.55));
      }
      x += w;
      i++;
    }
  }
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(l, STONE_TOP, r - l, STONE_BOT - STONE_TOP);
}
/** Dark timber frame: corner posts, a top plate, a main beam and two braces. */
function paintFrame(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = css(0x6b4226);
  for (const px of [WALL_L, WALL_R - 12]) {
    ctx.fillRect(px, EAVE, 12, STONE_TOP - EAVE);
    ink(ctx, 2.5);
  }
  ctx.fillStyle = css(0x7a4f2b);
  ctx.fillRect(WALL_L, 158, WALL_R - WALL_L, 9);
  ink(ctx, 2.5);
  ctx.fillStyle = css(0x6b4226);
  ctx.fillRect(WALL_L, 176, WALL_R - WALL_L, 10);
  ink(ctx, 2.5);
  ctx.strokeStyle = css(0x6b4226);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(WALL_L + 12, 176);
  ctx.lineTo(WALL_L + 40, 162);
  ctx.moveTo(WALL_R - 12, 176);
  ctx.lineTo(WALL_R - 40, 162);
  ctx.stroke();
  ctx.fillStyle = css(0x6b4226);
  ctx.fillRect(WALL_L, 246, 78, 6);
  ink(ctx, 2);
  ctx.fillRect(CX + 26, 246, WALL_R - 12 - (CX + 26), 6);
  ink(ctx, 2);
  ctx.fillStyle = css(0x4e2f18);
  const dots: [number, number][] = [[WALL_L + 6, 181], [WALL_R - 6, 181], [WALL_L + 6, 250], [WALL_R - 6, 250]];
  for (const [x, y] of dots) ellipse(ctx, x, y, 2.2, 2.2);
}
/** Centred arched door with planks, iron straps and a brass knob. */
function paintDoor(ctx: CanvasRenderingContext2D): void {
  const w = 44, r = w / 2;
  const bottom = STONE_TOP, top = bottom - 64;
  ctx.beginPath();
  ctx.moveTo(CX - r, bottom);
  ctx.lineTo(CX - r, top + r);
  ctx.arc(CX, top + r, r, Math.PI, 0);
  ctx.lineTo(CX + r, bottom);
  ctx.closePath();
  const g = ctx.createLinearGradient(CX - r, 0, CX + r, 0);
  g.addColorStop(0, css(0xa9703a));
  g.addColorStop(1, css(0x7d5228));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = css(0x5a3a20, 0.8);
  ctx.lineWidth = 2;
  for (const px of [CX - r + w / 3, CX - r + (2 * w) / 3]) { ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px, bottom); ctx.stroke(); }
  ctx.strokeStyle = css(0x5a3a20, 0.55);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI + (i + 0.5) * (Math.PI / 4);
    ctx.beginPath(); ctx.moveTo(CX, top + r); ctx.lineTo(CX + Math.cos(a) * r, top + r + Math.sin(a) * r); ctx.stroke();
  }
  ctx.fillStyle = css(0x3f3a35);
  ctx.fillRect(CX - r + 1, top + r + 12, w - 2, 5); ctx.fillRect(CX - r + 1, top + r + 30, w - 2, 5);
  ctx.restore();
  ink(ctx, 3);
  ctx.fillStyle = css(0xd9a441);
  ellipse(ctx, CX + r - 11, top + r + 22, 3.4, 3.4);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.stroke();
}
/** Glowing window with mullions, a sill and a flower box resting on it. */
function paintWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(WALL_L, EAVE, WALL_R - WALL_L, STONE_TOP - EAVE);
  ctx.clip();
  ctx.fillStyle = css(0xffc978, 0.16);
  ellipse(ctx, x + w / 2, y + h / 2, w * 1.05, h * 0.95);
  ctx.restore();
  roundRect(ctx, x, y, w, h, 3);
  fillInk(ctx, css(0x6b4226), 3);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, css(0xffe6a8));
  g.addColorStop(1, css(0xf4a64f));
  ctx.fillStyle = g;
  ctx.fillRect(x + 5, y + 5, w - 10, h - 10);
  ctx.strokeStyle = css(0x5a3a20);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + 4);
  ctx.lineTo(x + w / 2, y + h - 4);
  ctx.moveTo(x + 4, y + h / 2);
  ctx.lineTo(x + w - 4, y + h / 2);
  ctx.stroke();
  roundRect(ctx, x - 5, y + h, w + 10, 6, 2);
  fillInk(ctx, css(0x7a4a28), 2.5);
  roundRect(ctx, x + 1, y + h - 15, w - 2, 15, 3);
  fillInk(ctx, css(0xb0603c), 2.5);
  const petals = [0xd9534f, 0xe9a0c0, 0xf0c14b, 0xe07a3c];
  for (let i = 0; i < 4; i++) {
    const fx = x + 9 + i * ((w - 18) / 3);
    const fy = y + h - 17 - (i % 2) * 3;
    ctx.fillStyle = css(0x4f7d3a);
    ellipse(ctx, fx - 5, fy + 4, 5, 3, -0.5); ellipse(ctx, fx + 5, fy + 4, 5, 3, 0.5);
    ctx.fillStyle = css(petals[i % 4]);
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * TAU;
      ellipse(ctx, fx + Math.cos(a) * 3.2, fy + Math.sin(a) * 3.2, 2.6, 2.6);
    }
    ctx.fillStyle = css(0xfbe08a);
    ellipse(ctx, fx, fy, 1.8, 1.8);
  }
}
/** Steep gable roof: scalloped tile courses, lit on the left and shaded on the right. */
function paintRoof(ctx: CanvasRenderingContext2D): void {
  const half = ROOF_R - CX;
  const tri = [{ x: ROOF_L, y: EAVE }, { x: CX, y: APEX }, { x: ROOF_R, y: EAVE }];
  polygon(ctx, tri);
  ctx.fillStyle = css(0x7a3a22);
  ctx.fill();
  ctx.save();
  ctx.clip();
  const step = 13.5;
  for (let k = 1; k <= 8; k++) {
    const topY = APEX + k * step;
    const wAt = 2 * half * ((topY - APEX) / (EAVE - APEX));
    const n = Math.max(1, Math.round(wAt / 26));
    const tw = wAt / n;
    const h = step * 1.35;
    for (let i = 0; i < n; i++) {
      // The course is centred on the roof: it runs from one eave-side edge (CX - wAt / 2) to the other.
      const x0 = CX - wAt / 2 + i * tw + 1.5;
      const x1 = x0 + tw - 3;
      const c = (x0 + x1) / 2;
      const r = (x1 - x0) / 2;
      ctx.beginPath();
      ctx.moveTo(x0, topY);
      ctx.lineTo(c - r, topY);
      ctx.arc(c, topY, r, Math.PI, 0);
      ctx.lineTo(x1, topY + h);
      ctx.lineTo(x0, topY + h);
      ctx.closePath();
      // One tile material across the whole roof; the shade on the right is a single overlay below.
      const col = 0xc4603a;
      ctx.fillStyle = css((i + k) % 2 === 0 ? col : darken(col, 0.07));
      ctx.fill();
      ctx.strokeStyle = css(0x3b2616, 0.45);
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
  }
  ctx.restore();
  // Shaded right slope: the same tiles under a soft dark wash, like the shaded wall.
  polygon(ctx, [{ x: CX, y: APEX }, { x: ROOF_R, y: EAVE }, { x: CX, y: EAVE }]);
  ctx.fillStyle = 'rgba(40,12,4,0.22)';
  ctx.fill();
  polygon(ctx, tri);
  ink(ctx, 6, '#5a3a20');
  polygon(ctx, tri);
  ink(ctx, 2.5, INK);
  polygon(ctx, [{ x: CX - 12, y: APEX + 17 }, { x: CX, y: APEX - 7 }, { x: CX + 12, y: APEX + 17 }, { x: CX, y: APEX + 23 }]);
  fillInk(ctx, css(0x6e4533), 2.5);
  roundRect(ctx, ROOF_L + 1, EAVE - 2, ROOF_R - ROOF_L - 2, 9, 3);
  fillInk(ctx, css(0x6b4226), 3);
  ctx.strokeStyle = css(0x8a5a30);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ROOF_L + 4, EAVE - 1);
  ctx.lineTo(ROOF_R - 4, EAVE - 1);
  ctx.stroke();
}
/** Paints only the cottage: no tree, no yard, no sky, no ground. */
export function paintHouseMiniMax(ctx: CanvasRenderingContext2D): void {
  paintSmoke(ctx);
  paintChimney(ctx);
  paintWalls(ctx);
  paintStoneBase(ctx);
  paintFrame(ctx);
  paintWindow(ctx, 200, 196, 38, 40);
  paintWindow(ctx, 322, 196, 38, 40);
  paintDoor(ctx);
  paintRoof(ctx);
}
