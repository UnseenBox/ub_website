// SLIPSHOT - VOID KRAKEN mini-boss (task 7c)
// Pure logic + drawing, no imports, deterministic seeded RNG

const TAU = Math.PI * 2;
const HALF_PI = Math.PI * 0.5;

function makeRng(seed) {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function approach(a, b, step) { return a < b ? Math.min(a + step, b) : Math.max(a - step, b); }
function smoothstep(t) { return t * t * (3 - 2 * t); }
function sqr(x) { return x * x; }
function hypot(x, y) { return Math.hypot(x, y); }

function hexToRgb(hex) {
  const h = parseInt(hex.slice(1), 16);
  return { r: h >> 16 & 255, g: h >> 8 & 255, b: h & 255 };
}
function rgbToCss(r, g, b, a = 1) { return `rgba(${r},${g},${b},${a})`; }
function mixRgb(a, b, t) {
  return { r: Math.round(lerp(a.r, b.r, t)), g: Math.round(lerp(a.g, b.g, t)), b: Math.round(lerp(a.b, b.b, t)) };
}
function css(c, a) { return `rgba(${c.r},${c.g},${c.b},${a ?? 1})`; }

const SCALE = 0.6;
const geo = (v) => v * SCALE;

export const ATTACK_COLORS = { slam: '#ff3b3b', sweep: '#ff9f1c', spit: '#9dff3a', leap: '#ff5cf0' };
const ATTACK_LABELS = { slam: 'SLAM!', sweep: 'SWEEP!', spit: 'SPIT!', leap: 'LEAP!' };
const ATTACK_TELEGRAPH = { slam: 'slamTelegraph', sweep: 'sweepTelegraph', spit: 'spitTelegraph', leap: 'leapTelegraph' };

export const BOSS_CFG = {
  // One scale factor for every geometric number. Timings, hp and damage are intentionally untouched.
  scale: SCALE,
  // Arrival
  arriveFromY: geo(5.6),
  arriveTime: 2.5,
  // Stalk (base distances chosen so the scaled boss sits ~5-6.5 m from the player)
  stalkDistMin: geo(7),
  stalkDistMax: geo(9),
  stalkMaxSpeed: 2.2,
  // Attack selection
  attackGapMin: 2.2,
  attackGapMax: 3.6,
  enragedGapMul: 0.7,
  // Slam
  slamTelegraph: 0.9,
  slamLockTime: 0.25,
  slamImpactDur: 0.35,
  slamRadius: Math.max(0.95, geo(1.3)),
  slamDamageBase: 12,
  slamDamagePerTier: 6,
  slamKnockX: 7,
  slamKnockY: 6,
  enragedDoubleSlam: true,
  // Sweep
  sweepTelegraph: 0.8,
  sweepDuration: 0.9,
  sweepRange: geo(7),
  sweepHeight: geo(1.0),
  sweepDamageBase: 10,
  sweepDamagePerTier: 5,
  // Spit
  spitTelegraph: 0.6,
  spitCount: 3,
  spitCountEnraged: 5,
  spitSpeed: 11,
  spitSpread: 0.35,
  spitDamageBase: 6,
  spitDamagePerTier: 3,
  spitOriginDrop: geo(1.5),
  // Leap
  leapTelegraph: 1.0,
  leapMinDist: 4.5,
  leapStillTime: 3,
  leapCooldown: 8,
  leapMinDistBehind: 4,
  leapMaxDistBehind: 7,
  leapFlightMin: 0.9,
  leapFlightMax: 1.2,
      leapRise: geo(2.0),
  leapRadius: 2.4,
  leapDamageBase: 16,
  leapDamagePerTier: 8,
  leapKnockX: 9,
  leapKnockY: 10,
  leapRecovery: 0.8,
  leapRecoveryDamageMul: 1.3,
  leapShockRadius: 8,
  // Stun
  staggerDur: 1.4,
  stunDamageMul: 1.5,
  staggerHpFracs: [0.66, 0.33],
  // Enrage
  enrageHpFrac: 0.35,
  enrageSpeedMul: 1.35,
  enrageGlowMul: 1.5,
  enrageFeelerSpeedMul: 1.8,
  // Death
  deathAnimTime: 2.2,
  // Tentacles
  armSegments: 9,
  armLength: geo(8.5),
  armWidthBase: geo(1.05),
  armWidthTip: geo(0.2),
  feelerSegments: 7,
  feelerLength: geo(5.5),
  feelerWidthBase: geo(0.4),
  feelerWidthTip: geo(0.08),
  tentacleMaxStretch: 1.08,
  tentacleGravity: geo(-3.0),
  tentaclePoseReach: geo(8.8),
  tentacleMaxReach: geo(10.5),
  tentacleDamping: 0.96,
  tentacleStiffnessTau: 0.22,
  tentacleTargetTau: 0.25,
  tentacleTargetSpeed: 12,
  tentaclePointSpeed: 10,
  tentacleFlipTime: 0.4,
  tentacleFlipBlend: 0.3,
  idleWaveFreq: 0.32,
  idleWaveAmp: geo(0.6),
  feelerWaveFreq: 0.38,
  feelerWaveAmp: geo(0.4),
  // Spores
  sporeCount: 8,
  sporeRadius: geo(0.15),
  // Eye
  eyeRadius: geo(0.75),
  eyeHitRadius: geo(0.25),
  eyeOffsetY: geo(0.3),
  blinkIntervalMin: 3,
  blinkIntervalMax: 6,
  blinkDur: 0.15,
  // Mantle
  mantleWidth: geo(5.5),
  mantleHeight: geo(3.6),
  mantleBobAmp: geo(0.63),
  mantleBobFreq: 1.35,
  hoverHeight: geo(5.6),
  // Tier palettes
  tierPalettes: [
    { name: 'VOID KRAKEN', mantle: '#6b3fa0', mantleRim: '#9d7eea', glow: '#c89fff', horn: '#4a2370', eyeIris: '#ff4466', eyeSlit: '#1a0a1a', tooth: '#ffe8d0', feelerGlow: '#00fff0', spore: '#c89fff' },
    { name: 'CRIMSON KRAKEN', mantle: '#a02040', mantleRim: '#e85070', glow: '#ff6b8a', horn: '#6b1028', eyeIris: '#ffcc00', eyeSlit: '#331a00', tooth: '#fff0d0', feelerGlow: '#ffcc00', spore: '#ff6b8a' },
    { name: 'TOXIC KRAKEN', mantle: '#1fa040', mantleRim: '#50e870', glow: '#8aff9a', horn: '#106b28', eyeIris: '#ff4400', eyeSlit: '#331500', tooth: '#fff0d0', feelerGlow: '#8aff9a', spore: '#8aff9a' },
  ],
};

export function bossTier(tier) {
  const t = Math.max(1, Math.floor(tier));
  const palIdx = (t - 1) % 3;
  const pal = BOSS_CFG.tierPalettes[palIdx];
  return {
    name: t <= 3 ? pal.name : pal.name,
    palette: pal,
    maxHp: 520 + 280 * (t - 1),
    speedMul: 1 + 0.1 * (t - 1),
    damageMul: 1 + 0.15 * (t - 1),
    xp: 150 + 60 * t,
    coins: 40 + 25 * t,
  };
}

export function bossPushImpulse(pusher, bodyPos, bodyMass = 1) {
  const px = bodyPos?.x ?? 0;
  const py = bodyPos?.y ?? 0;
  const dx = px - pusher.x;
  const dy = py - pusher.y;
  const d = Math.hypot(dx, dy);
  if (!Number.isFinite(d) || d >= pusher.r || d < 1e-6) return { x: 0, y: 0, applied: false };
  const fall = 1 - d / pusher.r;
  const massScale = 1 / clamp(bodyMass || 1, 0.25, 4);
  let ix = (pusher.vx || 0) * 0.6 + (dx / d) * pusher.power * fall;
  let iy = (pusher.vy || 0) * 0.6 + (dy / d) * pusher.power * fall + 0.35 * pusher.power * fall;
  ix *= massScale;
  iy *= massScale;
  const mag = Math.hypot(ix, iy);
  if (mag > KNOCK_PART_SPEED_CAP) {
    ix = ix / mag * KNOCK_PART_SPEED_CAP;
    iy = iy / mag * KNOCK_PART_SPEED_CAP;
  }
  return { x: ix, y: iy, applied: true };
}

const KNOCK_PART_SPEED_CAP = 14;

class Tentacle {
  constructor(segments, length, widthBase, widthTip, isArm, rng) {
    this.segments = segments;
    this.restLen = length / segments;
    this.widthBase = widthBase;
    this.widthTip = widthTip;
    this.isArm = isArm;
    this.rng = rng;
    this.phase = rng() * TAU;
    this.pts = [];
    for (let i = 0; i <= segments; i++) {
      this.pts.push({ x: 0, y: 0, px: 0, py: 0, squash: 1 });
    }
    this.target = { x: 0, y: 0 };
    this.anchor = { x: 0, y: 0 };
    this.wavePhase = rng() * TAU;
    this.whipTimer = 0;
    this.whipStrength = 1;
    this.posed = false;
    this.smoothTarget = { x: 0, y: 0 };
    this.targetReady = false;
    this.stiffness = 7;
    this.elbowSign = 1;
    this.sideSign = 1;
    this.sideValue = 1;
    this.flipTimer = 0;
    this.flipBlend = 1;
    this.snapX = new Float64Array(segments + 1);
    this.snapY = new Float64Array(segments + 1);
    this.segAngle = new Float64Array(segments);
    this.prevAnchorX = null;
    this.prevAnchorY = null;
  }

  setAnchor(ax, ay) { this.anchor.x = ax; this.anchor.y = ay; }
  setTarget(tx, ty) { this.target.x = tx; this.target.y = ty; }
  kick(strength = 1) { this.whipTimer = 0.5; this.whipStrength = strength; }

  widthAt(i) {
    const t = i / this.segments;
    const p = this.pts[i];
    const squash = p ? clamp(p.squash, 0.7, 1.2) : 1;
    return lerp(this.widthBase, this.widthTip, t) * (1 + (1 - squash) * 0.7);
  }

  update(dt, time, gravity, maxStretch, bodyX, bodyY, targetX, targetY, isAttacking, attackPhase, opts = {}) {
    dt = clamp(Number.isFinite(dt) ? dt : 1 / 60, 1 / 240, 1 / 30);
    const pts = this.pts;
    const n = this.segments;
    const segLen = this.restLen;
    const total = segLen * n;
    const state = opts.state || 'idle';
    const telegraph = !!opts.telegraph;
    const groundY = Number.isFinite(opts.groundY) ? opts.groundY : -1e6;
    const groundMin = groundY - 0.02;
    const easeGroundY = (y, prevY) => y < groundMin ? Math.max(groundMin, (Number.isFinite(prevY) ? prevY : groundMin) - 6 * dt) : y;
    const idleCalm = !isAttacking && !opts.airborne && state !== 'stunned' && state !== 'dying';
    const stiffnessGoal = state === 'dying' ? 0.8 : state === 'stunned' ? 1.8 : isAttacking ? 42 : telegraph ? 12 : 7;
    this.stiffness += (stiffnessGoal - this.stiffness) * (1 - Math.exp(-dt / BOSS_CFG.tentacleStiffnessTau));
    const spring = 1 - Math.exp(-this.stiffness * dt);
    const damp = Math.pow(BOSS_CFG.tentacleDamping, dt * 60);
    const grav = gravity * (state === 'dying' ? 2.6 : state === 'stunned' ? 2.0 : 1);
    const gy = grav * dt * dt;

    for (let i = 0; i <= n; i++) {
      this.snapX[i] = pts[i].x;
      this.snapY[i] = pts[i].y;
    }

    const ax = this.anchor.x, ay = this.anchor.y;
    const anchorMove = this.prevAnchorX === null ? 0 : Math.hypot(ax - this.prevAnchorX, ay - this.prevAnchorY);
    this.prevAnchorX = ax;
    this.prevAnchorY = ay;
    pts[0].x = ax;
    pts[0].y = ay;
    pts[0].px = ax;
    pts[0].py = ay;

    if (!this.targetReady) {
      this.smoothTarget.x = this.target.x;
      this.smoothTarget.y = this.target.y;
      this.targetReady = true;
    }
    const follow = 1 - Math.exp(-dt / BOSS_CFG.tentacleTargetTau);
    let tx = this.smoothTarget.x + (this.target.x - this.smoothTarget.x) * follow;
    let ty = this.smoothTarget.y + (this.target.y - this.smoothTarget.y) * follow;
    const tdx = tx - this.smoothTarget.x, tdy = ty - this.smoothTarget.y;
    const tdist = Math.hypot(tdx, tdy);
    const maxTargetStep = BOSS_CFG.tentacleTargetSpeed * dt;
    if (tdist > maxTargetStep) {
      tx = this.smoothTarget.x + tdx / tdist * maxTargetStep;
      ty = this.smoothTarget.y + tdy / tdist * maxTargetStep;
    }
    this.smoothTarget.x = tx;
    this.smoothTarget.y = ty;

    let dx = tx - ax, dy = ty - ay;
    let d = Math.hypot(dx, dy);
    if (d < 1e-6) { dx = 0; dy = -1; d = 1; }
    const ux = dx / d, uy = dy / d;
    const angle = Math.atan2(dy, dx);
    const anchorDist = Math.hypot(ax - bodyX, ay - bodyY);
    const reach = Math.min(d, total * 0.97, Math.max(0.5, BOSS_CFG.tentacleMaxReach - anchorDist - 0.7));

    const rawSide = ux >= 0 ? 1 : -1;
    if (rawSide !== this.sideSign && Math.abs(ux) > 0.25) {
      this.flipTimer += dt;
      if (this.flipTimer >= BOSS_CFG.tentacleFlipTime) {
        const from = this.sideValue;
        this.sideSign = rawSide;
        this.flipBlend = 0;
        this.flipFrom = from;
      }
    } else {
      this.flipTimer = Math.max(0, this.flipTimer - dt * 2);
    }
    this.flipBlend = Math.min(1, this.flipBlend + dt / BOSS_CFG.tentacleFlipBlend);
    const fromSide = this.flipFrom === undefined ? this.sideSign : this.flipFrom;
    this.sideValue = lerp(fromSide, this.sideSign, smoothstep(this.flipBlend)) * this.elbowSign;
    const sx = -uy * this.sideValue, sy = ux * this.sideValue;

    const slack = Math.max(0, total - reach);
    const bowH = Math.sqrt(Math.max(0, (3 * reach * slack) / 8));
    const waveAmp = (this.isArm ? BOSS_CFG.idleWaveAmp : BOSS_CFG.feelerWaveAmp) * 0.9;
    const waveFreq = (this.isArm ? BOSS_CFG.idleWaveFreq : BOSS_CFG.feelerWaveFreq) * TAU;
    this.wavePhase += waveFreq * dt;

    if (!this.posed) {
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        pts[i].x = ax + ux * reach * t;
        pts[i].y = ay + uy * reach * t;
        pts[i].px = pts[i].x;
        pts[i].py = pts[i].y;
        this.segAngle[i - 1] = angle;
      }
      this.posed = true;
    }

    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const bow = 4 * t * (1 - t) * bowH * 0.45;
      const wave = Math.sin(this.wavePhase - t * 2.4 + this.phase + t * t * 1.6) * waveAmp * Math.pow(t, 1.3);
      const off = bow + wave;
      const ix = ax + ux * reach * t + sx * off;
      const iy = ay + uy * reach * t + sy * off;
      const p = pts[i];
      const ox = p.x, oy = p.y;
      const vx = (p.x - p.px) * damp;
      let vy = (p.y - p.py) * damp;
      if (this.whipTimer > 0 && this.isArm) {
        const ripple = Math.sin((0.5 - this.whipTimer) * 14 - i * 0.7);
        vy -= ripple * 0.02 * (this.whipTimer / 0.5) * (0.5 + t) * this.whipStrength;
      }
      p.px = ox;
      p.py = oy;
      p.x = ox + vx + (ix - ox) * spring;
      p.y = oy + vy + (iy - oy) * spring + gy;
      if (p.y < groundMin) {
        p.y = easeGroundY(p.y, this.snapY[i]);
        p.py = p.y;
        p.px = p.x - (p.x - p.px) * 0.55;
      }
    }
    if (this.whipTimer > 0) this.whipTimer = Math.max(0, this.whipTimer - dt);

    // Spring motion is capped here; structural passes below may still correct the chain.
    for (let i = 1; i <= n; i++) {
      const p = pts[i];
      const t = i / n;
      const calmHere = idleCalm && Math.hypot(p.x - ax, p.y - ay) < total * 0.9;
      const limit = (calmHere ? 4.5 : 10) * (0.5 + 0.5 * t) * dt + anchorMove;
      let cx = p.x - this.snapX[i], cy = p.y - this.snapY[i];
      const cd = Math.hypot(cx, cy);
      if (cd > limit) {
        const s = limit / cd;
        p.x = this.snapX[i] + cx * s;
        p.y = Math.max(groundMin, this.snapY[i] + cy * s);
        p.px = p.x - cx * 0.7;
        p.py = p.y - cy * 0.7;
      }
    }

    // Segment angles are rate-limited outside attacks: this is the anti-glitch backbone.
    const maxAbove = opts.airborne ? bodyY + 1.6 : Infinity;
    const maxTurn = (isAttacking ? 22 : 4) * dt;
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[i + 1];
      let ex = q.x - p.x, ey = q.y - p.y;
      let len = Math.hypot(ex, ey);
      if (len < 1e-6) { ex = Math.cos(angle); ey = Math.sin(angle); len = 1; }
      const desired = Math.atan2(ey, ex);
      let prev = Number.isFinite(this.segAngle[i]) ? this.segAngle[i] : desired;
      const diff = Math.atan2(Math.sin(desired - prev), Math.cos(desired - prev));
      prev += clamp(diff, -maxTurn, maxTurn);
      const nextLen = segLen * clamp(len / segLen, 0.93, 1.07);
      q.x = p.x + Math.cos(prev) * nextLen;
      q.y = p.y + Math.sin(prev) * nextLen;
      if (q.y < groundMin) {
        q.y = easeGroundY(q.y, this.snapY[i + 1]);
        const dx = Math.sqrt(Math.max(0, nextLen * nextLen - (q.y - p.y) * (q.y - p.y)));
        q.x = p.x + (q.x >= p.x ? dx : -dx);
        q.py = q.y;
        q.px = q.x - (q.x - q.px) * 0.55;
      } else if (q.y > maxAbove) {
        q.y = maxAbove;
        const dx = Math.sqrt(Math.max(0, nextLen * nextLen - (q.y - p.y) * (q.y - p.y)));
        q.x = p.x + (q.x >= p.x ? dx : -dx);
        q.py = q.y;
        q.px = q.x - (q.x - q.px) * 0.55;
      }
      this.segAngle[i] = prev;
    }

    const leash = Math.min(BOSS_CFG.tentacleMaxReach + 0.25, total + (this.isArm ? 1 : 0.02));
    for (let i = n; i >= 1; i--) {
      const p = pts[i];
      const lx = p.x - bodyX, ly = p.y - bodyY;
      const ld = Math.hypot(lx, ly);
      if (ld > leash) {
        const s = leash / ld;
        p.x = bodyX + lx * s;
        p.y = easeGroundY(bodyY + ly * s, this.snapY[i]);
        p.px = p.x - (p.x - p.px) * 0.7;
        p.py = p.y - (p.y - p.py) * 0.7;
      }
    }

    const bend = isAttacking ? 0.12 : 0.16;
    for (let k = 0; k < 2; k++) {
      pts[0].x = ax;
      pts[0].y = ay;
      for (let i = 1; i < n; i++) {
        const a = pts[i - 1], p = pts[i], c = pts[i + 1];
        p.x += ((a.x + c.x) * 0.5 - p.x) * bend;
        p.y += ((a.y + c.y) * 0.5 - p.y) * bend;
        if (p.y < groundMin) p.y = easeGroundY(p.y, this.snapY[i]);
      }
      for (let i = 0; i < n; i++) {
        const p = pts[i], q = pts[i + 1];
        let ex = q.x - p.x, ey = q.y - p.y;
        let len = Math.hypot(ex, ey);
        if (len < 1e-6) {
          ex = Math.cos(this.segAngle[i]); ey = Math.sin(this.segAngle[i]); len = 1;
        }
        const newLen = segLen * clamp(len / segLen, 0.93, 1.07);
        q.x = p.x + (ex / len) * newLen;
        q.y = p.y + (ey / len) * newLen;
        if (q.y < groundMin || q.y > maxAbove) {
          q.y = q.y < groundMin ? easeGroundY(q.y, this.snapY[i + 1]) : Math.min(q.y, maxAbove);
          q.py = q.y;
          const dy = q.y - p.y;
          const slide = Math.sqrt(Math.max(0, newLen * newLen - dy * dy));
          q.x = p.x + (q.x >= p.x ? slide : -slide);
          q.px = q.x - (q.x - q.px) * 0.55;
        }
      }
    }

    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[i + 1];
      let ex = q.x - p.x, ey = q.y - p.y;
      let len = Math.hypot(ex, ey);
      if (len < 1e-6) { ex = Math.cos(angle); ey = Math.sin(angle); len = segLen; }
      len = segLen * clamp(len / segLen, 0.93, 1.07);
      const desired = Math.atan2(ey, ex);
      const prev = Number.isFinite(this.segAngle[i]) ? this.segAngle[i] : desired;
      const diff = Math.atan2(Math.sin(desired - prev), Math.cos(desired - prev));
      let a = prev + clamp(diff, -maxTurn, maxTurn);
      let qx = p.x + Math.cos(a) * len;
      let qy = p.y + Math.sin(a) * len;
      if (qy < groundMin || qy > maxAbove) {
        qy = qy < groundMin ? groundMin : maxAbove;
        const slide = Math.sqrt(Math.max(0, len * len - (qy - p.y) * (qy - p.y)));
        qx = p.x + (qx >= p.x ? slide : -slide);
      }
      this.segAngle[i] = a;
      q.x = qx;
      q.y = qy;
      q.py = q.y;
      q.px = q.x - (q.x - q.px) * 0.55;
    }

    for (let i = 1; i <= n; i++) {
      const p = pts[i];
      this.snapX[i] = p.x;
      this.snapY[i] = p.y;
      const touching = groundY > -1e5 && p.y <= groundMin + 0.08;
      p.squash += ((touching ? 0.72 : 1) - p.squash) * 0.18;
    }
  }

  getTip() { return this.pts[this.segments]; }
}

export class Boss {
  constructor({ x = 0, tier = 1, seed = 1, groundY = 0 }) {
    this.rng = makeRng(seed);
    this.seed = seed;
    this.tier = Math.max(1, Math.floor(tier));
    const tierData = bossTier(this.tier);
    this.tierData = tierData;
    this.palette = tierData.palette;
    this.maxHp = tierData.maxHp;
    this.hp = this.maxHp;
    this.groundY = groundY;
    this.x = x;
    this.y = groundY + BOSS_CFG.hoverHeight; // body centre
    this.vx = 0;
    this.vy = 0;
    this.state = 'arrive';
    this.stateTime = 0;
    this.arriveStartX = x + (this.rng() - 0.5) * 6;
    this.arriveStartY = groundY + BOSS_CFG.arriveFromY;
    this.stalkTargetX = x;
    this.attackCooldown = 0;
    this.consecutiveAttackCount = 0;
    this.lastAttackType = null;
    this.enraged = false;
    this.enrageTriggered = false;
    this.staggerTriggered = [false, false];
    this.flashTimer = 0;
    this.blinkTimer = 0;
    this.blinkInterval = BOSS_CFG.blinkIntervalMin + this.rng() * (BOSS_CFG.blinkIntervalMax - BOSS_CFG.blinkIntervalMin);
    this.blinking = false;
    this.eyeClosed = false;
    this.bobPhase = this.rng() * TAU;
    this.spores = [];
    for (let i = 0; i < BOSS_CFG.sporeCount; i++) {
      this.spores.push({
        angle: this.rng() * TAU,
        radius: geo(2) + this.rng() * geo(3),
        speed: 0.3 + this.rng() * 0.5,
        phase: this.rng() * TAU,
        size: geo(0.08) + this.rng() * geo(0.12),
      });
    }

    // Tentacles - initialize with deterministic RNG
    const detRng = () => 0.5;
    this.armL = new Tentacle(
      BOSS_CFG.armSegments, BOSS_CFG.armLength, BOSS_CFG.armWidthBase, BOSS_CFG.armWidthTip, true, detRng
    );
    this.armR = new Tentacle(
      BOSS_CFG.armSegments, BOSS_CFG.armLength, BOSS_CFG.armWidthBase, BOSS_CFG.armWidthTip, true, detRng
    );
    this.armL.elbowSign = -1;
    this.armR.elbowSign = 1;
    this.feelers = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * TAU;
      const f = new Tentacle(
        BOSS_CFG.feelerSegments, BOSS_CFG.feelerLength, BOSS_CFG.feelerWidthBase, BOSS_CFG.feelerWidthTip, false, detRng
      );
      f.baseAngle = angle;
      f.elbowSign = i % 2 === 0 ? 1 : -1;
      this.feelers.push(f);
    }

    // Attack state
    this.currentAttack = null;
    this.attackPhase = 0;
    this.attackTelegraph = 0;
    this.attackData = null;
    this.slamTargetX = 0;
    this.slamLockedX = 0;
    this.sweepDir = 0;
    this.sweepProgress = 0;
    this.dyingTimer = 0;
    this.deadEmitted = false;
    this.aliveFlag = true;
    this.damageTakenThisFrame = 0;
    this._lockedSlamTarget = false;
    this._staggerJustTriggered = false;
    this._impactEmitted = false; // Track if impact event emitted for current attack
    this.lastTargetX = x;
    this.lastTargetY = groundY + 1.3;
    this.aimTargetX = x;
    this.aimTargetY = groundY + 1.3;
    this._whipPending = null;
    // Leap state
    this.leapCooldown = BOSS_CFG.leapCooldown * 0.5;
    this.leapStillTime = 0;
    this.leapFromX = 0;
    this.leapToX = 0;
    this.leapFromY = 0;
    this.leapPeak = 0;
    this.leapDuration = BOSS_CFG.leapFlightMin;
    this.leapRadius = BOSS_CFG.leapRadius;
    this.leapPower = 1;
    this.leapLanded = false;
    this.leapSeq = 0;
    this.leapTelegraphTotal = BOSS_CFG.leapTelegraph;
    this.leapChained = false;
    this.lean = 0;
    this._pushers = [];
    for (let i = 0; i < 8; i++) this._pushers.push({ x: 0, y: 0, r: 0, vx: 0, vy: 0, power: 0 });
    // Event buffer for events triggered in damage()
    this._pendingEvents = [];
  }

  get alive() { return this.state !== 'gone'; }
  get dead() { return this.hp <= 0; }
  get hpFrac() { return this.hp / this.maxHp; }

  get stateName() { return this.state; }
  get positionX() { return this.x; }
  get positionY() { return this.y; }
  get isEnraged() { return this.enraged; }
  get attackLabel() { return this.currentAttack ? ATTACK_LABELS[this.currentAttack] : ''; }
  get attackColor() { return this.currentAttack ? ATTACK_COLORS[this.currentAttack] : ''; }
  get telegraphProgress() {
    if (!this.currentAttack || this.attackTelegraph <= 0) return 0;
    const total = BOSS_CFG[ATTACK_TELEGRAPH[this.currentAttack]];
    return clamp(1 - this.attackTelegraph / total, 0, 1);
  }

  get leapFlightProgress() {
    if (this.currentAttack !== 'leap' || this.attackTelegraph > 0) return 0;
    return clamp((this.attackPhase - this.leapTelegraphTotal) / this.leapDuration, 0, 1);
  }

  leapZone(preview = true) {
    const r = this.leapRadius;
    return {
      id: this.leapSeq > 1 ? 'leap-' + this.leapSeq : 'leap', kind: 'circle', x: this.leapToX, y: this.groundY, r,
      preview, damage: preview ? 0 : (BOSS_CFG.leapDamageBase + BOSS_CFG.leapDamagePerTier * (this.tier - 1)) * this.tierData.damageMul,
      knock: { x: Math.sign(this.leapToX - this.leapFromX) * BOSS_CFG.leapKnockX, y: BOSS_CFG.leapKnockY },
      power: this.leapPower,
    };
  }

  previewZones() {
    if (!this.currentAttack) return [];
    if (this.currentAttack === 'leap') {
      return (this.attackTelegraph > 0 || !this.leapLanded) ? [this.leapZone(true)] : [];
    }
    if (this.attackTelegraph <= 0) return [];
    if (this.currentAttack === 'slam') {
      const x = this._lockedSlamTarget ? this.slamTargetX : this.aimTargetX;
      return [{
        id: 'slam', kind: 'circle', x, y: this.groundY, r: BOSS_CFG.slamRadius,
        preview: true, damage: 0,
        knock: { x: Math.sign(x - this.x) * BOSS_CFG.slamKnockX, y: BOSS_CFG.slamKnockY },
      }];
    }
    if (this.currentAttack === 'sweep') {
      const dir = this.sweepDir || (this.aimTargetX < this.x ? 1 : -1);
      const half = BOSS_CFG.sweepRange * 0.6;
      const x = this.x + dir * half - BOSS_CFG.sweepRange * 0.2;
      return [{
        id: 'sweep', kind: 'bar', x, y: this.groundY,
        w: BOSS_CFG.sweepRange * 0.4, h: BOSS_CFG.sweepHeight,
        preview: true, damage: 0, dir,
        knock: { x: dir * 5, y: 4 },
      }];
    }
    return [];
  }

  update(dt, target, env) {
    const events = [];
    if (dt <= 0 || !Number.isFinite(dt)) return events;
    dt = Math.min(dt, 1 / 30);

    // Flush pending events from damage()
    events.push(...this._pendingEvents);
    this._pendingEvents.length = 0;

    // Fixed sub-stepping: exactly 2 steps per frame (dt=1/60, subDt=1/120)
    const subDt = 1 / 120;
    const subSteps = 2;

    for (let s = 0; s < subSteps; s++) {
      this._updateStep(subDt, target, env, events);
    }
    return events;
  }

  _updateStep(dt, target, env, events) {
    this.stateTime += dt;
    this.bobPhase += dt * BOSS_CFG.mantleBobFreq;
    this.flashTimer = Math.max(0, this.flashTimer - dt);

    // Blink logic
    if (!this.blinking && this.state !== 'stunned' && this.state !== 'dying') {
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.blinking = true;
        this.blinkTimer = BOSS_CFG.blinkDur;
        this.eyeClosed = true;
      }
    } else if (this.blinking) {
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.blinking = false;
        this.eyeClosed = false;
        this.blinkInterval = BOSS_CFG.blinkIntervalMin + this.rng() * (BOSS_CFG.blinkIntervalMax - BOSS_CFG.blinkIntervalMin);
        this.blinkTimer = this.blinkInterval;
      }
    }
    if (this.state === 'stunned' || this.state === 'dying') {
      this.eyeClosed = true;
    }

    // Spores
    for (const sp of this.spores) {
      sp.angle += sp.speed * dt;
      sp.phase += dt * 2;
    }

    const groundY = typeof env.groundY === 'function' ? env.groundY(this.x) : this.groundY;
    this.bounds = env.bounds || this.bounds;
    this.leapCooldown = Math.max(0, this.leapCooldown - dt);
    const targetX = target?.x ?? this.x;
    const targetY = target?.y ?? groundY + 1.3;
    const targetAlive = target?.alive ?? true;
    const moved = Math.abs(targetX - this.aimTargetX);
    const behind = this.vx !== 0 && Math.sign(targetX - this.x) !== Math.sign(this.vx);
    this.leapStillTime = moved < 0.02 || behind ? this.leapStillTime + dt : 0;
    this.lastTargetX = this.aimTargetX;
    this.lastTargetY = this.aimTargetY;
    this.aimTargetX = targetX;
    this.aimTargetY = targetY;
    this.groundY = groundY;

    // State machine
    switch (this.state) {
      case 'arrive': this._updateArrive(dt, targetX, targetY, groundY, events); break;
      case 'stalk': this._updateStalk(dt, targetX, targetY, groundY, targetAlive, events); break;
      case 'stunned': this._updateStunned(dt, targetX, targetY, groundY, events); break;
      case 'dying': this._updateDying(dt, targetX, targetY, groundY, events); break;
    }

    // Enrage check (only if not already triggered in damage)
    if (!this.enrageTriggered && this.hpFrac < BOSS_CFG.enrageHpFrac) {
      this.enrageTriggered = true;
      this.enraged = true;
      events.push({ type: 'enrage' });
    }

    // Update tentacles
    this._updateTentacles(dt, this.bobPhase, groundY, targetX, targetY);

    // Clear stagger trigger flag after one damage call
    this._staggerJustTriggered = false;
  }

  _updateArrive(dt, targetX, targetY, groundY, events) {
    const t = clamp(this.stateTime / BOSS_CFG.arriveTime, 0, 1);
    const eased = smoothstep(t);
    this.x = lerp(this.arriveStartX, this.stalkTargetX, eased);
    this.y = lerp(this.arriveStartY, groundY + BOSS_CFG.hoverHeight, eased);
    if (t >= 1) {
      this.state = 'stalk';
      this.stateTime = 0;
      this.attackCooldown = BOSS_CFG.attackGapMin + this.rng() * (BOSS_CFG.attackGapMax - BOSS_CFG.attackGapMin);
    }
  }

  _updateStalk(dt, targetX, targetY, groundY, targetAlive, events) {
    if (!targetAlive) return;

    const speedMul = this.tierData.speedMul * (this.enraged ? BOSS_CFG.enrageSpeedMul : 1);
    const maxSpeed = BOSS_CFG.stalkMaxSpeed * speedMul;
    const desiredDist = BOSS_CFG.stalkDistMin + (BOSS_CFG.stalkDistMax - BOSS_CFG.stalkDistMin) * 0.5;
    const dx = targetX - this.x;
    const dist = Math.abs(dx);
    const telegraphing = !!this.currentAttack && this.attackTelegraph > 0;

    if (this.currentAttack === 'leap') {
      this._executeAttack(dt, targetX, targetY, groundY, events);
      return;
    }

    // Horizontal follow: accelerate/decelerate smoothly, never snap.
    if (telegraphing) {
      this.vx = approach(this.vx, 0, maxSpeed * 6 * dt);
    } else if (dist > desiredDist + 0.5) {
      this.vx = approach(this.vx, Math.sign(dx) * maxSpeed, maxSpeed * 3 * dt);
    } else if (dist < desiredDist - 0.5) {
      this.vx = approach(this.vx, -Math.sign(dx) * maxSpeed, maxSpeed * 3 * dt);
    } else {
      this.vx = approach(this.vx, 0, maxSpeed * 2 * dt);
    }
    this.x += this.vx * dt;
    this.lean += (clamp(this.vx / maxSpeed, -1, 1) * 0.16 - this.lean) * (1 - Math.exp(-dt / 0.28));

    // Lazy float: slow vertical bob, hover between 2.5 and 4m above the surface.
    this.y = groundY + BOSS_CFG.hoverHeight + Math.sin(this.bobPhase) * BOSS_CFG.mantleBobAmp;

    // Attack selection
    this.attackCooldown -= dt;
    const canLeap = this.leapCooldown <= 0 && this.state === 'stalk' &&
      (dist > BOSS_CFG.leapMinDist || this.leapStillTime > BOSS_CFG.leapStillTime);
    if (this.attackCooldown <= 0 && !this.currentAttack) {
      if (canLeap) {
        this._startLeap(targetX, groundY, events, false);
      } else if (dist <= BOSS_CFG.stalkDistMax + 0.6) {
        this._chooseAttack(targetX, events);
      }
    }

    // Execute attack
    if (this.currentAttack) {
      this._executeAttack(dt, targetX, targetY, groundY, events);
    }
  }

  _startLeap(targetX, groundY, events, chained = false) {
    const dir = Math.sign(targetX - this.x) || 1;
    const gap = Math.abs(targetX - this.x);
    let behind = clamp(3.8 + gap * 0.25 + this.rng() * 1.2, BOSS_CFG.leapMinDistBehind, BOSS_CFG.leapMaxDistBehind);
    if (chained) behind *= 0.8;
    let to = targetX + dir * behind;
    const b = this.bounds;
    if (b && Number.isFinite(b.minX) && Number.isFinite(b.maxX)) {
      const min = b.minX + BOSS_CFG.leapRadius;
      const max = b.maxX - BOSS_CFG.leapRadius;
      if (max > min) {
        const clamped = clamp(to, min, max);
        if (Math.abs(clamped - targetX) < 0.6 || Math.sign(clamped - targetX) !== dir) to = targetX;
        else to = clamped;
      }
    }
    this.currentAttack = 'leap';
    this.attackPhase = 0;
    this.leapSeq++;
    this.leapTelegraphTotal = BOSS_CFG.leapTelegraph * (chained ? 0.8 : 1);
    this.attackTelegraph = this.leapTelegraphTotal;
    this.attackData = null;
    this._impactEmitted = false;
    this.leapToX = to;
    this.leapFromX = this.x;
    this.leapFromY = this.y;
    this.leapRadius = BOSS_CFG.leapRadius * (chained ? 0.85 : 1);
    this.leapPower = chained ? 0.8 : 1;
    this.leapDuration = clamp(Math.abs(to - this.x) / 9, BOSS_CFG.leapFlightMin, BOSS_CFG.leapFlightMax) * (chained ? 0.85 : 1);
    this.leapPeak = groundY + BOSS_CFG.hoverHeight + BOSS_CFG.leapRise * (chained ? 0.7 : 1);
    this.leapLanded = false;
    this._leapStarted = false;
    this.leapChained = false;
    if (this.lastAttackType === 'leap') this.consecutiveAttackCount++;
    else { this.consecutiveAttackCount = 1; this.lastAttackType = 'leap'; }
    events.push({ type: 'telegraph', attack: 'leap' });
  }

  _executeLeap(dt, targetX, groundY, events) {
    if (this.attackTelegraph > 0) {
      this.vx = approach(this.vx, 0, BOSS_CFG.stalkMaxSpeed * 8 * dt);
      this.x += this.vx * dt;
      const crouch = this.telegraphProgress * 0.55;
      this.y = groundY + BOSS_CFG.hoverHeight + Math.sin(this.bobPhase) * BOSS_CFG.mantleBobAmp * 0.35 - crouch;
      this.lean += (-Math.sign(this.leapToX - this.x) * 0.12 - this.lean) * (1 - Math.exp(-dt / 0.25));
      return;
    }

    if (!this._leapStarted) {
      this._leapStarted = true;
      this.leapFromX = this.x;
      this.leapFromY = this.y;
      events.push({
        type: 'leap', fromX: this.leapFromX, toX: this.leapToX,
        peak: this.leapPeak, duration: this.leapDuration
      });
      this._whipPending = 'leap';
    }

    const baseY = groundY + BOSS_CFG.hoverHeight;
    if (!this.leapLanded) {
      const p = this.leapFlightProgress;
      this.x = lerp(this.leapFromX, this.leapToX, p);
      this.y = lerp(this.leapFromY, baseY, p) + Math.sin(Math.PI * p) * Math.max(0, this.leapPeak - baseY);
      this.vx = (this.leapToX - this.leapFromX) / this.leapDuration;
      this.lean += (clamp(this.vx / 9, -1, 1) * 0.3 - this.lean) * (1 - Math.exp(-dt / 0.15));
      if (p >= 1) {
        this.leapLanded = true;
        this.x = this.leapToX;
        this.y = baseY;
        this.vx = 0;
        this._whipPending = 'leap';
        this.leapChained = this.enraged && this.rng() < 0.35;
        const damage = (BOSS_CFG.leapDamageBase + BOSS_CFG.leapDamagePerTier * (this.tier - 1)) * this.tierData.damageMul * this.leapPower;
        events.push({
          type: 'land', x: this.leapToX, y: groundY, radius: this.leapRadius,
          power: this.leapPower, damage,
          knock: { x: Math.sign(this.leapToX - this.leapFromX) * BOSS_CFG.leapKnockX, y: BOSS_CFG.leapKnockY },
        });
      }
    } else {
      this.vx = approach(this.vx, 0, BOSS_CFG.stalkMaxSpeed * 8 * dt);
      this.y = baseY + Math.sin(this.bobPhase) * BOSS_CFG.mantleBobAmp;
      this.lean += (0 - this.lean) * (1 - Math.exp(-dt / 0.25));
    }

    if (this.leapLanded && this.attackPhase >= this.leapTelegraphTotal + this.leapDuration + BOSS_CFG.leapRecovery) {
      if (this.leapChained) {
        this._startLeap(this.aimTargetX, groundY, events, true);
      } else {
        this.currentAttack = null;
        this.leapLanded = false;
        this.leapCooldown = BOSS_CFG.leapCooldown;
        this.attackCooldown = (BOSS_CFG.attackGapMin + this.rng() * (BOSS_CFG.attackGapMax - BOSS_CFG.attackGapMin)) * (this.enraged ? BOSS_CFG.enragedGapMul : 1);
      }
    }
  }

  _chooseAttack(targetX, events) {
    const attacks = ['slam', 'sweep', 'spit'];
    let available = attacks.filter(a => {
      // Never same attack 3 times in a row
      if (this.consecutiveAttackCount >= 2 && this.lastAttackType === a) return false;
      return true;
    });
    if (available.length === 0) available = attacks;

    // Weighted random
    let choice = available[Math.floor(this.rng() * available.length)];
    this.currentAttack = choice;
    this.attackPhase = 0;
    this.attackTelegraph = 0;
    this.attackData = null;
    this._lockedSlamTarget = false;
    this._impactEmitted = false;

    // Update consecutive attack tracking
    if (this.lastAttackType === choice) {
      this.consecutiveAttackCount++;
    } else {
      this.consecutiveAttackCount = 1;
      this.lastAttackType = choice;
    }

    if (choice === 'slam') {
      this.attackTelegraph = BOSS_CFG.slamTelegraph;
      events.push({ type: 'telegraph', attack: 'slam' });
    } else if (choice === 'sweep') {
      this.attackTelegraph = BOSS_CFG.sweepTelegraph;
      events.push({ type: 'telegraph', attack: 'sweep' });
    } else if (choice === 'spit') {
      this.attackTelegraph = BOSS_CFG.spitTelegraph;
      events.push({ type: 'telegraph', attack: 'spit' });
    }
  }

  _executeAttack(dt, targetX, targetY, groundY, events) {
    this.attackPhase += dt;
    this.attackTelegraph -= dt;

    if (this.currentAttack === 'slam') {
      this._executeSlam(dt, targetX, targetY, groundY, events);
    } else if (this.currentAttack === 'sweep') {
      this._executeSweep(dt, targetX, targetY, groundY, events);
    } else if (this.currentAttack === 'spit') {
      this._executeSpit(dt, targetX, targetY, groundY, events);
    } else if (this.currentAttack === 'leap') {
      this._executeLeap(dt, targetX, groundY, events);
    }
  }

  _executeSlam(dt, targetX, targetY, groundY, events) {
    const totalTelegraph = BOSS_CFG.slamTelegraph;
    const lockTime = BOSS_CFG.slamLockTime;
    const impactDur = BOSS_CFG.slamImpactDur;
    const damage = (BOSS_CFG.slamDamageBase + BOSS_CFG.slamDamagePerTier * (this.tier - 1)) * this.tierData.damageMul;

    if (this.attackTelegraph > 0) {
      // Telegraph phase - arm raises
      // Lock target x when telegraph time remaining <= lockTime (0.25s before impact)
      if (this.attackTelegraph <= lockTime && !this._lockedSlamTarget) {
        this.slamTargetX = targetX;
        this.slamLockedX = targetX;
        this._lockedSlamTarget = true;
      }
      return;
    }

    // Impact phase - emit slam event only once at start of impact
    if (!this._impactEmitted) {
      events.push({
        type: 'slam',
        x: this.slamTargetX,
        y: groundY,
        r: BOSS_CFG.slamRadius,
        damage,
        knock: { x: Math.sign(this.slamTargetX - this.x) * BOSS_CFG.slamKnockX, y: BOSS_CFG.slamKnockY }
      });
      this._impactEmitted = true;
      this._whipPending = 'slam';
    }

    if (this.attackPhase >= totalTelegraph + impactDur) {
      // Attack done
      this.currentAttack = null;
      this.slamTargetX = 0;
      this.slamLockedX = 0;
      this._lockedSlamTarget = false;
      this._impactEmitted = false;
      this.attackCooldown = (BOSS_CFG.attackGapMin + this.rng() * (BOSS_CFG.attackGapMax - BOSS_CFG.attackGapMin)) * (this.enraged ? BOSS_CFG.enragedGapMul : 1);

      // Enraged double slam
      if (this.enraged && BOSS_CFG.enragedDoubleSlam && this.rng() < 0.5) {
        this._chooseAttack(targetX, events);
        if (this.currentAttack === 'slam') {
          this.slamTargetX = 0;
          this.slamLockedX = 0;
          this._lockedSlamTarget = false;
        } else {
          this.currentAttack = null;
        }
      }
    }
  }

  _executeSweep(dt, targetX, targetY, groundY, events) {
    const totalTelegraph = BOSS_CFG.sweepTelegraph;
    const sweepDur = BOSS_CFG.sweepDuration;
    const damage = (BOSS_CFG.sweepDamageBase + BOSS_CFG.sweepDamagePerTier * (this.tier - 1)) * this.tierData.damageMul;

    if (this.attackTelegraph > 0) {
      // Telegraph - determine sweep direction
      if (this.sweepDir === 0) {
        this.sweepDir = targetX < this.x ? 1 : -1;
        this.sweepProgress = 0;
      }
      return;
    }

    // Impact phase - emit sweep event only once at start of impact
    if (!this._impactEmitted) {
      const startX = this.x + this.sweepDir * BOSS_CFG.sweepRange * 0.6;
      events.push({
        type: 'sweep',
        x: startX,
        y: groundY,
        w: BOSS_CFG.sweepRange * 0.4,
        h: BOSS_CFG.sweepHeight,
        damage,
        knock: { x: this.sweepDir * 5, y: 4 }
      });
      this._impactEmitted = true;
      this._whipPending = 'sweep';
      this.sweepProgress = 0;
    } else {
      this.sweepProgress = clamp((this.attackPhase - totalTelegraph) / sweepDur, 0, 1);
    }

    if (this.attackPhase >= totalTelegraph + sweepDur) {
      this.currentAttack = null;
      this.sweepDir = 0;
      this._impactEmitted = false;
      this.attackCooldown = (BOSS_CFG.attackGapMin + this.rng() * (BOSS_CFG.attackGapMax - BOSS_CFG.attackGapMin)) * (this.enraged ? BOSS_CFG.enragedGapMul : 1);
    }
  }

  _executeSpit(dt, targetX, targetY, groundY, events) {
    const totalTelegraph = BOSS_CFG.spitTelegraph;
    const count = this.enraged ? BOSS_CFG.spitCountEnraged : BOSS_CFG.spitCount;
    const damage = (BOSS_CFG.spitDamageBase + BOSS_CFG.spitDamagePerTier * (this.tier - 1)) * this.tierData.damageMul;

    if (this.attackTelegraph > 0) {
      return;
    }

    // Impact phase - emit spit event only once
    if (!this._impactEmitted) {
      const spread = BOSS_CFG.spitSpread;
      const dirX = targetX - this.x;
      const dirY = targetY - this.y;
      const baseAngle = Math.atan2(dirY, dirX);
      const globs = [];
      for (let i = 0; i < count; i++) {
        const angle = baseAngle + (this.rng() - 0.5) * spread * 2;
        globs.push({
          x: this.x,
          y: this.y - BOSS_CFG.spitOriginDrop,
          dir: { x: Math.cos(angle), y: Math.sin(angle) },
          speed: BOSS_CFG.spitSpeed,
          damage,
        });
      }
      events.push({ type: 'spit', globs });
      this._impactEmitted = true;
    }

    if (this.attackPhase >= totalTelegraph + 0.1) {
      this.currentAttack = null;
      this._impactEmitted = false;
      this.attackCooldown = (BOSS_CFG.attackGapMin + this.rng() * (BOSS_CFG.attackGapMax - BOSS_CFG.attackGapMin)) * (this.enraged ? BOSS_CFG.enragedGapMul : 1);
    }
  }

  _updateStunned(dt, targetX, targetY, groundY, events) {
    this.vx = approach(this.vx, 0, 5 * dt);
    this.x += this.vx * dt;
    this.y = groundY + BOSS_CFG.hoverHeight + Math.sin(this.bobPhase) * BOSS_CFG.mantleBobAmp * 0.5;
    if (this.stateTime >= BOSS_CFG.staggerDur) {
      this.state = 'stalk';
      this.stateTime = 0;
      this.attackCooldown = BOSS_CFG.attackGapMin + this.rng() * (BOSS_CFG.attackGapMax - BOSS_CFG.attackGapMin);
    }
  }

  _updateDying(dt, targetX, targetY, groundY, events) {
    this.dyingTimer += dt;
    this.vx = approach(this.vx, 0, 3 * dt);
    this.x += this.vx * dt;
    this.y = groundY + BOSS_CFG.hoverHeight - this.dyingTimer * 0.5;
    if (this.dyingTimer >= BOSS_CFG.deathAnimTime && !this.deadEmitted) {
      events.push({
        type: 'dead',
        x: this.x,
        y: this.y,
        xp: this.tierData.xp,
        coins: this.tierData.coins
      });
      this.deadEmitted = true;
      this.state = 'gone';
      this.aliveFlag = false;
    }
  }

  _updateTentacles(dt, time, groundY, targetX, targetY) {
    const bodyX = this.x;
    const bodyY = this.y;
    const isAttacking = this.currentAttack === 'slam' || this.currentAttack === 'sweep' || this.currentAttack === 'leap';
    const attackPhase = this.attackPhase / (BOSS_CFG.slamTelegraph + BOSS_CFG.slamImpactDur);
    const maxReach = BOSS_CFG.tentacleMaxReach;
    const opts = {
      state: this.state,
      telegraph: this.currentAttack && this.attackTelegraph > 0,
      airborne: this.currentAttack === 'leap' && !this.leapLanded,
      groundY,
    };

    if (this._whipPending) {
      this.armL.kick();
      this.armR.kick();
      for (let i = 0; i < this.feelers.length; i++) this.feelers[i].kick(0.35);
      this._whipPending = null;
    }

    // Helper to clamp a target to maxReach from body
    const clampTarget = (tx, ty) => {
      const dx = tx - bodyX;
      const dy = ty - bodyY;
      const dist = Math.hypot(dx, dy);
      if (dist > maxReach) {
        const scale = maxReach / dist;
        return { x: bodyX + dx * scale, y: bodyY + dy * scale };
      }
      return { x: tx, y: ty };
    };

    // Arm tentacles - anchored at sides of mantle
    const armAnchorY = bodyY - 0.2;
    const armAnchorOffsetX = BOSS_CFG.mantleWidth * 0.45;

    this.armL.setAnchor(bodyX - armAnchorOffsetX, armAnchorY);
    this.armR.setAnchor(bodyX + armAnchorOffsetX, armAnchorY);

    if (this.currentAttack === 'leap') {
      const dir = Math.sign(this.leapFromX - this.leapToX) || 1;
      const p = this.leapFlightProgress;
      const trailX = bodyX - dir * BOSS_CFG.armLength * 0.45;
      const trailY = this.leapLanded ? groundY + 0.4 : bodyY + 0.8 - p * 1.6;
      const t1 = clampTarget(trailX - geo(0.8), trailY - geo(0.3));
      const t2 = clampTarget(trailX + geo(0.8), trailY + geo(0.3));
      this.armL.setTarget(t1.x, t1.y);
      this.armR.setTarget(t2.x, t2.y);
    } else if (this.currentAttack === 'slam' && this.attackTelegraph > 0) {
      // Telegraph: the slamming arm rears high above the marked ground circle
      const nearL = Math.abs(this.slamTargetX - this.armL.anchor.x) <= Math.abs(this.slamTargetX - this.armR.anchor.x);
      const lift = geo(2.2) + this.telegraphProgress * geo(0.8);
      const t1 = clampTarget(nearL ? this.slamTargetX - geo(0.8) : bodyX - armAnchorOffsetX - geo(2.2), groundY + (nearL ? lift : geo(2.4)));
      const t2 = clampTarget(nearL ? bodyX + armAnchorOffsetX + geo(2.2) : this.slamTargetX + geo(0.8), groundY + (nearL ? geo(2.4) : lift));
      this.armL.setTarget(t1.x, t1.y);
      this.armR.setTarget(t2.x, t2.y);
    } else if (this.currentAttack === 'sweep' && this.attackTelegraph > 0) {
      // Telegraph: arms wind back on the side the sweep starts from
      const windX = this.x - this.sweepDir * BOSS_CFG.sweepRange * 0.75;
      const t1 = clampTarget(windX - geo(1.2), groundY + geo(2.0));
      const t2 = clampTarget(windX + geo(1.2), groundY + geo(3.0));
      this.armL.setTarget(t1.x, t1.y);
      this.armR.setTarget(t2.x, t2.y);
    } else if (this.currentAttack === 'slam' && this.attackTelegraph <= 0) {
      // Slam - arm reaches toward slamTargetX
      // the arm whose root is NEARER to the target does the real slam (claw on the ground), the other one follows beside it
      const nearL = Math.abs(this.slamTargetX - this.armL.anchor.x) <= Math.abs(this.slamTargetX - this.armR.anchor.x);
      const jitter = (this.rng() - 0.5) * 2;
      const t1 = clampTarget(this.slamTargetX + (nearL ? 0 : jitter), groundY + (nearL ? 0 : 0.5));
      const t2 = clampTarget(this.slamTargetX + (nearL ? jitter : 0), groundY + (nearL ? 0.5 : 0));
      this.armL.setTarget(t1.x, t1.y);
      this.armR.setTarget(t2.x, t2.y);
    } else if (this.currentAttack === 'sweep' && this.attackTelegraph <= 0) {
      // Sweep - arm sweeps along ground
      const sweepX = this.x + this.sweepDir * lerp(BOSS_CFG.sweepRange * 0.6, -BOSS_CFG.sweepRange * 0.6, this.sweepProgress);
      const t1 = clampTarget(sweepX, groundY);
      const t2 = clampTarget(sweepX + (this.rng() - 0.5) * 1.5, groundY + 0.3);
      this.armL.setTarget(t1.x, t1.y);
      this.armR.setTarget(t2.x, t2.y);
    } else {
      // Idle - arms arch outward and sway; Verlet keeps them trailing instead of rigidly posed
      const t1 = clampTarget(bodyX - armAnchorOffsetX - geo(6.4) - Math.sin(time * 0.7) * geo(1.0), groundY + geo(2.4) + Math.sin(time * 0.9) * geo(0.9));
      const t2 = clampTarget(bodyX + armAnchorOffsetX + geo(6.4) + Math.sin(time * 0.7 + 1) * geo(1.0), groundY + geo(2.4) + Math.sin(time * 0.9 + 1.7) * geo(0.9));
      this.armL.setTarget(t1.x, t1.y);
      this.armR.setTarget(t2.x, t2.y);
    }

    this.armL.update(dt, time, BOSS_CFG.tentacleGravity, BOSS_CFG.tentacleMaxStretch, bodyX, bodyY, targetX, targetY, isAttacking, attackPhase, opts);
    this.armR.update(dt, time, BOSS_CFG.tentacleGravity, BOSS_CFG.tentacleMaxStretch, bodyX, bodyY, targetX, targetY, isAttacking, attackPhase, opts);

    // Feelers - anchored around mantle bottom
    for (let i = 0; i < this.feelers.length; i++) {
      const f = this.feelers[i];
      const angle = f.baseAngle + time * 0.3 * (this.enraged ? BOSS_CFG.enrageFeelerSpeedMul : 1);
      const anchorX = bodyX + Math.cos(angle) * BOSS_CFG.mantleWidth * 0.4;
      const anchorY = bodyY + Math.sin(angle) * BOSS_CFG.mantleHeight * 0.4;
      f.setAnchor(anchorX, anchorY);

      if (this.currentAttack === 'leap') {
        const dir = Math.sign(this.leapFromX - this.leapToX) || 1;
        const p = this.leapFlightProgress;
        const ty = this.leapLanded ? groundY + 0.2 : bodyY + 0.5 - p * 1.0;
        const t = clampTarget(anchorX - dir * BOSS_CFG.feelerLength * 0.4 + Math.sin(angle) * geo(0.5), ty + Math.cos(angle) * geo(0.4));
        f.setTarget(t.x, t.y);
      } else if (this.state === 'stunned' || this.state === 'dying') {
        const t = clampTarget(anchorX + Math.cos(angle) * geo(2), anchorY + Math.sin(angle) * geo(2) + geo(2));
        f.setTarget(t.x, t.y);
      } else {
        const toTargetX = targetX - anchorX;
        const toTargetY = targetY - anchorY;
        const dist = Math.hypot(toTargetX, toTargetY);
        if (dist < geo(10)) {
          // Deterministic jitter based on feeler index and time (no RNG)
          const jitterX = Math.sin(time * 0.7 + i * 1.3) * geo(0.18);
          const jitterY = Math.cos(time * 0.55 + i * 0.9) * geo(0.18);
          const t = clampTarget(targetX + jitterX, targetY + jitterY);
          f.setTarget(t.x, t.y);
        } else {
          const t = clampTarget(anchorX + Math.cos(angle) * BOSS_CFG.feelerLength * 0.7, anchorY + Math.sin(angle) * BOSS_CFG.feelerLength * 0.7);
          f.setTarget(t.x, t.y);
        }
      }
      f.update(dt, time, BOSS_CFG.tentacleGravity, BOSS_CFG.tentacleMaxStretch, bodyX, bodyY, targetX, targetY, false, 0, opts);
    }
  }

  hitTest(x, y, r = 0) {
    if (this.state === 'arrive' || this.state === 'dying' || this.state === 'gone') return null;

    const bodyX = this.x;
    const bodyY = this.y;

    // Arm tentacles - check first
    for (const arm of [this.armL, this.armR]) {
      const pts = arm.pts;
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i];
        const w = arm.widthAt(i);
        if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
          const dx = x - p.x;
          const dy = y - p.y;
          if (dx * dx + dy * dy <= (w + r) * (w + r)) {
            return { part: 'arm', mult: 0.35, x: p.x, y: p.y };
          }
        }
      }
    }

    // Feeler tentacles - check second
    for (const f of this.feelers) {
      const pts = f.pts;
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i];
        const w = f.widthAt(i);
        if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
          const dx = x - p.x;
          const dy = y - p.y;
          if (dx * dx + dy * dy <= (w + r) * (w + r)) {
            return { part: 'feeler', mult: 0.2, x: p.x, y: p.y };
          }
        }
      }
    }

    // Eye (weak spot) - check third, visual position below body centre, smaller hit radius
    const eyeY = bodyY - BOSS_CFG.eyeOffsetY;
    const eyeHitRadius = BOSS_CFG.eyeHitRadius;
    if (!this.eyeClosed) {
      const dx = x - bodyX;
      const dy = y - eyeY;
      if (dx * dx + dy * dy <= (eyeHitRadius + r) * (eyeHitRadius + r)) {
        return { part: 'eye', mult: 2.0, x: bodyX, y: eyeY };
      }
    }

    // Mantle ellipse - check last
    const mw = BOSS_CFG.mantleWidth * 0.5;
    const mh = BOSS_CFG.mantleHeight * 0.5;
    const dx = (x - bodyX) / mw;
    const dy = (y - bodyY) / mh;
    if (dx * dx + dy * dy <= 1 + r * 0.1) {
      return { part: 'body', mult: 1.0, x: bodyX, y: bodyY };
    }

    return null;
  }

  damage(amount, part = 'body') {
    if (this.state === 'arrive' || this.state === 'dying' || this.state === 'gone' || this.hp <= 0) return 0;

    let mult = 1;
    if (part === 'eye') mult = 2.0;
    else if (part === 'arm') mult = 0.35;
    else if (part === 'feeler') mult = 0.2;

    // Stunned damage multiplier - but not on the damage immediately after stagger trigger
    if (this.state === 'stunned' && !this._staggerJustTriggered) {
      mult *= BOSS_CFG.stunDamageMul;
    }
    if (this.currentAttack === 'leap' && this.leapLanded && this.state !== 'stunned') {
      mult *= BOSS_CFG.leapRecoveryDamageMul;
    }

    const dealt = amount * mult;
    const actualDealt = Math.min(dealt, this.hp);
    this.hp = Math.max(0, this.hp - dealt);
    this.flashTimer = 0.1;
    this.damageTakenThisFrame += actualDealt;

    // Stagger thresholds - emit events immediately via pending buffer
    for (let i = 0; i < BOSS_CFG.staggerHpFracs.length; i++) {
      if (!this.staggerTriggered[i] && this.hpFrac < BOSS_CFG.staggerHpFracs[i]) {
        this.staggerTriggered[i] = true;
        this.state = 'stunned';
        this.stateTime = 0;
        this.currentAttack = null;
        this.eyeClosed = true;
        this._staggerJustTriggered = true;
        this._pendingEvents.push({ type: 'stagger' });
      }
    }

    // Enrage check - emit event immediately
    if (!this.enrageTriggered && this.hpFrac < BOSS_CFG.enrageHpFrac) {
      this.enrageTriggered = true;
      this.enraged = true;
      this._pendingEvents.push({ type: 'enrage' });
    }

    // Death check
    if (this.hp <= 0 && this.state !== 'dying') {
      this.state = 'dying';
      this.stateTime = 0;
      this.dyingTimer = 0;
      this.currentAttack = null;
    }

    return actualDealt;
  }

  harmZones() {
    const zones = [];
    if (this.currentAttack === 'slam' && this.attackTelegraph <= 0) {
      zones.push({
        id: 'slam',
        kind: 'circle',
        x: this.slamTargetX,
        y: this.groundY,
        r: BOSS_CFG.slamRadius,
        damage: (BOSS_CFG.slamDamageBase + BOSS_CFG.slamDamagePerTier * (this.tier - 1)) * this.tierData.damageMul,
        knock: { x: Math.sign(this.slamTargetX - this.x) * BOSS_CFG.slamKnockX, y: BOSS_CFG.slamKnockY }
      });
    }
    if (this.currentAttack === 'sweep' && this.attackTelegraph <= 0) {
      const startX = this.x + this.sweepDir * BOSS_CFG.sweepRange * 0.6;
      const endX = this.x - this.sweepDir * BOSS_CFG.sweepRange * 0.6;
      const x = lerp(startX, endX, clamp(this.sweepProgress, 0, 1));
      zones.push({
        id: 'sweep',
        kind: 'bar',
        x: x - BOSS_CFG.sweepRange * 0.2,
        y: this.groundY,
        w: BOSS_CFG.sweepRange * 0.4,
        h: BOSS_CFG.sweepHeight,
        damage: (BOSS_CFG.sweepDamageBase + BOSS_CFG.sweepDamagePerTier * (this.tier - 1)) * this.tierData.damageMul,
        knock: { x: this.sweepDir * 5, y: 4 }
      });
    }
    if (this.currentAttack === 'leap' && this.leapLanded) {
      zones.push(this.leapZone(false));
    }
    return zones;
  }

  pushers() {
    const out = this._pushers;
    let n = 0;
    const put = (x, y, r, vx, vy, power) => {
      if (n >= out.length || !(r > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return;
      const p = out[n++];
      p.x = x; p.y = y; p.r = r;
      p.vx = Number.isFinite(vx) ? vx : 0;
      p.vy = Number.isFinite(vy) ? vy : 0;
      p.power = Number.isFinite(power) ? power : 0;
    };
    if (this.state !== 'gone' && this.state !== 'dying') {
      const airborne = this.currentAttack === 'leap' && this.attackTelegraph <= 0 && !this.leapLanded;
      if (airborne || Math.abs(this.vx) > 1.2) {
        put(this.x, this.y, airborne ? 1.3 : 1.1, this.vx, this.vy, airborne ? 7 : 2.5);
      }
      const whipping = (this.currentAttack === 'sweep' || this.currentAttack === 'leap' ||
        (this.currentAttack === 'slam' && this.attackTelegraph <= 0 &&
          this.attackPhase - BOSS_CFG.slamTelegraph < BOSS_CFG.slamImpactDur));
      if (whipping) {
        for (const arm of [this.armL, this.armR]) {
          const start = Math.max(1, arm.segments - 3);
          for (let i = start; i <= arm.segments; i++) {
            const p = arm.pts[i];
            const vx = (p.x - p.px) * 120;
            const vy = (p.y - p.py) * 120;
            const speed = Math.hypot(vx, vy);
            if (speed > 2.5) put(p.x, p.y, Math.max(0.2, arm.widthAt(i)), vx, vy, clamp(speed * 0.4, 1.5, 5));
          }
        }
      }
    }
    for (let i = n; i < out.length; i++) out[i].r = 0;
    return out;
  }

  toJSON() {
    return {
      seed: this.seed,
      tier: this.tier,
      hp: this.hp,
      maxHp: this.maxHp,
      x: this.x,
      y: this.y,
      state: this.state,
      stateTime: this.stateTime,
      enraged: this.enraged,
      attackCooldown: this.attackCooldown,
      lastAttacks: [], // Not tracked directly anymore
    };
  }
}

function drawTaperedRibbon(ctx, pts, widthFn, color, outlineColor, glowColor, time, tipGlow = false) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.beginPath();
  const n = pts.length - 1;
  // Left edge
  ctx.moveTo(pts[0].x - widthFn(0) * 0.5, pts[0].y);
  for (let i = 1; i <= n; i++) {
    const p = pts[i];
    const w = widthFn(i);
    const prev = pts[i - 1];
    const cx = (prev.x + p.x) * 0.5;
    const cy = (prev.y + p.y) * 0.5;
    ctx.quadraticCurveTo(prev.x - widthFn(i - 1) * 0.5, prev.y, cx - w * 0.5, cy);
  }
  // Right edge (reverse)
  for (let i = n; i >= 0; i--) {
    const p = pts[i];
    const w = widthFn(i);
    const prev = pts[i - 1] || p;
    const cx = (prev.x + p.x) * 0.5;
    const cy = (prev.y + p.y) * 0.5;
    ctx.quadraticCurveTo(p.x + w * 0.5, p.y, cx + w * 0.5, cy);
  }
  ctx.closePath();

  // Fill with gradient
  const grad = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[n].x, pts[n].y);
  grad.addColorStop(0, color);
  grad.addColorStop(0.5, glowColor);
  grad.addColorStop(1, color);
  ctx.fillStyle = grad;
  ctx.fill();

  // Outline
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 0.03;
  ctx.stroke();

  // Subtle sucker row along one edge
  ctx.fillStyle = outlineColor;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  for (let i = 1; i < n; i += 2) {
    const p = pts[i];
    const w = widthFn(i);
    ctx.moveTo(p.x + w * 0.26 + w * 0.07, p.y);
    ctx.arc(p.x + w * 0.26, p.y, w * 0.07, 0, TAU);
  }
  ctx.fill();

  // Bioluminescent dots
  ctx.fillStyle = glowColor;
  for (let i = 0; i <= n; i += 2) {
    const p = pts[i];
    const w = widthFn(i);
    const pulse = 0.5 + 0.5 * Math.sin(time * 3 + i * 0.5);
    ctx.globalAlpha = 0.4 + 0.3 * pulse;
    ctx.beginPath();
    ctx.arc(p.x, p.y, w * 0.4 * pulse, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (tipGlow) {
    const tip = pts[n];
    const tr = Math.max(0.04, widthFn(n));
    const tg = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, tr * 2.2);
    tg.addColorStop(0, glowColor);
    tg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = tg;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, tr * 2.2, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function fnum(v, fallback = 0) { return Number.isFinite(v) ? v : fallback; }
function fclamp01(v) { return clamp(fnum(v), 0, 1); }
function fmod(v, n) { const m = Math.max(1e-6, fnum(n, 1)); return ((fnum(v) % m) + m) % m; }
function nowPulse(time) { return 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(fnum(time) * TAU * 14)); }

function drawStripedCircle(ctx, x, y, r, color, time) {
  const cx = fnum(x), cy = fnum(y), rr = Math.max(0.05, fnum(r, 1));
  const spacing = 0.34, width = 0.17, shift = fmod(fnum(time) * 0.45, spacing);
  const span = Math.max(1.2, rr * 3);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy + 0.03, rr, rr * 0.34, 0, 0, TAU);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-0.55);
  for (let i = -6; i <= 6; i++) {
    ctx.fillStyle = i % 2 === 0 ? color : 'rgba(0,0,0,0)';
    ctx.fillRect(i * spacing + shift, -span, width, span * 2);
  }
  ctx.restore();
}

function drawStripedBar(ctx, x, y, w, h, color, time) {
  const bx = fnum(x), by = fnum(y), bw = Math.max(0.05, fnum(w, 1)), bh = Math.max(0.02, fnum(h, 0.5));
  const spacing = 0.34, width = 0.17, shift = fmod(fnum(time) * 0.45, spacing);
  const span = Math.max(bw, bh) * 1.6 + 1;
  ctx.save();
  ctx.beginPath();
  ctx.rect(bx, by + 0.02, bw, bh);
  ctx.clip();
  ctx.translate(bx + bw * 0.5, by + bh * 0.5);
  ctx.rotate(-0.55);
  for (let i = -6; i <= 6; i++) {
    ctx.fillStyle = i % 2 === 0 ? color : 'rgba(0,0,0,0)';
    ctx.fillRect(i * spacing + shift, -span, width, span * 2);
  }
  ctx.restore();
}

function drawCountdownArc(ctx, x, y, r, progress, color) {
  const rr = Math.max(0.05, fnum(r, 1)), p = fclamp01(progress);
  ctx.globalAlpha = 0.95;
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.05;
  ctx.beginPath();
  ctx.ellipse(fnum(x), fnum(y) + 0.07, rr * 1.25, rr * 0.42, 0, -HALF_PI, -HALF_PI + TAU * p);
  ctx.stroke();
}

function drawCountdownBar(ctx, x, y, w, h, progress, color) {
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = color;
  ctx.fillRect(fnum(x), fnum(y) + 0.03, Math.max(0, fnum(w, 1)) * fclamp01(progress), Math.max(0.02, fnum(h, 0.5)) * 0.35);
}

function drawNowFlashRing(ctx, x, y, r, alpha) {
  const rr = Math.max(0.05, fnum(r, 1));
  ctx.globalAlpha = fclamp01(alpha);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.09;
  ctx.beginPath();
  ctx.ellipse(fnum(x), fnum(y) + 0.09, rr * 1.4, rr * 0.48, 0, 0, TAU);
  ctx.stroke();
}

function drawSlamBeam(ctx, boss, x, y, time, color) {
  const armL = boss.armL, armR = boss.armR;
  if (!armL || !armR || !armL.getTip || !armR.getTip) return;
  const target = fnum(x);
  const nearL = Math.abs(target - fnum(armL.anchor?.x, target)) <= Math.abs(target - fnum(armR.anchor?.x, target + 1));
  const tip = (nearL ? armL : armR).getTip();
  if (!tip || !Number.isFinite(tip.x) || !Number.isFinite(tip.y)) return;
  ctx.globalAlpha = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(fnum(time) * 9));
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.025;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(target, fnum(y) + 0.05);
  ctx.stroke();
}

function drawExclaim(ctx, x, y, time) {
  const k = 0.085 * (1 + 0.18 * Math.sin(fnum(time) * 12));
  ctx.save();
  ctx.translate(fnum(x), fnum(y));
  ctx.scale(k, -k);
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(12,6,20,0.95)';
  ctx.strokeText('!', 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('!', 0, 0);
  ctx.restore();
}

export function drawAttackMarkers(ctx, boss, time, mantleY) {
  const label = boss.attackLabel;
  if (!label) return;
  const attack = boss.currentAttack;
  const color = ATTACK_COLORS[attack] || '#ffffff';
  const telegraph = fnum(boss.attackTelegraph) > 0;
  const progress = fclamp01(telegraph ? boss.telegraphProgress : 1);
  const t = fnum(time);
  const pulse = 0.5 + 0.5 * Math.sin(t * 11);
  const groundY = fnum(boss.groundY);
  const my = fnum(mantleY, groundY + BOSS_CFG.hoverHeight);
  const leapAir = attack === 'leap' && !telegraph && !boss.leapLanded;
  const zones = (telegraph || leapAir ? boss.previewZones() : boss.harmZones()) || [];
  const zone = zones[0];
  const flashAlpha = telegraph && fnum(boss.attackTelegraph, 1) < 0.2 ? nowPulse(t) : 0;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  if (attack === 'slam' && zone) {
    const r = Math.max(0.05, fnum(zone.r, BOSS_CFG.slamRadius));
    const zx = fnum(zone.x);
    ctx.globalAlpha = telegraph ? 0.28 + 0.22 * pulse : 0.7;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(zx, groundY + 0.03, r * (1 + 0.08 * pulse), r * 0.34, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = telegraph ? 0.95 : 0.8;
    ctx.strokeStyle = telegraph ? color : '#ffffff';
    ctx.lineWidth = 0.07;
    ctx.beginPath();
    const ringR = telegraph ? r * (1.7 - 0.7 * progress) : r * (1 + fclamp01(fnum(boss.attackPhase) - BOSS_CFG.slamTelegraph) * 2);
    ctx.ellipse(zx, groundY + 0.05, ringR, ringR * 0.34, 0, 0, TAU);
    ctx.stroke();
    if (!telegraph) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.arc(zx, groundY + 0.05, r * 1.8, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
    }
    drawStripedCircle(ctx, zx, groundY, r, color, t);
    if (telegraph) drawCountdownArc(ctx, zx, groundY, r, progress, color);
    if (flashAlpha > 0) drawNowFlashRing(ctx, zx, groundY, r, flashAlpha);
    drawSlamBeam(ctx, boss, zx, groundY, t, color);
    drawExclaim(ctx, zx, groundY + r * 0.9 + 0.5 + pulse * 0.15, t);
    if (!telegraph && fnum(boss.attackPhase) - BOSS_CFG.slamTelegraph <= BOSS_CFG.slamImpactDur) {
      ctx.globalAlpha = 0.45 + 0.4 * pulse;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(zx, groundY + 0.08, r * 0.8, r * 0.27, 0, 0, TAU);
      ctx.fill();
    }
  } else if (attack === 'sweep' && zone) {
    const zx = fnum(zone.x), zy = fnum(zone.y, groundY);
    const zw = Math.max(0.05, fnum(zone.w, BOSS_CFG.sweepRange * 0.4));
    const zh = Math.max(0.02, fnum(zone.h, BOSS_CFG.sweepHeight));
    ctx.globalAlpha = telegraph ? 0.1 + 0.08 * pulse : 0.2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(zx + zw * 0.5, zy + 0.01, zw * 0.85, zh * 1.4, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = telegraph ? 0.25 + 0.2 * pulse : 0.45;
    ctx.fillRect(zx, zy + 0.02, zw, zh);
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.06;
    const dir = fnum(zone.dir, 1) >= 0 ? 1 : -1;
    for (let i = 0; i < 3; i++) {
      const q = clamp((i + 1) / 4 + (telegraph ? progress * 0.25 : 0), 0, 1);
      const cx = dir > 0 ? zx + q * zw : zx + (1 - q) * zw;
      const cy = zy + zh * 0.55;
      ctx.beginPath();
      ctx.moveTo(cx - dir * 0.16, cy - 0.15);
      ctx.lineTo(cx + dir * 0.16, cy);
      ctx.lineTo(cx - dir * 0.16, cy + 0.15);
      ctx.stroke();
    }
    drawStripedBar(ctx, zx, zy, zw, zh, color, t);
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.moveTo(zx, zy - 0.12);
    ctx.lineTo(zx, zy + zh + 0.12);
    ctx.moveTo(zx + zw, zy - 0.12);
    ctx.lineTo(zx + zw, zy + zh + 0.12);
    ctx.stroke();
    ctx.globalAlpha = 0.16 + 0.1 * pulse;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.arc(fnum(boss.x), groundY + 0.08, Math.max(0.1, fnum(BOSS_CFG.sweepRange) * 0.65), Math.PI * 0.12, Math.PI * 0.88);
    ctx.stroke();
    if (telegraph) drawCountdownBar(ctx, zx, zy, zw, zh, progress, color);
    if (flashAlpha > 0) {
      ctx.globalAlpha = flashAlpha * 0.45;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(zx, zy + 0.02, zw, zh);
    }
  } else if (attack === 'spit') {
    const mouthX = fnum(boss.x);
    const mouthY = my - fnum(BOSS_CFG.mantleHeight) * 0.45 - fnum(BOSS_CFG.spitOriginDrop) * 0.2;
    const aimX = fnum(boss.aimTargetX), aimY = fnum(boss.aimTargetY);
    const angle = Math.atan2(aimY - mouthY, aimX - mouthX);
    const a1 = angle - fnum(BOSS_CFG.spitSpread), a2 = angle + fnum(BOSS_CFG.spitSpread);
    const len = Math.max(0.5, fnum(geo(4.6), 2.5));
    ctx.globalAlpha = 0.14 + 0.08 * pulse;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(mouthX, mouthY);
    ctx.lineTo(mouthX + Math.cos(a1) * len, mouthY + Math.sin(a1) * len);
    ctx.arc(mouthX, mouthY, len, a1, a2);
    ctx.fill();
    ctx.globalAlpha = telegraph ? 0.35 + 0.5 * progress : 0.85;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mouthX, mouthY, fnum(BOSS_CFG.eyeRadius) * (0.4 + progress * 0.7), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.035;
    ctx.beginPath();
    ctx.moveTo(mouthX, mouthY);
    ctx.lineTo(aimX, aimY);
    ctx.stroke();
    ctx.globalAlpha = 0.85;
    for (const edge of [-1, 1]) {
      const a = angle + edge * fnum(BOSS_CFG.spitSpread);
      ctx.beginPath();
      ctx.moveTo(mouthX, mouthY);
      ctx.lineTo(mouthX + Math.cos(a) * geo(4), mouthY + Math.sin(a) * geo(4));
      ctx.stroke();
    }
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    const drift = fmod(t * 0.8, 1);
    for (let e = 0; e < 2; e++) {
      const a = angle + (e === 0 ? -1 : 1) * fnum(BOSS_CFG.spitSpread);
      for (let i = 0; i < 3; i++) {
        const q = fmod(i / 3 + drift, 1);
        const dx = mouthX + Math.cos(a) * len * q, dy = mouthY + Math.sin(a) * len * q;
        ctx.moveTo(dx + 0.07, dy);
        ctx.arc(dx, dy, 0.07, 0, TAU);
      }
    }
    ctx.fill();
    const eyeY = my - fnum(BOSS_CFG.eyeOffsetY);
    const eyeR = Math.max(0.05, fnum(BOSS_CFG.eyeRadius) * (0.85 + 0.25 * pulse));
    ctx.globalAlpha = 0.55 + 0.35 * pulse;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.ellipse(mouthX, eyeY, eyeR * 1.3, eyeR * 1.1, 0, 0, TAU);
    ctx.stroke();
    if (flashAlpha > 0) {
      drawNowFlashRing(ctx, mouthX, eyeY, eyeR, flashAlpha);
      ctx.globalAlpha = flashAlpha * 0.5;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.moveTo(mouthX, mouthY);
      ctx.lineTo(aimX, aimY);
      ctx.stroke();
    }
  } else if (attack === 'leap') {
    const lx = fnum(zone?.x, fnum(boss.leapToX));
    const ly = fnum(zone?.y, groundY);
    const r = Math.max(0.05, fnum(zone?.r, fnum(boss.leapRadius, BOSS_CFG.leapRadius)));
    if (leapAir) {
      const flight = fclamp01(boss.leapFlightProgress);
      const sw = r * (0.35 + 0.65 * flight);
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.12 + 0.3 * flight;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(fnum(boss.x), groundY + 0.01, sw, sw * 0.3, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    const fromX = fnum(boss.leapFromX), fromY = fnum(boss.leapFromY, groundY + fnum(BOSS_CFG.hoverHeight));
    const toX = fnum(boss.leapToX, lx), toY = groundY + fnum(BOSS_CFG.hoverHeight);
    const peak = Math.max(toY, fnum(boss.leapPeak, toY + 1));
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.035;
    ctx.setLineDash([0.12, 0.18]);
    ctx.lineDashOffset = -t * 0.4;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.quadraticCurveTo((fromX + toX) * 0.5, 2 * peak - 0.5 * (fromY + toY), toX, toY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = telegraph ? 0.3 + 0.18 * pulse : 0.65;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(lx, groundY + 0.03, r * (1 + 0.06 * pulse), r * 0.34, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = telegraph ? color : '#ffffff';
    ctx.lineWidth = 0.07;
    ctx.beginPath();
    const ringR = telegraph ? r * (1.7 - 0.7 * progress) : r * (1 + 0.18 * pulse);
    ctx.ellipse(lx, groundY + 0.05, ringR, ringR * 0.34, 0, 0, TAU);
    ctx.stroke();
    drawStripedCircle(ctx, lx, ly, r, color, t);
    if (telegraph) drawCountdownArc(ctx, lx, ly, r, progress, color);
    if (flashAlpha > 0) drawNowFlashRing(ctx, lx, ly, r, flashAlpha);
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(fnum(boss.x), my + fnum(BOSS_CFG.mantleHeight) * 0.5 + geo(1.1));
  // the world is in metres (y up): 18 px font x 0.05 = a 0.9 m tall call-out, flipped upright
  const labelK = 0.05 * (1 + 0.12 * Math.sin(t * 12));
  ctx.scale(labelK, -labelK);
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(12,6,20,0.95)';
  ctx.strokeText(label, 0, 0);
  ctx.fillStyle = color;
  ctx.fillText(label, 0, 0);
  ctx.restore();
  ctx.restore();
}

export function drawBoss(ctx, boss, time) {
  ctx.save();
  const bodyX = boss.x;
  const bodyY = boss.y;
  const pal = boss.palette;
  const enraged = boss.enraged;
  const state = boss.state;
  const bob = Math.sin(boss.bobPhase) * BOSS_CFG.mantleBobAmp;
  const mantleY = bodyY;
  const mantleW = BOSS_CFG.mantleWidth;
  const mantleH = BOSS_CFG.mantleHeight;
  const glowMul = enraged ? BOSS_CFG.enrageGlowMul : 1;

  // Spores
  for (const sp of boss.spores) {
    const sx = bodyX + Math.cos(sp.angle) * sp.radius;
    const sy = mantleY + Math.sin(sp.angle * 0.7) * sp.radius * 0.5 + Math.sin(sp.phase) * 0.2;
    const pulse = 0.5 + 0.5 * Math.sin(time * 2 + sp.phase);
    const sz = sp.size * pulse;
    ctx.save();
    ctx.globalAlpha = 0.4 + 0.3 * pulse;
    ctx.beginPath();
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sz);
    grad.addColorStop(0, pal.spore);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.arc(sx, sy, sz, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // Feelers (drawn behind mantle)
  for (const f of boss.feelers) {
    drawTaperedRibbon(ctx, f.pts, i => f.widthAt(i), pal.mantle, pal.horn, pal.feelerGlow, time, true);
  }

  // Arms (drawn behind mantle)
  drawTaperedRibbon(ctx, boss.armL.pts, i => boss.armL.widthAt(i), pal.mantle, pal.horn, pal.feelerGlow, time);
  drawTaperedRibbon(ctx, boss.armR.pts, i => boss.armR.widthAt(i), pal.mantle, pal.horn, pal.feelerGlow, time);

  // Mantle body
  ctx.save();
  ctx.translate(bodyX, mantleY);
  ctx.rotate(-(boss.lean || 0));
  const squash = 1 + Math.sin(boss.bobPhase * 2) * 0.025 + Math.abs(boss.lean || 0) * 0.1;
  ctx.scale(squash, 1 / squash);

  // Inner glow veins
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * TAU + time * 0.5;
    const veinGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, mantleW * 0.45);
    const pulse = 0.3 + 0.4 * Math.sin(time * 2 + i);
    veinGrad.addColorStop(0, `rgba(${hexToRgb(pal.glow).r},${hexToRgb(pal.glow).g},${hexToRgb(pal.glow).b},${0.15 * pulse * glowMul})`);
    veinGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = veinGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, mantleW * 0.45, mantleH * 0.4, 0, 0, TAU);
    ctx.fill();
  }

  // Mantle fill
  const mantleGrad = ctx.createRadialGradient(0, -mantleH * 0.2, 0, 0, 0, mantleW * 0.5);
  const mantleColor = hexToRgb(pal.mantle);
  const mantleRimColor = hexToRgb(pal.mantleRim);
  mantleGrad.addColorStop(0, `rgba(${mantleRimColor.r},${mantleRimColor.g},${mantleRimColor.b},0.9)`);
  mantleGrad.addColorStop(0.6, `rgba(${mantleColor.r},${mantleColor.g},${mantleColor.b},0.85)`);
  mantleGrad.addColorStop(1, `rgba(${mantleColor.r},${mantleColor.g},${mantleColor.b},0.6)`);
  ctx.fillStyle = mantleGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, mantleW * 0.5, mantleH * 0.5, 0, 0, TAU);
  ctx.fill();

  // Mantle outline
  ctx.strokeStyle = `rgba(${mantleRimColor.r},${mantleRimColor.g},${mantleRimColor.b},0.8)`;
  ctx.lineWidth = 0.05;
  ctx.stroke();

  // Attack-coloured rim light while winding up
  if (boss.currentAttack && boss.attackTelegraph > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.3 + 0.5 * boss.telegraphProgress;
    ctx.strokeStyle = ATTACK_COLORS[boss.currentAttack];
    ctx.lineWidth = 0.1;
    ctx.beginPath();
    ctx.ellipse(0, 0, mantleW * 0.53, mantleH * 0.53, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  // Glowing spots on sides
  for (let i = 0; i < 4; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const yOff = (i < 2 ? -0.3 : 0.3) * mantleH;
    const pulse = 0.5 + 0.5 * Math.sin(time * 1.5 + i);
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.3 * pulse * glowMul;
    ctx.beginPath();
    const spotGrad = ctx.createRadialGradient(side * mantleW * 0.35, yOff, 0, side * mantleW * 0.35, yOff, mantleW * 0.15);
    const glowC = hexToRgb(pal.glow);
    spotGrad.addColorStop(0, `rgba(${glowC.r},${glowC.g},${glowC.b},0.8)`);
    spotGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = spotGrad;
    ctx.arc(side * mantleW * 0.35, yOff, mantleW * 0.15 * pulse, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // Horns (crest)
  const hornColor = hexToRgb(pal.horn);
  for (let i = 0; i < 3; i++) {
    const xOff = (i - 1) * mantleW * 0.18;
    ctx.fillStyle = `rgba(${hornColor.r},${hornColor.g},${hornColor.b},0.9)`;
    ctx.beginPath();
    ctx.moveTo(xOff, -mantleH * 0.5);
    ctx.quadraticCurveTo(xOff, -mantleH * 0.8, xOff + (i === 1 ? 0 : (i === 0 ? -0.15 : 0.15) * mantleW), -mantleH * 0.9);
    ctx.quadraticCurveTo(xOff + (i === 1 ? 0 : (i === 0 ? -0.2 : 0.2) * mantleW), -mantleH * 0.7, xOff, -mantleH * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(${mantleRimColor.r},${mantleRimColor.g},${mantleRimColor.b},0.6)`;
    ctx.lineWidth = 0.03;
    ctx.stroke();
  }

  ctx.restore();

  // Mouth (underside)
  const mouthY = mantleY + mantleH * 0.45;
  if (boss.currentAttack === 'spit' && boss.attackTelegraph <= 0) {
    // Open mouth
    ctx.save();
    ctx.translate(bodyX, mouthY);
    ctx.fillStyle = '#1a0a1a';
    ctx.beginPath();
    ctx.ellipse(0, 0, mantleW * 0.3, mantleH * 0.15, 0, 0, TAU);
    ctx.fill();
    // Teeth
    ctx.fillStyle = pal.tooth;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * TAU;
      const tx = Math.cos(angle) * mantleW * 0.28;
      const ty = Math.sin(angle) * mantleH * 0.12;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-0.05, 0.12);
      ctx.lineTo(0.05, 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  } else {
    // Closed mouth - just teeth line
    ctx.save();
    ctx.translate(bodyX, mouthY);
    ctx.fillStyle = pal.tooth;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * TAU + Math.PI;
      const tx = Math.cos(angle) * mantleW * 0.25;
      const ty = Math.sin(angle) * mantleH * 0.08;
      ctx.beginPath();
      ctx.moveTo(tx - 0.04, ty);
      ctx.lineTo(tx, ty - 0.06);
      ctx.lineTo(tx + 0.04, ty);
      ctx.fill();
    }
    ctx.restore();
  }

  // Eye (drawn last, on top)
  const eyeY = mantleY - BOSS_CFG.eyeOffsetY;
  const eyeR = BOSS_CFG.eyeRadius * (boss.currentAttack === 'spit' && boss.attackTelegraph > 0 ? 1 + boss.telegraphProgress * 0.45 : 1);
  if (!boss.eyeClosed || boss.flashTimer > 0) {
    ctx.save();
    ctx.translate(bodyX, eyeY);
    // Eye white
    const irisColor = hexToRgb(pal.eyeIris);
    const slitColor = hexToRgb(pal.eyeSlit);
    const eyeGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, eyeR);
    eyeGrad.addColorStop(0, `rgba(${irisColor.r},${irisColor.g},${irisColor.b},${enraged ? 1 : 0.8})`);
    eyeGrad.addColorStop(0.7, `rgba(${irisColor.r},${irisColor.g},${irisColor.b},0.6)`);
    eyeGrad.addColorStop(1, `rgba(${slitColor.r},${slitColor.g},${slitColor.b},0.9)`);
    ctx.fillStyle = eyeGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, eyeR, eyeR * 0.9, 0, 0, TAU);
    ctx.fill();

    // Pupil (vertical slit)
    const pupilH = eyeR * 0.7;
    const pupilW = eyeR * 0.15;
    const targetDx = boss.x - bodyX; // Actually target relative
    const trackX = clamp(targetDx * 0.1, -eyeR * 0.3, eyeR * 0.3);
    ctx.fillStyle = `rgba(${slitColor.r},${slitColor.g},${slitColor.b},1)`;
    ctx.beginPath();
    ctx.ellipse(trackX, 0, pupilW, pupilH, 0, 0, TAU);
    ctx.fill();

    // Eye highlight
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(trackX - eyeR * 0.2, -eyeR * 0.2, eyeR * 0.12, eyeR * 0.18, 0, 0, TAU);
    ctx.fill();

    // Eyelid (if blinking)
    if (boss.blinking || boss.state === 'stunned' || boss.state === 'dying') {
      ctx.fillStyle = `rgba(${mantleColor.r},${mantleColor.g},${mantleColor.b},0.95)`;
      ctx.beginPath();
      ctx.ellipse(0, -eyeR * 0.1, eyeR, eyeR * 0.3, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // Hit flash overlay
  if (boss.flashTimer > 0) {
    const alpha = boss.flashTimer * 5;
    ctx.save();
    ctx.globalAlpha = Math.min(0.5, alpha);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.ellipse(bodyX, mantleY, mantleW * 0.5, mantleH * 0.5, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawAttackMarkers(ctx, boss, time, mantleY);

  ctx.restore();
}

export function drawBossBar(ctx, boss, width, height, time) {
  ctx.save();
  const barW = width * 0.4;
  const barH = 14;
  const x = (width - barW) * 0.5;
  const y = 20;
  const hpFrac = boss.hpFrac;
  const pal = boss.palette;
  const name = boss.tierData.name;

  // Background
  ctx.fillStyle = 'rgba(20,10,30,0.85)';
  ctx.fillRect(x, y, barW, barH);

  // Health fill
  const fillW = barW * hpFrac;
  const hpColor = hpFrac > 0.5 ? '#00e880' : hpFrac > 0.25 ? '#ffcc00' : '#ff3344';
  const flash = boss.flashTimer > 0 && Math.sin(time * 30) > 0;
  ctx.fillStyle = flash ? 'rgba(255,255,255,0.9)' : hpColor;
  ctx.fillRect(x, y, fillW, barH);

  // Segment notches at 66% and 33%
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  for (const frac of [0.66, 0.33]) {
    const nx = x + barW * frac;
    ctx.beginPath();
    ctx.moveTo(nx, y);
    ctx.lineTo(nx, y + barH);
    ctx.stroke();
  }

  // Border
  ctx.strokeStyle = `rgba(${hexToRgb(pal.mantleRim).r},${hexToRgb(pal.mantleRim).g},${hexToRgb(pal.mantleRim).b},0.8)`;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, barW, barH);

  // Name text
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#fff';
  ctx.fillText(name, width * 0.5, y - 2);

  if (boss.attackLabel) {
    ctx.fillStyle = boss.attackColor;
    ctx.fillText(boss.attackLabel, width * 0.5, y + barH + 13);
  }

  ctx.restore();
}