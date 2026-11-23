import type { BonusId } from '../scoring/Bonus';

/**
 * The bonus objective of each match, by level id: one per match from 2 on (the tutorial has none). Each is
 * a thing the match's mechanics do, so the player can see what to aim for. `bonus.validate.test.ts` checks
 * with the sweep that at least three scoring shots meet each one.
 */
export const BONUS_FOR: Readonly<Record<string, BonusId>> = {
  'match-02-dodge': 'two-bounces',
  'match-03-pinball': 'bumper',
  'm04-ice-rink': 'tyre',
  'm05-beach-day': 'sand',
  'm06-downhill': 'rocket',
  'm07-turbo-lane': 'two-bounces',
  'm08-gutter-wind': 'wind',
  'm09-boing': 'tyre',
  'm10-the-drain': 'pipe',
  'm11-madame': 'glass',
  'm12-ding-dong': 'bell',
  'm13-parked': 'air-shot',
  'm14-hedge-row': 'hedge',
  'm15-delivery': 'rocket',
  'm16-mimi': 'air-shot',
  'm17-the-turnstile': 'spin',
  'm18-bumper-cars': 'bumper',
  'm19-market-spin': 'spin',
  'm20-night-traffic': 'two-bounces',
  'm21-wind-tunnel': 'wind',
  'm22-cold-front': 'bend-in',
  'm23-rainy-season': 'taxi',
  'm24-golden-kickoff': 'tyre',
  'm25-heat-shimmer': 'glass',
  'm26-first-light': 'two-bounces',
  'm27-neon-sewer': 'pipe',
  'm28-blackout-maze': 'two-bounces',
  'm29-frozen-night': 'tyre',
  'm30-night-watch': 'mimi',
  'm31-tin-roof-derby': 'air-shot',
  'm32-high-tide': 'pipe',
  'm33-the-conductor': 'air-shot',
  'm34-tide-kings': 'sand',
  'm35-dusk-carousel': 'spin',
  'm36-league-night': 'bumper',
  'm37-full-house': 'pipe',
  'm38-total-eclipse': 'air-shot',
  'm39-street-immortal': 'spin',
  'm40-the-final-whistle': 'glass',
};

/** The objective of a match, or null for a level without one (the tutorial lessons). */
export const bonusFor = (levelId: string): BonusId | null => BONUS_FOR[levelId] ?? null;
