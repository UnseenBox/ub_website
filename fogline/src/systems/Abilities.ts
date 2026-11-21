import {
  DEFENSES, DefenseId, MODS, ModId, SUPPORT, SupportId,
} from '../data/upgrades';

export interface ChargeSlot {
  charges: number;
  max: number;
  cooldown: number;
  cooldownLeft: number;
}

/**
 * Charges, cooldowns and active timers for ammo mods, support strikes and
 * bunker defences. Pure state; GameScene performs the actual effects.
 */
export class Abilities {
  readonly mods = new Map<ModId, ChargeSlot & { activeLeft: number; duration: number }>();
  readonly support = new Map<SupportId, ChargeSlot>();
  readonly defense = new Map<DefenseId, ChargeSlot>();

  constructor() {
    for (const m of MODS) this.mods.set(m.id, { charges: 0, max: m.maxCharges, cooldown: 0, cooldownLeft: 0, activeLeft: 0, duration: m.duration });
    for (const s of SUPPORT) this.support.set(s.id, { charges: 0, max: s.maxCharges, cooldown: s.cooldown, cooldownLeft: 0 });
    for (const d of DEFENSES) this.defense.set(d.id, { charges: 0, max: d.maxCharges, cooldown: d.cooldown, cooldownLeft: 0 });
  }

  update(dt: number): void {
    for (const m of this.mods.values()) {
      if (m.activeLeft > 0) m.activeLeft = Math.max(0, m.activeLeft - dt);
    }
    for (const s of this.support.values()) s.cooldownLeft = Math.max(0, s.cooldownLeft - dt);
    for (const d of this.defense.values()) d.cooldownLeft = Math.max(0, d.cooldownLeft - dt);
  }

  activeMods(out: Set<ModId>): Set<ModId> {
    out.clear();
    for (const [id, m] of this.mods) if (m.activeLeft > 0) out.add(id);
    return out;
  }

  /** Consume a mod charge. Re-activating an active mod extends it. */
  activateMod(id: ModId): boolean {
    const m = this.mods.get(id)!;
    if (m.charges <= 0) return false;
    m.charges -= 1;
    m.activeLeft += m.duration;
    return true;
  }

  private use(slot: ChargeSlot): boolean {
    if (slot.charges <= 0 || slot.cooldownLeft > 0) return false;
    slot.charges -= 1;
    slot.cooldownLeft = slot.cooldown;
    return true;
  }

  useSupport(id: SupportId): boolean {
    return this.use(this.support.get(id)!);
  }

  useDefense(id: DefenseId): boolean {
    return this.use(this.defense.get(id)!);
  }

  /** Adds a charge if below the cap. Returns false when full. */
  addCharge(kind: 'mod' | 'support' | 'defense', id: string): boolean {
    const map = kind === 'mod' ? this.mods : kind === 'support' ? this.support : this.defense;
    const slot = (map as Map<string, ChargeSlot>).get(id);
    if (!slot || slot.charges >= slot.max) return false;
    slot.charges += 1;
    return true;
  }
}
