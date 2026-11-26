// Attack effects for the sliced monsters. Each is a few drawn shapes that fade out over a
// fraction of a second and then remove themselves, so they cost nothing once they are gone.

import Phaser from 'phaser';

/** Runs `draw` from 0 to 1 over `seconds`, then removes the graphics. */
function timed(scene: Phaser.Scene, depth: number, seconds: number, draw: (g: Phaser.GameObjects.Graphics, k: number) => void): void {
  const g = scene.add.graphics().setDepth(depth);
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: seconds * 1000,
    ease: 'Quad.easeOut',
    onUpdate: (tw) => {
      g.clear();
      draw(g, tw.getValue() ?? 0);
    },
    onComplete: () => g.destroy(),
  });
}

/** The Crimson Brute's fist hits the ground: a dust ring and flecks thrown up. */
export function stompDust(scene: Phaser.Scene, x: number, y: number, s: number, depth: number): void {
  timed(scene, depth, 0.7, (g, k) => {
    g.lineStyle(Math.max(2, 10 * s), 0x8a7d6a, 0.7 * (1 - k));
    g.strokeEllipse(x, y, 260 * s * (0.3 + k), 70 * s * (0.3 + k));
    g.fillStyle(0x6e6456, 0.5 * (1 - k));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      const r = 150 * s * k;
      g.fillCircle(x + Math.cos(a) * r, y - 30 * s * k * (1 - k) * 4 + Math.sin(a) * r * 0.3, Math.max(1.5, 9 * s));
    }
  });
}

/** The Hollow Hound's three claws rake across: three bright slashes at the head. */
export function clawSlash(scene: Phaser.Scene, x: number, y: number, s: number, depth: number): void {
  timed(scene, depth, 0.35, (g, k) => {
    for (let i = 0; i < 3; i++) {
      const ox = (i - 1) * 26 * s;
      g.lineStyle(Math.max(2, 7 * s), 0xf0e6d0, 1 - k);
      g.lineBetween(x + ox - 40 * s, y - 60 * s * k, x + ox + 50 * s, y + 40 * s * k);
    }
  });
}

/** A spit or a belch from the mouth: a green puff that spreads and thins. */
export function spitPuff(scene: Phaser.Scene, x: number, y: number, s: number, depth: number): void {
  timed(scene, depth, 0.5, (g, k) => {
    g.fillStyle(0x9ccf5e, 0.55 * (1 - k));
    g.fillCircle(x, y, (18 + 60 * k) * s);
    g.fillStyle(0xd8f0a0, 0.35 * (1 - k));
    g.fillCircle(x + 14 * s * k, y - 10 * s * k, (8 + 30 * k) * s);
  });
}

/** The Carrion Screamer shrieks: red rings ripple out from its head. */
export function screechRing(scene: Phaser.Scene, x: number, y: number, s: number, depth: number): void {
  timed(scene, depth, 0.9, (g, k) => {
    for (let i = 0; i < 2; i++) {
      const kk = Math.max(0, k - i * 0.25);
      g.lineStyle(Math.max(2, 5 * s), 0xff3a4a, 0.8 * (1 - kk));
      g.strokeEllipse(x, y, 160 * s * (0.2 + kk), 110 * s * (0.2 + kk));
    }
  });
}

/** A wisp of the wraith's smoke trail, drifting up and thinning. */
export function smokeWisp(scene: Phaser.Scene, x: number, y: number, s: number, depth: number): void {
  const dx = (Math.random() - 0.5) * 70 * s;
  timed(scene, depth, 1.1, (g, k) => {
    g.fillStyle(0x2a2a3c, 0.34 * (1 - k));
    g.fillCircle(x + dx + 30 * s * k, y - 110 * s * k, (26 + 54 * k) * s);
  });
}

/** The wraith's claws pass through: a burst of dark smoke with pale edges. */
export function smokeBurst(scene: Phaser.Scene, x: number, y: number, s: number, depth: number): void {
  timed(scene, depth, 0.6, (g, k) => {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const r = (30 + 170 * k) * s;
      g.fillStyle(0x23233a, 0.55 * (1 - k));
      g.fillCircle(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, (34 + 40 * k) * s);
      g.lineStyle(Math.max(1, 3 * s), 0xbfd0ff, 0.5 * (1 - k));
      g.strokeCircle(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, (34 + 40 * k) * s);
    }
  });
}
