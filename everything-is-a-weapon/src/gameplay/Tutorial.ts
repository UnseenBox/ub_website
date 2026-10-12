import type { Game } from '../core/Game';
import type { PhysicsObject } from '../entities/PhysicsObject';
import { moveKeysLabel } from '../input/KeyLabels';

export interface WorldHint {
  text: string;
  x: number;
  y: number;
}

type Step = 'intro' | 'grab' | 'throw' | 'hit' | 'done';

/**
 * The whole tutorial is two lines of attitude and two one-word hints.
 * It only runs in rooms flagged `tutorial` and steps forward on real player actions.
 * The first room's intruder arrives ~1s in, so the hints must be instant: the grab
 * hint is visible within the first second, never gated behind a banner sequence.
 * `focus` is the object the player should notice right now, so the renderer can
 * give it a subtle pulsing halo using the existing hover-highlight art.
 */
export class Tutorial {
  hint: WorldHint | null = null;
  /** Object to subtly highlight while in the `grab` step (null otherwise). */
  focus: PhysicsObject | null = null;

  private step: Step = 'done';
  private timer = 0;
  private said = 0;
  private readonly anchor: WorldHint = { text: '', x: 0, y: 0 };

  constructor(private readonly game: Game) {
    game.bus.on('OBJECT_GRABBED', () => {
      if (this.step === 'grab' || this.step === 'intro') this.step = 'throw';
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
      game.hud.banner('EVERYTHING CAN BE A WEAPON.', '', 2.4);
    });
  }

  get active(): boolean {
    return this.step !== 'done';
  }

  begin(active: boolean): void {
    this.step = active ? 'intro' : 'done';
    this.timer = 0;
    this.said = 0;
    this.hint = null;
    this.focus = null;
  }

  update(dt: number): void {
    if (this.step === 'done') {
      this.hint = null;
      this.focus = null;
      return;
    }
    const game = this.game;
    this.timer += dt;

    if (this.step === 'intro') {
      // the very first thing a new player needs: which keys move — shown at once,
      // and the grab hint follows within a second, before the first intruder arrives.
      const pb = game.player.body;
      const moved = pb.speed() >= 40;
      if (!moved) this.show(game.input.touch ? 'LEFT THUMB: MOVE' : `${moveKeysLabel()}: MOVE`, pb.x, pb.y - 78);
      else this.hint = null;
      if (this.said === 0 && this.timer > 0.15) {
        game.audio.play('yawn', 1);
        game.hud.banner('YOU HAVE NO WEAPON.', '', 1.2);
        this.said = 1;
      } else if (this.said === 1 && this.timer > 0.6) {
        game.hud.banner('GRAB SOMETHING. THROW IT.', '', 1.2);
        this.said = 2;
        this.step = 'grab';
      } else if (moved && this.timer > 0.4 && this.said >= 1) {
        // They already figured out movement: skip the remaining patter, show the grab hint.
        this.step = 'grab';
      }
      return;
    }

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
        const isChair = best.def.id === 'chair';
        const text = game.input.touch
          ? isChair ? 'TAP RIGHT SIDE: GRAB CHAIR' : 'WALK UP, TAP RIGHT SIDE'
          : isChair ? 'CLICK TO GRAB THE CHAIR' : 'CLICK TO GRAB';
        this.show(text, best.body.x, best.body.y - best.def.height - 30);
      } else {
        this.hint = null;
      }
    } else if (this.step === 'throw') {
      if (player.held) this.show(game.input.touch ? 'HOLD RIGHT SIDE, RELEASE' : 'HOLD CLICK, AIM, RELEASE', player.body.x, player.body.y - 78);
      else this.step = 'grab';
    } else {
      this.hint = null;
    }
  }

  private show(text: string, x: number, y: number): void {
    this.anchor.text = text;
    this.anchor.x = x;
    this.anchor.y = y;
    this.hint = this.anchor;
  }
}
