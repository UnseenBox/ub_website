import type { Game } from '../../core/Game';
import type { DamageCause } from '../../core/types';
import type { Enemy } from '../Enemy';
import type { PhysicsObject } from '../PhysicsObject';
import type { BossScript } from './BossScript';

/**
 * THE CHAIRMAN: "the quarterly review".
 *
 * He walks in wrapped in MEMOS: sheets of company paperwork that orbit him and soak up every
 * hit that is not serious ("REJECTED!"). A real hit (a thrown chair, not a thrown paper ball)
 * tears one away. Fire and explosions burn the lot at once, because paper.
 *
 * Tear off the last memo and he is OUT OF OFFICE: stunned, tie loosened, taking extra damage,
 * while the PHOTOCOPIER in the corner starts printing him new ones. Hit the copier during the
 * run and it JAMS. Wreck it, and no more memos, ever: he goes OVERTIME and is left bare.
 *
 * So the fight is a loop the player can read and play with: break the shield, punish the
 * window, and decide whether to chase the machine that feeds him.
 */

/** Smallest hit that tears a memo off. Anything lighter is simply filed. */
export const MEMO_BREAK = 5;
/** Damage taken while out of office, relative to normal. */
export const EXPOSED_BONUS = 1.35;
/** Share of a blocked hit that still reaches him. */
export const BLOCKED_CHIP = 0.08;
export const STUN_ON_EXPOSE = 1.6;

const PRINT_SECONDS = 6;
const PRINT_SECONDS_OVERTIME = 4.2;
const JAM_SECONDS = 7;
const MEMO_COOLDOWN = 0.22;

/** What the copier is doing, for the drawing code to read (keyed by the object). */
export interface CopierState {
  /** 0..1 while printing. */
  progress: number;
  jammed: boolean;
}
export const COPIERS = new WeakMap<PhysicsObject, CopierState>();

export class ChairmanScript implements BossScript {
  readonly deathText = 'TERMINATED!';

  /** Memos orbiting him right now. */
  memos = 0;
  maxMemos = 2;
  /** True from the last memo going until the next batch arrives (or for good). */
  exposed = false;
  copier: PhysicsObject | null = null;
  copierDown = false;
  private started = false;
  private printing = 0;
  private jam = 0;
  private lastHealth = 0;
  private lastTear = -1;
  private sparkT = 0;
  /** Seconds since a memo last tore off, for the drawing code's flutter. */
  tornAgo = 99;
  /** Seconds since the memos last reloaded, for the arrival flourish. */
  reloadedAgo = 99;
  time = 0;

  update(game: Game, boss: Enemy, dt: number): void {
    this.time += dt;
    this.tornAgo += dt;
    this.reloadedAgo += dt;
    if (!this.started) {
      if (!boss.aware) return;
      this.start(game, boss);
    }
    const overtime = boss.phaseIndex >= 1;
    this.maxMemos = overtime ? 3 : 2;

    // The machine: watch for a hit (jam) and for the end of it (toner gone).
    const copier = this.copier;
    if (copier && !this.copierDown) {
      if (!copier.alive || copier.structural === 'broken') {
        this.copierWrecked(game, boss);
      } else if (copier.health < this.lastHealth) {
        this.lastHealth = copier.health;
        if (this.printing > 0) this.jamIt(game, copier);
      }
    }

    if (this.jam > 0) {
      this.jam -= dt;
      if (this.jam <= 0 && this.copier && !this.copierDown) {
        const state = COPIERS.get(this.copier);
        if (state) state.jammed = false;
        game.fx.burst('BACK ONLINE', this.copier.body.x, this.copier.body.y - 44, 0.8, '#7ee0ff', true);
      }
    }

    // Printing: a bar fills over the copier; when it is full the memos fly in.
    if (this.exposed && !this.copierDown && this.jam <= 0 && copier) {
      const seconds = overtime ? PRINT_SECONDS_OVERTIME : PRINT_SECONDS;
      this.printing += dt / seconds;
      const state = COPIERS.get(copier);
      if (state) state.progress = Math.min(1, this.printing);
      this.sparkT -= dt;
      if (this.sparkT <= 0) {
        this.sparkT = 0.12;
        game.particles.burst('spark', copier.body.x, copier.body.y - 22, 1, 90, { color: '#7ee0ff' });
      }
      if (this.printing >= 1) this.reload(game, boss, copier);
    }

    // Out of office: no performances while he is on his back foot.
    if (this.exposed && boss.signatureTimer < 3) boss.signatureTimer = 3;
  }

  filterDamage(game: Game, boss: Enemy, amount: number, cause: DamageCause): number {
    if (this.exposed) return amount * EXPOSED_BONUS;
    if (this.memos <= 0) return amount;
    const burns = cause.type === 'fire' || cause.type === 'explosion';
    if (burns) {
      this.tearAll(game, boss, 'PAPER BURNS!', '#ff9f1c');
      return amount * 0.35;
    }
    if (amount >= MEMO_BREAK && game.time - this.lastTear > MEMO_COOLDOWN) {
      this.lastTear = game.time;
      this.memos--;
      this.tornAgo = 0;
      game.fx.burst('REJECTED!', boss.body.x, boss.body.y - 78, 1.0, '#ffffff', true);
      game.particles.burst('scrap', boss.body.x, boss.body.y - 40, 8, 220, { color: '#f4f1ea' });
      game.camera.addShake(0.18);
      game.audio.play('paper', 0.8);
      if (this.memos <= 0) this.expose(game, boss);
      return amount * BLOCKED_CHIP;
    }
    // Too light, or the same hit counted twice: filed under "later".
    boss.blockFlash = 1;
    return 0;
  }

  onDefeat(game: Game, boss: Enemy): void {
    this.memos = 0;
    this.exposed = false;
    if (this.copier && !this.copierDown) {
      const state = COPIERS.get(this.copier);
      if (state) state.progress = 0;
    }
    game.particles.burst('scrap', boss.body.x, boss.body.y - 40, 26, 360, { color: '#f4f1ea' });
    game.particles.burst('confetti', boss.body.x, boss.body.y - 40, 20, 300);
  }

  // ───────────── beats ─────────────

  private start(game: Game, boss: Enemy): void {
    this.started = true;
    this.memos = this.maxMemos;
    this.copier = this.placeCopier(game, boss);
    if (this.copier) {
      this.lastHealth = this.copier.health;
      COPIERS.set(this.copier, { progress: 0, jammed: false });
    } else {
      // No room for the machine: the fight still works, he just cannot reload.
      this.copierDown = true;
    }
  }

  private expose(game: Game, boss: Enemy): void {
    this.exposed = true;
    this.printing = 0;
    boss.stun = Math.max(boss.stun, STUN_ON_EXPOSE);
    boss.squash = 1;
    game.fx.burst('OUT OF OFFICE!', boss.body.x, boss.body.y - 92, 1.35, '#ffd23f', true);
    game.fx.ring(boss.body.x, boss.body.y, 10, 110, 0.5, 'rgba(255,210,63,0.9)', 5);
    game.camera.addShake(0.35);
    game.hitStop(0.08);
    if (this.copierDown) {
      game.hud.banner('NO MORE MEMOS', 'hit him now', 2);
    } else {
      game.hud.banner('OUT OF OFFICE', 'hit him before the copier reloads him', 2.4);
    }
  }

  private tearAll(game: Game, boss: Enemy, word: string, color: string): void {
    this.memos = 0;
    this.tornAgo = 0;
    game.fx.burst(word, boss.body.x, boss.body.y - 78, 1.2, color, true);
    game.particles.burst('smoke', boss.body.x, boss.body.y - 40, 8, 120);
    game.particles.burst('spark', boss.body.x, boss.body.y - 40, 12, 260, { color: '#ffb347' });
    this.expose(game, boss);
  }

  private reload(game: Game, boss: Enemy, copier: PhysicsObject): void {
    this.memos = this.maxMemos;
    this.exposed = false;
    this.printing = 0;
    this.reloadedAgo = 0;
    const state = COPIERS.get(copier);
    if (state) state.progress = 0;
    game.fx.burst('RELOADED!', boss.body.x, boss.body.y - 92, 1.0, '#7ee0ff', true);
    game.audio.play('stamp', 0.7);
    // A stream of paper from the machine to the man.
    for (let i = 0; i < 10; i++) {
      const t = i / 9;
      game.particles.burst(
        'scrap',
        copier.body.x + (boss.body.x - copier.body.x) * t,
        copier.body.y - 20 + (boss.body.y - 50 - copier.body.y) * t,
        1, 60, { color: '#f4f1ea' },
      );
    }
  }

  private jamIt(game: Game, copier: PhysicsObject): void {
    this.printing = 0;
    this.jam = JAM_SECONDS;
    const state = COPIERS.get(copier);
    if (state) {
      state.progress = 0;
      state.jammed = true;
    }
    game.fx.burst('PAPER JAM!', copier.body.x, copier.body.y - 46, 1.1, '#ffb347', true);
    game.particles.burst('smoke', copier.body.x, copier.body.y - 22, 8, 90);
    game.camera.addShake(0.2);
  }

  private copierWrecked(game: Game, boss: Enemy): void {
    this.copierDown = true;
    this.printing = 0;
    const copier = this.copier;
    if (copier) {
      const state = COPIERS.get(copier);
      if (state) {
        state.progress = 0;
        state.jammed = true;
      }
      game.fx.burst('OUT OF TONER!', copier.body.x, copier.body.y - 46, 1.3, '#7ee0ff', true);
    }
    // No more reloads: he is furious, and from now on he is bare whenever the memos are gone.
    boss.rageMult = Math.max(boss.rageMult, 1.25);
    game.hud.banner('OVERTIME', 'the copier is dead', 2.2);
    game.camera.addShake(0.4);
  }

  /** The copier goes against a wall, as far from the player and the door as the room allows. */
  private placeCopier(game: Game, boss: Enemy): PhysicsObject | null {
    const bounds = game.world.bounds;
    const margin = 76;
    const candidates: Array<[number, number]> = [];
    const w = bounds.x1 - bounds.x0;
    const h = bounds.y1 - bounds.y0;
    for (const fx of [0.12, 0.88]) for (const fy of [0.25, 0.5, 0.75]) candidates.push([bounds.x0 + w * fx, bounds.y0 + h * fy]);
    for (const fx of [0.3, 0.7]) for (const fy of [0.1, 0.9]) candidates.push([bounds.x0 + w * fx, bounds.y0 + h * fy]);
    let best: [number, number] | null = null;
    let bestScore = -Infinity;
    for (const [cx, cy] of candidates) {
      const x = Math.min(bounds.x1 - margin, Math.max(bounds.x0 + margin, cx));
      const y = Math.min(bounds.y1 - margin, Math.max(bounds.y0 + margin, cy));
      let clearance = Infinity;
      for (const o of game.objects) {
        if (!o.alive) continue;
        clearance = Math.min(clearance, Math.hypot(o.body.x - x, o.body.y - y) - o.body.boundR);
      }
      const fromPlayer = Math.hypot(game.player.body.x - x, game.player.body.y - y);
      const fromBoss = Math.hypot(boss.body.x - x, boss.body.y - y);
      const score = Math.min(clearance, 90) * 2 + Math.min(fromPlayer, 420) * 0.4 + Math.min(fromBoss, 300) * 0.2;
      if (clearance >= 34 && score > bestScore) {
        bestScore = score;
        best = [x, y];
      }
    }
    if (!best) return null;
    return game.spawnObject('photocopier', best[0], best[1], 0);
  }
}
