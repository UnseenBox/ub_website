import type { Game } from '../core/Game';
import type { PhysicsObject } from '../entities/PhysicsObject';

export interface WorldHint {
  text: string;
  x: number;
  y: number;
}

type Step = 'grab' | 'throw' | 'hit' | 'done';

/**
 * The whole tutorial is one sticky note, visible from the first frame.
 * No banner sequence, no movement lesson, no gating: the player spawns next to
 * a chair with a mover walking in, so the only job is to say "grab it, throw
 * it at the box" with the real controls. Steps forward on real actions and
 * disappears for good on the first solid hit.
 * `focus` is the object the player should notice right now, so the renderer can
 * give it a subtle pulsing halo using the existing hover-highlight art.
 */
export class Tutorial {
  hint: WorldHint | null = null;
  /** Object to subtly highlight while in the `grab` step (null otherwise). */
  focus: PhysicsObject | null = null;

  private step: Step = 'done';
  private readonly anchor: WorldHint = { text: '', x: 0, y: 0 };

  constructor(private readonly game: Game) {
    game.bus.on('OBJECT_GRABBED', () => {
      if (this.step === 'grab') this.step = 'throw';
      this.focus = null;
    });
    game.bus.on('OBJECT_THROWN', () => {
      if (this.step === 'throw') this.step = 'hit';
      this.focus = null;
    });
    game.bus.on('ENEMY_HIT', (e) => {
      if (this.step === 'done' || e.cause.type !== 'impact') return;
      this.step = 'done';
      this.hint = null;
      this.focus = null;
      document.body.classList.remove('tutorial');
      game.hud.banner('EVERYTHING CAN BE A WEAPON.', '', 2.2);
    });
  }

  get active(): boolean {
    return this.step !== 'done';
  }

  begin(active: boolean): void {
    document.body.classList.toggle('tutorial', active);
    this.step = active ? 'grab' : 'done';
    this.hint = null;
    this.focus = null;
  }

  update(_dt: number): void {
    if (this.step === 'done') {
      this.hint = null;
      this.focus = null;
      return;
    }
    const game = this.game;
    const player = game.player;

    if (this.step === 'grab') {
      let best = null;
      let bestD = Infinity;
      for (const object of game.objects) {
        if (!object.alive || !object.def.throwable) continue;
        const d = Math.hypot(object.body.x - player.body.x, object.body.y - player.body.y);
        const weighted = object.def.id === 'chair' ? d * 0.5 : d;
        if (weighted < bestD) {
          bestD = weighted;
          best = object;
        }
      }
      this.focus = best;
      if (best) {
        const text = game.input.touch
          ? 'TAP RIGHT SIDE TO GRAB — HOLD, LET GO TO BONK'
          : 'CLICK TO GRAB — HOLD CLICK, AIM, LET GO';
        this.show(text, best.body.x, best.body.y - best.def.height - 34);
      } else {
        this.hint = null;
      }
    } else if (this.step === 'throw') {
      if (player.held) {
        // Aim help: point at the nearest live mover so the first throw has a target.
        let tx = player.body.x + player.aimX * 120;
        let ty = player.body.y + player.aimY * 120 - 78;
        let bestD = Infinity;
        for (const enemy of game.enemies) {
          if (enemy.defeated) continue;
          const d = Math.hypot(enemy.body.x - player.body.x, enemy.body.y - player.body.y);
          if (d < bestD) {
            bestD = d;
            tx = (player.body.x + enemy.body.x) / 2;
            ty = (player.body.y + enemy.body.y) / 2 - 60;
          }
        }
        this.show(
          game.input.touch ? 'HOLD RIGHT SIDE — LET GO AT THE BOX!' : 'HOLD CLICK — AIM AT THE BOX, LET GO!',
          tx,
          ty,
        );
      } else {
        this.step = 'grab';
      }
    } else {
      // Thrown and waiting for impact: one encouraging line near the player.
      this.show('BONK IT!', player.body.x, player.body.y - 84);
    }
  }

  private show(text: string, x: number, y: number): void {
    this.anchor.text = text;
    this.anchor.x = x;
    this.anchor.y = y;
    this.hint = this.anchor;
  }
}
