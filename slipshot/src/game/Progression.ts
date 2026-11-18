import { COMBAT, SLIME } from '../config';
import {
  REPAIR_KIT,
  UPGRADE_LEVEL_CAP,
  WEAPONS,
  upgradePrice,
  upgradeById,
  weaponById,
  type UpgradeId,
  type WeaponDef,
  type WeaponId,
} from './catalog';
import {
  FORTRESS_ITEMS,
  FORTRESS_ITEM_IDS,
  fortressItem,
  isFortressItemId,
  type FortressItemId,
  type PlacedPiece,
} from './fortressItems';

const STORAGE_KEY = 'slipshot.profile.v1';
const START_COINS = 200;
const STARTER_WEAPON: WeaponId = 'hands';

interface FortressSave {
  unlocked: FortressItemId[];
  /** Pieces bought but not placed. */
  inventory: Record<FortressItemId, number>;
  /** Pieces standing in the fortress. */
  layout: PlacedPiece[];
}

interface ProfileData {
  coins: number;
  owned: WeaponId[];
  equipped: WeaponId;
  levels: Record<UpgradeId, number>;
  fortress: FortressSave;
  /** Old saves: the stacked tower's block tiers. Converted to bricks on load. */
  tower?: unknown[];
}

const UPGRADE_IDS: UpgradeId[] = ['power', 'splat', 'duration', 'maxHp', 'armor', 'reload', 'grip', 'iron', 'bounty'];

function emptyLevels(): Record<UpgradeId, number> {
  return { power: 0, splat: 0, duration: 0, maxHp: 0, armor: 0, reload: 0, grip: 0, iron: 0, bounty: 0 };
}

function emptyInventory(): Record<FortressItemId, number> {
  const inv = {} as Record<FortressItemId, number>;
  for (const id of FORTRESS_ITEM_IDS) inv[id] = 0;
  return inv;
}

function freshFortress(): FortressSave {
  return {
    unlocked: FORTRESS_ITEMS.filter((d) => d.unlock === 0).map((d) => d.id),
    // A few bricks to start with, so the build mode is never empty on day one.
    inventory: { ...emptyInventory(), brick: 4 },
    layout: [],
  };
}

function freshProfile(): ProfileData {
  return {
    coins: START_COINS,
    owned: [STARTER_WEAPON],
    equipped: STARTER_WEAPON,
    levels: emptyLevels(),
    fortress: freshFortress(),
  };
}

function isPlacedPiece(v: unknown): v is PlacedPiece {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return (
    isFortressItemId(p.item) &&
    typeof p.x === 'number' &&
    Number.isFinite(p.x) &&
    typeof p.y === 'number' &&
    Number.isFinite(p.y) &&
    (p.rot === 0 || p.rot === 1)
  );
}

/** Read the saved profile. Anything malformed falls back to a fresh profile, field by field. */
function loadProfile(): ProfileData {
  const base = freshProfile();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const d = JSON.parse(raw) as Partial<ProfileData>;
    if (typeof d.coins === 'number' && d.coins >= 0) base.coins = Math.floor(d.coins);
    if (Array.isArray(d.owned)) {
      // Old saves own the slingshot; it no longer exists, so it simply drops out.
      const valid = d.owned.filter((id): id is WeaponId => WEAPONS.some((w) => w.id === id));
      base.owned = valid.includes(STARTER_WEAPON) ? valid : [STARTER_WEAPON, ...valid];
    }
    if (d.equipped && base.owned.includes(d.equipped)) base.equipped = d.equipped;
    if (d.levels) {
      for (const id of UPGRADE_IDS) {
        const v = d.levels[id];
        if (typeof v === 'number') base.levels[id] = Math.max(0, Math.min(UPGRADE_LEVEL_CAP, Math.floor(v)));
      }
    }
    const f = d.fortress;
    if (f && typeof f === 'object') {
      if (Array.isArray(f.unlocked)) {
        for (const id of f.unlocked) if (isFortressItemId(id) && !base.fortress.unlocked.includes(id)) base.fortress.unlocked.push(id);
      }
      if (f.inventory && typeof f.inventory === 'object') {
        for (const id of FORTRESS_ITEM_IDS) {
          const n = (f.inventory as Record<string, unknown>)[id];
          if (typeof n === 'number' && n >= 0) base.fortress.inventory[id] = Math.floor(n);
        }
      }
      if (Array.isArray(f.layout)) base.fortress.layout = f.layout.filter(isPlacedPiece);
    } else if (Array.isArray(d.tower)) {
      // The old stacked tower: every block becomes a brick in the inventory.
      base.fortress.inventory.brick += d.tower.length;
    }
  } catch {
    // Storage can be blocked or the JSON can be bad. Start fresh instead of crashing.
  }
  return base;
}

function saveProfile(d: ProfileData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  } catch {
    // Saving is a convenience. The game keeps running if it fails.
  }
}

/**
 * Coins, owned weapons, the equipped weapon, upgrade levels and the fortress
 * persist between runs. Wave, score and kills belong to a single run.
 */
export class Progression {
  coins: number;
  wave = 1;
  score = 0;
  kills = 0;
  readonly levels: Record<UpgradeId, number>;
  readonly owned: Set<WeaponId>;
  equipped: WeaponId;
  private fortress: FortressSave;

  constructor() {
    const p = loadProfile();
    this.coins = p.coins;
    this.levels = p.levels;
    this.owned = new Set(p.owned);
    this.equipped = p.equipped;
    this.fortress = p.fortress;
  }

  private save(): void {
    saveProfile({
      coins: this.coins,
      owned: [...this.owned],
      equipped: this.equipped,
      levels: { ...this.levels },
      fortress: {
        unlocked: [...this.fortress.unlocked],
        inventory: { ...this.fortress.inventory },
        layout: this.fortress.layout.map((p) => ({ ...p })),
      },
    });
  }

  get weapon(): WeaponDef {
    return weaponById(this.equipped);
  }

  // ---- Derived stats -------------------------------------------------------

  get launchMultiplier(): number {
    return 1 + 0.16 * this.levels.power;
  }

  get splatRadius(): number {
    return SLIME.splatBase * (1 + SLIME.splatPerLevel * this.levels.splat);
  }

  get coatDuration(): number {
    return SLIME.coatBase * (1 + SLIME.durationPerLevel * this.levels.duration);
  }

  get puddleLife(): number {
    return SLIME.puddleBase * (1 + SLIME.durationPerLevel * this.levels.duration);
  }

  /** Extra max health from Max Health upgrades. */
  get maxHpBonus(): number {
    return 20 * this.levels.maxHp;
  }

  /** Multiplier on damage the player takes. */
  get incomingMultiplier(): number {
    return 1 - 0.08 * this.levels.armor;
  }

  /** Multiplier on cooldowns. */
  get reloadMultiplier(): number {
    return 1 - 0.08 * this.levels.reload;
  }

  /** How much of the slime friction loss the player ignores (0..0.8). */
  get slipResist(): number {
    return Math.min(0.8, 0.16 * this.levels.grip);
  }

  /** Multiplier on stagger duration for the player. */
  get staggerMultiplier(): number {
    return 1 - 0.12 * this.levels.iron;
  }

  get bountyMultiplier(): number {
    return 1 + 0.25 * this.levels.bounty;
  }

  // ---- Waves and rewards ---------------------------------------------------

  /** Enemies in a wave: one, then ramping to three. */
  enemyCount(): number {
    return Math.min(1 + Math.floor((this.wave - 1) / 2), 3);
  }

  /** Enemies a wave sends in total. Each KO spawns the next one until this many have appeared. */
  waveQuota(): number {
    return 4 + 2 * this.wave;
  }

  enemyHp(): number {
    return COMBAT.enemyBaseHp + COMBAT.enemyHpPerWave * (this.wave - 1);
  }

  /** Score for a KO. */
  killScore(): number {
    return 100 + 20 * this.wave;
  }

  /** Coins for a KO. */
  killCoins(): number {
    return Math.round((25 + 5 * this.wave) * this.bountyMultiplier);
  }

  /** Coins for clearing the wave. */
  waveBonusCoins(): number {
    return Math.round((30 + 8 * this.wave) * this.bountyMultiplier);
  }

  earnCoins(amount: number): void {
    this.coins += amount;
    this.save();
  }

  // ---- Purchases -----------------------------------------------------------

  isOwned(id: WeaponId): boolean {
    return this.owned.has(id);
  }

  /** Buy a weapon if it is not owned and the player can pay. */
  buyWeapon(id: WeaponId): boolean {
    const def = weaponById(id);
    if (this.owned.has(id) || this.coins < def.price) return false;
    this.coins -= def.price;
    this.owned.add(id);
    this.save();
    return true;
  }

  equipWeapon(id: WeaponId): boolean {
    if (!this.owned.has(id)) return false;
    this.equipped = id;
    this.save();
    return true;
  }

  /** Switch to the next owned weapon in catalog order. */
  cycleWeapon(): WeaponId {
    const owned = WEAPONS.filter((w) => this.owned.has(w.id));
    const i = owned.findIndex((w) => w.id === this.equipped);
    this.equipped = owned[(i + 1) % owned.length].id;
    this.save();
    return this.equipped;
  }

  upgradeCost(id: UpgradeId): number {
    return upgradePrice(upgradeById(id), this.levels[id]);
  }

  canUpgrade(id: UpgradeId): boolean {
    return this.levels[id] < UPGRADE_LEVEL_CAP && this.coins >= this.upgradeCost(id);
  }

  buyUpgrade(id: UpgradeId): boolean {
    if (!this.canUpgrade(id)) return false;
    this.coins -= this.upgradeCost(id);
    this.levels[id]++;
    this.save();
    return true;
  }

  /** Spend coins on a repair kit. The caller applies the heal. */
  buyRepairKit(): boolean {
    if (this.coins < REPAIR_KIT.price) return false;
    this.coins -= REPAIR_KIT.price;
    this.save();
    return true;
  }

  // ---- Fortress -------------------------------------------------------------

  /** Pieces standing in the saved fortress. Read-only: change it through the methods below. */
  get layout(): readonly PlacedPiece[] {
    return this.fortress.layout;
  }

  isUnlocked(id: FortressItemId): boolean {
    return this.fortress.unlocked.includes(id);
  }

  canUnlockItem(id: FortressItemId): boolean {
    return !this.isUnlocked(id) && this.coins >= fortressItem(id).unlock;
  }

  unlockItem(id: FortressItemId): boolean {
    if (!this.canUnlockItem(id)) return false;
    this.coins -= fortressItem(id).unlock;
    this.fortress.unlocked.push(id);
    this.save();
    return true;
  }

  canBuyItem(id: FortressItemId): boolean {
    return this.isUnlocked(id) && this.coins >= fortressItem(id).price;
  }

  /** Buy one piece into the inventory. */
  buyItem(id: FortressItemId): boolean {
    if (!this.canBuyItem(id)) return false;
    this.coins -= fortressItem(id).price;
    this.fortress.inventory[id]++;
    this.save();
    return true;
  }

  itemCount(id: FortressItemId): number {
    return this.fortress.inventory[id];
  }

  placedCount(id: FortressItemId): number {
    return this.fortress.layout.filter((p) => p.item === id).length;
  }

  /** True when one more of this item may go into the fortress. */
  canPlace(id: FortressItemId): boolean {
    return this.itemCount(id) > 0 && this.placedCount(id) < fortressItem(id).maxPlaced;
  }

  /** Move one piece from the inventory into the fortress. Returns the saved entry. */
  placeItem(piece: PlacedPiece): PlacedPiece | null {
    if (!this.canPlace(piece.item)) return null;
    const saved = { ...piece };
    this.fortress.inventory[piece.item]--;
    this.fortress.layout.push(saved);
    this.save();
    return saved;
  }

  /** Take a standing piece back into the inventory (picked up in build mode). */
  pickUpItem(saved: PlacedPiece): void {
    const i = this.fortress.layout.indexOf(saved);
    if (i < 0) return;
    this.fortress.layout.splice(i, 1);
    this.fortress.inventory[saved.item]++;
    this.save();
  }

  /** Pieces destroyed in battle are gone for good. */
  losePieces(lost: readonly PlacedPiece[]): void {
    if (lost.length === 0) return;
    this.fortress.layout = this.fortress.layout.filter((p) => !lost.includes(p));
    this.save();
  }

  /** Start a new run. Coins, weapons, upgrades and the fortress carry over. */
  startRun(): void {
    this.wave = 1;
    this.score = 0;
    this.kills = 0;
  }

  /** Wipe the saved profile back to a new player. */
  resetProfile(): void {
    const f = freshProfile();
    this.coins = f.coins;
    this.owned.clear();
    this.owned.add(STARTER_WEAPON);
    this.equipped = STARTER_WEAPON;
    for (const k of UPGRADE_IDS) this.levels[k] = 0;
    this.fortress = f.fortress;
    this.startRun();
    this.save();
  }
}
