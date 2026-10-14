/**
 * Headless stress test for the custom physics. Run with `npm run test:physics`.
 * Fails loudly on tunnelling, NaNs, energy explosions or bodies that never settle.
 */
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { Layer, RigidBody, type Shape } from '../src/physics/RigidBody';
import { Rng } from '../src/core/Random';
import { MAX_SPEED } from '../src/core/constants';

const W = 1000;
const H = 560;
const T = 40;

function buildWorld(): PhysicsWorld {
  const world = new PhysicsWorld();
  world.setBounds({ x0: 0, y0: 0, x1: W, y1: H }, T);
  const wall = (x: number, y: number, hw: number, hh: number): void => {
    world.add(new RigidBody({ type: 'static', shape: { kind: 'box', hw, hh }, x, y, layer: Layer.Wall, restitution: 0.1 }));
  };
  wall(W / 2, -T / 2, W / 2 + T, T / 2);
  wall(W / 2, H + T / 2, W / 2 + T, T / 2);
  wall(-T / 2, H / 2, T / 2, H / 2 + T);
  wall(W + T / 2, H / 2, T / 2, H / 2 + T);
  return world;
}

function kineticEnergy(world: PhysicsWorld): number {
  let e = 0;
  for (const b of world.bodies) {
    if (b.type !== 'dynamic') continue;
    e += 0.5 * b.mass * (b.vx * b.vx + b.vy * b.vy) + 0.5 * b.inertia * b.w * b.w;
  }
  return e;
}

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
}

for (const hz of [30, 60, 120, 240]) {
  // The game always steps at 120 Hz; other rates here prove the solver itself is not fragile.
  const dt = 1 / hz;
  const world = buildWorld();
  const rng = new Rng(1234);
  const dynamic: RigidBody[] = [];
  for (let i = 0; i < 60; i++) {
    const shape: Shape =
      i % 3 === 0 ? { kind: 'circle', r: rng.range(6, 20) } : { kind: 'box', hw: rng.range(8, 40), hh: rng.range(6, 24) };
    const body = new RigidBody({
      shape,
      x: rng.range(40, W - 40),
      y: rng.range(40, H - 40),
      angle: rng.range(0, 6.28),
      mass: rng.range(0.5, 60),
      restitution: rng.range(0, 0.85),
      groundFriction: rng.range(200, 1400),
    });
    const a = rng.range(0, 6.28);
    const s = rng.range(200, MAX_SPEED);
    body.vx = Math.cos(a) * s;
    body.vy = Math.sin(a) * s;
    body.w = rng.range(-20, 20);
    body.z = rng.range(0, 40);
    world.add(body);
    dynamic.push(body);
  }

  const startEnergy = kineticEnergy(world);
  let peakEnergy = startEnergy;
  let escaped = 0;
  let nan = 0;
  let overSpeed = 0;
  const steps = Math.round(10 * hz);
  for (let i = 0; i < steps; i++) {
    // Keep kicking a few bodies for the first seconds to simulate constant throwing.
    if (i % Math.round(hz / 4) === 0 && i < 4 * hz) {
      const b = rng.pick(dynamic);
      const a = rng.range(0, 6.28);
      b.vx = Math.cos(a) * MAX_SPEED;
      b.vy = Math.sin(a) * MAX_SPEED;
      b.wake();
    }
    world.step(dt);
    peakEnergy = Math.max(peakEnergy, kineticEnergy(world));
    for (const b of dynamic) {
      if (!Number.isFinite(b.x + b.y + b.angle + b.vx + b.vy + b.w)) nan++;
      if (b.x < -1 || b.x > W + 1 || b.y < -1 || b.y > H + 1) escaped++;
      if (Math.hypot(b.vx, b.vy) > MAX_SPEED * 1.6) overSpeed++;
    }
  }

  let stuckInWall = 0;
  for (const b of dynamic) {
    const s = b.shape;
    const inner = s.kind === 'circle' ? s.r : Math.min(s.hw, s.hh);
    if (b.x < inner - 3 || b.x > W - inner + 3 || b.y < inner - 3 || b.y > H - inner + 3) stuckInWall++;
  }
  const asleep = dynamic.filter((b) => b.sleeping).length;

  check(`[${hz}Hz] no NaN`, nan === 0, `${nan}`);
  check(`[${hz}Hz] nothing escaped the room`, escaped === 0, `${escaped} body-steps outside`);
  check(`[${hz}Hz] velocity stays capped`, overSpeed === 0, `${overSpeed}`);
  check(`[${hz}Hz] nothing left sunk in a wall`, stuckInWall === 0, `${stuckInWall}`);
  check(`[${hz}Hz] energy never explodes`, peakEnergy < startEnergy * 3 + 1e8, `peak/start = ${(peakEnergy / startEnergy).toFixed(2)}`);
  check(`[${hz}Hz] everything settles and sleeps`, asleep === dynamic.length, `${asleep}/${dynamic.length} asleep, KE=${kineticEnergy(world).toFixed(1)}`);
}

// Momentum transfer sanity: a heavy body should push a light one, not the other way round.
{
  const world = buildWorld();
  const heavy = new RigidBody({ shape: { kind: 'box', hw: 20, hh: 20 }, x: 300, y: 280, mass: 40 });
  const light = new RigidBody({ shape: { kind: 'circle', r: 8 }, x: 332, y: 280, mass: 1 });
  heavy.vx = 500;
  world.add(heavy);
  world.add(light);
  let maxLight = 0;
  let impulse = 0;
  for (let i = 0; i < 120; i++) {
    world.step(1 / 120);
    maxLight = Math.max(maxLight, light.vx);
    for (let c = 0; c < world.contactCount; c++) impulse = Math.max(impulse, world.contacts[c]!.impulse);
  }
  check('heavy launches light', maxLight > 500 && heavy.vx >= 0, `light peak vx=${maxLight.toFixed(0)}, impulse=${impulse.toFixed(0)}`);
}

// A fast thin body must not tunnel through a wall.
{
  const world = buildWorld();
  const dart = new RigidBody({ shape: { kind: 'box', hw: 10, hh: 3 }, x: W - 200, y: 200, mass: 0.5, restitution: 0.5 });
  dart.vx = MAX_SPEED;
  world.add(dart);
  let maxX = 0;
  for (let i = 0; i < 240; i++) {
    world.step(1 / 120);
    maxX = Math.max(maxX, dart.x);
  }
  check('no tunnelling at max speed', maxX <= W + 0.01 && dart.x < W, `max x=${maxX.toFixed(1)} (wall at ${W})`);
}

console.log(failures === 0 ? '\nAll physics checks passed.' : `\n${failures} physics check(s) FAILED.`);
if (failures > 0) throw new Error('physics smoke test failed');
