import { WEAPONS } from '../data/weapons';
import { BUNKER_UPGRADE, DEFENSES, MODS, SUPPORT } from '../data/upgrades';
import { Abilities } from './Abilities';
import { BunkerManager } from './BunkerManager';
import { EconomyManager } from './EconomyManager';
import { WeaponManager } from './WeaponManager';

export type ShopCategory = 'weapons' | 'mods' | 'support' | 'bunker';
export type ItemStatus = 'ok' | 'owned' | 'full' | 'cash' | 'maxed' | 'needs' | 'locked';

export interface ShopItem {
  id: string;
  category: ShopCategory;
  name: string;
  icon: string;
  key: string;
  description: string;
  price(): number;
  /** Short state label, e.g. "OWNED", "2/5", "180 RDS". */
  stock(): string;
  status(): ItemStatus;
  buy(): boolean;
}

export interface ShopDeps {
  economy: EconomyManager;
  weapons: WeaponManager;
  abilities: Abilities;
  bunker: BunkerManager;
  upgrades: { reinforceLevel: number };
}

export const STATUS_TEXT: Record<ItemStatus, string> = {
  ok: '',
  owned: 'OWNED',
  full: 'FULL',
  cash: 'NEED CASH',
  maxed: 'MAXED',
  needs: 'BUY WEAPON',
  locked: 'LOCKED',
};

/**
 * Builds the shop catalogue. Every buy() checks affordability, deducts once
 * via EconomyManager.spend and then mutates inventory.
 */
export function buildCatalog(d: ShopDeps): ShopItem[] {
  const items: ShopItem[] = [];
  const withCash = (price: number, s: ItemStatus): ItemStatus => (s === 'ok' && !d.economy.canAfford(price) ? 'cash' : s);

  for (const w of WEAPONS) {
    if (w.price > 0) {
      items.push({
        id: `weapon:${w.id}`, category: 'weapons', name: w.name, icon: w.iconTexture, key: String(w.slot), description: w.description,
        price: () => w.price,
        stock: () => (d.weapons.owns(w.id) ? 'OWNED' : d.weapons.isUnlocked(w.id) ? '' : `CLEAR WAVE ${w.unlockAfterWave}`),
        status: () => withCash(w.price, d.weapons.owns(w.id) ? 'owned' : d.weapons.isUnlocked(w.id) ? 'ok' : 'locked'),
        buy() {
          if (this.status() !== 'ok') return false;
          if (!d.economy.spend(w.price, this.id)) return false;
          d.weapons.grant(w.id);
          return true;
        },
      });
    }
    if (w.ammoPack.rounds > 0) {
      items.push({
        id: `ammo:${w.id}`, category: 'weapons', name: `${w.shortName} Ammo ×${w.ammoPack.rounds}`, icon: w.iconTexture, key: String(w.slot),
        description: `Reserve rounds for the ${w.name}. Carry up to ${w.maxReserve}.`,
        price: () => w.ammoPack.price,
        stock: () => (d.weapons.owns(w.id) ? `${d.weapons.states.get(w.id)!.reserve} RES` : ''),
        status: () => withCash(w.ammoPack.price, !d.weapons.owns(w.id) ? 'needs' : d.weapons.ammoIsFull(w.id) ? 'full' : 'ok'),
        buy() {
          if (this.status() !== 'ok') return false;
          if (!d.economy.spend(w.ammoPack.price, this.id)) return false;
          d.weapons.addAmmo(w.id, w.ammoPack.rounds);
          return true;
        },
      });
    }
  }

  for (const m of MODS) {
    items.push({
      id: `mod:${m.id}`, category: 'mods', name: m.name, icon: m.icon, key: m.key, description: m.description,
      price: () => m.price,
      stock: () => `${d.abilities.mods.get(m.id)!.charges}/${m.maxCharges}`,
      status: () => withCash(m.price, d.abilities.mods.get(m.id)!.charges >= m.maxCharges ? 'full' : 'ok'),
      buy() {
        if (this.status() !== 'ok') return false;
        if (!d.economy.spend(m.price, this.id)) return false;
        return d.abilities.addCharge('mod', m.id);
      },
    });
  }

  for (const s of SUPPORT) {
    items.push({
      id: `support:${s.id}`, category: 'support', name: s.name, icon: s.icon, key: s.key, description: s.description,
      price: () => s.price,
      stock: () => `${d.abilities.support.get(s.id)!.charges}/${s.maxCharges}`,
      status: () => withCash(s.price, d.abilities.support.get(s.id)!.charges >= s.maxCharges ? 'full' : 'ok'),
      buy() {
        if (this.status() !== 'ok') return false;
        if (!d.economy.spend(s.price, this.id)) return false;
        return d.abilities.addCharge('support', s.id);
      },
    });
  }

  for (const def of DEFENSES) {
    items.push({
      id: `defense:${def.id}`, category: 'bunker', name: def.name, icon: def.icon, key: def.key, description: def.description,
      price: () => def.price,
      stock: () => `${d.abilities.defense.get(def.id)!.charges}/${def.maxCharges}`,
      status: () => withCash(def.price, d.abilities.defense.get(def.id)!.charges >= def.maxCharges ? 'full' : 'ok'),
      buy() {
        if (this.status() !== 'ok') return false;
        if (!d.economy.spend(def.price, this.id)) return false;
        return d.abilities.addCharge('defense', def.id);
      },
    });
  }

  const up = BUNKER_UPGRADE;
  items.push({
    id: `upgrade:${up.id}`, category: 'bunker', name: up.name, icon: up.icon, key: '—', description: up.description,
    price: () => up.levels[Math.min(d.upgrades.reinforceLevel, up.levels.length - 1)].price,
    stock: () => `LV ${d.upgrades.reinforceLevel}/${up.levels.length}`,
    status() {
      if (d.upgrades.reinforceLevel >= up.levels.length) return 'maxed';
      return withCash(this.price(), 'ok');
    },
    buy() {
      if (this.status() !== 'ok') return false;
      const lvl = up.levels[d.upgrades.reinforceLevel];
      if (!d.economy.spend(lvl.price, this.id)) return false;
      d.upgrades.reinforceLevel += 1;
      d.bunker.setMax(lvl.maxHealth);
      return true;
    },
  });

  return items;
}
