import { expect, it } from 'vitest';
import { roomOutcome } from './RoomOutcome';

it('pays a campaign clear and advances the run', () => {
  expect(roomOutcome(true, false, false)).toEqual({
    cleared: true, daily: false, dailyReplay: false,
    paysSalvage: true, updatesHighScore: true, updatesRoomBest: true,
    awardsStars: true, countsClear: true, countsCounters: true,
    advancesRun: true, noSalvage: false,
  });
});

it('pays nothing for a campaign failure', () => {
  expect(roomOutcome(false, false, false)).toEqual({
    cleared: false, daily: false, dailyReplay: false,
    paysSalvage: false, updatesHighScore: false, updatesRoomBest: false,
    awardsStars: false, countsClear: false, countsCounters: false,
    advancesRun: false, noSalvage: true,
  });
});

it('pays the daily first clear once and never advances the campaign run', () => {
  expect(roomOutcome(true, true, false)).toMatchObject({
    paysSalvage: true, updatesHighScore: true, updatesRoomBest: false,
    awardsStars: false, countsClear: true, countsCounters: true,
    advancesRun: false, noSalvage: false,
  });
});

it('makes a daily replay pure practice', () => {
  expect(roomOutcome(true, true, true)).toEqual({
    cleared: true, daily: true, dailyReplay: true,
    paysSalvage: false, updatesHighScore: false, updatesRoomBest: false,
    awardsStars: false, countsClear: false, countsCounters: false,
    advancesRun: false, noSalvage: true,
  });
});

it('pays nothing for a daily failure', () => {
  expect(roomOutcome(false, true, false)).toMatchObject({
    paysSalvage: false, updatesHighScore: false, updatesRoomBest: false,
    awardsStars: false, countsClear: false, countsCounters: false,
    advancesRun: false, noSalvage: true,
  });
});
