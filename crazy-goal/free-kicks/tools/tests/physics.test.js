"use strict";
/* Headless checks of the shared shot physics: post and crossbar bounces, the bounded bend, Mimi's leap envelope.
   node tools/tests/physics.test.js [path/to/free-kicks.js] */
const fs = require("fs");
const gameFile = process.argv[2] || require("../paths").gameFile;
const win = {};
new Function("window", fs.readFileSync(gameFile, "utf8"))(win);
const API = win.CrazyKoraFreeKicks;
const P = API.physics, S = P.step, C = P.constants();
const G = C.GOAL, SH = C.SHOT;
let fails = 0;
const ok = (name, cond, extra) => { if (!cond) fails++; console.log((cond ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : "")); };

/* trace one shot with sub-steps like the game; returns events */
function run(shot, o = {}) {
  const scn = P.resolveCard(o.card || null);
  const type = shot.type || "ground";
  const sp = SH.minSpeed + (SH.maxSpeed - SH.minSpeed) * shot.power;
  const dirX = Math.sin(shot.angle), dirY = -Math.cos(shot.angle);
  const b = { x: shot.x ?? scn.ball.x, y: shot.y ?? scn.ball.y, z: shot.z0 || 0, vx: dirX * sp, vy: dirY * sp, vz: type === "air" ? SH.minVz + (SH.maxVz - SH.minVz) * shot.power : 0, spin: 0, landedImpact: 0, netDrag: false };
  const ev = { hits: [], path: [], goalCross: null, maxTurn: 0 };
  const fdt = 1 / 240;
  let prevH = Math.atan2(b.vy, b.vx), turn = 0, minDist = 1e9;
  for (let i = 0; i < 240 * (o.seconds || 5); i++) {
    const prev = { x: b.x, y: b.y, z: b.z };
    S.integrateBall(b, fdt, type, shot.bend || 0);
    const h = S.frameHit(prev, b);
    if (h) { const r = S.frameBounce(prev, b, h); if (r) ev.hits.push({ i, kind: r.kind, impact: r.impact, x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz }); }
    if (prev.y > G.lineY && b.y <= G.lineY && b.vy < 0) ev.goalCross = { x: b.x, z: b.z, i };
    let dh = Math.atan2(b.vy, b.vx) - prevH; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
    turn += dh; prevH = Math.atan2(b.vy, b.vx); ev.maxTurn = Math.max(ev.maxTurn, Math.abs(turn));
    if (i % 12 === 0) ev.path.push([b.x | 0, b.y | 0, b.z | 0]);
    if (b.y > 900 || b.y < -50 || b.x < -50 || b.x > 1100) break;
  }
  ev.turned = b.turned || 0; ev.end = { x: b.x, y: b.y, z: b.z, speed: Math.hypot(b.vx, b.vy) };
  return ev;
}
const toward = (fromX, fromY, tx, ty) => Math.atan2(tx - fromX, -(ty - fromY));

/* A. left / right post, direct and fast */
for (const [name, tx, side] of [["left post", G.leftPostX + 14, -1], ["right post", G.rightPostX - 14, 1]]) {
  for (const power of [0.25, 0.6, 1]) {
    const a = toward(520, 676, tx, G.postY);
    const ev = run({ angle: a, power });
    const hit = ev.hits[0];
    ok(`${name} power ${power}: bounces`, !!hit && hit.kind === "post");
    ok(`${name} power ${power}: one contact only (no jitter)`, ev.hits.length === 1, "hits=" + ev.hits.length);
    ok(`${name} power ${power}: no tunnelling, no goal registered`, !ev.goalCross || ev.goalCross.x > G.leftPostX + 22 && ev.goalCross.x < G.rightPostX - 22);
    ok(`${name} power ${power}: leaves the post (still moving ${Math.round(ev.hits[0].impact)} in)`, Math.hypot(hit.vx, hit.vy) > 60 || hit.impact < 100);
  }
}
/* tunnelling check: 1420 px/s at 60 Hz frame (24 px per frame step) straight at the post centre */
{
  const prev = { x: 324 - 40, y: 143, z: 0 }, b = { x: 324 + 40, y: 143, z: 0, vx: 1420, vy: 0, vz: 0 };
  const h = S.frameHit(prev, b);
  ok("80 px step through a post centre is caught (swept)", !!h && h.kind === "post");
}
/* B. crossbar, from below and from above */
{
  const bUp = (z0, vz, vy) => ({ b: { x: 520, y: G.lineY + 40, z: z0, vx: 0, vy: -vy, vz }, ev: [] });
  for (const [name, z, vz] of [["bar from below (z 55, rising)", 55, 200], ["bar head on (z 64)", 64, 0], ["bar from above (z 68, falling)", 68, -150]]) {
    let b = { x: 520, y: G.lineY + 30, z, vx: 0, vy: -900, vz, spin: 0, landedImpact: 0 };
    let hits = 0, kind = null, crossed = null;
    for (let i = 0; i < 240; i++) {
      const prev = { x: b.x, y: b.y, z: b.z };
      S.integrateBall(b, 1 / 240, "air", 0);
      const h = S.frameHit(prev, b);
      if (h) { const r = S.frameBounce(prev, b, h); if (r) { hits++; kind = r.kind; } }
      if (prev.y > G.lineY && b.y <= G.lineY && b.vy < 0) crossed = { z: b.z };
    }
    ok(`${name}: hits the bar once`, hits === 1 && kind === "bar", `hits=${hits}`);
    console.log("     after: y", b.y.toFixed(0), "z", b.z.toFixed(0), "vy", b.vy.toFixed(0), "crossed goal line", crossed ? "z=" + crossed.z.toFixed(0) : "no");
  }
  /* a lob well under the bar still goes in and one well over still passes */
  for (const [name, z, expect] of [["low lob z=30 enters", 30, "goal"], ["high lob z=95 passes over", 95, "over"]]) {
    let b = { x: 520, y: G.lineY + 30, z, vx: 0, vy: -900, vz: 0, spin: 0, landedImpact: 0 }, hits = 0, crossed = null;
    for (let i = 0; i < 120; i++) {
      const prev = { x: b.x, y: b.y, z: b.z };
      b.vz = 0; S.integrateBall(b, 1 / 240, "ground", 0); b.z = z;
      const h = S.frameHit(prev, b); if (h && S.frameBounce(prev, b, h)) hits++;
      if (prev.y > G.lineY && b.y <= G.lineY && b.vy < 0) crossed = true;
    }
    ok(name, hits === 0 && crossed);
  }
}
/* C. curve can never orbit */
{
  let worst = 0, worstCase = null, longest = 0;
  for (const type of ["ground", "air"]) for (const bend of [-1, -0.6, -0.25, 0.25, 0.6, 1]) for (let power = 0.1; power <= 1.001; power += 0.15) for (let a = -80; a <= 80; a += 20) {
    const ev = run({ type, power, bend, angle: a * Math.PI / 180 }, { seconds: 6 });
    if (ev.turned > worst) { worst = ev.turned; worstCase = { type, power, bend, a }; }
  }
  ok("curve: heading never turns more than the cap (170 deg) in 6 s, any shot", worst <= (170 * Math.PI / 180) + 0.05, "worst " + (worst * 180 / Math.PI).toFixed(1) + " deg " + JSON.stringify(worstCase));
  /* a missed, slow, full-bend ball: no spiral */
  const slow = run({ type: "ground", power: 0.05, bend: 1, angle: 0.8 }, { seconds: 8 });
  ok("slow full-bend kick: turn bounded", slow.turned < 3.1, (slow.turned * 180 / Math.PI).toFixed(0) + " deg");
}
/* low-speed ball: no curve at all */
{
  const b = { x: 500, y: 500, z: 0, vx: 40, vy: -30, vz: 0, spin: 0, landedImpact: 0 };
  const h0 = Math.atan2(b.vy, b.vx);
  for (let i = 0; i < 240; i++) S.integrateBall(b, 1 / 240, "ground", 1);
  ok("ball at 50 px/s ignores bend", Math.abs(Math.atan2(b.vy, b.vx) - h0) < 0.02);
}
/* D. keeper envelope */
{
  const kp = P.resolveCard(null).keeper;
  const prev = { x: 520, y: kp.catY + 5, z: 40 }, b = { x: 520, y: kp.catY - 5, z: 40, vx: 0, vy: -900, vz: 0 };
  ok("no leap: z 40 passes Mimi (reach 28)", S.keeperCatch(prev, b, 520, kp, 0) === null);
  ok("mid-leap jz 20: z 40 caught when under her", !!S.keeperCatch(prev, b, 520, kp, 20));
  ok("mid-leap jz 20: z 40 NOT caught 40 px to the side", S.keeperCatch({ ...prev, x: 560 }, { ...b, x: 560 }, 520, kp, 20) === null);
  const hi = { ...prev, z: 70 }, hb = { ...b, z: 70 };
  ok("z 70 over a full leap (reach 52): bypasses", S.keeperCatch(hi, hb, 520, kp, 24) === null);
}
console.log(fails ? "\n" + fails + " FAILED" : "\nall passed");
process.exit(fails ? 1 : 0);
