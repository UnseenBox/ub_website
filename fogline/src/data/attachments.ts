// Weapon attachments (Act 3). Each weapon has one attachment slot; an attachment
// is bought once in the Workshop and can then be fitted to any weapon. They are
// choices with a trade-off, not straight upgrades.

import type { WeaponDef } from './weapons';

export type AttachmentId = 'extended' | 'hollow' | 'compensator' | 'quickdraw';

export interface AttachmentDef {
  id: AttachmentId;
  name: string;
  /** What it does, for the Workshop card. */
  text: string;
  cost: number;
  apply: (w: WeaponDef) => WeaponDef;
}

export const ATTACHMENTS: AttachmentDef[] = [
  {
    id: 'extended',
    name: 'Extended mag',
    text: '+35% magazine, reload 10% slower',
    cost: 220,
    apply: (w) => ({ ...w, magazine: Math.max(w.magazine + 1, Math.round(w.magazine * 1.35)), reloadTime: w.reloadTime * 1.1 }),
  },
  {
    id: 'hollow',
    name: 'Hollow points',
    text: '+30% headshot damage, -10% body damage',
    cost: 260,
    apply: (w) => ({ ...w, damage: w.damage * 0.9, headshotMultiplier: w.headshotMultiplier * (1.3 / 0.9) }),
  },
  {
    id: 'compensator',
    name: 'Compensator',
    text: '-35% recoil and spread growth, -5% fire rate',
    cost: 240,
    apply: (w) => ({ ...w, recoil: w.recoil * 0.65, bloomPerShot: w.bloomPerShot * 0.65, maxSpread: w.maxSpread * 0.8, fireRate: w.fireRate * 0.95 }),
  },
  {
    id: 'quickdraw',
    name: 'Speed loader',
    text: '-30% reload time, -15% magazine',
    cost: 280,
    apply: (w) => ({ ...w, reloadTime: w.reloadTime * 0.7, magazine: Math.max(1, Math.round(w.magazine * 0.85)) }),
  },
];

export function attachmentById(id: string): AttachmentDef | undefined {
  return ATTACHMENTS.find((a) => a.id === id);
}
