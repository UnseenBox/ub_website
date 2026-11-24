export const MELEE_CFG = Object.freeze({
  fromLevel: 2,
  chanceBase: 0.25,
  chancePerLevel: 0.05,
  chanceMax: 0.5,
  hpMul: 1.3,
  speedMulMin: 1.2,
  speedMulMax: 1.5,
  xpMul: 1.2,
  reach: 1.5,
  windup: 0.45,
  cooldown: 1.4,
  damage: 9,
  shoveImpulse: 40,
  hopRange: 1.4,
});

export function brawlerChance(level) {
  if (level < MELEE_CFG.fromLevel) return 0;
  return Math.min(MELEE_CFG.chanceMax, MELEE_CFG.chanceBase + MELEE_CFG.chancePerLevel * (level - MELEE_CFG.fromLevel));
}

export function brawlerKind(level, rng) {
  return level >= MELEE_CFG.fromLevel && rng() < brawlerChance(level) ? 'brawler' : 'walker';
}

export function brawlerSpeedMul(rng) {
  return MELEE_CFG.speedMulMin + rng() * (MELEE_CFG.speedMulMax - MELEE_CFG.speedMulMin);
}

export function brawlerXpMul() {
  return MELEE_CFG.xpMul;
}

export function friendAhead(self, friends, dir, range = MELEE_CFG.hopRange) {
  const x = self.torsoPosition().x;
  for (const other of friends) {
    if (other === self || !other.alive || other.grounded === false) continue;
    const dx = other.torsoPosition().x - x;
    if (Math.sign(dx) === dir && Math.abs(dx) < range) return other;
  }
  return null;
}

export class MeleeAttack {
  constructor(body, hooks = {}) {
    this.body = body;
    this.hooks = hooks;
    this.windup = 0;
    this.cooldown = 0;
    body.meleeWind = 0;
    body.strikeTime = 0;
    body.recoverTime = 0;
  }
  inReach(player, reach) {
    const a = this.body.torsoPosition(), b = player.torsoPosition();
    return Math.abs(b.x - a.x) <= reach && Math.abs(b.y - a.y) < 1.4;
  }
  update(dt, player) {
    const body = this.body;
    body.strikeTime = Math.max(0, (body.strikeTime || 0) - dt);
    body.recoverTime = Math.max(0, (body.recoverTime || 0) - dt);
    if (!body.alive || !player || !player.alive || !body.isStanding()) {
      this.windup = 0, body.meleeWind = 0;
      return;
    }
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.windup > 0) {
      this.windup = Math.max(0, this.windup - dt);
      body.meleeWind = this.windup > 0 ? 1 - this.windup / MELEE_CFG.windup : 0;
      if (this.windup === 0) {
        this.cooldown = MELEE_CFG.cooldown;
        body.strikeTime = 0.18;
        body.recoverTime = 0.5;
        if (this.inReach(player, MELEE_CFG.reach * 1.2)) this.strike(player);
      }
      return;
    }
    if (this.cooldown > 0 || !this.inReach(player, MELEE_CFG.reach)) return;
    this.windup = MELEE_CFG.windup, body.meleeWind = 0.001;
    const t = body.torsoPosition();
    this.hooks.effects?.ring?.(t.x, t.y, '#ff8a1f', 10);
  }
  strike(player) {
    const from = this.body.torsoPosition(), to = player.torsoPosition();
    const dir = Math.sign(to.x - from.x) || this.body.facing || 1;
    this.hooks.combat?.damage?.(player, MELEE_CFG.damage, 'torso', to, { text: true, flash: true });
    player.knock(dir, 0.05, MELEE_CFG.shoveImpulse, to.y);
    this.hooks.effects?.ring?.(to.x, to.y, '#ff8a1f', 12);
    this.hooks.sound?.('impact', { x: to.x });
  }
}

export function configureBrawler(game, enemy, sound) {
  enemy.isBrawler = true;
  enemy.weaponId = null;
  enemy.maxHp = Math.round(enemy.maxHp * MELEE_CFG.hpMul);
  enemy.hp = enemy.maxHp;
  enemy.speedMul = brawlerSpeedMul(game.rng);
  const walker = game.walkers.get(enemy), ai = game.ais.get(enemy);
  walker.melee = true, walker.hold = 0, walker.hopRange = MELEE_CFG.hopRange;
  ai.melee = true, ai.weapon = null;
  enemy.meleeAttack = new MeleeAttack(enemy, { combat: game.combat, effects: game.effects, sound });
  return enemy;
}

const BRAWL_TAU = Math.PI * 2;
const BRAWL_PAL = Object.freeze({
  carapace: '#5a2619',
  plate: '#7d3620',
  rim: '#ffb14a',
  eye: '#ffd23f',
  eyeHot: '#ff8a1f',
  club: '#3c1a12',
  spike: '#e9d9b8',
  outline: '#14101f',
  flash: '#ffffff',
});

function brawlClamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function brawlLerp(a, b, t) { return a + (b - a) * t; }
function brawlWrap(a) { while (a > Math.PI) a -= BRAWL_TAU; while (a < -Math.PI) a += BRAWL_TAU; return a; }

function brawlPart(e, name, alpha) {
  const p = e && e.parts && e.parts.get(name);
  if (!p || !p.body) return null;
  const b = p.body;
  const bx = b.getPosition().x, by = b.getPosition().y, ba = b.getAngle();
  const px = Number.isFinite(p.prevX) ? p.prevX : bx;
  const py = Number.isFinite(p.prevY) ? p.prevY : by;
  const pa = Number.isFinite(p.prevA) ? p.prevA : ba;
  return { x: brawlLerp(px, bx, alpha), y: brawlLerp(py, by, alpha), a: pa + brawlWrap(ba - pa) * alpha };
}

function brawlTorso(e, alpha) {
  const t = brawlPart(e, 'torso', alpha);
  if (t) return t;
  if (e && typeof e.torsoPosition === 'function') {
    const p = e.torsoPosition();
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return { x: p.x, y: p.y, a: 0 };
  }
  return null;
}

function brawlToLocal(torso, wx, wy) {
  const dx = wx - torso.x, dy = wy - torso.y;
  const c = Math.cos(-torso.a), s = Math.sin(-torso.a);
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}

function brawlFlash(e) {
  if (typeof e.flash === 'number' && e.flash > 0) return true;
  if (e && e.parts) {
    const t = e.parts.get('torso'), h = e.parts.get('head');
    if ((t && t.flash > 0) || (h && h.flash > 0)) return true;
  }
  return false;
}

function brawlGroundY(e, torso) {
  if (Number.isFinite(e.groundY)) return e.groundY;
  return torso.y - 1.0;
}

function brawlTelegraph(ctx, e, torso, facing, wind) {
  const gy = brawlGroundY(e, torso);
  const dir = facing >= 0 ? 0 : Math.PI;
  const a0 = dir - 0.6981317, a1 = dir + 0.6981317;
  const r = MELEE_CFG.reach;
  const alpha = 0.15 + 0.5 * wind;
  ctx.save();
  ctx.translate(torso.x, gy);
  ctx.scale(1, 0.34);
  ctx.fillStyle = `rgba(255,138,31,${alpha.toFixed(3)})`;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r, a0, a1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = `rgba(255,138,31,${(alpha + 0.2).toFixed(3)})`;
  ctx.lineWidth = 0.05;
  ctx.beginPath();
  ctx.arc(0, 0, r, a0, a1);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.55, a0, a1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(Math.cos(a0) * r * 0.62, Math.sin(a0) * r * 0.62);
  ctx.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
  ctx.moveTo(Math.cos(a1) * r * 0.62, Math.sin(a1) * r * 0.62);
  ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(Math.cos(dir) * r * 0.3, Math.sin(dir) * r * 0.3);
  ctx.lineTo(Math.cos(dir) * r, Math.sin(dir) * r);
  ctx.stroke();
  ctx.restore();
}

function brawlArm(ctx, sx, sy, ang, len, clubR, pal) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const cx = sx + dx * len, cy = sy + dy * len;
  ctx.strokeStyle = pal.carapace;
  ctx.lineWidth = 0.22;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(cx - dx * clubR * 0.6, cy - dy * clubR * 0.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, clubR, 0, BRAWL_TAU);
  ctx.fillStyle = pal.club;
  ctx.fill();
  ctx.strokeStyle = pal.outline;
  ctx.lineWidth = 0.04;
  ctx.stroke();
  ctx.fillStyle = pal.spike;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const sa = ang + i * (BRAWL_TAU / 3) + 0.35;
    const ca = Math.cos(sa), sna = Math.sin(sa);
    const px = -sna * 0.07, py = ca * 0.07;
    const bx = cx + ca * clubR * 0.82, by = cy + sna * clubR * 0.82;
    const tx = cx + ca * (clubR + 0.14), ty = cy + sna * (clubR + 0.14);
    ctx.moveTo(bx + px, by + py);
    ctx.lineTo(tx, ty);
    ctx.lineTo(bx - px, by - py);
  }
  ctx.fill();
}

export function drawBrawler(ctx, e, alpha = 1, time = 0) {
  if (!ctx || !e) return;
  if (e.state === 'dead' && !(e.corpseTimer > 0)) return;
  const fade = e.state === 'dead' ? brawlClamp01(e.corpseTimer / 1.2) : 1;
  const torso = brawlTorso(e, alpha);
  if (!torso) return;
  const facing = (e.facing || 1) >= 0 ? 1 : -1;
  const flash = brawlFlash(e);
  const pal = {
    carapace: flash ? BRAWL_PAL.flash : BRAWL_PAL.carapace,
    plate: flash ? BRAWL_PAL.flash : BRAWL_PAL.plate,
    rim: flash ? BRAWL_PAL.flash : BRAWL_PAL.rim,
    club: flash ? BRAWL_PAL.flash : BRAWL_PAL.club,
    spike: flash ? BRAWL_PAL.flash : BRAWL_PAL.spike,
    outline: flash ? BRAWL_PAL.flash : BRAWL_PAL.outline,
  };
  const wind = brawlClamp01(e.meleeWind || 0);
  const eye = flash ? BRAWL_PAL.flash : (wind > 0 ? BRAWL_PAL.eyeHot : BRAWL_PAL.eye);

  ctx.save();
  ctx.globalAlpha = fade;

  if (wind > 0) brawlTelegraph(ctx, e, torso, facing, wind);

  const HANG = -1.32, RAISE = 2.618, DOWN = -0.524;
  const swing = 0.25 * Math.sin(time * 9 + (e.id || 0));
  let ang;
  if (wind > 0) ang = brawlLerp(HANG + swing, RAISE, wind);
  else if (e.strikeTime > 0) ang = brawlLerp(RAISE, DOWN, 1 - brawlClamp01(e.strikeTime / 0.18));
  else if (e.recoverTime > 0) ang = brawlLerp(DOWN, HANG + swing, 1 - brawlClamp01(e.recoverTime / 0.5));
  else ang = HANG + swing;

  ctx.save();
  ctx.translate(torso.x, torso.y);
  ctx.rotate(torso.a);
  ctx.scale(facing, 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const footL = brawlPart(e, 'footL', alpha), footR = brawlPart(e, 'footR', alpha);
  const legs = [{ hip: -0.18, foot: footL }, { hip: 0.18, foot: footR }];
  for (const leg of legs) {
    const hipX = leg.hip, hipY = -0.34;
    let fx = leg.hip + 0.10, fy = -0.72;
    if (leg.foot) { const p = brawlToLocal(torso, leg.foot.x, leg.foot.y); fx = p.x; fy = p.y; }
    const kneeX = fx - 0.14, kneeY = (hipY + fy) * 0.5 + 0.06;
    ctx.strokeStyle = pal.carapace;
    ctx.lineWidth = 0.16;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(kneeX, kneeY);
    ctx.moveTo(kneeX, kneeY);
    ctx.lineTo(fx, fy + 0.05);
    ctx.stroke();
    ctx.lineWidth = 0.13;
    ctx.beginPath();
    ctx.moveTo(fx - 0.14, fy);
    ctx.lineTo(fx + 0.14, fy);
    ctx.stroke();
  }

  brawlArm(ctx, -0.08, 0.08, ang, 0.78, 0.30, pal);

  ctx.fillStyle = pal.carapace;
  ctx.strokeStyle = pal.outline;
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  ctx.moveTo(-0.47, -0.34);
  ctx.quadraticCurveTo(-0.52, 0.06, -0.30, 0.32);
  ctx.quadraticCurveTo(0.00, 0.46, 0.30, 0.32);
  ctx.quadraticCurveTo(0.52, 0.06, 0.44, -0.30);
  ctx.quadraticCurveTo(0.10, -0.42, -0.22, -0.38);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = pal.plate;
  ctx.lineWidth = 0.10;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const px = -0.34 + i * 0.15;
    ctx.moveTo(px, 0.28 - i * 0.02);
    ctx.quadraticCurveTo(px + 0.18, 0.02, px + 0.02, -0.24);
  }
  ctx.stroke();

  ctx.strokeStyle = pal.spike;
  ctx.lineWidth = 0.06;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const bx = -0.28 + i * 0.19;
    ctx.moveTo(bx, 0.33);
    ctx.lineTo(bx + 0.03, 0.48);
  }
  ctx.stroke();

  ctx.strokeStyle = pal.rim;
  ctx.lineWidth = 0.045;
  ctx.beginPath();
  ctx.moveTo(-0.40, 0.30);
  ctx.quadraticCurveTo(0.0, 0.48, 0.40, 0.30);
  ctx.stroke();

  const head = brawlPart(e, 'head', alpha);
  const h = head ? brawlToLocal(torso, head.x, head.y) : { x: 0.16, y: 0.24 };
  ctx.fillStyle = pal.carapace;
  ctx.strokeStyle = pal.outline;
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  ctx.ellipse(h.x, h.y, 0.24, 0.18, 0, 0, BRAWL_TAU);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = eye;
  ctx.beginPath();
  ctx.rect(h.x - 0.16, h.y + 0.02, 0.32, 0.06);
  ctx.fill();

  ctx.fillStyle = pal.plate;
  ctx.beginPath();
  ctx.moveTo(h.x - 0.15, h.y - 0.09);
  ctx.lineTo(h.x + 0.15, h.y - 0.09);
  ctx.lineTo(h.x + 0.11, h.y - 0.21);
  ctx.lineTo(h.x - 0.11, h.y - 0.21);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = pal.spike;
  ctx.beginPath();
  ctx.moveTo(h.x - 0.13, h.y - 0.08);
  ctx.lineTo(h.x - 0.11, h.y + 0.05);
  ctx.lineTo(h.x - 0.08, h.y - 0.08);
  ctx.moveTo(h.x + 0.08, h.y - 0.08);
  ctx.lineTo(h.x + 0.11, h.y + 0.05);
  ctx.lineTo(h.x + 0.13, h.y - 0.08);
  ctx.fill();

  brawlArm(ctx, 0.26, 0.12, ang, 0.78, 0.30, pal);
  if (e.strikeTime > 0) {
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = fade * (0.34 - i * 0.1);
      ctx.strokeStyle = pal.rim;
      ctx.lineWidth = 0.055;
      ctx.beginPath();
      ctx.arc(0.26, 0.12, 0.78, ang + 0.10 + i * 0.14, ang + 0.46 + i * 0.14);
      ctx.stroke();
    }
    ctx.globalAlpha = fade;
  }

  ctx.restore();
  ctx.restore();
}
