// The Crimson Brute: heavy and deliberate. It stomps with planted feet and bent knees, its
// long clawed arm swings with a lag, and its attack is an overhead claw brought down at you.

import rig from '../rigs/crimson.json';
import { gait, move, pulse, tools } from '../motion';
import { keys } from '../solve';
import type { Animation, Creature, Pose } from '../types';

const { at, joint } = tools(rig);
const FOOT_L = joint('footL');
const FOOT_R = joint('footR');

export const crimson: Creature = {
  rig,
  halfWidth: 340,
  animate(s): Animation {
    const pose: Pose = {};
    const t = s.time;
    const g = gait(s);
    const breath = Math.sin(t * 1.7);
    let rootR = 0, rootY = 0;

    // Standing: deep breaths, a slow scan of the head, claws flexing, a snarl now and then.
    move(pose, 'hips', { y: 2 * breath });
    move(pose, 'chest', { y: -5 * breath, sx: 1 + 0.016 * breath, r: 0.01 * breath });
    move(pose, 'head', { r: 0.07 * Math.sin(t * 0.7), y: 2 * breath });
    move(pose, 'jaw', { y: 4 + 18 * pulse(t, 3.4, 0.3) });
    move(pose, 'armL_up', { r: 0.04 * Math.sin(t * 1.3) });
    move(pose, 'armL_fore', { r: 0.05 * Math.sin(t * 1.3 + 1) });
    move(pose, 'handL', { r: 0.09 * Math.sin(t * 2.9) });
    move(pose, 'armR_up', { r: -0.035 * Math.sin(t * 1.3 + 0.6) });
    move(pose, 'handR', { r: -0.08 * Math.sin(t * 2.5) });

    // Walking: the weight drops onto each foot, the chest counter-turns, the arms lag behind.
    const w = s.walk, m = s.moving;
    move(pose, 'hips', { x: 26 * g.sway, y: 34 * g.land - 8 * m, r: 0.045 * g.sway });
    move(pose, 'chest', { r: -0.085 * g.sway, sy: 1 - 0.025 * g.land });
    move(pose, 'head', { r: 0.06 * m * Math.sin(w - 0.7), y: 12 * g.land });
    move(pose, 'jaw', { y: 14 * g.land });
    move(pose, 'armL_up', { r: 0.2 * m * Math.sin(w + Math.PI) });
    move(pose, 'armL_fore', { r: 0.19 * m * Math.sin(w + Math.PI - 0.8) });
    move(pose, 'handL', { r: 0.2 * m * Math.sin(w - 1.5), y: 8 * g.land });
    move(pose, 'armR_up', { r: 0.16 * m * Math.sin(w) });
    move(pose, 'armR_fore', { r: 0.16 * m * Math.sin(w - 0.8) });
    const footL = [FOOT_L[0] - 18 * g.left, FOOT_L[1] - 96 * g.left];
    const footR = [FOOT_R[0] + 18 * g.right, FOOT_R[1] - 96 * g.right];
    move(pose, 'footL', { k: 1 + 0.13 * g.left });
    move(pose, 'footR', { k: 1 + 0.13 * g.right });

    // Attack: rear back, raise the claw high, then drive it down toward the viewer.
    const a = s.attack;
    if (a >= 0) {
      move(pose, 'armL_up', { r: keys(a, [[0, 0], [0.45, 2.35], [0.56, 2.55], [0.68, -0.08, 'in'], [0.8, -0.05], [1, 0]]), y: keys(a, [[0, 0], [0.56, -10], [0.68, 45, 'in'], [1, 0]]) });
      move(pose, 'armL_fore', {
        r: keys(a, [[0, 0], [0.45, 0.55], [0.56, 0.75], [0.68, -0.28, 'in'], [0.8, -0.24], [1, 0]]),
        k: keys(a, [[0, 1], [0.56, 1], [0.68, 1.25, 'in'], [0.8, 1.2], [1, 1]]),
      });
      move(pose, 'handL', {
        r: keys(a, [[0, 0], [0.5, 0.6], [0.68, -0.3, 'in'], [1, 0]]),
        k: keys(a, [[0, 1], [0.5, 1.05], [0.68, 1.55, 'in'], [0.8, 1.45], [1, 1]]),
      });
      move(pose, 'armR_up', { r: keys(a, [[0, 0], [0.45, -0.5], [0.68, 0.25, 'in'], [1, 0]]) });
      move(pose, 'armR_fore', { r: keys(a, [[0, 0], [0.45, -0.7], [0.68, 0.1], [1, 0]]) });
      move(pose, 'hips', { y: keys(a, [[0, 0], [0.45, 22], [0.68, 75, 'in'], [0.8, 68], [1, 0]]) });
      move(pose, 'chest', {
        r: keys(a, [[0, 0], [0.45, 0.17], [0.68, -0.2, 'in'], [0.8, -0.17], [1, 0]]),
        k: keys(a, [[0, 1], [0.45, 0.97], [0.68, 1.12, 'in'], [1, 1]]),
      });
      move(pose, 'head', {
        r: keys(a, [[0, 0], [0.45, -0.16], [0.68, 0.1], [1, 0]]),
        y: keys(a, [[0, 0], [0.45, -16], [0.68, 34, 'in'], [1, 0]]),
        k: keys(a, [[0, 1], [0.68, 1.12, 'in'], [1, 1]]),
      });
      move(pose, 'jaw', { y: keys(a, [[0, 0], [0.4, 30], [0.6, 36], [0.72, 6, 'in'], [1, 0]]) });
    }

    // Hit: the head snaps back and the shoulders give.
    if (s.hit > 0) {
      move(pose, 'head', { r: 0.28 * s.hitDir * s.hit, y: -14 * s.hit });
      move(pose, 'chest', { r: 0.08 * s.hitDir * s.hit, x: 20 * s.hitDir * s.hit });
    }

    // Death: the knees give way, the chest folds, then the whole weight topples.
    const d = s.death;
    if (d >= 0) {
      const sink = keys(d, [[0, 0], [0.45, 175, 'in'], [0.6, 160], [1, 205]]);
      move(pose, 'hips', { y: sink, x: 30 * s.deathDir * d });
      move(pose, 'chest', { r: s.deathDir * keys(d, [[0, 0], [0.5, 0.22], [1, 0.5]]), y: 40 * d });
      move(pose, 'head', { r: s.deathDir * 0.65 * d, y: 55 * d });
      move(pose, 'jaw', { y: 30 * d });
      move(pose, 'armL_up', { r: keys(d, [[0, 0], [0.3, 0.7, 'out'], [1, 0.15]]) });
      move(pose, 'armL_fore', { r: 0.4 * d });
      move(pose, 'armR_up', { r: keys(d, [[0, 0], [0.3, -0.7, 'out'], [1, -0.2]]) });
      move(pose, 'armR_fore', { r: -0.4 * d });
      rootR = s.deathDir * keys(d, [[0, 0], [0.5, 0.04], [1, 1.35, 'in']]);
      rootY = 40 * d * d;
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
    { part: 'armL_fore', a: at(105, 475), b: at(75, 800), r: 62, zone: 'torso' },
    { part: 'armR_fore', a: at(580, 405), b: at(575, 600), r: 52, zone: 'torso' },
    { part: 'thighL', a: at(275, 560), b: at(250, 785), r: 62, zone: 'legs' },
    { part: 'thighR', a: at(408, 560), b: at(440, 785), r: 62, zone: 'legs' },
    { part: 'chest', a: at(340, 450), b: at(318, 230), r: 135, zone: 'torso' },
    { part: 'shinL', a: at(250, 790), b: at(275, 1040), r: 46, zone: 'legs' },
    { part: 'shinR', a: at(440, 790), b: at(475, 1050), r: 46, zone: 'legs' },
  ],
  head: { part: 'head', at: at(312, 90), r: 68 },
  anchors: {
    claw: { part: 'handL', at: at(90, 960) },
    mouth: { part: 'head', at: at(312, 140) },
  },
  glows: [
    { part: 'head', at: at(287, 89), r: 17, colour: 0xffc83a },
    { part: 'head', at: at(333, 87), r: 17, colour: 0xffc83a },
  ],
};
