// The Wraith: smoke with claws. It never touches the ground: it floats, its tail curling and
// uncurling joint by joint, rears both claws and lashes them together, and dissolves when killed.

import rig from '../rigs/wraith.json';
import { move, noise, tools, twitch } from '../motion';
import { keys } from '../solve';
import type { Animation, Creature, Pose } from '../types';

const { at } = tools(rig);
const TAIL = ['tail1', 'tail2', 'tail3', 'tail4'];

export const wraith: Creature = {
  rig,
  halfWidth: 340,
  animate(s): Animation {
    const pose: Pose = {};
    const t = s.time;
    const m = s.moving;
    let rootK = 1, rootX = 0;
    let rootY = -45 + 26 * Math.sin(t * 1.7);

    // Floating: the body drifts and leans, the tail follows in a travelling wave.
    move(pose, 'torso', { x: 16 * Math.sin(t * 0.9), r: 0.07 * Math.sin(t * 1.1) + 0.07 * m * Math.sin(t * 2.3), sx: 1 + 0.025 * Math.sin(t * 3.3), sy: 1 + 0.02 * Math.sin(t * 2.7 + 1) });
    TAIL.forEach((part, i) => {
      const swing = (0.1 + 0.075 * i) * (1 + 0.5 * m);
      move(pose, part, { r: swing * Math.sin(t * 2.4 - i * 1.05), sx: 1 + 0.07 * Math.sin(t * 5 - i * 1.7), sy: 1 + 0.04 * Math.sin(t * 4 - i) });
    });
    move(pose, 'head', { r: 0.2 * twitch(t, 1.6, 21), k: 1 + 0.045 * Math.sin(t * 3), x: 6 * Math.sin(t * 7.5) * m });
    move(pose, 'armL_up', { r: 0.2 * Math.sin(t * 1.4) + 0.06, k: 1 + 0.04 * Math.sin(t * 2) });
    move(pose, 'armL_fore', { r: 0.3 * Math.sin(t * 1.4 - 1) });
    move(pose, 'armR_up', { r: -0.2 * Math.sin(t * 1.4 + 1.9) - 0.06, k: 1 + 0.04 * Math.sin(t * 2 + 2) });
    move(pose, 'armR_fore', { r: -0.3 * Math.sin(t * 1.4 + 0.9) });

    // Hunting: it surges forward in pulses.
    rootK *= 1 + 0.05 * m * Math.max(0, Math.sin(s.walk * 0.5)) ** 3;

    // Attack: both claws rear back, then lash across each other as it lunges at you.
    const a = s.attack;
    if (a >= 0) {
      move(pose, 'armL_up', { r: keys(a, [[0, 0], [0.5, 1.35], [0.68, -0.75, 'in'], [0.82, -0.6], [1, 0]]), k: keys(a, [[0, 1], [0.5, 0.95], [0.68, 1.35, 'in'], [1, 1]]) });
      move(pose, 'armL_fore', { r: keys(a, [[0, 0], [0.5, 0.8], [0.68, -0.9, 'in'], [1, 0]]), k: keys(a, [[0, 1], [0.68, 1.2, 'in'], [1, 1]]) });
      move(pose, 'armR_up', { r: keys(a, [[0, 0], [0.5, -1.35], [0.68, 0.75, 'in'], [0.82, 0.6], [1, 0]]), k: keys(a, [[0, 1], [0.5, 0.95], [0.68, 1.35, 'in'], [1, 1]]) });
      move(pose, 'armR_fore', { r: keys(a, [[0, 0], [0.5, -0.8], [0.68, 0.9, 'in'], [1, 0]]), k: keys(a, [[0, 1], [0.68, 1.2, 'in'], [1, 1]]) });
      move(pose, 'head', { y: keys(a, [[0, 0], [0.5, -30], [0.68, 65, 'in'], [1, 0]]), k: keys(a, [[0, 1], [0.5, 1.1], [0.68, 1.5, 'in'], [0.84, 1.3], [1, 1]]) });
      move(pose, 'torso', { r: keys(a, [[0, 0], [0.5, -0.16], [0.68, 0.14, 'in'], [1, 0]]) });
      TAIL.forEach((part, i) => move(pose, part, { r: keys(a, [[0, 0], [0.5, 0.22 + 0.05 * i], [0.68, -0.28 - 0.06 * i, 'in'], [1, 0]]) }));
      rootY += keys(a, [[0, 0], [0.5, -60], [0.68, 70, 'in'], [1, 0]]);
      rootK *= keys(a, [[0, 1], [0.5, 0.9], [0.68, 1.3, 'in'], [0.84, 1.2], [1, 1]]);
    }

    if (s.hit > 0) {
      move(pose, 'torso', { x: 40 * s.hitDir * s.hit, r: 0.14 * s.hitDir * s.hit, a: 1 - 0.35 * s.hit });
      move(pose, 'head', { r: -0.3 * s.hitDir * s.hit });
    }

    // Death: it shrieks apart, every piece drifting upward, swelling and thinning to nothing.
    const d = s.death;
    if (d >= 0) {
      rig.parts.forEach((part, i) => {
        const out = keys(d, [[0, 0], [0.18, 0.12], [1, 1, 'in']]);
        move(pose, part.name, {
          x: noise(i * 3 + 1) * 150 * out,
          y: -(80 + 160 * Math.abs(noise(i * 5 + 2))) * out,
          r: noise(i * 7 + 3) * 1.2 * out,
          sx: 1 + 0.5 * out,
          sy: 1 + 0.25 * out,
          a: part.parent ? 1 : keys(d, [[0, 1], [0.35, 0.9], [1, 0]]),
        });
      });
      rootX = 10 * Math.sin(t * 30) * (1 - d);
    }

    return { pose, root: { x: rootX, y: rootY, k: rootK } };
  },
  hits: [
    { part: 'armL_fore', a: at(90, 405), b: at(130, 600), r: 56, zone: 'torso' },
    { part: 'armR_fore', a: at(605, 268), b: at(605, 390), r: 52, zone: 'torso' },
    { part: 'tail1', a: at(270, 380), b: at(285, 520), r: 90, zone: 'legs' },
    { part: 'tail2', a: at(300, 540), b: at(430, 650), r: 85, zone: 'legs' },
    { part: 'torso', a: at(290, 320), b: at(290, 180), r: 130, zone: 'torso' },
    { part: 'tail3', a: at(435, 660), b: at(450, 790), r: 70, zone: 'legs' },
    { part: 'tail4', a: at(440, 810), b: at(430, 950), r: 60, zone: 'legs' },
  ],
  head: { part: 'head', at: at(415, 275), r: 76 },
  anchors: {
    mouth: { part: 'head', at: at(420, 330) },
    claw: { part: 'armR_fore', at: at(610, 380) },
    tail: { part: 'tail4', at: at(470, 920) },
  },
  glows: [
    { part: 'head', at: at(409, 294), r: 20, colour: 0xbfe8ff },
    { part: 'head', at: at(442, 297), r: 17, colour: 0xbfe8ff },
  ],
};
