import { TAU, css, darken, ellipse, lighten, polygon, roundRect, star } from './paint';

/** Shop skills that can be painted procedurally. */
export type SkillArtKind =
  | 'keen-eye' | 'double-find' | 'quick-crack' | 'master-cut' | 'big-bag' | 'big-hole'
  | 'angry' | 'afterimage' | 'hot-rock' | 'scrap-shot' | 'second-wind' | 'haggler';

const OUTLINE = '#2b1c0e';
const WOOD = 0x7a5330;
const WOOD_DARK = 0x5b3a21;
const STEEL = 0x9aa3ad;
const GOLD = 0xffc83d;
const GOLD_DARK = 0xe0a21b;
const ORANGE = 0xff9d5c;
const RED = 0xe5533d;
const TEAL = 0x35c8d8;
const GREEN = 0x5fcf5c;
const CREAM = 0xfff3dc;
const ROCK_GREY = 0x8d939b;
const ROCK_DARK = 0x4a4f57;

/** Strokes the current path with the shared dark outline. */
function outline(ctx: CanvasRenderingContext2D, width = 3): void {
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Fills the current path with a flat colour. */
function fill(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.fillStyle = color;
  ctx.fill();
}

/** Fills an ellipse shape (the helper adds and fills the path). */
function fillEllipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string): void {
  ctx.fillStyle = color;
  ellipse(ctx, x, y, rx, ry);
}

/** Strokes a circle outline. */
function strokeCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, width = 3): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  outline(ctx, width);
}

/** Paints one shop skill icon onto a cleared 128 x 128 canvas. */
export function paintSkillArt(ctx: CanvasRenderingContext2D, kind: SkillArtKind): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (kind) {
    case 'keen-eye': paintKeenEye(ctx); break;
    case 'double-find': paintDoubleFind(ctx); break;
    case 'quick-crack': paintQuickCrack(ctx); break;
    case 'master-cut': paintMasterCut(ctx); break;
    case 'big-bag': paintBigBag(ctx); break;
    case 'big-hole': paintBigHole(ctx); break;
    case 'angry': paintAngry(ctx); break;
    case 'afterimage': paintAfterimage(ctx); break;
    case 'hot-rock': paintHotRock(ctx); break;
    case 'scrap-shot': paintScrapShot(ctx); break;
    case 'second-wind': paintSecondWind(ctx); break;
    case 'haggler': paintHaggler(ctx); break;
  }
  ctx.restore();
}

/** Magnifying glass with a gold rim held over a small grey rock. */
function paintKeenEye(ctx: CanvasRenderingContext2D): void {
  polygon(ctx, [
    { x: 20, y: 96 },
    { x: 30, y: 76 },
    { x: 48, y: 68 },
    { x: 66, y: 78 },
    { x: 70, y: 98 },
    { x: 52, y: 110 },
    { x: 28, y: 108 },
  ]);
  fill(ctx, css(ROCK_GREY));
  outline(ctx);
  polygon(ctx, [
    { x: 48, y: 84 },
    { x: 66, y: 80 },
    { x: 70, y: 98 },
    { x: 52, y: 110 },
    { x: 44, y: 96 },
  ]);
  fill(ctx, css(darken(ROCK_GREY, 0.18)));

  ctx.save();
  ctx.translate(62, 48);
  ctx.rotate(Math.PI / 4);
  roundRect(ctx, 20, -6, 42, 12, 6);
  fill(ctx, css(WOOD));
  outline(ctx);
  roundRect(ctx, 24, -6, 10, 12, 4);
  fill(ctx, css(darken(WOOD, 0.25)));
  ctx.restore();

  fillEllipse(ctx, 62, 48, 30, 30, '#dff4f8');
  ctx.strokeStyle = css(GOLD);
  ctx.lineWidth = 9;
  ctx.stroke();
  outline(ctx, 3);

  star(ctx, 54, 40, 10, '#ffffff');
}

/** A big grey rock and a smaller brown rock, both sparkling. */
function paintDoubleFind(ctx: CanvasRenderingContext2D): void {
  polygon(ctx, [
    { x: 14, y: 70 },
    { x: 26, y: 42 },
    { x: 50, y: 34 },
    { x: 70, y: 50 },
    { x: 68, y: 78 },
    { x: 44, y: 92 },
    { x: 20, y: 86 },
  ]);
  fill(ctx, css(ROCK_GREY));
  outline(ctx);
  polygon(ctx, [
    { x: 50, y: 56 },
    { x: 70, y: 52 },
    { x: 68, y: 78 },
    { x: 44, y: 92 },
    { x: 40, y: 70 },
  ]);
  fill(ctx, css(darken(ROCK_GREY, 0.18)));

  polygon(ctx, [
    { x: 62, y: 66 },
    { x: 78, y: 50 },
    { x: 100, y: 56 },
    { x: 110, y: 78 },
    { x: 96, y: 98 },
    { x: 74, y: 96 },
    { x: 58, y: 82 },
  ]);
  fill(ctx, css(WOOD));
  outline(ctx);
  polygon(ctx, [
    { x: 88, y: 64 },
    { x: 104, y: 60 },
    { x: 110, y: 78 },
    { x: 96, y: 98 },
    { x: 82, y: 84 },
  ]);
  fill(ctx, css(WOOD_DARK));

  star(ctx, 36, 52, 9, css(GOLD));
  star(ctx, 84, 66, 7, css(GOLD));
}

/** A round grey rock split by a bright zig-zag crack. */
function paintQuickCrack(ctx: CanvasRenderingContext2D): void {
  polygon(ctx, [
    { x: 26, y: 30 },
    { x: 44, y: 20 },
    { x: 62, y: 24 },
    { x: 68, y: 38 },
    { x: 66, y: 44 },
    { x: 84, y: 54 },
    { x: 90, y: 74 },
    { x: 76, y: 96 },
    { x: 54, y: 104 },
    { x: 34, y: 96 },
    { x: 24, y: 74 },
    { x: 20, y: 50 },
  ]);
  fill(ctx, css(ROCK_GREY));
  outline(ctx);
  polygon(ctx, [
    { x: 56, y: 70 },
    { x: 86, y: 60 },
    { x: 90, y: 74 },
    { x: 76, y: 96 },
    { x: 54, y: 104 },
    { x: 50, y: 86 },
  ]);
  fill(ctx, css(darken(ROCK_GREY, 0.2)));

  ctx.beginPath();
  ctx.moveTo(72, 22);
  ctx.lineTo(52, 50);
  ctx.lineTo(70, 56);
  ctx.lineTo(46, 88);
  ctx.lineTo(72, 86);
  ctx.lineTo(60, 106);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 9;
  ctx.stroke();
  ctx.strokeStyle = css(GOLD);
  ctx.lineWidth = 4.5;
  ctx.stroke();

  polygon(ctx, [
    { x: 8, y: 38 },
    { x: 20, y: 34 },
    { x: 22, y: 48 },
    { x: 10, y: 50 },
  ]);
  fill(ctx, css(ROCK_GREY));
  outline(ctx, 2.5);
  polygon(ctx, [
    { x: 104, y: 30 },
    { x: 116, y: 36 },
    { x: 106, y: 44 },
    { x: 98, y: 36 },
  ]);
  fill(ctx, css(ROCK_GREY));
  outline(ctx, 2.5);
  polygon(ctx, [
    { x: 100, y: 96 },
    { x: 112, y: 100 },
    { x: 104, y: 112 },
    { x: 94, y: 106 },
  ]);
  fill(ctx, css(ROCK_GREY));
  outline(ctx, 2.5);
}

/** A faceted teal gem being cut by a toothed steel saw blade. */
function paintMasterCut(ctx: CanvasRenderingContext2D): void {
  polygon(ctx, [
    { x: 82, y: 14 },
    { x: 112, y: 56 },
    { x: 82, y: 108 },
    { x: 52, y: 56 },
  ]);
  fill(ctx, css(TEAL));
  outline(ctx);
  polygon(ctx, [
    { x: 82, y: 14 },
    { x: 112, y: 56 },
    { x: 82, y: 56 },
  ]);
  fill(ctx, css(lighten(TEAL, 0.3)));
  polygon(ctx, [
    { x: 52, y: 56 },
    { x: 82, y: 56 },
    { x: 82, y: 108 },
  ]);
  fill(ctx, css(darken(TEAL, 0.22)));
  polygon(ctx, [
    { x: 82, y: 14 },
    { x: 52, y: 56 },
    { x: 82, y: 56 },
  ]);
  fill(ctx, css(lighten(TEAL, 0.12)));
  polygon(ctx, [
    { x: 88, y: 30 },
    { x: 102, y: 52 },
    { x: 88, y: 52 },
  ]);
  fill(ctx, '#ffffff');

  const teeth: { x: number; y: number }[] = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    const r = i % 2 === 0 ? 20 : 28;
    teeth.push({ x: 38 + Math.cos(a) * r, y: 62 + Math.sin(a) * r });
  }
  polygon(ctx, teeth);
  fill(ctx, css(STEEL));
  outline(ctx);
  fillEllipse(ctx, 38, 62, 19, 19, css(darken(STEEL, 0.22)));
  strokeCircle(ctx, 38, 62, 19, 3);
  fillEllipse(ctx, 38, 62, 5, 5, css(darken(STEEL, 0.45)));
  strokeCircle(ctx, 38, 62, 5, 2);
  ctx.strokeStyle = '#eef1ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(38, 62, 25, -2.5, -0.9);
  ctx.stroke();
}

/** A leather backpack with a rock inside and a green plus badge. */
function paintBigBag(ctx: CanvasRenderingContext2D): void {
  roundRect(ctx, 38, 18, 15, 26, 6);
  fill(ctx, css(WOOD_DARK));
  outline(ctx);
  roundRect(ctx, 72, 18, 15, 26, 6);
  fill(ctx, css(WOOD_DARK));
  outline(ctx);

  polygon(ctx, [
    { x: 46, y: 42 },
    { x: 56, y: 30 },
    { x: 74, y: 28 },
    { x: 86, y: 40 },
    { x: 80, y: 50 },
    { x: 54, y: 50 },
  ]);
  fill(ctx, css(ROCK_GREY));
  outline(ctx);

  roundRect(ctx, 32, 36, 64, 68, 16);
  fill(ctx, css(WOOD));
  outline(ctx);
  roundRect(ctx, 36, 70, 56, 30, 10);
  fill(ctx, css(darken(WOOD, 0.22)));
  outline(ctx);
  roundRect(ctx, 32, 36, 64, 26, 12);
  fill(ctx, css(WOOD_DARK));
  outline(ctx);
  roundRect(ctx, 42, 40, 44, 8, 4);
  fill(ctx, css(lighten(WOOD_DARK, 0.18)));
  roundRect(ctx, 55, 58, 18, 13, 4);
  fill(ctx, css(GOLD));
  outline(ctx, 2.5);
  roundRect(ctx, 60, 62, 8, 5, 2);
  fill(ctx, css(darken(GOLD, 0.35)));

  fillEllipse(ctx, 98, 96, 17, 17, css(GREEN));
  strokeCircle(ctx, 98, 96, 17, 3);
  roundRect(ctx, 93, 86, 10, 20, 3);
  fill(ctx, '#ffffff');
  roundRect(ctx, 88, 91, 20, 10, 3);
  fill(ctx, '#ffffff');
}

/** A wide crater with dirt clods flying and a small burst inside. */
function paintBigHole(ctx: CanvasRenderingContext2D): void {
  const clods: { x: number; y: number; r: number }[] = [
    { x: 24, y: 46, r: 8 },
    { x: 46, y: 26, r: 7 },
    { x: 96, y: 30, r: 8 },
    { x: 110, y: 54, r: 6 },
    { x: 68, y: 14, r: 6 },
  ];
  for (const c of clods) {
    fillEllipse(ctx, c.x, c.y, c.r, c.r * 0.8, css(WOOD));
    strokeCircle(ctx, c.x, c.y, c.r, 2.5);
  }

  fillEllipse(ctx, 64, 84, 54, 28, css(WOOD));
  strokeCircle(ctx, 64, 84, 54, 3);
  fillEllipse(ctx, 64, 84, 39, 17, '#3a2416');
  ctx.strokeStyle = css(lighten(WOOD, 0.25));
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(64, 84, 39, 17, 0, Math.PI, TAU);
  ctx.stroke();
  ctx.strokeStyle = css(darken(WOOD, 0.4));
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(64, 84, 39, 17, 0, 0, Math.PI);
  ctx.stroke();

  star(ctx, 64, 78, 16, css(ORANGE));
  star(ctx, 64, 78, 9, css(GOLD));
  star(ctx, 64, 78, 4, '#fff6d0');
}

/** An angry round face with gritted teeth and steam puffs. */
function paintAngry(ctx: CanvasRenderingContext2D): void {
  const puffs: { x: number; y: number; r: number }[] = [
    { x: 26, y: 48, r: 7 },
    { x: 34, y: 34, r: 5 },
    { x: 18, y: 34, r: 4.5 },
    { x: 102, y: 48, r: 7 },
    { x: 94, y: 34, r: 5 },
    { x: 110, y: 34, r: 4.5 },
  ];
  for (const p of puffs) {
    fillEllipse(ctx, p.x, p.y, p.r, p.r, '#ffffff');
    ctx.strokeStyle = '#cfd8dd';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, TAU);
    ctx.stroke();
  }

  fillEllipse(ctx, 64, 68, 36, 36, '#f4703f');
  fillEllipse(ctx, 64, 86, 28, 13, css(darken(0xf4703f, 0.18)));
  strokeCircle(ctx, 64, 68, 36, 3);

  ctx.strokeStyle = css(WOOD_DARK);
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(38, 46);
  ctx.lineTo(57, 56);
  ctx.moveTo(90, 46);
  ctx.lineTo(71, 56);
  ctx.stroke();

  fillEllipse(ctx, 50, 64, 10, 9, '#ffffff');
  strokeCircle(ctx, 50, 64, 10, 2.5);
  fillEllipse(ctx, 78, 64, 10, 9, '#ffffff');
  strokeCircle(ctx, 78, 64, 10, 2.5);
  fillEllipse(ctx, 52, 66, 3.5, 3.5, '#20242a');
  fillEllipse(ctx, 76, 66, 3.5, 3.5, '#20242a');

  roundRect(ctx, 42, 80, 44, 20, 7);
  fill(ctx, '#7a2a22');
  outline(ctx);
  roundRect(ctx, 46, 83, 36, 14, 4);
  fill(ctx, css(CREAM));
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(55, 84);
  ctx.lineTo(55, 96);
  ctx.moveTo(64, 84);
  ctx.lineTo(64, 96);
  ctx.moveTo(73, 84);
  ctx.lineTo(73, 96);
  ctx.stroke();
}

/** A shovel with two fading motion echoes behind it. */
function paintAfterimage(ctx: CanvasRenderingContext2D): void {
  const shovel = (ox: number, oy: number, alpha: number, blade: string, handle: string, hole: string): void => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(64 + ox, 64 + oy);
    ctx.rotate(Math.PI / 4);
    roundRect(ctx, -4.5, -40, 9, 44, 4);
    fill(ctx, handle);
    outline(ctx);
    fillEllipse(ctx, 0, -46, 10, 12, handle);
    strokeCircle(ctx, 0, -46, 10, 3);
    fillEllipse(ctx, 0, -46, 4.5, 6, hole);
    polygon(ctx, [
      { x: -13, y: 2 },
      { x: 13, y: 2 },
      { x: 15, y: 26 },
      { x: 0, y: 38 },
      { x: -15, y: 26 },
    ]);
    fill(ctx, blade);
    outline(ctx);
    ctx.strokeStyle = '#eef1ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-7, 8);
    ctx.lineTo(-6, 24);
    ctx.stroke();
    ctx.restore();
  };

  shovel(17, -17, 0.25, css(TEAL), css(TEAL), css(darken(TEAL, 0.35)));
  shovel(9, -9, 0.5, css(TEAL), css(TEAL), css(darken(TEAL, 0.35)));
  shovel(0, 0, 1, css(STEEL), css(WOOD), '#3a2a20');
}

/** A dark rock glowing from within, with flames and embers above it. */
function paintHotRock(ctx: CanvasRenderingContext2D): void {
  const flames: { x: number; y: number; s: number }[] = [
    { x: 42, y: 40, s: 13 },
    { x: 64, y: 28, s: 16 },
    { x: 86, y: 40, s: 12 },
  ];
  for (const f of flames) {
    ctx.beginPath();
    ctx.moveTo(f.x, f.y - f.s);
    ctx.quadraticCurveTo(f.x + f.s * 0.75, f.y - f.s * 0.2, f.x + f.s * 0.5, f.y + f.s * 0.5);
    ctx.quadraticCurveTo(f.x, f.y + f.s * 0.8, f.x - f.s * 0.5, f.y + f.s * 0.5);
    ctx.quadraticCurveTo(f.x - f.s * 0.75, f.y - f.s * 0.2, f.x, f.y - f.s);
    ctx.closePath();
    fill(ctx, css(ORANGE));
    outline(ctx, 2.5);
    ctx.beginPath();
    ctx.moveTo(f.x, f.y - f.s * 0.35);
    ctx.quadraticCurveTo(f.x + f.s * 0.35, f.y + f.s * 0.1, f.x, f.y + f.s * 0.5);
    ctx.quadraticCurveTo(f.x - f.s * 0.35, f.y + f.s * 0.1, f.x, f.y - f.s * 0.35);
    ctx.closePath();
    fill(ctx, css(GOLD));
  }
  fillEllipse(ctx, 26, 22, 3.5, 3.5, css(GOLD));
  fillEllipse(ctx, 100, 22, 3, 3, css(ORANGE));
  fillEllipse(ctx, 34, 10, 2.5, 2.5, css(ORANGE));

  polygon(ctx, [
    { x: 26, y: 74 },
    { x: 34, y: 54 },
    { x: 56, y: 44 },
    { x: 82, y: 46 },
    { x: 102, y: 66 },
    { x: 100, y: 92 },
    { x: 76, y: 110 },
    { x: 48, y: 108 },
    { x: 28, y: 92 },
  ]);
  fill(ctx, css(ROCK_DARK));
  outline(ctx);

  const glow = ctx.createRadialGradient(64, 84, 2, 64, 84, 40);
  glow.addColorStop(0, 'rgba(255,246,190,0.95)');
  glow.addColorStop(0.4, 'rgba(255,157,92,0.85)');
  glow.addColorStop(0.75, 'rgba(255,110,60,0.35)');
  glow.addColorStop(1, 'rgba(255,90,50,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(64, 84, 40, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = css(GOLD);
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(50, 58);
  ctx.lineTo(60, 76);
  ctx.lineTo(48, 92);
  ctx.moveTo(78, 56);
  ctx.lineTo(72, 74);
  ctx.lineTo(88, 92);
  ctx.stroke();
  ctx.strokeStyle = '#fff3b0';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  polygon(ctx, [
    { x: 26, y: 74 },
    { x: 34, y: 54 },
    { x: 56, y: 44 },
    { x: 82, y: 46 },
    { x: 102, y: 66 },
    { x: 100, y: 92 },
    { x: 76, y: 110 },
    { x: 48, y: 108 },
    { x: 28, y: 92 },
  ]);
  outline(ctx);
}

/** A shovel blade firing small rock fragments upward. */
function paintScrapShot(ctx: CanvasRenderingContext2D): void {
  polygon(ctx, [
    { x: 36, y: 78 },
    { x: 92, y: 78 },
    { x: 94, y: 106 },
    { x: 64, y: 118 },
    { x: 34, y: 106 },
  ]);
  fill(ctx, css(STEEL));
  outline(ctx);
  polygon(ctx, [
    { x: 44, y: 86 },
    { x: 84, y: 86 },
    { x: 85, y: 102 },
    { x: 64, y: 112 },
    { x: 43, y: 102 },
  ]);
  fill(ctx, css(darken(STEEL, 0.2)));
  ctx.strokeStyle = '#eef1ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(48, 92);
  ctx.lineTo(52, 102);
  ctx.stroke();

  const shards: { x: number; y: number; pts: { x: number; y: number }[] }[] = [
    { x: 36, y: 54, pts: [{ x: 30, y: 48 }, { x: 42, y: 46 }, { x: 40, y: 58 }] },
    { x: 62, y: 36, pts: [{ x: 56, y: 30 }, { x: 68, y: 28 }, { x: 66, y: 42 }] },
    { x: 90, y: 52, pts: [{ x: 84, y: 46 }, { x: 96, y: 48 }, { x: 92, y: 58 }] },
    { x: 50, y: 22, pts: [{ x: 44, y: 16 }, { x: 56, y: 18 }, { x: 52, y: 28 }] },
  ];
  for (const s of shards) {
    ctx.strokeStyle = '#c8d0d8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y + 8);
    ctx.lineTo(s.x + 2, s.y + 20);
    ctx.stroke();
    polygon(ctx, s.pts.map((p) => ({ x: p.x, y: p.y })));
    fill(ctx, css(ROCK_GREY));
    outline(ctx, 2.5);
  }
}

/** Wind swirls and a heart on a soft green disc. */
function paintSecondWind(ctx: CanvasRenderingContext2D): void {
  fillEllipse(ctx, 64, 64, 47, 47, css(lighten(GREEN, 0.55)));
  strokeCircle(ctx, 64, 64, 47, 3);
  fillEllipse(ctx, 64, 64, 40, 40, css(lighten(GREEN, 0.7)));

  ctx.strokeStyle = css(CREAM);
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(54, 88);
  ctx.bezierCurveTo(24, 86, 20, 56, 42, 50);
  ctx.bezierCurveTo(60, 45, 60, 24, 42, 24);
  ctx.moveTo(74, 88);
  ctx.bezierCurveTo(104, 86, 108, 56, 86, 50);
  ctx.bezierCurveTo(68, 45, 68, 24, 86, 24);
  ctx.stroke();
  ctx.strokeStyle = css(darken(CREAM, 0.12));
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(64, 78);
  ctx.bezierCurveTo(42, 62, 50, 46, 64, 58);
  ctx.bezierCurveTo(78, 46, 86, 62, 64, 78);
  ctx.closePath();
  fill(ctx, css(RED));
  outline(ctx, 2.5);
  star(ctx, 58, 60, 4, '#ffffff');
}

/** A stack of gold coins with a green upward arrow and a sparkle. */
function paintHaggler(ctx: CanvasRenderingContext2D): void {
  const coins = [92, 70, 48];
  for (const cy of coins) {
    fillEllipse(ctx, 50, cy + 6, 27, 11, css(GOLD_DARK));
    fillEllipse(ctx, 50, cy, 27, 11, css(GOLD));
    strokeCircle(ctx, 50, cy, 27, 3);
    ctx.strokeStyle = css(GOLD_DARK);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(50, cy, 15, 6, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.strokeStyle = '#fff0b8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(50, 44, 22, 8, 0, Math.PI * 1.1, Math.PI * 1.75);
  ctx.stroke();

  polygon(ctx, [
    { x: 92, y: 78 },
    { x: 104, y: 48 },
    { x: 116, y: 78 },
  ]);
  fill(ctx, css(GREEN));
  outline(ctx);
  roundRect(ctx, 94, 74, 20, 22, 5);
  fill(ctx, css(GREEN));
  outline(ctx);
  ctx.strokeStyle = css(darken(GREEN, 0.3));
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(104, 88);
  ctx.lineTo(104, 62);
  ctx.stroke();

  star(ctx, 28, 30, 9, '#ffffff');
  star(ctx, 84, 24, 5, '#ffffff');
}
