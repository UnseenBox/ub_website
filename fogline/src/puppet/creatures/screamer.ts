// The Carrion Screamer: a nervous, bird-like thing. It struts on jointed bird legs, flicks its
// head in sudden snaps, throws its head back and spreads its claws to shriek, and pecks.

import rig from '../rigs/screamer.json';
import { gait, move, pulse, tools, twitch } from '../motion';
import { keys } from '../solve';
import type { Animation, Creature, Pose } from '../types';

const { at, joint } = tools(rig);
const FOOT_L = joint('footL');
const FOOT_R = joint('footR');

export const screamer: Creature = {
  rig,
  halfWidth: 290,
  animate(s): Animation {
    const pose: Pose = {};
    const t = s.time;
    const g = gait(s);
    const w = s.walk, m = s.moving;
    let rootR = 0, rootY = 0;
    const still = 1 - m;

    // Standing: jerky head flicks, twitching claws, shifting weight, a swaying tail.
    move(pose, 'head', { r: 0.28 * twitch(t, 0.85, 3) * (0.35 + 0.65 * still), x: 9 * twitch(t, 1.3, 11) });
    move(pose, 'chest', { y: -3 * Math.sin(t * 2.6), r: 0.025 * Math.sin(t * 0.9) });
    move(pose, 'hips', { x: 9 * still * Math.sin(t * 0.9), y: 3 * Math.sin(t * 2.6) });
    move(pose, 'handL', { r: 0.22 * pulse(t, 1.7, 0.2) * Math.sin(t * 38) });
    move(pose, 'handR', { r: -0.2 * pulse(t + 0.9, 2.3, 0.2) * Math.sin(t * 34) });
    move(pose, 'armL_up', { r: 0.05 * Math.sin(t * 1.5) });
    move(pose, 'armR_up', { r: -0.05 * Math.sin(t * 1.5 + 1) });
    move(pose, 'tail', { r: 0.11 * Math.sin(t * 2.1) + 0.16 * m * Math.sin(2 * w) });

    // Walking: a high strut. The body bounces and the head holds, then darts forward.
    move(pose, 'hips', { y: m * (12 - 28 * Math.abs(Math.sin(w))), x: 20 * g.sway, r: 0.05 * g.sway });
    move(pose, 'chest', { r: -0.07 * g.sway });
    move(pose, 'head', { x: -26 * m * Math.sin(2 * w), y: 17 * m * Math.cos(2 * w) });
    move(pose, 'armL_up', { r: 0.26 * m * Math.sin(w + Math.PI) });
    move(pose, 'armL_fore', { r: 0.3 * m * Math.sin(w + Math.PI - 0.7) });
    move(pose, 'armR_up', { r: 0.24 * m * Math.sin(w) });
    move(pose, 'armR_fore', { r: 0.26 * m * Math.sin(w - 0.7) });
    const footL = [FOOT_L[0] - 34 * g.left, FOOT_L[1] - 125 * g.left];
    const footR = [FOOT_R[0] + 22 * g.right, FOOT_R[1] - 115 * g.right];
    move(pose, 'footL', { k: 1 + 0.16 * g.left });
    move(pose, 'footR', { k: 1 + 0.16 * g.right });
    let hockL = -0.7 * g.left, hockR = -0.55 * g.right;
    let toeL = 0.55 * g.left, toeR = 0.45 * g.right;

    // Shriek: crouch, throw the head back, flare the arms and tail, then lunge it out.
    const c = s.channel;
    if (c >= 0) {
      const rise = keys(c, [[0, 0], [0.4, 1, 'out'], [1, 1]]);
      const shake = Math.sin(t * 46) * c;
      move(pose, 'head', { r: 0.78 * rise + 0.05 * shake, y: -34 * rise, k: 1 + 0.16 * rise });
      move(pose, 'chest', { y: -22 * rise, r: 0.1 * rise, x: 3 * shake });
      move(pose, 'hips', { y: 34 * rise });
      move(pose, 'armL_up', { r: 1.05 * rise + 0.05 * shake });
      move(pose, 'armL_fore', { r: 0.7 * rise });
      move(pose, 'handL', { r: 0.55 * rise });
      move(pose, 'armR_up', { r: -1.15 * rise - 0.05 * shake });
      move(pose, 'armR_fore', { r: -0.75 * rise });
      move(pose, 'handR', { r: -0.55 * rise });
      move(pose, 'tail', { r: -0.55 * rise + 0.08 * shake });
    }
    const out = s.release;
    if (out >= 0) {
      move(pose, 'head', {
        r: keys(out, [[0, 0.78], [0.18, -0.35, 'in'], [0.7, -0.25], [1, 0]]),
        x: keys(out, [[0, 0], [0.18, -45, 'in'], [1, 0]]) + 5 * Math.sin(t * 60) * (1 - out),
        y: keys(out, [[0, -34], [0.18, 55, 'in'], [0.7, 35], [1, 0]]),
        k: keys(out, [[0, 1.16], [0.18, 1.42, 'in'], [0.7, 1.25], [1, 1]]),
      });
      move(pose, 'armL_up', { r: keys(out, [[0, 1.05], [0.5, 0.6], [1, 0]]) });
      move(pose, 'armR_up', { r: keys(out, [[0, -1.15], [0.5, -0.65], [1, 0]]) });
      move(pose, 'tail', { r: keys(out, [[0, -0.55], [1, 0]]) });
    }

    // Attack: coil the neck, hook with the right claw and stab the beak at the viewer.
    const a = s.attack;
    if (a >= 0) {
      move(pose, 'head', {
        r: keys(a, [[0, 0], [0.48, 0.65], [0.68, -0.4, 'in'], [0.82, -0.3], [1, 0]]),
        x: keys(a, [[0, 0], [0.48, 30], [0.68, -50, 'in'], [1, 0]]),
        y: keys(a, [[0, 0], [0.48, -40], [0.68, 90, 'in'], [0.82, 70], [1, 0]]),
        k: keys(a, [[0, 1], [0.48, 0.94], [0.68, 1.55, 'in'], [0.82, 1.4], [1, 1]]),
      });
      move(pose, 'armR_up', { r: keys(a, [[0, 0], [0.5, -1.9], [0.68, 0.55, 'in'], [0.82, 0.45], [1, 0]]) });
      move(pose, 'armR_fore', { r: keys(a, [[0, 0], [0.5, -0.8], [0.68, 0.5, 'in'], [1, 0]]) });
      move(pose, 'handR', { k: keys(a, [[0, 1], [0.68, 1.4, 'in'], [1, 1]]), r: keys(a, [[0, 0], [0.5, -0.5], [0.68, 0.4], [1, 0]]) });
      move(pose, 'armL_up', { r: keys(a, [[0, 0], [0.48, 0.8], [0.68, -0.3], [1, 0]]) });
      move(pose, 'chest', { r: keys(a, [[0, 0], [0.48, 0.14], [0.68, -0.18, 'in'], [1, 0]]) });
      move(pose, 'hips', { y: keys(a, [[0, 0], [0.48, 40], [0.68, 8, 'in'], [1, 0]]) });
      move(pose, 'tail', { r: keys(a, [[0, 0], [0.48, 0.3], [0.68, -0.45], [1, 0]]) });
    }

    if (s.hit > 0) {
      move(pose, 'head', { r: 0.45 * s.hitDir * s.hit });
      move(pose, 'chest', { x: 22 * s.hitDir * s.hit, r: 0.1 * s.hitDir * s.hit });
      move(pose, 'tail', { r: -0.3 * s.hit });
    }

    // Death: the thin legs fold under it, the neck whips over, the claws splay.
    const d = s.death;
    if (d >= 0) {
      move(pose, 'hips', { y: keys(d, [[0, 0], [0.12, -30, 'out'], [0.6, 215, 'in'], [1, 232]]), x: 25 * s.deathDir * d });
      move(pose, 'chest', { r: s.deathDir * 0.7 * d, y: 20 * d });
      move(pose, 'head', { r: s.deathDir * keys(d, [[0, 0], [0.2, -0.9], [0.7, 1.1], [1, 1.35]]), y: 60 * d });
      move(pose, 'armL_up', { r: keys(d, [[0, 0], [0.25, 1.4, 'out'], [1, 0.5]]) });
      move(pose, 'armR_up', { r: keys(d, [[0, 0], [0.25, -1.4, 'out'], [1, -0.4]]) });
      move(pose, 'handL', { r: 0.5 * d });
      move(pose, 'tail', { r: 0.6 * d });
      footL[0] -= 90 * d;
      footR[0] += 90 * d;
      hockL = -1.1 * d;
      hockR = -0.9 * d;
      toeL = 0.4 * d;
      toeR = 0.4 * d;
      rootR = s.deathDir * keys(d, [[0, 0], [0.55, 0.05], [1, 0.38, 'in']]);
      rootY = 8 * d;
    }

    return {
      pose,
      root: { r: rootR, y: rootY },
      ik: [
        { upper: 'thighL', lower: 'shinL', mid: 'tarsusL', tip: 'footL', target: footL, midTurn: hockL, tipTurn: toeL },
        { upper: 'thighR', lower: 'shinR', mid: 'tarsusR', tip: 'footR', target: footR, midTurn: hockR, tipTurn: toeR },
      ],
    };
  },
  hits: [
    { part: 'armL_fore', a: at(120, 320), b: at(55, 470), r: 30, zone: 'torso' },
    { part: 'armR_fore', a: at(430, 245), b: at(440, 430), r: 34, zone: 'torso' },
    { part: 'thighL', a: at(265, 375), b: at(140, 462), r: 30, zone: 'legs' },
    { part: 'thighR', a: at(335, 385), b: at(318, 488), r: 28, zone: 'legs' },
    { part: 'chest', a: at(292, 320), b: at(220, 140), r: 70, zone: 'torso' },
    { part: 'tarsusL', a: at(236, 520), b: at(150, 645), r: 22, zone: 'legs' },
    { part: 'tarsusR', a: at(396, 540), b: at(400, 665), r: 22, zone: 'legs' },
  ],
  head: { part: 'head', at: at(115, 80), r: 62 },
  anchors: {
    mouth: { part: 'head', at: at(55, 160) },
    claw: { part: 'handR', at: at(460, 560) },
  },
  glows: [
    { part: 'head', at: at(116, 77), r: 36, colour: 0xff2a3a },
    { part: 'head', at: at(76, 72), r: 16, colour: 0xff2a3a },
  ],
};
