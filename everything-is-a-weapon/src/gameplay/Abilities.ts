import { rageStart, snoozeChime } from '../audio/CompanionSounds';
import type { Game } from '../core/Game';
import { startChain } from './Chain';

export type AbilityId = 'blast' | 'overdrive' | 'freeze';

export interface AbilityDefinition {
  readonly id: AbilityId;
  /** Shouted on the key chip and the shop row. */
  readonly name: string;
  /** Keyboard key that fires it (touch uses the single POWER button instead). */
  readonly key: string;
  /** One line on the shop row. */
  readonly blurb: string;
  /** Scrap to unlock, kept forever once bought. */
  readonly cost: number;
  /** Seconds before it can be fired again. */
  readonly cooldown: number;
}

export const ABILITIES: readonly AbilityDefinition[] = [
  { id: 'blast', name: 'BIG RED BUTTON', key: '1', blurb: 'a detonation wherever you point', cost: 150, cooldown: 25 },
  { id: 'overdrive', name: 'SUGAR RUSH', key: '2', blurb: 'eight seconds of blind rage', cost: 120, cooldown: 30 },
  { id: 'freeze', name: 'DEEP FREEZE', key: '3', blurb: 'every mover stops for four seconds', cost: 120, cooldown: 30 },
];

export const ABILITY_IDS: readonly string[] = ABILITIES.map((a) => a.id);

const BLAST_RADIUS = 170;
const BLAST_DAMAGE = 95;
const OVERDRIVE_SECONDS = 8;
const FREEZE_SECONDS = 4;

/**
 * Buyable powers, paid for with scrap earned from defeated intruders. Unlocking
 * is permanent (saved); each use starts a per-room cooldown. Every effect reuses
 * an existing game primitive (explode, rage, stun), so no new simulation code.
 */
export class AbilitySystem {
  private readonly cool = new Map<AbilityId, number>();

  constructor(private readonly game: Game) {}

  resetRoom(): void {
    this.cool.clear();
  }

  update(dt: number): void {
    for (const [id, left] of this.cool) {
      const next = left - dt;
      if (next <= 0) this.cool.delete(id);
      else this.cool.set(id, next);
    }
  }

  owned(id: AbilityId): boolean {
    return this.game.save.data.abilities.includes(id);
  }

  ownedList(): AbilityDefinition[] {
    return ABILITIES.filter((a) => this.owned(a.id));
  }

  hasAny(): boolean {
    return this.ownedList().length > 0;
  }

  /** Seconds left before the ability can be fired again, 0 when ready. */
  remaining(id: AbilityId): number {
    return this.cool.get(id) ?? 0;
  }

  ready(id: AbilityId): boolean {
    return this.owned(id) && !this.cool.has(id);
  }

  firstReady(): AbilityDefinition | null {
    return ABILITIES.find((a) => this.ready(a.id)) ?? null;
  }

  /** Slot 1..3 fires that ability; -1 (touch POWER button) fires the first ready one. */
  tryUse(slot: number): boolean {
    const game = this.game;
    if (game.state !== 'playing' || !game.player.alive) return false;
    const def = slot === -1 ? this.firstReady() : ABILITIES[slot - 1];
    if (!def || !this.ready(def.id)) return false;
    this.cool.set(def.id, def.cooldown);
    if (def.id === 'blast') this.blast();
    else if (def.id === 'overdrive') this.overdrive();
    else this.freeze();
    return true;
  }

  /** A detonation wherever the hero is pointing. */
  private blast(): void {
    const game = this.game;
    const player = game.player;
    let x = player.cursorX;
    let y = player.cursorY;
    if (game.input.touch) {
      // No cursor on a phone: the button goes off under the nearest mover in reach.
      let bestD = 460;
      for (const enemy of game.enemies) {
        const d = Math.hypot(enemy.body.x - player.body.x, enemy.body.y - player.body.y);
        if (enemy.defeated || d >= bestD) continue;
        bestD = d;
        x = enemy.body.x;
        y = enemy.body.y;
      }
    }
    game.explode(
      x, y, BLAST_RADIUS, BLAST_DAMAGE, 1.15,
      startChain(game.time, player.uid, 'BIG RED BUTTON'), player, 'fire',
    );
    game.discoveries.unlock('big_red_button');
  }

  /** Eight seconds of ghost-pepper rage without the pepper. */
  private overdrive(): void {
    const game = this.game;
    const pb = game.player.body;
    game.player.rage = OVERDRIVE_SECONDS;
    rageStart(game.audio);
    game.fx.burst('SUGAR RUSH!', pb.x, pb.y - 62, 1.4, '#ff5a4e', true);
    game.fx.flash('#ff3b2f', 0.35);
    game.fx.ring(pb.x, pb.y, 10, 130, 0.5, 'rgba(255,90,78,0.95)', 5);
    game.particles.burst('ember', pb.x, pb.y - 30, 20, 340);
    game.camera.addShake(0.5);
    game.hud.banner('SUGAR RUSH', 'eight seconds of blind rage', 1.8);
  }

  /** Every mover in the room stops cold for four seconds. */
  private freeze(): void {
    const game = this.game;
    const pb = game.player.body;
    let frozen = 0;
    for (const enemy of game.enemies) {
      if (enemy.defeated) continue;
      enemy.stun = Math.max(enemy.stun, FREEZE_SECONDS);
      enemy.squash = 0.6;
      game.popup('frozen', enemy.body.x, enemy.body.y - 52, '#bfe9ff', 16, 2);
      frozen++;
    }
    snoozeChime(game.audio);
    game.fx.flash('#bfe9ff', 0.3);
    game.fx.burst('DEEP FREEZE!', pb.x, pb.y - 62, 1.2, '#bfe9ff', true);
    game.hud.banner('DEEP FREEZE', frozen > 0 ? 'every mover in the room stops cold' : 'nobody here to freeze', 1.8);
    if (frozen > 0) game.discoveries.unlock('deep_freeze');
  }
}
