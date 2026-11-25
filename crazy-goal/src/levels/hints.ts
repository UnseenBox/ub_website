/**
 * The hint for a match the player keeps missing (six misses in a row): the kick that scores more often there,
 * by the sweep (scoring shots of a grid of angles and powers, air against bend). Stored as data, one per match.
 */
export type HintKind = 'air' | 'bend';

export const HINT_FOR: Readonly<Record<string, HintKind>> = {
  'match-02-dodge': 'bend',
  'match-03-pinball': 'bend',
  'm04-ice-rink': 'bend',
  'm05-beach-day': 'bend',
  'm06-downhill': 'bend',
  'm07-turbo-lane': 'bend',
  'm08-gutter-wind': 'bend',
  'm09-boing': 'bend',
  'm10-the-drain': 'bend',
  'm11-madame': 'bend',
  'm12-ding-dong': 'bend',
  'm13-parked': 'bend',
  'm14-hedge-row': 'bend',
  'm15-delivery': 'bend',
  'm16-mimi': 'air',
  'm17-the-turnstile': 'air',
  'm18-bumper-cars': 'bend',
  'm19-market-spin': 'bend',
  'm20-night-traffic': 'air',
  'm21-wind-tunnel': 'bend',
  'm22-cold-front': 'bend',
  'm23-rainy-season': 'air',
  'm24-golden-kickoff': 'bend',
  'm25-heat-shimmer': 'bend',
  'm26-first-light': 'bend',
  'm27-neon-sewer': 'bend',
  'm28-blackout-maze': 'bend',
  'm29-frozen-night': 'bend',
  'm30-night-watch': 'air',
  'm31-tin-roof-derby': 'air',
  'm32-high-tide': 'bend',
  'm33-the-conductor': 'bend',
  'm34-tide-kings': 'air',
  'm35-dusk-carousel': 'bend',
  'm36-league-night': 'bend',
  'm37-full-house': 'bend',
  'm38-total-eclipse': 'bend',
  'm39-street-immortal': 'bend',
  'm40-the-final-whistle': 'bend',
};

const HINT_TEXT: Readonly<Record<HintKind, string>> = {
  air: 'TRY AN AIR SHOT',
  bend: 'TRY BENDING IT',
};

/** The hint pill for a match, or null for a level without one. */
export const hintText = (levelId: string): string | null => {
  const kind = HINT_FOR[levelId];
  return kind ? HINT_TEXT[kind] : null;
};
