// The Gorger: a mountain of flesh. It waddles its weight from foot to foot with its belly,
// chest and head each lagging behind, gapes its maw, and rears up to slam both arms down.

import rig from '../rigs/gorger.json';
import { gait, move, pulse, tools } from '../motion';
import { keys } from '../solve';
import type { Animation, Creature, Pose } from '../types';

const { at } = tools(rig);

export const gorger: Creature = {
  rig,
  halfWidth: 480,
  animate(s): Animation {
    const pose: Pose = {};
    const t = s.time;
    const g = gait(s);
    const w = s.walk, m = s.moving;
    const breath = Math.sin(t * 1.9);
    const lag = Math.sin(t * 1.9 - 0.8);
    let rootR = 0, rootY = 0;

    // Standing: huge slow breaths, a lolling head, the maw gaping, fingers twitching.
    move(pose, 'hips', { sx: 1 + 0.018 * breath, sy: 1 - 0.01 * breath });
    move(pose, 'chest', { y: -11 * lag, sx: 1 + 0.02 * lag, sy: 1 + 0.012 * lag });
    move(pose, 'head', { r: 0.09 * Math.sin(t * 0.75), y: -5 * lag, x: 8 * Math.sin(t * 0.75) });
    move(pose, 'jaw', { y: 14 + 24 * Math.max(0, Math.sin(t * 1.15)) + 20 * pulse(t, 4.2, 0.2) });
    move(pose, 'armL_up', { r: 0.055 * Math.sin(t * 1.2) });
    move(pose, 'armL_fore', { r: 0.07 * Math.sin(t * 1.2 - 0.9) });
    move(pose, 'handL', { r: 0.18 * Math.sin(t * 3.2) });
    move(pose, 'armR_up', { r: -0.055 * Math.sin(t * 1.2 + 0.5) });
    move(pose, 'armR_fore', { r: -0.07 * Math.sin(t * 1.2 - 0.4) });
    move(pose, 'handR', { r: -0.15 * Math.sin(t * 2.6) });

    // Waddle: the bulk rolls over the standing foot, and everything above it follows late.
    const hipX = -46 * g.sway, hipY = 30 * g.land, hipR = -0.075 * g.sway;
    move(pose, 'hips', { x: hipX, y: hipY, r: hipR, sy: 1 - 0.055 * g.land, sx: 1 + 0.04 * g.land });
    move(pose, 'chest', { r: 0.075 * m * Math.sin(w - 0.7), y: 18 * m * Math.max(0, Math.cos(2 * w - 0.8)) });
    move(pose, 'head', { r: 0.13 * m * Math.sin(w - 1.4), y: 20 * m * Math.max(0, Math.cos(2 * w - 1.6)) });
    move(pose, 'jaw', { y: 20 * g.land });
    move(pose, 'armL_up', { r: 0.22 * m * Math.sin(w - 0.9) });
    move(pose, 'armL_fore', { r: 0.22 * m * Math.sin(w - 1.6) });
    move(pose, 'handL', { r: 0.3 * m * Math.sin(w - 2.3) });
    move(pose, 'armR_up', { r: 0.22 * m * Math.sin(w - 0.9) });
    move(pose, 'armR_fore', { r: 0.2 * m * Math.sin(w - 1.6) });
    move(pose, 'handR', { r: 0.28 * m * Math.sin(w - 2.3) });
    // The feet stay under it: they cancel the hips' roll, and lift in turn.
    move(pose, 'legL', { x: -hipX, y: -hipY - 85 * g.left, r: -hipR + 0.14 * g.left, k: 1 + 0.12 * g.left });
    move(pose, 'legR', { x: -hipX, y: -hipY - 85 * g.right, r: -hipR - 0.14 * g.right, k: 1 + 0.12 * g.right });

    // The slam, wound up as a ranged attack (or as a blow at the wire).
    let up = s.channel, down = s.release;
    if (s.attack >= 0) {
      up = s.attack < 0.55 ? s.attack / 0.55 : -1;
      down = s.attack >= 0.55 ? (s.attack - 0.55) / 0.45 : -1;
    }
    if (up >= 0) {
      const rear = keys(up, [[0, 0], [0.7, 1], [1, 1.07]]);
      const shake = Math.sin(t * 38) * up * up;
      move(pose, 'armL_up', { r: 2.25 * rear + 0.05 * shake });
      move(pose, 'armL_fore', { r: 0.55 * rear });
      move(pose, 'handL', { r: 0.5 * rear, k: 1 + 0.2 * rear });
      move(pose, 'armR_up', { r: -2.25 * rear - 0.05 * shake });
      move(pose, 'armR_fore', { r: -0.55 * rear });
      move(pose, 'handR', { r: -0.5 * rear, k: 1 + 0.2 * rear });
      move(pose, 'chest', { y: -48 * rear, k: 1 + 0.07 * rear, x: 5 * shake });
      move(pose, 'head', { y: -24 * rear, k: 1 + 0.08 * rear, r: 0.04 * shake });
      move(pose, 'jaw', { y: 70 * rear + 8 * shake });
      move(pose, 'hips', { sy: 1 + 0.045 * rear, sx: 1 - 0.03 * rear });
    }
    if (down >= 0) {
      move(pose, 'armL_up', { r: keys(down, [[0, 2.4], [0.28, -0.5, 'in'], [0.45, -0.3], [1, 0]]) });
      move(pose, 'armL_fore', { r: keys(down, [[0, 0.55], [0.28, -0.45, 'in'], [1, 0]]) });
      move(pose, 'handL', { r: keys(down, [[0, 0.5], [0.28, -0.4], [1, 0]]), k: keys(down, [[0, 1.2], [0.28, 1.6, 'in'], [1, 1]]) });
      move(pose, 'armR_up', { r: keys(down, [[0, -2.4], [0.28, 0.5, 'in'], [0.45, 0.3], [1, 0]]) });
      move(pose, 'armR_fore', { r: keys(down, [[0, -0.55], [0.28, 0.45, 'in'], [1, 0]]) });
      move(pose, 'handR', { r: keys(down, [[0, -0.5], [0.28, 0.4], [1, 0]]), k: keys(down, [[0, 1.2], [0.28, 1.6, 'in'], [1, 1]]) });
      move(pose, 'chest', { y: keys(down, [[0, -52], [0.28, 110, 'in'], [0.5, 60], [1, 0]]), k: keys(down, [[0, 1.07], [0.28, 1.15, 'in'], [1, 1]]) });
      move(pose, 'head', { y: keys(down, [[0, -26], [0.28, 80, 'in'], [0.6, 30], [1, 0]]) });
      move(pose, 'jaw', { y: keys(down, [[0, 74], [0.28, 10, 'in'], [0.5, 55], [1, 0]]) });
      move(pose, 'hips', {
        sy: keys(down, [[0, 1.045], [0.28, 0.86, 'in'], [0.46, 1.08], [0.64, 0.95], [0.82, 1.025], [1, 1]]),
        sx: keys(down, [[0, 0.97], [0.28, 1.13, 'in'], [0.46, 0.95], [0.64, 1.04], [0.82, 0.99], [1, 1]]),
      });
    }

    if (s.hit > 0) {
      move(pose, 'head', { r: 0.22 * s.hitDir * s.hit, y: -10 * s.hit });
      move(pose, 'chest', { x: 24 * s.hitDir * s.hit, r: 0.045 * s.hitDir * s.hit });
      move(pose, 'jaw', { y: 30 * s.hit });
    }

    // Death: it groans, the bulk slumps and spreads on the ground, and it keels over.
    const d = s.death;
    if (d >= 0) {
      const sag = keys(d, [[0, 0], [0.2, -0.15, 'out'], [0.65, 1, 'in'], [0.78, 0.86], [1, 1]]);
      move(pose, 'hips', { sy: 1 - 0.3 * sag, sx: 1 + 0.22 * sag, y: 70 * sag });
      move(pose, 'chest', { y: 170 * sag, r: s.deathDir * 0.28 * sag });
      move(pose, 'head', { y: 110 * sag, r: s.deathDir * 0.8 * sag });
      move(pose, 'jaw', { y: keys(d, [[0, 0], [0.2, 110], [1, 55]]) });
      move(pose, 'armL_up', { r: keys(d, [[0, 0], [0.25, 1.5, 'out'], [0.7, 0.25, 'in'], [1, 0.35]]) });
      move(pose, 'armL_fore', { r: 0.5 * sag });
      move(pose, 'armR_up', { r: keys(d, [[0, 0], [0.25, -1.5, 'out'], [0.7, -0.25, 'in'], [1, -0.35]]) });
      move(pose, 'armR_fore', { r: -0.5 * sag });
      move(pose, 'legL', { x: -60 * sag, r: 0.4 * sag });
      move(pose, 'legR', { x: 60 * sag, r: -0.4 * sag });
      rootR = s.deathDir * keys(d, [[0, 0], [0.6, 0.03], [1, 0.4, 'in']]);
      rootY = 30 * d;
    }

    return { pose, root: { r: rootR, y: rootY } };
  },
  hits: [
    { part: 'armL_up', a: at(262, 448), b: at(150, 650), r: 85, zone: 'torso' },
    { part: 'armR_up', a: at(728, 448), b: at(840, 690), r: 80, zone: 'torso' },
    { part: 'hips', a: at(330, 950), b: at(330, 1120), r: 170, zone: 'legs' },
    { part: 'hips', a: at(660, 950), b: at(660, 1120), r: 170, zone: 'legs' },
    { part: 'chest', a: at(500, 770), b: at(500, 480), r: 250, zone: 'torso' },
    { part: 'legL', a: at(325, 1200), b: at(320, 1350), r: 90, zone: 'legs' },
    { part: 'legR', a: at(680, 1200), b: at(680, 1370), r: 80, zone: 'legs' },
  ],
  head: { part: 'head', at: at(545, 190), r: 125 },
  anchors: {
    mouth: { part: 'head', at: at(550, 290) },
    claw: { part: 'handR', at: at(900, 900) },
  },
  glows: [],
};
