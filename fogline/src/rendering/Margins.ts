// What fills the screen around the 1280×720 design area: plain backdrops for menus and
// overlays, and in battle more of the bunker's concrete wall and ceiling.

import Phaser from 'phaser';
import { VIEW } from '../game/config';
import { BLEED, MAX_SCREEN } from '../game/screen';
import { makeCanvas, mulberry32, scratches, speckle } from './CanvasUtil';

/** A flat rectangle over the design area and every margin a screen can show around it. */
export function backdrop(scene: Phaser.Scene, color: number, alpha = 1): Phaser.GameObjects.Rectangle {
  return scene.add.rectangle(-BLEED.x, -BLEED.y, MAX_SCREEN.width, MAX_SCREEN.height, color, alpha).setOrigin(0);
}

/**
 * The same concrete as the window frame, darkening away from the edge that meets it
 * (`dark` runs from that edge outward).
 */
function paintConcrete(w: number, h: number, seed: number, dark: [number, number, number, number], ledge?: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(w, h);
  const rng = mulberry32(seed);
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, '#4b4d48');
  base.addColorStop(1, '#6a6a62');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const density = (w * h) / 1000;
  speckle(ctx, rng, 0, 0, w, h, Math.round(density * 2.2), '#121210', 2.4, 0.1, 0.5);
  speckle(ctx, rng, 0, 0, w, h, Math.round(density * 0.9), '#6a6a62', 1.6, 0.05, 0.25);
  scratches(ctx, rng, 0, 0, w, h, Math.round(density * 0.25), '#0c0c0a', 26, 0.45, true);
  // The window's lit ledge carries on across the wall.
  if (ledge !== undefined) {
    ctx.fillStyle = 'rgba(216,216,200,0.7)';
    ctx.fillRect(0, ledge, w, 2.5);
  }
  const shade = ctx.createLinearGradient(...dark);
  shade.addColorStop(0, 'rgba(0,0,0,0.55)');
  shade.addColorStop(1, 'rgba(0,0,0,0.82)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);
  return canvas;
}

/** Walls left and right of the window and a ceiling above it, seen only on screens of another shape. */
export function addWalls(scene: Phaser.Scene, depth: number): void {
  const { x: bx, y: by } = BLEED;
  const side = 'wall_side', top = 'wall_top';
  if (!scene.textures.exists(side)) scene.textures.addCanvas(side, paintConcrete(bx, MAX_SCREEN.height, 211, [bx, 0, 0, 0], by + 17));
  if (!scene.textures.exists(top)) scene.textures.addCanvas(top, paintConcrete(MAX_SCREEN.width, by, 223, [0, by, 0, 0]));
  scene.add.image(-bx, 0, top).setOrigin(0, 1).setDepth(depth);
  scene.add.image(0, -by, side).setOrigin(1, 0).setDepth(depth);
  scene.add.image(VIEW.width, -by, side).setOrigin(0, 0).setFlipX(true).setDepth(depth);
}
