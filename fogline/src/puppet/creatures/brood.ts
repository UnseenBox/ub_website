// The Pumpkin Brood: a hunched, insect-twitchy hauler. Its heavy claws swing like weights, its
// swollen head bobs on springs and throbs, its jaws chitter, and it rears to heave a spit.

import rig from '../rigs/brood.json';
import { gait, move, pulse, tools, twitch } from '../motion';
import { keys } from '../solve';
import type { Animation, Creature, Pose } from '../types';

const { at, joint } = tools(rig);
const FOOT_L = joint('footL');
const FOOT_R = joint('footR');

export const brood: Creature = {
  rig,
  halfWidth: 480,
  animate(s): Animation {
    const pose: Pose = {};
    const t = s.time;
    const g = gait(s);
    const w = s.walk, m = s.moving;
    const breath = Math.sin(t * 2.2);
    const throb = Math.max(0, Math.sin(t * 4.1)) ** 4;
    let rootR = 0, rootY = 0;

    // Standing: the head throbs and flicks, the jaws chitter, the claws knead the air.
    move(pose, 'hips', { y: 4 * breath });
    move(pose, 'chest', { sx: 1 + 0.025 * breath, y: -6 * breath });
    move(pose, 'head', { k: 1 + 0.03 * breath + 0.035 * throb, r: 0.16 * twitch(t, 1.15, 40) });
    move(pose, 'jaw', { y: 3 + 20 * pulse(t, 1.5, 0.45) * Math.abs(Math.sin(t * 26)) });
    move(pose, 'armL_up', { r: 0.07 * Math.sin(t * 1.15) });
    move(pose, 'armL_fore', { r: 0.1 * Math.sin(t * 1.15 - 0.9) });
    move(pose, 'handL', { r: 0.2 * Math.sin(t * 2.8) });
    move(pose, 'armR_up', { r: -0.07 * Math.sin(t * 1.15 + 1.4) });
    move(pose, 'armR_fore', { r: -0.1 * Math.sin(t * 1.15 + 0.4) });
    move(pose, 'handR', { r: -0.2 * Math.sin(t * 2.4 + 1) });

    // Walking: a lurching hunch, the claws swinging heavy and late, the head bouncing.
    move(pose, 'hips', { x: 34 * g.sway, y: 46 * g.land - 8 * m, r: 0.08 * g.sway });
    move(pose, 'chest', { r: -0.12 * g.sway, y: 14 * m * Math.max(0, Math.cos(2 * w - 0.7)) });
    move(pose, 'head', { r: 0.17 * m * Math.sin(w - 1.5), y: 28 * m * Math.sin(2 * w - 1.7) });
    move(pose, 'armL_up', { r: 0.3 * m * Math.sin(w - 0.5) });
    move(pose, 'armL_fore', { r: 0.3 * m * Math.sin(w - 1.2) });
    move(pose, 'handL', { r: 0.34 * m * Math.sin(w - 2) });
    move(pose, 'armR_up', { r: 0.3 * m * Math.sin(w - 0.5) });
    move(pose, 'armR_fore', { r: 0.28 * m * Math.sin(w - 1.2) });
    move(pose, 'handR', { r: 0.32 * m * Math.sin(w - 2) });
    const footL = [FOOT_L[0] - 24 * g.left, FOOT_L[1] - 120 * g.left];
    const footR = [FOOT_R[0] + 34 * g.right, FOOT_R[1] - 120 * g.right];
    move(pose, 'footL', { k: 1 + 0.16 * g.left });
    move(pose, 'footR', { k: 1 + 0.16 * g.right });

    // Spit: rear back and swell, head and jaws straining, then heave the head forward.
    const c = s.channel;
    if (c >= 0) {
      const rise = keys(c, [[0, 0], [0.8, 1], [1, 1.05]]);
      const shake = Math.sin(t * 34) * c * c;
      move(pose, 'hips', { y: 34 * rise });
      move(pose, 'chest', { y: -44 * rise, sx: 1 + 0.17 * rise, sy: 1 + 0.07 * rise });
      move(pose, 'head', { y: -62 * rise, k: 1 + 0.18 * rise, x: 9 * shake, r: 0.05 * shake });
      move(pose, 'jaw', { y: 48 * rise, k: 1 + 0.15 * rise });
      move(pose, 'armL_up', { r: 0.45 * rise });
      move(pose, 'armL_fore', { r: 0.3 * rise });
      move(pose, 'handL', { r: 0.55 * rise });
      move(pose, 'armR_up', { r: -0.45 * rise });
      move(pose, 'armR_fore', { r: -0.3 * rise });
      move(pose, 'handR', { r: -0.55 * rise });
    }
    const out = s.release;
    if (out >= 0) {
      move(pose, 'head', {
        y: keys(out, [[0, -65], [0.22, 100, 'in'], [0.5, 55], [1, 0]]),
        k: keys(out, [[0, 1.18], [0.22, 1.55, 'in'], [0.5, 1.3], [1, 1]]),
      });
      move(pose, 'jaw', { y: keys(out, [[0, 50], [0.22, 68], [0.4, -4, 'snap'], [0.65, 26], [1, 0]]) });
      move(pose, 'chest', { sx: keys(out, [[0, 1.17], [0.3, 0.9, 'in'], [0.6, 1.04], [1, 1]]), y: keys(out, [[0, -46], [0.25, 55, 'in'], [1, 0]]) });
      move(pose, 'armL_up', { r: keys(out, [[0, 0.47], [0.3, -0.25], [1, 0]]) });
      move(pose, 'armR_up', { r: keys(out, [[0, -0.47], [0.3, 0.25], [1, 0]]) });
    }

    // Attack: both claws swing wide, then clap shut across the front.
    const a = s.attack;
    if (a >= 0) {
      move(pose, 'armL_up', { r: keys(a, [[0, 0], [0.48, 1.05], [0.68, -0.6, 'in'], [0.82, -0.45], [1, 0]]) });
      move(pose, 'armL_fore', { r: keys(a, [[0, 0], [0.48, 0.6], [0.68, -0.65, 'in'], [1, 0]]) });
      move(pose, 'handL', { k: keys(a, [[0, 1], [0.68, 1.4, 'in'], [1, 1]]), r: keys(a, [[0, 0], [0.48, 0.5], [0.68, -0.5], [1, 0]]) });
      move(pose, 'armR_up', { r: keys(a, [[0, 0], [0.48, -1.05], [0.68, 0.6, 'in'], [0.82, 0.45], [1, 0]]) });
      move(pose, 'armR_fore', { r: keys(a, [[0, 0], [0.48, -0.6], [0.68, 0.65, 'in'], [1, 0]]) });
      move(pose, 'handR', { k: keys(a, [[0, 1], [0.68, 1.4, 'in'], [1, 1]]), r: keys(a, [[0, 0], [0.48, -0.5], [0.68, 0.5], [1, 0]]) });
      move(pose, 'head', { y: keys(a, [[0, 0], [0.48, -40], [0.68, 70, 'in'], [1, 0]]), k: keys(a, [[0, 1], [0.68, 1.25, 'in'], [1, 1]]) });
      move(pose, 'jaw', { y: keys(a, [[0, 0], [0.5, 55], [0.7, 0, 'snap'], [1, 0]]) });
      move(pose, 'hips', { y: keys(a, [[0, 0], [0.48, 20], [0.68, 70, 'in'], [1, 0]]) });
    }

    if (s.hit > 0) {
      move(pose, 'head', { r: 0.34 * s.hitDir * s.hit, y: -18 * s.hit });
      move(pose, 'chest', { x: 24 * s.hitDir * s.hit, r: 0.08 * s.hitDir * s.hit });
      move(pose, 'jaw', { y: 34 * s.hit });
    }

    // Death: the legs buckle, the heavy head drags it forward, and it rolls onto its side.
    const d = s.death;
    if (d >= 0) {
      move(pose, 'hips', { y: keys(d, [[0, 0], [0.55, 250, 'in'], [0.68, 225], [1, 265]]), x: 25 * s.deathDir * d });
      move(pose, 'chest', { r: s.deathDir * 0.35 * d, y: 70 * d });
      move(pose, 'head', { y: keys(d, [[0, 0], [0.2, -50], [0.75, 240, 'in'], [1, 225]]), r: s.deathDir * 0.55 * d, k: 1 + 0.12 * pulse(d, 1, 0.5) });
      move(pose, 'jaw', { y: 60 * d });
      move(pose, 'armL_up', { r: keys(d, [[0, 0], [0.25, 1.1, 'out'], [1, 0.4]]) });
      move(pose, 'armL_fore', { r: 0.5 * d });
      move(pose, 'armR_up', { r: keys(d, [[0, 0], [0.25, -1.1, 'out'], [1, -0.4]]) });
      move(pose, 'armR_fore', { r: -0.5 * d });
      footL[0] -= 70 * d;
      footR[0] += 70 * d;
      rootR = s.deathDir * keys(d, [[0, 0], [0.6, 0.05], [1, 0.85, 'in']]);
      rootY = 30 * d;
    }

    return {
      pose,
      root: { r: rootR, y: rootY },
      ik: [
        { upper: 'thighL', lower: 'shinL', tip: 'footL', target: footL },
        { upper: 'thighR', lower: 'shinR', tip: 'footR', target: footR },
      ],
    };
  },
  hits: [
    { part: 'armL_fore', a: at(205, 662), b: at(110, 980), r: 80, zone: 'torso' },
    { part: 'armR_fore', a: at(622, 648), b: at(820, 860), r: 80, zone: 'torso' },
    { part: 'thighL', a: at(335, 645), b: at(345, 920), r: 55, zone: 'legs' },
    { part: 'thighR', a: at(478, 622), b: at(525, 930), r: 55, zone: 'legs' },
    { part: 'chest', a: at(402, 540), b: at(440, 340), r: 160, zone: 'torso' },
    { part: 'shinL', a: at(345, 925), b: at(430, 1270), r: 48, zone: 'legs' },
    { part: 'shinR', a: at(525, 935), b: at(600, 1230), r: 44, zone: 'legs' },
  ],
  head: { part: 'head', at: at(505, 165), r: 150 },
  anchors: {
    mouth: { part: 'head', at: at(500, 285) },
    claw: { part: 'handR', at: at(800, 850) },
  },
  glows: [],
};
