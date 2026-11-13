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
 * Classifies a finished room. Score, a room best, stars, counters and campaign progress
 * need a genuine clear; coins are kept win or lose; a daily replay is practice.
 */
export function roomOutcome(cleared: boolean, daily: boolean, dailyReplay: boolean): RoomOutcome {
  if (!cleared) {
    // The coins knocked out of the gnomes are kept even when the room is lost: that is what
    // turns a loss into the next upgrade (a daily replay stays pure practice).
    return {
      cleared: false,
      daily,
      dailyReplay,
      paysSalvage: !dailyReplay,
      updatesHighScore: false,
      updatesRoomBest: false,
      awardsStars: false,
      countsClear: false,
      countsCounters: false,
      advancesRun: false,
      noSalvage: dailyReplay,
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
