import { BUNKER } from '../game/config';
import { Emitter } from './Emitter';

interface BunkerEvents extends Record<string, unknown> {
  change: { health: number; max: number };
  damaged: { amount: number; blocked: boolean };
  repaired: { amount: number };
  destroyed: Record<string, never>;
}

export class BunkerManager {
  readonly events = new Emitter<BunkerEvents>();
  private _health: number;
  private _max: number;
  private shieldTime = 0;
  private destroyedFired = false;

  constructor(max: number = BUNKER.maxHealth) {
    this._max = max;
    this._health = max;
  }

  get health(): number {
    return this._health;
  }
  get max(): number {
    return this._max;
  }
  get fraction(): number {
    return this._health / this._max;
  }
  get critical(): boolean {
    return this.fraction <= BUNKER.criticalFraction && this._health > 0;
  }
  get destroyed(): boolean {
    return this._health <= 0;
  }
  get shielded(): boolean {
    return this.shieldTime > 0;
  }
  get shieldRemaining(): number {
    return this.shieldTime;
  }

  update(dt: number): void {
    if (this.shieldTime > 0) this.shieldTime = Math.max(0, this.shieldTime - dt);
  }

  raiseShield(seconds: number): void {
    this.shieldTime = Math.max(this.shieldTime, seconds);
  }

  damage(amount: number): void {
    if (this.destroyed || amount <= 0) return;
    if (this.shielded) {
      this.events.emit('damaged', { amount: 0, blocked: true });
      return;
    }
    this._health = Math.max(0, this._health - amount);
    this.events.emit('damaged', { amount, blocked: false });
    this.events.emit('change', { health: this._health, max: this._max });
    if (this._health <= 0 && !this.destroyedFired) {
      this.destroyedFired = true;
      this.events.emit('destroyed', {});
    }
  }

  repair(amount: number): number {
    if (this.destroyed) return 0;
    const before = this._health;
    this._health = Math.min(this._max, this._health + amount);
    const healed = this._health - before;
    if (healed > 0) {
      this.events.emit('repaired', { amount: healed });
      this.events.emit('change', { health: this._health, max: this._max });
    }
    return healed;
  }

  /** Brings a fallen bunker back to part of its health (rewarded reinforcements). */
  revive(fraction: number): void {
    this._health = Math.max(1, Math.round(this._max * Math.min(1, fraction)));
    this.destroyedFired = false;
    this.events.emit('change', { health: this._health, max: this._max });
  }

  /** Starts the battle with only part of the health (Fog Surge "Thin walls"). */
  startAt(fraction: number): void {
    this._health = Math.max(1, Math.round(this._max * Math.min(1, fraction)));
    this.events.emit('change', { health: this._health, max: this._max });
  }

  /** Raising max health also adds the difference to current health. */
  setMax(newMax: number): void {
    const diff = newMax - this._max;
    this._max = newMax;
    if (diff > 0) this._health += diff;
    this._health = Math.min(this._health, this._max);
    this.events.emit('change', { health: this._health, max: this._max });
  }
}
