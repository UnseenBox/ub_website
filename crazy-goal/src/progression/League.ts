/**
 * STREET LEAGUE: a weekly table of eight clubs, the player's KORA FC and seven rivals. A season is one week,
 * Monday to Sunday, local time. The player earns League Points (LP) in the solo campaign. The rivals' LP is worked
 * out from the season and the day, so every player sees the same believable table, and it moves each day.
 *
 * Everything here is pure: callers pass `now`, so the tests can pick any week.
 */

export type Division = 'BRONZE' | 'SILVER' | 'GOLD';
export const DIVISIONS: readonly Division[] = ['BRONZE', 'SILVER', 'GOLD'];

export const PLAYER_CLUB = 'KORA FC';
export const RIVAL_CLUBS: readonly string[] = [
  'HOUMA UNITED',
  'BAB EL OUED STARS',
  'MEDINA ROVERS',
  'CASBAH FC',
  'HARBOUR CITY',
  'ROOFTOP RANGERS',
  'NIGHT OWLS',
];
export const TABLE_SIZE = 8;

export const LP_PER_GOAL = 1;
export const LP_PER_NEW_STAR = 1;
/** Most LP one match can give in one day, so no single match is farmed. */
export const LP_CAP_PER_MATCH_PER_DAY = 20;

/** Coins for the top three (the first also gets a trophy). Everyone else gets the base prize. */
const PRIZES = [
  { coins: 300, trophy: true },
  { coins: 200, trophy: false },
  { coins: 120, trophy: false },
] as const;
export const BASE_PRIZE_COINS = 50;

/** Top two move up a division, bottom two move down. Nobody goes above GOLD or below BRONZE. */
export type Zone = 'promote' | 'relegate' | 'safe';

export interface SeasonClock {
  /** The ISO week, e.g. 2026-W48. A new season starts each Monday. */
  seasonId: string;
  /** 0 on Monday, 6 on Sunday. */
  dayIndex: number;
  /** Days left in the season, today included: 7 on Monday, 1 on Sunday. */
  daysLeft: number;
  /** The local date, e.g. 2026-11-23. A match's daily LP cap resets when this changes. */
  dayKey: string;
}

export interface SeasonResult {
  seasonId: string;
  position: number;
  division: Division;
  lp: number;
  zone: Zone;
  nextDivision: Division;
  coins: number;
  trophy: boolean;
}

export interface League {
  seasonId: string;
  /** The player's LP this season. */
  lp: number;
  division: Division;
  trophies: number;
  /** The season that ended most recently, with its prize. */
  lastSeasonResult?: SeasonResult;
  /** The season whose prize has been claimed. A result is unpaid while this is not its season. */
  rewardsPaidFor?: string;
  /** LP earned today by each match, for the daily cap. */
  day?: { key: string; byMatch: Record<string, number> };
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** The ISO week, and the year it belongs to (the year of its Thursday). */
function isoWeek(now: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

export function seasonClock(now: Date): SeasonClock {
  const { year, week } = isoWeek(now);
  const dayIndex = (now.getDay() + 6) % 7;
  return {
    seasonId: `${year}-W${pad(week)}`,
    dayIndex,
    daysLeft: 7 - dayIndex,
    dayKey: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
  };
}

/** A 32-bit hash of the text, mixed, as a number in [0, 1). The same text always gives the same number. */
function unit(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** A rival's LP by the end of the week: 30 to 169. Across seasons the top rival averages about 150, the bottom about 46. */
export const rivalWeekLp = (seasonId: string, club: string): number => 30 + Math.floor(unit(`${seasonId}|${club}`) * 140);

/** The share of the week's LP a rival has by the end of each day: uneven, so the table moves about, and 1 by Sunday. */
function dayShares(seasonId: string, club: string): number[] {
  const cumulative: number[] = [];
  let total = 0;
  for (let d = 0; d < 7; d++) {
    total += 0.6 + 0.8 * unit(`${seasonId}|${club}|${d}`);
    cumulative.push(total);
  }
  return cumulative.map((c) => c / total);
}

/** A rival's LP on `dayIndex` (0 = Monday) of the season. It goes up every day, and reaches the week's total on Sunday. */
export function rivalLp(seasonId: string, club: string, dayIndex: number): number {
  const day = Math.min(6, Math.max(0, dayIndex));
  return Math.floor(rivalWeekLp(seasonId, club) * dayShares(seasonId, club)[day]);
}

export function zoneOf(position: number, division: Division): Zone {
  if (position <= 2 && division !== 'GOLD') return 'promote';
  if (position >= TABLE_SIZE - 1 && division !== 'BRONZE') return 'relegate';
  return 'safe';
}

export interface StandingRow {
  club: string;
  lp: number;
  position: number;
  isPlayer: boolean;
  zone: Zone;
}

/**
 * The table on `dayIndex` of `seasonId`, most LP first. On a tie the player is above the rivals, and rivals are
 * in name order, so the same inputs always give the same table.
 */
export function standings(league: League, dayIndex: number, seasonId = league.seasonId): StandingRow[] {
  const rows = [
    { club: PLAYER_CLUB, lp: league.lp, isPlayer: true },
    ...RIVAL_CLUBS.map((club) => ({ club, lp: rivalLp(seasonId, club, dayIndex), isPlayer: false })),
  ];
  rows.sort((a, b) => b.lp - a.lp || Number(b.isPlayer) - Number(a.isPlayer) || (a.club < b.club ? -1 : a.club > b.club ? 1 : 0));
  return rows.map((row, i) => ({ ...row, position: i + 1, zone: zoneOf(i + 1, league.division) }));
}

export function nextDivision(division: Division, zone: Zone): Division {
  const i = DIVISIONS.indexOf(division);
  if (zone === 'promote') return DIVISIONS[Math.min(DIVISIONS.length - 1, i + 1)];
  if (zone === 'relegate') return DIVISIONS[Math.max(0, i - 1)];
  return division;
}

export function prizeFor(position: number): { coins: number; trophy: boolean } {
  const prize = PRIZES[position - 1];
  return prize ? { coins: prize.coins, trophy: prize.trophy } : { coins: BASE_PRIZE_COINS, trophy: false };
}

/** LP for one goal: 1, plus 1 for each star it won for the first time. */
export const lpForGoal = (newStars: number): number => LP_PER_GOAL + LP_PER_NEW_STAR * Math.max(0, newStars);

/**
 * Adds LP for a goal in `matchId`, up to the daily cap for that match. A goal from an earlier season gives nothing:
 * the caller settles the week first.
 */
export function addLeagueLp(league: League, now: Date, matchId: string, amount: number): { league: League; gained: number } {
  const clock = seasonClock(now);
  if (league.seasonId !== clock.seasonId) return { league, gained: 0 };
  const today = league.day && league.day.key === clock.dayKey ? league.day : { key: clock.dayKey, byMatch: {} };
  const earned = today.byMatch[matchId] ?? 0;
  const gained = Math.max(0, Math.min(Math.floor(amount), LP_CAP_PER_MATCH_PER_DAY - earned));
  return {
    league: {
      ...league,
      lp: league.lp + gained,
      day: { key: clock.dayKey, byMatch: { ...today.byMatch, [matchId]: earned + gained } },
    },
    gained,
  };
}

/** The last season's prize, while it is still unclaimed. */
export function pendingResult(league: League): SeasonResult | null {
  const result = league.lastSeasonResult;
  return result && league.rewardsPaidFor !== result.seasonId ? result : null;
}

/** Pays the pending prize once: returns its coins, counts its trophy, and marks it as paid. */
export function claimLeague(league: League): { league: League; coins: number } {
  const result = pendingResult(league);
  if (!result) return { league, coins: 0 };
  return {
    league: { ...league, rewardsPaidFor: result.seasonId, trophies: league.trophies + (result.trophy ? 1 : 0) },
    coins: result.coins,
  };
}

/**
 * When the week has changed, ends the last season: the player's final place decides promotion, relegation and
 * the prize, and a new season starts at 0 LP. An unclaimed prize from before is paid now, so it is never lost.
 * Returns the same league when the week is still the same.
 */
export function settleLeague(league: League, now: Date): { league: League; coins: number } {
  const clock = seasonClock(now);
  if (league.seasonId === clock.seasonId) return { league, coins: 0 };
  const carried = claimLeague(league);
  const past = carried.league;
  const me = standings(past, 6, past.seasonId).find((row) => row.isPlayer);
  const position = me ? me.position : TABLE_SIZE;
  const zone: Zone = me ? me.zone : 'safe';
  const prize = prizeFor(position);
  const result: SeasonResult = {
    seasonId: past.seasonId,
    position,
    division: past.division,
    lp: past.lp,
    zone,
    nextDivision: nextDivision(past.division, zone),
    coins: prize.coins,
    trophy: prize.trophy,
  };
  return {
    league: {
      seasonId: clock.seasonId,
      lp: 0,
      division: result.nextDivision,
      trophies: past.trophies,
      lastSeasonResult: result,
      rewardsPaidFor: past.rewardsPaidFor,
    },
    coins: carried.coins,
  };
}

export function freshLeague(now: Date): League {
  return { seasonId: seasonClock(now).seasonId, lp: 0, division: 'BRONZE', trophies: 0 };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
const isDivision = (v: unknown): v is Division => typeof v === 'string' && (DIVISIONS as readonly string[]).includes(v);
const isZone = (v: unknown): v is Zone => v === 'promote' || v === 'relegate' || v === 'safe';

function parseResult(raw: unknown): SeasonResult | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.seasonId !== 'string' || !isDivision(raw.division) || !isDivision(raw.nextDivision) || !isZone(raw.zone)) return null;
  if (typeof raw.trophy !== 'boolean') return null;
  const position = count(raw.position);
  if (position < 1 || position > TABLE_SIZE) return null;
  return {
    seasonId: raw.seasonId,
    position,
    division: raw.division,
    lp: count(raw.lp),
    zone: raw.zone,
    nextDivision: raw.nextDivision,
    coins: count(raw.coins),
    trophy: raw.trophy,
  };
}

/** Reads a saved league, filling in anything missing or wrong from a fresh one. */
export function parseLeague(raw: unknown, now: Date): League {
  const fresh = freshLeague(now);
  if (!isRecord(raw)) return fresh;
  const out: League = {
    seasonId: typeof raw.seasonId === 'string' && raw.seasonId ? raw.seasonId : fresh.seasonId,
    lp: count(raw.lp),
    division: isDivision(raw.division) ? raw.division : 'BRONZE',
    trophies: count(raw.trophies),
  };
  const result = parseResult(raw.lastSeasonResult);
  if (result) out.lastSeasonResult = result;
  if (typeof raw.rewardsPaidFor === 'string') out.rewardsPaidFor = raw.rewardsPaidFor;
  if (isRecord(raw.day) && typeof raw.day.key === 'string' && isRecord(raw.day.byMatch)) {
    const byMatch: Record<string, number> = {};
    for (const [id, n] of Object.entries(raw.day.byMatch)) byMatch[id] = count(n);
    out.day = { key: raw.day.key, byMatch };
  }
  return out;
}
