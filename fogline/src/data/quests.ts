// Side quests: optional fights marked on the map. Each opens after a campaign mission is
// won, is built around one monster or one hard condition, and the first win hands over a
// special tool or a keepsake that cannot be got any other way.

import type { LocationId } from './locations';
import type { MissionDef, MissionModifiers, RadioLine } from './missions';
import type { RelicId, ToolId } from './tools';
import type { SpawnGroup, WaveDef } from './waves';

export type QuestReward = { kind: 'tool'; id: ToolId } | { kind: 'relic'; id: RelicId };

export interface SideQuest {
  id: string;
  /** The campaign mission whose win marks it on the map. */
  after: string;
  /** The twist, in a few words, for the map panel. */
  hook: string;
  reward: QuestReward;
  mission: MissionDef;
}

const g = (enemy: string, count: number, delay: number, interval: number, burst?: number): SpawnGroup =>
  ({ enemy, count, delay, interval, ...(burst ? { burst } : {}) });

interface Spec {
  id: string;
  act: number;
  after: string;
  name: string;
  hook: string;
  location: LocationId;
  place: string;
  threat: number;
  cash: number;
  supplies: number;
  map: { x: number; y: number };
  reward: QuestReward;
  waves: [string, SpawnGroup[]][];
  brief: RadioLine[];
  modifiers?: MissionModifiers;
  headshots: number;
}

function quest(s: Spec): SideQuest {
  const waves: WaveDef[] = s.waves.map(([name, groups], i) => ({
    name, groups, speedMul: 1 + 0.02 * s.act + 0.01 * i, healthMul: 1 + 0.05 * (s.act - 1) + 0.01 * i,
  }));
  return {
    id: s.id, after: s.after, hook: s.hook, reward: s.reward,
    mission: {
      id: s.id, mode: 'side', act: s.act, number: 0, name: s.name, location: s.location, place: s.place,
      objective: { kind: 'hold' }, waves, startCash: s.cash, threat: s.threat,
      issue: { weapons: [], gear: [] }, modifiers: s.modifiers,
      bonus: { kind: 'headshots', count: s.headshots }, supplies: s.supplies,
      firstClear: { weapons: [], gear: [] }, brief: s.brief, debrief: [], map: s.map,
    },
  };
}

export const SIDE_QUESTS: SideQuest[] = [
  quest({
    id: 's1', act: 1, after: 'a1m2', name: 'The Whispering Barn', hook: 'STALKERS',
    location: 'farm', place: 'Harlow old barn', threat: 15, cash: 600, supplies: 90, map: { x: 360, y: 620 },
    reward: { kind: 'tool', id: 'uv' }, headshots: 6,
    waves: [
      ['Whispers', [g('shambler', 8, 0, 2.6), g('stalker', 3, 8, 9)]],
      ['Behind You', [g('shambler', 8, 0, 2.4), g('stalker', 5, 5, 7), g('hollow_hound', 2, 14, 9)]],
    ],
    brief: [{ who: 'DOT', text: 'Something in the old barn keeps vanishing. Clear it and my violet lamp is yours.' }],
  }),
  quest({
    id: 's2', act: 1, after: 'a1m5', name: 'Kennel Run', hook: 'HOUND PACK',
    location: 'orchard', place: 'Orchard kennels', threat: 27, cash: 900, supplies: 130, map: { x: 470, y: 195 },
    reward: { kind: 'tool', id: 'shock' }, headshots: 8,
    waves: [
      ['Loose', [g('shambler', 8, 0, 2.2), g('hollow_hound', 6, 6, 5)]],
      ['The Pack', [g('hollow_hound', 10, 2, 3.4), g('shambler', 8, 0, 2.4), g('hollow_hound', 3, 30, 1.4, 3)]],
    ],
    brief: [{ who: 'DOT', text: 'The kennel pack broke out. Hold them and I will wire the fence to the generator for you.' }],
  }),
  quest({
    id: 's3', act: 2, after: 'a2m2', name: 'Shrieking Road', hook: 'SCREAMERS',
    location: 'highway', place: 'Highway 9 toll', threat: 52, cash: 1500, supplies: 220, map: { x: 150, y: 330 },
    reward: { kind: 'tool', id: 'flash' }, headshots: 12,
    waves: [
      ['First Cry', [g('shambler', 12, 0, 1.8), g('carrion_screamer', 2, 6, 14), g('hollow_hound', 4, 12, 6)]],
      ['The Chorus', [g('shambler', 14, 0, 1.6), g('carrion_screamer', 4, 4, 9), g('stalker', 5, 14, 6)]],
    ],
    brief: [{ who: 'KESTREL', text: 'The toll road is all screamers. Shut them up and I will send you a crate of flashbangs.' }],
  }),
  quest({
    id: 's4', act: 2, after: 'a2m5', name: 'The Fat of the Land', hook: 'BRUTES',
    location: 'bridge', place: 'Weighbridge', threat: 62, cash: 2200, supplies: 260, map: { x: 560, y: 170 },
    reward: { kind: 'tool', id: 'breach' }, headshots: 14,
    waves: [
      ['Heavy Load', [g('shambler', 12, 0, 1.8), g('brute', 2, 6, 20)]],
      ['Overweight', [g('shambler', 14, 0, 1.6), g('brute', 3, 4, 17), g('crimson_brute', 1, 30, 1), g('stalker', 4, 12, 8)]],
    ],
    brief: [{ who: 'VARGA', text: 'Brutes are piling up at the weighbridge. Bring them down and I will build you a charge that cracks hide.' }],
  }),
  quest({
    id: 's5', act: 3, after: 'a3m2', name: 'Hollow Night', hook: 'WRAITHS · NIGHT',
    location: 'railyard', place: 'Dark sidings', threat: 70, cash: 2400, supplies: 300, map: { x: 230, y: 370 },
    reward: { kind: 'relic', id: 'sight' }, headshots: 18, modifiers: { night: true },
    waves: [
      ['Lights Out', [g('shambler', 14, 0, 1.8), g('wraith', 5, 6, 8)]],
      ['No Stars', [g('shambler', 16, 0, 1.6), g('wraith', 8, 4, 6), g('stalker', 5, 16, 7)]],
    ],
    brief: [{ who: 'HALE', text: 'My best marksman went missing in the sidings. Find the sight he carried. It will be dark.' }],
  }),
  quest({
    id: 's6', act: 3, after: 'a3m6', name: 'Salvage Run', hook: 'CRIMSON · DROPS',
    location: 'quarry', place: 'Flooded pit', threat: 80, cash: 2800, supplies: 340, map: { x: 840, y: 520 },
    reward: { kind: 'relic', id: 'satchel' }, headshots: 20, modifiers: { drops: 24 },
    waves: [
      ['Salvage', [g('shambler', 16, 0, 1.6), g('crimson_brute', 2, 6, 22), g('spitter', 3, 10, 10)]],
      ['The Haul', [g('shambler', 18, 0, 1.4), g('crimson_brute', 3, 4, 18), g('ravager', 1, 30, 1), g('hollow_hound', 5, 14, 5)]],
    ],
    brief: [{ who: 'DOT', text: 'A whole satchel of special rounds went down in the pit. Fetch it, and mind the red ones.' }],
  }),
  quest({
    id: 's7', act: 4, after: 'a4m3', name: 'Mud Season', hook: 'LURKERS',
    location: 'harbour', place: 'Low water flats', threat: 94, cash: 3200, supplies: 380, map: { x: 215, y: 335 },
    reward: { kind: 'relic', id: 'coin' }, headshots: 24,
    waves: [
      ['Bubbles', [g('shambler', 16, 0, 1.6), g('lurker', 10, 6, 3.6)]],
      ['The Whole Beach', [g('shambler', 18, 0, 1.4), g('lurker', 16, 4, 2.4), g('wraith', 4, 18, 7), g('pumpkin_brood', 2, 12, 20)]],
    ],
    brief: [{ who: 'MARA', text: 'My lucky coin is somewhere in that mud, and so are about thirty Lurkers.' }],
  }),
  quest({
    id: 's8', act: 4, after: 'a4m7', name: 'The Last Plate', hook: 'THIN WALLS',
    location: 'fort', place: 'Fort Ashby foundry', threat: 104, cash: 4200, supplies: 440, map: { x: 440, y: 250 },
    reward: { kind: 'relic', id: 'plating' }, headshots: 24, modifiers: { bunkerMul: 0.6 },
    waves: [
      ['Cracked', [g('shambler', 16, 0, 1.6), g('ravager', 2, 6, 24), g('stalker', 6, 10, 6)]],
      ['Hold It Together', [g('shambler', 18, 0, 1.4), g('brute', 3, 4, 18), g('crimson_brute', 2, 20, 16), g('carrion_screamer', 2, 14, 20)]],
    ],
    brief: [{ who: 'BRICK', text: 'The foundry still has armour plate. Our wall is cracked, so do not let much touch it.' }],
  }),
];

export const questById = (id: string): SideQuest | undefined => SIDE_QUESTS.find((q) => q.id === id);
