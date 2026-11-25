import { updateHound, drawHound } from './hound.js';

export const FLYER_CFG = {
  maxFlyers: 4,
  maxFlyersCap: 8,
  flyerRamp: 120,
  firstFlyer: 45,
  flyerWaveEvery: 40,
  flyerWaveMin: 24,
  flyerWaveDecay: 0.25,
  flyerBossMax: 2,
  flyerCull: 60,
  waveTypes: ['glider', 'diver', 'bloater', 'hound'],
  glider: {
    hp: 26, radius: 0.5, density: 0.55, restitution: 0.34, linearDamping: 1.5, angularDamping: 2.6,
    cruise: 3.4, accel: 4.2, maxAccel: 9, altitude: 3.4, bob: 0.55, bobRate: 0.85, patrol: 3.6, patrolRate: 0.55,
    flapRate: 7.5, bombEvery: 4, bombHover: 0.45, xpMul: 1, color: '#3fe0d0', glow: '#a8fff4',
  },
  diver: {
    hp: 34, radius: 0.46, density: 0.7, restitution: 0.4, linearDamping: 1.1, angularDamping: 2.2,
    cruise: 4.6, accel: 5, maxAccel: 12, altitude: 4.0, orbit: 6, orbitRate: 0.7, circleMin: 3, circleMax: 5,
    telegraph: 0.7, diveSpeed: 13, diveTime: 1.25, recover: 1.3, stun: 1, contactDamage: 9, contactRadius: 1.05,
    flapRate: 10, xpMul: 1.5, color: '#ff5a3c', glow: '#ffd36b',
  },
  bloater: {
    hp: 92, radius: 0.8, density: 0.5, restitution: 0.3, linearDamping: 1.8, angularDamping: 3,
    cruise: 1.6, accel: 2.3, maxAccel: 5, altitude: 3.1, bob: 0.5, bobRate: 1.1, drift: 3.2, driftRate: 0.3,
    flapRate: 3.2, sacCount: 3, sacSeg: 0.26, popRadius: 3.4, popDamage: 14, popImpulse: 9, xpMul: 3,
    grabEnabled: true, grabRange: 8, grabReach: 1.6, seekSpeed: 4, liftSpeed: 2.4, dropHeight: 8, grabCooldown: 12, dropDamage: 22, breakDamage: 30,
    allyMax: 2, allyPickRange: 7, allyPickDepth: 9, allyCooldown: 3, keepDist: 10, keepMin: 8.5, keepMax: 11.5, droneAlt: 5.5,
    allyHangX: 1.2, allyHangY: 1.4, allyFireMul: 1, allyLoseTime: 2,
    color: '#b56bff', glow: '#ff9ee8',
  },
  hound: {
    hp: 22, radius: 0.4, density: 0.8, restitution: 0.1, friction: 0.6, linearDamping: 0.4, angularDamping: 4,
    runSpeed: 6, accel: 14, leapRange: 3.5, leapSpeed: 7.5, leapUp: 5, leapCooldown: 1.6,
    biteDamage: 6, biteCooldown: 0.9, biteRange: 0.7, shove: 2, backOff: 0.5, separation: 0.5,
    flapRate: 14, xpMul: 1.2, altitude: 0.5, spawnHeight: 0.5, gravity: 1,
    color: '#b7d84a', glow: '#f3ff9a',
  },
  deathTime: 1,
  hurtTime: 0.16,
  ctrlMin: 0.4,
  ctrlMax: 0.7,
};

export const FLYER_BOMB_SHOT = {
  look: 'bomb', radius: 0.14, mass: 0.5, restitution: 0.2, drag: 0.04, damageMul: 0.5, splatMul: 1.2,
  puddleMul: 1, puddleLifeMul: 1, bounces: 0, dripTime: 0, dripDps: 0, splitCount: 0, lift: 0, liftTime: 0,
  homing: 0, boomerang: 0, pierce: false, fuse: 0, well: null, glue: 0, color: '#75ffd8',
  explode: { radius: 1.5, impulse: 8, damage: 8, clusterCount: 0, clusterShot: null },
};

const clamp2 = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export class FlyerSystem {
  constructor(physics, hooks = {}) {
    this.physics = physics;
    this.hooks = hooks;
    this.items = hooks.items || [];
    this.pool = [];
    this.cfg = hooks.cfg || FLYER_CFG;
    this.rng = hooks.rng || (() => 0.5);
    this.Vec2 = hooks.Vec2;
    this.CircleShape = hooks.CircleShape;
    this._force = { x: 0, y: 0 };
    this._impulse = { x: 0, y: 0 };
    this.stats = { spawned: 0, killed: 0, bombed: 0, popped: 0, playerHits: 0 };
  }

  get length() {
    return this.items.length;
  }

  countAlive() {
    let n = 0;
    for (let i = 0; i < this.items.length; i++) if (this.items[i].alive) n++;
    return n;
  }

  headPositionOf(f) {
    return f.position();
  }

  spawn(type, x, y, opts = {}) {
    const def = this.cfg[type] || this.cfg.glider;
    if (!this.Vec2 || !this.CircleShape || !this.physics || !this.physics.world) return null;
    let f = this.pool.pop();
    if (!f) {
      f = {
        type: 'glider', body: null, def: null, mass: 1, radius: 0.5, hp: 1, maxHp: 1, alive: false, removed: false,
        age: 0, phase: 0, flap: 0, flash: 0, ctrl: 0, state: '', stateTime: 0, cooldown: 0, bombTimer: 0,
        aimX: 0, aimY: 0, aimDirX: 0, aimDirY: -1, eyeX: 0, eyeY: 0, orbit: 0, groundY: 0, shadow: 1,
        bank: 0, spin: 0, didHit: false, xpAwarded: false, tumble: 0, bob: 0, hover: 0,
        sacs: [], _v: { x: 0, y: 0 }, team: 'enemy',
      };
      f.headPosition = function () { return this.body.getPosition(); };
      f.position = function () { return this.body.getPosition(); };
      for (let i = 0; i < 3; i++) f.sacs.push({ x: 0, y: 0, px: 0, py: 0 });
      const body = this.physics.world.createBody({
        type: 'dynamic',
        position: new this.Vec2(x, y),
        linearDamping: 1.5,
        angularDamping: 2.6,
        gravityScale: 0,
        bullet: false,
      });
      f.body = body;
      f.ud = { kind: 'flyer', flyer: f };
    }
    f.type = this.cfg[type] ? type : 'glider';
    f.def = this.cfg[f.type];
    f.radius = f.def.radius;
    f.hp = f.maxHp = f.def.hp + (opts.hpBonus || 0);
    f.alive = true;
    f.removed = false;
    f.age = 0;
    f.phase = this.rng() * Math.PI * 2;
    f.flap = 0;
    f.flash = 0;
    f.ctrl = 0;
    f.state = f.type === 'diver' ? 'circle' : 'fly';
    f.stateTime = 0;
    f.cooldown = f.type === 'diver' ? f.def.circleMin + this.rng() * (f.def.circleMax - f.def.circleMin) : 0;
    f.bombTimer = f.type === 'glider' ? f.def.bombEvery * (0.6 + 0.4 * this.rng()) : 0;
    f.aimX = x;
    f.aimY = y - 1;
    f.aimDirX = 0;
    f.aimDirY = -1;
    f.eyeX = 0;
    f.eyeY = 0;
    f.orbit = this.rng() * Math.PI * 2;
    f.groundY = y - f.def.altitude;
    f.shadow = 0;
    f.bank = 0;
    f.spin = 0;
    f.didHit = false;
    f.xpAwarded = false;
    f.tumble = 0;
    f.bob = 0;
    f.hover = 0;
    const b = f.body;
    if (f.fixture) b.destroyFixture(f.fixture);
    f.fixture = b.createFixture(new this.CircleShape(new this.Vec2(0, 0), f.radius), {
      density: f.def.density, friction: f.def.friction ?? 0.45, restitution: f.def.restitution, userData: f.ud,
    });
    b.resetMassData();
    b.setActive(true);
    b.setGravityScale(f.def.gravity ?? 0);
    b.setLinearDamping(f.def.linearDamping);
    b.setAngularDamping(f.def.angularDamping);
    b.setTransform(new this.Vec2(x, y), 0);
    b.setLinearVelocity({ x: opts.vx || 0, y: opts.vy || 0 });
    b.setAngularVelocity(0);
    f.mass = b.getMass();
    if (f.type === 'bloater') {
      for (let i = 0; i < f.sacs.length; i++) {
        const s = f.sacs[i];
        const a = (i / f.sacs.length) * Math.PI * 2;
        s.x = s.px = x + Math.cos(a) * f.radius;
        s.y = s.py = y - f.radius * 0.5 + Math.sin(a) * f.radius;
      }
      f.grabCooldown = 0;
      f.carryStartHp = f.hp;
      f.allies = [];
      f.allyCooldown = 0;
      f.allyLoseTimer = 0;
      f.allyTarget = null;
    }
    this.items.push(f);
    this.stats.spawned++;
    this.emit('spawn', f);
    return f;
  }

  emit(name, a, b, c) {
    const fn = this.hooks['on' + name.charAt(0).toUpperCase() + name.slice(1)];
    if (fn) fn(a, b, c);
  }

  positionOf(f) {
    return f.body.getPosition();
  }

  headPosition(f) {
    return f.body.getPosition();
  }

  steer(f, tx, ty, speed, accel, maxAccel) {
    const p = f.body.getPosition();
    const v = f.body.getLinearVelocity();
    let dx = tx - p.x;
    let dy = ty - p.y;
    const d = Math.hypot(dx, dy);
    let wantX, wantY;
    if (d < 0.001) {
      wantX = -v.x;
      wantY = -v.y;
    } else {
      const ramp = Math.min(1, d / 2.2);
      wantX = (dx / d) * speed * ramp;
      wantY = (dy / d) * speed * ramp;
    }
    let fx = (wantX - v.x) * accel;
    let fy = (wantY - v.y) * accel;
    const fm = Math.hypot(fx, fy);
    if (fm > maxAccel) {
      fx = (fx / fm) * maxAccel;
      fy = (fy / fm) * maxAccel;
    }
    this._force.x = fx * f.mass;
    this._force.y = fy * f.mass;
    f.body.applyForceToCenter(this._force, true);
  }

  hover(f, ty, strength) {
    const p = f.body.getPosition();
    const v = f.body.getLinearVelocity();
    this._force.x = -v.x * strength * f.mass;
    this._force.y = clamp2((ty - p.y) * 4 - v.y * 2.5, -strength, strength) * f.mass;
    f.body.applyForceToCenter(this._force, true);
  }

  safety(f, groundY, minAbove) {
    const p = f.body.getPosition();
    const v = f.body.getLinearVelocity();
    const floor = groundY + minAbove;
    if (p.y < floor + 0.7) {
      const lift = clamp2((floor + 0.7 - p.y) * 34 - v.y * 6, 0, 46);
      this._force.x = 0;
      this._force.y = lift * f.mass;
      f.body.applyForceToCenter(this._force, true);
    }
    const sp = Math.hypot(v.x, v.y);
    if (sp > 17) {
      this._force.x = -(v.x / sp) * (sp - 17) * 4 * f.mass;
      this._force.y = -(v.y / sp) * (sp - 17) * 4 * f.mass;
      f.body.applyForceToCenter(this._force, true);
    }
  }

  bankTo(f, target, rate, dt) {
    const a = f.body.getAngle();
    let diff = target - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    f.body.applyAngularImpulse(clamp2(diff * rate - f.body.getAngularVelocity() * 1.4, -3, 3) * f.mass * 0.06, true);
    f.bank = a;
  }

  update(dt, ctx = {}) {
    if (!(dt > 0)) return;
    this.ctx = ctx;
    const player = ctx.player;
    const arena = ctx.arena;
    const px = player && player.torsoPosition ? player.torsoPosition().x : 0;
    const py = player && player.torsoPosition ? player.torsoPosition().y : 0;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const f = this.items[i];
      if (f.removed) {
        this.items.splice(i, 1);
        continue;
      }
      if (f.xpAwarded && !f.alive && f.tumble <= 0) {
        this.items.splice(i, 1);
        continue;
      }
      f.age += dt;
      f.flash = Math.max(0, f.flash - dt);
      f.ctrl = Math.max(0, f.ctrl - dt);
      f.phase += dt * f.def.flapRate;
      const p = f.body.getPosition();
      const groundY = arena && arena.surfaceY ? arena.surfaceY(p.x) : 0;
      f.groundY = groundY;
      f.shadow = clamp2(1 - (p.y - groundY) / 12, 0.12, 1);
      if (!f.alive) {
        f.tumble -= dt;
        f.spin += dt * 7;
        if (f.tumble <= 0 && !f.xpAwarded) this.burst(f);
        continue;
      }
      if (player && player.torsoPosition) {
        const t = player.torsoPosition();
        const dx = t.x - p.x;
        const dy = t.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        f.eyeX = dx / d;
        f.eyeY = dy / d;
      }
      const loose = f.ctrl > 0;
      if (loose) {
        if (f.type === 'bloater' && f.state === 'carry') this.releasePlayer(f, player, groundY, f.def);
        f.body.applyAngularImpulse((this.rng() - 0.5) * f.mass * 0.5 * dt * 12, true);
        this.safety(f, groundY, f.radius + 1.2);
      } else if (f.type === 'glider') {
        this.updateGlider(f, dt, px, groundY);
      } else if (f.type === 'diver') {
        this.updateDiver(f, dt, px, py, groundY, player);
      } else if (f.type === 'hound') {
        updateHound(this, f, dt, ctx);
      } else {
        this.updateBloater(f, dt, px, groundY, ctx);
      }
      if (f.hover > 0) f.hover -= dt;
      if (this.cfg.flyerCull && Math.abs(p.x - px) > this.cfg.flyerCull) this.despawn(f);
    }
  }

  updateGlider(f, dt, px, groundY) {
    const cfg = f.def;
    const p = f.body.getPosition();
    const v = f.body.getLinearVelocity();
    f.bob += dt;
    const targetX = px + Math.sin(f.age * cfg.patrolRate + f.orbit) * cfg.patrol;
    const targetY = groundY + cfg.altitude + Math.sin(f.bob * cfg.bobRate + f.phase) * cfg.bob;
    if (f.hover > 0) this.hover(f, targetY, 3.6);
    else this.steer(f, targetX, targetY, cfg.cruise, cfg.accel, cfg.maxAccel);
    this.safety(f, groundY, f.radius + 1.4);
    this.bankTo(f, clamp2(-v.x * 0.09, -0.42, 0.42), 9, dt);
    f.bombTimer -= dt;
    if (f.bombTimer <= 0) {
      f.bombTimer = cfg.bombEvery;
      f.hover = cfg.bombHover;
      this.stats.bombed++;
      this.emit('bomb', { x: p.x, y: p.y - f.radius }, { x: v.x * 0.35, y: -1.5 }, f);
      const fx = this.hooks.effects;
      if (fx && fx.burst) fx.burst(p.x, p.y - f.radius, cfg.glow, 5, 1.4, 0, -1);
      this.sfx('flyerBomb');
    }
  }

  updateDiver(f, dt, px, py, groundY, player) {
    const cfg = f.def;
    const p = f.body.getPosition();
    const v = f.body.getLinearVelocity();
    f.stateTime += dt;
    f.cooldown = Math.max(0, f.cooldown - dt);
    if (f.state === 'circle') {
      f.orbit += dt * cfg.orbitRate;
      const tx = px + Math.cos(f.orbit) * cfg.orbit;
      const ty = groundY + cfg.altitude + Math.sin(f.orbit * 1.7) * 0.6;
      this.steer(f, tx, ty, cfg.cruise, cfg.accel, cfg.maxAccel);
      this.bankTo(f, clamp2(-v.x * 0.11, -0.5, 0.5), 10, dt);
      if (f.cooldown <= 0) {
        f.state = 'telegraph';
        f.stateTime = 0;
        f.aimX = px;
        f.aimY = py;
        this.sfx('telegraph');
      }
    } else if (f.state === 'telegraph') {
      this.hover(f, groundY + cfg.altitude, 2.6);
      if (f.stateTime >= cfg.telegraph) {
        const dx = f.aimX - p.x;
        const dy = f.aimY - p.y;
        const d = Math.hypot(dx, dy) || 1;
        f.aimDirX = dx / d;
        f.aimDirY = dy / d;
        f.state = 'dive';
        f.stateTime = 0;
        f.didHit = false;
        const speed = cfg.diveSpeed;
        this._impulse.x = (f.aimDirX * speed - v.x) * f.mass;
        this._impulse.y = (f.aimDirY * speed - v.y) * f.mass;
        f.body.applyLinearImpulse(this._impulse, f.body.getWorldCenter(), true);
        this.sfx('flyerDive');
      }
    } else if (f.state === 'dive') {
      const tx = f.aimX;
      const ty = f.aimY;
      this.steer(f, tx, ty, cfg.diveSpeed, 1.6, 4);
      this.bankTo(f, Math.atan2(f.aimDirY, f.aimDirX) * 0.18, 6, dt);
      if (!f.didHit && player && player.alive) {
        const dx = px - p.x;
        const dy = py - p.y;
        if (dx * dx + dy * dy < (cfg.contactRadius + f.radius) * (cfg.contactRadius + f.radius)) {
          f.didHit = true;
          this.stats.playerHits++;
          this.emit('playerHit', { x: p.x, y: p.y }, cfg.contactDamage, f);
          const fx = this.hooks.effects;
          if (fx && fx.splatter) fx.splatter(p.x, p.y, cfg.color, 8, 3);
          this.sfx('hurtPlayer');
          this.enterRecover(f, cfg);
        }
      }
      if (f.state === 'dive' && p.y <= groundY + f.radius + 0.18) this.enterStun(f, groundY);
      else if (f.state === 'dive' && (f.stateTime > cfg.diveTime || (dx2(p, f.aimX, f.aimY) < 0.6 && f.stateTime > 0.35))) this.enterRecover(f, cfg);
    } else if (f.state === 'stun') {
      f.body.setAngularVelocity(5.5 * (f.spin >= 0 ? 1 : -1));
      if (f.stateTime >= cfg.stun) {
        f.body.setGravityScale(0);
        this.enterRecover(f, cfg);
      }
    } else {
      const ty = groundY + cfg.altitude;
      this.steer(f, px, ty, cfg.cruise, cfg.accel, cfg.maxAccel);
      this.safety(f, groundY, f.radius + 1.2);
      if (f.stateTime >= cfg.recover) {
        f.state = 'circle';
        f.stateTime = 0;
        f.cooldown = cfg.circleMin + this.rng() * (cfg.circleMax - cfg.circleMin);
      }
    }
  }

  enterRecover(f, cfg) {
    f.state = 'recover';
    f.stateTime = 0;
    f.body.setGravityScale(0);
    this.sfx('squish');
  }

  enterStun(f, groundY) {
    f.state = 'stun';
    f.stateTime = 0;
    f.body.setGravityScale(1);
    f.spin = 1;
    this.sfx('impactHard');
    const fx = this.hooks.effects;
    if (fx && fx.burst) fx.burst(f.body.getPosition().x, groundY + 0.1, '#ffd36b', 7, 2.6, 0, 1);
  }

  updateBloater(f, dt, px, groundY, ctx) {
    const cfg = f.def;
    const p = f.body.getPosition();
    const v = f.body.getLinearVelocity();
    const player = ctx && ctx.player;
    const enemies = ctx && ctx.enemies;
    if (!f.allies) f.allies = [];
    if (f.allyCooldown > 0) f.allyCooldown = Math.max(0, f.allyCooldown - dt);

    if (f.grabCooldown > 0) f.grabCooldown = Math.max(0, f.grabCooldown - dt);

    this.updateHeldAllies(f, dt, p, groundY, ctx);

    if (f.state === 'fly') {
      let seeking = false;
      if (player && player.alive && !ctx.interior && f.allies.length === 0) {
        const t = player.torsoPosition();
        const horizDist = Math.abs(t.x - p.x);
        if (cfg.grabEnabled && horizDist <= cfg.grabRange && f.grabCooldown <= 0) {
          f.state = 'seek';
          f.stateTime = 0;
          seeking = true;
        }
      }
      if (!seeking) {
        const target = this.findAllyTarget(f, p, enemies, cfg);
        if (target && f.allies.length < cfg.allyMax && f.allyCooldown <= 0) {
          f.state = 'pickup';
          f.stateTime = 0;
          f.allyTarget = target;
          f.allyLoseTimer = 0;
        } else if (f.allies.length > 0) {
          f.state = 'drone';
          f.stateTime = 0;
        } else {
          this.steer(f, px + Math.sin(f.age * cfg.driftRate + f.orbit) * cfg.drift, groundY + cfg.altitude + Math.sin(f.age * cfg.bobRate) * cfg.bob, cfg.cruise, cfg.accel, cfg.maxAccel);
        }
      }
    } else if (f.state === 'pickup') {
      f.stateTime += dt;
      const target = f.allyTarget;
      const valid = target && target.alive && !target.carriedBy && !target.recovering;
      if (!valid) {
        f.state = f.allies.length > 0 ? 'drone' : 'fly';
        f.allyTarget = null;
      } else {
        const t = target.torsoPosition();
        const dx = t.x - p.x;
        const dy = t.y - p.y;
        const dist = Math.hypot(dx, dy);
        const outOfRange = Math.abs(dx) > cfg.allyPickRange || Math.abs(dy) > cfg.allyPickDepth;
        f.allyLoseTimer = outOfRange ? (f.allyLoseTimer || 0) + dt : 0;
        this.steer(f, t.x, t.y - 0.4, cfg.seekSpeed, cfg.accel * 2, cfg.maxAccel * 2);
        if (dist <= cfg.grabReach) {
          f.allies.push(target);
          target.carriedBy = f;
          f.allyTarget = null;
          f.allyCooldown = cfg.allyCooldown;
          f.state = 'drone';
          f.stateTime = 0;
        } else if (f.allyLoseTimer >= (cfg.allyLoseTime || 2)) {
          f.state = f.allies.length > 0 ? 'drone' : 'fly';
          f.allyTarget = null;
        }
      }
    } else if (f.state === 'drone') {
      f.stateTime += dt;
      if (f.allies.length === 0) {
        f.state = 'fly';
        f.stateTime = 0;
      } else {
        const target = this.findAllyTarget(f, p, enemies, cfg);
        if (target && f.allies.length < cfg.allyMax && f.allyCooldown <= 0) {
          f.state = 'pickup';
          f.stateTime = 0;
          f.allyTarget = target;
          f.allyLoseTimer = 0;
        } else {
          let targetX = p.x;
          if (player && player.alive) {
            const pt = player.torsoPosition();
            const side = p.x - pt.x >= 0 ? 1 : -1;
            targetX = pt.x + side * cfg.keepDist;
          }
          this.steer(f, targetX, groundY + cfg.droneAlt + Math.sin(f.age * cfg.bobRate) * cfg.bob, cfg.seekSpeed, cfg.accel * 2, cfg.maxAccel * 2);
        }
      }
    } else if (f.state === 'seek') {
      f.stateTime += dt;
      if (!player || !player.alive || ctx.interior) {
        f.state = 'fly';
        f.grabCooldown = cfg.grabCooldown;
      } else {
        const t = player.torsoPosition();
        const dx = t.x - p.x;
        const dy = t.y - p.y;
        const dist = Math.hypot(dx, dy);
        const targetX = t.x;
        const targetY = t.y - 0.5;
        this.steer(f, targetX, targetY, cfg.seekSpeed, cfg.accel * 2, cfg.maxAccel * 2);
        if (dist <= cfg.grabReach) {
          f.state = 'carry';
          f.stateTime = 0;
          f.carryStartHp = f.hp;
          f.carriedPlayer = player;
          player.carriedBy = f;
          player.dropFall = false;
        }
      }
    } else if (f.state === 'carry') {
      f.stateTime += dt;
      if (!player || !player.alive || ctx.interior) {
        this.releasePlayer(f, player, groundY, cfg);
      } else {
        const hpLost = f.carryStartHp - f.hp;
        const hpLostPct = f.maxHp > 0 ? (hpLost / f.maxHp) * 100 : 0;
        if (!f.alive || f.ctrl > 0.5 || hpLostPct >= cfg.breakDamage) {
          this.releasePlayer(f, player, groundY, cfg);
        } else {
          const targetX = p.x;
          const targetY = groundY + cfg.dropHeight + 2.5;
          this.steer(f, targetX, targetY, cfg.liftSpeed, cfg.accel * 3, cfg.maxAccel * 2);
          if (p.y >= groundY + cfg.dropHeight) {
            this.releasePlayer(f, player, groundY, cfg);
          }

          const holdX = p.x;
          const holdY = p.y - 1.5;
          const torso = player.parts && player.parts.get('torso');
          if (torso && torso.body) {
            const tp = torso.body.getPosition();
            const tv = torso.body.getLinearVelocity();
            const dx = holdX - tp.x;
            const dy = holdY - tp.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0.05) {
              const springK = 60;
              const springD = 8;
              const fx = (dx / dist) * springK * dist - tv.x * springD;
              const fy = (dy / dist) * springK * dist - tv.y * springD;
              const fmax = 120;
              const fm = Math.hypot(fx, fy);
              const appliedFx = fm > fmax ? (fx / fm) * fmax : fx;
              const appliedFy = fm > fmax ? (fy / fm) * fmax : fy;
              torso.body.applyForceToCenter({ x: appliedFx * torso.body.getMass(), y: appliedFy * torso.body.getMass() }, true);
            }
            if (tp.y < groundY + 0.5) {
              const lift = (groundY + 0.5 - tp.y) * 80 - tv.y * 12;
              torso.body.applyForceToCenter({ x: 0, y: lift * torso.body.getMass() }, true);
            }
          }
        }
      }
    } else if (f.state === 'release') {
      f.stateTime += dt;
      this.steer(f, p.x, groundY + cfg.altitude, cfg.seekSpeed, cfg.accel * 2, cfg.maxAccel * 2);
      if (f.stateTime >= 4) {
        f.state = 'fly';
        f.grabCooldown = cfg.grabCooldown;
      }
    }

    this.safety(f, groundY, f.radius + 1.2);
    this.bankTo(f, clamp2(-v.x * 0.05, -0.24, 0.24), 5, dt);
    const seg = cfg.sacSeg;
    for (let i = 0; i < f.sacs.length; i++) {
      const s = f.sacs[i];
      const a = (i / f.sacs.length) * Math.PI * 2 + f.age * 0.7;
      const ax = p.x + Math.cos(a) * f.radius * 0.8;
      const ay = p.y + Math.sin(a) * f.radius * 0.7;
      const vx = (s.x - s.px) * 0.92;
      const vy = (s.y - s.py) * 0.92 - 0.012;
      s.px = s.x;
      s.py = s.y;
      s.x += vx;
      s.y += vy;
      let ex = s.x - ax;
      let ey = s.y - ay;
      const d = Math.hypot(ex, ey) || 1;
      if (d > seg) {
        s.x = ax + (ex / d) * seg;
        s.y = ay + (ey / d) * seg;
      }
    }
  }

  findAllyTarget(f, p, enemies, cfg) {
    if (!enemies) return null;
    let best = null;
    let bestD = Infinity;
    for (const e of enemies) {
      if (!e || e.team !== 'enemy' || !e.alive || e.carriedBy || e.recovering) continue;
      if (!e.torsoPosition) continue;
      const t = e.torsoPosition();
      const dx = Math.abs(t.x - p.x);
      const dy = Math.abs(t.y - p.y);
      if (dx > cfg.allyPickRange || dy > cfg.allyPickDepth) continue;
      const d = dx + dy;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  updateHeldAllies(f, dt, p, groundY, ctx) {
    const cfg = f.def;
    const allies = f.allies || [];
    for (let i = allies.length - 1; i >= 0; i--) {
      const e = allies[i];
      if (!e || !e.alive) {
        if (e) e.carriedBy = null;
        allies.splice(i, 1);
      }
    }
    const arena = ctx && ctx.arena;
    for (let i = 0; i < allies.length; i++) {
      const e = allies[i];
      const torso = e.parts && e.parts.get('torso');
      if (!torso || !torso.body) continue;
      const holdX = p.x + (i - (allies.length - 1) / 2) * cfg.allyHangX;
      const holdY = p.y - cfg.allyHangY;
      const tp = torso.body.getPosition();
      const tv = torso.body.getLinearVelocity();
      const dx = holdX - tp.x;
      const dy = holdY - tp.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.05) {
        const springK = 60;
        const springD = 8;
        const fx = (dx / dist) * springK * dist - tv.x * springD;
        const fy = (dy / dist) * springK * dist - tv.y * springD;
        const fmax = 120;
        const fm = Math.hypot(fx, fy);
        const appliedFx = fm > fmax ? (fx / fm) * fmax : fx;
        const appliedFy = fm > fmax ? (fy / fm) * fmax : fy;
        torso.body.applyForceToCenter({ x: appliedFx * torso.body.getMass(), y: appliedFy * torso.body.getMass() }, true);
      }
      const ag = arena ? arena.surfaceY(tp.x) : groundY;
      if (tp.y < ag + 0.5) {
        const lift = (ag + 0.5 - tp.y) * 80 - tv.y * 12;
        torso.body.applyForceToCenter({ x: 0, y: lift * torso.body.getMass() }, true);
      }
    }
  }

  dropAllies(f) {
    if (!f || !f.allies) return;
    for (let i = 0; i < f.allies.length; i++) {
      const e = f.allies[i];
      if (e && e.carriedBy === f) e.carriedBy = null;
    }
    f.allies.length = 0;
    f.allyTarget = null;
  }

  releasePlayer(f, player, groundY, cfg) {
    if (player && player.carriedBy === f) {
      player.carriedBy = null;
      player.dropFall = true;
      player.dropStartY = player.torsoPosition().y;
    }
    f.carriedPlayer = null;
    f.state = 'release';
    f.stateTime = 0;
    f.grabCooldown = cfg.grabCooldown;
  }

  knock(f, dx, dy, strength = 1) {
    if (!f || !f.alive || !f.body) return;
    const m = f.mass || f.body.getMass();
    this._impulse.x = (dx || 0) * m * strength;
    this._impulse.y = (dy || 0) * m * strength;
    f.body.applyLinearImpulse(this._impulse, f.body.getWorldCenter(), true);
    f.body.applyAngularImpulse((this.rng() - 0.5) * m * strength * 0.9, true);
    f.ctrl = Math.max(f.ctrl, this.cfg.ctrlMin);
    f.flash = Math.max(f.flash, this.cfg.hurtTime);
  }

  damage(f, amount, impulse) {
    if (!f || !f.alive || !Number.isFinite(amount) || amount <= 0) return false;
    f.hp -= amount;
    f.flash = this.cfg.hurtTime;
    f.ctrl = this.cfg.ctrlMin + this.rng() * (this.cfg.ctrlMax - this.cfg.ctrlMin);
    if (impulse) this.knock(f, impulse.x, impulse.y, 1);
    this.sfx('flyerHurt');
    const fx = this.hooks.effects;
    const p = f.body.getPosition();
    if (fx && fx.text) fx.text(p.x, p.y + 0.5, String(Math.round(amount)), '#ffe066', 15);
    this.emit('damage', f, amount);
    if (f.hp <= 0) this.kill(f);
    return true;
  }

  kill(f) {
    if (!f || !f.alive) return;
    if (f.type === 'bloater' && f.state === 'carry') {
      const ctx = this.ctx || {};
      this.releasePlayer(f, ctx.player, f.groundY, f.def);
    }
    this.dropAllies(f);
    f.hp = 0;
    f.alive = false;
    f.tumble = this.cfg.deathTime;
    f.ctrl = 0;
    f.body.setGravityScale(1);
    f.body.setAngularVelocity((this.rng() - 0.5) * 9);
    this.stats.killed++;
    this.sfx('flyerDie');
    if (f.state === 'stun') f.body.setGravityScale(1);
  }

  burst(f) {
    if (f.xpAwarded) return;
    f.xpAwarded = true;
    const p = f.body.getPosition();
    const fx = this.hooks.effects;
    if (fx) {
      if (fx.splatter) fx.splatter(p.x, p.y, f.def.color, 16, 4.5);
      if (fx.burst) fx.burst(p.x, p.y, f.def.glow, 12, 5);
      if (fx.ring) fx.ring(p.x, p.y, f.def.glow, 10);
    }
    if (f.type === 'bloater') this.pop(f);
    const xp = f.def.xpMul;
    this.emit('xp', f, xp);
    this.despawn(f);
  }

  pop(f) {
    const cfg = f.def;
    const p = f.body.getPosition();
    const radius = cfg.popRadius;
    this.stats.popped++;
    const fx = this.hooks.effects;
    if (fx) {
      if (fx.splatter) fx.splatter(p.x, p.y, cfg.glow, 20, 7);
      if (fx.shockwave) fx.shockwave(p.x, p.y, cfg.glow, radius, 0.5);
      if (fx.ring) fx.ring(p.x, p.y, cfg.glow, 14);
    }
    this.emit('pop', { x: p.x, y: p.y }, radius, cfg);
    const ctx = this.ctx || {};
    const enemies = ctx.enemies || [];
    for (let i = 0; i < enemies.length; i++) {
      const r = enemies[i];
      if (!r || !r.alive || !r.torsoPosition) continue;
      const t = r.torsoPosition();
      const dx = t.x - p.x;
      const dy = t.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d >= radius || d < 0.001) continue;
      const falloff = 1 - d / radius;
      this.emit('damageRagdoll', r, cfg.popDamage * falloff, { x: t.x, y: t.y });
      const b = r.body;
      if (b && b.applyLinearImpulse) b.applyLinearImpulse({ x: (dx / d) * cfg.popImpulse * falloff * b.getMass(), y: (dy / d) * cfg.popImpulse * falloff * b.getMass() }, b.getWorldCenter(), true);
    }
    for (let i = 0; i < this.items.length; i++) {
      const other = this.items[i];
      if (other === f || !other.alive) continue;
      const o = other.body.getPosition();
      const dx = o.x - p.x;
      const dy = o.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d >= radius || d < 0.001) continue;
      const falloff = 1 - d / radius;
      this.knock(other, (dx / d) * cfg.popImpulse * falloff * 0.7, (dy / d) * cfg.popImpulse * falloff * 0.7, 1);
      this.damage(other, cfg.popDamage * falloff * 0.5, null);
    }
    this.sfx('flyerPop');
  }

  despawn(f) {
    if (f.removed) return;
    if (f.type === 'bloater' && f.state === 'carry') {
      const ctx = this.ctx || {};
      const player = ctx.player;
      if (player && player.carriedBy === f) {
        player.carriedBy = null;
        player.dropFall = true;
        player.dropStartY = player.torsoPosition().y;
      }
    }
    this.dropAllies(f);
    f.removed = true;
    f.alive = false;
    f.body.setActive(false);
    f.body.setGravityScale(0);
    f.body.setLinearVelocity({ x: 0, y: 0 });
    f.body.setAngularVelocity(0);
    const i = this.items.indexOf(f);
    if (i >= 0) this.items.splice(i, 1);
    if (this.pool.length < 12) this.pool.push(f);
  }

  clear() {
    for (let i = this.items.length - 1; i >= 0; i--) this.despawn(this.items[i]);
    this.items.length = 0;
  }

  sfx(name) {
    const fn = this.hooks.onSfx;
    if (fn) fn(name);
  }
}

function dx2(px, tx, ty) {
  const dx = px.x - tx;
  const dy = px.y - ty;
  return Math.hypot(dx, dy);
}

export function drawFlyer(ctx, f, time = 0) {
  if (!f || !f.body || f.removed) return;
  const cfg = f.def;
  const p = f.body.getPosition();
  const ground = f.groundY || 0;
  const h = Math.max(0.4, p.y - ground);
  ctx.save();
  ctx.globalAlpha = clamp2(0.28 * f.shadow, 0.06, 0.3);
  ctx.fillStyle = '#0a0e18';
  ctx.beginPath();
  ctx.ellipse(p.x, ground + 0.03, f.radius * (1.5 + f.shadow), f.radius * 0.42 * f.shadow, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(p.x, p.y);
  const aliveAngle = clamp2(f.body.getAngle(), -1.2, 1.2);
  ctx.rotate(f.alive ? aliveAngle : f.spin + aliveAngle);
  const r = f.radius;
  const flap = Math.sin(f.phase);
  const flash = f.flash > 0 ? clamp2(f.flash / cfg.hurtTime, 0, 1) : 0;
  ctx.lineWidth = 0.045;
  ctx.strokeStyle = '#14101f';
  if (f.type === 'glider') drawGlider(ctx, f, r, flap, time, flash);
  else if (f.type === 'diver') drawDiver(ctx, f, r, flap, time, flash);
  else if (f.type === 'hound') drawHound(ctx, f, r, flap, time, flash);
  else drawBloater(ctx, f, r, flap, time, flash);
  ctx.restore();
  if (!f.alive) {
    ctx.save();
    ctx.globalAlpha = clamp2(f.tumble, 0, 1) * 0.7;
    ctx.fillStyle = cfg.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawGlider(ctx, f, r, flap, time, flash) {
  const cfg = f.def;
  const baseColor = flash > 0 ? '#ffffff' : cfg.color;
  const glowColor = flash > 0 ? '#ffffff' : cfg.glow;
  const bellyColor = flash > 0 ? '#ffffff' : '#1a3a38';
  // Wing span at full flap up to 1.5 x r per side
  const wingSpan = r * (1.2 + 0.3 * flap);

  // --- WING MEMBRANES: fill with glow at alpha 0.5 ---
  const wingFill = flash > 0 ? '#ffffff' : hexToRgba(cfg.glow, 0.5);
  const rimColor = flash > 0 ? '#ffffff' : cfg.color; // bright rim in cfg.color (light)
  const outlineColor = 'rgba(20,16,31,0.6)';

  // Left wing membrane
  ctx.fillStyle = wingFill;
  ctx.beginPath();
  ctx.moveTo(-r * 0.2, r * 0.05);       // shoulder
  ctx.quadraticCurveTo(-r * 0.7, r * (0.15 + flap * 0.25), -wingSpan, r * (0.2 + flap * 0.3)); // leading edge to tip
  ctx.quadraticCurveTo(-r * 1.1, r * (0.1 + flap * 0.2), -r * 0.25, -r * 0.08); // trailing edge back to body
  ctx.closePath();
  ctx.fill();

  // Right wing membrane
  ctx.beginPath();
  ctx.moveTo(r * 0.2, r * 0.05);
  ctx.quadraticCurveTo(r * 0.7, r * (0.15 + flap * 0.25), wingSpan, r * (0.2 + flap * 0.3));
  ctx.quadraticCurveTo(r * 1.1, r * (0.1 + flap * 0.2), r * 0.25, -r * 0.08);
  ctx.closePath();
  ctx.fill();

  // --- BRIGHT RIM STROKE (0.05m) along leading edge and ribs in cfg.color ---
  ctx.lineWidth = 0.05;
  ctx.strokeStyle = rimColor;
  // Left leading edge
  ctx.beginPath();
  ctx.moveTo(-r * 0.2, r * 0.05);
  ctx.quadraticCurveTo(-r * 0.7, r * (0.15 + flap * 0.25), -wingSpan, r * (0.2 + flap * 0.3));
  ctx.stroke();
  // Right leading edge
  ctx.beginPath();
  ctx.moveTo(r * 0.2, r * 0.05);
  ctx.quadraticCurveTo(r * 0.7, r * (0.15 + flap * 0.25), wingSpan, r * (0.2 + flap * 0.3));
  ctx.stroke();

  // Ribs with bright rim color
  ctx.lineWidth = 0.045;
  ctx.strokeStyle = rimColor;
  // Left ribs
  ctx.beginPath();
  for (let i = 1; i <= 4; i++) {
    const t = i / 5;
    ctx.moveTo(-r * 0.2, r * 0.05);
    ctx.quadraticCurveTo(
      -r * (0.4 + t * 0.9), r * (0.12 + flap * 0.15 + t * 0.18),
      -r * (0.35 + t * 1.3), r * (0.18 + flap * 0.25 + t * 0.15)
    );
  }
  ctx.stroke();
  // Right ribs
  ctx.beginPath();
  for (let i = 1; i <= 4; i++) {
    const t = i / 5;
    ctx.moveTo(r * 0.2, r * 0.05);
    ctx.quadraticCurveTo(
      r * (0.4 + t * 0.9), r * (0.12 + flap * 0.15 + t * 0.18),
      r * (0.35 + t * 1.3), r * (0.18 + flap * 0.25 + t * 0.15)
    );
  }
  ctx.stroke();

  // --- THIN DARK OUTLINE (0.03m) around wing membranes ---
  ctx.lineWidth = 0.03;
  ctx.strokeStyle = outlineColor;
  // Left wing outline
  ctx.beginPath();
  ctx.moveTo(-r * 0.2, r * 0.05);
  ctx.quadraticCurveTo(-r * 0.7, r * (0.15 + flap * 0.25), -wingSpan, r * (0.2 + flap * 0.3));
  ctx.quadraticCurveTo(-r * 1.1, r * (0.1 + flap * 0.2), -r * 0.25, -r * 0.08);
  ctx.closePath();
  ctx.stroke();
  // Right wing outline
  ctx.beginPath();
  ctx.moveTo(r * 0.2, r * 0.05);
  ctx.quadraticCurveTo(r * 0.7, r * (0.15 + flap * 0.25), wingSpan, r * (0.2 + flap * 0.3));
  ctx.quadraticCurveTo(r * 1.1, r * (0.1 + flap * 0.2), r * 0.25, -r * 0.08);
  ctx.closePath();
  ctx.stroke();

  // Body + wing combined outline (original body sides) - keep for body shape
  ctx.lineWidth = 0.04;
  ctx.strokeStyle = outlineColor;
  ctx.fillStyle = flash > 0 ? '#ffffff' : 'rgba(63,224,208,0.7)';

  // Left wing + body left side
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.9);          // nose
  ctx.lineTo(-r * 0.5, -r * 0.3);
  ctx.lineTo(-r * 0.7, r * 0.15);
  ctx.lineTo(-r * 0.15, r * 0.1);
  ctx.quadraticCurveTo(-r * 0.7, r * (0.15 + flap * 0.25), -wingSpan, r * (0.2 + flap * 0.3));
  ctx.quadraticCurveTo(-r * 1.1, r * (0.1 + flap * 0.2), -r * 0.25, -r * 0.08);
  ctx.lineTo(-r * 0.5, -r * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Right wing + body right side
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.9);          // nose
  ctx.lineTo(r * 0.5, -r * 0.3);
  ctx.lineTo(r * 0.7, r * 0.15);
  ctx.lineTo(r * 0.15, r * 0.1);
  ctx.quadraticCurveTo(r * 0.7, r * (0.15 + flap * 0.25), wingSpan, r * (0.2 + flap * 0.3));
  ctx.quadraticCurveTo(r * 1.1, r * (0.1 + flap * 0.2), r * 0.25, -r * 0.08);
  ctx.lineTo(r * 0.5, -r * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Body center (kite) + belly + tail + armor + rim in fewer paths
  ctx.fillStyle = baseColor;
  ctx.beginPath();
  // Body center diamond
  ctx.moveTo(0, -r * 0.9);
  ctx.lineTo(-r * 0.5, -r * 0.3);
  ctx.lineTo(0, r * 0.5);
  ctx.lineTo(r * 0.5, -r * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Belly (darker)
  ctx.fillStyle = bellyColor;
  ctx.beginPath();
  ctx.moveTo(0, r * 0.5);
  ctx.lineTo(-r * 0.3, r * 0.1);
  ctx.lineTo(0, -r * 0.5);
  ctx.lineTo(r * 0.3, r * 0.1);
  ctx.closePath();
  ctx.fill();

  // Tail fin
  ctx.fillStyle = baseColor;
  ctx.beginPath();
  ctx.moveTo(0, r * 0.7);
  ctx.lineTo(-r * 0.18, r * 1.1);
  ctx.lineTo(r * 0.18, r * 1.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Armor plates (3 lines) + rim light combined
  ctx.strokeStyle = flash > 0 ? '#ffffff' : 'rgba(20,16,31,0.7)';
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  for (let i = 1; i <= 3; i++) {
    const y = -r * 0.7 + i * r * 0.35;
    const w = r * (0.35 - i * 0.08);
    ctx.moveTo(-w, y);
    ctx.lineTo(w, y);
  }
  // Rim light on top edge
  ctx.moveTo(-r * 0.65, r * 0.12);
  ctx.quadraticCurveTo(0, -r * 0.85, r * 0.65, r * 0.12);
  ctx.stroke();

  // Visor-slit eye
  drawEye(ctx, r, f, flash, cfg);

  // Glowing bomb sac under belly
  if (f.alive) {
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = flash > 0 ? '#ffffff' : cfg.glow;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.65, r * 0.18, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Flash overlay
  if (flash > 0) {
    ctx.globalAlpha = flash * 0.7;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.1, r * 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawDiver(ctx, f, r, flap, time, flash) {
  const cfg = f.def;
  const diving = f.state === 'dive';
  const tele = f.state === 'telegraph';
  const stun = f.state === 'stun';
  const baseColor = flash > 0 ? '#ffffff' : cfg.color;
  const glowColor = flash > 0 ? '#ffffff' : cfg.glow;
  const bellyColor = flash > 0 ? '#ffffff' : '#4a1a10';

  // Wings fold back along body when diving or telegraphing
  const wingFold = (diving || tele) ? 0.15 : 1;
  // Span up to 1.2 x r per side
  const wingSpan = r * 1.2 * wingFold;
  const wingY = r * (0.3 + flap * 0.2);

  // Telegraph glow
  if (tele) {
    ctx.globalAlpha = 0.4 + 0.25 * Math.sin(time * 32);
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // --- WINGS (two pointed blade pairs per side) ---
  // Fill with cfg.glow at alpha 0.55, bright rim in cfg.color, 2 visible veins
  const wingFill = flash > 0 ? '#ffffff' : hexToRgba(cfg.glow, 0.55);
  const rimColor = flash > 0 ? '#ffffff' : cfg.color;
  const outlineColor = 'rgba(20,16,31,0.6)';
  const veinColor = flash > 0 ? '#ffffff' : 'rgba(20,16,31,0.85)';

  // Pre-compute all 4 blade geometries
  const blades = [];
  for (const side of [-1, 1]) {
    for (const isUpper of [true, false]) {
      // Real triangular blade: root chord along the body, tip swept backwards (-y is the back of the creature).
      const yRoot = isUpper ? r * 0.3 : -r * 0.12;
      const chord = isUpper ? r * 0.55 : r * 0.5;
      const xBase = side * r * 0.12;
      const xTip = side * wingSpan * (isUpper ? 1 : 0.82);
      const yTip = yRoot - (isUpper ? r * 0.35 : r * 0.6) + wingY * 0.3;
      blades.push({ xBase, yBase: yRoot + chord / 2, yOffset: 0, xTip, yTip, xTrailing: xBase, yTrailing: yRoot - chord / 2 });
    }
  }

  // --- Fill all membranes in one path ---
  ctx.fillStyle = wingFill;
  ctx.beginPath();
  for (const b of blades) {
    ctx.moveTo(b.xBase, b.yBase + b.yOffset);
    ctx.lineTo(b.xTip, b.yTip);
    ctx.lineTo(b.xTrailing, b.yTrailing);
    ctx.closePath();
  }
  ctx.fill();

  // --- Bright rim along all leading edges (0.05m) ---
  ctx.lineWidth = 0.05;
  ctx.strokeStyle = rimColor;
  ctx.beginPath();
  for (const b of blades) {
    ctx.moveTo(b.xBase, b.yBase + b.yOffset);
    ctx.lineTo(b.xTip, b.yTip);
  }
  ctx.stroke();

  // --- Thin dark outline around all blades (0.03m) ---
  ctx.lineWidth = 0.03;
  ctx.strokeStyle = outlineColor;
  ctx.beginPath();
  for (const b of blades) {
    ctx.moveTo(b.xBase, b.yBase + b.yOffset);
    ctx.lineTo(b.xTip, b.yTip);
    ctx.lineTo(b.xTrailing, b.yTrailing);
    ctx.closePath();
  }
  ctx.stroke();

  // --- Two visible veins per blade (combined) ---
  ctx.lineWidth = 0.04;
  ctx.strokeStyle = veinColor;
  ctx.beginPath();
  for (const b of blades) {
    for (let i = 1; i <= 2; i++) {
      const t = i / 3;
      const vx = b.xBase + (b.xTip - b.xBase) * t * 0.85;
      const vy = b.yBase + b.yOffset + (b.yTip - (b.yBase + b.yOffset)) * t * 0.85;
      ctx.moveTo(b.xBase, b.yBase + b.yOffset);
      ctx.lineTo(vx, vy);
    }
  }
  ctx.stroke();

  // --- BODY (slender spear shape) ---
  const bodyStretch = diving ? 1.4 : 1;
  const bs = bodyStretch;
  
  // Main body
  ctx.fillStyle = baseColor;
  ctx.beginPath();
  ctx.moveTo(0, r * 1.3 * bs);       // stinger tip
  ctx.lineTo(-r * 0.22, r * 0.6 * bs);
  ctx.lineTo(-r * 0.45, r * 0.1 * bs);
  ctx.lineTo(-r * 0.5, -r * 0.15 * bs);
  ctx.lineTo(-r * 0.45, -r * 0.4 * bs);
  ctx.lineTo(-r * 0.38, -r * 0.65 * bs);
  ctx.lineTo(-r * 0.28, -r * 0.85 * bs);
  ctx.lineTo(-r * 0.2, -r * 1.0 * bs);
  ctx.lineTo(r * 0.2, -r * 1.0 * bs);
  ctx.lineTo(r * 0.28, -r * 0.85 * bs);
  ctx.lineTo(r * 0.38, -r * 0.65 * bs);
  ctx.lineTo(r * 0.45, -r * 0.4 * bs);
  ctx.lineTo(r * 0.5, -r * 0.15 * bs);
  ctx.lineTo(r * 0.45, r * 0.1 * bs);
  ctx.lineTo(r * 0.22, r * 0.6 * bs);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,16,31,0.8)';
  ctx.lineWidth = 0.04;
  ctx.stroke();

  // Abdomen segment lines + belly + stinger + mandibles + rim - combined strokes
  ctx.strokeStyle = flash > 0 ? '#ffffff' : 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  for (let i = 1; i <= 3; i++) {
    const y = r * (0.5 - i * 0.22) * bs;
    const w = r * (0.38 - i * 0.05);
    ctx.moveTo(-w, y);
    ctx.lineTo(w, y);
  }
  // Belly
  ctx.strokeStyle = bellyColor;
  ctx.moveTo(0, r * 1.1 * bs);
  ctx.lineTo(-r * 0.15, r * 0.3 * bs);
  ctx.moveTo(0, -r * 0.8 * bs);
  ctx.lineTo(r * 0.15, r * 0.3 * bs);
  // Stinger
  ctx.strokeStyle = flash > 0 ? '#ffffff' : '#1a0a06';
  ctx.moveTo(0, r * 1.3 * bs);
  ctx.lineTo(-r * 0.08, r * 1.1 * bs);
  ctx.moveTo(0, r * 1.3 * bs);
  ctx.lineTo(r * 0.08, r * 1.1 * bs);
  // Mandibles
  ctx.strokeStyle = 'rgba(20,16,31,0.8)';
  ctx.lineWidth = 0.03;
  ctx.moveTo(-r * 0.18, -r * 1.0 * bs);
  ctx.lineTo(-r * 0.4, -r * 1.25 * bs);
  ctx.lineTo(-r * 0.25, -r * 1.1 * bs);
  ctx.moveTo(r * 0.18, -r * 1.0 * bs);
  ctx.lineTo(r * 0.4, -r * 1.25 * bs);
  ctx.lineTo(r * 0.25, -r * 1.1 * bs);
  // Rim light
  ctx.strokeStyle = flash > 0 ? '#ffffff' : 'rgba(255,211,107,0.7)';
  ctx.lineWidth = 0.025;
  ctx.moveTo(-r * 0.4, -r * 0.2 * bs);
  ctx.quadraticCurveTo(0, -r * 1.05 * bs, r * 0.4, -r * 0.2 * bs);
  ctx.stroke();

  // Fill mandibles + stinger + belly (separate fills)
  ctx.fillStyle = flash > 0 ? '#ffffff' : '#2a0e06';
  ctx.beginPath();
  ctx.moveTo(-r * 0.18, -r * 1.0 * bs);
  ctx.lineTo(-r * 0.4, -r * 1.25 * bs);
  ctx.lineTo(-r * 0.25, -r * 1.1 * bs);
  ctx.moveTo(r * 0.18, -r * 1.0 * bs);
  ctx.lineTo(r * 0.4, -r * 1.25 * bs);
  ctx.lineTo(r * 0.25, -r * 1.1 * bs);
  ctx.fill();

  ctx.fillStyle = flash > 0 ? '#ffffff' : '#1a0a06';
  ctx.beginPath();
  ctx.moveTo(0, r * 1.3 * bs);
  ctx.lineTo(-r * 0.08, r * 1.1 * bs);
  ctx.lineTo(r * 0.08, r * 1.1 * bs);
  ctx.fill();

  ctx.fillStyle = bellyColor;
  ctx.beginPath();
  ctx.moveTo(0, r * 1.1 * bs);
  ctx.lineTo(-r * 0.15, r * 0.3 * bs);
  ctx.lineTo(0, -r * 0.8 * bs);
  ctx.lineTo(r * 0.15, r * 0.3 * bs);
  ctx.fill();

  // Compound eye
  drawEye(ctx, r * 0.7, f, flash, cfg);

  // Telegraph/stun indicator
  if (tele || stun) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff3a0';
    ctx.font = 'bold 0.9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, r * 2.1);
  }

  // Flash overlay
  if (flash > 0) {
    ctx.globalAlpha = flash * 0.7;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.2, r * 1.5 * bs, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawBloater(ctx, f, r, flap, time, flash) {
  const cfg = f.def;
  ctx.strokeStyle = 'rgba(255,170,240,0.8)';
  ctx.lineWidth = 0.09;
  for (let i = 0; i < f.sacs.length; i++) {
    const s = f.sacs[i];
    const p = f.body.getPosition();
    const x = s.x - p.x;
    const y = s.y - p.y;
    ctx.beginPath();
    ctx.moveTo(Math.cos((i / f.sacs.length) * Math.PI * 2) * r * 0.7, Math.sin((i / f.sacs.length) * Math.PI * 2) * r * 0.7);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = i % 2 ? '#ff8fd8' : '#8e5bff';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.27, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = flash > 0 ? '#ffffff' : cfg.color;
  ctx.beginPath();
  const pulse = 1 + 0.06 * Math.sin(time * 3 + f.phase);
  ctx.ellipse(0, 0, r * pulse, r * (1.08 + 0.04 * flap), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(60,20,90,0.35)';
  ctx.beginPath();
  ctx.moveTo(-r * 0.8, -r * 0.2);
  ctx.quadraticCurveTo(-r * 1.4, -r * 0.7, -r * 1.25, r * 0.35);
  ctx.quadraticCurveTo(-r, r * 0.05, -r * 0.7, r * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(r * 0.8, -r * 0.2);
  ctx.quadraticCurveTo(r * 1.4, -r * 0.7, r * 1.25, r * 0.35);
  ctx.quadraticCurveTo(r, r * 0.05, r * 0.7, r * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = flash > 0 ? '#ffffff' : cfg.glow;
  ctx.globalAlpha = 0.55 + 0.25 * Math.sin(time * 5 + f.phase);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  drawEye(ctx, r, f, flash, cfg);

  const held = [];
  if (f.carriedPlayer && f.carriedPlayer.alive) held.push(f.carriedPlayer);
  if (f.allies) {
    for (let j = 0; j < f.allies.length; j++) {
      const e = f.allies[j];
      if (e && e.alive) held.push(e);
    }
  }
  if (held.length > 0) {
    const angle = clamp2(f.body.getAngle(), -1.2, 1.2);
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    const p = f.body.getPosition();
    ctx.lineWidth = 0.1;
    ctx.strokeStyle = cfg.color;
    ctx.globalAlpha = 0.7;
    for (let h = 0; h < held.length; h++) {
      const tp = held[h].torsoPosition();
      const wdx = tp.x - p.x;
      const wdy = tp.y - p.y;
      const lx = wdx * ca + wdy * sa;
      const ly = -wdx * sa + wdy * ca;
      const dist = Math.hypot(lx, ly);
      if (dist <= 0.5) continue;
      const ux = lx / dist;
      const uy = ly / dist;
      const perpX = -uy;
      const perpY = ux;
      const bx = 0;
      const by = r * 0.7;
      for (let i = 0; i < 3; i++) {
        const side = i === 1 ? 0 : (i === 0 ? -1 : 1);
        const offset = side * 0.15;
        const cx = bx + ux * 0.3 + perpX * offset;
        const cy = by + uy * 0.3 + perpY * offset;
        const sway = 0.3 + 0.2 * Math.sin(time * 4 + i);
        const ctrlX = cx + perpX * sway;
        const ctrlY = cy + perpY * sway;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(ctrlX, ctrlY, lx + perpX * offset * 0.5, ly + perpY * offset * 0.5);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
}

function drawEye(ctx, r, f, flash, cfg) {
  const ex = f.eyeX * r * 0.22;
  const ey = f.eyeY * r * 0.22;
  ctx.fillStyle = '#f7fbff';
  ctx.beginPath();
  ctx.arc(0, r * 0.16, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#14101f';
  ctx.lineWidth = 0.025;
  ctx.stroke();
  ctx.fillStyle = flash > 0 ? '#ff4d4d' : '#151026';
  ctx.beginPath();
  ctx.arc(ex, r * 0.16 + ey, r * 0.21, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(ex - r * 0.07, r * 0.22 + ey, r * 0.06, 0, Math.PI * 2);
  ctx.fill();
}
