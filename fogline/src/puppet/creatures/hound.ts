// The Hollow Hound: a four-legged runner. It gallops low with its paws reaching out at you,
// its tail lashing behind, and it crouches and leaps with its jaws wide to bite.

import rig from '../rigs/hound.json';
import { move, pulse, tools, twitch } from '../motion';
import { keys } from '../solve';
import type { Animation, Creature, Pose } from '../types';

const { at, joint } = tools(rig);
const PAW_L = joint('pawL');
const PAW_R = joint('pawR');
const TAIL = ['tail1', 'tail2', 'tail3', 'tail4'];

export const hound: Creature = {
  rig,
  halfWidth: 400,
  animate(s): Animation {
    const pose: Pose = {};
    const t = s.time;
    const w = s.walk, m = s.moving;
    const breath = Math.sin(t * 3.1);
    let rootR = 0, rootY = 0, rootK = 1, rootX = 0;

    // Standing: panting, a low swaying head, a lashing tail, a snapping snarl.
    move(pose, 'body', { sy: 1 + 0.028 * breath, y: 2 * breath });
    move(pose, 'head', { x: 14 * Math.sin(t * 1.1), r: 0.09 * twitch(t, 1.4, 5), y: -4 * breath });
    move(pose, 'jaw', { y: 4 + 5 * Math.max(0, breath) + 22 * pulse(t, 2.7, 0.22) });
    TAIL.forEach((part, i) => move(pose, part, { r: (0.09 + 0.04 * i) * Math.sin(t * 3 - i * 0.9) }));
    move(pose, 'legBL', { r: 0.04 * Math.sin(t * 1.3) });

    // Gallop: the body bounds, the front paws reach out one after the other, the rear drives.
    const reachL = m * Math.max(0, Math.sin(w));
    const reachR = m * Math.max(0, Math.sin(w - 2.2));
    const bound = m * Math.abs(Math.sin(w - 0.6));
    move(pose, 'body', { y: -52 * bound + 14 * m, r: 0.07 * m * Math.sin(w - 1), k: 1 + 0.05 * m * Math.sin(w) });
    move(pose, 'head', { y: 22 * m * Math.sin(w + 0.7), r: -0.08 * m * Math.sin(w - 1) });
    move(pose, 'jaw', { y: 18 * bound });
    move(pose, 'legBL', { r: 0.5 * m * Math.sin(w + Math.PI) });
    move(pose, 'legBR', { r: -0.45 * m * Math.sin(w + 2.6) });
    move(pose, 'pawBR', { r: 0.4 * m * Math.sin(w + 1.8) });
    TAIL.forEach((part, i) => move(pose, part, { r: 0.22 * m * Math.sin(w - i * 0.9) }));
    const pawL = [PAW_L[0] - 36 * reachL, PAW_L[1] - 105 * reachL];
    const pawR = [PAW_R[0] + 30 * reachR, PAW_R[1] - 105 * reachR];
    move(pose, 'pawL', { k: 1 + 0.34 * reachL });
    move(pose, 'pawR', { k: 1 + 0.26 * reachR });
    let clawTurnL = -0.45 * reachL, clawTurnR = 0.4 * reachR;

    // Pounce: crouch and coil, spring at the viewer with the claws out, and snap shut.
    const a = s.attack;
    if (a >= 0) {
      move(pose, 'body', {
        y: keys(a, [[0, 0], [0.42, 55], [0.6, -45, 'out'], [0.68, -10], [0.85, 20], [1, 0]]),
        sy: keys(a, [[0, 1], [0.42, 0.88], [0.6, 1.08], [0.72, 0.95], [1, 1]]),
      });
      move(pose, 'head', {
        y: keys(a, [[0, 0], [0.42, 22], [0.6, -20], [0.68, 40, 'in'], [1, 0]]),
        k: keys(a, [[0, 1], [0.42, 0.95], [0.68, 1.35, 'in'], [0.82, 1.2], [1, 1]]),
      });
      move(pose, 'jaw', { y: keys(a, [[0, 0], [0.42, 14], [0.62, 44, 'out'], [0.69, -4, 'snap'], [0.84, 18], [1, 0]]) });
      TAIL.forEach((part, i) => move(pose, part, { r: keys(a, [[0, 0], [0.42, -0.2 - 0.05 * i], [0.68, 0.3 + 0.07 * i, 'in'], [1, 0]]) }));
      move(pose, 'legBL', { r: keys(a, [[0, 0], [0.42, -0.3], [0.62, 0.6, 'out'], [1, 0]]) });
      move(pose, 'legBR', { r: keys(a, [[0, 0], [0.42, 0.25], [0.62, -0.6, 'out'], [1, 0]]) });
      rootY = keys(a, [[0, 0], [0.42, 0], [0.6, -150, 'out'], [0.68, -60, 'in'], [0.85, 0], [1, 0]]);
      rootK = keys(a, [[0, 1], [0.42, 0.94], [0.68, 1.45, 'in'], [0.82, 1.35], [1, 1]]);
      const fly = keys(a, [[0, 0], [0.42, 0], [0.6, 1, 'out'], [0.68, 0.7], [0.9, 0], [1, 0]]);
      pawL[0] -= 70 * fly;
      pawL[1] -= 80 * fly;
      pawR[0] += 70 * fly;
      pawR[1] -= 80 * fly;
      move(pose, 'pawL', { k: 1 + 0.45 * fly });
      move(pose, 'pawR', { k: 1 + 0.4 * fly });
      clawTurnL = -0.7 * fly;
      clawTurnR = 0.7 * fly;
    }

    if (s.hit > 0) {
      move(pose, 'body', { x: 26 * s.hitDir * s.hit, r: 0.07 * s.hitDir * s.hit });
      move(pose, 'head', { r: 0.34 * s.hitDir * s.hit, y: -16 * s.hit });
      move(pose, 'jaw', { y: 20 * s.hit });
    }

    // Death: it tumbles over its own speed and lies with legs splayed, the tail going slack.
    const d = s.death;
    if (d >= 0) {
      rootR = s.deathDir * keys(d, [[0, 0], [0.5, 0.42, 'in'], [0.75, 0.28], [1, 0.34]]);
      rootY = keys(d, [[0, 0], [0.25, -80, 'out'], [0.6, 0, 'in'], [0.75, -14], [1, 0]]);
      rootX = 55 * s.deathDir * d;
      move(pose, 'body', { sy: 1 - 0.34 * d, y: keys(d, [[0, 0], [0.3, -20], [0.6, 105, 'in'], [1, 120]]) });
      move(pose, 'head', { r: s.deathDir * 0.5 * d, y: 30 * d });
      move(pose, 'jaw', { y: 34 * d });
      TAIL.forEach((part, i) => move(pose, part, { r: s.deathDir * (0.12 + 0.1 * i) * d }));
      move(pose, 'legBL', { r: 0.7 * d });
      move(pose, 'legBR', { r: -0.7 * d });
      pawL[0] -= 110 * d;
      pawR[0] += 110 * d;
      clawTurnL = -0.8 * d;
      clawTurnR = 0.8 * d;
    }

    return {
      pose,
      root: { r: rootR, y: rootY, x: rootX, k: rootK },
      ik: [
        { upper: 'armL_up', lower: 'armL_fore', tip: 'pawL', target: pawL, tipTurn: clawTurnL },
        { upper: 'armR_up', lower: 'armR_fore', tip: 'pawR', target: pawR, tipTurn: clawTurnR },
      ],
    };
  },
  hits: [
    { part: 'armL_fore', a: at(110, 335), b: at(95, 420), r: 42, zone: 'legs' },
    { part: 'armR_fore', a: at(476, 342), b: at(465, 440), r: 48, zone: 'legs' },
    { part: 'armL_up', a: at(190, 232), b: at(114, 334), r: 45, zone: 'legs' },
    { part: 'armR_up', a: at(466, 232), b: at(476, 342), r: 50, zone: 'legs' },
    { part: 'body', a: at(250, 150), b: at(430, 180), r: 110, zone: 'torso' },
    { part: 'legBL', a: at(282, 300), b: at(220, 420), r: 32, zone: 'legs' },
    { part: 'legBR', a: at(512, 262), b: at(600, 400), r: 36, zone: 'legs' },
  ],
  head: { part: 'head', at: at(325, 315), r: 74 },
  anchors: {
    mouth: { part: 'head', at: at(330, 360) },
    claw: { part: 'pawR', at: at(450, 480) },
  },
  glows: [],
};
