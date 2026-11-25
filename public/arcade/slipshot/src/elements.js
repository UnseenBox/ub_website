// SLIPSHOT - Elemental status effects (fire/frost/shock). Pure logic, no imports, injected rng.

export const ELEMENT_CFG = {
  fire: { baseChance: 0.12, perLevel: 0.08, maxChance: 0.52, duration: 3.5, dpsBase: 4, dpsPerLevel: 2, spreadRadius: 1.6, spreadChancePerSec: 0.25, deathPuffRadius: 1.2 },
  frost: { baseChance: 0.12, perLevel: 0.08, maxChance: 0.52, duration: 3, speedMul: 0.5, freezeDuration: 0.9, freezeDamageMul: 1.4 },
  shock: { baseChance: 0.10, perLevel: 0.07, maxChance: 0.45, jumpTargetsBase: 2, jumpTargetsPerLevel: 0.5, jumpRadius: 4, jumpDamageMul: 0.45, stunDuration: 0.25 },
};

export const ELEMENT_COLORS = {
  fire: '#ff7a1a',
  frost: '#7fd8ff',
  shock: '#ffe066',
};

const STATUS_KINDS = ['fire', 'frost', 'shock'];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class StatusSet {
  constructor() {
    this.fire = { active: false, time: 0, power: 0, source: null, dps: 0 };
    this.frost = { active: false, time: 0, power: 0, source: null, frozen: false, freezeTime: 0 };
    this.shock = { active: false, time: 0, power: 0, source: null, stunned: false, stunTime: 0 };
    this._rng = mulberry32(1);
  }

  setRng(rng) {
    this._rng = typeof rng === 'function' ? rng : mulberry32(1);
  }

  apply(kind, power, source, rng) {
    const r = typeof rng === 'function' ? rng : this._rng;
    if (kind === 'fire') {
      if (this.frost.active) {
        this.frost.active = false;
        this.frost.time = 0;
        this.frost.frozen = false;
        this.frost.freezeTime = 0;
      }
      this.fire.active = true;
      this.fire.time = ELEMENT_CFG.fire.duration;
      this.fire.power = power;
      this.fire.source = source;
      this.fire.dps = ELEMENT_CFG.fire.dpsBase + ELEMENT_CFG.fire.dpsPerLevel * power;
    } else if (kind === 'frost') {
      if (this.fire.active) {
        this.fire.active = false;
        this.fire.time = 0;
        this.fire.dps = 0;
      }
      const wasChilled = this.frost.active;
      this.frost.active = true;
      this.frost.time = ELEMENT_CFG.frost.duration;
      this.frost.power = power;
      this.frost.source = source;
      if (wasChilled) {
        this.frost.frozen = true;
        this.frost.freezeTime = ELEMENT_CFG.frost.freezeDuration;
      }
    } else if (kind === 'shock') {
      this.shock.active = true;
      this.shock.time = ELEMENT_CFG.shock.stunDuration;
      this.shock.power = power;
      this.shock.source = source;
      this.shock.stunned = true;
      this.shock.stunTime = ELEMENT_CFG.shock.stunDuration;
    }
  }

  has(kind) {
    if (kind === 'fire') return this.fire.active;
    if (kind === 'frost') return this.frost.active;
    if (kind === 'shock') return this.shock.active;
    return false;
  }

  get speedMul() {
    if (this.frost.active) return ELEMENT_CFG.frost.speedMul;
    return 1;
  }

  get frozen() {
    return this.frost.active && this.frost.frozen;
  }

  get stunned() {
    return this.shock.active && this.shock.stunned;
  }

  update(dt, target, hooks) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (this.fire.active) {
      this.fire.time -= dt;
      if (this.fire.time <= 0) {
        this.fire.active = false;
        this.fire.time = 0;
        this.fire.dps = 0;
        if (hooks && hooks.onFireEnd) hooks.onFireEnd(target);
      } else if (hooks && hooks.onFireTick) {
        hooks.onFireTick(target, this.fire.dps, this.fire.source);
      }
    }
    if (this.frost.active) {
      this.frost.time -= dt;
      if (this.frost.frozen) {
        this.frost.freezeTime -= dt;
        if (this.frost.freezeTime <= 0) {
          this.frost.frozen = false;
          this.frost.freezeTime = 0;
        }
      }
      if (this.frost.time <= 0) {
        this.frost.active = false;
        this.frost.time = 0;
        this.frost.frozen = false;
        this.frost.freezeTime = 0;
      }
    }
    if (this.shock.active) {
      this.shock.time -= dt;
      if (this.shock.stunned) {
        this.shock.stunTime -= dt;
        if (this.shock.stunTime <= 0) {
          this.shock.stunned = false;
          this.shock.stunTime = 0;
        }
      }
      if (this.shock.time <= 0) {
        this.shock.active = false;
        this.shock.time = 0;
        this.shock.stunned = false;
        this.shock.stunTime = 0;
      }
    }
  }

  clear() {
    this.fire.active = false; this.fire.time = 0; this.fire.power = 0; this.fire.source = null; this.fire.dps = 0;
    this.frost.active = false; this.frost.time = 0; this.frost.power = 0; this.frost.source = null; this.frost.frozen = false; this.frost.freezeTime = 0;
    this.shock.active = false; this.shock.time = 0; this.shock.power = 0; this.shock.source = null; this.shock.stunned = false; this.shock.stunTime = 0;
  }

  getActiveCount() {
    let n = 0;
    if (this.fire.active) n++;
    if (this.frost.active) n++;
    if (this.shock.active) n++;
    return n;
  }

  getActiveKinds() {
    const kinds = [];
    if (this.fire.active) kinds.push('fire');
    if (this.frost.active) kinds.push('frost');
    if (this.shock.active) kinds.push('shock');
    return kinds;
  }
}

export function rollElementalProc(runStats, elementKind, isAreaHit) {
  const cfg = ELEMENT_CFG[elementKind];
  if (!cfg) return false;
  const level = runStats[elementKind === 'fire' ? 'igniteChance' : elementKind === 'frost' ? 'frostChance' : 'shockChance'] || 0;
  if (level <= 0) return false;
  const chance = Math.min(cfg.maxChance, cfg.baseChance + cfg.perLevel * level);
  const rollChance = isAreaHit ? chance * 0.5 : chance;
  return Math.random() < rollChance;
}

export function applyElementalOnHit(target, runStats, damage, isAreaHit, rng) {
  const procs = [];
  for (const kind of STATUS_KINDS) {
    if (rollElementalProc(runStats, kind, isAreaHit)) {
      const level = runStats[kind === 'fire' ? 'igniteChance' : kind === 'frost' ? 'frostChance' : 'shockChance'] || 0;
      if (level > 0) {
        procs.push({ kind, level, damage });
      }
    }
  }
  if (procs.length === 0) return procs;
  if (!target.status) target.status = new StatusSet();
  if (rng) target.status.setRng(rng);
  for (const proc of procs) {
    target.status.apply(proc.kind, proc.level, target, rng);
  }
  return procs;
}

export function drawElementalEffects(ctx, target, time) {
  if (!target.status) return;
  const s = target.status;
  const torso = target.parts?.get('torso');
  if (!torso) return;
  const pos = { x: torso.body.getPosition().x, y: torso.body.getPosition().y };

  if (s.fire.active) {
    const alpha = Math.min(1, s.fire.time / ELEMENT_CFG.fire.duration);
    ctx.save();
    ctx.globalAlpha = 0.6 * alpha;
    ctx.fillStyle = ELEMENT_COLORS.fire;
    for (let i = 0; i < 3; i++) {
      const ang = time * 4 + i * 2;
      const r = 0.3 + 0.2 * Math.sin(time * 6 + i);
      ctx.beginPath();
      ctx.arc(pos.x + Math.cos(ang) * r, pos.y + Math.sin(ang) * r, 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  if (s.frost.active) {
    const alpha = Math.min(1, s.frost.time / ELEMENT_CFG.frost.duration);
    ctx.save();
    ctx.globalAlpha = 0.4 * alpha;
    ctx.strokeStyle = ELEMENT_COLORS.frost;
    ctx.lineWidth = 0.03;
    for (let i = 0; i < 4; i++) {
      const ang = time * 2 + i * 1.5;
      const r = 0.35 + 0.1 * Math.sin(time * 3 + i);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, ang, ang + 1.2);
      ctx.stroke();
    }
    if (s.frost.frozen) {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = 'rgba(127, 216, 255, 0.5)';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  if (s.shock.active) {
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = ELEMENT_COLORS.shock;
    ctx.lineWidth = 0.04;
    for (let i = 0; i < 2; i++) {
      const ang = time * 10 + i * 3;
      const x1 = pos.x + Math.cos(ang) * 0.4;
      const y1 = pos.y + Math.sin(ang) * 0.4;
      const x2 = pos.x + Math.cos(ang + 0.5) * 0.6;
      const y2 = pos.y + Math.sin(ang + 0.5) * 0.6;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function shockChain(target, allTargets, runStats, damage, rng) {
  if (!target.status || !target.status.shock.active) return [];
  const cfg = ELEMENT_CFG.shock;
  const level = runStats.shockChance || 0;
  const maxTargets = Math.floor(cfg.jumpTargetsBase + cfg.jumpTargetsPerLevel * level);
  const chainTargets = [];
  const used = new Set([target.id]);
  let current = target;
  for (let i = 0; i < maxTargets; i++) {
    let best = null;
    let bestDist = Infinity;
    for (const t of allTargets) {
      if (!t.alive || used.has(t.id)) continue;
      const dx = t.torsoPosition().x - current.torsoPosition().x;
      const dy = t.torsoPosition().y - current.torsoPosition().y;
      const dist = Math.hypot(dx, dy);
      if (dist <= cfg.jumpRadius && dist < bestDist) {
        best = t;
        bestDist = dist;
      }
    }
    if (!best) break;
    used.add(best.id);
    chainTargets.push({ target: best, damage: damage * cfg.jumpDamageMul });
    current = best;
  }
  return chainTargets;
}