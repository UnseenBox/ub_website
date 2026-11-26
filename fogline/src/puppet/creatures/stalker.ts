// The Stalker: long and wrong. It picks its way on spike legs, drags a boneless tentacle arm
// that ripples behind it, tilts its sad head in sudden jerks, and cracks that arm like a whip.

import rig from '../rigs/stalker.json';
import { gait, move, pulse, tools, twitch } from '../motion';
import { keys } from '../solve';
import type { Animation, Creature, Pose } from '../types';

const { at } = tools(rig);
/** The tips of the two spike legs. */
const TIP_L = at(532, 935);
const TIP_R = at(984, 975);
/** The boneless arm, from the shoulder to the hand. */
const WHIP = ['armL_up', 'tent1', 'tent2', 'tent3', 'tent4', 'hand'];

export const stalker: Creature = {
  rig,
  halfWidth: 720,
  animate(s): Animation {
    const pose: Pose = {};
    const t = s.time;
    const g = gait(s);
    const w = s.walk, m = s.moving;
    const breath = Math.sin(t * 1.6);
    let rootR = 0, rootY = 0;

    // Standing: it sways on its stilts, its arm ripples, its claw taps, its head jerks over.
    move(pose, 'torso', { x: 12 * Math.sin(t * 0.8), y: 6 * breath, sx: 1 + 0.014 * breath });
    move(pose, 'head', { r: 0.34 * twitch(t, 1.9, 8), x: 8 * twitch(t, 2.7, 30) });
    WHIP.forEach((part, i) => move(pose, part, { r: (0.025 + 0.013 * i) * Math.sin(t * 2.1 - i * 0.85) }));
    move(pose, 'hand', { r: 0.3 * pulse(t, 2.2, 0.3) * Math.sin(t * 25) });
    move(pose, 'armR_up', { r: -0.045 * Math.sin(t * 1.1) });
    move(pose, 'armR_fore', { r: -0.24 * pulse(t, 1.8, 0.16) });

    // Walking: long high steps; the body lurches and the arm drags and whips after it.
    move(pose, 'torso', { x: 34 * g.sway, y: m * (18 - 38 * Math.abs(Math.sin(w))), r: 0.065 * g.sway });
    move(pose, 'head', { r: 0.12 * m * Math.sin(w - 1) });
    WHIP.forEach((part, i) => move(pose, part, { r: (0.06 + 0.022 * i) * m * Math.sin(w - 0.4 - i * 0.62) }));
    move(pose, 'armR_up', { r: 0.2 * m * Math.sin(w + Math.PI) });
    move(pose, 'armR_fore', { r: 0.26 * m * Math.sin(w + Math.PI - 0.8) });
    const tipL = [TIP_L[0] - 55 * g.left, TIP_L[1] - 165 * g.left];
    const tipR = [TIP_R[0] + 40 * g.right, TIP_R[1] - 165 * g.right];

    // Attack: coil the long arm back, then crack it joint by joint, flinging the hand at you.
    const a = s.attack;
    if (a >= 0) {
      const coil = [0.55, 0.42, 0.4, 0.45, 0.35, 0.5];
      const lash = [-0.55, -0.38, -0.42, -0.5, -0.45, -0.6];
      WHIP.forEach((part, i) => {
        const delay = i * 0.022;
        move(pose, part, { r: keys(a, [[0, 0], [0.45 + delay, coil[i]], [0.58 + delay, lash[i], 'in'], [0.8 + delay * 0.5, lash[i] * 0.7], [1, 0]]) });
      });
      move(pose, 'hand', { k: keys(a, [[0, 1], [0.5, 1], [0.68, 2.2, 'in'], [0.84, 1.7], [1, 1]]) });
      move(pose, 'tent4', { k: keys(a, [[0, 1], [0.55, 1], [0.68, 1.2, 'in'], [1, 1]]) });
      move(pose, 'torso', {
        r: keys(a, [[0, 0], [0.45, 0.15], [0.68, -0.14, 'in'], [1, 0]]),
        x: keys(a, [[0, 0], [0.45, 30], [0.68, -40, 'in'], [1, 0]]),
        y: keys(a, [[0, 0], [0.45, -20], [0.68, 55, 'in'], [1, 0]]),
      });
      move(pose, 'armR_up', { r: keys(a, [[0, 0], [0.5, -0.7], [0.72, 0.45, 'in'], [1, 0]]) });
      move(pose, 'armR_fore', { r: keys(a, [[0, 0], [0.5, -0.85], [0.72, 0.65, 'in'], [1, 0]]), k: keys(a, [[0, 1], [0.72, 1.2, 'in'], [1, 1]]) });
      move(pose, 'head', { k: keys(a, [[0, 1], [0.68, 1.22, 'in'], [1, 1]]), y: keys(a, [[0, 0], [0.45, -10], [0.68, 30], [1, 0]]) });
    }

    if (s.hit > 0) {
      move(pose, 'torso', { x: 28 * s.hitDir * s.hit, r: 0.08 * s.hitDir * s.hit });
      move(pose, 'head', { r: -0.4 * s.hitDir * s.hit });
      WHIP.forEach((part, i) => move(pose, part, { r: 0.07 * s.hit * Math.sin(i * 1.7) }));
    }

    // Death: the stilts skid apart, the body drops between them, the long arm goes slack.
    const d = s.death;
    if (d >= 0) {
      move(pose, 'torso', { y: keys(d, [[0, 0], [0.15, -35, 'out'], [0.7, 330, 'in'], [0.8, 305], [1, 340]]), r: s.deathDir * 0.35 * d });
      move(pose, 'head', { r: s.deathDir * keys(d, [[0, 0], [0.2, -0.8], [1, 1.3]]), y: 40 * d });
      WHIP.forEach((part, i) => move(pose, part, { r: keys(d, [[0, 0], [0.2, 0.3 * Math.cos(i)], [1, -0.08 * i * s.deathDir]]) }));
      move(pose, 'armR_up', { r: -0.9 * d });
      move(pose, 'armR_fore', { r: -0.7 * d });
      tipL[0] -= 220 * d;
      tipR[0] += 150 * d;
      rootR = s.deathDir * keys(d, [[0, 0], [0.65, 0.02], [1, 0.4, 'in']]);
      rootY = 20 * d;
    }

    return {
      pose,
      root: { r: rootR, y: rootY },
      ik: [
        { upper: 'thighL', lower: 'shinL', endAt: TIP_L, target: tipL },
        { upper: 'thighR', lower: 'shinR', endAt: TIP_R, target: tipR },
      ],
    };
  },
  hits: [
    { part: 'tent2', a: at(402, 448), b: at(378, 706), r: 30, zone: 'torso' },
    { part: 'armR_fore', a: at(905, 420), b: at(760, 740), r: 40, zone: 'torso' },
    { part: 'thighL', a: at(645, 465), b: at(578, 620), r: 42, zone: 'legs' },
    { part: 'thighR', a: at(828, 488), b: at(915, 640), r: 42, zone: 'legs' },
    { part: 'torso', a: at(730, 440), b: at(710, 120), r: 130, zone: 'torso' },
    { part: 'shinL', a: at(578, 620), b: at(535, 900), r: 30, zone: 'legs' },
    { part: 'shinR', a: at(915, 640), b: at(982, 940), r: 30, zone: 'legs' },
  ],
  head: { part: 'head', at: at(802, 180), r: 72 },
  anchors: {
    mouth: { part: 'head', at: at(815, 220) },
    claw: { part: 'hand', at: at(60, 840) },
  },
  glows: [],
};
