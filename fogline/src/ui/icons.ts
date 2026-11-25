// Small icons drawn in code, shared by the battle, results, map and Workshop. Each one is drawn
// around the origin of its Graphics object, so callers place it with the object's position.

import Phaser from 'phaser';

export type ObjectiveKind = 'hold' | 'protect' | 'evacuate' | 'nests' | 'boss';

export function drawTick(g: Phaser.GameObjects.Graphics, c: number): void {
  g.lineStyle(4, c, 1).beginPath().moveTo(-9, 0).lineTo(-3, 6).lineTo(9, -7).strokePath();
}

export function drawShield(g: Phaser.GameObjects.Graphics, c: number): void {
  g.fillStyle(c, 1).fillPoints([
    new Phaser.Math.Vector2(-8, -9), new Phaser.Math.Vector2(8, -9), new Phaser.Math.Vector2(8, 0),
    new Phaser.Math.Vector2(0, 9), new Phaser.Math.Vector2(-8, 0),
  ], true);
}

export function drawReticle(g: Phaser.GameObjects.Graphics, c: number): void {
  g.lineStyle(2, c, 1).strokeCircle(0, 0, 8).lineBetween(-13, 0, -5, 0).lineBetween(13, 0, 5, 0)
    .lineBetween(0, -13, 0, -5).lineBetween(0, 13, 0, 5);
}

/** A padlock: a body and a shackle. */
export function drawLock(g: Phaser.GameObjects.Graphics, c: number): void {
  g.lineStyle(2, c, 1).strokeRect(-7, -2, 14, 11).strokeRoundedRect(-4, -8, 8, 8, 4);
}

/** The icon for a mission objective. */
export function drawObjective(g: Phaser.GameObjects.Graphics, kind: ObjectiveKind, c: number): void {
  switch (kind) {
    case 'hold':
      drawShield(g, c);
      return;
    case 'protect': // a mast with an arc of signal
      g.lineStyle(2, c, 1).lineBetween(0, -9, 0, 9).strokeCircle(0, -9, 3).lineBetween(-7, -12, -4, -6).lineBetween(7, -12, 4, -6);
      return;
    case 'evacuate': // a truck: a box, a cab and two wheels
      g.lineStyle(2, c, 1).strokeRect(-10, -6, 12, 9).strokeRect(2, -2, 7, 5).fillStyle(c, 1).fillCircle(-5, 5, 2).fillCircle(5, 5, 2);
      return;
    case 'nests': // a nest: a dome with spikes
      g.lineStyle(2, c, 1).strokeCircle(0, 2, 8).lineBetween(-4, -6, -7, -10).lineBetween(0, -7, 0, -11).lineBetween(4, -6, 7, -10);
      return;
    case 'boss': // a skull: a head and two eyes
      g.lineStyle(2, c, 1).strokeCircle(0, -2, 7).fillStyle(c, 1).fillCircle(-3, -3, 1.6).fillCircle(3, -3, 1.6);
      return;
  }
}
