const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function updateHound(system, f, dt, ctx) {
  const cfg = f.def;
  const body = f.body;
  const player = ctx.player;
  if (!body || !cfg || !player || !player.torsoPosition) return;

  const p = body.getPosition();
  const v = body.getLinearVelocity();
  const t = player.torsoPosition();
  const dx = t.x - p.x;
  const dy = t.y - p.y;
  const dist = Math.hypot(dx, dy) || 1;
  const dirX = dx / dist;

  if (!Number.isFinite(f.leapCooldown)) f.leapCooldown = 0;
  if (!Number.isFinite(f.biteCooldown)) f.biteCooldown = 0;
  if (!Number.isFinite(f.backOffTime)) f.backOffTime = 0;
  f.leapCooldown = Math.max(0, f.leapCooldown - dt);
  f.biteCooldown = Math.max(0, f.biteCooldown - dt);
  f.backOffTime = Math.max(0, f.backOffTime - dt);
  if (f.state !== 'leap') f.state = 'run';
  if (dx !== 0) f.facing = dx > 0 ? 1 : -1;
  body.setAngularVelocity(0);

  const groundY = ctx.arena && ctx.arena.surfaceY ? ctx.arena.surfaceY(p.x) : 0;
  const footY = groundY + f.radius;
  const sinking = footY - p.y;
  if (sinking > 0.01) {
    const lift = Math.min(sinking * 60 - Math.min(v.y, 0) * 9, 40);
    if (lift > 0) body.applyForceToCenter({ x: 0, y: lift * f.mass }, true);
  }
  const onGround = p.y <= footY + 0.06 && v.y <= 1.2;

  const items = system.items || [];
  const gap = cfg.separation || 0.5;
  for (let i = 0; i < items.length; i++) {
    const other = items[i];
    if (other === f || !other.alive || other.type !== 'hound' || !other.body) continue;
    const op = other.body.getPosition();
    let ox = p.x - op.x;
    const oy = p.y - op.y;
    const od = Math.hypot(ox, oy);
    if (od >= gap) continue;
    if (od < 1e-4) ox = i % 2 ? 0.001 : -0.001;
    const push = (1 - Math.min(od, gap) / gap) * cfg.accel * 0.8;
    body.applyForceToCenter({ x: Math.sign(ox) * push * f.mass, y: 0 }, true);
  }

  const targetVx = f.backOffTime > 0 ? -dirX * cfg.runSpeed * 0.7 : dirX * cfg.runSpeed;
  const maxAccel = cfg.accel * 1.5;
  const forceX = clamp((targetVx - v.x) * cfg.accel, -maxAccel, maxAccel) * f.mass;
  body.applyForceToCenter({ x: forceX, y: 0 }, true);

  if (f.state === 'leap') {
    f.stateTime += dt;
    if (onGround && f.stateTime > 0.2) {
      f.state = 'run';
      f.stateTime = 0;
    }
  } else if (onGround && f.backOffTime <= 0 && f.leapCooldown <= 0 && dist < cfg.leapRange && dist > 0.8) {
    const leapVx = clamp(dirX * cfg.leapSpeed, -cfg.leapSpeed, cfg.leapSpeed);
    const leapVy = cfg.leapUp || cfg.leapSpeed * 0.7;
    body.applyLinearImpulse({ x: (leapVx - v.x) * f.mass, y: (leapVy - v.y) * f.mass }, body.getWorldCenter(), true);
    f.leapCooldown = cfg.leapCooldown;
    f.state = 'leap';
    f.stateTime = 0;
  }

  if (player.alive && dist < f.radius + (cfg.biteRange || 0.7) && f.biteCooldown <= 0) {
    f.biteCooldown = cfg.biteCooldown;
    system.stats.playerHits++;
    system.emit('playerHit', { x: p.x, y: p.y }, cfg.biteDamage, f);
    const fx = system.hooks.effects;
    if (fx && fx.splatter) fx.splatter(p.x, p.y, cfg.color, 6, 2.4);
    system.sfx('hurtPlayer');
    if (player.knock) player.knock(dirX, 0.05, cfg.shove, t.y);
    f.backOffTime = cfg.backOff || 0.5;
  }

  const cur = body.getLinearVelocity();
  const cap = cfg.runSpeed * 1.5;
  if (Math.abs(cur.x) > cap) body.setLinearVelocity({ x: clamp(cur.x, -cap, cap), y: cur.y });
}

export function drawHound(ctx, f, r, flap, time, flash) {
  const cfg = f.def || {};
  const base = flash > 0 ? '#ffffff' : cfg.color || '#b7d84a';
  const glow = flash > 0 ? '#ffffff' : cfg.glow || '#f3ff9a';
  const body = f.body;
  const vx = body && body.getLinearVelocity ? body.getLinearVelocity().x : 0;
  const dir = vx < -0.05 ? -1 : 1;
  const phase = Number.isFinite(f.phase) ? f.phase : 0;
  const gait = Number.isFinite(flap) ? clamp(flap, -1, 1) : Math.sin(phase);
  const leap = f.state === 'leap';
  const cy = leap ? -r * 0.16 : 0;
  const lift = leap ? r * 0.12 : 0;
  const tau = Math.PI * 2;

  ctx.save();
  ctx.scale(dir, 1);

  ctx.strokeStyle = flash > 0 ? '#ffffff' : '#4d5f24';
  ctx.lineWidth = r * 0.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-r * 0.95, cy);
  ctx.lineTo(-r * 1.5, cy - r * 0.28 + gait * r * 0.22);
  ctx.lineTo(-r * 1.85, cy - r * 0.6 + gait * r * 0.4);
  ctx.stroke();

  ctx.strokeStyle = flash > 0 ? '#ffffff' : '#2d3a17';
  ctx.lineWidth = r * 0.15;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const lx = (i < 2 ? -0.65 : 0.25) * r + (i % 2) * 0.4 * r;
    const swing = Math.sin(phase + i * Math.PI * 0.8) * r * 0.26;
    ctx.moveTo(lx, cy - r * 0.1);
    ctx.lineTo(lx + swing, cy + r * 0.34 + lift);
    ctx.lineTo(lx + swing * 0.4, cy + r * 0.86 + lift - Math.max(0, swing) * 0.35);
  }
  ctx.stroke();

  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.ellipse(0, cy, r * 1.08, r * 0.44, 0, 0, tau);
  ctx.fill();

  ctx.fillStyle = flash > 0 ? '#ffffff' : '#39471e';
  ctx.beginPath();
  ctx.ellipse(r * 0.05, cy - r * 0.22, r * 0.84, r * 0.24, 0, 0, tau);
  ctx.fill();

  ctx.strokeStyle = glow;
  ctx.lineWidth = r * 0.1;
  ctx.beginPath();
  ctx.moveTo(-r * 0.78, cy + r * 0.34);
  ctx.lineTo(-r * 0.3, cy + r * 0.46);
  ctx.lineTo(r * 0.3, cy + r * 0.45);
  ctx.lineTo(r * 0.72, cy + r * 0.3);
  ctx.stroke();

  ctx.strokeStyle = flash > 0 ? '#ffffff' : '#6f8a2e';
  ctx.lineWidth = r * 0.11;
  ctx.beginPath();
  ctx.moveTo(-r * 0.62, cy - r * 0.4);
  ctx.lineTo(-r * 0.42, cy - r * (0.78 + 0.08 * gait));
  ctx.lineTo(-r * 0.24, cy - r * 0.42);
  ctx.lineTo(-r * 0.04, cy - r * (0.82 + 0.08 * gait));
  ctx.lineTo(r * 0.16, cy - r * 0.42);
  ctx.lineTo(r * 0.36, cy - r * (0.75 + 0.08 * gait));
  ctx.stroke();

  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.ellipse(r * 0.98, cy + lift, r * 0.46, r * 0.37, 0, 0, tau);
  ctx.fill();

  const jawDrop = leap ? r * 0.34 : r * 0.08 + Math.max(0, gait) * r * 0.06;
  ctx.strokeStyle = flash > 0 ? '#ffffff' : '#202a12';
  ctx.lineWidth = r * 0.14;
  ctx.beginPath();
  ctx.moveTo(r * 1.18, cy - r * 0.12 + lift);
  ctx.lineTo(r * 1.55, cy - r * 0.06 + lift);
  ctx.moveTo(r * 1.16, cy + r * 0.08 + lift);
  ctx.lineTo(r * 1.5, cy + r * 0.08 + jawDrop + lift);
  ctx.stroke();

  ctx.strokeStyle = flash > 0 ? '#ffffff' : '#f6f1d0';
  ctx.lineWidth = r * 0.05;
  ctx.beginPath();
  ctx.moveTo(r * 1.34, cy + r * 0.02 + lift);
  ctx.lineTo(r * 1.36, cy + r * 0.16 + lift);
  ctx.moveTo(r * 1.46, cy + r * 0.03 + lift);
  ctx.lineTo(r * 1.48, cy + r * 0.17 + lift);
  ctx.stroke();

  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(r * 1.08, cy + r * 0.14 + lift, r * 0.12, 0, tau);
  ctx.fill();
  ctx.fillStyle = flash > 0 ? '#ffffff' : '#101708';
  ctx.beginPath();
  ctx.arc(r * 1.12, cy + r * 0.14 + lift, r * 0.05, 0, tau);
  ctx.fill();

  ctx.restore();
}
