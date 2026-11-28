import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../data/enemies';
import { LOCATIONS } from '../data/locations';
import { ACT_STAR_GATE, MISSIONS, missionById } from '../data/missions';
import { SIDE_QUESTS } from '../data/quests';
import { RELICS, TOOLS, TOOL_EFFECTS } from '../data/tools';
import { VIEW } from '../game/config';
import { ICONS, ITEM_ICON } from '../ui/iconPaths';
import { isActFinale, type MissionResult } from './Campaign';
import { defaultProfile, parseProfile } from './Profile';
import { applyQuestResult, ownedRelics, ownedTools, questDone, questOpen, questsOnMap } from './Quests';
import { resolveMission } from './Retention';
import { ToolBelt } from './ToolBelt';

const result = (over: Partial<MissionResult> = {}): MissionResult => ({
  victory: true, wavesCleared: 2, totalWaves: 2, kills: 20, headshots: 8, accuracy: 0.6, bunkerFraction: 0.8,
  supportsUsed: [], earned: 400, ...over,
});

describe('side quests', () => {
  it('are two to an act in Acts 1 to 4, and refer only to things that exist', () => {
    for (const act of [1, 2, 3, 4]) expect(SIDE_QUESTS.filter((q) => q.mission.act === act), `act ${act}`).toHaveLength(2);
    for (const q of SIDE_QUESTS) {
      expect(missionById(q.after)?.act, q.id).toBe(q.mission.act);
      expect(LOCATIONS[q.mission.location], q.id).toBeDefined();
      for (const w of q.mission.waves) for (const g of w.groups) expect(ENEMIES[g.enemy], `${q.id} ${g.enemy}`).toBeDefined();
      expect(resolveMission(q.id, defaultProfile(), 0)?.id).toBe(q.id);
    }
  });

  it('hand over every tool and keepsake exactly once', () => {
    const prizes = SIDE_QUESTS.map((q) => q.reward.id).sort();
    expect(prizes).toEqual([...TOOLS.map((t) => t.id), ...RELICS.map((r) => r.id)].sort());
    for (const id of prizes) expect(ICONS[ITEM_ICON[id]], id).toBeDefined();
  });

  it('sit on the map clear of the missions, the side panel and each other', () => {
    for (const q of SIDE_QUESTS) {
      const { x, y } = q.mission.map;
      expect(x).toBeGreaterThan(40);
      expect(x).toBeLessThan(890);
      expect(y).toBeGreaterThan(130);
      expect(y).toBeLessThan(VIEW.height - 40);
      const others = [...MISSIONS.filter((m) => m.act === q.mission.act), ...SIDE_QUESTS.filter((o) => o !== q && o.mission.act === q.mission.act).map((o) => o.mission)];
      for (const o of others) expect(Math.hypot(o.map.x - x, o.map.y - y), `${q.id} near ${o.id}`).toBeGreaterThan(78);
    }
  });

  it('show on the map once their mission is won', () => {
    const p = defaultProfile();
    expect(questsOnMap(p, 1)).toEqual([]);
    p.missions.a1m2 = { stars: 1, wins: 1, plays: 1, bestKills: 0, veteran: false };
    expect(questsOnMap(p, 1).map((q) => q.id)).toEqual(['s1']);
    expect(questOpen(p, SIDE_QUESTS[1])).toBe(false);
  });

  it('give the prize on the first win only, pay less after, and little for a loss', () => {
    const p = defaultProfile();
    const lost = applyQuestResult(p, 's1', result({ victory: false, wavesCleared: 1 }));
    expect(lost.reward).toBeUndefined();
    expect(ownedTools(p)).toEqual([]);
    const first = applyQuestResult(p, 's1', result());
    expect(first.reward).toEqual({ kind: 'tool', id: 'uv' });
    expect(questDone(p, 's1')).toBe(true);
    expect(ownedTools(p)).toEqual(['uv']);
    expect(first.supplies).toBeGreaterThan(lost.supplies);
    const again = applyQuestResult(p, 's1', result());
    expect(again.reward).toBeUndefined();
    expect(again.supplies).toBeLessThan(first.supplies);
    expect(p.quests).toEqual(['s1']);
    expect(p.supplies).toBe(lost.supplies + first.supplies + again.supplies);
  });

  it('are remembered in the save, which ignores ids it does not know', () => {
    const p = defaultProfile();
    applyQuestResult(p, 's5', result());
    p.quests.push('s99');
    const back = parseProfile(JSON.stringify(p))!;
    expect(back.quests).toEqual(['s5']);
    expect(ownedRelics(back)).toEqual(['sight']);
    const old = parseProfile(JSON.stringify({ ...defaultProfile(), quests: undefined }))!;
    expect(old.quests).toEqual([]);
  });
});

describe('the tool belt', () => {
  it('starts with one charge of each tool held, and spends them', () => {
    const belt = new ToolBelt(['flash', 'uv']);
    expect(belt.slots.map((s) => s.id)).toEqual(['uv', 'flash']);
    expect(belt.use('uv')).toBe(true);
    expect(belt.use('uv')).toBe(false);
    expect(belt.use('breach')).toBe(false);
  });

  it('restocks a charge a wave up to its limit, and cools between uses', () => {
    const belt = new ToolBelt(['shock']);
    belt.restock();
    belt.restock();
    expect(belt.slot('shock')!.charges).toBe(TOOL_EFFECTS.max);
    expect(belt.use('shock')).toBe(true);
    expect(belt.use('shock')).toBe(false);
    belt.update(TOOL_EFFECTS.cooldown);
    expect(belt.use('shock')).toBe(true);
  });
});

describe('Act 5: No Retreat', () => {
  const act5 = MISSIONS.filter((m) => m.act === 5);

  it('has eight missions through the pass, ending with two giants', () => {
    expect(act5).toHaveLength(8);
    const last = act5[7];
    expect(last.objective).toEqual({ kind: 'boss', enemy: 'gorger' });
    expect(last.waves.some((w) => w.groups.some((g) => g.enemy === 'colossus'))).toBe(true);
    expect(isActFinale(last)).toBe(true);
    for (const m of act5) expect(LOCATIONS[m.location], m.id).toBeDefined();
  });

  it('brings the special monsters together, and spreads its missions over the map', () => {
    const kinds = new Set(act5.flatMap((m) => m.waves.flatMap((w) => w.groups.map((g) => g.enemy))));
    for (const id of ['hollow_hound', 'stalker', 'wraith', 'brute', 'crimson_brute', 'carrion_screamer', 'lurker', 'pumpkin_brood']) expect(kinds.has(id), id).toBe(true);
    for (const a of act5) {
      expect(a.map.x).toBeLessThan(890);
      for (const b of act5) if (a !== b) expect(Math.hypot(a.map.x - b.map.x, a.map.y - b.map.y)).toBeGreaterThan(90);
    }
  });

  it('opens after the coast with enough stars', () => {
    expect(ACT_STAR_GATE[5]).toBeGreaterThan(ACT_STAR_GATE[4]);
    expect(ACT_STAR_GATE[5]).toBeLessThanOrEqual(MISSIONS.filter((m) => m.act < 5).length * 3 * 0.75);
  });
});
