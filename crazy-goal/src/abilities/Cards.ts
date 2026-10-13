/** A boost rides on your own shot. */
export type Boost = 'fire' | 'magnet' | 'rubber';
/** A trick is waiting for your friend on their next shot. */
export type Trick = 'cat' | 'shutter' | 'smoke';
export type CardId = Boost | Trick;

export interface Card {
  id: CardId;
  kind: 'boost' | 'trick';
  name: string;
  /** What it does, in one line. `{friend}` stands for the opponent's name. */
  blurb: string;
  color: string;
}

/**
 * The six cards each duelist holds. Every card can be played once in a match, one per round.
 * How a boost changes the physics lives in Level; how a trick changes the street lives in
 * DuelLevels; what each one looks like lives in AbilityArt.
 */
export const CARDS: readonly Card[] = [
  { id: 'fire', kind: 'boost', name: 'HARISSA', blurb: 'Your ball burns through the first thing in its way.', color: '#e2472b' },
  { id: 'magnet', kind: 'boost', name: 'MAGNET', blurb: 'The goal pulls your ball in when it gets close.', color: '#1f5fa8' },
  { id: 'rubber', kind: 'boost', name: 'RUBBER', blurb: 'Your ball never loses its bounce.', color: '#2f9a63' },
  { id: 'cat', kind: 'trick', name: 'MIMI', blurb: "The cat guards the goal on {friend}'s next shot.", color: '#e58a2e' },
  { id: 'shutter', kind: 'trick', name: 'SHUTTER', blurb: "Half the goal is shut on {friend}'s next shot.", color: '#174a85' },
  { id: 'smoke', kind: 'trick', name: 'SMOKE', blurb: "Thick smoke hides the street on {friend}'s next shot.", color: '#6d7088' },
];

const BY_ID = new Map<string, Card>(CARDS.map((c) => [c.id, c]));

export const cardOf = (id: CardId): Card => BY_ID.get(id) ?? CARDS[0];
export const isCard = (value: unknown): value is CardId => typeof value === 'string' && BY_ID.has(value);

/** Solo shop prices in Kora Coins: one boost rides on one shot. */
export const BOOST_COSTS: Readonly<Record<Boost, number>> = {
  fire: 15,
  magnet: 20,
  rubber: 15,
};

/** Coins earned for a solo goal: always at least a little, more for a crazier score. */
export const coinsFor = (total: number): number => Math.max(5, Math.round(total / 100));
export const asBoost = (id: CardId | null | undefined): Boost | null => (id === 'fire' || id === 'magnet' || id === 'rubber' ? id : null);
export const asTrick = (id: CardId | null | undefined): Trick | null => (id === 'cat' || id === 'shutter' || id === 'smoke' ? id : null);
