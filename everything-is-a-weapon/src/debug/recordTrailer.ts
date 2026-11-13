import { FIXED_DT, WALL } from '../core/constants';
import type { Game } from '../core/Game';
import type { HeroId } from '../core/Hero';

/**
 * Dev only (never imported by the game): films the gameplay for the CrazyGames preview video.
 *
 * A simple player (the balance bot's rules: fetch the nearest thing, aim at the nearest gnome or
 * weak point, hold, let go) plays a few rooms. The game loop is paused and the film is rendered
 * frame by frame (30 per second of game time, hit-stop and slow motion included), so a slow or
 * throttled browser window still gives smooth footage. The canvas has no HUD and no cursor, which
 * is what CrazyGames wants. Each scene is saved into covers/ as a motion-JPEG stream with a .json
 * of knockout and hit times, and scripts/make-trailer.py cuts the busiest seconds of each into
 * the final 1080p videos.
 *
 *   npm run dev, open the game, set the viewport to 1920x1080 (or 1080x1620 for portrait), then:
 *   await (await import('/src/debug/recordTrailer.ts')).recordTrailer('landscape')
 */

export interface TrailerScene {
  name: string;
  /** playFrom index (room number - 1). */
  room: number;
  hero: HeroId;
  /** Seconds of play before the camera rolls (a boss entrance, gnomes walking in). */
  warmup: number;
  seconds: number;
}

export const TRAILER_SCENES: readonly TrailerScene[] = [
  { name: 'crowd', room: 9, hero: 'tenant', warmup: 1.2, seconds: 16 },
  { name: 'kraken', room: 3, hero: 'gran', warmup: 0.4, seconds: 18 },
  { name: 'boom', room: 13, hero: 'kid', warmup: 1.2, seconds: 16 },
  { name: 'gang', room: 15, hero: 'flatmate', warmup: 1.2, seconds: 16 },
];

type Cam = {
  width: number; height: number; roomW: number; roomH: number; scale: number; following: boolean;
  centerX: number; centerY: number; viewX: number; viewY: number; hudMarginTop: number; viewPadding: number;
};


let dir: { cx: number; cy: number; s: number } | null = null;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * The director: no HUD on film, so the whole frame is the room. It frames the hero and the gnome
 * (or tentacle, or head) they are going for, zooming in when they are close and out when they are
 * not, never past the walls, and eases there so the shot never jumps. Portrait starts with the
 * room's height filling the frame.
 */
function frameCamera(game: Game, portrait: boolean, first: boolean): void {
  const cam = game.camera as unknown as Cam;
  cam.hudMarginTop = 0;
  cam.following = false;
  const pad = cam.viewPadding;
  const edge = WALL + pad;
  const fullW = cam.roomW + edge * 2;
  const fullH = cam.roomH + edge * 2;
  const minS = portrait ? cam.height / fullH : Math.min(cam.width / fullW, cam.height / fullH);
  const maxS = minS * (portrait ? 1.15 : 1.75);

  const p = game.player.body;
  let x0 = p.x;
  let x1 = p.x;
  let y0 = p.y;
  let y1 = p.y;
  const e = nearest(game, true);
  if (e && e.d < 720) {
    x0 = Math.min(x0, p.x + e.dx);
    x1 = Math.max(x1, p.x + e.dx);
    y0 = Math.min(y0, p.y + e.dy);
    y1 = Math.max(y1, p.y + e.dy);
  }
  const margin = 190;
  const want = clamp(Math.min(cam.width / (x1 - x0 + margin * 2), cam.height / (y1 - y0 + margin * 2 + 60)), minS, maxS);
  const tx = (x0 + x1) / 2;
  const ty = (y0 + y1) / 2 - 24;
  if (first || !dir) dir = { cx: tx, cy: ty, s: first ? minS : want };
  else {
    dir.s += (want - dir.s) * 0.035;
    dir.cx += (tx - dir.cx) * 0.07;
    dir.cy += (ty - dir.cy) * 0.07;
  }
  const halfW = cam.width / (2 * dir.s);
  const halfH = cam.height / (2 * dir.s);
  dir.cx = halfW * 2 >= fullW ? cam.roomW / 2 : clamp(dir.cx, -edge + halfW, cam.roomW + edge - halfW);
  dir.cy = halfH * 2 >= fullH ? cam.roomH / 2 : clamp(dir.cy, -edge + halfH, cam.roomH + edge - halfH);
  cam.scale = dir.s;
  cam.centerX = dir.cx;
  cam.centerY = dir.cy;
  if (first) {
    cam.viewX = dir.cx;
    cam.viewY = dir.cy;
  }
}

interface BotState { charging: boolean; chargeT: number; dodgeCd: number; }

function nearest(game: Game, parts: boolean): { d: number; dx: number; dy: number } | null {
  const p = game.player.body;
  let best: { d: number; dx: number; dy: number } | null = null;
  for (const e of game.enemies) {
    if (e.defeated || !e.alive) continue;
    const targets = (parts ? e.script?.aimPoints?.(e) : null) ?? [{ x: e.body.x + e.body.vx * 0.2, y: e.body.y + e.body.vy * 0.2 }];
    for (const t of targets) {
      const dx = t.x - p.x;
      const dy = t.y - p.y;
      const d = Math.hypot(dx, dy);
      if (!best || d < best.d) best = { d, dx, dy };
    }
  }
  return best;
}

function botStep(game: Game, st: BotState, dt: number): void {
  const raw = game.input.raw;
  raw.directional = true;
  raw.moveX = raw.moveY = 0;
  const player = game.player;
  if (!player.alive) return;
  // filming, not testing: the hero does not run out of hearts mid-shot
  player.hp = player.maxHp;
  const p = player.body;
  st.dodgeCd -= dt;
  const enemy = nearest(game, true);
  const body = nearest(game, false);
  if (body && body.d < 70 && st.dodgeCd <= 0) {
    raw.dodgePresses++;
    st.dodgeCd = 1.2;
  }
  if (player.held) {
    if (enemy && enemy.d > 1) {
      raw.aimDirX = enemy.dx / enemy.d;
      raw.aimDirY = enemy.dy / enemy.d;
      raw.aimIdle = false;
    }
    if (!st.charging) {
      if (enemy && enemy.d < 620) {
        raw.primaryDown = true;
        raw.primaryPresses++;
        st.charging = true;
        st.chargeT = 0;
      }
    } else {
      st.chargeT += dt;
      raw.primaryDown = true;
      if (st.chargeT >= 0.55) {
        raw.primaryDown = false;
        raw.primaryReleases++;
        st.charging = false;
      }
    }
    if (body && body.d < 150) {
      raw.moveX = -body.dx / body.d;
      raw.moveY = -body.dy / body.d;
    }
    return;
  }
  st.charging = false;
  raw.primaryDown = false;
  let target: Game['objects'][number] | null = null;
  let bestD = Infinity;
  for (const o of game.objects) {
    if (!o.alive || o.held || o.def.fixed || !o.def.throwable || o.def.consume || o.tipProgress >= 0) continue;
    if (o.body.speed() > 120) continue;
    const d = Math.hypot(o.body.x - p.x, o.body.y - p.y);
    if (d < bestD) {
      bestD = d;
      target = o;
    }
  }
  if (!target) {
    if (body && body.d < 200) {
      raw.moveX = -body.dx / body.d;
      raw.moveY = -body.dy / body.d;
    }
    return;
  }
  const dx = target.body.x - p.x;
  const dy = target.body.y - p.y;
  const d = Math.max(1, Math.hypot(dx, dy));
  raw.aimDirX = dx / d;
  raw.aimDirY = dy / d;
  raw.aimIdle = false;
  if (d > 50) {
    raw.moveX = dx / d;
    raw.moveY = dy / d;
  }
  if (d < 80 + target.body.boundR) raw.primaryPresses++;
}

const FPS = 30;

type Internals = { frame(alpha: number, frameDt: number): void; timeScale(): number };

/** One film frame: the bot acts, the simulation advances 1/30 s of (scaled) game time, the canvas is drawn. */
function advance(game: Game, st: BotState, acc: { t: number }, portrait: boolean): void {
  const dt = 1 / FPS;
  const inner = game as unknown as Internals;
  frameCamera(game, portrait, false);
  if (game.state === 'playing') botStep(game, st, dt);
  acc.t += dt * inner.timeScale();
  while (acc.t >= FIXED_DT) {
    game.tick(FIXED_DT);
    acc.t -= FIXED_DT;
  }
  inner.frame(1, dt);
}

function jpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.92));
}

async function upload(blob: Blob, name: string): Promise<string> {
  const res = await fetch(`/__cover/${name}`, { method: 'POST', body: blob });
  return res.text();
}

let log: Array<[number, string]> | null = null;
let clock = 0;
let listening = false;

async function recordScene(game: Game, canvas: HTMLCanvasElement, scene: TrailerScene, tag: string): Promise<string> {
  const portrait = tag === 'portrait';
  game.setHero(scene.hero);
  game.playFrom(scene.room);
  game.loop.stop();
  frameCamera(game, portrait, true);
  const st: BotState = { charging: false, chargeT: 0, dodgeCd: 0 };
  const acc = { t: 0 };
  for (let i = 0; i < scene.warmup * FPS; i++) advance(game, st, acc, portrait);

  const frames: Blob[] = [];
  log = [];
  for (let i = 0; i < scene.seconds * FPS; i++) {
    clock = i / FPS;
    advance(game, st, acc, portrait);
    frames.push(await jpeg(canvas));
  }
  const events = log;
  log = null;
  const raw = game.input.raw;
  raw.moveX = raw.moveY = 0;
  raw.primaryDown = false;
  const base = `trailer-${tag}-${scene.name}`;
  await upload(new Blob([JSON.stringify({ fps: FPS, seconds: scene.seconds, events })], { type: 'application/json' }), `${base}.json`);
  return upload(new Blob(frames, { type: 'video/x-motion-jpeg' }), `${base}.mjpeg`);
}

export async function recordTrailer(tag: 'landscape' | 'portrait', only?: string[]): Promise<string[]> {
  const game = (window as unknown as { __game: Game }).__game;
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  // full quality on film: no stepping down mid-shot
  (game.quality as unknown as { step: number }).step = 99;
  game.particles.quality = 0;
  game.dprCap = 1;
  game.onRenderScale?.();
  if (!listening) {
    listening = true;
    game.bus.onAny((e) => {
      if (!log) return;
      const t = clock;
      if (e.type === 'ENEMY_DEFEATED') log.push([t, 'kill']);
      else if (e.type === 'ENEMY_HIT') log.push([t, 'hit']);
      else if (e.type === 'EXPLOSION') log.push([t, 'boom']);
      else if (e.type === 'CHAIN') log.push([t, 'chain']);
    });
  }
  const out: string[] = [];
  try {
    for (const scene of TRAILER_SCENES) {
      if (only && !only.includes(scene.name)) continue;
      out.push(await recordScene(game, canvas, scene, tag));
    }
  } finally {
    game.toMenu();
    game.loop.start();
  }
  return out;
}
