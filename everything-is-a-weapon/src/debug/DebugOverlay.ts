import type { Game } from '../core/Game';
import { FIXED_DT } from '../core/constants';
import { ENEMY_TYPES, type EnemyTypeId } from '../entities/EnemyTypes';
import { SOURCE_LEVEL } from '../hazards/Electricity';
import { ObjectRegistry } from '../objects/ObjectRegistry';

/**
 * Development-only tools, toggled with F3. This module is imported dynamically behind
 * `import.meta.env.DEV`, so none of it exists in a production build.
 */
export class DebugOverlay {
  private readonly panel: HTMLElement;
  private readonly stats: HTMLElement;
  private visible = false;

  constructor(private readonly game: Game, root: HTMLElement) {
    this.panel = document.createElement('div');
    this.panel.className = 'debug-panel hidden';
    this.stats = document.createElement('pre');
    this.panel.append(this.stats);

    const objectSelect = this.select(ObjectRegistry.ids());
    const enemySelect = this.select(Object.keys(ENEMY_TYPES));
    const row = (...nodes: HTMLElement[]): void => {
      const div = document.createElement('div');
      div.className = 'debug-row';
      div.append(...nodes);
      this.panel.append(div);
    };

    row(objectSelect, this.button('Spawn object', () => {
      const p = this.target();
      game.spawnObject(objectSelect.value, p.x, p.y);
    }));
    row(enemySelect, this.button('Spawn enemy', () => {
      const p = this.target();
      game.spawnEnemy(enemySelect.value as EnemyTypeId, p.x, p.y);
    }));
    row(
      this.button('Electricity', () => {
        const p = this.target();
        game.zones.spawn(game, 'electric', p.x, p.y, 34, { ttl: 6, level: SOURCE_LEVEL });
      }),
      this.button('Fire', () => {
        const p = this.target();
        game.zones.spawn(game, 'fire', p.x, p.y, 30, { ttl: 6 });
      }),
      this.button('Water', () => {
        const p = this.target();
        game.zones.spawn(game, 'water', p.x, p.y, 60);
      }),
    );
    row(
      this.button('Reset room', () => game.restartRoom()),
      this.button('Clear save', () => {
        game.save.clear();
        game.applySettings();
      }),
    );
    row(
      this.button('Hitboxes', () => (game.renderer.debug.hitboxes = !game.renderer.debug.hitboxes)),
      this.button('Grid', () => (game.renderer.debug.grid = !game.renderer.debug.grid)),
    );

    root.append(this.panel);
    game.input.onAction((action) => {
      if (action === 'debug') this.toggle();
    });
    window.setInterval(() => this.refresh(), 200);
  }

  /** Spawn point: a little in front of the player, towards the cursor. */
  private target(): { x: number; y: number } {
    const p = this.game.player;
    return { x: p.body.x + p.aimX * 90, y: p.body.y + p.aimY * 90 };
  }

  private toggle(): void {
    this.visible = !this.visible;
    this.panel.classList.toggle('hidden', !this.visible);
  }

  private button(text: string, onClick: () => void): HTMLButtonElement {
    const node = document.createElement('button');
    node.type = 'button';
    node.textContent = text;
    node.addEventListener('click', onClick);
    return node;
  }

  private select(options: string[]): HTMLSelectElement {
    const node = document.createElement('select');
    for (const option of options) {
      const item = document.createElement('option');
      item.value = item.textContent = option;
      node.append(item);
    }
    return node;
  }

  private refresh(): void {
    if (!this.visible) return;
    const game = this.game;
    const p = game.player;
    const world = game.world;
    this.stats.textContent = [
      `FPS            ${game.loop.fps.toFixed(0)}  (${game.loop.ticksLastFrame} ticks/frame)`,
      `timestep       ${(FIXED_DT * 1000).toFixed(2)} ms`,
      `state          ${game.state}`,
      `room           ${game.room.index + 1}  ${game.room.def.id}`,
      `bodies         ${world.bodies.length}  (awake ${world.stats.awake})`,
      `objects        ${game.objects.length}`,
      `enemies        ${game.enemies.length}  (+${game.room.pending.length} pending)`,
      `zones          ${game.zones.zones.length}`,
      `particles      ${game.particles.activeCount}`,
      `collisions     ${world.stats.contacts}  (pairs tested ${world.stats.pairsTested})`,
      `rules fired    ${game.interactions.firedLastPass}`,
      `player vel     ${p.body.vx.toFixed(0)}, ${p.body.vy.toFixed(0)}`,
      `selected       ${p.held ? `${p.held.def.id} [${p.held.state}]` : p.hover ? `${p.hover.def.id} [${p.hover.state}] (hover)` : '-'}`,
      `replay         ${game.replay.snapshot().frameCount} frames, ${game.replay.moments.length} moments`,
    ].join('\n');
  }
}
