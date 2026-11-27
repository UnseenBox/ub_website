// The campaign: missions in story order. A mission is a short stand (2–3 waves)
// at one place, with an objective, a bonus goal for the third star and rewards
// that stay. Act 1, "Hold the Line", and Act 2, "Push the Fog", have nine
// missions each, ending with a boss.

import { ENEMIES } from './enemies';
import type { LocationId } from './locations';
import type { RecruitId } from './squad';
import type { DefenseId, ModId, SupportId } from './upgrades';
import { WaveDef, newEnemiesInWave } from './waves';

/** Gear the player can own and bring into a mission, named like the shop items. */
export type GearId = `mod:${ModId}` | `support:${SupportId}` | `defense:${DefenseId}`;

export type BonusGoal =
  | { kind: 'headshots'; count: number }
  | { kind: 'accuracy'; fraction: number }
  | { kind: 'noSupport'; id: SupportId }
  /** Protect missions: the asset ends above this share of its health. */
  | { kind: 'assetHealth'; fraction: number }
  /** Evacuate missions: every vehicle gets through. */
  | { kind: 'saveAll' };

export type AssetKind = 'mast' | 'fuel' | 'wreck' | 'generator';

export type Objective =
  | { kind: 'hold' }
  /** A structure in the field with its own health; some of the dead go for it instead of the bunker. */
  | { kind: 'protect'; asset: AssetKind; name: string; x: number; z: number; health: number; share: number }
  /** Vehicles cross the field one after another; the dead chase them. Enough must get through. */
  | { kind: 'evacuate'; name: string; vehicles: number; mustSave: number; health: number; speed: number; z: number; interval: number; share: number }
  /** Kill the boss (it arrives with the waves). */
  | { kind: 'boss'; enemy: string }
  /** Fog nests out in the field keep spawning the dead until they are shot apart. */
  | { kind: 'nests'; count: number; health: number; spawn: { id: string; every: number } };

/** Conditions on top of the objective. */
export interface MissionModifiers {
  /** Darkness: a light around the crosshair, and flares (Q) to light up the field. */
  night?: boolean;
  /** Supply crates parachute into the field every this many seconds: shoot them to claim them. */
  drops?: number;
  /** Kill cash multiplier (Fog Surge "Bounty"). */
  cashMul?: number;
  /** Share of the bunker's health it starts with (Fog Surge "Thin walls"). */
  bunkerMul?: number;
  /** Storm: rain, a dim field and lightning that lights everything for a moment. */
  storm?: boolean;
  /** Door gunner: the battle is fought from Kestrel's helicopter, on the mounted gun. */
  chopper?: boolean;
  /** Names shown on the mission banner (Fog Surge modifiers). */
  tags?: string[];
}

export interface RadioLine {
  who: 'HALE' | 'VARGA' | 'KESTREL' | 'DOT' | 'MARA' | 'BRICK' | 'ROOK' | 'VESNA';
  text: string;
}

export interface MissionDef {
  id: string;
  /** Generated modes outside the campaign: today's Fog Surge, or Last Stand (endless). */
  mode?: 'surge' | 'endless';
  /** A Veteran replay of a won mission: tougher, bigger waves for a medal (see Campaign.veteranMission). */
  veteran?: boolean;
  act: number;
  /** 1-based position inside the act. */
  number: number;
  name: string;
  location: LocationId;
  /** Where it is, in words ("Harlow farm bunker"). */
  place: string;
  objective: Objective;
  waves: WaveDef[];
  /** Armory cash at deployment. */
  startCash: number;
  /** Recommended power (see Progression.playerPower). */
  threat: number;
  /** Weapons, gear and squad lent for this mission, on top of what the player owns. */
  issue: { weapons: string[]; gear: GearId[]; recruits?: RecruitId[] };
  modifiers?: MissionModifiers;
  bonus: BonusGoal;
  /** Supplies for a one-star win; stars and a first clear add to it. */
  supplies: number;
  /** Paid once, on the first win. */
  firstClear: { weapons: string[]; gear: GearId[]; recruits?: RecruitId[] };
  brief: RadioLine[];
  debrief: RadioLine[];
  /** Position on the valley map (map pixels, 1280×720). */
  map: { x: number; y: number };
}

const hold: Objective = { kind: 'hold' };

export const MISSIONS: MissionDef[] = [
  {
    id: 'a1m1', act: 1, number: 1, name: 'Last Light', location: 'farm', place: 'Harlow farm bunker',
    objective: hold, threat: 10, startCash: 400,
    waves: [
      { name: 'First Contact', speedMul: 1, healthMul: 1, groups: [{ enemy: 'shambler', count: 12, delay: 0, interval: 2.4 }] },
      { name: 'Out of the Fog', speedMul: 1, healthMul: 1, groups: [
        { enemy: 'shambler', count: 14, delay: 0, interval: 2.0 },
        { enemy: 'shambler', count: 6, delay: 18, interval: 1.3, burst: 2 },
      ] },
      { name: 'Hold Fast', speedMul: 1.02, healthMul: 1, groups: [
        { enemy: 'shambler', count: 20, delay: 0, interval: 1.6 },
        { enemy: 'shambler', count: 6, delay: 24, interval: 1.0, burst: 2 },
      ] },
    ],
    issue: { weapons: [], gear: [] },
    bonus: { kind: 'headshots', count: 12 },
    supplies: 100,
    firstClear: { weapons: [], gear: ['mod:double'] },
    brief: [
      { who: 'HALE', text: 'Warden, the fog is moving again. Hold this bunker until the convoys are out.' },
      { who: 'HALE', text: 'Aim for the heads. The bodies keep walking.' },
    ],
    debrief: [
      { who: 'HALE', text: 'Convoys are clear. Good shooting, Warden.' },
      { who: 'DOT', text: 'Bring me Supplies and I will tune that rifle. The Workshop is open.' },
    ],
    map: { x: 110, y: 600 },
  },
  {
    id: 'a1m2', act: 1, number: 2, name: 'Orchard Road', location: 'orchard', place: 'Orchard road checkpoint',
    objective: hold, threat: 13, startCash: 500,
    waves: [
      { name: 'Movement', speedMul: 1, healthMul: 1, groups: [
        { enemy: 'shambler', count: 14, delay: 0, interval: 2.0 },
        { enemy: 'hollow_hound', count: 1, delay: 12, interval: 18 },
      ] },
      { name: 'Fast Movers', speedMul: 1.02, healthMul: 1.02, groups: [
        { enemy: 'shambler', count: 16, delay: 0, interval: 1.8 },
        { enemy: 'hollow_hound', count: 2, delay: 8, interval: 12 },
      ] },
      { name: 'Stampede', speedMul: 1.03, healthMul: 1.03, groups: [
        { enemy: 'shambler', count: 18, delay: 0, interval: 1.6 },
        { enemy: 'hollow_hound', count: 2, delay: 6, interval: 10.2 },
        { enemy: 'hollow_hound', count: 2, delay: 34, interval: 1.8, burst: 2 },
      ] },
    ],
    issue: { weapons: ['m4'], gear: [] },
    bonus: { kind: 'headshots', count: 20 },
    supplies: 130,
    firstClear: { weapons: ['m4'], gear: [] },
    brief: [
      { who: 'HALE', text: 'The orchard road is the evacuation route. Nothing crosses it.' },
      { who: 'DOT', text: 'Supply drop brought an M4. Press 2 to switch. Win this and it is yours.' },
    ],
    debrief: [{ who: 'DOT', text: 'Keep the M4. It suits you.' }],
    map: { x: 240, y: 515 },
  },
  {
    id: 'a1m3', act: 1, number: 3, name: 'Radio Silence', location: 'farm', place: 'Harlow relay mast',
    objective: { kind: 'protect', asset: 'mast', name: 'RELAY MAST', x: -9, z: 26, health: 700, share: 0.35 },
    threat: 16, startCash: 600,
    waves: [
      { name: 'Ground Level', speedMul: 1.02, healthMul: 1.03, groups: [
        { enemy: 'shambler', count: 14, delay: 0, interval: 1.9 },
        { enemy: 'shambler', count: 2, delay: 10, interval: 6.6, burst: 2 },
      ] },
      { name: 'Close Quarters', speedMul: 1.03, healthMul: 1.04, groups: [
        { enemy: 'shambler', count: 16, delay: 0, interval: 1.7 },
        { enemy: 'hollow_hound', count: 2, delay: 8, interval: 10 },
        { enemy: 'shambler', count: 3, delay: 14, interval: 4.8, burst: 2 },
      ] },
      { name: 'Static', speedMul: 1.04, healthMul: 1.05, groups: [
        { enemy: 'shambler', count: 18, delay: 0, interval: 1.5 },
        { enemy: 'hollow_hound', count: 2, delay: 6, interval: 10.2 },
        { enemy: 'shambler', count: 4, delay: 12, interval: 4, burst: 2 },
      ] },
    ],
    issue: { weapons: [], gear: ['support:gunship'] },
    bonus: { kind: 'assetHealth', fraction: 0.6 },
    supplies: 160,
    firstClear: { weapons: [], gear: ['support:gunship'] },
    brief: [
      { who: 'HALE', text: 'That mast is our only link to the evacuation buses. Some of them will go for it. Do not let it fall.' },
      { who: 'KESTREL', text: 'Kestrel on station. Press A and I will sweep the field.' },
    ],
    debrief: [{ who: 'KESTREL', text: 'Nice flying with you, Warden. Call me any time.' }],
    map: { x: 150, y: 385 },
  },
  {
    id: 'a1m4', act: 1, number: 4, name: 'Evacuation', location: 'station', place: 'Millbrook evac station',
    objective: { kind: 'evacuate', name: 'BUS', vehicles: 3, mustSave: 2, health: 420, speed: 2.6, z: 19, interval: 32, share: 0.3 },
    threat: 20, startCash: 700,
    waves: [
      { name: 'Boarding', speedMul: 1.03, healthMul: 1.05, groups: [
        { enemy: 'shambler', count: 16, delay: 0, interval: 1.7 },
        { enemy: 'hollow_hound', count: 2, delay: 10, interval: 9 },
        { enemy: 'brute', count: 1, delay: 20, interval: 1 },
      ] },
      { name: 'Giants in the Fog', speedMul: 1.04, healthMul: 1.06, groups: [
        { enemy: 'shambler', count: 18, delay: 0, interval: 1.5 },
        { enemy: 'hollow_hound', count: 2, delay: 6, interval: 10.8 },
        { enemy: 'shambler', count: 2, delay: 14, interval: 6, burst: 2 },
        { enemy: 'brute', count: 2, delay: 12, interval: 22 },
      ] },
      { name: 'Last Seats', speedMul: 1.05, healthMul: 1.07, groups: [
        { enemy: 'shambler', count: 20, delay: 0, interval: 1.4 },
        { enemy: 'hollow_hound', count: 3, delay: 5, interval: 8 },
        { enemy: 'brute', count: 2, delay: 10, interval: 20 },
      ] },
    ],
    issue: { weapons: ['shotgun'], gear: [] },
    bonus: { kind: 'saveAll' },
    supplies: 190,
    firstClear: { weapons: ['shotgun'], gear: [] },
    brief: [
      { who: 'HALE', text: 'Three buses are leaving the station. They cross right in front of you. Get two of them out.' },
      { who: 'VARGA', text: 'Something big is walking with them. Body shots barely hurt it. Aim for the head.' },
      { who: 'DOT', text: 'Borrow my pump shotgun for the close ones.' },
    ],
    debrief: [{ who: 'DOT', text: 'Keep the shotgun. Now you need a Loadout: pick what you carry before each mission.' }],
    map: { x: 320, y: 300 },
  },
  {
    id: 'a1m5', act: 1, number: 5, name: 'Smoke Line', location: 'orchard', place: 'Orchard road, east gate',
    objective: hold, threat: 24, startCash: 800,
    waves: [
      { name: 'Shields Up', speedMul: 1.04, healthMul: 1.07, groups: [
        { enemy: 'shambler', count: 18, delay: 0, interval: 1.5 },
        { enemy: 'wraith', count: 3, delay: 8, interval: 7 },
      ] },
      { name: 'Smoke Line', speedMul: 1.05, healthMul: 1.08, groups: [
        { enemy: 'shambler', count: 20, delay: 0, interval: 1.3 },
        { enemy: 'wraith', count: 5, delay: 6, interval: 5.5 },
        { enemy: 'hollow_hound', count: 2, delay: 12, interval: 9 },
      ] },
      { name: 'Breach', speedMul: 1.06, healthMul: 1.09, groups: [
        { enemy: 'shambler', count: 22, delay: 0, interval: 1.2 },
        { enemy: 'wraith', count: 6, delay: 6, interval: 4.6 },
        { enemy: 'shambler', count: 4, delay: 14, interval: 4, burst: 2 },
        { enemy: 'brute', count: 1, delay: 20, interval: 1 },
      ] },
    ],
    issue: { weapons: [], gear: ['mod:ap'] },
    bonus: { kind: 'headshots', count: 30 },
    supplies: 220,
    firstClear: { weapons: [], gear: ['mod:ap', 'mod:fire', 'defense:wall'] },
    brief: [
      { who: 'VARGA', text: 'Wraiths. They drift in wrapped in their own smoke. Shoot early, and aim high.' },
    ],
    debrief: [
      { who: 'VARGA', text: 'Did you see that? The fog pulled back when they fell. It reacted.' },
      { who: 'DOT', text: 'New in the armory: incendiary rounds and blast shutters.' },
    ],
    map: { x: 470, y: 410 },
  },
  {
    id: 'a1m6', act: 1, number: 6, name: 'Pump Station', location: 'farm', place: 'Harlow fuel depot',
    objective: { kind: 'protect', asset: 'fuel', name: 'FUEL DEPOT', x: 8, z: 21, health: 900, share: 0.4 },
    threat: 28, startCash: 900,
    waves: [
      { name: 'Fuel Run', speedMul: 1.05, healthMul: 1.09, groups: [
        { enemy: 'shambler', count: 20, delay: 0, interval: 1.3 },
        { enemy: 'hollow_hound', count: 3, delay: 6, interval: 8 },
        { enemy: 'wraith', count: 3, delay: 12, interval: 6 },
      ] },
      { name: 'Pressure', speedMul: 1.06, healthMul: 1.1, groups: [
        { enemy: 'shambler', count: 24, delay: 0, interval: 1.1 },
        { enemy: 'hollow_hound', count: 3, delay: 4, interval: 6.9 },
        { enemy: 'shambler', count: 5, delay: 10, interval: 3.6, burst: 3 },
        { enemy: 'brute', count: 2, delay: 10, interval: 18 },
      ] },
      { name: 'Hot Zone', speedMul: 1.07, healthMul: 1.11, groups: [
        { enemy: 'shambler', count: 26, delay: 0, interval: 1.0 },
        { enemy: 'wraith', count: 5, delay: 8, interval: 4.5 },
        { enemy: 'hollow_hound', count: 4, delay: 10, interval: 6 },
        { enemy: 'brute', count: 2, delay: 14, interval: 16 },
      ] },
    ],
    issue: { weapons: ['m249'], gear: ['support:orbital'] },
    bonus: { kind: 'assetHealth', fraction: 0.6 },
    supplies: 250,
    firstClear: { weapons: ['m249'], gear: ['support:orbital'] },
    brief: [
      { who: 'HALE', text: 'That depot fuels every truck we have left. Keep them off it.' },
      { who: 'DOT', text: 'Found a SAW in the wreckage. And Command lent us the orbital lance: press S, it hits under your sights.' },
    ],
    debrief: [{ who: 'DOT', text: 'The SAW and the lance are yours now.' }],
    map: { x: 600, y: 540 },
  },
  {
    id: 'a1m7', act: 1, number: 7, name: 'Swollen Dead', location: 'orchard', place: 'Orchard packing sheds',
    objective: hold, threat: 32, startCash: 1000,
    waves: [
      { name: 'Swollen', speedMul: 1.06, healthMul: 1.11, groups: [
        { enemy: 'shambler', count: 22, delay: 0, interval: 1.2 },
        { enemy: 'pumpkin_brood', count: 1, delay: 6, interval: 24 },
        { enemy: 'hollow_hound', count: 3, delay: 10, interval: 6.9 },
      ] },
      { name: 'Burst', speedMul: 1.07, healthMul: 1.12, groups: [
        { enemy: 'shambler', count: 24, delay: 0, interval: 1.0 },
        { enemy: 'pumpkin_brood', count: 1, delay: 4, interval: 27 },
        { enemy: 'wraith', count: 5, delay: 10, interval: 4.5 },
        { enemy: 'shambler', count: 5, delay: 16, interval: 3.4, burst: 3 },
      ] },
      { name: 'Swollen Dead', speedMul: 1.08, healthMul: 1.13, groups: [
        { enemy: 'shambler', count: 28, delay: 0, interval: 0.9 },
        { enemy: 'pumpkin_brood', count: 2, delay: 4, interval: 16 },
        { enemy: 'hollow_hound', count: 5, delay: 8, interval: 4.8 },
        { enemy: 'brute', count: 3, delay: 8, interval: 14 },
      ] },
    ],
    issue: { weapons: ['m32'], gear: ['mod:cryo'] },
    bonus: { kind: 'headshots', count: 40 },
    supplies: 280,
    firstClear: { weapons: ['m32'], gear: ['mod:cryo'] },
    brief: [
      { who: 'VARGA', text: 'Pumpkin Broods. They stop short and spit at the sandbags. Shoot them while the belly is still.' },
      { who: 'DOT', text: 'Grenade launcher on loan. Lob it into the crowds.' },
    ],
    debrief: [{ who: 'DOT', text: 'Keep the M32. And the cryo rounds: they slow anything you hit.' }],
    map: { x: 690, y: 370 },
  },
  {
    id: 'a1m8', act: 1, number: 8, name: 'Last Bus', location: 'station', place: 'Millbrook evac station',
    objective: { kind: 'evacuate', name: 'BUS', vehicles: 4, mustSave: 3, health: 520, speed: 2.8, z: 20, interval: 26, share: 0.35 },
    threat: 36, startCash: 1200,
    waves: [
      { name: 'Final Call', speedMul: 1.07, healthMul: 1.13, groups: [
        { enemy: 'shambler', count: 26, delay: 0, interval: 1.0 },
        { enemy: 'hollow_hound', count: 4, delay: 4, interval: 6 },
        { enemy: 'wraith', count: 4, delay: 10, interval: 5 },
        { enemy: 'brute', count: 2, delay: 12, interval: 16 },
      ] },
      { name: 'Everyone Out', speedMul: 1.08, healthMul: 1.14, groups: [
        { enemy: 'shambler', count: 30, delay: 0, interval: 0.9, burst: 2 },
        { enemy: 'hollow_hound', count: 5, delay: 5, interval: 4.3 },
        { enemy: 'pumpkin_brood', count: 1, delay: 10, interval: 24 },
        { enemy: 'shambler', count: 6, delay: 14, interval: 2.8, burst: 3 },
        { enemy: 'brute', count: 3, delay: 8, interval: 13 },
      ] },
    ],
    issue: { weapons: [], gear: ['support:nuke'] },
    bonus: { kind: 'saveAll' },
    supplies: 320,
    firstClear: { weapons: [], gear: ['support:nuke'] },
    brief: [
      { who: 'HALE', text: 'Four buses, the last civilians in the valley. Three of them have to make it.' },
      { who: 'HALE', text: 'Command authorised one tactical nuke. Press D if the line breaks.' },
    ],
    debrief: [
      { who: 'HALE', text: 'That is everyone out. Warden, the farm line is about to break. Something huge is coming.' },
    ],
    map: { x: 800, y: 480 },
  },
  {
    id: 'a1m9', act: 1, number: 9, name: 'The Colossus', location: 'farm', place: 'Harlow farm line',
    objective: { kind: 'boss', enemy: 'colossus' },
    threat: 40, startCash: 1500,
    waves: [
      { name: 'Tremors', speedMul: 1.08, healthMul: 1.14, groups: [
        { enemy: 'shambler', count: 26, delay: 0, interval: 1.0 },
        { enemy: 'hollow_hound', count: 4, delay: 4, interval: 5.5 },
        { enemy: 'wraith', count: 5, delay: 10, interval: 4.4 },
        { enemy: 'brute', count: 2, delay: 10, interval: 15 },
      ] },
      { name: 'The Colossus', speedMul: 1.08, healthMul: 1.15, groups: [
        { enemy: 'colossus', count: 1, delay: 3, interval: 1 },
        { enemy: 'shambler', count: 30, delay: 0, interval: 1.4 },
        { enemy: 'hollow_hound', count: 4, delay: 10, interval: 7.5 },
        { enemy: 'shambler', count: 5, delay: 18, interval: 4.8, burst: 2 },
      ] },
    ],
    issue: { weapons: [], gear: [] },
    bonus: { kind: 'headshots', count: 45 },
    supplies: 450,
    firstClear: { weapons: [], gear: [] },
    brief: [
      { who: 'VARGA', text: 'It is three times the size of a Brute. The head is the only soft spot, and it gets angrier as it bleeds.' },
      { who: 'HALE', text: 'If it reaches the wall, the line is gone. Stop it, Warden.' },
    ],
    debrief: [
      { who: 'HALE', text: 'The farm line held. Command has made its decision: we stop running and push the fog back.' },
      { who: 'VARGA', text: 'If killing them thins the fog, we can walk it back to where it came from. To Meridian.' },
    ],
    map: { x: 850, y: 250 },
  },

  // ================================================================ ACT 2: PUSH THE FOG
  {
    id: 'a2m1', act: 2, number: 1, name: 'Into Millbrook', location: 'town', place: 'Millbrook high street',
    objective: hold, threat: 44, startCash: 1400,
    waves: [
      { name: 'Main Street', speedMul: 1.08, healthMul: 1.14, groups: [
        { enemy: 'shambler', count: 24, delay: 0, interval: 1.1 },
        { enemy: 'spitter', count: 2, delay: 10, interval: 12 },
        { enemy: 'hollow_hound', count: 3, delay: 8, interval: 6.4 },
      ] },
      { name: 'Acid Rain', speedMul: 1.08, healthMul: 1.15, groups: [
        { enemy: 'shambler', count: 26, delay: 0, interval: 1.0 },
        { enemy: 'spitter', count: 4, delay: 6, interval: 8 },
        { enemy: 'wraith', count: 4, delay: 12, interval: 5 },
        { enemy: 'shambler', count: 4, delay: 16, interval: 3.5, burst: 2 },
      ] },
      { name: 'Town Square', speedMul: 1.09, healthMul: 1.16, groups: [
        { enemy: 'shambler', count: 30, delay: 0, interval: 0.9 },
        { enemy: 'spitter', count: 4, delay: 4, interval: 7 },
        { enemy: 'hollow_hound', count: 5, delay: 8, interval: 4.8 },
        { enemy: 'brute', count: 2, delay: 12, interval: 16 },
      ] },
    ],
    issue: { weapons: [], gear: [], recruits: ['dot'] },
    bonus: { kind: 'headshots', count: 45 },
    supplies: 330,
    firstClear: { weapons: [], gear: [], recruits: ['dot'] },
    brief: [
      { who: 'HALE', text: 'We push into Millbrook today. Retake the high street and the fog gives ground.' },
      { who: 'DOT', text: 'I am coming up to the line with you. I will keep the walls patched.' },
    ],
    debrief: [
      { who: 'VARGA', text: 'The fog pulled back two streets. It works. It really works.' },
      { who: 'DOT', text: 'I am staying on the line. The Barracks is open: train us up with Supplies.' },
    ],
    map: { x: 120, y: 590 },
  },
  {
    id: 'a2m2', act: 2, number: 2, name: 'The Nest', location: 'town', place: 'Millbrook church square',
    objective: { kind: 'nests', count: 3, health: 1100, spawn: { id: 'shambler', every: 7 } },
    threat: 47, startCash: 1500,
    waves: [
      { name: 'Growths', speedMul: 1.09, healthMul: 1.16, groups: [
        { enemy: 'shambler', count: 22, delay: 0, interval: 1.2 },
        { enemy: 'carrion_screamer', count: 1, delay: 10, interval: 28 },
        { enemy: 'hollow_hound', count: 3, delay: 6, interval: 6.4 },
      ] },
      { name: 'Choir Practice', speedMul: 1.1, healthMul: 1.17, groups: [
        { enemy: 'shambler', count: 26, delay: 0, interval: 1.0 },
        { enemy: 'carrion_screamer', count: 2, delay: 6, interval: 15 },
        { enemy: 'spitter', count: 3, delay: 12, interval: 8 },
        { enemy: 'wraith', count: 4, delay: 16, interval: 5 },
      ] },
    ],
    issue: { weapons: ['m82'], gear: [] },
    bonus: { kind: 'headshots', count: 40 },
    supplies: 350,
    firstClear: { weapons: ['m82'], gear: [] },
    brief: [
      { who: 'VARGA', text: 'Those growths in the square are fog nests. They keep breeding the dead. Shoot them apart.' },
      { who: 'DOT', text: 'Borrow the .50. It goes through armour, and through a whole line of them.' },
    ],
    debrief: [{ who: 'DOT', text: 'Keep the .50. It suits a patient shot.' }],
    map: { x: 250, y: 500 },
  },
  {
    id: 'a2m3', act: 2, number: 3, name: 'Highway 9', location: 'highway', place: 'Highway 9 overpass',
    objective: hold, threat: 50, startCash: 1500, modifiers: { drops: 34 },
    waves: [
      { name: 'Traffic', speedMul: 1.1, healthMul: 1.17, groups: [
        { enemy: 'shambler', count: 26, delay: 0, interval: 1.0 },
        { enemy: 'hollow_hound', count: 1, delay: 10, interval: 24 },
        { enemy: 'hollow_hound', count: 4, delay: 6, interval: 5.5 },
      ] },
      { name: 'Live Wires', speedMul: 1.1, healthMul: 1.18, groups: [
        { enemy: 'shambler', count: 30, delay: 0, interval: 0.9, burst: 2 },
        { enemy: 'hollow_hound', count: 2, delay: 8, interval: 13.5 },
        { enemy: 'spitter', count: 3, delay: 12, interval: 8 },
        { enemy: 'wraith', count: 4, delay: 16, interval: 5 },
      ] },
      { name: 'Pile-Up', speedMul: 1.11, healthMul: 1.19, groups: [
        { enemy: 'shambler', count: 32, delay: 0, interval: 0.8, burst: 2 },
        { enemy: 'hollow_hound', count: 2, delay: 6, interval: 12 },
        { enemy: 'carrion_screamer', count: 1, delay: 12, interval: 28 },
        { enemy: 'brute', count: 2, delay: 14, interval: 16 },
      ] },
    ],
    issue: { weapons: [], gear: [], recruits: ['mara'] },
    bonus: { kind: 'headshots', count: 50 },
    supplies: 370,
    firstClear: { weapons: [], gear: [], recruits: ['mara'] },
    brief: [
      { who: 'HALE', text: 'A sniper has been holding the overpass alone for two days. Get her out.' },
      { who: 'MARA', text: 'About time. I take the far ones, you take the close ones. Watch the hounds: they cover ground fast.' },
      { who: 'KESTREL', text: 'Dropping supply crates on the road. Shoot the chutes before the dead get them.' },
    ],
    debrief: [{ who: 'MARA', text: 'I owe you one, Warden. I will hold the side window.' }],
    map: { x: 350, y: 390 },
  },
  {
    id: 'a2m4', act: 2, number: 4, name: 'Night Watch', location: 'town', place: 'Millbrook rooftops, night',
    objective: hold, threat: 53, startCash: 1600, modifiers: { night: true },
    waves: [
      { name: 'Lights Out', speedMul: 1.11, healthMul: 1.19, groups: [
        { enemy: 'shambler', count: 26, delay: 0, interval: 1.0 },
        { enemy: 'hollow_hound', count: 5, delay: 4, interval: 4.8 },
        { enemy: 'spitter', count: 3, delay: 10, interval: 8 },
      ] },
      { name: 'Eyes in the Dark', speedMul: 1.12, healthMul: 1.2, groups: [
        { enemy: 'shambler', count: 30, delay: 0, interval: 0.9 },
        { enemy: 'hollow_hound', count: 2, delay: 6, interval: 12.5 },
        { enemy: 'carrion_screamer', count: 1, delay: 10, interval: 28 },
        { enemy: 'shambler', count: 6, delay: 14, interval: 2.8, burst: 3 },
      ] },
      { name: 'Dawn', speedMul: 1.12, healthMul: 1.21, groups: [
        { enemy: 'shambler', count: 34, delay: 0, interval: 0.8, burst: 2 },
        { enemy: 'hollow_hound', count: 6, delay: 4, interval: 4.2 },
        { enemy: 'wraith', count: 5, delay: 10, interval: 4.5 },
        { enemy: 'brute', count: 2, delay: 14, interval: 15 },
      ] },
    ],
    issue: { weapons: [], gear: [] },
    bonus: { kind: 'headshots', count: 45 },
    supplies: 390,
    firstClear: { weapons: [], gear: [] },
    brief: [
      { who: 'HALE', text: 'Hold the rooftops until dawn. The dead do not sleep.' },
      { who: 'DOT', text: 'Your light follows your sights. Press Q to fire a flare over the field.' },
    ],
    debrief: [{ who: 'HALE', text: 'Dawn. We still hold Millbrook. Kestrel is flying recon over the highway.' }],
    map: { x: 470, y: 470 },
  },
  {
    id: 'a2m5', act: 2, number: 5, name: 'Kestrel Down', location: 'highway', place: 'Highway 9 crash site',
    objective: { kind: 'protect', asset: 'wreck', name: "KESTREL'S CHOPPER", x: 7, z: 24, health: 1100, share: 0.4 },
    threat: 56, startCash: 1700,
    waves: [
      { name: 'Mayday', speedMul: 1.12, healthMul: 1.21, groups: [
        { enemy: 'shambler', count: 28, delay: 0, interval: 1.0 },
        { enemy: 'hollow_hound', count: 5, delay: 4, interval: 4.8 },
        { enemy: 'hollow_hound', count: 1, delay: 10, interval: 24 },
      ] },
      { name: 'Hold Them Off', speedMul: 1.13, healthMul: 1.22, groups: [
        { enemy: 'shambler', count: 32, delay: 0, interval: 0.9, burst: 2 },
        { enemy: 'spitter', count: 4, delay: 6, interval: 7 },
        { enemy: 'carrion_screamer', count: 1, delay: 10, interval: 28 },
        { enemy: 'wraith', count: 5, delay: 12, interval: 4.5 },
      ] },
      { name: 'Extraction', speedMul: 1.13, healthMul: 1.23, groups: [
        { enemy: 'shambler', count: 34, delay: 0, interval: 0.8, burst: 2 },
        { enemy: 'hollow_hound', count: 6, delay: 4, interval: 3.7 },
        { enemy: 'hollow_hound', count: 2, delay: 8, interval: 12 },
        { enemy: 'brute', count: 3, delay: 10, interval: 13 },
      ] },
    ],
    issue: { weapons: [], gear: [], recruits: ['brick'] },
    bonus: { kind: 'assetHealth', fraction: 0.6 },
    supplies: 410,
    firstClear: { weapons: [], gear: [], recruits: ['brick'] },
    brief: [
      { who: 'KESTREL', text: 'Mayday, mayday! Kestrel is down on the highway. My gunner and I are pinned in the wreck.' },
      { who: 'BRICK', text: 'I am Brick, her door gunner. Keep them off the wreck and I will keep them off you.' },
    ],
    debrief: [
      { who: 'KESTREL', text: 'You came for us. I will not forget it. Get me a new bird and I am back in the air.' },
      { who: 'BRICK', text: 'Brick is with you now. Put me by a window.' },
    ],
    map: { x: 560, y: 340 },
  },
  {
    id: 'a2m6', act: 2, number: 6, name: 'Bone and Steel', location: 'bridge', place: 'Millbrook river bridge',
    objective: hold, threat: 59, startCash: 1800,
    waves: [
      { name: 'Heavy Feet', speedMul: 1.13, healthMul: 1.23, groups: [
        { enemy: 'shambler', count: 30, delay: 0, interval: 0.9 },
        { enemy: 'crimson_brute', count: 1, delay: 14, interval: 1 },
        { enemy: 'hollow_hound', count: 5, delay: 6, interval: 4.8 },
      ] },
      { name: 'Ironclad', speedMul: 1.14, healthMul: 1.24, groups: [
        { enemy: 'shambler', count: 32, delay: 0, interval: 0.85, burst: 2 },
        { enemy: 'crimson_brute', count: 1, delay: 10, interval: 40 },
        { enemy: 'wraith', count: 6, delay: 8, interval: 4 },
        { enemy: 'hollow_hound', count: 1, delay: 14, interval: 20 },
      ] },
      { name: 'Steel Tide', speedMul: 1.14, healthMul: 1.25, groups: [
        { enemy: 'shambler', count: 36, delay: 0, interval: 0.75, burst: 2 },
        { enemy: 'crimson_brute', count: 1, delay: 8, interval: 36 },
        { enemy: 'spitter', count: 4, delay: 6, interval: 7 },
        { enemy: 'shambler', count: 6, delay: 14, interval: 2.9, burst: 3 },
      ] },
    ],
    issue: { weapons: ['shotgun'], gear: [] },
    bonus: { kind: 'headshots', count: 50 },
    supplies: 430,
    firstClear: { weapons: ['shotgun'], gear: [] },
    brief: [
      { who: 'VARGA', text: 'Crimson Brutes. Plates of bone over dead muscle. Aim for the head, or load armour-piercing.' },
      { who: 'DOT', text: 'Try the shotgun when they reach the wire. Short reach, but nothing walks through it.' },
    ],
    debrief: [{ who: 'DOT', text: 'Keep the shotgun. Close work from here on.' }],
    map: { x: 660, y: 470 },
  },
  {
    id: 'a2m7', act: 2, number: 7, name: 'River Crossing', location: 'bridge', place: 'Millbrook river bridge',
    objective: { kind: 'evacuate', name: 'TRUCK', vehicles: 4, mustSave: 3, health: 650, speed: 2.9, z: 20, interval: 26, share: 0.35 },
    threat: 62, startCash: 1900, modifiers: { drops: 40 },
    waves: [
      { name: 'Convoy', speedMul: 1.14, healthMul: 1.25, groups: [
        { enemy: 'shambler', count: 32, delay: 0, interval: 0.9 },
        { enemy: 'hollow_hound', count: 6, delay: 4, interval: 4.2 },
        { enemy: 'hollow_hound', count: 2, delay: 8, interval: 12.5 },
        { enemy: 'spitter', count: 3, delay: 12, interval: 9 },
      ] },
      { name: 'Over the Water', speedMul: 1.15, healthMul: 1.26, groups: [
        { enemy: 'shambler', count: 36, delay: 0, interval: 0.8, burst: 2 },
        { enemy: 'carrion_screamer', count: 1, delay: 8, interval: 28 },
        { enemy: 'crimson_brute', count: 1, delay: 14, interval: 1 },
        { enemy: 'shambler', count: 6, delay: 12, interval: 2.9, burst: 3 },
      ] },
    ],
    issue: { weapons: [], gear: [] },
    bonus: { kind: 'saveAll' },
    supplies: 450,
    firstClear: { weapons: [], gear: [] },
    brief: [
      { who: 'HALE', text: 'Supply trucks are crossing the bridge to the east bank. Three of four have to make it.' },
    ],
    debrief: [{ who: 'HALE', text: 'East bank is ours. One more push and Millbrook is clear.' }],
    map: { x: 770, y: 380 },
  },
  {
    id: 'a2m8', act: 2, number: 8, name: 'The Hive', location: 'town', place: 'Millbrook old mill, night',
    objective: { kind: 'nests', count: 4, health: 1300, spawn: { id: 'hollow_hound', every: 20 } },
    threat: 65, startCash: 2000, modifiers: { night: true },
    waves: [
      { name: 'Hive Mind', speedMul: 1.15, healthMul: 1.26, groups: [
        { enemy: 'shambler', count: 30, delay: 0, interval: 0.9 },
        { enemy: 'carrion_screamer', count: 1, delay: 8, interval: 24 },
        { enemy: 'spitter', count: 4, delay: 10, interval: 7 },
      ] },
      { name: 'Swarm', speedMul: 1.16, healthMul: 1.27, groups: [
        { enemy: 'shambler', count: 34, delay: 0, interval: 0.8, burst: 2 },
        { enemy: 'hollow_hound', count: 2, delay: 6, interval: 12 },
        { enemy: 'crimson_brute', count: 1, delay: 12, interval: 1 },
        { enemy: 'shambler', count: 6, delay: 14, interval: 2.9, burst: 3 },
      ] },
    ],
    issue: { weapons: [], gear: [] },
    bonus: { kind: 'headshots', count: 45 },
    supplies: 470,
    firstClear: { weapons: [], gear: [] },
    brief: [
      { who: 'VARGA', text: 'The old mill is one big nest. Burn it out tonight and the fog loses the town.' },
    ],
    debrief: [
      { who: 'VARGA', text: 'Warden... I worked at Meridian. Before. I think I know what this fog is.' },
      { who: 'HALE', text: 'Later, Doctor. Something is singing on the bridge.' },
    ],
    map: { x: 820, y: 230 },
  },
  {
    id: 'a2m9', act: 2, number: 9, name: 'The Choir', location: 'bridge', place: 'Millbrook river bridge',
    objective: { kind: 'boss', enemy: 'choir' },
    threat: 68, startCash: 2400,
    waves: [
      { name: 'Overture', speedMul: 1.16, healthMul: 1.27, groups: [
        { enemy: 'shambler', count: 32, delay: 0, interval: 0.85 },
        { enemy: 'hollow_hound', count: 6, delay: 4, interval: 4.2 },
        { enemy: 'crimson_brute', count: 1, delay: 12, interval: 1 },
        { enemy: 'hollow_hound', count: 2, delay: 8, interval: 12.5 },
      ] },
      { name: 'The Choir', speedMul: 1.16, healthMul: 1.28, groups: [
        { enemy: 'choir', count: 1, delay: 3, interval: 1 },
        { enemy: 'shambler', count: 34, delay: 0, interval: 1.2 },
        { enemy: 'spitter', count: 4, delay: 10, interval: 9 },
        { enemy: 'shambler', count: 6, delay: 16, interval: 3.7, burst: 2 },
      ] },
    ],
    issue: { weapons: [], gear: [] },
    bonus: { kind: 'headshots', count: 50 },
    supplies: 600,
    firstClear: { weapons: [], gear: [] },
    brief: [
      { who: 'VARGA', text: 'The Choir. Every dead thing in the valley hears it. Kill it and the horde goes deaf.' },
      { who: 'HALE', text: 'Everything we have, Warden. Everything.' },
    ],
    debrief: [
      { who: 'HALE', text: 'Millbrook is ours. The fog is in full retreat toward the quarry.' },
      { who: 'VARGA', text: 'And beyond the quarry is Meridian. It is time I told you what we made there.' },
    ],
    map: { x: 860, y: 110 },
  },
  // ---------------------------------------------------------------- Act 3: The Source
  {
    id: 'a3m1', act: 3, number: 1, name: 'Into the Quarry', location: 'quarry', place: 'Harlow quarry road',
    objective: hold, threat: 70, startCash: 2200,
    waves: [
      { name: 'Dust', speedMul: 1.16, healthMul: 1.28, groups: [
        { enemy: 'shambler', count: 30, delay: 0, interval: 0.95 },
        { enemy: 'hollow_hound', count: 5, delay: 6, interval: 4.8 },
        { enemy: 'spitter', count: 3, delay: 10, interval: 9 },
      ] },
      { name: 'Long Arms', speedMul: 1.17, healthMul: 1.29, groups: [
        { enemy: 'shambler', count: 32, delay: 0, interval: 0.85 },
        { enemy: 'stalker', count: 6, delay: 8, interval: 4.3 },
        { enemy: 'crimson_brute', count: 1, delay: 14, interval: 1 },
      ] },
      { name: 'Rockfall', speedMul: 1.17, healthMul: 1.3, groups: [
        { enemy: 'shambler', count: 34, delay: 0, interval: 0.8, burst: 2 },
        { enemy: 'stalker', count: 8, delay: 6, interval: 3.2 },
        { enemy: 'hollow_hound', count: 1, delay: 10, interval: 20 },
        { enemy: 'shambler', count: 6, delay: 16, interval: 2.8, burst: 3 },
      ] },
    ],
    issue: { weapons: ['m32'], gear: [] },
    bonus: { kind: 'headshots', count: 55 },
    supplies: 520,
    firstClear: { weapons: ['m32'], gear: [] },
    brief: [
      { who: 'VARGA', text: 'Meridian was never a weather station. We were growing something to clean up battlefields. It learned to raise them instead.' },
      { who: 'HALE', text: 'Then we finish it, Doctor. Warden, the quarry road. Take the grenade launcher.' },
    ],
    debrief: [{ who: 'DOT', text: 'The launcher is yours. Make every round count.' }],
    map: { x: 130, y: 565 },
  },
  {
    id: 'a3m2', act: 3, number: 2, name: 'Blasting Charges', location: 'quarry', place: 'Harlow quarry, explosives store',
    objective: { kind: 'protect', asset: 'fuel', name: 'EXPLOSIVES STORE', x: -8, z: 24, health: 1300, share: 0.4 },
    threat: 73, startCash: 2300,
    waves: [
      { name: 'Powder Keg', speedMul: 1.17, healthMul: 1.3, groups: [
        { enemy: 'shambler', count: 32, delay: 0, interval: 0.9 },
        { enemy: 'stalker', count: 6, delay: 6, interval: 4 },
        { enemy: 'hollow_hound', count: 2, delay: 10, interval: 11.2 },
      ] },
      { name: 'Short Fuse', speedMul: 1.18, healthMul: 1.31, groups: [
        { enemy: 'shambler', count: 34, delay: 0, interval: 0.8, burst: 2 },
        { enemy: 'spitter', count: 4, delay: 8, interval: 7 },
        { enemy: 'crimson_brute', count: 1, delay: 12, interval: 28 },
        { enemy: 'stalker', count: 6, delay: 16, interval: 3.2 },
      ] },
    ],
    issue: { weapons: [], gear: [] },
    bonus: { kind: 'assetHealth', fraction: 0.6 },
    supplies: 540,
    firstClear: { weapons: [], gear: [] },
    brief: [
      { who: 'DOT', text: 'That store holds enough charge to open the Meridian gate. If the dead set it off, it opens us instead.' },
    ],
    debrief: [
      { who: 'DOT', text: 'With the store safe I can build attachments: mags, hollow points, speed loaders. Come see me.' },
    ],
    map: { x: 250, y: 530 },
  },
  {
    id: 'a3m3', act: 3, number: 3, name: 'Door Gunner', location: 'railyard', place: "Kestrel's helicopter over the rail yard",
    objective: { kind: 'evacuate', name: 'TRAIN', vehicles: 3, mustSave: 2, health: 1000, speed: 3.2, z: 22, interval: 30, share: 0.4 },
    threat: 76, startCash: 2000, modifiers: { chopper: true },
    waves: [
      { name: 'Wheels Up', speedMul: 1.18, healthMul: 1.31, groups: [
        { enemy: 'shambler', count: 40, delay: 0, interval: 0.7, burst: 2 },
        { enemy: 'stalker', count: 8, delay: 6, interval: 3 },
        { enemy: 'spitter', count: 3, delay: 10, interval: 8 },
      ] },
      { name: 'Hot Rails', speedMul: 1.18, healthMul: 1.32, groups: [
        { enemy: 'shambler', count: 44, delay: 0, interval: 0.65, burst: 2 },
        { enemy: 'hollow_hound', count: 6, delay: 4, interval: 4.3 },
        { enemy: 'crimson_brute', count: 1, delay: 10, interval: 28 },
        { enemy: 'hollow_hound', count: 2, delay: 14, interval: 10 },
      ] },
    ],
    issue: { weapons: ['m249'], gear: [] },
    bonus: { kind: 'saveAll' },
    supplies: 560,
    firstClear: { weapons: [], gear: [], recruits: ['kestrel'] },
    brief: [
      { who: 'KESTREL', text: 'Told you I would fly again. Strap in on the door gun, Warden. The trains are rolling out of the yard below.' },
      { who: 'HALE', text: 'Two of three trains have to clear the yard. Keep the dead off the tracks.' },
    ],
    debrief: [
      { who: 'KESTREL', text: 'Nice shooting. Put me on your squad list: I will bring the gunship when you call.' },
    ],
    map: { x: 380, y: 610 },
  },
  {
    id: 'a3m4', act: 3, number: 4, name: 'The Yard', location: 'railyard', place: 'Harlow rail yard',
    objective: { kind: 'nests', count: 3, health: 1600, spawn: { id: 'stalker', every: 11 } },
    threat: 79, startCash: 2400,
    waves: [
      { name: 'Sidings', speedMul: 1.18, healthMul: 1.32, groups: [
        { enemy: 'shambler', count: 34, delay: 0, interval: 0.85 },
        { enemy: 'carrion_screamer', count: 1, delay: 8, interval: 24 },
        { enemy: 'stalker', count: 6, delay: 10, interval: 3.7 },
      ] },
      { name: 'Roundhouse', speedMul: 1.19, healthMul: 1.33, groups: [
        { enemy: 'shambler', count: 36, delay: 0, interval: 0.8, burst: 2 },
        { enemy: 'crimson_brute', count: 1, delay: 8, interval: 24 },
        { enemy: 'spitter', count: 4, delay: 10, interval: 7 },
        { enemy: 'shambler', count: 6, delay: 14, interval: 2.9, burst: 3 },
      ] },
    ],
    issue: { weapons: [], gear: [] },
    bonus: { kind: 'headshots', count: 55 },
    supplies: 580,
    firstClear: { weapons: [], gear: [], recruits: ['rook'] },
    brief: [
      { who: 'VARGA', text: 'Nests in the sidings, and a survivor pinned down in the signal box. Burn the nests and get him out.' },
    ],
    debrief: [
      { who: 'ROOK', text: 'Rook Adeyemi, grenadier. Thought nobody was coming. Where do you want me?' },
    ],
    map: { x: 470, y: 470 },
  },
  {
    id: 'a3m5', act: 3, number: 5, name: 'Ravager', location: 'railyard', place: 'Harlow rail yard, night',
    objective: hold, threat: 82, startCash: 2500, modifiers: { night: true },
    waves: [
      { name: 'Lights Out', speedMul: 1.19, healthMul: 1.33, groups: [
        { enemy: 'shambler', count: 34, delay: 0, interval: 0.85 },
        { enemy: 'stalker', count: 8, delay: 6, interval: 3.2 },
        { enemy: 'hollow_hound', count: 1, delay: 12, interval: 20 },
      ] },
      { name: 'Something Big', speedMul: 1.19, healthMul: 1.34, groups: [
        { enemy: 'shambler', count: 34, delay: 0, interval: 0.8, burst: 2 },
        { enemy: 'ravager', count: 2, delay: 8, interval: 20 },
        { enemy: 'spitter', count: 4, delay: 10, interval: 7 },
      ] },
      { name: 'Ravaged', speedMul: 1.2, healthMul: 1.35, groups: [
        { enemy: 'shambler', count: 38, delay: 0, interval: 0.75, burst: 2 },
        { enemy: 'ravager', count: 3, delay: 6, interval: 16 },
        { enemy: 'stalker', count: 8, delay: 10, interval: 3 },
        { enemy: 'carrion_screamer', count: 1, delay: 16, interval: 24 },
      ] },
    ],
    issue: { weapons: ['m82'], gear: [] },
    bonus: { kind: 'headshots', count: 60 },
    supplies: 600,
    firstClear: { weapons: [], gear: [] },
    brief: [
      { who: 'VARGA', text: 'Something big is moving in the yard. If it is what I think, do not let it reach the wire.' },
      { who: 'DOT', text: "I found an M82 on a flat car. It is yours for tonight. Try it on the big ones." },
    ],
    debrief: [{ who: 'VARGA', text: 'Ravagers. The fog is building soldiers now. We are close to the source.' }],
    map: { x: 600, y: 540 },
  },
  {
    id: 'a3m6', act: 3, number: 6, name: 'Last Train Out', location: 'railyard', place: 'Harlow rail yard',
    objective: { kind: 'evacuate', name: 'TRAIN', vehicles: 4, mustSave: 3, health: 1100, speed: 3, z: 22, interval: 26, share: 0.4 },
    threat: 85, startCash: 2600, modifiers: { drops: 38 },
    waves: [
      { name: 'All Aboard', speedMul: 1.2, healthMul: 1.35, groups: [
        { enemy: 'shambler', count: 36, delay: 0, interval: 0.8 },
        { enemy: 'stalker', count: 10, delay: 6, interval: 2.6 },
        { enemy: 'hollow_hound', count: 2, delay: 10, interval: 11.2 },
      ] },
      { name: 'Derail', speedMul: 1.2, healthMul: 1.36, groups: [
        { enemy: 'shambler', count: 38, delay: 0, interval: 0.75, burst: 2 },
        { enemy: 'ravager', count: 2, delay: 8, interval: 18 },
        { enemy: 'crimson_brute', count: 1, delay: 12, interval: 24 },
        { enemy: 'shambler', count: 6, delay: 14, interval: 2.9, burst: 3 },
      ] },
    ],
    issue: { weapons: [], gear: [] },
    bonus: { kind: 'saveAll' },
    supplies: 620,
    firstClear: { weapons: [], gear: [] },
    brief: [
      { who: 'HALE', text: 'The last trains take the valley families south. Three of four must get out of the yard.' },
    ],
    debrief: [{ who: 'HALE', text: 'The valley is evacuated. Nothing left behind us but the fog. Now we go to Meridian.' }],
    map: { x: 700, y: 410 },
  },
  {
    id: 'a3m7', act: 3, number: 7, name: 'Meridian Gate', location: 'gate', place: 'Meridian Station, outer gate',
    objective: { kind: 'protect', asset: 'generator', name: 'GATE GENERATOR', x: 7, z: 25, health: 1500, share: 0.4 },
    threat: 88, startCash: 2700,
    waves: [
      { name: 'The Fence', speedMul: 1.2, healthMul: 1.36, groups: [
        { enemy: 'shambler', count: 38, delay: 0, interval: 0.75 },
        { enemy: 'stalker', count: 10, delay: 6, interval: 2.6 },
        { enemy: 'spitter', count: 4, delay: 10, interval: 7 },
      ] },
      { name: 'Watchtowers', speedMul: 1.21, healthMul: 1.37, groups: [
        { enemy: 'shambler', count: 40, delay: 0, interval: 0.7, burst: 2 },
        { enemy: 'ravager', count: 2, delay: 6, interval: 16 },
        { enemy: 'carrion_screamer', count: 1, delay: 10, interval: 24 },
        { enemy: 'hollow_hound', count: 2, delay: 14, interval: 12 },
      ] },
    ],
    issue: { weapons: ['m82'], gear: [] },
    bonus: { kind: 'assetHealth', fraction: 0.6 },
    supplies: 650,
    firstClear: { weapons: ['m82'], gear: [] },
    brief: [
      { who: 'DOT', text: 'The generator powers the gate locks. Keep it running while I cut us a way in.' },
    ],
    debrief: [
      { who: 'DOT', text: 'Gate is open. Keep the M82, Warden. Let it help unmake Meridian.' },
    ],
    map: { x: 620, y: 280 },
  },
  {
    id: 'a3m8', act: 3, number: 8, name: 'The Breach', location: 'gate', place: 'Meridian Station, inner yard, night',
    objective: { kind: 'nests', count: 4, health: 1800, spawn: { id: 'stalker', every: 10 } },
    threat: 91, startCash: 2800, modifiers: { night: true },
    waves: [
      { name: 'Breach', speedMul: 1.21, healthMul: 1.37, groups: [
        { enemy: 'shambler', count: 38, delay: 0, interval: 0.75 },
        { enemy: 'crimson_brute', count: 1, delay: 8, interval: 24 },
        { enemy: 'spitter', count: 4, delay: 10, interval: 7 },
      ] },
      { name: 'Deep Fog', speedMul: 1.22, healthMul: 1.38, groups: [
        { enemy: 'shambler', count: 40, delay: 0, interval: 0.7, burst: 2 },
        { enemy: 'ravager', count: 2, delay: 6, interval: 14 },
        { enemy: 'stalker', count: 10, delay: 10, interval: 2.4 },
        { enemy: 'carrion_screamer', count: 1, delay: 14, interval: 24 },
      ] },
    ],
    issue: { weapons: [], gear: [] },
    bonus: { kind: 'headshots', count: 60 },
    supplies: 680,
    firstClear: { weapons: [], gear: [] },
    brief: [
      { who: 'VARGA', text: 'The yard is all nests. Burn them and we can reach the lab. The Heart is beneath it.' },
    ],
    debrief: [
      { who: 'VARGA', text: 'I can hear it beating. Warden, whatever happens down there: thank you.' },
    ],
    map: { x: 760, y: 200 },
  },
  {
    id: 'a3m9', act: 3, number: 9, name: 'The Heart', location: 'lab', place: 'Meridian Station, the lab',
    objective: { kind: 'boss', enemy: 'heart' },
    threat: 95, startCash: 3200,
    waves: [
      { name: 'Antechamber', speedMul: 1.22, healthMul: 1.38, groups: [
        { enemy: 'shambler', count: 38, delay: 0, interval: 0.75 },
        { enemy: 'stalker', count: 10, delay: 6, interval: 2.6 },
        { enemy: 'ravager', count: 1, delay: 12, interval: 1 },
        { enemy: 'hollow_hound', count: 2, delay: 10, interval: 12.5 },
      ] },
      { name: 'The Heart', speedMul: 1.22, healthMul: 1.4, groups: [
        { enemy: 'heart', count: 1, delay: 3, interval: 1 },
        { enemy: 'shambler', count: 36, delay: 0, interval: 1.1 },
        { enemy: 'crimson_brute', count: 1, delay: 12, interval: 28 },
        { enemy: 'shambler', count: 6, delay: 16, interval: 3.7, burst: 2 },
      ] },
    ],
    issue: { weapons: [], gear: [] },
    bonus: { kind: 'headshots', count: 65 },
    supplies: 900,
    firstClear: { weapons: [], gear: [] },
    brief: [
      { who: 'VARGA', text: 'There. The Heart. Everything the fog is comes out of that. It will not come to you; it will make you come to it.' },
      { who: 'HALE', text: 'Every gun, every strike, every one of you. End it, Warden.' },
    ],
    debrief: [
      { who: 'HALE', text: 'It is dead. The fog is lifting off the whole valley. Warden... it is over.' },
    ],
    map: { x: 850, y: 120 },
  },
  // ---------------------------------------------------------------- Act 4: The Fog Returns
  {
    id: 'a4m1', act: 4, number: 1, name: 'Low Tide', location: 'harbour', place: 'Saltmarsh harbour',
    objective: hold, threat: 98, startCash: 3000,
    waves: [
      { name: 'Mudflats', speedMul: 1.22, healthMul: 1.4, groups: [
        { enemy: 'shambler', count: 36, delay: 0, interval: 0.8 },
        { enemy: 'stalker', count: 8, delay: 6, interval: 3 },
        { enemy: 'spitter', count: 3, delay: 10, interval: 8 },
      ] },
      { name: 'From Below', speedMul: 1.22, healthMul: 1.41, groups: [
        { enemy: 'shambler', count: 34, delay: 0, interval: 0.8 },
        { enemy: 'lurker', count: 10, delay: 8, interval: 3 },
        { enemy: 'crimson_brute', count: 1, delay: 12, interval: 28 },
      ] },
      { name: 'Harbour Wall', speedMul: 1.23, healthMul: 1.42, groups: [
        { enemy: 'shambler', count: 40, delay: 0, interval: 0.7, burst: 2 },
        { enemy: 'lurker', count: 12, delay: 6, interval: 2.4 },
        { enemy: 'hollow_hound', count: 2, delay: 12, interval: 11.2 },
      ] },
    ],
    issue: { weapons: [], gear: [] },
    bonus: { kind: 'headshots', count: 70 },
    supplies: 950,
    firstClear: { weapons: [], gear: [] },
    brief: [
      { who: 'VARGA', text: 'The spores went down the river to the sea. Saltmarsh woke up last night. Something is coming out of the mud.' },
      { who: 'HALE', text: 'New line, same job, Warden. Hold the harbour while the town gets out.' },
    ],
    debrief: [{ who: 'VARGA', text: 'Lurkers. They wait under the mud. Watch the near field as much as the far one.' }],
    map: { x: 120, y: 560 },
  },
  {
    id: 'a4m2', act: 4, number: 2, name: 'Container Yard', location: 'harbour', place: 'Saltmarsh container yard',
    objective: { kind: 'nests', count: 3, health: 2000, spawn: { id: 'lurker', every: 9 } },
    threat: 101, startCash: 3100,
    waves: [
      { name: 'Stacks', speedMul: 1.23, healthMul: 1.42, groups: [
        { enemy: 'shambler', count: 36, delay: 0, interval: 0.8 },
        { enemy: 'carrion_screamer', count: 1, delay: 8, interval: 24 },
        { enemy: 'stalker', count: 8, delay: 10, interval: 3 },
      ] },
      { name: 'Quayside', speedMul: 1.23, healthMul: 1.43, groups: [
        { enemy: 'shambler', count: 38, delay: 0, interval: 0.75, burst: 2 },
        { enemy: 'ravager', count: 2, delay: 8, interval: 16 },
        { enemy: 'lurker', count: 10, delay: 12, interval: 2.8 },
      ] },
    ],
    issue: { weapons: [], gear: [] },
    bonus: { kind: 'headshots', count: 70 },
    supplies: 980,
    firstClear: { weapons: [], gear: [] },
    brief: [{ who: 'DOT', text: 'Nests in the container stacks. Burn them and the harbour is ours.' }],
    debrief: [{ who: 'HALE', text: 'Harbour secure. Weather is turning, Warden. Big storm off the sea.' }],
    map: { x: 250, y: 460 },
  },
  {
    id: 'a4m3', act: 4, number: 3, name: 'Storm Warning', location: 'harbour', place: 'Saltmarsh harbour, in the storm',
    objective: hold, threat: 104, startCash: 3200, modifiers: { storm: true },
    waves: [
      { name: 'First Squall', speedMul: 1.23, healthMul: 1.43, groups: [
        { enemy: 'hollow_hound', count: 8, delay: 14, interval: 2 },
        { enemy: 'shambler', count: 38, delay: 0, interval: 0.75 },
        { enemy: 'lurker', count: 10, delay: 6, interval: 2.6 },
        { enemy: 'spitter', count: 4, delay: 10, interval: 7 },
      ] },
      { name: 'Lightning', speedMul: 1.24, healthMul: 1.44, groups: [
        { enemy: 'shambler', count: 40, delay: 0, interval: 0.7, burst: 2 },
        { enemy: 'stalker', count: 10, delay: 6, interval: 2.4 },
        { enemy: 'crimson_brute', count: 1, delay: 12, interval: 28 },
      ] },
    ],
    issue: { weapons: ['tesla'], gear: [] },
    bonus: { kind: 'headshots', count: 70 },
    supplies: 1000,
    firstClear: { weapons: ['tesla'], gear: [] },
    brief: [
      { who: 'DOT', text: "Meridian's other prototype: a Tesla gun. Each bolt jumps to the dead next to it. Fitting weather for it." },
      { who: 'HALE', text: 'You will only see them when the lightning hits. Make it count.' },
    ],
    debrief: [{ who: 'DOT', text: 'Keep the Tesla gun. Just do not fire it near me.' }],
    map: { x: 380, y: 560 },
  },
  {
    id: 'a4m4', act: 4, number: 4, name: 'Gull Point', location: 'lighthouse', place: 'Gull Point lighthouse',
    objective: { kind: 'protect', asset: 'generator', name: 'BEACON GENERATOR', x: -7, z: 25, health: 1800, share: 0.4 },
    threat: 107, startCash: 3300,
    waves: [
      { name: 'Rocks', speedMul: 1.24, healthMul: 1.44, groups: [
        { enemy: 'pumpkin_brood', count: 3, delay: 8, interval: 9 },
        { enemy: 'shambler', count: 38, delay: 0, interval: 0.75 },
        { enemy: 'lurker', count: 10, delay: 6, interval: 2.6 },
        { enemy: 'hollow_hound', count: 2, delay: 10, interval: 11.2 },
      ] },
      { name: 'High Water', speedMul: 1.24, healthMul: 1.45, groups: [
        { enemy: 'shambler', count: 40, delay: 0, interval: 0.7, burst: 2 },
        { enemy: 'ravager', count: 2, delay: 8, interval: 16 },
        { enemy: 'spitter', count: 4, delay: 10, interval: 7 },
      ] },
    ],
    issue: { weapons: [], gear: [] },
    bonus: { kind: 'assetHealth', fraction: 0.6 },
    supplies: 1020,
    firstClear: { weapons: [], gear: [] },
    brief: [{ who: 'HALE', text: 'The lighthouse beacon guides the evacuation boats. Keep its generator running.' }],
    debrief: [{ who: 'KESTREL', text: 'I can see the beacon from ten miles out. Nice work down there.' }],
    map: { x: 480, y: 420 },
  },
  {
    id: 'a4m5', act: 4, number: 5, name: 'Dead Light', location: 'lighthouse', place: 'Gull Point, night',
    objective: hold, threat: 110, startCash: 3400, modifiers: { night: true },
    waves: [
      { name: 'Spore Fall', speedMul: 1.24, healthMul: 1.45, groups: [
        { enemy: 'stalker', count: 5, delay: 12, interval: 5 },
        { enemy: 'shambler', count: 36, delay: 0, interval: 0.8 },
        { enemy: 'wraith', count: 4, delay: 6, interval: 9 },
        { enemy: 'stalker', count: 8, delay: 10, interval: 3 },
      ] },
      { name: 'Grey Air', speedMul: 1.25, healthMul: 1.46, groups: [
        { enemy: 'shambler', count: 38, delay: 0, interval: 0.75, burst: 2 },
        { enemy: 'wraith', count: 6, delay: 4, interval: 6.7 },
        { enemy: 'lurker', count: 10, delay: 10, interval: 2.6 },
      ] },
      { name: 'Choked', speedMul: 1.25, healthMul: 1.47, groups: [
        { enemy: 'shambler', count: 40, delay: 0, interval: 0.7, burst: 2 },
        { enemy: 'wraith', count: 6, delay: 4, interval: 6 },
        { enemy: 'crimson_brute', count: 1, delay: 10, interval: 28 },
        { enemy: 'carrion_screamer', count: 1, delay: 14, interval: 24 },
      ] },
    ],
    issue: { weapons: [], gear: [] },
    bonus: { kind: 'headshots', count: 75 },
    supplies: 1050,
    firstClear: { weapons: [], gear: [] },
    brief: [{ who: 'VARGA', text: 'Wraiths in the sea spray. You will lose them in their own smoke: kill them far out.' }],
    debrief: [{ who: 'VARGA', text: 'The spores are all coming from one place: Fort Ashby, up the coast.' }],
    map: { x: 600, y: 520 },
  },
  {
    id: 'a4m6', act: 4, number: 6, name: 'Fishing Fleet', location: 'lighthouse', place: 'Gull Point coast road, in the storm',
    objective: { kind: 'evacuate', name: 'TRUCK', vehicles: 4, mustSave: 3, health: 1200, speed: 3, z: 21, interval: 26, share: 0.4 },
    threat: 113, startCash: 3500, modifiers: { storm: true },
    waves: [
      { name: 'Coast Road', speedMul: 1.25, healthMul: 1.47, groups: [
        { enemy: 'carrion_screamer', count: 3, delay: 10, interval: 6 },
        { enemy: 'shambler', count: 38, delay: 0, interval: 0.75 },
        { enemy: 'lurker', count: 12, delay: 6, interval: 2.4 },
        { enemy: 'hollow_hound', count: 2, delay: 10, interval: 11.2 },
      ] },
      { name: 'Breakers', speedMul: 1.25, healthMul: 1.48, groups: [
        { enemy: 'shambler', count: 40, delay: 0, interval: 0.7, burst: 2 },
        { enemy: 'wraith', count: 4, delay: 6, interval: 9 },
        { enemy: 'ravager', count: 2, delay: 10, interval: 16 },
      ] },
    ],
    issue: { weapons: [], gear: [], recruits: ['vesna'] },
    bonus: { kind: 'saveAll' },
    supplies: 1080,
    firstClear: { weapons: [], gear: [], recruits: ['vesna'] },
    brief: [
      { who: 'VESNA', text: 'Vesna Kral, coastal artillery. My mortar is on the cliff. Point me at the far field and I will clear it.' },
      { who: 'HALE', text: 'Fishing crews are driving their catch to the boats. Three of four trucks have to make it.' },
    ],
    debrief: [{ who: 'VESNA', text: 'Put me on your squad list. The mortar comes with me.' }],
    map: { x: 700, y: 400 },
  },
  {
    id: 'a4m7', act: 4, number: 7, name: 'Fort Ashby', location: 'fort', place: 'Fort Ashby, outer walls',
    objective: { kind: 'nests', count: 4, health: 2200, spawn: { id: 'wraith', every: 14 } },
    threat: 116, startCash: 3600,
    waves: [
      { name: 'The Walls', speedMul: 1.26, healthMul: 1.48, groups: [
        { enemy: 'crimson_brute', count: 2, delay: 16, interval: 14 },
        { enemy: 'shambler', count: 40, delay: 0, interval: 0.7 },
        { enemy: 'stalker', count: 10, delay: 6, interval: 2.6 },
        { enemy: 'spitter', count: 4, delay: 10, interval: 7 },
      ] },
      { name: 'Gatehouse', speedMul: 1.26, healthMul: 1.49, groups: [
        { enemy: 'shambler', count: 42, delay: 0, interval: 0.68, burst: 2 },
        { enemy: 'lurker', count: 12, delay: 6, interval: 2.4 },
        { enemy: 'crimson_brute', count: 1, delay: 10, interval: 28 },
      ] },
    ],
    issue: { weapons: [], gear: [] },
    bonus: { kind: 'headshots', count: 75 },
    supplies: 1100,
    firstClear: { weapons: [], gear: [] },
    brief: [{ who: 'VARGA', text: 'The fort is a garden of nests. Every one you burst, the air gets clearer.' }],
    debrief: [{ who: 'VARGA', text: 'There is something huge in the inner yard. It is flowering.' }],
    map: { x: 610, y: 270 },
  },
  {
    id: 'a4m8', act: 4, number: 8, name: 'The Long Storm', location: 'fort', place: 'Fort Ashby, in the storm',
    objective: hold, threat: 119, startCash: 3700, modifiers: { storm: true, drops: 36 },
    waves: [
      { name: 'Downpour', speedMul: 1.26, healthMul: 1.5, groups: [
        { enemy: 'wraith', count: 6, delay: 9, interval: 4 },
        { enemy: 'shambler', count: 40, delay: 0, interval: 0.7 },
        { enemy: 'wraith', count: 4, delay: 6, interval: 9 },
        { enemy: 'lurker', count: 12, delay: 8, interval: 2.4 },
      ] },
      { name: 'Gale', speedMul: 1.27, healthMul: 1.51, groups: [
        { enemy: 'shambler', count: 42, delay: 0, interval: 0.66, burst: 2 },
        { enemy: 'ravager', count: 2, delay: 6, interval: 14 },
        { enemy: 'carrion_screamer', count: 1, delay: 10, interval: 24 },
        { enemy: 'hollow_hound', count: 2, delay: 14, interval: 12 },
      ] },
      { name: 'Eye of the Storm', speedMul: 1.27, healthMul: 1.52, groups: [
        { enemy: 'shambler', count: 44, delay: 0, interval: 0.64, burst: 2 },
        { enemy: 'stalker', count: 11, delay: 4, interval: 2.3 },
        { enemy: 'crimson_brute', count: 2, delay: 10, interval: 18 },
        { enemy: 'wraith', count: 4, delay: 14, interval: 7.5 },
      ] },
    ],
    issue: { weapons: [], gear: [] },
    bonus: { kind: 'headshots', count: 80 },
    supplies: 1150,
    firstClear: { weapons: [], gear: [] },
    brief: [{ who: 'HALE', text: 'The storm will not let up and neither will they. Hold until it passes.' }],
    debrief: [{ who: 'VARGA', text: 'The yard is open. The Bloom is waiting. Burst its pods first, or nothing will touch it.' }],
    map: { x: 760, y: 190 },
  },
  {
    id: 'a4m9', act: 4, number: 9, name: 'The Bloom', location: 'fort', place: 'Fort Ashby, inner yard',
    objective: { kind: 'boss', enemy: 'bloom' },
    threat: 122, startCash: 4200,
    waves: [
      { name: 'Petals', speedMul: 1.27, healthMul: 1.52, groups: [
        { enemy: 'shambler', count: 40, delay: 0, interval: 0.7 },
        { enemy: 'lurker', count: 12, delay: 6, interval: 2.4 },
        { enemy: 'ravager', count: 1, delay: 12, interval: 1 },
        { enemy: 'wraith', count: 4, delay: 10, interval: 7.5 },
      ] },
      { name: 'The Bloom', speedMul: 1.27, healthMul: 1.54, groups: [
        { enemy: 'bloom', count: 1, delay: 3, interval: 1 },
        { enemy: 'shambler', count: 38, delay: 0, interval: 1.1 },
        { enemy: 'crimson_brute', count: 1, delay: 12, interval: 28 },
        { enemy: 'stalker', count: 10, delay: 16, interval: 2.6 },
      ] },
    ],
    issue: { weapons: [], gear: [] },
    bonus: { kind: 'headshots', count: 80 },
    supplies: 1400,
    firstClear: { weapons: [], gear: [] },
    brief: [
      { who: 'VARGA', text: 'The Bloom. When it seeds, the whole coast is lost. The pods around it shield it: burst them first.' },
      { who: 'HALE', text: 'Last one, Warden. Bring everyone home.' },
    ],
    debrief: [
      { who: 'VARGA', text: 'No more spores. No more seeds. It is really over this time.' },
    ],
    map: { x: 850, y: 110 },
  },
  {
    id: 'a4m10', act: 4, number: 10, name: 'The Gorger', location: 'fort', place: 'Fort Ashby, the gate',
    objective: { kind: 'boss', enemy: 'gorger' },
    threat: 130, startCash: 4500,
    waves: [
      { name: 'Gorged', speedMul: 1.3, healthMul: 1.55, groups: [
        { enemy: 'shambler', count: 40, delay: 0, interval: 0.7 },
        { enemy: 'lurker', count: 10, delay: 6, interval: 2.4 },
        { enemy: 'crimson_brute', count: 1, delay: 10, interval: 24 },
      ] },
      { name: 'The Gorger', speedMul: 1.3, healthMul: 1.58, groups: [
        { enemy: 'gorger', count: 1, delay: 3, interval: 1 },
        { enemy: 'shambler', count: 38, delay: 0, interval: 1.1 },
        { enemy: 'stalker', count: 8, delay: 16, interval: 2.8 },
      ] },
    ],
    issue: { weapons: [], gear: [] },
    bonus: { kind: 'headshots', count: 80 },
    supplies: 1500,
    firstClear: { weapons: [], gear: [] },
    brief: [
      { who: 'VARGA', text: 'The Gorger. It ate the valley and it has not stopped eating. Its arms are the danger: keep the wire between you.' },
      { who: 'HALE', text: 'Then we make it stop, Warden.' },
    ],
    debrief: [
      { who: 'VARGA', text: 'It is down. The fog is thinning over the whole coast.' },
    ],
    map: { x: 760, y: 250 },
  },
];

/** Stars needed across earlier acts before an act's first mission opens. */
export const ACT_STAR_GATE: Record<number, number> = { 2: 15, 3: 33, 4: 55 };
export const ACT_NAMES: Record<number, string> = { 1: 'HOLD THE LINE', 2: 'PUSH THE FOG', 3: 'THE SOURCE', 4: 'THE FOG RETURNS' };

/** The gear every new player starts with. */
export const STARTING_GEAR: GearId[] = ['defense:repair'];

export function missionById(id: string): MissionDef | undefined {
  return MISSIONS.find((m) => m.id === id);
}

export function missionIndex(id: string): number {
  return MISSIONS.findIndex((m) => m.id === id);
}

/** Every wave of the campaign in order, so "new enemy" banners know what came in earlier missions. */
const CAMPAIGN_WAVES: WaveDef[] = MISSIONS.flatMap((m) => m.waves);

/** Enemy ids met for the first time in `wave` (1-based) of `missionId`. */
export function newEnemiesInMissionWave(missionId: string, wave: number): string[] {
  const i = missionIndex(missionId);
  if (i < 0) return [];
  const offset = MISSIONS.slice(0, i).reduce((n, m) => n + m.waves.length, 0);
  return newEnemiesInWave(offset + wave - 1, CAMPAIGN_WAVES);
}

export function objectiveText(o: Objective): string {
  switch (o.kind) {
    case 'hold':
      return 'Hold the line';
    case 'protect':
      return `Protect the ${o.name.toLowerCase()}`;
    case 'evacuate':
      return `Get ${o.mustSave} of ${o.vehicles} ${plural(o.name).toLowerCase()} through`;
    case 'boss':
      return `Kill ${ENEMIES[o.enemy]?.name ?? 'the boss'}`;
    case 'nests':
      return `Destroy ${o.count} fog nests`;
  }
}

/** "BUS" → "BUSES", "TRUCK" → "TRUCKS". */
export function plural(name: string): string {
  return /(S|SH|CH|X)$/i.test(name) ? `${name}ES` : `${name}S`;
}
