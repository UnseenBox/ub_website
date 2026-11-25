// SLIPSHOT - XP and level-up module for Endless mode (task 7d). Pure logic, no imports, injected rng.

export const LEVELUP_CFG = {
  maxLevel: 5,
  offers: 3,
  xpBase: 30,
  xpLinear: 22,
  xpQuad: 3,
  walkerXp: 10,
  walkerXpPerLevel: 2,
  dropperXp: 14,
  dropperXpPerLevel: 2,
  bossXp: 150,
  bossXpPerTier: 60,
  freshWeight: 1.4,
  usedWeight: 1.0,
  maxXpGain: 1e9,
  maxPlayerLevel: 10000,
  healFraction: 0.5,
  coinBonus: 60,
  lifestealCap: 0.25,
  extraShotDamageMul: 0.6,
  powerPerLevel: 0.16,
  splatPerLevel: 0.30,
  reloadPerLevel: 0.92,
  armorPerLevel: 0.92,
  maxHpPerLevel: 20,
  bigSizePerLevel: 0.18,
  bigDamagePerLevel: 0.06,
  leechPerLevel: 0.05,
  leechKillHealPerLevel: 2,
  critChancePerLevel: 0.08,
  critMulBase: 2,
  critMulPerLevel: 0.1,
  swiftMovePerLevel: 0.07,
  swiftJumpPerLevel: 0.94,
  tentacleShotDamageMul: 0.55,
  extraHandDamageMul: [0.7, 1.0],
  ricochetDamagePerBounce: 0.08,
  regenPerSecPerLevel: 0.6,
  igniteBaseChance: 0.12,
  ignitePerLevel: 0.08,
  igniteMaxChance: 0.52,
  frostBaseChance: 0.12,
  frostPerLevel: 0.08,
  frostMaxChance: 0.52,
  shockBaseChance: 0.10,
  shockPerLevel: 0.07,
  shockMaxChance: 0.45,
};

const C = LEVELUP_CFG;

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function posInt(v, fallback = 1) {
  const n = typeof v === 'number' ? Math.floor(v) : NaN;
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

function defLevel(l) {
  const n = typeof l === 'number' ? Math.floor(l) : NaN;
  return Number.isFinite(n) ? clamp(n, 0, C.maxLevel) : 0;
}

function finiteNum(v) { return typeof v === 'number' && Number.isFinite(v) ? v : NaN; }

export function xpToNext(level) {
  const k = posInt(level) - 1;
  return Math.round(C.xpBase + C.xpLinear * k + C.xpQuad * k * k);
}

export function xpForKill({ kind = 'walker', level = 1, boss = false, tier = 1 } = {}) {
  if (boss) return C.bossXp + C.bossXpPerTier * posInt(tier);
  const lv = posInt(level);
  return kind === 'dropper'
    ? C.dropperXp + C.dropperXpPerLevel * lv
    : C.walkerXp + C.walkerXpPerLevel * lv;
}

function def(id, name, existing, glyph, color, blurb, text, maxLevel) {
  return {
    id, name, blurb, glyph, color, existing, maxLevel: maxLevel ?? C.maxLevel,
    levelText(level) {
      const L = defLevel(level);
      return L === 0 ? 'Not taken' : text(L);
    },
  };
}

const pct = (x) => Math.round(x * 100);

export const UPGRADE_DEFS = [
  def('power', 'Launch Power', true, 'P', '#ff5252',
    '+16% launch speed per level',
    (L) => `+${pct(C.powerPerLevel * L)}% launch speed`),
  def('splat', 'Splat Radius', true, 'S', '#ff9f43',
    '+30% splat radius per level',
    (L) => `+${pct(C.splatPerLevel * L)}% splat radius`),
  def('reload', 'Quick Reload', true, 'R', '#ffd32a',
    'Cooldowns x0.92 per level',
    (L) => `Cooldowns x${Math.pow(C.reloadPerLevel, L).toFixed(3)}`),
  def('armor', 'Armor', true, 'A', '#54a0ff',
    'Damage taken x0.92 per level',
    (L) => `Damage taken x${Math.pow(C.armorPerLevel, L).toFixed(3)}`),
  def('maxHp', 'Max Health', true, 'H', '#2ed573',
    '+20 max HP per level',
    (L) => `+${C.maxHpPerLevel * L} max HP`),
  def('big', 'Big Blobs', false, 'B', '#ff6348',
    '+18% projectile size and +6% damage per level',
    (L) => `+${pct(C.bigSizePerLevel * L)}% size, +${pct(C.bigDamagePerLevel * L)}% damage`),
  def('multi', 'Twin Shot', false, 'M', '#e84393',
    'Extra blobs at levels 1/3/5, each at 60% damage',
    (L) => {
      const n = Math.ceil(L / 2);
      return `${n} extra blob${n === 1 ? '' : 's'} at ${pct(C.extraShotDamageMul)}% damage`;
    }),
  def('leech', 'Vampiric Slime', false, 'L', '#7bed9f',
    '+5% lifesteal (cap 25%) and +2 HP per kill, per level',
    (L) => `${pct(Math.min(C.lifestealCap, C.leechPerLevel * L))}% lifesteal, +${C.leechKillHealPerLevel * L} HP per kill`),
  def('crit', 'Lucky Splat', false, 'C', '#a55eea',
    '+8% crit chance and +0.1x crit damage per level',
    (L) => `${pct(C.critChancePerLevel * L)}% crit chance, x${(C.critMulBase + C.critMulPerLevel * L).toFixed(1)} crit damage`),
  def('swift', 'Swift Slime', false, '>', '#00d2d3',
    '+7% move speed, jump stamina x0.94 per level',
    (L) => `+${pct(C.swiftMovePerLevel * L)}% move speed, jump stamina x${Math.pow(C.swiftJumpPerLevel, L).toFixed(3)}`),
  def('ignite', 'Ignite', false, 'F', '#ff7a1a',
    '+12% ignite chance, +8%/lvl (max 52%), burn 3.5s, spreads',
    (L) => `${pct(Math.min(C.igniteMaxChance, C.igniteBaseChance + C.ignitePerLevel * L))}% ignite chance`),
  def('frost', 'Chill', false, 'I', '#7fd8ff',
    '+12% chill chance, +8%/lvl (max 52%), halves speed, freeze on crit',
    (L) => `${pct(Math.min(C.frostMaxChance, C.frostBaseChance + C.frostPerLevel * L))}% chill chance`),
  def('shock', 'Arc', false, 'Z', '#ffe066',
    '+10% shock chance, +7%/lvl (max 45%), chains to nearby',
    (L) => `${pct(Math.min(C.shockMaxChance, C.shockBaseChance + C.shockPerLevel * L))}% shock chance`),
  def('tentacleVolley', 'Tentacle Volley', false, 'V', '#ff6b6b',
    '+1 slime ball from tentacle tip per level, 55% damage',
    (L) => `+${L} tentacle shot${L === 1 ? '' : 's'} at ${pct(C.tentacleShotDamageMul)}% damage`),
  def('extraHand', 'Extra Hand', false, 'X', '#ff9f1c',
    'Off-hand fires too: L1 70%, L2 100% damage',
    (L) => L === 1 ? 'Off-hand fires at 70% damage' : 'Off-hand fires at 100% damage', 2),
  def('ricochet', 'Ricochet', false, 'Q', '#00ff88',
    '+1 bounce per level, +8% damage per bounce',
    (L) => `+${L} bounce${L === 1 ? '' : 's'}, +${pct(C.ricochetDamagePerBounce * L)}% dmg per bounce`),
  def('regen', 'Regeneration', false, 'G', '#88ff00',
    '+0.6 HP/s per level, only out of combat 2s',
    (L) => `+${(C.regenPerSecPerLevel * L).toFixed(1)} HP/s out of combat`),
];

const DEF_BY_ID = Object.fromEntries(UPGRADE_DEFS.map((d) => [d.id, d]));

function fallbackCards() {
  return [
    { id: 'heal', name: 'Slime Mend', blurb: `Restore ${pct(C.healFraction)}% of max HP`, glyph: '+', color: '#2ed573', nextLevel: 0, existing: false },
    { id: 'coins', name: 'Coin Cache', blurb: `+${C.coinBonus} coins`, glyph: '$', color: '#ffd32a', nextLevel: 0, existing: false },
  ];
}

function cardFromDef(d, nextLevel) {
  return { id: d.id, name: d.name, blurb: d.blurb, glyph: d.glyph, color: d.color, nextLevel, existing: d.existing };
}

export class LevelUp {
  constructor(rng = Math.random) {
    this.rng = typeof rng === 'function' ? rng : Math.random;
    this.reset();
  }

  reset() {
    this._level = 1;
    this._xp = 0;
    this._pending = 0;
    this.levels = {};
    for (const d of UPGRADE_DEFS) this.levels[d.id] = 0;
    this.fallbacks = { heal: 0, coins: 0 };
  }

  get pending() { return this._pending; }
  get level() { return this._level; }
  get xp() { return this._xp; }
  get xpNeeded() { return xpToNext(this._level); }
  get fraction() { return clamp(this._xp / this.xpNeeded, 0, 1); }

  addXp(n) {
    if (typeof n === 'number' && Number.isFinite(n) && n > 0) {
      this._xp += Math.min(n, C.maxXpGain);
      let gained = 0;
      let need = this.xpNeeded;
      while (this._xp >= need) {
        this._xp -= need;
        this._level++;
        gained++;
        need = xpToNext(this._level);
      }
      this._pending += gained;
      return { gained, level: this._level, xp: this._xp, xpNeeded: need };
    }
    return { gained: 0, level: this._level, xp: this._xp, xpNeeded: this.xpNeeded };
  }

  offer(count = C.offers) {
    const want = Math.max(0, Math.floor(typeof count === 'number' && Number.isFinite(count) ? count : 0));
    const pool = UPGRADE_DEFS.filter((d) => this.levels[d.id] < d.maxLevel);
    if (pool.length === 0) return fallbackCards();
    const remaining = pool.slice();
    const cards = [];
    const n = Math.min(want, remaining.length);
    const newTypeIds = ['ignite', 'frost', 'shock', 'tentacleVolley', 'extraHand'];
    const hasAnyNewType = newTypeIds.some((id) => this.levels[id] > 0);
    for (let i = 0; i < n; i++) {
      let total = 0;
      for (const d of remaining) {
        let w = this.levels[d.id] === 0 ? C.freshWeight : C.usedWeight;
        if (!hasAnyNewType && newTypeIds.includes(d.id)) w *= 1.5;
        total += w;
      }
      let r = this.rng() * total;
      let idx = remaining.length - 1;
      for (let j = 0; j < remaining.length; j++) {
        const d = remaining[j];
        let w = this.levels[d.id] === 0 ? C.freshWeight : C.usedWeight;
        if (!hasAnyNewType && newTypeIds.includes(d.id)) w *= 1.5;
        r -= w;
        if (r < 0) { idx = j; break; }
      }
      const d = remaining.splice(idx, 1)[0];
      cards.push(cardFromDef(d, this.levels[d.id] + 1));
    }
    return cards;
  }

  pick(id) {
    if (id === 'heal' || id === 'coins') {
      this._pending = Math.max(0, this._pending - 1);
      this.fallbacks[id]++;
      return id;
    }
    const d = DEF_BY_ID[id];
    if (!d || this.levels[id] >= d.maxLevel) return null;
    this.levels[id]++;
    this._pending = Math.max(0, this._pending - 1);
    return this.levels[id];
  }

  stats() {
    const lv = (id) => this.levels[id] || 0;
    return {
      shotSpeedMul: 1 + C.powerPerLevel * lv('power'),
      splatMul: 1 + C.splatPerLevel * lv('splat'),
      cooldownMul: Math.pow(C.reloadPerLevel, lv('reload')),
      damageTakenMul: Math.pow(C.armorPerLevel, lv('armor')),
      maxHpBonus: C.maxHpPerLevel * lv('maxHp'),
      projectileSizeMul: 1 + C.bigSizePerLevel * lv('big'),
      damageMul: 1 + C.bigDamagePerLevel * lv('big'),
      extraShots: Math.ceil(lv('multi') / 2),
      extraShotDamageMul: C.extraShotDamageMul,
      lifesteal: Math.min(C.lifestealCap, C.leechPerLevel * lv('leech')),
      healOnKill: C.leechKillHealPerLevel * lv('leech'),
      critChance: C.critChancePerLevel * lv('crit'),
      critMul: C.critMulBase + C.critMulPerLevel * lv('crit'),
      moveSpeedMul: 1 + C.swiftMovePerLevel * lv('swift'),
      jumpStaminaMul: Math.pow(C.swiftJumpPerLevel, lv('swift')),
      igniteChance: lv('ignite'),
      frostChance: lv('frost'),
      shockChance: lv('shock'),
      tentacleShots: lv('tentacleVolley'),
      extraHandLevel: lv('extraHand'),
      bonusBounces: lv('ricochet'),
      regenPerSec: C.regenPerSecPerLevel * lv('regen'),
      tentacleShotDamageMul: C.tentacleShotDamageMul,
      extraHandDamageMul: C.extraHandDamageMul[lv('extraHand') - 1] ?? 0,
      ricochetDamagePerBounce: C.ricochetDamagePerBounce,
    };
  }

  toJSON() {
    return {
      v: 1,
      level: this._level,
      xp: this._xp,
      pending: this._pending,
      levels: { ...this.levels },
      fallbacks: { ...this.fallbacks },
    };
  }

  static fromJSON(obj, rng = Math.random) {
    const lu = new LevelUp(rng);
    if (!obj || typeof obj !== 'object') return lu;
    lu._level = clamp(posInt(obj.level, 1), 1, C.maxPlayerLevel);
    const xp = finiteNum(obj.xp);
    lu._xp = Number.isFinite(xp) && xp > 0 ? Math.min(xp, C.maxXpGain) : 0;
    const pend = finiteNum(obj.pending);
    lu._pending = Number.isFinite(pend) && pend > 0 ? Math.floor(pend) : 0;
    if (obj.levels && typeof obj.levels === 'object') {
      for (const d of UPGRADE_DEFS) {
        const v = finiteNum(obj.levels[d.id]);
        lu.levels[d.id] = Number.isFinite(v) ? clamp(Math.floor(v), 0, d.maxLevel) : 0;
      }
    }
    if (obj.fallbacks && typeof obj.fallbacks === 'object') {
      for (const k of ['heal', 'coins']) {
        const v = finiteNum(obj.fallbacks[k]);
        lu.fallbacks[k] = Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
      }
    }
    let need = lu.xpNeeded;
    while (lu._xp >= need) {
      lu._xp -= need;
      lu._level++;
      lu._pending++;
      need = lu.xpNeeded;
    }
    return lu;
  }
}
