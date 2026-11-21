// Industrial HUD plates: brushed/scuffed gunmetal, rivets, stencil label strips.

import Phaser from 'phaser';
import { VIEW } from '../game/config';
import { makeCanvas, mulberry32, scratches, speckle } from './CanvasUtil';

export const HUD_LAYOUT = {
  top: VIEW.hudTop,
  labelY: VIEW.hudTop + 9,
  slotY: VIEW.hudTop + 20,
  slotH: 100,
  sections: {
    weapons: { x: 12, slotW: 90, count: 4, label: 'WEAPONS' },
    mods: { x: 398, slotW: 62, count: 4, label: 'AMMO MODS' },
    support: { x: 668, slotW: 62, count: 3, label: 'SUPPORT' },
    defense: { x: 874, slotW: 62, count: 2, label: 'BUNKER' },
  },
  gap: 4,
  status: { x: 1014, w: 256 },
} as const;

export function sectionWidth(s: { slotW: number; count: number }): number {
  return s.slotW * s.count + HUD_LAYOUT.gap * (s.count - 1);
}

function rivet(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const g = ctx.createRadialGradient(x - 1, y - 1, 0.5, x, y, 3.2);
  g.addColorStop(0, '#9a9c98');
  g.addColorStop(1, '#2a2b2a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function inset(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = '#121312';
  ctx.fillRect(x, y, w, h);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(0,0,0,0.6)');
  g.addColorStop(0.2, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(60,64,60,0.25)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.strokeStyle = 'rgba(140,144,136,0.22)';
  ctx.beginPath();
  ctx.moveTo(x + 0.5, y + h + 0.5);
  ctx.lineTo(x + w + 0.5, y + h + 0.5);
  ctx.lineTo(x + w + 0.5, y + 0.5);
  ctx.stroke();
}

function paintPanel(): HTMLCanvasElement {
  const W = VIEW.width, H = VIEW.height - VIEW.hudTop;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(404);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3a3c3a');
  g.addColorStop(0.08, '#2c2e2c');
  g.addColorStop(1, '#1a1b1a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // brushed texture + wear
  ctx.globalAlpha = 0.05;
  for (let y = 0; y < H; y += 2) {
    ctx.fillStyle = rng() < 0.5 ? '#fff' : '#000';
    ctx.fillRect(0, y, W, 1);
  }
  ctx.globalAlpha = 1;
  speckle(ctx, rng, 0, 0, W, H, 1600, '#000', 1.6, 0.05, 0.3);
  scratches(ctx, rng, 0, 0, W, H, 220, '#8a8c88', 14, 0.12);
  // rust bleed at the edges
  speckle(ctx, rng, 0, H - 20, W, 20, 300, '#5a3418', 2.4, 0.05, 0.25);
  // top lip
  ctx.fillStyle = '#4a4c48';
  ctx.fillRect(0, 0, W, 3);
  ctx.fillStyle = '#0c0d0c';
  ctx.fillRect(0, 3, W, 2);
  // hazard strip on the top edge (thin)
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 5, W, 3);
  ctx.clip();
  ctx.fillStyle = '#7a6420';
  ctx.fillRect(0, 5, W, 3);
  ctx.fillStyle = '#141414';
  for (let x = 0; x < W; x += 16) ctx.fillRect(x, 5, 8, 3);
  ctx.restore();

  const L = HUD_LAYOUT;
  const y0 = L.slotY - L.top;
  for (const s of Object.values(L.sections)) {
    const w = sectionWidth(s);
    // label plate
    ctx.fillStyle = '#1e1f1e';
    ctx.fillRect(s.x, 9, w, 11);
    ctx.fillStyle = '#9a9a86';
    ctx.font = 'bold 9px Consolas, "Courier New", monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.label, s.x + 4, 15);
    for (let i = 0; i < s.count; i++) inset(ctx, s.x + i * (s.slotW + L.gap), y0, s.slotW, L.slotH);
    // divider
    ctx.fillStyle = '#0b0c0b';
    ctx.fillRect(s.x + w + 6, 8, 2, H - 14);
    ctx.fillStyle = 'rgba(120,124,118,0.25)';
    ctx.fillRect(s.x + w + 8, 8, 1, H - 14);
  }
  // status plate
  const st = L.status;
  inset(ctx, st.x, 9, st.w, H - 16);
  for (const [x, y] of [[4, 12], [W - 6, 12], [4, H - 8], [W - 6, H - 8], [st.x - 4, 12], [st.x - 4, H - 8]]) rivet(ctx, x, y);
  return canvas;
}

export function buildHudTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('hud_panel')) scene.textures.remove('hud_panel');
  scene.textures.addCanvas('hud_panel', paintPanel());
}
