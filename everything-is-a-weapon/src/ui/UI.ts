import type { Game, GameState, GameUi, RoomSummary } from '../core/Game';
import { buildDiscoveryScreen } from './DiscoveryScreen';
import { HUD } from './HUD';
import { buildMainMenu } from './MainMenu';
import { buildPauseMenu, buildSettings } from './PauseMenu';
import { buildResults } from './ResultsScreen';

/**
 * Phones get the whole screen and, where the browser allows it, a landscape lock.
 * Both are best-effort: iOS Safari supports neither for web pages, and that is fine.
 */
function goFullscreenOnPhones(game: Game): void {
  // A portal has its own fullscreen button; a second one in the game is not allowed there.
  if (!game.input.touch || game.portal.managesScreen) return;
  const root = document.documentElement;
  if (document.fullscreenElement || !root.requestFullscreen) return;
  const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
  root
    .requestFullscreen({ navigationUI: 'hide' })
    .then(() => orientation.lock?.('landscape'))
    .catch(() => {});
}

/**
 * Owns every DOM screen. The game tells it what state it is in; the UI decides what to show
 * and turns button presses back into game calls.
 */
export class UI implements GameUi {
  private readonly hud: HUD;

  constructor(
    private readonly game: Game,
    hudRoot: HTMLElement,
    private readonly screens: HTMLElement,
  ) {
    this.hud = new HUD(game, hudRoot, () => game.togglePause());
    game.bus.on('ROOM_START', () => this.hud.reset());
    // Every button click doubles as the user gesture browsers require before audio may start.
    screens.addEventListener('click', (event) => {
      game.audio.unlock();
      if (event.target instanceof Element && event.target.closest('button')) {
        game.audio.play('paper', 1, 0.9 + Math.random() * 0.3);
      }
    });
  }

  banner(title: string, sub?: string, seconds?: number): void {
    this.hud.banner(title, sub, seconds);
  }

  discovery(title: string): void {
    this.hud.discovery(title);
  }

  stamp(text: string): void {
    this.hud.stamp(text);
  }

  frame(dt: number): void {
    if (this.game.state !== 'menu') this.hud.frame(dt);
  }

  stateChanged(state: GameState): void {
    document.body.classList.toggle('playing', state === 'playing');
    switch (state) {
      case 'menu':
        this.hud.setVisible(false);
        this.hud.reset();
        this.showMenu();
        break;
      case 'playing':
        this.hud.setVisible(true);
        this.show(null);
        break;
      case 'paused':
        this.showPause();
        break;
      case 'cutscene':
        this.hud.setVisible(false);
        break;
      case 'cleared':
      case 'failed':
        // The summary screen arrives through showSummary().
        break;
    }
  }

  showSummary(summary: RoomSummary): void {
    const game = this.game;
    this.show(
      buildResults(summary, {
        next: () => void game.nextRoom(),
        retry: () => (summary.cleared ? game.restartRoom() : void game.retryAfterFail()),
        continueWithReward: () =>
          void game.continueWithReward().then((revived) => {
            // No ad came back: say so, and take the offer away rather than leave a dead button.
            if (!revived && game.state === 'failed') this.showSummary({ ...summary, canContinue: false, adMissed: true });
          }),
        home: () => game.toMenu(),
        stamped: () => game.audio.play('stamp', 1),
      }),
    );
  }

  private show(screen: HTMLElement | null): void {
    this.screens.replaceChildren();
    this.screens.classList.toggle('active', screen !== null);
    if (screen) {
      this.screens.append(screen);
      screen.querySelector<HTMLButtonElement>('button.primary')?.focus({ preventScroll: true });
    }
  }

  private showMenu(): void {
    const game = this.game;
    this.show(
      buildMainMenu(game, {
        play: (index) => {
          this.hud.reset();
          goFullscreenOnPhones(game);
          game.playFrom(index);
        },
        daily: () => {
          this.hud.reset();
          goFullscreenOnPhones(game);
          game.playDaily();
        },
        discoveries: () => this.show(buildDiscoveryScreen(game, () => this.showMenu())),
        settings: () => this.show(buildSettings(game, () => this.showMenu())),
        hero: (id) => game.setHero(id),
      }),
    );
  }

  private showPause(): void {
    const game = this.game;
    this.show(
      buildPauseMenu(game.input.touch, {
        resume: () => game.togglePause(),
        restart: () => game.restartRoom(),
        settings: () => this.show(buildSettings(game, () => this.showPause())),
        home: () => game.toMenu(),
      }),
    );
  }
}
