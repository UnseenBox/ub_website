// The Brute: a bloated hulk. It breathes with its whole belly, waddles from leg to leg,
// swings both claws shut in front of it, and now and then rears back to roar, when the belly
// swells up and shows its soft spot. Its parts overlap with soft edges, so it moves as one body.

import rig from '../rigs/brute.json';
import { gait, move, pulse, tools, twitch } from '../motion';
import { keys } from '../solve';
import type { Animation, Creature, Pose } from '../types';

const { at } = tools(rig);

export const brute: Creature = {
  rig,
  halfWidth: 235,
  animate(s): Animation {
    const pose: Pose = {};
    const t = s.time;
    const g = gait(s);
    const w = s.walk, m = s.moving;
    const breath = Math.sin(t * 1.7);
    let rootR = 0, rootY = 0;

    // Standing: slow heavy breathing, the head lolling, the claws flexing.
    move(pose, 'hips', { y: 3 * breath });
    move(pose, 'belly', { sx: 1 + 0.028 * Math.max(0, breath), sy: 1 + 0.018 * Math.max(0, breath) });
    move(pose, 'head', { r: 0.09 * twitch(t, 1.9, 7), y: -3 * breath });
    move(pose, 'armL', { r: 0.045 * Math.sin(t * 1.2) });
    move(pose, 'armR', { r: -0.045 * Math.sin(t * 1.2 + 1.1) });

    // Walking: the weight rolls from one leg to the other and the belly bounces after it.
    move(pose, 'hips', { x: 20 * g.sway, y: 20 * g.land - 6 * m, r: 0.055 * g.sway });
    move(pose, 'belly', { y: 12 * m * Math.max(0, Math.cos(2 * w - 0.8)), sx: 1 + 0.03 * g.land });
    move(pose, 'head', { r: -0.09 * g.sway, y: 8 * g.land });
    move(pose, 'legL', { y: -30 * g.left, k: 1 + 0.05 * g.left, r: -0.04 * g.left });
    move(pose, 'legR', { y: -30 * g.right, k: 1 + 0.05 * g.right, r: 0.04 * g.right });
    move(pose, 'armL', { r: 0.13 * m * Math.sin(w - 0.7) });
    move(pose, 'armR', { r: 0.13 * m * Math.sin(w - 0.7) });

    // Roar (the wind-up): it rears back, arms thrown wide, the belly blown up and trembling.
    const c = s.channel;
    if (c >= 0) {
      const rise = keys(c, [[0, 0], [0.3, 1, 'out'], [1, 1.04]]);
      const shake = Math.sin(t * 40) * rise;
      move(pose, 'hips', { y: -14 * rise, x: 3 * shake });
      move(pose, 'belly', { sx: 1 + 0.15 * rise + 0.012 * shake, sy: 1 + 0.12 * rise, y: 6 * rise });
      move(pose, 'head', { y: -22 * rise, k: 1 + 0.2 * rise, r: 0.05 * shake });
      move(pose, 'armL', { r: 0.6 * rise });
      move(pose, 'armR', { r: -0.6 * rise });
    }
    // The follow-through: everything drops and the fists come down.
    const out = s.release;
    if (out >= 0) {
      move(pose, 'hips', { y: keys(out, [[0, -14], [0.28, 34, 'in'], [0.55, 18], [1, 0]]) });
      move(pose, 'belly', { sx: keys(out, [[0, 1.15], [0.3, 0.96, 'in'], [0.6, 1.04], [1, 1]]) });
      move(pose, 'head', { y: keys(out, [[0, -22], [0.28, 24, 'in'], [1, 0]]), k: keys(out, [[0, 1.2], [0.4, 1.05], [1, 1]]) });
      move(pose, 'armL', { r: keys(out, [[0, 0.62], [0.28, -0.22, 'in'], [0.55, -0.14], [1, 0]]) });
      move(pose, 'armR', { r: keys(out, [[0, -0.62], [0.28, 0.22, 'in'], [0.55, 0.14], [1, 0]]) });
    }

    // Attack: the claws swing wide, then clap shut as the whole mass lunges.
    const a = s.attack;
    if (a >= 0) {
      move(pose, 'armL', { r: keys(a, [[0, 0], [0.48, 0.78], [0.68, -0.42, 'in'], [0.82, -0.3], [1, 0]]), k: keys(a, [[0, 1], [0.68, 1.16, 'in'], [1, 1]]) });
      move(pose, 'armR', { r: keys(a, [[0, 0], [0.48, -0.78], [0.68, 0.42, 'in'], [0.82, 0.3], [1, 0]]), k: keys(a, [[0, 1], [0.68, 1.16, 'in'], [1, 1]]) });
      move(pose, 'hips', { y: keys(a, [[0, 0], [0.48, -16], [0.68, 40, 'in'], [1, 0]]), k: keys(a, [[0, 1], [0.48, 0.98], [0.68, 1.08, 'in'], [1, 1]]) });
      move(pose, 'head', { y: keys(a, [[0, 0], [0.48, -16], [0.68, 28, 'in'], [1, 0]]), k: keys(a, [[0, 1], [0.68, 1.22, 'in'], [1, 1]]) });
    }

    if (s.hit > 0) {
      // Too heavy to be pushed: only the head snaps and the belly shudders.
      move(pose, 'head', { r: 0.2 * s.hitDir * s.hit, y: -8 * s.hit });
      move(pose, 'belly', { x: 7 * s.hitDir * s.hit, sx: 1 + 0.02 * s.hit });
    }

    // Death: the legs give, the belly sags, and the whole weight topples.
    const d = s.death;
    if (d >= 0) {
      move(pose, 'hips', { y: keys(d, [[0, 0], [0.45, 90, 'in'], [0.6, 74], [1, 120]]) });
      move(pose, 'belly', { sx: 1 + 0.22 * pulse(d, 1, 0.55) + 0.08 * d, sy: 1 - 0.1 * d });
      move(pose, 'head', { y: 52 * d, r: s.deathDir * 0.5 * d });
      move(pose, 'armL', { r: keys(d, [[0, 0], [0.3, 0.72, 'out'], [1, 0.3]]) });
      move(pose, 'armR', { r: keys(d, [[0, 0], [0.3, -0.72, 'out'], [1, -0.3]]) });
      move(pose, 'legL', { r: 0.34 * d, y: 14 * d });
      move(pose, 'legR', { r: -0.34 * d, y: 14 * d });
      rootR = s.deathDir * keys(d, [[0, 0], [0.5, 0.06], [1, 1.05, 'in']]);
      rootY = 34 * d;
    }

    return { pose, root: { r: rootR, y: rootY } };
  },
  hits: [
    { part: 'armL', a: at(190, 322), b: at(128, 480), r: 34, zone: 'torso' },
    { part: 'armR', a: at(450, 322), b: at(512, 480), r: 34, zone: 'torso' },
    { part: 'legL', a: at(236, 470), b: at(230, 585), r: 44, zone: 'legs' },
    { part: 'legR', a: at(404, 470), b: at(410, 585), r: 44, zone: 'legs' },
    { part: 'body', a: at(320, 400), b: at(320, 260), r: 122, zone: 'torso' },
    { part: 'legL', a: at(228, 595), b: at(205, 668), r: 36, zone: 'legs' },
    { part: 'legR', a: at(412, 595), b: at(436, 668), r: 36, zone: 'legs' },
  ],
  head: { part: 'head', at: at(320, 90), r: 48 },
  anchors: {
    mouth: { part: 'head', at: at(320, 158) },
    claw: { part: 'armR', at: at(505, 476) },
    belly: { part: 'belly', at: at(320, 388) },
  },
  glows: [],
};
