import { WEAPONS, WeaponDef, weaponById, weaponBySlot } from '../data/weapons';
import { Emitter } from './Emitter';

export interface WeaponState {
  def: WeaponDef;
  owned: boolean;
  /** Unlocked by clearing waves: on sale in the armory, owned or not. */
  unlocked: boolean;
  mag: number;
  reserve: number;
}

interface WeaponEvents extends Record<string, unknown> {
  fire: { def: WeaponDef; spread: number };
  empty: { def: WeaponDef };
  reloadStart: { def: WeaponDef; time: number };
  reloadEnd: { def: WeaponDef };
  switchStart: { from: WeaponDef; to: WeaponDef };
  switched: { def: WeaponDef };
  ammo: { def: WeaponDef; mag: number; reserve: number };
}

const SWITCH_TIME = 0.32;

/**
 * Pure weapon logic: inventory, ammunition, fire-rate gating, reloads,
 * switching and crosshair bloom. Rendering and hit resolution listen to events.
 */
export class WeaponManager {
  readonly events = new Emitter<WeaponEvents>();
  readonly states = new Map<string, WeaponState>();
  private currentId: string;
  private cooldown = 0;
  private reloadLeft = 0;
  private switchLeft = 0;
  private pendingSwitch: string | null = null;
  /** Current extra crosshair spread in pixels, decays over time. */
  bloom = 0;
  private triggerWasDown = false;
  private emptyClickCooldown = 0;
  /** Semi-auto clicks slightly early are buffered so they still fire. */
  private semiBuffer = 0;

  /** Wave after which each weapon goes on sale; missing = not offered at all. */
  private readonly unlockAt = new Map<string, number>();

  /**
   * `owned`: weapons carried into the battle (defaults to the free ones).
   * `unlockAfterWave`: the weapons this battle's armory sells and the wave that opens each
   * (defaults to every weapon's own `unlockAfterWave`).
   */
  constructor(opts: { owned?: string[]; unlockAfterWave?: Record<string, number>; defs?: Record<string, WeaponDef> } = {}) {
    const owned = opts.owned ? new Set(opts.owned) : null;
    for (const base of WEAPONS) {
      // Workshop upgrades arrive as replacement definitions with the same id.
      const def = opts.defs?.[base.id] ?? base;
      const isOwned = owned ? owned.has(def.id) || def.price === 0 : def.price === 0;
      const at = opts.unlockAfterWave ? opts.unlockAfterWave[def.id] : def.unlockAfterWave;
      if (at !== undefined) this.unlockAt.set(def.id, at);
      this.states.set(def.id, {
        def, owned: isOwned, unlocked: isOwned || (at !== undefined && at <= 0), mag: def.magazine, reserve: def.startReserve,
      });
    }
    this.currentId = WEAPONS[0].id;
  }

  /** Start the battle holding this weapon (no switch animation). */
  forceSelect(id: string): void {
    if (this.states.get(id)?.owned) this.currentId = id;
  }

  /** Owned, or on sale in this battle (now or after a wave). */
  isOffered(id: string): boolean {
    return this.owns(id) || this.unlockAt.has(id);
  }

  /** The wave that puts a weapon on sale, or null when this battle never sells it. */
  unlockWave(id: string): number | null {
    return this.unlockAt.get(id) ?? null;
  }

  get current(): WeaponState {
    return this.states.get(this.currentId)!;
  }
  get reloading(): boolean {
    return this.reloadLeft > 0;
  }
  get reloadProgress(): number {
    const t = this.current.def.reloadTime;
    return this.reloadLeft > 0 ? 1 - this.reloadLeft / t : 1;
  }
  get switching(): boolean {
    return this.switchLeft > 0;
  }
  get spread(): number {
    const d = this.current.def;
    return Math.min(d.maxSpread, d.spread + this.bloom);
  }

  owns(id: string): boolean {
    return this.states.get(id)?.owned ?? false;
  }

  isUnlocked(id: string): boolean {
    return this.states.get(id)?.unlocked ?? false;
  }

  /** A wave was cleared: unlock every weapon it has earned. Returns the newly unlocked ones. */
  unlockForCleared(cleared: number): WeaponDef[] {
    const fresh: WeaponDef[] = [];
    for (const s of this.states.values()) {
      const at = this.unlockAt.get(s.def.id);
      if (!s.unlocked && at !== undefined && at <= cleared) {
        s.unlocked = true;
        fresh.push(s.def);
      }
    }
    return fresh;
  }

  grant(id: string): void {
    const s = this.states.get(id);
    if (!s) return;
    s.owned = true;
    s.unlocked = true;
    s.mag = s.def.magazine;
    s.reserve = s.def.startReserve;
    this.events.emit('ammo', { def: s.def, mag: s.mag, reserve: s.reserve });
  }

  addAmmo(id: string, rounds: number): void {
    const s = this.states.get(id);
    if (!s || !s.owned) return;
    s.reserve = Math.min(s.def.maxReserve, s.reserve + rounds);
    this.events.emit('ammo', { def: s.def, mag: s.mag, reserve: s.reserve });
  }

  /** Total rounds still available (magazine + reserve). */
  roundsLeft(id: string): number {
    const s = this.states.get(id)!;
    return s.mag + s.reserve;
  }

  ammoIsFull(id: string): boolean {
    const s = this.states.get(id)!;
    return s.reserve >= s.def.maxReserve;
  }

  selectSlot(slot: number): boolean {
    const def = weaponBySlot(slot);
    if (!def) return false;
    return this.select(def.id);
  }

  select(id: string): boolean {
    const target = this.states.get(id);
    if (!target || !target.owned) return false;
    if (id === this.currentId && !this.pendingSwitch) return false;
    if (this.pendingSwitch === id) return false;
    const from = this.current.def;
    this.reloadLeft = 0; // switching cancels a reload; the magazine is untouched
    this.pendingSwitch = id;
    this.switchLeft = SWITCH_TIME;
    this.events.emit('switchStart', { from, to: target.def });
    return true;
  }

  reload(): boolean {
    const s = this.current;
    if (this.reloading || this.switching) return false;
    if (s.mag >= s.def.magazine || s.reserve <= 0) return false;
    this.reloadLeft = s.def.reloadTime;
    this.events.emit('reloadStart', { def: s.def, time: s.def.reloadTime });
    return true;
  }

  /**
   * Advance timers and process the trigger. Returns the number of shots fired
   * this tick (auto weapons may fire more than one on a long frame).
   */
  update(dt: number, triggerDown: boolean): number {
    const pressed = triggerDown && !this.triggerWasDown;
    this.triggerWasDown = triggerDown;
    const def = this.current.def;
    this.bloom = Math.max(0, this.bloom - dt * (def.maxSpread * 2.2 + 12));
    this.emptyClickCooldown = Math.max(0, this.emptyClickCooldown - dt);
    if (pressed) this.semiBuffer = 0.16;
    else this.semiBuffer = Math.max(0, this.semiBuffer - dt);

    if (this.switchLeft > 0) {
      this.switchLeft -= dt;
      if (this.switchLeft <= SWITCH_TIME / 2 && this.pendingSwitch) {
        this.currentId = this.pendingSwitch;
        this.pendingSwitch = null;
        this.cooldown = 0;
        this.bloom = 0;
        this.events.emit('switched', { def: this.current.def });
      }
      if (this.switchLeft <= 0) this.switchLeft = 0;
      return 0;
    }

    if (this.reloadLeft > 0) {
      this.reloadLeft -= dt;
      if (this.reloadLeft <= 0) {
        this.reloadLeft = 0;
        const s = this.current;
        const need = s.def.magazine - s.mag;
        const take = Math.min(need, s.reserve);
        s.mag += take;
        if (s.reserve !== Infinity) s.reserve -= take;
        this.events.emit('reloadEnd', { def: s.def });
        this.events.emit('ammo', { def: s.def, mag: s.mag, reserve: s.reserve });
      }
      return 0;
    }

    this.cooldown -= dt;
    const wants = def.mode === 'auto' ? triggerDown : this.semiBuffer > 0;
    if (!wants) {
      if (this.cooldown < 0) this.cooldown = 0;
      return 0;
    }

    let shots = 0;
    const interval = 1 / def.fireRate;
    while (this.cooldown <= 0) {
      const s = this.current;
      if (s.mag <= 0) {
        if (pressed || this.emptyClickCooldown <= 0) {
          this.events.emit('empty', { def });
          this.emptyClickCooldown = 0.35;
        }
        if (s.reserve > 0) this.reload();
        if (this.cooldown < 0) this.cooldown = 0;
        break;
      }
      s.mag -= 1;
      shots++;
      this.semiBuffer = 0;
      this.events.emit('fire', { def, spread: this.spread });
      this.bloom += def.bloomPerShot;
      this.cooldown += interval;
      this.events.emit('ammo', { def, mag: s.mag, reserve: s.reserve });
      if (def.mode === 'semi') break;
    }
    if (def.mode === 'semi' && this.cooldown < 0) this.cooldown = 0;
    // Auto-reload when the magazine runs dry so the player isn't stuck clicking.
    if (this.current.mag === 0 && this.current.reserve > 0) this.reload();
    return shots;
  }

  /** Refill every owned magazine (used between waves for the starter only). */
  topUpStarter(): void {
    const s = this.states.get(WEAPONS[0].id)!;
    s.mag = s.def.magazine;
    this.events.emit('ammo', { def: s.def, mag: s.mag, reserve: s.reserve });
  }

  static def(id: string): WeaponDef {
    return weaponById(id);
  }
}
