// @vitest-environment happy-dom
import { beforeEach, it, vi } from 'vitest';
import { FIXED_DT } from '../core/constants';
import { Game } from '../core/Game';
import { newEndlessRun } from '../gameplay/Endless';

const W = 960;
const H = 640;

function stub2d(): CanvasRenderingContext2D {
  // The proxy is fully self-referential (reads of methods return it, calls return it);
  // the explicit annotation breaks the inference cycle for tsc.
  const ctx: CanvasRenderingContext2D = new Proxy(function noop() {}, {
    get(_target, prop) {
      if (prop === 'canvas') return null;
      if (prop === 'measureText') return () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
      if (prop === 'getImageData') return (_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
        colorSpace: 'srgb',
      });
      // Everything else: reads and calls both return the same catch-all object,
      // so gradient chains (createLinearGradient(...).addColorStop(...)) keep working.
      // Anything used in arithmetic converts to 0 (getTransform().a, ctx.canvas.width, ...).
      if (prop === Symbol.toPrimitive) return () => 0;
      if (prop === 'valueOf' || prop === 'toString') return () => 0;
      return ctx;
    },
    apply: () => ctx,
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  return ctx;
}

function fakeCanvas(): HTMLCanvasElement {
  const canvas = {
    width: W,
    height: H,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H, right: W, bottom: H, x: 0, y: 0, toJSON: () => {} }),
    getContext: () => stub2d(),
  };
  return canvas as unknown as HTMLCanvasElement;
}



/**
 * Balance bot. NOT part of the normal test run: `BALANCE=1 npx vitest run src/balance`.
 * It plays rooms with simple touch-style input (walk to the nearest throwable, grab, charge,
 * throw at the nearest intruder, dodge when crowded) and prints how rooms and endless floors
 * fare: clear rate, time and hearts lost. A bot is not a person, but the SHAPE of the curve
 * (spikes, dead zones, a rise that is too steep) is what this is for.
 */
const env = (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const RUN = Boolean(env.BALANCE);
const MODE = env.BALANCE_MODE ?? 'campaign';
const FROM = Number(env.BALANCE_FROM ?? 0);
const TO = Number(env.BALANCE_TO ?? 49);
const SKILL = env.BALANCE_SKILL ?? 'casual';
const CAP = Number(env.BALANCE_CAP ?? 140);

interface Profile { dodge: boolean; kite: boolean; charge: number; }
const PROFILES: Record<string, Profile> = {
  casual: { dodge: false, kite: false, charge: 0.45 },
  decent: { dodge: true, kite: true, charge: 0.4 },
  rusher: { dodge: true, kite: false, charge: 0.3 },
  patient: { dodge: true, kite: true, charge: 0.55 },
};

interface BotState { charging: boolean; chargeT: number; dodgeCd: number; }

function nearestEnemy(game: Game): { d: number; dx: number; dy: number } | null {
  const p = game.player.body;
  let best: { d: number; dx: number; dy: number } | null = null;
  for (const e of game.enemies) {
    if (e.defeated || !e.alive) continue;
    const dx = e.body.x - p.x;
    const dy = e.body.y - p.y;
    const d = Math.hypot(dx, dy);
    if (!best || d < best.d) best = { d, dx, dy };
  }
  return best;
}

function botStep(game: Game, st: BotState, profile: Profile, dt: number): void {
  const raw = game.input.raw;
  raw.directional = true;
  raw.aimIdle = true;
  raw.moveX = raw.moveY = 0;
  const player = game.player;
  if (!player.alive) return;
  const p = player.body;
  st.dodgeCd -= dt;
  const enemy = nearestEnemy(game);
  if (profile.dodge && enemy && enemy.d < 78 && st.dodgeCd <= 0) {
    raw.dodgePresses++;
    st.dodgeCd = 1.1;
  }
  if (player.held) {
    if (!st.charging) {
      if (!enemy || enemy.d < 560) {
        raw.primaryDown = true;
        raw.primaryPresses++;
        st.charging = true;
        st.chargeT = 0;
      }
    } else {
      st.chargeT += dt;
      if (st.chargeT >= profile.charge) {
        raw.primaryDown = false;
        raw.primaryReleases++;
        st.charging = false;
      }
    }
    if (profile.kite && enemy) {
      if (enemy.d < 170) {
        raw.moveX = -enemy.dx / enemy.d;
        raw.moveY = -enemy.dy / enemy.d;
      }
    }
    return;
  }
  st.charging = false;
  raw.primaryDown = false;
  // fetch the nearest throwable
  let target: Game['objects'][number] | null = null;
  let bestD = Infinity;
  for (const o of game.objects) {
    if (!o.alive || o.held || o.def.fixed || !o.def.throwable || o.def.consume || o.tipProgress >= 0) continue;
    const d = Math.hypot(o.body.x - p.x, o.body.y - p.y);
    if (d < bestD) { bestD = d; target = o; }
  }
  if (!target) {
    if (enemy && enemy.d < 200) { raw.moveX = -enemy.dx / enemy.d; raw.moveY = -enemy.dy / enemy.d; }
    return;
  }
  const dx = target.body.x - p.x;
  const dy = target.body.y - p.y;
  const d = Math.max(1, Math.hypot(dx, dy));
  raw.aimDirX = dx / d;
  raw.aimDirY = dy / d;
  raw.aimIdle = false;
  if (d > 60) {
    raw.moveX = dx / d;
    raw.moveY = dy / d;
  }
  if (d < 90 + target.body.boundR) raw.primaryPresses++;
}

interface Result { crew: string; label: string; cleared: boolean; died: boolean; seconds: number; heartsLost: number; enemies: number; hp: number; }

function playRoom(game: Game, label: string, profile: Profile): Result {
  const st: BotState = { charging: false, chargeT: 0, dodgeCd: 0 };
  const startHp = game.player.hp;
  const hits = new Map<string, number>();
  game.bus.on('PLAYER_HIT', (e) => hits.set(String(e.cause), (hits.get(String(e.cause)) ?? 0) + 1));
  const counts = new Map<string, number>();
  for (const spec of game.room.pending) counts.set(spec.type, (counts.get(spec.type) ?? 0) + 1);
  const crewSummary = [...counts].map(([t, n]) => `${n}${t}`).join(',');
  const enemies = game.room.pending.length + game.enemies.length;
  let lowest = game.player.hp;
  const steps = Math.round(CAP / FIXED_DT);
  for (let i = 0; i < steps; i++) {
    botStep(game, st, profile, FIXED_DT);
    game.tick(FIXED_DT);
    if (i % 6 === 0) (game as unknown as { frame(a: number, d: number): void }).frame(1, FIXED_DT * 6);
    lowest = Math.min(lowest, game.player.hp);
    if (game.state === 'cleared' || game.state === 'failed') break;
    if (game.room.cleared && game.room.clearTimer > 5) break;
  }
  const cleared = game.room.cleared || game.state === 'cleared';
  const died = !game.player.alive || game.state === 'failed';
  return {
    crew: crewSummary + ' | hits: ' + [...hits].map(([k, v]) => `${k}x${v}`).join(','), label, cleared: cleared && !died, died, seconds: Math.round(game.room.elapsed),
    heartsLost: Math.round((startHp - lowest) * 10) / 10, enemies, hp: game.player.hp,
  };
}

beforeEach(() => {
  localStorage.clear();
  document.body.className = '';
  document.body.innerHTML = '<div id="hud"></div><div id="screens"></div>';
  window.requestAnimationFrame = (() => 0) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = () => {};
});

function bootGame(): Game {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  game.save.data.tutorial = 'done';
  game.tutorial.skip();
  return game;
}

it.skipIf(!RUN)('balance sweep', { timeout: 3_600_000 }, () => {
  const profile = PROFILES[SKILL]!;
  const rows: Result[] = [];
  for (let n = FROM; n <= TO; n++) {
    const game = bootGame();
    if (MODE === 'campaign') {
      game.playFrom(n);
      if (n === 0) game.tutorial.skip();
    } else {
      game.playEndless();
      const g = game as unknown as { endless: ReturnType<typeof newEndlessRun>; enterEndlessFloor(): void };
      g.endless.floor = n;
      g.enterEndlessFloor();
    }
    const label = MODE === 'campaign' ? `room ${n + 1}` : `floor ${n}`;
    const r = playRoom(game, label, profile);
    rows.push(r);
    console.log(
      `BAL ${MODE} ${SKILL} ${label.padEnd(9)} crew ${String(r.enemies).padStart(2)}  ${r.cleared ? 'CLEAR' : r.died ? 'DIED ' : 'TIMEOUT'}  ${String(r.seconds).padStart(3)}s  hearts lost ${r.heartsLost}  [${r.crew}]`,
    );
  }
  const cleared = rows.filter((r) => r.cleared).length;
  console.log(`BAL SUMMARY ${MODE} ${SKILL}: ${cleared}/${rows.length} cleared`);
});
