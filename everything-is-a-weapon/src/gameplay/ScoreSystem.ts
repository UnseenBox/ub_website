import type { Game } from '../core/Game';
import type { DamageCause } from '../core/types';
import type { Enemy } from '../entities/Enemy';
import { DISCOVERY_SCORE } from './DiscoverySystem';
import { ledgerScoreMultiplier, ledgerScrapMultiplier } from './StarLedger';
import { upgradeScoreMultiplier, upgradeScrapMultiplier } from './Upgrades';

export interface RoomStats {
  kills: number;
  impactKills: number;
  hazardKills: number;
  directHits: number;
  throws: number;
  objectsUsed: Set<number>;
  objectIdsThrown: Set<string>;
  bestChain: number;
  chainEvents: number;
  bestMultiKill: number;
  bookKills: number;
  heavyKills: number;
  damageTaken: number;
  time: number;
  /** Scrap salvaged for the ability shop. */
  scrap: number;
}

function emptyStats(): RoomStats {
  return {
    kills: 0, impactKills: 0, hazardKills: 0, directHits: 0, throws: 0,
    objectsUsed: new Set(), objectIdsThrown: new Set(), bestChain: 0, chainEvents: 0,
    bestMultiKill: 0, bookKills: 0, heavyKills: 0, damageTaken: 0, time: 0, scrap: 0,
  };
}

export const COMBO_WINDOW = 5;
const MAX_COMBO = 8;

const FUNNY_KILLS: Readonly<Record<string, { discovery: string; line: string }>> = {
  shoe: { discovery: 'shoe_kill', line: 'You killed him with a SHOE.' },
  book: { discovery: 'book_kill', line: 'Knowledge is power.' },
  paperball: { discovery: 'paper_kill', line: 'A PAPER BALL. Really.' },
  helmet: { discovery: 'helmet_kill', line: 'With his own helmet.' },
  ball: { discovery: '', line: 'Dodgeball champion.' },
  candle: { discovery: '', line: 'Romantic.' },
  pillow: { discovery: 'pillow_fight', line: 'Flattened by a CUSHION.' },
  duck: { discovery: 'quack', line: 'Quack.' },
  toast: { discovery: 'toasted', line: 'Breakfast is served.' },
  banana: { discovery: '', line: 'Potassium.' },
  soap: { discovery: '', line: 'Squeaky clean.' },
  teddy: { discovery: '', line: 'Hugged to death.' },
  alarmclock: { discovery: '', line: 'Time to go.' },
  plunger: { discovery: '', line: 'Unblocked.' },
  fish: { discovery: 'fishes', line: 'Slapped with a FISH.' },
  teeth: { discovery: 'dental_plan', line: 'Nibbled to death.' },
  mousetrap: { discovery: '', line: 'It was not even a mouse.' },
};

/** Style scoring: rewards chains, hazards and ridiculous weapons more than plain hits. */
export class ScoreSystem {
  score = 0;
  combo = 1;
  comboTimer = 0;
  stats: RoomStats = emptyStats();

  private reactionCooldown = 0;

  constructor(private readonly game: Game) {
    const bus = game.bus;
    bus.on('OBJECT_THROWN', (e) => {
      this.stats.throws++;
      this.stats.objectsUsed.add(e.object.uid);
      this.stats.objectIdsThrown.add(e.object.def.id);
    });
    bus.on('PLAYER_HIT', () => {
      this.stats.damageTaken++;
      this.combo = 1;
      this.comboTimer = 0;
    });
    bus.on('ENEMY_HIT', (e) => this.onEnemyHit(e.enemy, e.damage, e.cause));
    bus.on('ENEMY_DEFEATED', (e) => this.onEnemyDefeated(e.enemy, e.cause));
    bus.on('DISCOVERY', (e) => {
      if (!e.isNew) return;
      this.score += DISCOVERY_SCORE;
      game.audio.play('discovery', 1);
    });
  }

  resetRoom(scoreAtStart: number): void {
    this.score = scoreAtStart;
    this.combo = 1;
    this.comboTimer = 0;
    this.stats = emptyStats();
  }

  update(dt: number): void {
    this.stats.time += dt;
    this.reactionCooldown -= dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 1;
    }
  }

  private bumpCombo(by = 1): void {
    this.combo = Math.min(MAX_COMBO, this.combo + by);
    this.comboTimer = COMBO_WINDOW;
    this.game.audio.combo(this.combo);
  }

  private award(points: number, x: number, y: number, color = '#fff3d6'): number {
    const total = Math.round(
      points
        * this.combo
        * this.game.edges.scoreMultiplier(this.game.save.data.runStreak)
        * ledgerScoreMultiplier(this.game.save.data)
        * upgradeScoreMultiplier(this.game.save.data)
        * this.game.difficultyMods.score,
    );
    this.score += total;
    this.game.popup(`+${total}`, x, y, color, 20 + Math.min(14, total / 150));
    return total;
  }

  private react(line: string, x: number, y: number, force = false): void {
    if (!force && this.reactionCooldown > 0) return;
    this.reactionCooldown = 4.5;
    this.game.popup(line, x, y - 46, '#ffd23f', 17, 1.9);
  }

  private onEnemyHit(enemy: Enemy, damage: number, cause: DamageCause): void {
    const game = this.game;
    const chain = cause.chain;
    const length = chain ? chain.steps.length : 0;
    const source = cause.source;
    const x = enemy.body.x;
    const y = enemy.body.y - 30;

    if (cause.type === 'impact' && source && source.kind === 'object' && source.thrownByPlayer && length <= 1) {
      this.stats.directHits++;
      if (damage >= 45 && !enemy.defeated) game.popup('PERFECT IMPACT!', x, y - 20, '#ffffff', 18);
    }
    if (length > this.stats.bestChain) this.stats.bestChain = length;

    // Each chain is rewarded once per length tier, however many intruders it ends up hurting.
    if (chain && length >= 3 && length > chain.root.rewardedLen) {
      chain.root.rewardedLen = length;
      this.stats.chainEvents++;
      const bonus = length >= 5 ? 1500 : length === 4 ? 800 : 500;
      this.bumpCombo();
      this.award(bonus, x, y - 8, '#ffd23f');
      game.discoveries.unlock(length >= 5 ? 'chain_5' : length === 4 ? 'chain_4' : 'chain_3');
      const headline = length >= 5 ? 'HOW DID THAT WORK?!' : length === 4 ? 'ABSOLUTELY STUPID!' : 'CHAIN REACTION!';
      game.hud.banner(headline, '', 2);
      game.bus.emit({ type: 'CHAIN', length, steps: chain.steps });
      game.audio.chain(length);
      if (length >= 4) game.slowMotion(0.35, 0.9);
    }
  }

  private onEnemyDefeated(enemy: Enemy, cause: DamageCause): void {
    const game = this.game;
    const stats = this.stats;
    const x = enemy.body.x;
    const y = enemy.body.y - 24;
    const source = cause.source;
    const chain = cause.chain;
    stats.kills++;
    if (enemy.type.id === 'heavy') stats.heavyKills++;
    // Every kill salvages scrap for the ability shop; bosses pay out big.
    const baseScrap = enemy.type.boss ? 150 : 12 + Math.round(enemy.type.scoreBonus / 10);
    stats.scrap += Math.round(
      baseScrap
        * game.edges.scrapMultiplier()
        * ledgerScrapMultiplier(game.save.data)
        * upgradeScrapMultiplier(game.save.data)
        * game.difficultyMods.scrap,
    );

    let points = 100 + enemy.type.scoreBonus;
    let color = '#fff3d6';

    if (cause.type === 'impact') {
      stats.impactKills++;
      if (source && source.kind === 'object') {
        const def = source.def;
        if (def.id === 'book') stats.bookKills++;
        if (def.mass >= 8) points += 50;
        if (def.id === 'table') game.discoveries.unlock('table_flip');
        if (def.id === 'pan') game.discoveries.unlock('pan_demonium');
        if (def.mass < 3 && enemy.type.id === 'heavy') game.discoveries.unlock('giant_slayer');
        if (def.funny) {
          points += 250;
          color = '#9be564';
          const entry = FUNNY_KILLS[def.id];
          if (entry) {
            if (entry.discovery) game.discoveries.unlock(entry.discovery);
            this.react(entry.line, x, y, true);
          } else {
            this.react('WHY THE ' + source.label + '?', x, y, true);
          }
        } else {
          this.react('WHY THE ' + source.label + '?', x, y, true);
        }
      }
    } else {
      stats.hazardKills++;
      points += 300;
      color = '#4ad6e8';
      if (cause.type === 'explosion') game.discoveries.unlock('kaboom');
      if (cause.type === 'fire' && chain && chain.steps.length >= 2) game.discoveries.unlock('flaming');
      if (!chain) game.discoveries.unlock('hands_off');
    }

    if (chain) {
      const kills = chain.root.kills;
      if (kills > stats.bestMultiKill) stats.bestMultiKill = kills;
      if (kills >= 2) {
        points += 400 * (kills - 1);
        game.discoveries.unlock('two_birds');
        game.hud.banner(kills === 2 ? 'ONE THROW. TWO INTRUDERS.' : `ONE THROW. ${kills} INTRUDERS.`, '');
        this.bumpCombo();
      }
    }

    this.award(points, x, y, color);
    this.bumpCombo();
  }
}
