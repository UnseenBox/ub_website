// Side quest rules: when one is marked on the map, what a win hands over, and what the
// player holds because of it. Pure functions over the profile, so they are unit-tested.
// The profile keeps only the ids of the quests won; tools and keepsakes follow from those.

import { SIDE_QUESTS, SideQuest, questById, type QuestReward } from '../data/quests';
import { RELICS, TOOLS, type RelicId, type ToolId } from '../data/tools';
import { DEFEAT_SHARE, MissionOutcome, MissionResult, isWon } from './Campaign';
import type { ProfileData } from './Profile';

/** A won quest replayed pays this share of its Supplies. */
export const REPLAY_SHARE = 0.4;

export const questDone = (p: ProfileData, id: string): boolean => p.quests.includes(id);
export const questOpen = (p: ProfileData, q: SideQuest): boolean => isWon(p, q.after);

/** The quests marked on one act's map. */
export const questsOnMap = (p: ProfileData, act: number): SideQuest[] =>
  SIDE_QUESTS.filter((q) => q.mission.act === act && questOpen(p, q));

const won = (p: ProfileData): QuestReward[] => SIDE_QUESTS.filter((q) => questDone(p, q.id)).map((q) => q.reward);

/** Tools held, in their key order. */
export function ownedTools(p: ProfileData): ToolId[] {
  const have = new Set(won(p).filter((r) => r.kind === 'tool').map((r) => r.id));
  return TOOLS.filter((t) => have.has(t.id)).map((t) => t.id);
}

export function ownedRelics(p: ProfileData): RelicId[] {
  const have = new Set(won(p).filter((r) => r.kind === 'relic').map((r) => r.id));
  return RELICS.filter((r) => have.has(r.id)).map((r) => r.id);
}

export interface QuestOutcome extends MissionOutcome {
  /** What this win handed over, the first time. */
  reward?: QuestReward;
}

/** Books a finished side quest: its Supplies, and on the first win its prize. */
export function applyQuestResult(p: ProfileData, id: string, r: MissionResult): QuestOutcome {
  const q = questById(id)!;
  const first = r.victory && !questDone(p, id);
  const share = r.victory ? (first ? 1 : REPLAY_SHARE) : DEFEAT_SHARE * Math.max(0.25, r.totalWaves ? r.wavesCleared / r.totalWaves : 0);
  const supplies = Math.round(q.mission.supplies * share);
  p.supplies += supplies;
  p.suppliesEarned += supplies;
  p.bestKills = Math.max(p.bestKills, r.kills);
  if (first) p.quests.push(id);
  return {
    stars: 0, previousStars: 0, supplies, firstClear: first, unlockedWeapons: [], unlockedGear: [], unlockedRecruits: [],
    bonusMet: false, bunkerStar: false, reward: first ? q.reward : undefined,
  };
}
