import { describe, expect, it } from 'vitest';
import {
  BASE_PRIZE_COINS,
  LP_CAP_PER_MATCH_PER_DAY,
  PLAYER_CLUB,
  RIVAL_CLUBS,
  addLeagueLp,
  claimLeague,
  freshLeague,
  lpForGoal,
  nextDivision,
  parseLeague,
  pendingResult,
  prizeFor,
  rivalLp,
  rivalWeekLp,
  seasonClock,
  settleLeague,
  standings,
  zoneOf,
  type League,
} from './League';

/** Local noon on the given date, so no time-zone edge can move it to another day. */
const at = (y: number, m: number, d: number): Date => new Date(y, m - 1, d, 12);

describe('the season clock', () => {
  it('a season is the ISO week, and Monday starts it', () => {
    const mon = seasonClock(at(2024, 1, 1));
    expect(mon.seasonId).toBe('2024-W01');
    expect(mon.dayIndex).toBe(0);
    expect(mon.daysLeft).toBe(7);
    expect(seasonClock(at(2024, 1, 2)).seasonId).toBe('2024-W01');
  });

  it('Sunday is the last day, with one day left', () => {
    const sun = seasonClock(at(2024, 12, 29));
    expect(sun.seasonId).toBe('2024-W52');
    expect(sun.dayIndex).toBe(6);
    expect(sun.daysLeft).toBe(1);
  });

  it('the season number follows the ISO year at New Year', () => {
    // 30 December 2024 is a Monday in ISO week 1 of 2025.
    expect(seasonClock(at(2024, 12, 30)).seasonId).toBe('2025-W01');
  });

  it('a new day has a new key, for the daily LP cap', () => {
    expect(seasonClock(at(2024, 1, 2)).dayKey).toBe('2024-01-02');
    expect(seasonClock(at(2026, 11, 23)).seasonId).toBe('2026-W48');
  });
});

describe('the rival clubs', () => {
  it('the same season and day always give the same LP', () => {
    for (const club of RIVAL_CLUBS) {
      expect(rivalLp('2024-W01', club, 3)).toBe(rivalLp('2024-W01', club, 3));
    }
  });

  it('a rival goes up every day, and on Sunday reaches the week total', () => {
    for (const club of RIVAL_CLUBS) {
      for (let d = 0; d < 6; d++) {
        expect(rivalLp('2024-W01', club, d + 1)).toBeGreaterThan(rivalLp('2024-W01', club, d));
      }
      expect(rivalLp('2024-W01', club, 6)).toBe(rivalWeekLp('2024-W01', club));
    }
  });

  it('a week total is between 30 and 169 LP', () => {
    for (let i = 0; i < 200; i++) {
      for (const club of RIVAL_CLUBS) {
        const total = rivalWeekLp(`season-${i}`, club);
        expect(total).toBeGreaterThanOrEqual(30);
        expect(total).toBeLessThanOrEqual(169);
      }
    }
  });

  it('across many seasons the leader finishes around 140 to 180 LP, and the bottom club around 30 to 50', () => {
    let leader = 0;
    let bottom = 0;
    const seasons = 300;
    for (let i = 0; i < seasons; i++) {
      const totals = RIVAL_CLUBS.map((club) => rivalWeekLp(`season-${i}`, club));
      leader += Math.max(...totals);
      bottom += Math.min(...totals);
    }
    expect(leader / seasons).toBeGreaterThanOrEqual(140);
    expect(leader / seasons).toBeLessThanOrEqual(180);
    expect(bottom / seasons).toBeGreaterThanOrEqual(30);
    expect(bottom / seasons).toBeLessThanOrEqual(50);
  });
});

describe('the table', () => {
  const league = (lp: number, division: League['division'] = 'BRONZE'): League => ({
    seasonId: '2024-W01',
    lp,
    division,
    trophies: 0,
  });

  it('has the player and seven rivals, in positions 1 to 8, most LP first', () => {
    const rows = standings(league(60), 3);
    expect(rows).toHaveLength(8);
    expect(rows.map((r) => r.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].lp).toBeGreaterThanOrEqual(rows[i].lp);
    expect(rows.filter((r) => r.isPlayer)).toHaveLength(1);
    expect(rows.find((r) => r.isPlayer)?.club).toBe(PLAYER_CLUB);
  });

  it('on a tie the player is above the rival', () => {
    const tied = rivalLp('2024-W01', 'HOUMA UNITED', 2);
    const rows = standings(league(tied), 2);
    const me = rows.findIndex((r) => r.isPlayer);
    const houma = rows.findIndex((r) => r.club === 'HOUMA UNITED');
    expect(me).toBeLessThan(houma);
  });

  it('the rivals move every day, so the table moves', () => {
    const monday = standings(league(0), 0);
    const tuesday = standings(league(0), 1);
    const lpOn = (rows: typeof monday, club: string) => rows.find((r) => r.club === club)?.lp;
    for (const club of RIVAL_CLUBS) expect(lpOn(tuesday, club)).toBeGreaterThan(lpOn(monday, club) ?? 0);
  });

  it('the top two go up and the bottom two go down, except at the top and bottom divisions', () => {
    expect(zoneOf(1, 'BRONZE')).toBe('promote');
    expect(zoneOf(2, 'SILVER')).toBe('promote');
    expect(zoneOf(1, 'GOLD')).toBe('safe');
    expect(zoneOf(8, 'SILVER')).toBe('relegate');
    expect(zoneOf(7, 'GOLD')).toBe('relegate');
    expect(zoneOf(8, 'BRONZE')).toBe('safe');
    expect(zoneOf(4, 'SILVER')).toBe('safe');
  });

  it('a player near the top ends the table with the promotion zone', () => {
    const rows = standings(league(500), 6);
    expect(rows[0].isPlayer).toBe(true);
    expect(rows[0].zone).toBe('promote');
  });
});

describe('promotion, relegation and prizes', () => {
  it('moves one division at a time, and stays in the top and bottom divisions', () => {
    expect(nextDivision('BRONZE', 'promote')).toBe('SILVER');
    expect(nextDivision('SILVER', 'promote')).toBe('GOLD');
    expect(nextDivision('GOLD', 'promote')).toBe('GOLD');
    expect(nextDivision('GOLD', 'relegate')).toBe('SILVER');
    expect(nextDivision('SILVER', 'relegate')).toBe('BRONZE');
    expect(nextDivision('BRONZE', 'relegate')).toBe('BRONZE');
    expect(nextDivision('SILVER', 'safe')).toBe('SILVER');
  });

  it('pays 300 and a trophy for first, 200 for second, 120 for third, and 50 for the rest', () => {
    expect(prizeFor(1)).toEqual({ coins: 300, trophy: true });
    expect(prizeFor(2)).toEqual({ coins: 200, trophy: false });
    expect(prizeFor(3)).toEqual({ coins: 120, trophy: false });
    expect(prizeFor(4)).toEqual({ coins: BASE_PRIZE_COINS, trophy: false });
    expect(prizeFor(8)).toEqual({ coins: 50, trophy: false });
  });

  it('a new week ends the last one: the result is kept, the player is promoted, and the table starts again', () => {
    const last: League = { seasonId: '2024-W01', lp: 500, division: 'SILVER', trophies: 0 };
    const { league, coins } = settleLeague(last, at(2024, 1, 8));
    expect(coins).toBe(0);
    expect(league.seasonId).toBe('2024-W02');
    expect(league.lp).toBe(0);
    expect(league.division).toBe('GOLD');
    expect(league.lastSeasonResult).toMatchObject({
      seasonId: '2024-W01',
      position: 1,
      division: 'SILVER',
      lp: 500,
      zone: 'promote',
      nextDivision: 'GOLD',
      coins: 300,
      trophy: true,
    });
    expect(pendingResult(league)).not.toBeNull();
  });

  it('the same week changes nothing', () => {
    const current: League = { seasonId: '2024-W01', lp: 40, division: 'BRONZE', trophies: 0 };
    expect(settleLeague(current, at(2024, 1, 3)).league).toBe(current);
  });

  it('a prize is paid once: the coins come once, and so does the trophy', () => {
    const last: League = { seasonId: '2024-W01', lp: 500, division: 'BRONZE', trophies: 0 };
    const { league } = settleLeague(last, at(2024, 1, 8));
    const first = claimLeague(league);
    expect(first.coins).toBe(300);
    expect(first.league.trophies).toBe(1);
    const second = claimLeague(first.league);
    expect(second.coins).toBe(0);
    expect(second.league.trophies).toBe(1);
    expect(pendingResult(first.league)).toBeNull();
  });

  it('an earlier prize nobody claimed is paid at the next week, so it is not lost', () => {
    const unclaimed: League = {
      seasonId: '2023-W11',
      lp: 10,
      division: 'SILVER',
      trophies: 0,
      lastSeasonResult: { seasonId: '2023-W10', position: 2, division: 'SILVER', lp: 90, zone: 'promote', nextDivision: 'GOLD', coins: 200, trophy: false },
    };
    const { league, coins } = settleLeague(unclaimed, at(2024, 1, 8));
    expect(coins).toBe(200);
    expect(league.lastSeasonResult?.seasonId).toBe('2023-W11');
    expect(league.rewardsPaidFor).toBe('2023-W10');
  });
});

describe('LP from the solo campaign', () => {
  it('a goal is 1 LP, and each star won for the first time adds 1', () => {
    expect(lpForGoal(0)).toBe(1);
    expect(lpForGoal(2)).toBe(3);
  });

  it('one match gives at most 20 LP in a day, and another match still counts', () => {
    const now = at(2024, 1, 2);
    let state = freshLeague(now);
    for (let i = 0; i < 4; i++) state = addLeagueLp(state, now, 'houma-01', 5).league;
    expect(state.lp).toBe(LP_CAP_PER_MATCH_PER_DAY);
    const capped = addLeagueLp(state, now, 'houma-01', 5);
    expect(capped.gained).toBe(0);
    const other = addLeagueLp(capped.league, now, 'houma-02', 5);
    expect(other.gained).toBe(5);
    expect(other.league.lp).toBe(LP_CAP_PER_MATCH_PER_DAY + 5);
  });

  it('the cap starts again on the next day', () => {
    const monday = at(2024, 1, 1);
    const tuesday = at(2024, 1, 2);
    let state = freshLeague(monday);
    state = addLeagueLp(state, monday, 'houma-01', 20).league;
    expect(addLeagueLp(state, monday, 'houma-01', 5).gained).toBe(0);
    expect(addLeagueLp(state, tuesday, 'houma-01', 5).gained).toBe(5);
  });

  it('a goal from an earlier season gives nothing', () => {
    const stale: League = { seasonId: '2020-W01', lp: 0, division: 'BRONZE', trophies: 0 };
    expect(addLeagueLp(stale, at(2024, 1, 2), 'houma-01', 5).gained).toBe(0);
  });
});

describe('saved leagues', () => {
  it('a missing or broken save gives a fresh league for this week', () => {
    const now = at(2024, 1, 3);
    expect(parseLeague(undefined, now)).toEqual(freshLeague(now));
    expect(freshLeague(now)).toEqual({ seasonId: '2024-W01', lp: 0, division: 'BRONZE', trophies: 0 });
  });

  it('a saved league keeps its values, and bad values are fixed', () => {
    const now = at(2024, 1, 3);
    const parsed = parseLeague({ seasonId: '2024-W01', lp: 42.7, division: 'GOLD', trophies: -3 }, now);
    expect(parsed).toMatchObject({ seasonId: '2024-W01', lp: 42, division: 'GOLD', trophies: 0 });
    expect(parseLeague({ division: 'PLATINUM' }, now).division).toBe('BRONZE');
    const badResult = parseLeague({ lastSeasonResult: { seasonId: '2023-W01', position: 9, division: 'BRONZE', lp: 1, zone: 'safe', nextDivision: 'BRONZE', coins: 50, trophy: false } }, now);
    expect(badResult.lastSeasonResult).toBeUndefined();
  });

  it('the daily LP counts survive a save', () => {
    const now = at(2024, 1, 3);
    const parsed = parseLeague({ seasonId: '2024-W01', day: { key: '2024-01-03', byMatch: { 'houma-01': 12, bad: 'x' } } }, now);
    expect(parsed.day).toEqual({ key: '2024-01-03', byMatch: { 'houma-01': 12, bad: 0 } });
  });
});
