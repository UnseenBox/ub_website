export interface RoomOutcome {
  cleared: boolean;
  daily: boolean;
  dailyReplay: boolean;
  paysSalvage: boolean;
  updatesHighScore: boolean;
  updatesRoomBest: boolean;
  awardsStars: boolean;
  countsClear: boolean;
  countsCounters: boolean;
  advancesRun: boolean;
  noSalvage: boolean;
}

/**
 * Classifies a finished room. The only thing that pays salvage, score, a room best,
 * stars, counters, or campaign progress is a genuine clear; a daily replay is practice.
 */
export function roomOutcome(cleared: boolean, daily: boolean, dailyReplay: boolean): RoomOutcome {
  if (!cleared) {
    return {
      cleared: false,
      daily,
      dailyReplay,
      paysSalvage: false,
      updatesHighScore: false,
      updatesRoomBest: false,
      awardsStars: false,
      countsClear: false,
      countsCounters: false,
      advancesRun: false,
      noSalvage: true,
    };
  }

  if (daily && dailyReplay) {
    return {
      cleared: true,
      daily: true,
      dailyReplay: true,
      paysSalvage: false,
      updatesHighScore: false,
      updatesRoomBest: false,
      awardsStars: false,
      countsClear: false,
      countsCounters: false,
      advancesRun: false,
      noSalvage: true,
    };
  }

  if (daily) {
    return {
      cleared: true,
      daily: true,
      dailyReplay: false,
      paysSalvage: true,
      updatesHighScore: true,
      updatesRoomBest: false,
      awardsStars: false,
      countsClear: true,
      countsCounters: true,
      advancesRun: false,
      noSalvage: false,
    };
  }

  return {
    cleared: true,
    daily: false,
    dailyReplay: false,
    paysSalvage: true,
    updatesHighScore: true,
    updatesRoomBest: true,
    awardsStars: true,
    countsClear: true,
    countsCounters: true,
    advancesRun: true,
    noSalvage: false,
  };
}
