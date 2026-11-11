/* Progress / unlock rules of free-kicks.js (its own localStorage key, best-keeping, blocked storage).  node tools/tests/progress.test.js */
"use strict";
const fs = require("fs");
const src = fs.readFileSync(require("../paths").gameFile, "utf8");
const win = {};
if (!src.includes("window.CrazyKoraFreeKicks = {")) throw new Error("anchor");
new Function("window", src.replace("window.CrazyKoraFreeKicks = {", "window.__Progress = Progress; window.CrazyKoraFreeKicks = {"))(win);   // test-only access to the internal record()
const P = win.__Progress;
const PUB = win.CrazyKoraFreeKicks.progress;
const KEY = P.key;
const S = ["stage-1-the-spot", "stage-2-over-the-wall", "stage-3-around-the-wall", "stage-4-the-mix", "stage-5-pressure"];

function fakeStorage(init = {}, opts = {}) {
  const data = { ...init }; const writes = [];
  return {
    data, writes,
    getItem(k) { if (opts.getThrows) throw new Error("blocked"); return k in data ? data[k] : null; },
    setItem(k, v) { if (opts.setThrows) throw new Error("quota"); writes.push(k); data[k] = String(v); },
    removeItem(k) { if (opts.removeThrows) throw new Error("blocked"); writes.push("del:" + k); delete data[k]; },
  };
}
let fails = 0, n = 0;
const ok = (cond, msg) => { n++; if (!cond) { fails++; console.log("FAIL:", msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const use = (st) => { globalThis.localStorage = st; P.reset(); st.writes.length = 0; };

// 1 fresh state and unlock chain
{ const st = fakeStorage(); use(st);
  eq(P.get(), { v: 1, stages: {} }, "fresh get");
  ok(P.unlocked(S[0]) && !P.unlocked(S[1]) && !P.unlocked(S[4]), "only stage 1 open at the start");
  ok(!P.unlocked("legend-future") && !P.unlocked("nope"), "legend and unknown ids locked");
}
// 2 record, best-keeping, plays, unlocks
{ const st = fakeStorage(); use(st);
  const r1 = P.record(S[0], 3); eq([r1.stars, r1.goals, r1.plays, r1.improved, r1.persisted], [1, 3, 1, true, true], "first record 3 goals");
  ok(P.unlocked(S[1]) && !P.unlocked(S[2]), "1 star opens exactly the next stage");
  const r2 = P.record(S[0], 2); eq([r2.stars, r2.goals, r2.plays, r2.improved], [1, 3, 2, false], "worse run keeps best, counts the play");
  const r3 = P.record(S[0], 5); eq([r3.stars, r3.goals, r3.improved], [3, 5, true], "better run improves");
  const r4 = P.record(S[1], 2); eq([r4.stars, r4.goals], [0, 2], "2 goals is no star");
  ok(!P.unlocked(S[2]), "0 stars does not open the next stage");
  eq(P.stars(S[0]), 3, "stars() reads best");
  eq(Object.keys(st.data), [KEY], "only our key exists in storage");
  eq([...new Set(st.writes)], [KEY], "only our key was written");
  const raw = JSON.parse(st.data[KEY]); eq(raw.v, 1, "version stored");
}
// 3 clamping and unknown ids
{ const st = fakeStorage(); use(st);
  eq(P.record("nope", 5), null, "unknown stage ignored");
  eq(P.record(S[0], 99).goals, 5, "goals clamped to 5");
  eq(P.record(S[0], -4).plays, 2, "negative goals clamp to 0 and still count a play");
  eq(P.record(S[0], NaN).plays, 3, "NaN goals handled");
  ok(!("nope" in P.get().stages), "unknown id not stored");
}
// 4 corrupt storage never throws and heals on the next save
{ const st = fakeStorage({ [KEY]: "{ not json" }); use(st); st.data[KEY] = "{ not json";
  eq(P.get(), { v: 1, stages: {} }, "corrupt data reads as empty");
  const r = P.record(S[0], 4); ok(r && r.persisted, "record works over corrupt data");
  ok(JSON.parse(st.data[KEY]).stages[S[0]].stars === 2, "valid JSON written over the corrupt value");
}
// 5 hostile or odd values are sanitised, unknown ids kept, other shapes ignored
{ const st = fakeStorage(); use(st);
  st.data[KEY] = JSON.stringify({ v: 1, stages: { [S[0]]: { stars: 99, goals: -3, plays: "x" }, future: { stars: 2, goals: 4, plays: 5 }, bad: 7, nul: null } });
  const g = P.get();
  eq(g.stages[S[0]], { stars: 3, goals: 0, plays: 0 }, "values clamped");
  eq(g.stages.future, { stars: 2, goals: 4, plays: 5 }, "unknown but well-formed entries preserved");
  ok(!("bad" in g.stages) && !("nul" in g.stages), "malformed entries dropped");
  for (const junk of ["5", "null", "[]", "\"str\"", "true"]) { st.data[KEY] = junk; eq(P.get().stages, {}, "junk " + junk + " reads as empty"); }
}
// 6 data from a NEWER version is read but never overwritten
{ const newer = JSON.stringify({ v: 2, stages: { [S[0]]: { stars: 2, goals: 4, plays: 1 } }, extra: "keep me" });
  const st = fakeStorage({ [KEY]: newer }); use(st); st.data[KEY] = newer;
  eq(P.stars(S[0]), 2, "newer data is readable");
  const r = P.record(S[1], 5); ok(r && r.persisted === false, "record reports it did not persist");
  ok(st.data[KEY] === newer && st.writes.length === 0, "newer data left byte-identical");
  eq(P.stars(S[1]) , 0, "(newer version) in-memory merge is not shown after a fresh read");
}
// 7 storage that throws never breaks the game
{ const st = fakeStorage({}, { getThrows: true, setThrows: true, removeThrows: true }); use(st);
  let threw = false; try { P.get(); P.record(S[0], 3); P.stars(S[0]); P.unlocked(S[1]); P.reset(); } catch { threw = true; }
  ok(!threw, "no exception when storage throws");
  const st2 = fakeStorage({}, { getThrows: true, setThrows: true }); use(st2);
  const r = P.record(S[0], 3); ok(r && r.persisted === false && r.stars === 1, "progress kept in memory for the session");
  ok(P.unlocked(S[1]), "session unlock works without storage");
  const r2 = P.record(S[1], 4); eq([r2.stars, r2.plays], [2, 1], "later records still accumulate in memory");
  ok(P.status().persisted === false, "status says not persisted");
}
// 8 quota error on write only
{ const st = fakeStorage({}, { setThrows: true }); use(st);
  const r = P.record(S[0], 5); ok(r.persisted === false && r.stars === 3, "quota error falls back to memory");
  ok(P.stars(S[0]) === 3, "and the result is still visible");
}
// 9 two tabs: a record merges what another tab saved meanwhile
{ const st = fakeStorage(); use(st);
  P.record(S[0], 3);
  st.data[KEY] = JSON.stringify({ v: 1, stages: { [S[0]]: { stars: 1, goals: 3, plays: 1 }, [S[1]]: { stars: 3, goals: 5, plays: 4 } } });   // another tab
  const r = P.record(S[0], 4);
  const stored = JSON.parse(st.data[KEY]);
  eq([stored.stages[S[1]].stars, stored.stages[S[0]].stars, r.plays], [3, 2, 2], "other tab's stage survives, this stage improves");
}
// 10 isolation: Classic save and language keys are never touched
{ const classic = JSON.stringify({ level: 12, sound: 0.4, muted: false });
  const st = fakeStorage({ "crazy-goal-save": classic, "crazy-goal-lang": "ar", other: "x" }); use(st);
  st.data["crazy-goal-save"] = classic; st.data["crazy-goal-lang"] = "ar"; st.data.other = "x";
  P.record(S[0], 5); P.record(S[1], 1); P.get(); P.stars(S[0]); P.unlocked(S[1]); P.reset(); P.record(S[0], 3);
  ok(st.data["crazy-goal-save"] === classic && st.data["crazy-goal-lang"] === "ar" && st.data.other === "x", "other keys byte-identical");
  eq([...new Set(st.writes)].sort(), ["crazy-kora-fk-progress", "del:crazy-kora-fk-progress"], "only our key was written or removed");
}
// 11 reset
{ const st = fakeStorage(); use(st); P.record(S[0], 5);
  P.reset(); eq(P.get(), { v: 1, stages: {} }, "reset empties"); ok(!(KEY in st.data), "reset removes the key"); ok(!P.unlocked(S[1]), "reset re-locks");
}
// 12 legend unlock follows the last stage
{ const st = fakeStorage(); use(st); P.record(S[4], 3); ok(P.unlocked("legend-future"), "legend opens after a star on stage 5"); }

// 13 Quick Five stats, recent cards, unlock, and survival across stage records
{ const st = fakeStorage(); use(st);
  ok(!P.quickUnlocked(), "quick locked at the start");
  P.record(S[2], 2); ok(!P.quickUnlocked(), "2 goals on stage 3 does not open it");
  P.record(S[2], 3); ok(P.quickUnlocked(), "a star on stage 3 opens quick");
  eq(P.quick(), { plays: 0, bestGoals: 0, bestStars: 0, recent: [] }, "empty quick stats");
  P.noteQuick(["1.1", "2.3", "3.2", "4.1", "3.4"]); eq(P.quick().recent, ["1.1", "2.3", "3.2", "4.1", "3.4"], "recent cards stored");
  const r1 = P.recordQuick(4); eq([r1.bestStars, r1.bestGoals, r1.plays, r1.improved], [2, 4, 1, true], "first quick result");
  const r2 = P.recordQuick(1); eq([r2.bestStars, r2.bestGoals, r2.plays, r2.improved], [2, 4, 2, false], "worse quick result keeps best");
  P.record(S[0], 5); eq(P.quick().bestGoals, 4, "stage records leave quick stats alone");
  ok(JSON.parse(st.data[KEY]).quick.recent.length === 5, "quick stats saved in the same key");
  P.noteQuick(["9.9"]); eq(P.quick().recent, ["9.9"], "recent replaced by the latest set");
  st.data[KEY] = JSON.stringify({ v: 1, stages: {}, quick: { plays: -5, bestGoals: 99, bestStars: "x", recent: ["ok", 7, "waytoolongidentifier123", null] } });
  eq(P.quick(), { plays: 0, bestGoals: 5, bestStars: 0, recent: ["ok"] }, "quick data sanitised");
  st.data[KEY] = JSON.stringify({ v: 1, stages: {}, quick: "junk" }); eq(P.quick().plays, 0, "junk quick reads as empty");
  P.reset(); eq(P.quick().plays, 0, "reset clears quick"); ok(!P.quickUnlocked(), "reset re-locks quick");
}
console.log(fails ? `\n${fails} of ${n} checks FAILED` : `all ${n} progress checks passed`);
process.exit(fails ? 1 : 0);
