// Shared headless gameplay driver: fire a shot at an angle, simulate until
// the level resolves the next shot, and replay fixed angle sequences on a
// fresh game instance. Imported by verify-solvable.mjs (campaign) and
// verify-endless.mjs (generated maps), so both tools drive the exact same
// fire/settle pipeline the player does.
import { createGame } from '../src/game.js';
import { SLING } from '../src/levels.js';

export const ANGLES = [8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76];
export const EVAL_REPLAYS = 3;
export const REPLAYS = 5;
const SETTLE_FRAMES = 1400;

// Launch one full-power shot at `deg` above the horizon, exactly as a player
// would fire it from the sling.
export function fireAngle(game, deg) {
  const a = (deg * Math.PI) / 180;
  const pull = 100;
  game.state.canAim = true;
  return game.fire({
    dragging: true, canAim: true, flick: 0, power: 1, maxPull: pull,
    ballX: SLING.x - Math.cos(a) * pull, ballY: SLING.y + Math.sin(a) * pull,
  });
}

// Simulate until the next shot is loaded, the level resolves, or the frame
// budget runs out.
export function settle(game) {
  for (let f = 0; f < SETTLE_FRAMES; f++) {
    if (game.state.screen === 'result') return 'result';
    game.update(1 / 60);
    if (!game.state.flying && game.state.canAim) return 'ready';
  }
  return 'timeout';
}

// Fresh game instance; `start(game)` loads the level (campaign or endless);
// the angle sequence is fired shot by shot. A game that has already resolved
// ignores further fires, so over-long sequences are harmless.
export function play(start, angleSeq) {
  const game = createGame();
  start(game);
  for (const deg of angleSeq) {
    if (game.state.screen === 'result') break;
    if (!game.state.loaded) break;
    if (!fireAngle(game, deg)) break;
    if (settle(game) === 'timeout') break;
  }
  return game;
}

// Greedy shot plan for `start`: one angle per shot in `budget`, ranked by how
// reliably the resulting plan clears across EVAL_REPLAYS evaluations.
export function greedyPlan(start, budget) {
  const chosen = [], trace = [];
  for (let shot = 0; shot < budget; shot++) {
    let best = null;
    for (const deg of ANGLES) {
      let wins = 0, downSum = 0, brokeSum = 0;
      for (let r = 0; r < EVAL_REPLAYS; r++) {
        const g = play(start, [...chosen, deg]);
        if (g.state.result === 'win') wins++;
        downSum += g.state.targetsDown;
        brokeSum += g.state.destroyedCount;
      }
      const sc = wins * 100000 + downSum * 1000 + brokeSum;
      if (!best || sc > best.sc) best = { deg, sc, wins, down: downSum / EVAL_REPLAYS };
    }
    chosen.push(best.deg);
    trace.push(`${best.deg}°:d${best.down.toFixed(1)}`);
    // no early break: after a winning evaluation the remaining budget is spent
    // on angles that make the clear reliable (a won game ignores further fires)
  }
  return { chosen, trace };
}

// Confirmation replays of a greedy plan; k/N wins is the honest verdict.
export function confirm(start, angleSeq, replays = REPLAYS) {
  let wins = 0, last = null;
  for (let r = 0; r < replays; r++) {
    last = play(start, angleSeq);
    if (last.state.result === 'win') wins++;
  }
  return { wins, replays, game: last };
}
