/* ==========================================================================
   CRAZY KORA — FREE KICKS
   Isolated additive mode. This file never touches the Classic bundle, its
   physics, saves, levels or progression. It reuses the Classic visual
   language (vector ball, cloth net, cat keeper, aim ring) while faking
   height in 2D: x/y is the ground position, z is elevation used for
   rendering and clearance checks.
   ========================================================================== */

(() => {
  "use strict";

  const W = 1040;
  const H = 800;
  const TAU = Math.PI * 2;
  const BALL_R = 17;
  const LIFT = 1;
  const FIELD = { left: 58, top: 38, right: 982, bottom: 762 };
  const GOAL = {
    left: 334, right: 706, lineY: 150,
    postR: 10, height: 56, taper: 26, depth: 68,
    crossbarZ: 63, post: 12,
  };
  GOAL.cx = (GOAL.left + GOAL.right) / 2;
  GOAL.mouthW = GOAL.right - GOAL.left;
  GOAL.leftPostX = GOAL.cx - GOAL.mouthW / 2 - GOAL.postR;
  GOAL.rightPostX = GOAL.cx + GOAL.mouthW / 2 + GOAL.postR;
  GOAL.postY = GOAL.lineY - GOAL.postR + 3;
  GOAL.barY = GOAL.postY - GOAL.height;
  GOAL.backY = GOAL.lineY - GOAL.depth;
  GOAL.backTopY = GOAL.backY - GOAL.height * 0.7;
  /* Frame collision (see frameHit). The posts are vertical cylinders on the post
     line, the crossbar a horizontal cylinder at (barPlaneY, barZ). Every hit
     radius is the frame's own radius plus an effective ball radius of 12, so the
     scoring mouth is exactly what it always was (ball centre 346..694). The bar
     only touches balls whose height at the goal line is within barHitR of barZ. */
  GOAL.frame = {
    postHitR: GOAL.postR + 12,
    barPlaneY: GOAL.lineY - 4, barZ: 64, barHitR: 5,
    restPost: 0.58, restBar: 0.5,   // how much of the speed into the frame comes back
    slide: 0.9,                     // tangential speed kept (the frame is not slippery)
    settle: 0.45,                   // seconds of rebound shown before a frame hit is called wide / too high
  };
  const WALL = { y: 432, left: 430, right: 622, clearance: 58, centers: [448, 500, 552, 604] };
  const KEEPER = {
    catY: GOAL.lineY + 58, r: 27, minX: 346, maxX: 694,
    speed: 280, alertT: 0.24, reachX: 45, reachZ: 28, homeX: 520,
    /* Chase tuning that used to be hard-coded in the keeper update. `speed`
       only scales the lean animation; it is not a movement cap. */
    sway: 46, swayRate: 0.9, gain: 9, accel: 1500,
    /* Aerial save (see keeperCatch / stepKeeper): Mimi leaps for a lob that is
       coming straight at her. Beyond reachZ she can add up to jumpZ of height,
       only within jumpX of where she is standing, only when she has had
       alertT + jumpReact to read the shot and is nearly set (|vx| <= jumpSet).
       jumpTime is one whole leap; jumpMax caps reachZ + jumpZ. */
    jumpZ: 24, jumpX: 22, jumpTime: 0.4, jumpReact: 0.12, jumpSet: 170, jumpMax: 52,
  };
  const BALL_START = { x: 520, y: 676 };
  const SHOT = {
    deadZone: 18, maxPull: 250,
    minSpeed: 520, maxSpeed: 1420,
    minVz: 320, maxVz: 380, gravity: 900,
    curve: 2600, dragGround: 0.24, dragAir: 0.08,
    steps: 10, hitRadius: 205,
    /* Bend limits. `curve` is a lateral acceleration, so a constant-speed turn
       rate is curve / speed: it grows without bound as the ball slows. The bend
       therefore fades out below curveSlowFrom (gone at curveSlowTo) and once the
       ball has turned curveFullTurn away from its launch line (gone at
       curveEndTurn). Scoring shots stay under both limits (see
       tools/free-kicks: they turn at most ~139 degrees at over 440 px/s). */
    curveSlowFrom: 240, curveSlowTo: 90,
    curveFullTurn: (135 * Math.PI) / 180, curveEndTurn: (170 * Math.PI) / 180,
  };
  const FOCUS = { w: 780, minW: 640, h: 720, cx: 520, cy: 400 };
  const DEFAULT_SKIN = { base: "#fbf7ee", patch: "#1b2540" };
  /* The ball colours; start() replaces them with the player's chosen ball (opts.skin) on every visit. */
  const SKIN = Object.assign({}, DEFAULT_SKIN);
  const PALETTE = {
    bg: "#e6dccb", ground: "#e2b96a", groundAlt: "#d4a94f", paver: "#a8865c",
    chalk: "#fffaf0", white: "#fbf7ee", blue: "#1f5fa8", blueLite: "#6aa5dc",
    terra: "#cd3a24", sun: "#ffc83a", sunDark: "#e0a41c", navy: "#1b2540",
    shadow: "#2c3470", greenHi: "#4ce16c", greenGame: "#1fc24c",
    greenNight: "#0b4d1f", red: "#cd3a24", stone: "#bcae98",
    stoneDark: "#96886f", recess: "#6f5f52", cat: "#e58a2e", catDark: "#b9661a",
    ink: "#1b2540", bone: "#fbf7ee",
  };
  const OUTCOMES = {
    goal: { title: "resultGoal", note: "resultGoalNote", delay: 1.0 },
    saved: { title: "resultSaved", note: "resultSavedNote", delay: 0.8 },
    wall: { title: "resultWall", note: "resultWallNote", delay: 0.75 },
    wide: { title: "resultWide", note: "resultWideNote", delay: 0.85 },
    tooHigh: { title: "resultTooHigh", note: "resultTooHighNote", delay: 0.85 },
    missed: { title: "resultMissed", note: "resultMissedNote", delay: 0.75 },
  };
  const SFX = {
    click: [29.2591, 0.0497],
    kick: [[13.2963, 0.4758], [13.8021, 0.3969], [14.229, 0.3683]],
    kickSoft: [14.6273, 0.3035],
    thud: [15.6793, 0.5051],
    thudSoft: [17.4187, 0.118],
    net: [27.3112, 0.0977],
    cloth: [12.4437, 0.329],
    cheer: [[0, 3.2759], [3.3059, 4.179]],
    whistle: [11.5449, 0.3727],
    grit: [[28.4625, 0.1059], [28.5985, 0.1076]],
    post: [[20.6871, 0.246], [20.9631, 0.2047], [21.1978, 0.1808]],
    stone: [[17.9453, 0.1387], [18.1139, 0.1175], [18.2614, 0.1396]],
    tin: [[21.4086, 0.1587], [21.5973, 0.1743], [21.8016, 0.1338]],
    metal: [[19.9529, 0.1677], [20.1505, 0.3593], [20.5398, 0.1173]],
  };
  /* The newer standalone recordings (opts.clips, the names Classic's SoundLibrary uses) take
     priority over the sheet. When one has not loaded (or the host passes none) the sound falls
     back to its sheet equivalent, and with neither it stays silent: never an error. */
  const SFX_FALLBACK = { kick_ball: "kick", stone: "stone", metal: "metal", tin: "tin", goal: "cheer", whistle: "whistle" };
  /* Per-clip level so each recording sits at the loudness of the sheet sound it replaces (matched by RMS in the browser). */
  const CLIP_GAIN = { click: 1.5, kick_ball: 0.55, goal: 0.5, meow: 2, power_up: 0.6, stone: 0.5, tin: 0.9, metal: 0.8, whistle: 0.6, glass_tap: 0.6 };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const smoothRange = (a, b, x) => clamp((x - a) / (b - a), 0, 1);
  const len = (x, y) => Math.hypot(x, y);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const shade = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const rr = (ctx, x, y, w, h, r) => {
    const q = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + q, y);
    ctx.arcTo(x + w, y, x + w, y + h, q);
    ctx.arcTo(x + w, y + h, x, y + h, q);
    ctx.arcTo(x, y + h, x, y, q);
    ctx.arcTo(x, y, x + w, y, q);
    ctx.closePath();
  };
  const starPath = (ctx, cx, cy, outer, inner, points = 5, rot = -Math.PI / 2) => {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 ? inner : outer;
      const a = rot + (i * Math.PI) / points;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
  };

  /* ==========================================================================
     SHOT PHYSICS - the pure rules, shared by the game loop, the aim preview
     and the offline validator (exposed as CrazyKoraFreeKicks.physics).
     Nothing in this block touches the DOM, audio, particles or Math.random,
     so the same shot gives the same result for the same keeper phase.
     A scenario is { ball, wall, keeper }; it defaults to the constants above.
     ========================================================================== */
  const DEFAULT_SCENARIO = { ball: BALL_START, wall: WALL, keeper: KEEPER };

  function resolveScenario(scenario) {
    const s = scenario || {};
    return {
      ball: Object.assign({}, DEFAULT_SCENARIO.ball, s.ball),
      wall: Object.assign({}, DEFAULT_SCENARIO.wall, s.wall),
      keeper: Object.assign({}, DEFAULT_SCENARIO.keeper, s.keeper),
    };
  }

  /* ==========================================================================
     CARDS - one free-kick situation = ball spot + wall + keeper preset.
       {
         id, name,                     // free-form labels for the UI layer
         ball:   { x, y },             // default: the original spot
         wall:   { men, dist, dx, height },
                 // men    3-6 defenders (52 px apart, 26 px of hit width each)
                 // dist   wall distance from the ball along the line to the goal
                 // dx     sideways shift of the wall (opens a gap)
                 // height clearance in z units (58 = the original wall)
                 // omitted = the original wall, exactly as it always was
         keeper: "K3" | { tier: "K3", alertT, reachZ, homeX }
                 // omitted = Mimi as she always was (K2)
       }
     resolveCard() turns that into the { ball, wall, keeper } scenario the
     physics, the renderer and the validator all consume.
     ========================================================================== */
  const KEEPER_TIERS = {
    K1: { alertT: 0.3, reachZ: 28 },
    K2: { alertT: 0.24, reachZ: 28 },
    K3: { alertT: 0.2, reachZ: 40 },
    K4: { alertT: 0.18, reachZ: 52 },
    K5: { alertT: 0.14, reachZ: 63 },
  };
  const WALL_SPACING = 52;
  const WALL_HALF_PER_MAN = 26;

  function resolveCard(spec) {
    const s = spec || {};
    const ball = Object.assign({}, BALL_START, s.ball);

    let wall;
    if (!s.wall) {
      wall = Object.assign({}, WALL, { men: WALL.centers.length, centers: WALL.centers.slice() });
    } else {
      const men = Math.round(s.wall.men ?? 4);
      if (!(men >= 1 && men <= 8)) throw new Error("Free Kicks card: wall.men must be between 1 and 8");
      const dist = s.wall.dist ?? 244;
      const toGoal = Math.hypot(GOAL.cx - ball.x, GOAL.lineY - ball.y);
      if (!(dist > 0 && dist < toGoal)) throw new Error("Free Kicks card: wall.dist must be positive and shorter than the ball-to-goal distance");
      const k = dist / toGoal;
      const cx = ball.x + (GOAL.cx - ball.x) * k + (s.wall.dx ?? 0);
      const half = men * WALL_HALF_PER_MAN;
      wall = {
        y: ball.y + (GOAL.lineY - ball.y) * k,
        left: cx - half,
        right: cx + half,
        clearance: s.wall.height ?? WALL.clearance,
        men,
        centers: Array.from({ length: men }, (_, i) => cx + (i - (men - 1) / 2) * WALL_SPACING),
      };
    }

    let tier = null;
    let overrides = {};
    if (typeof s.keeper === "string") tier = s.keeper;
    else if (s.keeper) {
      tier = s.keeper.tier || null;
      overrides = s.keeper;
    }
    if (tier && !KEEPER_TIERS[tier]) throw new Error(`Free Kicks card: unknown keeper tier "${tier}"`);
    const keeper = Object.assign({}, KEEPER, tier ? KEEPER_TIERS[tier] : null, overrides);
    delete keeper.tier;

    return { id: s.id, name: s.name, ball, wall, keeper };
  }

  /* Cards come from authored data; a bad one must never break the game. */
  function safeCard(spec) {
    try {
      return resolveCard(spec);
    } catch (err) {
      if (typeof console !== "undefined") console.warn(err.message);
      return resolveCard(null);
    }
  }

  /* ==========================================================================
     STAGES - the shipped card library and the five-kick sets built from it.
     The block below is generated from tools/free-kicks/cards.v1.json.
     ========================================================================== */
  /* fk-cards:begin (generated from tools/free-kicks/cards.v1.json by sync-cards.js - do not edit by hand) */
  const CARD_LIBRARY = {
    "version": 1,
    "cards": [
      {
        "id": "1.1",
        "name": {
          "en": "Kick-off",
          "ar": "ضربة البداية"
        },
        "tier": "Easy",
        "intended": "any",
        "mirror": true,
        "jitter": 10,
        "ball": {
          "x": 520,
          "y": 690
        },
        "wall": {
          "men": 3,
          "dist": 250
        },
        "keeper": "K1"
      },
      {
        "id": "1.2",
        "name": {
          "en": "The Gap",
          "ar": "الثغرة"
        },
        "tier": "Easy",
        "intended": "any",
        "mirror": true,
        "jitter": 10,
        "ball": {
          "x": 520,
          "y": 690
        },
        "wall": {
          "men": 3,
          "dist": 250,
          "dx": 95
        },
        "keeper": "K1"
      },
      {
        "id": "1.3",
        "name": {
          "en": "Wing Spot",
          "ar": "نقطة الجناح"
        },
        "tier": "Easy",
        "intended": "curl",
        "mirror": true,
        "jitter": 10,
        "ball": {
          "x": 292,
          "y": 639
        },
        "wall": {
          "men": 3,
          "dist": 250
        },
        "keeper": "K1"
      },
      {
        "id": "2.1",
        "name": {
          "en": "Great Wall",
          "ar": "الحائط العظيم"
        },
        "tier": "Easy",
        "intended": "lob",
        "mirror": true,
        "jitter": 10,
        "ball": {
          "x": 520,
          "y": 690
        },
        "wall": {
          "men": 6,
          "dist": 250
        },
        "keeper": {
          "tier": "K2",
          "reachZ": 40
        }
      },
      {
        "id": "2.2",
        "name": {
          "en": "Great Wall, Tall Mimi",
          "ar": "الحائط العظيم، ميمي الطويلة"
        },
        "tier": "Medium",
        "intended": "lob",
        "mirror": true,
        "jitter": 10,
        "ball": {
          "x": 520,
          "y": 690
        },
        "wall": {
          "men": 6,
          "dist": 250
        },
        "keeper": {
          "tier": "K2",
          "reachZ": 52
        }
      },
      {
        "id": "2.3",
        "name": {
          "en": "Wing Wall",
          "ar": "حائط الجناح"
        },
        "tier": "Easy",
        "intended": "lob",
        "mirror": true,
        "jitter": 10,
        "ball": {
          "x": 326,
          "y": 567
        },
        "wall": {
          "men": 6,
          "dist": 220
        },
        "keeper": {
          "tier": "K2",
          "reachZ": 40
        }
      },
      {
        "id": "3.1",
        "name": {
          "en": "Short Wall",
          "ar": "الحائط القصير"
        },
        "tier": "Medium",
        "intended": "bend",
        "mirror": true,
        "jitter": 10,
        "ball": {
          "x": 520,
          "y": 690
        },
        "wall": {
          "men": 3,
          "dist": 190
        },
        "keeper": "K2"
      },
      {
        "id": "3.2",
        "name": {
          "en": "Tight Spot",
          "ar": "نقطة ضيقة"
        },
        "tier": "Medium",
        "intended": "bend",
        "mirror": true,
        "jitter": 10,
        "ball": {
          "x": 520,
          "y": 610
        },
        "wall": {
          "men": 3,
          "dist": 190
        },
        "keeper": "K2"
      },
      {
        "id": "3.3",
        "name": {
          "en": "Wing Curl",
          "ar": "لفّة الجناح"
        },
        "tier": "Easy",
        "intended": "curl",
        "mirror": true,
        "jitter": 10,
        "ball": {
          "x": 292,
          "y": 639
        },
        "wall": {
          "men": 4,
          "dist": 200
        },
        "keeper": "K2"
      },
      {
        "id": "3.4",
        "name": {
          "en": "Short Wall, Four",
          "ar": "الحائط القصير، أربعة"
        },
        "tier": "Hard",
        "intended": "curl",
        "mirror": true,
        "jitter": 10,
        "ball": {
          "x": 520,
          "y": 690
        },
        "wall": {
          "men": 4,
          "dist": 200
        },
        "keeper": "K2"
      },
      {
        "id": "4.1",
        "name": {
          "en": "Crowded Middle",
          "ar": "الوسط المزدحم"
        },
        "tier": "Medium",
        "intended": "curl",
        "mirror": true,
        "jitter": 10,
        "ball": {
          "x": 520,
          "y": 610
        },
        "wall": {
          "men": 5,
          "dist": 200
        },
        "keeper": "K3"
      },
      {
        "id": "4.2",
        "name": {
          "en": "Tall Wing",
          "ar": "جناح عالٍ"
        },
        "tier": "Medium",
        "intended": "curl",
        "mirror": true,
        "jitter": 10,
        "ball": {
          "x": 224,
          "y": 502
        },
        "wall": {
          "men": 4,
          "dist": 230,
          "height": 70
        },
        "keeper": "K4"
      },
      {
        "id": "4.3",
        "name": {
          "en": "Tall Wing Two",
          "ar": "جناح عالٍ 2"
        },
        "tier": "Medium",
        "intended": "curl",
        "mirror": true,
        "jitter": 10,
        "ball": {
          "x": 326,
          "y": 567
        },
        "wall": {
          "men": 4,
          "dist": 230,
          "height": 64
        },
        "keeper": "K2"
      },
      {
        "id": "4.4",
        "name": {
          "en": "Wide Wall",
          "ar": "الحائط العريض"
        },
        "tier": "Hard",
        "intended": "curl",
        "mirror": true,
        "jitter": 10,
        "ball": {
          "x": 292,
          "y": 639
        },
        "wall": {
          "men": 5,
          "dist": 200,
          "height": 64
        },
        "keeper": "K3"
      },
      {
        "id": "5.1",
        "name": {
          "en": "Far Wing",
          "ar": "الجناح البعيد"
        },
        "tier": "Hard",
        "intended": "curl",
        "mirror": true,
        "jitter": 10,
        "ball": {
          "x": 748,
          "y": 639
        },
        "wall": {
          "men": 5,
          "dist": 206,
          "height": 64
        },
        "keeper": "K4"
      },
      {
        "id": "5.2",
        "name": {
          "en": "The Squeeze",
          "ar": "الضغط"
        },
        "tier": "Medium",
        "intended": "bend",
        "mirror": true,
        "jitter": 10,
        "ball": {
          "x": 520,
          "y": 530
        },
        "wall": {
          "men": 3,
          "dist": 190
        },
        "keeper": "K5"
      },
      {
        "id": "5.3",
        "name": {
          "en": "Final Whistle",
          "ar": "صافرة النهاية"
        },
        "tier": "Expert",
        "intended": "curl",
        "mirror": true,
        "jitter": 10,
        "ball": {
          "x": 292,
          "y": 639
        },
        "wall": {
          "men": 5,
          "dist": 190,
          "height": 70
        },
        "keeper": "K5"
      },
      {
        "id": "5.4",
        "name": {
          "en": "Edge of the Box",
          "ar": "حافة منطقة الجزاء"
        },
        "tier": "Expert",
        "intended": "curl",
        "mirror": true,
        "jitter": 10,
        "ball": {
          "x": 520,
          "y": 540
        },
        "wall": {
          "men": 5,
          "dist": 200
        },
        "keeper": "K5"
      }
    ],
    "sets": [
      {
        "id": "stage-1-the-spot",
        "kind": "campaign",
        "kicks": [
          "1.1",
          "1.3",
          "1.2",
          {
            "card": "1.3",
            "mirror": true
          },
          {
            "card": "1.1",
            "keeper": "K2"
          }
        ],
        "name": {
          "en": "The Spot",
          "ar": "النقطة"
        }
      },
      {
        "id": "stage-2-over-the-wall",
        "kind": "campaign",
        "kicks": [
          "2.1",
          "2.3",
          {
            "card": "2.1",
            "mirror": true
          },
          "2.2",
          {
            "card": "2.3",
            "mirror": true
          }
        ],
        "name": {
          "en": "Over the Wall",
          "ar": "فوق الحائط"
        }
      },
      {
        "id": "stage-3-around-the-wall",
        "kind": "campaign",
        "kicks": [
          "3.3",
          "3.1",
          "3.2",
          {
            "card": "3.3",
            "mirror": true
          },
          "3.4"
        ],
        "name": {
          "en": "Around the Wall",
          "ar": "حول الحائط"
        }
      },
      {
        "id": "stage-4-the-mix",
        "kind": "campaign",
        "kicks": [
          "4.1",
          "4.2",
          "4.3",
          {
            "card": "4.2",
            "mirror": true
          },
          "4.4"
        ],
        "name": {
          "en": "The Mix",
          "ar": "المزيج"
        }
      },
      {
        "id": "stage-5-pressure",
        "kind": "campaign",
        "kicks": [
          "4.2",
          "4.1",
          "5.2",
          "4.3",
          "4.4"
        ],
        "name": {
          "en": "Pressure",
          "ar": "تحت الضغط"
        }
      },
      {
        "id": "legend-future",
        "kind": "legend",
        "kicks": [
          "5.2",
          "4.4",
          "5.1",
          "5.3",
          "5.4"
        ],
        "name": {
          "en": "Legend",
          "ar": "الأسطورة"
        }
      }
    ]
  };
  /* fk-cards:end */

  const SET_SIZE = 5;
  const starsForGoals = (goals) => (goals >= 5 ? 3 : goals >= 4 ? 2 : goals >= 3 ? 1 : 0);

  /* Mirror a card about the goal axis. */
  function mirrorSpec(spec) {
    const m = JSON.parse(JSON.stringify(spec));
    const flip = (x) => 2 * GOAL.cx - x;
    if (m.ball && m.ball.x != null) m.ball.x = flip(m.ball.x);
    if (m.wall && m.wall.dx) m.wall.dx = -m.wall.dx;
    if (m.keeper && typeof m.keeper === "object" && m.keeper.homeX != null) m.keeper.homeX = flip(m.keeper.homeX);
    return m;
  }

  /* A set kick is a card id or { card, mirror, keeper, wall } overrides. */
  function resolveKick(ref) {
    const r = typeof ref === "string" ? { card: ref } : ref;
    const base = CARD_LIBRARY.cards.find((c) => c.id === r.card);
    if (!base) return null;
    let spec = JSON.parse(JSON.stringify(base));
    if (r.mirror) spec = mirrorSpec(spec);
    if (r.keeper) spec.keeper = r.keeper;
    if (r.wall) spec.wall = Object.assign({}, spec.wall, r.wall);
    return { id: r.card + (r.mirror ? "<->" : ""), name: base.name, spec };
  }

  const stageSets = () => CARD_LIBRARY.sets.filter((s) => s.kind === "campaign");

  /* ==========================================================================
     PROGRESS - the best result per stage, kept under its OWN localStorage key.
     Nothing here reads or writes the Classic save (crazy-goal-save) or any
     other key. Storage can be missing, full, corrupt or from a newer version;
     none of that may break the game, so progress then lives in memory for the
     session. Shape: { v: 1, stages: { "<set id>": { stars, goals, plays } } }.
     ========================================================================== */
  const QUICK_UNLOCK_STAGE = "stage-3-around-the-wall";   // a star here opens Quick Five
  const PROGRESS_KEY = "crazy-kora-fk-progress";
  const PROGRESS_VERSION = 1;
  const Progress = (() => {
    let memory = { v: PROGRESS_VERSION, stages: {} };
    let persisted = true;    // false while storage is unusable or holds newer data we must not overwrite
    const int = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(Number(n)) || 0));
    const isStage = (id) => CARD_LIBRARY.sets.some((s) => s.id === id);

    function sanitize(raw) {
      const out = { v: PROGRESS_VERSION, stages: {} };
      const src = raw && typeof raw === "object" && raw.stages && typeof raw.stages === "object" ? raw.stages : {};
      for (const id of Object.keys(src)) {
        const e = src[id];
        if (!e || typeof e !== "object") continue;
        out.stages[id] = { stars: int(e.stars, 0, 3), goals: int(e.goals, 0, SET_SIZE), plays: int(e.plays, 0, 1e9) };
      }
      out.quick = sanitizeQuick(raw && raw.quick);
      return out;
    }

    /* Quick Five: best result, plays, and the card ids of the latest set (to avoid repeating them). */
    function sanitizeQuick(q) {
      const src = q && typeof q === "object" ? q : {};
      const recent = Array.isArray(src.recent) ? src.recent.filter((x) => typeof x === "string" && x.length <= 12).slice(0, 10) : [];
      return { plays: int(src.plays, 0, 1e9), bestGoals: int(src.bestGoals, 0, SET_SIZE), bestStars: int(src.bestStars, 0, 3), recent };
    }

    /* Re-read storage every time so two open tabs merge instead of overwriting. */
    function load() {
      try {
        const text = localStorage.getItem(PROGRESS_KEY);
        if (!text) {
          memory = persisted ? { v: PROGRESS_VERSION, stages: {} } : memory;
          return memory;
        }
        const raw = JSON.parse(text);
        if (raw && typeof raw.v === "number" && raw.v > PROGRESS_VERSION) {
          persisted = false;            // written by a newer game: read it, never overwrite it
          memory = sanitize(raw);
          return memory;
        }
        persisted = true;
        memory = sanitize(raw);
      } catch {
        // unreadable or corrupt: start clean and let the next save replace it
        if (persisted) memory = { v: PROGRESS_VERSION, stages: {} };
      }
      return memory;
    }

    function write() {
      if (!persisted) return false;
      try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(memory));
        return true;
      } catch {
        persisted = false;              // full or blocked: keep going in memory
        return false;
      }
    }

    const clone = (o) => JSON.parse(JSON.stringify(o));
    return {
      key: PROGRESS_KEY,
      get: () => clone(load()),
      stars: (id) => (load().stages[id] || { stars: 0 }).stars,
      quick: () => sanitizeQuick(load().quick),
      /* Quick Five opens once the player has a star on QUICK_UNLOCK_STAGE. */
      quickUnlocked: () => (load().stages[QUICK_UNLOCK_STAGE] || { stars: 0 }).stars >= 1,
      /* Remember which cards the latest Quick Five used. */
      noteQuick(ids) {
        load();
        memory.quick = Object.assign(sanitizeQuick(memory.quick), { recent: sanitizeQuick({ recent: ids }).recent });
        write();
      },
      recordQuick(goals) {
        load();
        const g = int(goals, 0, SET_SIZE);
        const stars = starsForGoals(g);
        const q = sanitizeQuick(memory.quick);
        const improved = stars > q.bestStars || g > q.bestGoals;
        memory.quick = { plays: q.plays + 1, bestGoals: Math.max(q.bestGoals, g), bestStars: Math.max(q.bestStars, stars), recent: q.recent };
        const saved = write();
        return Object.assign({ improved, persisted: saved }, memory.quick);
      },
      /* Stage 1 is open; each later stage needs one star on the stage before it. */
      unlocked(id) {
        const list = CARD_LIBRARY.sets.filter((s) => s.kind === "campaign");
        const i = list.findIndex((s) => s.id === id);
        if (i === 0) return true;
        if (i > 0) return (load().stages[list[i - 1].id] || { stars: 0 }).stars >= 1;
        const legend = CARD_LIBRARY.sets.find((s) => s.id === id && s.kind === "legend");
        return !!legend && !!list.length && (load().stages[list[list.length - 1].id] || { stars: 0 }).stars >= 1;
      },
      /* Keep the best stars and goals, count the play. Returns null for an unknown stage. */
      record(id, goals) {
        if (!isStage(id)) return null;
        load();
        const g = int(goals, 0, SET_SIZE);
        const stars = starsForGoals(g);
        const e = memory.stages[id] || { stars: 0, goals: 0, plays: 0 };
        const improved = stars > e.stars || g > e.goals;
        memory.stages[id] = { stars: Math.max(e.stars, stars), goals: Math.max(e.goals, g), plays: e.plays + 1 };
        const saved = write();
        return Object.assign({ improved, persisted: saved }, memory.stages[id]);
      },
      reset() {
        memory = { v: PROGRESS_VERSION, stages: {} };
        persisted = true;
        try {
          localStorage.removeItem(PROGRESS_KEY);
        } catch {
          persisted = false;
        }
      },
      status: () => ({ persisted }),
    };
  })();

  /* ==========================================================================
     QUICK FIVE - a replayable random five-kick set drawn from the validated
     card pool. Nothing new is generated: the draw only chooses WHICH authored
     cards to play, whether to mirror each one, and a small ball offset inside
     that card's validated jitter (card.jitter, checked at its four corners by
     tools/free-kicks/validate.js --jitter-only). A seed makes a set repeatable.
     ========================================================================== */
  const QUICK_NAME = { en: "Quick Five", ar: "خمسة سريعة" };
  const DAILY_NAME = { en: "Daily Kick", ar: "ركلة اليوم" };
  /* Difficulty curve by authored tier. Only one Hard slot: a set may hold at
     most one kick under 60% touch (the approved campaign fairness rule). */
  const QUICK_SLOTS = [["Easy"], ["Easy", "Medium"], ["Medium"], ["Medium"], ["Hard"]];
  const SEED_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";   // no 0/O/1/I
  const SEED_LEN = 6;

  function newSeed() {
    let s = "";
    for (let i = 0; i < SEED_LEN; i++) s += SEED_CHARS[(Math.random() * SEED_CHARS.length) | 0];
    return s;
  }

  /* The Daily Kick's seed for a local calendar date "YYYY-MM-DD": the same six characters for everybody on that date,
     on every device (nothing but the date feeds it). Anything that is not such a date gives null. */
  function seedForDate(date) {
    const text = String(date == null ? "" : date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    const rng = rngFromSeed("daily:" + text);
    let seed = "";
    for (let i = 0; i < SEED_LEN; i++) seed += SEED_CHARS[(rng() * SEED_CHARS.length) | 0];
    return seed;
  }

  /* The five results as a line of emoji (a ball for a goal, a cross for a miss), for the share text. */
  const dailyLineOf = (results) => results.map((r) => (r.goal ? "\u26BD" : "\u274C")).join("");

  /* The game's address without the query or hash (an invite link carries a friend's id), so a share text holds no personal data. */
  const shareUrl = () => {
    try {
      return location.origin + location.pathname;
    } catch {
      return "";
    }
  };

  /* A seed typed or stored by a person: upper-case, valid characters only, exact length. */
  function normalizeSeed(raw) {
    const s = String(raw == null ? "" : raw).toUpperCase().split("").filter((ch) => SEED_CHARS.includes(ch)).join("");
    return s.length === SEED_LEN ? s : null;
  }

  function rngFromSeed(seed) {
    let h = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    let a = h >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Adjacent kicks must not teach the same route ("any" fits next to anything). */
  const routeClash = (a, b) => a !== "any" && b !== "any" && a === b;
  /* Every set needs a lob and a bend-style (curl or bend) kick. */
  const hasVariety = (cards) => cards.some((c) => c.intended === "lob") && cards.some((c) => c.intended === "curl" || c.intended === "bend");

  /* Returns { seed, kicks: [{ card, mirror, dx, dy }] } or null. A seed ALWAYS
     gives the same set (nothing else feeds the draw), so a seed can be replayed
     any time, on any device. */
  function drawQuick(rawSeed) {
    const seed = normalizeSeed(rawSeed) || newSeed();
    const rng = rngFromSeed(seed);
    const pool = CARD_LIBRARY.cards.filter((c) => c.tier !== "Expert");   // Expert cards are Legend-only
    const shuffle = (list) => {
      const r = list.slice();
      for (let i = r.length - 1; i > 0; i--) {
        const j = (rng() * (i + 1)) | 0;
        [r[i], r[j]] = [r[j], r[i]];
      }
      return r;
    };
    const search = (slot, picks) => {
      if (slot === SET_SIZE) return hasVariety(picks) ? picks : null;
      for (const c of shuffle(pool.filter((x) => QUICK_SLOTS[slot].includes(x.tier)))) {
        if (picks.some((p) => p.id === c.id)) continue;
        if (slot && routeClash(picks[slot - 1].intended, c.intended)) continue;
        const found = search(slot + 1, picks.concat(c));
        if (found) return found;
      }
      return null;
    };
    const picks = search(0, []);
    if (!picks) return null;
    const kicks = picks.map((c) => {
      const movable = !!c.mirror && ((c.ball && c.ball.x !== GOAL.cx) || !!(c.wall && c.wall.dx));
      const mirror = movable && rng() < 0.5;
      const j = c.jitter || 0;
      const dx = j ? Math.round((rng() * 2 - 1) * j) || 0 : 0;
      const dy = j ? Math.round((rng() * 2 - 1) * j) || 0 : 0;
      return { card: c.id, mirror, dx, dy };
    });
    return { seed, kicks };
  }

  /* A fresh set that shares as few cards as possible with the previous one:
     try new seeds until one has no card in common (the pool allows it almost
     always), else keep the closest. */
  function drawNewQuick(recent) {
    const avoid = new Set(recent || []);
    let best = null;
    let bestShared = 99;
    for (let attempt = 0; attempt < 60; attempt++) {
      const set = drawQuick(newSeed());
      if (!set) continue;
      const shared = set.kicks.filter((k) => avoid.has(k.card)).length;
      if (shared < bestShared) {
        best = set;
        bestShared = shared;
      }
      if (!shared) break;
    }
    return best;
  }

  /* A drawn kick as a playable card: mirrored, then the ball offset (the wall follows the ball). */
  function resolveQuickKick(k) {
    const base = CARD_LIBRARY.cards.find((c) => c.id === k.card);
    if (!base) return null;
    let spec = JSON.parse(JSON.stringify(base));
    if (k.mirror) spec = mirrorSpec(spec);
    /* a portrait phone shows 320 px each side of the goal axis and the ball is 17 px wide:
       keep the whole ball on screen when a wing card's jitter pushes it outward */
    spec.ball = { x: clamp(spec.ball.x + k.dx, FOCUS.cx - 300, FOCUS.cx + 300), y: spec.ball.y + k.dy };
    return { id: k.card + (k.mirror ? "<->" : ""), name: base.name, spec };
  }

  /* Copy for the set runner. Callers may override any key through opts.strings. */
  const RUN_STRINGS = {
    en: {
      back: "BACK",
      runKick: "KICK",
      runFinal: "FINAL KICK",
      runNeed1: "A GOAL CLEARS THE STAGE",
      runNeed2: "A GOAL EARNS 2 STARS",
      runNeed3: "A GOAL EARNS 3 STARS",
      runNext: "NEXT KICK",
      runSeeResult: "SEE RESULT",
      runRestart: "Restart stage",
      runPips: "Kick {k} of 5, goals {g}",
      runStars: "{s} of 3 stars",
      runGoals: "GOALS {g}/5",
      runClear: "STAGE CLEAR!",
      runFail: "TRY AGAIN",
      runNoteStars3: "Perfect! Five out of five.",
      runNoteStars2: "Great shooting. One more goal for 3 stars.",
      runNoteStars1: "Stage clear. Score 4 for 2 stars.",
      runNoteStars0: "Score 3 goals to clear the stage.",
      runNextStage: "NEXT STAGE",
      runRetry: "RETRY STAGE",
      runQuickClear: "WELL PLAYED!",
      runQuickNote1: "Nice. Score 4 for 2 stars.",
      runQuickNote0: "Score 3 goals to earn a star.",
      runNewFive: "NEW FIVE",
      runSameFive: "SAME FIVE",
      runSeed: "SEED {s}",
      runPractice: "PRACTICE",
      runCoins: "+{n} COINS",
      dailyTitle: "DAILY KICK",
      dailyShare: "SHARE",
      dailyCopied: "COPIED",
      dailyAgain: "PRACTISE AGAIN",
      dailyStreak: "{n} DAY STREAK",
      dailyPractice: "PRACTICE. TODAY'S RESULT IS ALREADY IN.",
      dailyShareText: "CRAZY KORA · DAILY KICK {date}",
      runNotScored: "NOT SCORED",
      runPracticeHint: "TAP A KICK TO PRACTISE IT",
      runPracticeKick: "Practise kick {k}: {n}, {r}",
      runGoalWord: "goal",
      runMissWord: "missed",
      runPracticeAgain: "TRY AGAIN",
      runBackResult: "BACK TO RESULT",
      runPracticePips: "Practising kick {k} of 5",
      resultPostTitle: "OFF THE POST!",
      resultPostNote: "So close! A touch further inside and it goes in.",
      resultBarTitle: "OFF THE BAR!",
      resultBarNote: "So close! Take a touch of height off that one.",
      previewBlocked: "BLOCKED",
      previewClear: "CLEAR",
      previewAround: "AROUND",
      previewPost: "POST",
      previewBar: "BAR",
      helpLabel: "How to play",
      settingsLabel: "Settings",
      tutStepOf: "STEP {k} OF 3",
      tutSkip: "SKIP",
      tutBack: "BACK",
      tutNext: "NEXT",
      tutPlay: "PLAY",
      tut1Title: "AIM AND POWER",
      tut1Text: "Press the ball and drag backwards. The further you pull, the harder the kick. Let go to shoot.",
      tut2Title: "CHOOSE YOUR SHOT",
      tut2Text: "GROUND keeps the ball low: bend it around the wall. AIR lifts it: try to clear the wall.",
      tut2Ground: "GROUND",
      tut2Air: "AIR",
      tut3Title: "APPLY BEND",
      tut3Text: "Slide BEND to curve the ball and find a route around the wall.",
      tut3Left: "BEND LEFT",
      tut3None: "NO BEND",
      tut3Right: "BEND RIGHT",
    },
    ar: {
      back: "رجوع",
      runKick: "الركلة",
      runFinal: "الركلة الأخيرة",
      runNeed1: "هدف واحد يجتاز بك المرحلة",
      runNeed2: "هدف يمنحك نجمتين",
      runNeed3: "هدف يمنحك 3 نجوم",
      runNext: "الركلة التالية",
      runSeeResult: "عرض النتيجة",
      runRestart: "إعادة المرحلة",
      runPips: "الركلة {k} من 5، الأهداف {g}",
      runStars: "{s} من 3 نجوم",
      runGoals: "الأهداف {g}/5",
      runClear: "تجاوزت المرحلة!",
      runFail: "حاول مجددًا",
      runNoteStars3: "مثالي! خمسة من خمسة.",
      runNoteStars2: "تسديد رائع. هدف إضافي لنيل 3 نجوم.",
      runNoteStars1: "تجاوزت المرحلة. سجّل 4 أهداف لنجمتين.",
      runNoteStars0: "سجّل 3 أهداف لتجتاز المرحلة.",
      runNextStage: "المرحلة التالية",
      runRetry: "أعد المرحلة",
      runQuickClear: "أحسنت!",
      runQuickNote1: "جميل. سجّل 4 أهداف لنجمتين.",
      runQuickNote0: "سجّل 3 أهداف لتنال نجمة.",
      runNewFive: "خمسة جديدة",
      runSameFive: "الخمسة نفسها",
      runSeed: "الرمز {s}",
      runPractice: "تمرين",
      runCoins: "+{n} عملة",
      dailyTitle: "ركلة اليوم",
      dailyShare: "مشاركة",
      dailyCopied: "تم النسخ",
      dailyAgain: "تدرّب مجددًا",
      dailyStreak: "{n} أيام متتالية",
      dailyPractice: "تمرين. نتيجة اليوم محسوبة بالفعل.",
      dailyShareText: "كرة كورا · ركلة اليوم {date}",
      runNotScored: "غير محتسبة",
      runPracticeHint: "اضغط على ركلة لتتدرّب عليها",
      runPracticeKick: "تدرّب على الركلة {k}: {n}، {r}",
      runGoalWord: "هدف",
      runMissWord: "لم تسجّل",
      runPracticeAgain: "حاول مجددًا",
      runBackResult: "العودة إلى النتيجة",
      runPracticePips: "تدريب على الركلة {k} من 5",
      resultPostTitle: "ارتطمت بالقائم!",
      resultPostNote: "قريبة جدًا! أقرب قليلًا نحو الداخل وتدخل.",
      resultBarTitle: "ارتطمت بالعارضة!",
      resultBarNote: "قريبة جدًا! خفّف الارتفاع قليلًا.",
      previewBlocked: "محجوبة",
      previewClear: "تتجاوز",
      previewAround: "حول الحائط",
      previewPost: "القائم",
      previewBar: "العارضة",
      helpLabel: "كيف تلعب",
      settingsLabel: "الإعدادات",
      tutStepOf: "الخطوة {k} من 3",
      tutSkip: "تخطّي",
      tutBack: "السابق",
      tutNext: "التالي",
      tutPlay: "العب",
      tut1Title: "التصويب والقوة",
      tut1Text: "اضغط على الكرة واسحبها للخلف. كلما سحبت أكثر، كانت الركلة أقوى. اترك لتسدّد.",
      tut2Title: "اختر نوع التسديدة",
      tut2Text: "«أرضية» تُبقي الكرة منخفضة: لُفّها حول الحائط. «هوائية» ترفعها: حاول تجاوز الحائط.",
      tut2Ground: "أرضية",
      tut2Air: "هوائية",
      tut3Title: "أضف لفّة",
      tut3Text: "حرّك منزلق اللفّة لتقوّس الكرة وتجد طريقًا حول الحائط.",
      tut3Left: "لفّة يسارًا",
      tut3None: "بلا لفّة",
      tut3Right: "لفّة يمينًا",
    },
  };

  /* Launch velocity for a drag power (0..1) and a unit aim direction. */
  function launchVelocity(power, dirX, dirY, type) {
    const p = clamp(power, 0, 1);
    const speed = SHOT.minSpeed + (SHOT.maxSpeed - SHOT.minSpeed) * p;
    return {
      vx: dirX * speed,
      vy: dirY * speed,
      vz: type === "air" ? SHOT.minVz + (SHOT.maxVz - SHOT.minVz) * p : 0,
    };
  }

  /* One integration step of the ball: height, bend and drag. Mutates b. */
  function integrateBall(b, dt, type, bend) {
    if (type === "air") {
      b.vz -= SHOT.gravity * dt;
      b.z += b.vz * dt;
      if (b.z <= 0) {
        const impact = -b.vz;
        b.z = 0;
        if (impact > 120) {
          b.vz = impact * 0.2;
          b.landedImpact = impact;
        } else {
          b.vz = 0;
        }
      }
    } else {
      b.z = 0;
      b.vz = 0;
    }

    const speed = len(b.vx, b.vy);
    if (speed <= 0.01) return;
    if (bend && !b.curveOff && !b.netDrag) {
      /* grip: 1 on a normal shot, fading to 0 as the ball slows or has already
         turned a long way (b.turned, radians) - see SHOT.curveSlowFrom */
      const turned = b.turned || 0;
      const grip =
        smooth(smoothRange(SHOT.curveSlowTo, SHOT.curveSlowFrom, speed)) *
        (1 - smooth(smoothRange(SHOT.curveFullTurn, SHOT.curveEndTurn, turned)));
      if (grip > 0) {
        const ox = b.vx;
        const oy = b.vy;
        const nx = -oy / speed;
        const ny = ox / speed;
        b.vx += nx * SHOT.curve * bend * grip * dt;
        b.vy += ny * SHOT.curve * bend * grip * dt;
        const bent = len(b.vx, b.vy);
        if (bent > 0.01) {
          const keep = speed / bent;
          b.vx *= keep;
          b.vy *= keep;
        }
        b.turned = turned + Math.abs(Math.atan2(ox * b.vy - oy * b.vx, ox * b.vx + oy * b.vy));
      }
    }
    const drag = b.netDrag ? 5.5 : type === "air" && b.z > 4 ? SHOT.dragAir : SHOT.dragGround;
    const damp = Math.exp(-drag * dt);
    b.vx *= damp;
    b.vy *= damp;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.spin += (speed * dt) / BALL_R;
  }

  /* Where the ball crossed a horizontal line this step while travelling up
     the pitch ({x, z} interpolated at the line), or null. */
  function lineCrossing(prev, b, lineY) {
    if (b.vy >= 0 || prev.y <= lineY || b.y > lineY) return null;
    const t = clamp((prev.y - lineY) / Math.max(0.0001, prev.y - b.y), 0, 1);
    return { x: lerp(prev.x, b.x, t), z: lerp(prev.z, b.z, t) };
  }

  /* Wall crossing: null when the ball is not at the wall; otherwise
     {x, z, blocked}. blocked means it was too low to clear the defenders. */
  function wallCrossing(prev, b, wall = WALL) {
    const c = lineCrossing(prev, b, wall.y);
    if (!c || !(c.x > wall.left - 8 && c.x < wall.right + 8)) return null;
    c.blocked = c.z < wall.clearance;
    return c;
  }

  /* Height Mimi can add by leaping (never beyond keeper.jumpMax in total). */
  const jumpRoom = (keeper) => Math.max(0, Math.min(keeper.jumpZ, keeper.jumpMax - keeper.reachZ));

  /* Keeper interception on the catch line: the crossing, or null.
     Low balls (z <= reachZ): the normal save, reachX wide. Higher balls need
     the leap: jz is her current leap height (k.jz), she can then reach
     reachZ + jz, but only jumpX either side of where she stands. The crossing
     comes back with air: true for the second kind. */
  function keeperCatch(prev, b, keeperX, keeper = KEEPER, jz = 0) {
    const c = lineCrossing(prev, b, keeper.catY);
    if (!c) return null;
    const dx = Math.abs(c.x - keeperX);
    if (c.z <= keeper.reachZ) return dx <= keeper.reachX ? c : null;
    c.air = true;
    return jz > 1 && c.z <= keeper.reachZ + jz && dx <= keeper.jumpX ? c : null;
  }

  /* First t in [0, 1] at which the point p + d*t meets the circle of radius R
     around the origin coming from outside (or 0 when it starts inside and is
     moving in), else null. */
  function segCircle(px, py, dx, dy, R) {
    const a = dx * dx + dy * dy;
    const c = px * px + py * py - R * R;
    const bq = px * dx + py * dy;
    if (c <= 0) return bq < 0 ? 0 : null;
    if (a < 1e-9) return null;
    const disc = bq * bq - a * c;
    if (disc < 0) return null;
    const t = (-bq - Math.sqrt(disc)) / a;
    return t >= 0 && t <= 1 ? t : null;
  }

  /* Swept test of one ball step (prev -> b) against the goal frame, so a fast
     shot cannot tunnel through a post. Posts: circles in x/y, only below the
     top of the frame. Crossbar: a circle in y/z, only between the posts.
     Returns the earliest contact { kind, t, nx, ny, nz } (n points from the
     frame to the ball) or null. */
  function frameHit(prev, b) {
    const F = GOAL.frame;
    const dx = b.x - prev.x;
    const dy = b.y - prev.y;
    const dz = b.z - prev.z;
    let best = null;
    for (const cx of [GOAL.leftPostX, GOAL.rightPostX]) {
      const t = segCircle(prev.x - cx, prev.y - GOAL.postY, dx, dy, F.postHitR);
      if (t === null || prev.z + dz * t > F.barZ + F.barHitR) continue;
      const nx = prev.x + dx * t - cx;
      const ny = prev.y + dy * t - GOAL.postY;
      const l = Math.hypot(nx, ny) || 1;
      if (!best || t < best.t) best = { kind: "post", t, nx: nx / l, ny: ny / l, nz: 0, cx };
    }
    const t = segCircle(prev.y - F.barPlaneY, prev.z - F.barZ, dy, dz, F.barHitR);
    if (t !== null) {
      const x = prev.x + dx * t;
      if (x > GOAL.leftPostX && x < GOAL.rightPostX && (!best || t < best.t)) {
        const ny = prev.y + dy * t - F.barPlaneY;
        const nz = prev.z + dz * t - F.barZ;
        const l = Math.hypot(ny, nz) || 1;
        best = { kind: "bar", t, nx: 0, ny: ny / l, nz: nz / l };
      }
    }
    return best;
  }

  /* Bounce the ball off the frame contact found by frameHit. Mutates b: it is
     put back just outside the frame, the speed into the frame comes back
     scaled by the restitution (the sliding part keeps `slide` of its speed),
     and its bend is switched off. Returns { kind, impact, x, y, z } (impact is
     the speed into the frame, for the effects) or null when the ball was
     already moving away. Because the ball leaves the surface and the test only
     counts a ball moving INTO it, one contact fires exactly once. */
  function frameBounce(prev, b, hit) {
    const F = GOAL.frame;
    const vn = b.vx * hit.nx + b.vy * hit.ny + b.vz * hit.nz;
    if (vn >= 0) return null;
    const e = hit.kind === "post" ? F.restPost : F.restBar;
    const x = prev.x + (b.x - prev.x) * hit.t;
    const y = prev.y + (b.y - prev.y) * hit.t;
    const z = prev.z + (b.z - prev.z) * hit.t;
    b.vx = (b.vx - vn * hit.nx) * F.slide - e * vn * hit.nx;
    b.vy = (b.vy - vn * hit.ny) * F.slide - e * vn * hit.ny;
    b.vz = (b.vz - vn * hit.nz) * F.slide - e * vn * hit.nz;
    if (hit.kind === "post") {
      b.x = hit.cx + hit.nx * (F.postHitR + 0.6);
      b.y = GOAL.postY + hit.ny * (F.postHitR + 0.6);
      b.z = z;
    } else {
      b.x = x;
      b.y = F.barPlaneY + hit.ny * (F.barHitR + 0.6);
      b.z = Math.max(0, F.barZ + hit.nz * (F.barHitR + 0.6));
    }
    b.curveOff = true;
    b.frameHit = hit.kind;
    return { kind: hit.kind, impact: -vn, x, y, z };
  }

  /* Goal-line crossing: {x, z, outcome} with outcome wide / tooHigh / goal. */
  function goalCrossing(prev, b) {
    const c = lineCrossing(prev, b, GOAL.lineY);
    if (!c) return null;
    const inGoal = c.x > GOAL.left + GOAL.post && c.x < GOAL.right - GOAL.post;
    c.outcome = !inGoal ? "wide" : c.z > GOAL.crossbarZ ? "tooHigh" : "goal";
    return c;
  }

  function outOfBounds(b) {
    return (
      b.x < FIELD.left - 70 ||
      b.x > FIELD.right + 70 ||
      b.y > FIELD.bottom + 90 ||
      b.y < FIELD.top - 50
    );
  }

  /* Keeper movement: idle sway, alert delay, then a predictive chase of the
     ball's current heading. Mutates k ({x, vx, target, idle, alert}). */
  function stepKeeper(k, b, flying, resolved, dt, keeper = KEEPER, air = false) {
    /* the leap in progress: k.jt seconds in, k.jz her height, k.jh its peak */
    if (k.jt > 0) {
      k.jt += dt;
      const u = k.jt / keeper.jumpTime;
      if (u >= 1) {
        k.jt = 0;
        k.jz = 0;
      } else k.jz = k.jh * Math.sin(Math.PI * u);
    }
    if (flying && b.vy < -70 && b.y > keeper.catY + 10 && !resolved) {
      k.alert += dt;
      if (k.alert >= keeper.alertT) {
        const t = (b.y - keeper.catY) / Math.max(1, -b.vy);
        k.target = clamp(b.x + b.vx * t, keeper.minX, keeper.maxX);
        /* Aerial save: leap so the peak of the jump meets the lob at the catch
           line. She reads the straight-line path (a bent shot fools her, as on
           the ground) and only commits when the ball is coming at her and she
           is already set under it - a shot she has to run for is not saved. */
        if (air && !(k.jt > 0) && k.alert >= keeper.alertT + keeper.jumpReact && t <= keeper.jumpTime / 2) {
          const zc = b.z + b.vz * t - 0.5 * SHOT.gravity * t * t;
          const room = jumpRoom(keeper);
          if (
            zc > keeper.reachZ &&
            zc <= keeper.reachZ + room &&
            Math.abs(b.x + b.vx * t - k.x) <= keeper.jumpX &&
            Math.abs(k.vx) <= keeper.jumpSet
          ) {
            k.jt = 1e-6;
            k.jh = clamp(zc - keeper.reachZ + 4, 8, room);
          }
        }
      }
    } else {
      k.alert = 0;
      k.idle += dt;
      k.target = clamp(keeper.homeX + Math.sin(k.idle * keeper.swayRate) * keeper.sway, keeper.minX, keeper.maxX);
    }
    const diff = k.target - k.x;
    k.vx += clamp(diff * keeper.gain - k.vx, -keeper.accel * dt, keeper.accel * dt);
    k.x += k.vx * dt;
    if (k.x < keeper.minX) {
      k.x = keeper.minX;
      k.vx = 0;
    }
    if (k.x > keeper.maxX) {
      k.x = keeper.maxX;
      k.vx = 0;
    }
  }

  /* Headless shot with the game's exact rules and time stepping (60 Hz frames,
     4 ball sub-steps each, keeper stepped once per frame).
       shot:     { type: "ground"|"air", power 0..1, bend -1..1,
                   angle (radians from straight up, + = right)  or  dirX/dirY }
       options:  { keeperPhase: initial idle phase, preRoll: seconds of keeper
                   idle before the kick, frameDt, maxTime }
       returns:  { outcome, x, z, time, keeperX }  with outcome one of
                 goal / saved / wall / wide / tooHigh / missed. */
  function simulateShot(scenario, shot, options) {
    const scn = resolveScenario(scenario);
    const o = Object.assign({ keeperPhase: 0, preRoll: 1.5, frameDt: 1 / 60, maxTime: 5.5 }, options);
    const type = shot.type === "air" ? "air" : "ground";
    const bend = clamp(Number(shot.bend) || 0, -1, 1);
    let dirX = shot.dirX;
    let dirY = shot.dirY;
    if (shot.angle != null) {
      dirX = Math.sin(shot.angle);
      dirY = -Math.cos(shot.angle);
    }
    const v = launchVelocity(shot.power, dirX, dirY, type);
    const b = { x: scn.ball.x, y: scn.ball.y, z: 0, vx: v.vx, vy: v.vy, vz: v.vz, spin: 0, landedImpact: 0, netDrag: false };
    const k = { x: scn.keeper.homeX, vx: 0, target: scn.keeper.homeX, idle: o.keeperPhase, alert: 0, jt: 0, jz: 0, jh: 0 };
    const idleFrames = Math.round(o.preRoll / o.frameDt);
    for (let i = 0; i < idleFrames; i++) stepKeeper(k, b, false, false, o.frameDt, scn.keeper, type === "air");

    const frames = Math.max(1, Math.round(o.frameDt / (1 / 240)));
    const fdt = o.frameDt / frames;
    const done = (outcome, p, age) => ({ outcome, x: p.x, z: p.z, time: age, keeperX: k.x });
    /* a ball that hit the frame and found nothing else is a miss of that kind */
    const frameCall = (age) => (b.frameHit === "bar" ? done("tooHigh", b, age) : done("wide", b, age));
    let age = 0;
    let frameAt = -1;
    for (;;) {
      stepKeeper(k, b, true, false, o.frameDt, scn.keeper, type === "air");
      for (let i = 0; i < frames; i++) {
        const prev = { x: b.x, y: b.y, z: b.z };
        integrateBall(b, fdt, type, bend);
        const wall = wallCrossing(prev, b, scn.wall);
        if (wall && wall.blocked) return done("wall", wall, age);
        const catchHit = keeperCatch(prev, b, k.x, scn.keeper, k.jz);
        if (catchHit) return done("saved", catchHit, age);
        const frameContact = frameHit(prev, b);
        if (frameContact && frameBounce(prev, b, frameContact)) {
          if (frameAt < 0) frameAt = age;
          continue;
        }
        const goal = goalCrossing(prev, b);
        if (goal) return done(goal.outcome, goal, age);
        if (outOfBounds(b)) return b.frameHit ? frameCall(age) : done("missed", b, age);
      }
      age += o.frameDt;
      if (frameAt >= 0 && age - frameAt > GOAL.frame.settle) return frameCall(age);
      if (age > o.maxTime || (age > 1.5 && len(b.vx, b.vy) < 22 && b.z === 0)) return b.frameHit ? frameCall(age) : done("missed", b, age);
    }
  }

  class AudioBus {
    /* level: { muted(), volume() } from the shell (the player's sound settings), or nothing. */
    constructor(url, clips, level) {
      this.url = url;
      this.ctx = null;
      this.master = null;
      this.buffer = null;
      this.clips = new Map();   // name -> { buffer, start, dur } (silence trimmed, like Classic)
      this.sources = new Set();
      this.byName = new Map();   // name -> live sources, so stop(name) can cut one sound
      this.volume = 0.8;
      this.setLevel(level && typeof level.muted === "function" ? !!level.muted() : false, level && typeof level.volume === "function" ? level.volume() : 0.8);
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume * 0.8;
        this.master.connect(this.ctx.destination);
        this.ctx.resume?.().catch(() => {});
      } catch {
        this.ctx = null;
        return;
      }
      /* every decode checks this.ctx again: a bus that was destroyed meanwhile keeps nothing */
      const load = (u) =>
        fetch(u)
          .then((res) => (res.ok ? res.arrayBuffer() : null))
          .then((data) => (data && this.ctx ? this.ctx.decodeAudioData(data) : null));
      if (url) {
        load(url)
          .then((decoded) => {
            if (decoded && this.ctx) this.buffer = decoded;
          })
          .catch(() => {});
      }
      for (const [name, clipUrl] of Object.entries(clips || {})) {
        if (!clipUrl) continue;
        load(clipUrl)
          .then((decoded) => {
            if (decoded && this.ctx) this.clips.set(name, this.trim(decoded));
          })
          .catch(() => {});
      }
    }

    /* The player's sound settings, live: Classic's mute button and volume reach here through the shell. */
    setLevel(muted, volume) {
      const v = Number(volume);
      this.volume = muted ? 0 : Number.isFinite(v) ? clamp(v, 0, 1) : 0.8;
      if (this.ctx && this.master) this.master.gain.value = this.volume * 0.8;
    }

    /* Where the audible part of a recording starts and how long it lasts (leading and trailing silence skipped). */
    trim(buffer) {
      const threshold = 0.004;
      const len = buffer.length;
      const chans = [];
      for (let c = 0; c < buffer.numberOfChannels; c++) chans.push(buffer.getChannelData(c));
      const loud = (i) => chans.some((d) => Math.abs(d[i]) > threshold);
      let a = 0;
      while (a < len - 1 && !loud(a)) a++;
      let b = len - 1;
      while (b > a && !loud(b)) b--;
      const rate = buffer.sampleRate;
      const start = Math.max(0, a - Math.floor(rate * 0.003)) / rate;
      const end = Math.min(len - 1, b + Math.floor(rate * 0.02)) / rate;
      return { buffer, start, dur: Math.max(0.01, end - start) };
    }

    /* Browsers only start audio after a gesture; any press in the game calls this. */
    unlock() {
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume?.().catch(() => {});
    }

    /* name: a clip or a sheet sound; delay in seconds. Silent when neither is loaded. */
    play(name, gain = 1, rate = 1, delay = 0) {
      if (!this.ctx || !this.master || this.ctx.state === "closed") return;
      if (this.ctx.state === "suspended") this.unlock();
      let buffer;
      let from;
      let dur;
      let level = gain;
      const clip = this.clips.get(name);
      if (clip) {
        buffer = clip.buffer;
        from = clip.start;
        dur = clip.dur;
        level *= CLIP_GAIN[name] ?? 1;
      } else {
        let def = SFX[name] || SFX[SFX_FALLBACK[name]];
        if (!def || !this.buffer) return;
        if (Array.isArray(def[0])) def = def[(Math.random() * def.length) | 0];
        buffer = this.buffer;
        from = def[0];
        dur = Math.min(def[1], buffer.duration - def[0]);
      }
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const g = this.ctx.createGain();
      g.gain.value = level;
      source.playbackRate.value = rate;
      source.connect(g);
      g.connect(this.master);
      this.sources.add(source);
      let live = this.byName.get(name);
      if (!live) this.byName.set(name, (live = new Set()));
      live.add(source);
      source.onended = () => {
        this.sources.delete(source);
        live.delete(source);
      };
      try {
        source.start(this.ctx.currentTime + delay, from, dur);
      } catch {
        this.sources.delete(source);
        live.delete(source);
      }
    }

    /* Cuts every playing instance of one sound (the power-up while aiming). */
    stop(name) {
      const live = this.byName.get(name);
      if (!live) return;
      for (const source of live) {
        try {
          source.stop();
        } catch {
          /* already stopped */
        }
        this.sources.delete(source);
      }
      live.clear();
    }

    stopAll() {
      for (const source of this.sources) {
        try {
          source.stop();
        } catch {
          /* already stopped */
        }
      }
      this.sources.clear();
      this.byName.clear();
    }

    destroy() {
      this.stopAll();
      const ctx = this.ctx;
      this.buffer = null;
      this.clips.clear();
      this.master = null;
      this.ctx = null;
      if (ctx) {
        try {
          ctx.close().catch(() => {});
        } catch {
          /* noop */
        }
      }
    }
  }

  const TEMPLATE = `
    <div class="fk-shell">
      <div class="fk-arena" data-fk-stage>
        <canvas class="fk-canvas" data-fk-canvas tabindex="0"></canvas>
        <p class="fk-hint" data-fk-hint></p>
      </div>
      <header class="fk-hud" data-fk-hud>
        <div class="fk-hud-start">
          <button type="button" class="fk-back" data-fk-back>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
            <span data-fk-back-label></span>
          </button>
          <div class="fk-heading">
            <span class="fk-brand">CRAZY KORA</span>
            <h2 class="fk-title" data-fk-title></h2>
          </div>
        </div>
        <div class="fk-hud-mid" data-fk-deck>
          <div class="fk-control fk-control--shot">
            <span class="fk-label" data-fk-shot-label></span>
            <div class="fk-seg" role="group" data-fk-shot-group>
              <button type="button" data-fk-shot="ground" aria-pressed="true"></button>
              <button type="button" data-fk-shot="air" aria-pressed="false"></button>
            </div>
          </div>
          <div class="fk-control fk-control--bend">
            <div class="fk-label-row"><span class="fk-label" data-fk-bend-label></span><output data-fk-bend-out></output></div>
            <div class="fk-bend-row">
              <span class="fk-end" data-fk-left></span>
              <input class="fk-range" type="range" min="-100" max="100" step="5" value="0" dir="ltr" data-fk-range>
              <span class="fk-end" data-fk-right></span>
            </div>
            <span data-fk-straight hidden></span>
          </div>
        </div>
        <div class="fk-hud-end">
          <button type="button" class="fk-help fk-settings" data-fk-settings hidden><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M19.14 12.94a7.4 7.4 0 0 0 .05-.94 7.4 7.4 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.56-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.62-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.3.6.22l2.39-.96c.5.38 1.04.7 1.63.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.59-.24 1.13-.56 1.63-.94l2.39.96c.22.08.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"/></svg></button>
          <button type="button" class="fk-help" data-fk-help><span aria-hidden="true">?</span></button>
          <img class="fk-star" data-fk-star alt="" draggable="false" aria-hidden="true">
          <div class="fk-run" data-fk-run hidden>
            <ol class="fk-pips" data-fk-pips role="img">
              <li class="fk-pip"><i></i></li><li class="fk-pip"><i></i></li><li class="fk-pip" data-stars="★"><i></i></li><li class="fk-pip" data-stars="★★"><i></i></li><li class="fk-pip" data-stars="★★★"><i></i></li>
            </ol>
            <button type="button" class="fk-restart" data-fk-restart>
              <svg class="fk-ico-restart" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/></svg>
              <svg class="fk-ico-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </div>
        </div>
      </header>
      <div class="fk-sr-only" data-fk-live role="status" aria-live="polite" aria-atomic="true"></div>
      <div class="fk-banner" data-fk-banner hidden>
        <span class="fk-banner-kicker" data-fk-banner-kicker></span>
        <strong class="fk-banner-title" data-fk-banner-title></strong>
        <span class="fk-banner-sub" data-fk-banner-sub></span>
      </div>
      <div class="fk-result" data-fk-result hidden>
        <div class="fk-result-card" aria-labelledby="fk-result-title">
          <div class="fk-result-stars" data-fk-result-stars hidden>
            <img alt="" draggable="false"><img alt="" draggable="false"><img alt="" draggable="false">
          </div>
          <h3 class="fk-result-title" id="fk-result-title" data-fk-result-title></h3>
          <p class="fk-result-note" data-fk-result-note></p>
          <button type="button" class="fk-retry" data-fk-retry></button>
          <button type="button" class="fk-btn2" data-fk-practice-back hidden></button>
        </div>
      </div>
      <div class="fk-setresult" data-fk-setresult hidden>
        <div class="fk-setresult-card">
          <p class="fk-setresult-stage" data-fk-sr-stage></p>
          <div class="fk-result-stars" data-fk-sr-stars role="img">
            <img alt="" draggable="false"><img alt="" draggable="false"><img alt="" draggable="false">
          </div>
          <h3 class="fk-result-title" data-fk-sr-title></h3>
          <p class="fk-setresult-goals" data-fk-sr-goals></p>
          <p class="fk-setresult-coins" data-fk-sr-coins hidden></p>
          <p class="fk-setresult-line" data-fk-sr-line hidden></p>
          <p class="fk-setresult-streak" data-fk-sr-streak hidden></p>
          <button type="button" class="fk-btn2 fk-setresult-share" data-fk-sr-share hidden></button>
          <p class="fk-setresult-seed" data-fk-sr-seed hidden></p>
          <ol class="fk-pips fk-pips--result" data-fk-sr-pips>
            <li class="fk-pip"><button type="button" class="fk-pip-btn" data-fk-practice="0"><i></i></button></li><li class="fk-pip"><button type="button" class="fk-pip-btn" data-fk-practice="1"><i></i></button></li><li class="fk-pip"><button type="button" class="fk-pip-btn" data-fk-practice="2"><i></i></button></li><li class="fk-pip"><button type="button" class="fk-pip-btn" data-fk-practice="3"><i></i></button></li><li class="fk-pip"><button type="button" class="fk-pip-btn" data-fk-practice="4"><i></i></button></li>
          </ol>
          <p class="fk-setresult-hint" data-fk-sr-hint></p>
          <p class="fk-result-note" data-fk-sr-note></p>
          <div class="fk-setresult-actions">
            <button type="button" class="fk-retry" data-fk-sr-primary></button>
            <button type="button" class="fk-btn2" data-fk-sr-secondary></button>
            <button type="button" class="fk-btn2" data-fk-sr-back></button>
          </div>
        </div>
      </div>
      <div class="fk-tut" data-fk-tut hidden>
        <div class="fk-tut-card" role="dialog" aria-modal="true" aria-labelledby="fk-tut-title">
          <ol class="fk-tut-dots" aria-hidden="true"><li></li><li></li><li></li></ol>
          <div class="fk-tut-art" data-fk-tut-art aria-hidden="true"></div>
          <p class="fk-tut-step" data-fk-tut-step></p>
          <h3 class="fk-tut-title" id="fk-tut-title" data-fk-tut-title></h3>
          <p class="fk-tut-text" data-fk-tut-text></p>
          <div class="fk-tut-actions">
            <button type="button" class="fk-btn2" data-fk-tut-skip></button>
            <button type="button" class="fk-btn2" data-fk-tut-back></button>
            <button type="button" class="fk-retry" data-fk-tut-next></button>
          </div>
        </div>
      </div>
    </div>`;

  /* ==========================================================================
     HOW TO PLAY - a three-step card shown the first time Free Kicks opens and
     again from the ? button. The pictures are small animated SVGs; every word
     comes from the strings (EN/AR), never from the drawing code.
     ========================================================================== */
  const TUTORIAL_KEY = "crazy-kora-fk-tutorial";   // its own key; the Classic save is never touched
  let tutorialSeenThisPage = false;
  const tutorialSeen = () => {
    if (tutorialSeenThisPage) return true;
    try {
      return localStorage.getItem(TUTORIAL_KEY) === "1";
    } catch {
      return false;
    }
  };
  const markTutorialSeen = () => {
    tutorialSeenThisPage = true;
    try {
      localStorage.setItem(TUTORIAL_KEY, "1");
    } catch {
      /* private mode: it is remembered for this page only */
    }
  };
  /* what a ball that rang off the frame says (the outcome itself stays wide / tooHigh) */
  const FRAME_COPY = {
    post: { title: "resultPostTitle", note: "resultPostNote" },
    bar: { title: "resultBarTitle", note: "resultBarNote" },
  };
  const TUT_STEPS = [
    { title: "tut1Title", text: "tut1Text" },
    { title: "tut2Title", text: "tut2Text" },
    { title: "tut3Title", text: "tut3Text" },
  ];
  const TUT_BG = '<rect class="t-bg" x="0" y="0" width="{w}" height="{h}" rx="14"/>';
  const TUT_GOAL = (x, y, w) => `<path class="t-goal" d="M${x} ${y + 16}V${y}H${x + w}V${y + 16}"/><path class="t-net" d="M${x + 4} ${y + 4}H${x + w - 4}M${x + 4} ${y + 10}H${x + w - 4}"/>`;
  const TUT_BALL = (x, y, cls = "") => `<circle class="t-ball ${cls}" cx="${x}" cy="${y}" r="8"/><circle class="t-patch ${cls}" cx="${x}" cy="${y}" r="3"/>`;
  const TUT_WALL = (x0, y, n, gap) => Array.from({ length: n }, (_, i) => `<rect class="t-man" x="${x0 + i * gap}" y="${y}" width="${gap - 3}" height="11" rx="4"/>`).join("");
  const TUT_ART = [
    /* 1: press the ball, drag back, let go */
    `<svg class="fk-tut-svg" viewBox="0 0 240 150" aria-hidden="true">${TUT_BG.replace("{w}", "240").replace("{h}", "150")}
       ${TUT_GOAL(86, 12, 68)}${TUT_WALL(78, 56, 4, 21)}
       <path class="t-aim" d="M120 112V34"/>
       <g class="t-shot">${TUT_BALL(120, 112)}</g>
       <g class="t-finger"><circle class="t-pull" cx="120" cy="112" r="12"/><circle class="t-tip" cx="120" cy="112" r="6"/></g>
     </svg>`,
    /* 2: ground round the wall, air over it */
    `<div class="fk-tut-pair">
       <svg class="fk-tut-svg" viewBox="0 0 116 110" aria-hidden="true">${TUT_BG.replace("{w}", "116").replace("{h}", "110")}
         ${TUT_GOAL(34, 8, 48)}${TUT_WALL(34, 50, 3, 16)}
         <path class="t-route" d="M58 98C18 88 16 40 40 26"/>${TUT_BALL(58, 98)}
       </svg>
       <svg class="fk-tut-svg" viewBox="0 0 116 110" aria-hidden="true">${TUT_BG.replace("{w}", "116").replace("{h}", "110")}
         <path class="t-floor" d="M8 96H108"/><rect class="t-goalside" x="96" y="62" width="10" height="34" rx="2"/>
         <rect class="t-man" x="54" y="66" width="12" height="30" rx="4"/>
         <path class="t-route t-route--air" d="M16 90Q60 -2 98 74"/>${TUT_BALL(16, 90)}
       </svg>
     </div>`,
    /* 3: bend left, none, right */
    `<div class="fk-tut-trio">
       <svg class="fk-tut-svg" viewBox="0 0 76 100" aria-hidden="true">${TUT_BG.replace("{w}", "76").replace("{h}", "100")}${TUT_GOAL(14, 8, 48)}<path class="t-route" d="M38 88C70 72 70 38 48 22"/>${TUT_BALL(38, 88)}</svg>
       <svg class="fk-tut-svg" viewBox="0 0 76 100" aria-hidden="true">${TUT_BG.replace("{w}", "76").replace("{h}", "100")}${TUT_GOAL(14, 8, 48)}<path class="t-route" d="M38 88V26"/>${TUT_BALL(38, 88)}</svg>
       <svg class="fk-tut-svg" viewBox="0 0 76 100" aria-hidden="true">${TUT_BG.replace("{w}", "76").replace("{h}", "100")}${TUT_GOAL(14, 8, 48)}<path class="t-route" d="M38 88C6 72 6 38 28 22"/>${TUT_BALL(38, 88)}</svg>
     </div>`,
  ];

  /* Classic-style football patches: 12 pentagon patches on a unit sphere. */
  function buildPatchNormals() {
    const n = 12;
    const arr = new Float32Array(n * 3);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - ((i + 0.5) * 2) / n;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const th = golden * i;
      arr[i * 3] = Math.cos(th) * r;
      arr[i * 3 + 1] = Math.sin(th) * r;
      arr[i * 3 + 2] = y;
    }
    return arr;
  }

  function rotateNormals(patches, ax, ay, az, angle) {
    const norm = Math.hypot(ax, ay, az) || 1;
    const x = ax / norm, y = ay / norm, z = az / norm;
    const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
    for (let i = 0; i < patches.length; i += 3) {
      const px = patches[i], py = patches[i + 1], pz = patches[i + 2];
      patches[i] = px * (t * x * x + c) + py * (t * x * y - s * z) + pz * (t * x * z + s * y);
      patches[i + 1] = px * (t * x * y + s * z) + py * (t * y * y + c) + pz * (t * y * z - s * x);
      patches[i + 2] = px * (t * x * z - s * y) + py * (t * y * z + s * x) + pz * (t * z * z + c);
    }
  }

  /* Classic net cloth: 17 columns x 7 rows with gaussian punch impulse. */
  class NetCloth {
    constructor() {
      this.cols = 17;
      this.rows = 7;
      const n = this.cols * this.rows;
      this.restX = new Float32Array(n);
      this.restY = new Float32Array(n);
      this.ox = new Float32Array(n);
      this.oy = new Float32Array(n);
      this.vx = new Float32Array(n);
      this.vy = new Float32Array(n);
      this.energy = 0;
      for (let row = 0; row < this.rows; row++) {
        const i = row / (this.rows - 1);
        for (let col = 0; col < this.cols; col++) {
          const s = col / (this.cols - 1);
          const idx = row * this.cols + col;
          this.restX[idx] = lerp(GOAL.leftPostX + GOAL.taper * i, GOAL.rightPostX - GOAL.taper * i, s);
          this.restY[idx] = lerp(GOAL.barY, GOAL.backTopY, i) + Math.sin(Math.PI * s) * Math.sin(Math.PI * i) * 5;
        }
      }
    }

    punch(x, vxImp, vyImp) {
      const { cols, rows } = this;
      for (let row = 1; row < rows; row++) {
        const i = row / (rows - 1);
        const amp = 0.2 + 0.8 * i * i;
        for (let col = 1; col < cols - 1; col++) {
          const idx = row * cols + col;
          const g = Math.exp(-Math.pow((this.restX[idx] - x) / 62, 2)) * amp;
          this.vx[idx] = clamp(this.vx[idx] + vxImp * g, -620, 620);
          this.vy[idx] = clamp(this.vy[idx] + vyImp * g, -620, 620);
        }
      }
      this.energy = 1;
    }

    update(dt) {
      if (this.energy <= 0) return;
      const { cols, rows, ox, oy, vx, vy, restX, restY } = this;
      const d = Math.min(dt, 1 / 60);
      for (let row = 1; row < rows; row++) {
        for (let col = 1; col < cols - 1; col++) {
          const idx = row * cols + col;
          const up = idx - cols, down = idx + cols, left = idx - 1, right = idx + 1;
          const axCount = 4;
          const avgX = (ox[up] + ox[down] + ox[left] + ox[right]) / axCount;
          const avgY = (oy[up] + oy[down] + oy[left] + oy[right]) / axCount;
          const fx = -150 * ox[idx] - 4.6 * vx[idx] + 520 * (avgX - ox[idx]) + (restX[up] + restX[down] + restX[left] + restX[right]) / axCount - restX[idx] * 0;
          const fy = -150 * oy[idx] - 4.6 * vy[idx] + 520 * (avgY - oy[idx]);
          vx[idx] += fx * d;
          vy[idx] += fy * d;
        }
      }
      let motion = 0;
      for (let row = 1; row < rows; row++) {
        for (let col = 1; col < cols - 1; col++) {
          const idx = row * cols + col;
          vx[idx] = clamp(vx[idx], -620, 620);
          vy[idx] = clamp(vy[idx], -620, 620);
          ox[idx] += vx[idx] * d;
          oy[idx] += vy[idx] * d;
          motion += Math.abs(ox[idx]) + Math.abs(oy[idx]) + Math.abs(vx[idx]) * 0.02;
        }
      }
      if (motion < 2) {
        this.ox.fill(0);
        this.oy.fill(0);
        this.vx.fill(0);
        this.vy.fill(0);
        this.energy = 0;
      }
    }

    draw(g) {
      const { cols, rows, ox, oy, restX, restY } = this;
      g.strokeStyle = shade(PALETTE.white, 0.55);
      g.lineWidth = 1.6;
      g.lineJoin = "round";
      g.beginPath();
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const idx = row * cols + col;
          const x = restX[idx] + ox[idx];
          const y = restY[idx] + oy[idx];
          if (col === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
      }
      for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
          const idx = row * cols + col;
          const x = restX[idx] + ox[idx];
          const y = restY[idx] + oy[idx];
          if (row === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
      }
      g.stroke();
      g.strokeStyle = shade(PALETTE.white, 0.9);
      g.lineWidth = 2.5;
      g.beginPath();
      const lastRow = (rows - 1) * cols;
      g.moveTo(restX[lastRow] + ox[lastRow], restY[lastRow] + oy[lastRow]);
      for (let col = 1; col < cols; col++) {
        const idx = lastRow + col;
        g.lineTo(restX[idx] + ox[idx], restY[idx] + oy[idx]);
      }
      g.stroke();
    }
  }
  class FreeKicksGame {
    constructor(container, opts) {
      this.container = container;
      this.opts = opts || {};
      this.strings = this.opts.strings || {};
      this.lang = this.opts.lang === "ar" ? "ar" : "en";
      this.prefersReduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      this.running = false;
      this.raf = 0;
      this.abort = null;
      this.observer = null;
      this.audio = null;
      this.lastTime = 0;
      this.resizePending = true;
      this.card = safeCard(this.opts.card);
      this.patches = buildPatchNormals();
      this.ball = this.makeBall();
      this.keeper = this.makeKeeper();
      this.cloth = new NetCloth();
      this.drag = null;
      this.aim = null;
      this.practice = null;   /* { index, attempts } while a finished stage's kick is replayed unscored */
      this.state = { phase: "ready", shotType: "ground", bend: 0, power: 0, resolved: false, outcome: null, resultTimer: 0, resultShown: false, shotAge: 0, still: 0, wallCleared: false, goalFlash: 0, sinceTouch: 0, frameHitAt: null };
      this.frameGlow = null;
      this.trail = [];
      this.particles = [];
      this.popups = [];
      this.trauma = 0;
      this.flash = 0;
      this.punch = 0;
      this.hitStop = 0;
      this.time = 0;
      this.tick = this.tick.bind(this);
    }

    s(key) {
      return this.strings[key] ?? (RUN_STRINGS[this.lang] || RUN_STRINGS.en)[key] ?? key;
    }

    /* Localised label of a library item ({en, ar}). */
    label(name) {
      return (name && (name[this.lang] || name.en)) || "";
    }

    makeBall() {
      return { x: this.card.ball.x, y: this.card.ball.y, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, squash: 0, squashX: 0, squashY: -1, stretch: 0, stretchX: 0, stretchY: -1, landedImpact: 0, netDrag: false, inNet: false, turned: 0, curveOff: false, frameHit: null };
    }

    makeKeeper() {
      const home = this.card.keeper.homeX;
      return { x: home, vx: 0, target: home, idle: Math.random() * 9, alert: 0, lean: 0, pounce: 0, jt: 0, jz: 0, jh: 0 };
    }

    /* Switch to another card: rebuild the static pitch (the ball spot moves
       with the card) and reset the round. Used by the set runner and tooling. */
    setCard(spec) {
      this.card = safeCard(spec);
      if (this.container && this.canvas) this.buildStatic();
      this.hideResult();
      this.resetRound(false);
    }

    /* ---------- set runner: five kicks, a tally, a verdict ---------- */
    /* setId is a stage id, or "quick" for a Quick Five (optionally with a seed to replay it). */
    beginRun(setId, quickSeed) {
      let set;
      let kicks;
      if (setId === "quick") {
        const draw = quickSeed ? drawQuick(quickSeed) : drawNewQuick(Progress.quick().recent);
        if (draw) {
          set = { id: "quick", kind: "quick", name: QUICK_NAME, seed: draw.seed };
          kicks = draw.kicks.map(resolveQuickKick);
          Progress.noteQuick(draw.kicks.map((k) => k.card));
        } else kicks = [];
      } else if (setId === "daily") {
        /* the Daily Kick: the seeded five of the date the menu layer passed in; it never touches Quick Five's record */
        const date = this.opts.daily && this.opts.daily.date;
        const seed = seedForDate(date);
        const draw = seed ? drawQuick(seed) : null;
        if (draw) {
          set = { id: "daily", kind: "daily", name: DAILY_NAME, seed: draw.seed, date };
          kicks = draw.kicks.map(resolveQuickKick);
        } else kicks = [];
      } else {
        set = CARD_LIBRARY.sets.find((s) => s.id === setId);
        kicks = set ? set.kicks.map(resolveKick) : [];
      }
      if (!set || kicks.length !== SET_SIZE || kicks.some((k) => !k)) {
        if (typeof console !== "undefined") console.warn(`Free Kicks: unknown or invalid set "${setId}"`);
        return;
      }
      this.run = { set, kicks, index: 0, results: [], goals: 0, introT: 0, finished: false };
      this.leavePractice();
      this.shell.classList.add("is-run");
      this.runBox.hidden = false;
      this.restartBtn.setAttribute("aria-label", this.s("runRestart"));
      this.container.querySelector("[data-fk-title]").textContent = this.label(set.name);
      this.setResult.hidden = true;
      this.hideResult();
      this.startKick(0);
    }

    startKick(i) {
      const run = this.run;
      run.index = i;
      const kick = run.kicks[i];
      this.state.bend = 0;
      this.state.shotType = "ground";
      this.setCard(kick.spec);
      this.state.phase = "intro";
      this.setDeckLocked(true);
      this.setHint("");
      const final = i === SET_SIZE - 1;
      let sub = "";
      if (i === 0) sub = this.label(run.set.name);
      else if (final) sub = run.goals === 4 ? this.s("runNeed3") : run.goals === 3 ? this.s("runNeed2") : run.goals === 2 ? this.s("runNeed1") : "";
      this.showBanner(final ? this.s("runFinal") : `${this.s("runKick")} ${i + 1}/${SET_SIZE}`, this.label(kick.name), sub, final);
      run.introT = i === 0 ? 1.5 : 1.15;
      this.updatePips();
    }

    /* One persistent polite live region speaks every state change (the cards
       themselves are shown and hidden, which screen readers announce
       unreliably). Cleared first so a repeated message is spoken again. */
    announce(text) {
      if (!this.live) return;
      clearTimeout(this.liveTimer);
      this.live.textContent = "";
      this.liveTimer = setTimeout(() => {
        if (this.live) this.live.textContent = text;
      }, 60);
    }

    /* ---------- how to play ---------- */
    /* Remembered the moment it is first shown (so an experienced player is never
       forced through it twice); the ? button opens it again any time. While it
       is open the game is frozen and the page behind it is inert. */
    openTutorial() {
      if (!this.tut || this.tutOpen) return;
      markTutorialSeen();
      this.cancelAim();
      this.tutOpen = true;
      this.tut.hidden = false;
      this.hud.inert = true;
      this.stage.inert = true;
      this.showTutorialStep(0);
    }

    closeTutorial() {
      if (!this.tutOpen) return;
      this.tutOpen = false;
      this.tut.hidden = true;
      this.hud.inert = false;
      this.stage.inert = false;
      this.announce("");
      requestAnimationFrame(() => {
        if (this.running && this.canvas) this.canvas.focus({ preventScroll: true });
      });
    }

    showTutorialStep(i) {
      const last = TUT_ART.length - 1;
      const k = clamp(i, 0, last);
      this.tutIndex = k;
      this.tutArt.innerHTML = TUT_ART[k];
      /* steps 2 and 3 show several small pictures, each captioned from the strings */
      const caps = k === 1 ? [this.s("tut2Ground"), this.s("tut2Air")] : k === 2 ? [this.s("tut3Left"), this.s("tut3None"), this.s("tut3Right")] : null;
      if (caps) {
        this.tutArt.querySelectorAll(".fk-tut-svg").forEach((svg, n) => {
          const fig = document.createElement("div");
          fig.className = "fk-tut-fig";
          const cap = document.createElement("span");
          cap.className = "fk-tut-cap";
          cap.textContent = caps[n];
          svg.replaceWith(fig);
          fig.append(svg, cap);
        });
      }
      this.tutStepEl.textContent = this.s("tutStepOf").replace("{k}", String(k + 1));
      this.tutTitle.textContent = this.s(TUT_STEPS[k].title);
      this.tutText.textContent = this.s(TUT_STEPS[k].text);
      this.tutBack.hidden = k === 0;
      this.tutNext.textContent = this.s(k === last ? "tutPlay" : "tutNext");
      this.tut.querySelectorAll(".fk-tut-dots li").forEach((li, n) => li.classList.toggle("is-on", n === k));
      this.announce([this.tutStepEl.textContent, this.tutTitle.textContent, this.tutText.textContent].join(". "));
      this.tutNext.focus({ preventScroll: true });
    }

    showBanner(kicker, title, sub, final) {
      this.announce([kicker, title, sub].filter(Boolean).join(". "));
      this.bannerKicker.textContent = kicker;
      this.bannerTitle.textContent = title;
      this.bannerSub.textContent = sub;
      this.bannerSub.hidden = !sub;
      this.banner.classList.toggle("is-final", !!final);
      this.banner.hidden = false;
      this.banner.classList.remove("is-in");
      void this.banner.offsetWidth;   // restart the entrance animation
      this.banner.classList.add("is-in");
    }

    /* ---------- practice: replay any kick of a finished stage, unscored ---------- */
    /* Nothing here touches the run's tally or the saved progress: the stage
       result was recorded when the five kicks ended. */
    startPractice(i) {
      const run = this.run;
      if (!run || !run.finished || !run.kicks[i]) return;
      this.practice = { index: i, attempts: 0 };
      this.shell.classList.add("is-practice");
      this.restartBtn.setAttribute("aria-label", this.s("runBackResult"));
      this.practiceBack.textContent = this.s("runBackResult");
      this.practiceBack.hidden = false;
      this.retryBtn.textContent = this.s("runPracticeAgain");
      this.setResult.hidden = true;
      this.hideResult();
      this.state.bend = 0;
      this.state.shotType = "ground";
      this.setCard(run.kicks[i].spec);   // the exact kick that was played (mirror and jitter included)
      this.state.phase = "intro";
      this.setDeckLocked(true);
      this.setHint("");
      this.showBanner(this.s("runPractice"), this.label(run.kicks[i].name), this.s("runNotScored"), false);
      run.introT = 1.15;
      this.updatePips();
    }

    /* Back to the stage result card (the five kicks and their record are untouched). */
    endPractice() {
      if (!this.practice) return;
      const index = this.practice.index;
      this.leavePractice();
      this.audio?.stopAll();
      this.hideResult();
      this.banner.hidden = true;
      this.resetRound(false);
      this.state.phase = "setResult";
      this.setDeckLocked(true);
      this.setHint("");
      this.updatePips();
      this.setResult.hidden = false;
      requestAnimationFrame(() => {
        const btn = this.srPips && this.srPips.querySelectorAll(".fk-pip-btn")[index];
        if (this.running && btn) btn.focus({ preventScroll: true });
      });
    }

    /* Clears the practice flag and its chrome (also on a fresh run). */
    leavePractice() {
      this.practice = null;
      this.shell.classList.remove("is-practice");
      this.practiceBack.hidden = true;
      this.restartBtn.setAttribute("aria-label", this.s("runRestart"));
    }

    endIntro() {
      if (this.state.phase !== "intro") return;
      this.state.phase = "ready";
      this.banner.hidden = true;
      this.setDeckLocked(false);
      this.setHint(this.s("dragHint"));
      this.state.sinceTouch = 0;
    }

    onKickResult(outcome) {
      const run = this.run;
      const goal = outcome === "goal";
      run.results[run.index] = { id: run.kicks[run.index].id, outcome, goal };
      if (goal) run.goals++;
      this.retryBtn.textContent = this.s(run.index === SET_SIZE - 1 ? "runSeeResult" : "runNext");
      this.updatePips();
    }

    advanceRun() {
      if (this.run.index < SET_SIZE - 1) this.startKick(this.run.index + 1);
      else this.finishRun();
    }

    updatePips() {
      const run = this.run;
      if (!run) return;
      const practising = this.practice ? this.practice.index : -1;
      this.pips.querySelectorAll(".fk-pip").forEach((li, i) => {
        const r = run.results[i];
        li.className = "fk-pip" + (r ? (r.goal ? " is-goal" : " is-miss") : i === run.index && !run.finished ? " is-current" : "") + (i === practising ? " is-practising" : "");
      });
      this.pips.setAttribute("aria-label", practising >= 0
        ? this.s("runPracticePips").replace("{k}", String(practising + 1))
        : this.s("runPips").replace("{k}", String(Math.min(run.index + 1, SET_SIZE))).replace("{g}", String(run.goals)));
    }

    /* The portal's gameplay signal (through the shell): on at the first aim of a kick, off when the stage ends, on back and on stop. */
    gameplay(on) {
      if (!!this.gameplayOn === on) return;
      this.gameplayOn = on;
      const gp = this.opts.gameplay;
      if (!gp) return;
      try {
        if (on && typeof gp.gameplayStart === "function") gp.gameplayStart();
        else if (!on && typeof gp.gameplayStop === "function") gp.gameplayStop();
      } catch {
        /* a portal hiccup must never stop a kick */
      }
    }

    nextStage(id) {
      const list = stageSets();
      const i = list.findIndex((s) => s.id === id);
      return i >= 0 && i < list.length - 1 ? list[i + 1] : null;
    }

    finishRun() {
      const run = this.run;
      run.finished = true;
      const goals = run.goals;
      const stars = starsForGoals(goals);
      this.updatePips();
      this.state.phase = "setResult";
      this.setDeckLocked(true);
      this.setHint("");
      this.srStage.textContent = this.label(run.set.name);
      this.srStars.hidden = !this.opts.star;
      this.srStars.querySelectorAll("img").forEach((img, i) => img.classList.toggle("is-lit", i < stars));
      const starsText = this.s("runStars").replace("{s}", String(stars));
      this.srStars.setAttribute("aria-label", starsText);
      const quick = run.set.kind === "quick";
      const daily = run.set.kind === "daily";
      this.srLine.hidden = true;
      this.srStreak.hidden = true;
      this.srShare.hidden = true;
      this.dailyShare = null;
      this.srTitle.textContent = this.s(daily ? "dailyTitle" : stars ? (quick ? "runQuickClear" : "runClear") : "runFail");
      this.srGoals.textContent = this.s("runGoals").replace("{g}", String(goals));
      this.srPips.querySelectorAll(".fk-pip").forEach((li, i) => {
        li.className = "fk-pip " + (run.results[i].goal ? "is-goal" : "is-miss");
      });
      this.srPips.querySelectorAll(".fk-pip-btn").forEach((btn, i) => {
        btn.setAttribute("aria-label", this.s("runPracticeKick")
          .replace("{k}", String(i + 1))
          .replace("{n}", this.label(run.kicks[i].name))
          .replace("{r}", this.s(run.results[i].goal ? "runGoalWord" : "runMissWord")));
      });
      this.srHint.textContent = this.s("runPracticeHint");
      this.srNote.textContent = this.s((quick || daily) && stars < 2 ? "runQuickNote" + stars : "runNoteStars" + stars);
      this.srSeed.hidden = !quick;
      if (quick) this.srSeed.textContent = this.s("runSeed").replace("{s}", run.set.seed);
      this.srBack.textContent = this.s("back");
      const saved = daily ? null : quick ? Progress.recordQuick(goals) : Progress.record(run.set.id, goals);
      this.gameplay(false);
      const reward = daily ? this.finishDaily(run, goals) : this.reportSetEnd(run, quick, goals, stars, saved);   // coins the shell paid for this result
      this.srCoins.hidden = !(reward > 0);
      if (reward > 0) this.srCoins.textContent = this.s("runCoins").replace("{n}", String(reward));
      const nextSet = !quick && stars ? this.nextStage(run.set.id) : null;
      const next = nextSet && Progress.unlocked(nextSet.id) ? nextSet : null;
      if (daily) {
        this.srPrimary.dataset.act = "retry";   // the same five again, unscored
        delete this.srPrimary.dataset.set;
        this.srPrimary.textContent = this.s("dailyAgain");
        this.srSecondary.hidden = true;
      } else if (quick) {
        this.srPrimary.dataset.act = "newquick";
        delete this.srPrimary.dataset.set;
        this.srPrimary.textContent = this.s("runNewFive");
        this.srSecondary.hidden = false;
        this.srSecondary.textContent = this.s("runSameFive");
      } else if (next) {
        this.srPrimary.dataset.act = "next";
        this.srPrimary.dataset.set = next.id;
        this.srPrimary.textContent = this.s("runNextStage");
        this.srSecondary.hidden = false;
        this.srSecondary.textContent = this.s("runRetry");
      } else {
        this.srPrimary.dataset.act = "retry";
        delete this.srPrimary.dataset.set;
        this.srPrimary.textContent = this.s("runRetry");
        this.srSecondary.hidden = true;
      }
      this.setResult.dataset.stars = String(stars);
      this.setResult.hidden = false;
      this.announce([this.srTitle.textContent, this.srGoals.textContent, starsText, reward > 0 ? this.srCoins.textContent : "", this.srNote.textContent].filter(Boolean).join(". "));
      if (stars) this.audio?.play("cheer", 0.5, 1);
      requestAnimationFrame(() => {
        if (this.running && this.srPrimary) this.srPrimary.focus({ preventScroll: true });
      });
    }

    /* A Daily Kick run ended. The first finished run of a date is the scored one: the menu layer records it (and pays);
       every later run is practice. Returns the coins paid. */
    finishDaily(run, goals) {
      const date = run.set.date;
      const line = dailyLineOf(run.results);
      this.srLine.textContent = line;
      this.srLine.hidden = false;
      const practice = this.dailyDone || typeof this.opts.onDailyEnd !== "function";
      let outcome = null;
      if (!practice) {
        try {
          outcome = this.opts.onDailyEnd({ date, goals, line });
        } catch {
          outcome = null;
        }
      }
      if (outcome && typeof outcome === "object" && !outcome.already) {
        this.dailyDone = true;
        const streak = Math.max(1, Math.floor(Number(outcome.streak)) || 1);
        this.srStreak.textContent = this.s("dailyStreak").replace("{n}", String(streak));
        this.srStreak.hidden = false;
        this.srShare.textContent = this.s("dailyShare");
        this.srShare.hidden = false;
        this.dailyShare = { date, line, goals, streak };
        const coins = Math.floor(Number(outcome.coins));
        return Number.isFinite(coins) && coins > 0 ? coins : 0;
      }
      this.dailyDone = true;
      this.srStreak.textContent = this.s("dailyPractice");
      this.srStreak.hidden = false;
      return 0;
    }

    /* SHARE: the system share sheet when there is one, else the clipboard. The text holds the date, the line and the game's address, nothing personal. */
    async shareDaily() {
      const d = this.dailyShare;
      if (!d) return;
      const text = [
        this.s("dailyShareText").replace("{date}", d.date),
        d.line + " " + d.goals + "/5",
        d.streak > 1 ? this.s("dailyStreak").replace("{n}", String(d.streak)) : "",
        shareUrl(),
      ].filter(Boolean).join("\n");
      try {
        if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
          await navigator.share({ text });
          return;
        }
      } catch (err) {
        if (err && err.name === "AbortError") return;   // the player closed the sheet
      }
      try {
        await navigator.clipboard.writeText(text);
        this.srShare.textContent = this.s("dailyCopied");
        this.announce(this.s("dailyCopied"));
        setTimeout(() => {
          if (this.running && this.srShare) this.srShare.textContent = this.s("dailyShare");
        }, 2000);
      } catch {
        /* nowhere to put it: the line is on the card for the player to copy */
      }
    }

    /* Tells the menu layer a stage or Quick Five run ended. It may answer with the coins it paid (a number or { coins }). */
    reportSetEnd(run, quick, goals, stars, saved) {
      if (typeof this.opts.onSetEnd !== "function") return 0;
      let coins = 0;
      try {
        const out = this.opts.onSetEnd({
          setId: run.set.id,
          kind: run.set.kind || "campaign",
          seed: quick ? run.set.seed : undefined,
          goals,
          stars,
          best: saved ? { stars: quick ? saved.bestStars : saved.stars, goals: quick ? saved.bestGoals : saved.goals } : null,
          improved: !!(saved && saved.improved),
          saved: !!(saved && saved.persisted),
          kicks: run.results.map((r) => ({ id: r.id, outcome: r.outcome, goal: r.goal })),
        });
        coins = out && typeof out === "object" ? Number(out.coins) : Number(out);
      } catch {
        coins = 0;
      }
      return Number.isFinite(coins) && coins > 0 ? Math.floor(coins) : 0;
    }

    start() {
      this.container.innerHTML = TEMPLATE;
      this.shell = this.container.querySelector(".fk-shell");
      this.stage = this.container.querySelector("[data-fk-stage]");
      this.canvas = this.container.querySelector("[data-fk-canvas]");
      this.ctx = this.canvas.getContext("2d");
      this.hud = this.container.querySelector("[data-fk-hud]");
      this.hint = this.container.querySelector("[data-fk-hint]");
      this.deck = this.container.querySelector("[data-fk-deck]");
      this.result = this.container.querySelector("[data-fk-result]");
      this.resultTitle = this.container.querySelector("[data-fk-result-title]");
      this.resultNote = this.container.querySelector("[data-fk-result-note]");
      this.resultStars = this.container.querySelector("[data-fk-result-stars]");
      this.retryBtn = this.container.querySelector("[data-fk-retry]");
      this.shotButtons = [...this.container.querySelectorAll("[data-fk-shot]")];
      this.range = this.container.querySelector("[data-fk-range]");
      this.bendOut = this.container.querySelector("[data-fk-bend-out]");
      this.backBtn = this.container.querySelector("[data-fk-back]");
      this.starImg = this.container.querySelector("[data-fk-star]");
      const q = (sel) => this.container.querySelector(sel);
      this.runBox = q("[data-fk-run]");
      this.pips = q("[data-fk-pips]");
      this.restartBtn = q("[data-fk-restart]");
      this.banner = q("[data-fk-banner]");
      this.bannerKicker = q("[data-fk-banner-kicker]");
      this.bannerTitle = q("[data-fk-banner-title]");
      this.bannerSub = q("[data-fk-banner-sub]");
      this.setResult = q("[data-fk-setresult]");
      this.srStage = q("[data-fk-sr-stage]");
      this.srStars = q("[data-fk-sr-stars]");
      this.srTitle = q("[data-fk-sr-title]");
      this.srGoals = q("[data-fk-sr-goals]");
      this.srSeed = q("[data-fk-sr-seed]");
      this.srCoins = q("[data-fk-sr-coins]");
      this.srLine = q("[data-fk-sr-line]");
      this.srStreak = q("[data-fk-sr-streak]");
      this.srShare = q("[data-fk-sr-share]");
      this.dailyShare = null;
      this.dailyDone = !!(this.opts.daily && this.opts.daily.done);   // today's scored attempt is already in: runs are practice
      this.srPips = q("[data-fk-sr-pips]");
      this.live = q("[data-fk-live]");
      this.srHint = q("[data-fk-sr-hint]");
      this.practiceBack = q("[data-fk-practice-back]");
      this.srNote = q("[data-fk-sr-note]");
      this.srPrimary = q("[data-fk-sr-primary]");
      this.srSecondary = q("[data-fk-sr-secondary]");
      this.srBack = q("[data-fk-sr-back]");
      this.helpBtn = q("[data-fk-help]");
      this.settingsBtn = q("[data-fk-settings]");
      this.settingsOpen = false;
      this.tut = q("[data-fk-tut]");
      this.tutArt = q("[data-fk-tut-art]");
      this.tutStepEl = q("[data-fk-tut-step]");
      this.tutTitle = q("[data-fk-tut-title]");
      this.tutText = q("[data-fk-tut-text]");
      this.tutSkip = q("[data-fk-tut-skip]");
      this.tutBack = q("[data-fk-tut-back]");
      this.tutNext = q("[data-fk-tut-next]");
      this.tutOpen = false;
      this.tutIndex = 0;
      this.setCopy();
      this.buildStatic();
      this.audio = new AudioBus(this.opts.sfx, this.opts.clips, this.opts.audio);
      const audioApi = this.opts.audio;
      this.audioOff = audioApi && typeof audioApi.onChange === "function"
        ? audioApi.onChange((muted, volume) => this.audio?.setLevel(muted, volume))
        : null;
      this.abort = new AbortController();
      this.bindEvents();
      this.observer = new ResizeObserver(() => {
        this.resizePending = true;
      });
      this.observer.observe(this.stage);
      this.observer.observe(this.hud);
      this.resetRound(false);
      /* Stage mode when opts.set names a stage; otherwise free play. */
      if (this.opts.set) this.beginRun(this.opts.set, this.opts.seed);
      this.running = true;
      this.lastTime = performance.now();
      requestAnimationFrame(() => {
        if (!this.running) return;
        this.resize();
        this.canvas.focus({ preventScroll: true });
        /* first time in Free Kicks: the how-to-play card (opts.tutorial === false turns it off) */
        if (this.opts.tutorial !== false && !tutorialSeen()) this.openTutorial();
      });
      this.raf = requestAnimationFrame(this.tick);
    }

    stop() {
      if (!this.running && !this.container) return;
      this.running = false;
      cancelAnimationFrame(this.raf);
      clearTimeout(this.liveTimer);
      this.live = null;
      this.raf = 0;
      this.abort?.abort();
      this.observer?.disconnect();
      this.observer = null;
      this.gameplay(false);
      this.audioOff?.();
      this.audioOff = null;
      this.audio?.stopAll();
      this.audio?.destroy();
      this.audio = null;
      this.drag = null;
      this.particles = [];
      this.trail = [];
      this.popups = [];
      if (this.container) this.container.replaceChildren();
      this.shell = null;
      this.canvas = null;
      this.ctx = null;
    }

    setCopy() {
      const q = (sel) => this.container.querySelector(sel);
      this.shell.lang = this.lang;
      this.shell.dir = this.lang === "ar" ? "rtl" : "ltr";
      q("[data-fk-title]").textContent = this.s("freeKicks");
      q("[data-fk-back-label]").textContent = this.s("back");
      this.backBtn.setAttribute("aria-label", this.s("back"));
      this.retryBtn.textContent = this.s("retry");
      q("[data-fk-shot-label]").textContent = this.s("shotType");
      q("[data-fk-shot='ground']").textContent = this.s("ground");
      q("[data-fk-shot='air']").textContent = this.s("air");
      q("[data-fk-bend-label]").textContent = this.s("bend");
      q("[data-fk-left]").textContent = this.s("bendLeft");
      q("[data-fk-straight]").textContent = this.s("bendStraight");
      q("[data-fk-right]").textContent = this.s("bendRight");
      this.canvas.setAttribute("aria-label", this.s("aimAria"));
      this.range.setAttribute("aria-label", this.s("bend"));
      this.settingsBtn.setAttribute("aria-label", this.s("settingsLabel"));
      this.settingsBtn.title = this.s("settingsLabel");
      this.settingsBtn.hidden = typeof this.opts.onSettings !== "function";   // only when the menu layer can open Classic's settings
      this.helpBtn.setAttribute("aria-label", this.s("helpLabel"));
      this.helpBtn.title = this.s("helpLabel");
      this.tutSkip.textContent = this.s("tutSkip");
      this.tutBack.textContent = this.s("tutBack");
      if (this.opts.star) {
        this.starImg.src = this.opts.star;
        this.resultStars.querySelectorAll("img").forEach((img) => {
          img.src = this.opts.star;
        });
        this.srStars.querySelectorAll("img").forEach((img) => {
          img.src = this.opts.star;
        });
      } else {
        this.starImg.hidden = true;
        this.resultStars.hidden = true;
      }
      this.updateBendOutput();
      this.setHint(this.s("dragHint"));
    }

    bindEvents() {
      const { signal } = this.abort;
      this.backBtn.addEventListener("click", () => {
        this.gameplay(false);
        this.audio?.play("click", 0.65);
        if (typeof this.opts.onBack === "function") this.opts.onBack();
        else this.stop();
      }, { signal });
      this.restartBtn.addEventListener("click", () => {
        if (!this.run || this.state.phase === "flying") return;
        this.audio?.play("click", 0.5);
        if (this.practice) {   // in practice the button is the exit
          this.endPractice();
          return;
        }
        this.beginRun(this.run.set.id, this.run.set.seed);   // restart = the same five
      }, { signal });
      this.practiceBack.addEventListener("click", () => {
        this.audio?.play("click", 0.6);
        this.endPractice();
      }, { signal });
      this.srPips.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-fk-practice]");
        if (!btn || this.state.phase !== "setResult") return;
        this.audio?.play("click", 0.6);
        this.startPractice(Number(btn.dataset.fkPractice));
      }, { signal });
      this.srPrimary.addEventListener("click", () => {
        this.audio?.play("click", 0.7);
        const act = this.srPrimary.dataset.act;
        if (act === "next") this.beginRun(this.srPrimary.dataset.set);
        else if (act === "newquick") this.beginRun("quick");
        else this.beginRun(this.run.set.id);
      }, { signal });
      this.srShare.addEventListener("click", () => {
        this.audio?.play("click", 0.6);
        this.shareDaily();
      }, { signal });
      this.srSecondary.addEventListener("click", () => {
        this.audio?.play("click", 0.6);
        this.beginRun(this.run.set.id, this.run.set.seed);
      }, { signal });
      this.srBack.addEventListener("click", () => {
        this.audio?.play("click", 0.65);
        if (typeof this.opts.onBack === "function") this.opts.onBack();
        else this.stop();
      }, { signal });
      this.retryBtn.addEventListener("click", () => {
        if (this.practice) {   // another go at the same kick, still unscored
          this.audio?.stopAll();
          this.audio?.play("click", 0.7);
          this.hideResult();
          this.practice.attempts++;
          this.resetRound(true);
          return;
        }
        if (this.run) {
          this.audio?.stopAll();
          this.audio?.play("click", 0.7);
          this.hideResult();
          this.advanceRun();
          return;
        }
        this.audio?.stopAll();
        this.audio?.play("click", 0.7);
        this.hideResult();
        this.resetRound(true);
      }, { signal });
      this.shotButtons.forEach((button) => {
        button.addEventListener("click", () => {
          if (this.state.phase !== "ready" && this.state.phase !== "aiming") return;
          this.audio?.play("click", 0.45);
          this.setShotType(button.dataset.fkShot);
        }, { signal });
      });
      this.range.addEventListener("input", () => {
        if (this.state.phase !== "ready" && this.state.phase !== "aiming") return;
        this.state.bend = clamp(Number(this.range.value) || 0, -100, 100) / 100;
        this.updateBendOutput();
      }, { signal });
      this.settingsBtn.addEventListener("click", () => {
        const open = this.opts.onSettings;
        if (typeof open !== "function" || this.tutOpen || this.settingsOpen) return;
        this.audio?.play("click", 0.5);
        this.cancelAim();
        this.gameplay(false);
        this.settingsOpen = true;   // the game freezes behind Classic's settings card, like behind the tutorial
        open(() => {
          this.settingsOpen = false;
          requestAnimationFrame(() => {
            if (this.running && this.canvas) this.canvas.focus({ preventScroll: true });
          });
        });
      }, { signal });
      this.helpBtn.addEventListener("click", () => {
        if (this.tutOpen || (this.state.phase !== "ready" && this.state.phase !== "intro")) return;
        this.audio?.play("click", 0.5);
        this.openTutorial();
      }, { signal });
      this.tutNext.addEventListener("click", () => {
        this.audio?.play("click", 0.6);
        if (this.tutIndex >= TUT_ART.length - 1) this.closeTutorial();
        else this.showTutorialStep(this.tutIndex + 1);
      }, { signal });
      this.tutBack.addEventListener("click", () => {
        this.audio?.play("click", 0.5);
        this.showTutorialStep(this.tutIndex - 1);
      }, { signal });
      this.tutSkip.addEventListener("click", () => {
        this.audio?.play("click", 0.5);
        this.closeTutorial();
      }, { signal });
      this.tut.addEventListener("keydown", (event) => {
        if (event.key === "Escape" || event.key === "Esc") {   // closes the card, not the game
          event.preventDefault();
          event.stopPropagation();
          this.closeTutorial();
        } else if (event.key === "Tab") {   // the card is modal: Tab stays inside it
          const btns = [this.tutSkip, this.tutBack, this.tutNext].filter((b) => !b.hidden);
          const at = btns.indexOf(document.activeElement);
          const next = event.shiftKey ? (at <= 0 ? btns.length - 1 : at - 1) : at === btns.length - 1 ? 0 : at + 1;
          event.preventDefault();
          event.stopPropagation();
          btns[next].focus();
        }
      }, { signal });
      this.canvas.addEventListener("pointerdown", (event) => this.onPointerDown(event), { signal });
      this.canvas.addEventListener("pointermove", (event) => this.onPointerMove(event), { signal });
      this.canvas.addEventListener("pointerup", (event) => this.onPointerUp(event), { signal });
      this.canvas.addEventListener("pointercancel", () => this.cancelAim(), { signal });
      this.canvas.addEventListener("lostpointercapture", () => this.cancelAim(), { signal });
      window.addEventListener("blur", () => this.cancelAim(), { signal });
    }

    /* Fullscreen camera: the canvas fills the viewport; the world's focus box
       (goal, wall, ball, keeper) is fitted into the area left under the
       floating HUD and above the hint pill. offX/offY is the screen position
       of world (0,0), shared by render() and toWorld() so they cannot drift. */
    resize() {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      this.cssW = rect.width;
      this.cssH = rect.height;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
      this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
      let top = 0;
      let bottom = 0;
      if (this.hud) {
        const hr = this.hud.getBoundingClientRect();
        top = Math.max(0, hr.bottom - rect.top + 6);
      }
      if (this.hint) {
        const hr = this.hint.getBoundingClientRect();
        bottom = Math.max(0, rect.bottom - hr.top + 4);
      }
      const availH = Math.max(80, rect.height - top - bottom);
      /* Tall, narrow screens crop a little of the empty pitch sides so the
         goal, wall and ball can be drawn larger (still the whole play area). */
      const aspect = rect.width / availH;
      const focusW = FOCUS.w - clamp((0.9 - aspect) / 0.35, 0, 1) * (FOCUS.w - FOCUS.minW);
      this.scale = Math.min(rect.width / focusW, availH / FOCUS.h);
      this.camX = rect.width / 2;
      this.camY = top + availH / 2;
      this.offX = this.camX - FOCUS.cx * this.scale;
      this.offY = this.camY - FOCUS.cy * this.scale;
      this.resizePending = false;
    }

    hitRadiusWorld() {
      return clamp(48 / (this.scale || 1), 58, 170);
    }

    toWorld(event) {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left - this.offX) / this.scale,
        y: (event.clientY - rect.top - this.offY) / this.scale,
      };
    }

    updateBendOutput() {
      const val = Math.round(this.state.bend * 100);
      const abs = Math.abs(val);
      let label = this.s("bendStraight");
      if (abs > 5) label = (val < 0 ? this.s("bendLeft") : this.s("bendRight")) + " " + abs + "%";
      this.bendOut.textContent = label;
    }

    setHint(text) {
      if (text) {
        this.hint.textContent = text;
        this.hint.classList.remove("is-hidden");
      } else {
        this.hint.classList.add("is-hidden");
      }
    }

    setShotType(type) {
      if (type !== "ground" && type !== "air") return;
      this.state.shotType = type;
      this.shotButtons.forEach((button) => {
        const active = button.dataset.fkShot === type;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }

    setDeckLocked(locked) {
      this.deck.classList.toggle("is-locked", locked);
      this.shotButtons.forEach((button) => {
        button.disabled = locked;
      });
      this.range.disabled = locked;
    }

    resetRound(focusCanvas) {
      this.ball = this.makeBall();
      this.keeper = this.makeKeeper();
      this.cloth = new NetCloth();
      this.state.phase = "ready";
      this.state.power = 0;
      this.state.resolved = false;
      this.state.outcome = null;
      this.state.resultTimer = 0;
      this.state.resultShown = false;
      this.state.shotAge = 0;
      this.state.still = 0;
      this.state.wallCleared = false;
      this.state.frameHitAt = null;
      this.state.goalFlash = 0;
      this.frameGlow = null;
      this.drag = null;
      this.aim = null;
      this.trail = [];
      this.particles = [];
      this.popups = [];
      this.trauma = 0;
      this.flash = 0;
      this.punch = 0;
      this.hitStop = 0;
      if (this.shell) this.shell.classList.remove("is-aiming");
      this.setHint(this.s("dragHint"));
      this.setDeckLocked(false);
      this.setShotType(this.state.shotType);
      this.range.value = String(Math.round(this.state.bend * 100));
      this.updateBendOutput();
      if (focusCanvas) this.canvas.focus({ preventScroll: true });
    }

    onPointerDown(event) {
      if (this.tutOpen || this.settingsOpen) return;
      if (this.state.phase === "intro") {
        this.endIntro();   // a tap skips the kick banner
        return;
      }
      if (this.state.phase !== "ready") return;
      if (this.state.resultShown) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const p = this.toWorld(event);
      if (len(p.x - this.ball.x, p.y - this.ball.y) > this.hitRadiusWorld()) return;
      event.preventDefault();
      this.drag = {
        id: event.pointerId,
        startX: p.x,
        startY: p.y,
        x: p.x,
        y: p.y,
      };
      this.state.phase = "aiming";
      this.state.sinceTouch = 0;
      this.shell.classList.add("is-aiming");
      this.gameplay(true);
      this.audio?.unlock();
      this.audio?.play("power_up", 0.8);   // the pull-back charge, cut the moment the ball is let go
      try {
        this.canvas.setPointerCapture(event.pointerId);
      } catch {
        /* capture is best effort */
      }
      this.updateAimFromDrag();
    }

    onPointerMove(event) {
      if (!this.drag || event.pointerId !== this.drag.id) return;
      event.preventDefault();
      const p = this.toWorld(event);
      this.drag.x = p.x;
      this.drag.y = p.y;
      this.updateAimFromDrag();
    }

    onPointerUp(event) {
      if (!this.drag || event.pointerId !== this.drag.id) return;
      event.preventDefault();
      const drag = this.drag;
      this.drag = null;
      try {
        this.canvas.releasePointerCapture(drag.id);
      } catch {
        /* noop */
      }
      const aim = this.getAimFromDrag(drag);
      if (!aim || aim.power < 0.04) {
        this.cancelAim();
        return;
      }
      this.launch(aim);
    }

    cancelAim() {
      this.audio?.stop("power_up");
      if (this.state.phase === "aiming") {
        this.state.phase = "ready";
        this.state.power = 0;
        this.setHint(this.s("dragHint"));
      }
      this.shell.classList.remove("is-aiming");
      this.drag = null;
      this.aim = null;
    }

    /* Classic aiming: deadZone 18 and maxPull 250 are in WORLD pixels. */
    getAimFromDrag(drag) {
      const dx = drag.startX - drag.x;
      const dy = drag.startY - drag.y;
      const pull = len(dx, dy);
      if (pull < SHOT.deadZone) return null;
      const power = clamp((pull - SHOT.deadZone) / (SHOT.maxPull - SHOT.deadZone), 0, 1);
      return { dirX: dx / pull, dirY: dy / pull, pull, power: power ** 1.15 };
    }

    updateAimFromDrag() {
      const aim = this.drag ? this.getAimFromDrag(this.drag) : null;
      this.aim = aim;
      if (!aim) {
        this.state.power = 0;
        this.setHint(this.s("dragHint"));
        return;
      }
      this.state.power = aim.power;
      this.state.dirX = aim.dirX;
      this.state.dirY = aim.dirY;
      this.setHint(this.s("releaseHint"));
    }

    launch(aim) {
      const air = this.state.shotType === "air";
      const power = clamp(aim.power, 0, 1);
      const v = launchVelocity(power, aim.dirX, aim.dirY, this.state.shotType);
      this.ball = this.makeBall();
      this.ball.x = this.card.ball.x;
      this.ball.y = this.card.ball.y;
      this.ball.vx = v.vx;
      this.ball.vy = v.vy;
      this.ball.vz = v.vz;
      this.ball.squash = 0;
      this.ball.stretch = 0.1 + 0.2 * power;
      this.ball.stretchX = aim.dirX;
      this.ball.stretchY = aim.dirY;
      this.state.phase = "flying";
      this.state.power = power;
      this.state.shotAge = 0;
      this.state.still = 0;
      this.state.resolved = false;
      this.state.outcome = null;
      this.state.resultTimer = 0;
      this.state.resultShown = false;
      this.state.wallCleared = false;
      this.state.frameHitAt = null;
      this.aim = null;
      this.drag = null;
      this.trail = [];
      this.keeper.alert = 0;
      this.setHint("");
      this.setDeckLocked(true);
      this.audio?.stop("power_up");
      this.audio?.play("kick_ball", 0.7 + 0.3 * power, (air ? 0.92 : 1) * (1 - 0.06 * power));
      this.trauma = Math.min(1, this.trauma + 0.14);
      this.spawnKickDust();
    }

    spawnKickDust() {
      const colors = ["#d9a84d", "#c8952f", "#efe3bf"];
      for (let i = 0; i < 10; i++) {
        const life = 0.3 + Math.random() * 0.3;
        this.particles.push({
          x: this.ball.x + rnd(-8, 8),
          y: this.ball.y + rnd(-2, 8),
          vx: rnd(-90, 90) - this.state.dirX * 60,
          vy: rnd(-40, 14) - this.state.dirY * 40,
          size: rnd(2.5, 5.5),
          color: colors[i % colors.length],
          life,
          max: life,
          gravity: 160,
          shape: "dot",
          rot: 0,
          vr: 0,
        });
      }
    }
    tick(now) {
      if (!this.running) return;
      const dt = this.lastTime ? clamp((now - this.lastTime) / 1000, 0, 0.033) : 0.016;
      this.lastTime = now;
      if (this.resizePending) this.resize();
      this.update(this.tutOpen || this.settingsOpen ? 0 : dt);   // the how-to-play card and the settings card freeze the game behind them
      this.render();
      this.raf = requestAnimationFrame(this.tick);
    }

    update(dt) {
      this.time += dt;
      this.trauma = Math.max(0, this.trauma - dt * 1.8);
      this.flash = Math.max(0, this.flash - dt * 2.4);
      this.punch = Math.max(0, this.punch - dt * 3.2);
      this.state.goalFlash = Math.max(0, this.state.goalFlash - dt * 1.5);
      if (this.frameGlow && (this.frameGlow.t -= dt) <= 0) this.frameGlow = null;
      this.updateParticles(dt);
      this.updatePopups(dt);
      this.ball.squash *= Math.exp(-9 * dt);
      this.ball.stretch *= Math.exp(-6 * dt);

      let step = dt;
      if (this.hitStop > 0) {
        this.hitStop -= dt;
        step = 0;
      }
      const sim = Math.max(step, 0.0001);

      this.updateKeeper(sim);
      this.cloth.update(sim);

      const state = this.state;
      if (state.phase === "flying") {
        if (step > 0) {
          const frames = Math.max(1, Math.round(step / (1 / 240)));
          const fdt = step / frames;
          for (let i = 0; i < frames && !state.resultShown; i++) {
            this.updateBall(fdt);
          }
        }
        state.shotAge += dt;
        if (!state.resolved) {
          const speed = len(this.ball.vx, this.ball.vy);
          const at = { x: this.ball.x, y: this.ball.y, z: this.ball.z };
          if (state.frameHitAt != null && state.shotAge - state.frameHitAt > GOAL.frame.settle) {
            this.resolve(this.missOutcome(), at);   // the rebound has been seen: call it
          } else if (state.shotAge > 5.5 || (state.shotAge > 1.5 && speed < 22 && this.ball.z === 0)) {
            this.resolve(this.missOutcome(), at);
          }
        }
      } else if (state.phase === "intro" && this.run) {
        this.run.introT -= dt;
        if (this.run.introT <= 0) this.endIntro();
      } else if (state.phase === "ready" || state.phase === "aiming") {
        state.sinceTouch += dt;
        if (state.sinceTouch > 2.4) {
          state.sinceTouch = 0;
          if (this.ball.z === 0) this.spawnIdleSpark();
        }
      }

      if (state.resolved && !state.resultShown) {
        state.resultTimer -= dt;
        if (state.resultTimer <= 0) this.showResult(state.outcome);
      }
    }

    spawnIdleSpark() {
      const colors = ["#ffd24a", "#f4ffe2"];
      const life = 0.5;
      this.particles.push({
        x: this.ball.x + rnd(-14, 14),
        y: this.ball.y - rnd(6, 18),
        vx: rnd(-20, 20),
        vy: rnd(-50, -14),
        size: rnd(1.6, 3),
        color: colors[(Math.random() * colors.length) | 0],
        life,
        max: life,
        gravity: -14,
        shape: "star",
        rot: rnd(0, TAU),
        vr: rnd(-3, 3),
      });
    }

    integrate(b, dt, type = this.state.shotType, bend = this.state.bend) {
      integrateBall(b, dt, type, bend);
    }

    rollBall(dt) {
      const b = this.ball;
      const speed = len(b.vx, b.vy);
      if (speed > 2) {
        const axisX = (b.vy / speed) * 0.42;
        const axisY = (-b.vx / speed) * 0.42;
        rotateNormals(this.patches, axisX, axisY, 0.5, ((speed * dt) / BALL_R) * 0.35);
      }
    }

    updateBall(dt) {
      const b = this.ball;
      const prev = { x: b.x, y: b.y, z: b.z };
      b.landedImpact = 0;
      this.integrate(b, dt);
      this.rollBall(dt);

      if (b.landedImpact > 0) {
        this.spawnDust(b.x, b.y, 7 + Math.min(8, b.landedImpact * 0.02), "#e8d6a8");
        if (b.landedImpact > 150) {
          this.audio?.play("thudSoft", 0.28, 1.1);
          this.trauma = Math.min(1, this.trauma + 0.06);
          b.squash = Math.min(0.3, b.landedImpact / 2600);
          b.squashX = 0;
          b.squashY = -1;
        }
        b.landedImpact = 0;
      }

      const speed = len(b.vx, b.vy);
      if (speed > 260 && !b.inNet) {
        this.trail.push({ x: b.x, y: b.y - b.z * LIFT });
        if (this.trail.length > 26) this.trail.shift();
      } else if (this.trail.length) {
        this.trail.shift();
      }

      if (b.inNet) {
        const rest = GOAL.backY + BALL_R * 0.7;
        if (b.y < rest) {
          b.y = rest;
          b.vz = 0;
          b.z = 0;
          b.vy = Math.abs(b.vy) * 0.42 + 40;
          b.vx *= 0.7;
        }
        if (b.x < GOAL.left + BALL_R * 0.5) {
          b.x = GOAL.left + BALL_R * 0.5;
          b.vx = Math.abs(b.vx) * 0.4;
        }
        if (b.x > GOAL.right - BALL_R * 0.5) {
          b.x = GOAL.right - BALL_R * 0.5;
          b.vx = -Math.abs(b.vx) * 0.4;
        }
      }

      if (!this.state.resolved) {
        this.checkWall(prev);
        this.checkKeeper(prev);
        if (!this.state.resolved && !this.checkFrame(prev)) this.checkGoal(prev);
        if (!this.state.resolved) this.checkBounds();
      }
    }

    /* Post / crossbar contact: bounce, effects, keep the ball in play. True when
       the ball hit the frame this step (the goal line is then not tested). */
    checkFrame(prev) {
      const b = this.ball;
      const hit = frameHit(prev, b);
      if (!hit) return false;
      const r = frameBounce(prev, b, hit);
      if (!r) return false;
      if (this.state.frameHitAt == null) this.state.frameHitAt = this.state.shotAge;
      this.frameImpact(r, hit);
      return true;
    }

    /* Feedback in proportion to the hit: 0..1 from the speed into the frame. */
    frameImpact(r, hit) {
      const s = clamp(r.impact / 1300, 0, 1);
      const sy = r.y - r.z * LIFT;
      this.frameGlow = { kind: r.kind, cx: hit.cx, t: 0.28, x: r.x, y: sy };
      this.spawnSparkles(r.x, sy, 4 + Math.round(8 * s));
      this.spawnDust(r.x, sy, 2 + Math.round(4 * s), "#fffaf0");
      /* the ball's own thump, then the frame ringing: the post is the sheet's post, the bar is struck metal */
      this.audio?.play("thud", 0.2 + 0.3 * s, 1.25);
      if (r.kind === "post") {
        this.audio?.play("post", 0.5 + 0.5 * s, 0.95);
      } else {
        this.audio?.play("post", 0.4 + 0.4 * s, 0.78);
        this.audio?.play("tin", 0.25 + 0.4 * s, 0.7, 0.01);
      }
      this.trauma = Math.min(1, this.trauma + 0.06 + 0.3 * s);
      if (s > 0.35) this.hitStop = Math.max(this.hitStop, 0.02 + 0.04 * s);
      this.punch = Math.max(this.punch, 0.25 + 0.4 * s);
      this.ball.squash = Math.min(0.3, 0.1 + 0.2 * s);
      this.ball.squashX = hit.nx;
      this.ball.squashY = hit.ny;
    }

    /* How a shot that touched the frame and found nothing else is called. */
    missOutcome() {
      const f = this.ball.frameHit;
      return f === "bar" ? "tooHigh" : f === "post" ? "wide" : "missed";
    }

    checkWall(prev) {
      const b = this.ball;
      const wall = this.card.wall;
      const hit = wallCrossing(prev, b, wall);
      if (!hit) return;
      const { x, z } = hit;
      if (hit.blocked) {
        b.x = x;
        b.y = wall.y + 12;
        b.z = 0;
        b.vz = 0;
        b.vy = 60;
        b.vx *= 0.4;
        b.squash = 0.24;
        b.squashX = 0;
        b.squashY = 1;
        this.resolve("wall", { x, y: wall.y, z });
      } else if (!this.state.wallCleared) {
        this.state.wallCleared = true;
        this.spawnSparkles(x, wall.y - z * LIFT, 9);
      }
    }

    /* Classic Mimi interception: circle body, single honest save per shot. */
    checkKeeper(prev) {
      const b = this.ball;
      const hit = keeperCatch(prev, b, this.keeper.x, this.card.keeper, this.keeper.jz);
      if (hit) {
        b.x = hit.x;
        b.y = KEEPER.catY + 14;
        if (hit.air) {
          b.z = hit.z;   // met in the air: it stays at the height Mimi's paws reached
        } else {
          b.z = 0;
          b.vz = 0;
        }
        this.catSave(hit.x, !!hit.air);
      }
    }

    catSave(x, air) {
      const b = this.ball;
      const side = x >= this.keeper.x ? 1 : -1;
      b.vx = side * 250;
      b.vy = 95 + Math.random() * 60;
      b.vz = air ? 60 : 130;
      b.curveOff = true;
      this.keeper.pounce = 1;
      this.keeper.lean = side * 0.8;
      this.popups.push({ x: this.keeper.x, y: KEEPER.catY - 66 - (air ? this.keeper.jz : 0), text: "MIAOU!", life: 0.9, max: 0.9 });
      if (air) {
        this.spawnSparkles(x, KEEPER.catY - b.z * LIFT, 10);
        this.spawnDust(x, KEEPER.catY + 8, 8, "#e8d6a8");   // the landing puff, under the leap
        this.audio?.play("cloth", 0.3, 1.25);
      }
      this.audio?.stop("power_up");
      this.audio?.play("meow", 1);
      for (let i = 0; i < 12; i++) {
        const a = rnd(0, TAU);
        const r = rnd(10, 34);
        this.spawnDust(this.keeper.x + Math.cos(a) * r * 0.7, KEEPER.catY + Math.sin(a) * r * 0.5, 1, "#d9b177");
      }
      this.spawnDust(x, KEEPER.catY, 6, "#e8d6a8");
      this.audio?.play("thudSoft", 0.6, 0.9);
      this.trauma = Math.min(1, this.trauma + 0.4);
      this.hitStop = 0.09;
      this.punch = 0.7;
      this.resolve("saved", { x, y: KEEPER.catY, z: 12 });
    }

    checkGoal(prev) {
      const b = this.ball;
      const hit = goalCrossing(prev, b);
      if (!hit) return;
      const { x, z } = hit;
      if (hit.outcome === "wide") {
        this.resolve("wide", { x, y: GOAL.lineY, z });
      } else if (hit.outcome === "tooHigh") {
        this.resolve("tooHigh", { x, y: GOAL.lineY, z });
      } else {
        b.inNet = true;
        b.netDrag = true;
        b.y = GOAL.lineY - 2;
        b.enterVx = b.vx;
        b.enterVy = b.vy;
        b.vx *= 0.55;
        b.vy = -(Math.max(90, Math.abs(b.vy) * 0.22));
        this.resolve("goal", { x, y: GOAL.lineY, z });
      }
    }

    checkBounds() {
      const b = this.ball;
      if (outOfBounds(b)) {
        this.resolve(this.missOutcome(), { x: b.x, y: b.y, z: b.z });
      }
    }

    resolve(outcome, point) {
      if (this.state.resolved) return;
      const def = OUTCOMES[outcome] || OUTCOMES.missed;
      this.state.resolved = true;
      this.state.outcome = outcome;
      this.state.resultTimer = def.delay;
      const b = this.ball;
      const px = point?.x ?? b.x;
      const py = point?.y ?? b.y;

      if (outcome === "wall") {
        this.spawnDust(px, py - 20, 18, "#e8d6a8");
        this.audio?.play("thud", 0.65, 0.95);
        this.audio?.play("stone", 0.6, 0.95);
        this.audio?.play("grit", 0.3, 0.8, 0.03);
        this.trauma = Math.min(1, this.trauma + 0.36);
        this.hitStop = 0.06;
        this.punch = 0.5;
      } else if (outcome === "goal") {
        b.netDrag = true;
        b.inNet = true;
        this.state.goalFlash = 1;
        this.cloth.punch(px, b.enterVx * 0.16, b.enterVy * 0.16);
        this.flash = 0.34;
        this.confetti(px, GOAL.lineY - 24, 46);
        this.confetti(GOAL.leftPostX + 6, GOAL.barY, 10);
        this.confetti(GOAL.rightPostX - 6, GOAL.barY, 10);
        this.audio?.play("net", 0.8, 0.95);
        this.audio?.play("cloth", 0.45, 0.9);
        this.audio?.play("goal", 1, 1);
        this.trauma = Math.min(1, this.trauma + 0.5);
        this.hitStop = 0.12;
        this.punch = 1;
      } else if (outcome !== "saved") {
        this.audio?.play("thudSoft", outcome === "missed" ? 0.25 : 0.4, 0.8);
        if (outcome === "missed") this.audio?.play("whistle", 0.5, 1, 0.25);
        else this.audio?.play("grit", 0.25, 0.8, 0.12);
      }
    }

    showResult(outcome) {
      if (this.state.resultShown || !this.result) return;
      const def = OUTCOMES[outcome] || OUTCOMES.missed;
      this.state.resultShown = true;
      this.state.phase = "result";
      this.result.dataset.outcome = outcome;
      this.result.hidden = false;
      let note = this.s(def.note);
      if (outcome === "saved" && this.state.shotType === "air") {   // a lob is caught for a different reason than a ground shot
        const air = this.s("resultSavedAirNote");
        if (air !== "resultSavedAirNote") note = air;
      }
      let title = this.s(def.title);
      /* the six outcomes stay the same; a ball that rang off the frame says so */
      const frame = this.ball && this.ball.frameHit;
      if ((outcome === "wide" && frame === "post") || (outcome === "tooHigh" && frame === "bar")) {
        const copy = FRAME_COPY[frame];
        title = this.s(copy.title);
        note = this.s(copy.note);
      }
      this.resultTitle.textContent = title;
      this.resultNote.textContent = note;
      this.resultStars.hidden = !(outcome === "goal" && this.opts.star) || !!this.run;
      if (this.run && !this.practice) this.onKickResult(outcome);   // practice is never recorded
      this.announce([this.resultTitle.textContent, note, this.run && !this.practice ? this.pips.getAttribute("aria-label") : ""].filter(Boolean).join(". "));
      this.setDeckLocked(true);
      requestAnimationFrame(() => this.retryBtn.focus({ preventScroll: true }));
    }

    hideResult() {
      if (!this.result) return;
      this.result.hidden = true;
      delete this.result.dataset.outcome;
    }

    /* Classic cat keeper: idle sway, alert delay, predictive chase with caps. */
    updateKeeper(dt) {
      const k = this.keeper;
      stepKeeper(k, this.ball, this.state.phase === "flying", this.state.resolved, dt, this.card.keeper, this.state.shotType === "air");
      k.lean = clamp(k.vx / KEEPER.speed, -1, 1);
      k.pounce *= Math.exp(-2.2 * dt);
    }
    spawnDust(x, y, count, color) {
      for (let i = 0; i < count; i++) {
        const life = 0.35 + Math.random() * 0.35;
        this.particles.push({
          x: x + rnd(-10, 10),
          y: y + rnd(-3, 5),
          vx: rnd(-70, 70),
          vy: rnd(-55, 5),
          size: rnd(2.5, 6),
          color,
          life,
          max: life,
          gravity: 130,
          shape: "dot",
          rot: 0,
          vr: 0,
        });
      }
    }

    spawnSparkles(x, y, count) {
      const colors = ["#ffd24a", "#f4ffe2", "#4ce16c"];
      for (let i = 0; i < count; i++) {
        const life = 0.4 + Math.random() * 0.45;
        this.particles.push({
          x,
          y,
          vx: rnd(-150, 150),
          vy: rnd(-170, -30),
          size: rnd(2, 5),
          color: colors[i % colors.length],
          life,
          max: life,
          gravity: 280,
          shape: "star",
          rot: rnd(0, TAU),
          vr: rnd(-4, 4),
        });
      }
    }

    confetti(x, y, count) {
      const colors = ["#ffc83a", "#cd3a24", "#4ce16c", "#f4ffe2", "#1b2540"];
      for (let i = 0; i < count; i++) {
        const life = 0.9 + Math.random() * 0.8;
        this.particles.push({
          x: x + rnd(-20, 20),
          y: y + rnd(-10, 30),
          vx: rnd(-230, 230),
          vy: rnd(-330, -40),
          size: rnd(4, 9),
          color: colors[i % colors.length],
          life,
          max: life,
          gravity: 470,
          shape: "rect",
          rot: rnd(0, TAU),
          vr: rnd(-8, 8),
        });
      }
    }

    updateParticles(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
      }
    }

    updatePopups(dt) {
      for (let i = this.popups.length - 1; i >= 0; i--) {
        const p = this.popups[i];
        p.life -= dt;
        if (p.life <= 0) this.popups.splice(i, 1);
        else p.y -= 26 * dt;
      }
    }

    drawPopups(g) {
      this.popups.forEach((p) => {
        const alpha = clamp(p.life / p.max, 0, 1);
        const pop = 1 + Math.sin((1 - alpha) * Math.PI) * 0.18;
        g.save();
        g.translate(p.x, p.y);
        g.scale(pop, pop);
        g.globalAlpha = alpha;
        g.font = "900 34px Unbounded, Arial Black, sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.lineJoin = "round";
        g.lineWidth = 8;
        g.strokeStyle = PALETTE.ink;
        g.strokeText(p.text, 0, 0);
        g.fillStyle = PALETTE.sun;
        g.fillText(p.text, 0, 0);
        g.restore();
      });
    }

    drawParticles(g) {
      this.particles.forEach((p) => {
        const alpha = clamp(p.life / p.max, 0, 1);
        g.save();
        g.globalAlpha = alpha;
        g.fillStyle = p.color;
        if (p.shape === "rect") {
          g.translate(p.x, p.y);
          g.rotate(p.rot);
          g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        } else if (p.shape === "star") {
          starPath(g, p.x, p.y, p.size * 1.7, p.size * 0.75, 5, p.rot);
          g.fill();
        } else {
          g.beginPath();
          g.arc(p.x, p.y, p.size, 0, TAU);
          g.fill();
        }
        g.restore();
      });
    }

    buildStatic() {
      const canvas = document.createElement("canvas");
      canvas.width = W * 2;
      canvas.height = H * 2;
      const g = canvas.getContext("2d");
      g.scale(2, 2);
      this.staticCanvas = canvas;
      this.drawPitch(g);
    }

    /* Sandy street ground bleeding past the world on every side, so the whole
       screen is the pitch (stripes stay aligned with the world grid). */
    drawGround(g) {
      const R = 3000;
      g.fillStyle = PALETTE.ground;
      g.fillRect(-R, -R, W + R * 2, H + R * 2);
      g.fillStyle = shade(PALETTE.groundAlt, 0.55);
      for (let k = -40; k < 50; k++) {
        g.fillRect(-R, FIELD.top + k * 74, W + R * 2, 37);
      }
    }

    drawPitch(g) {
      g.save();
      g.beginPath();
      g.rect(FIELD.left, FIELD.top, FIELD.right - FIELD.left, FIELD.bottom - FIELD.top);
      g.clip();
      for (let i = 0; i < 200; i++) {
        const x = FIELD.left + ((i * 73) % (FIELD.right - FIELD.left));
        const y = FIELD.top + ((i * 149) % (FIELD.bottom - FIELD.top));
        g.fillStyle = i % 3 ? shade(PALETTE.groundAlt, 0.35) : i % 7 ? shade(PALETTE.ground, 0.6) : shade("#fffaf0", 0.14);
        g.beginPath();
        g.arc(x, y, 1.3, 0, TAU);
        g.fill();
      }
      g.restore();

      this.drawMarkings(g);
      this.drawRecess(g);
      this.drawChalkGoalLine(g);
    }

    drawMarkings(g) {
      g.save();
      g.strokeStyle = shade(PALETTE.chalk, 0.85);
      g.lineCap = "round";
      g.lineJoin = "round";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(250, GOAL.lineY);
      g.lineTo(250, 376);
      g.lineTo(790, 376);
      g.lineTo(790, GOAL.lineY);
      g.stroke();
      g.beginPath();
      g.moveTo(368, GOAL.lineY);
      g.lineTo(368, 256);
      g.lineTo(672, 256);
      g.lineTo(672, GOAL.lineY);
      g.stroke();
      g.fillStyle = shade(PALETTE.chalk, 0.9);
      g.beginPath();
      g.arc(520, 300, 5, 0, TAU);
      g.fill();
      g.beginPath();
      g.arc(520, 300, 82, 0.08 * Math.PI, 0.92 * Math.PI);
      g.stroke();
      g.beginPath();
      g.arc(this.card.ball.x, this.card.ball.y, 7, 0, TAU);
      g.fill();
      g.setLineDash([6, 9]);
      g.globalAlpha = 0.7;
      g.beginPath();
      g.arc(this.card.ball.x, this.card.ball.y, 54, Math.PI * 1.08, Math.PI * 1.92);
      g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 1;
      g.lineWidth = 3;
      const corners = [
        [72, 52, 0, 0.5],
        [968, 52, 0.5, 1],
        [72, 748, 1.5, 2],
        [968, 748, 1, 1.5],
      ];
      corners.forEach(([x, y, a, b]) => {
        g.beginPath();
        g.arc(x, y, 16, a * Math.PI, b * Math.PI);
        g.stroke();
      });
      g.restore();
    }

    /* Goal chalk line, Classic double stroke spanning the full post pair. */
    drawChalkGoalLine(g) {
      const x = GOAL.leftPostX - GOAL.postR;
      const w = GOAL.mouthW + GOAL.postR * 4;
      g.fillStyle = shade(PALETTE.chalk, 0.95);
      g.fillRect(x, GOAL.lineY - 3, w, 7);
      g.fillStyle = shade(PALETTE.chalk, 0.4);
      g.fillRect(x, GOAL.lineY + 4, w, 4);
    }

    /* Ground recess inside the goal mouth (the cloth provides the back net). */
    drawRecess(g) {
      g.fillStyle = PALETTE.recess;
      g.beginPath();
      g.moveTo(GOAL.leftPostX, GOAL.lineY);
      g.lineTo(GOAL.leftPostX + GOAL.taper, GOAL.backY);
      g.lineTo(GOAL.rightPostX - GOAL.taper, GOAL.backY);
      g.lineTo(GOAL.rightPostX, GOAL.lineY);
      g.closePath();
      g.fill();
      /* deep back edge so the recess reads as receding, not flat */
      g.fillStyle = shade(PALETTE.recess, 0.55);
      g.fillRect(GOAL.leftPostX + GOAL.taper, GOAL.backY, GOAL.mouthW - GOAL.taper * 2, 4);
      /* side netting: diagonals raking from front post edge to the back of the recess */
      g.strokeStyle = shade(PALETTE.white, 0.45);
      g.lineWidth = 1.5;
      for (let i = 1; i <= 3; i++) {
        const t = i / 4;
        g.beginPath();
        g.moveTo(GOAL.leftPostX, lerp(GOAL.barY, GOAL.lineY, t));
        g.lineTo(GOAL.leftPostX + GOAL.taper, lerp(GOAL.backTopY, GOAL.backY, t));
        g.moveTo(GOAL.rightPostX, lerp(GOAL.barY, GOAL.lineY, t));
        g.lineTo(GOAL.rightPostX - GOAL.taper, lerp(GOAL.backTopY, GOAL.backY, t));
        g.stroke();
      }
    }
    /* Classic goal frame: striped posts + crossbar, sun when goalFlash. */
    drawGoalFrame(g) {
      const flash = this.state.goalFlash;
      const glow = this.frameGlow;   // the piece the ball just hit lights up
      const hotCore = "#fff3b0";
      const core = flash > 0 ? PALETTE.sun : PALETTE.white;
      const drawPost = (px) => {
        g.fillStyle = shade(PALETTE.navy, 0.45);
        g.beginPath();
        g.arc(px, GOAL.postY, GOAL.postR + 1.5, 0, Math.PI);
        g.fill();
        g.fillRect(px - GOAL.postR - 1.5, GOAL.barY, GOAL.postR * 2 + 3, GOAL.postY - GOAL.barY);
        g.fillStyle = glow && glow.kind === "post" && glow.cx === px ? hotCore : core;
        g.beginPath();
        g.arc(px, GOAL.postY, GOAL.postR, 0, TAU);
        g.fill();
        g.fillRect(px - GOAL.postR, GOAL.barY, GOAL.postR * 2, GOAL.postY - GOAL.barY);
        g.save();
        g.beginPath();
        g.arc(px, GOAL.postY, GOAL.postR, 0, TAU);
        g.rect(px - GOAL.postR, GOAL.barY, GOAL.postR * 2, GOAL.postY - GOAL.barY);
        g.clip();
        g.fillStyle = PALETTE.blue;
        for (let y = GOAL.postY - 12; y > GOAL.barY - 8; y -= 18) {
          g.fillRect(px - GOAL.postR, y - 7, GOAL.postR * 2, 7);
        }
        g.fillStyle = shade(PALETTE.shadow, 0.2);
        g.fillRect(px + GOAL.postR * 0.3, GOAL.barY, GOAL.postR * 0.7, GOAL.postY - GOAL.barY);
        g.restore();
      };
      drawPost(GOAL.leftPostX);
      drawPost(GOAL.rightPostX);
      /* crossbar: Classic plain core over navy shadow, no stripes */
      g.lineCap = "round";
      g.strokeStyle = shade(PALETTE.navy, 0.45);
      g.lineWidth = 12;
      g.beginPath();
      g.moveTo(GOAL.leftPostX, GOAL.barY);
      g.lineTo(GOAL.rightPostX, GOAL.barY);
      g.stroke();
      g.strokeStyle = glow && glow.kind === "bar" ? hotCore : core;
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(GOAL.leftPostX, GOAL.barY);
      g.lineTo(GOAL.rightPostX, GOAL.barY);
      g.stroke();
      /* impact ring where the ball met the frame */
      if (glow && glow.t > 0 && !this.prefersReduced) {
        const u = 1 - glow.t / 0.28;
        g.strokeStyle = shade(PALETTE.sun, 1 - u);
        g.lineWidth = 5 * (1 - u) + 1;
        g.beginPath();
        g.arc(glow.x, glow.y, 8 + 30 * u, 0, TAU);
        g.stroke();
      }
    }

    drawDefenders(g) {
      const wall = this.card.wall;
      const feet = wall.y + 16;
      /* A taller wall (card.wall.clearance) looks taller: bodies scale from the feet. */
      const stretch = wall.clearance / WALL.clearance;
      wall.centers.forEach((x, i) => {
        const bob = Math.sin(this.time * 2 + i * 1.3) * 1.2;
        g.fillStyle = shade(PALETTE.navy, 0.22);
        g.beginPath();
        g.ellipse(x + 4, feet + 3, 26, 8, 0, 0, TAU);
        g.fill();
        if (stretch !== 1) {
          g.save();
          g.translate(0, feet);
          g.scale(1, stretch);
          g.translate(0, -feet);
        }
        g.fillStyle = PALETTE.navy;
        rr(g, x - 15, feet - 12, 9, 13, 3);
        g.fill();
        rr(g, x + 6, feet - 12, 9, 13, 3);
        g.fill();
        g.fillStyle = PALETTE.bone;
        g.fillRect(x - 15, feet - 3, 9, 2.4);
        g.fillRect(x + 6, feet - 3, 9, 2.4);
        g.fillStyle = PALETTE.navy;
        rr(g, x - 19, feet - 31 + bob, 38, 26, 11);
        g.fill();
        g.fillStyle = PALETTE.greenGame;
        g.fillRect(x - 19, feet - 24 + bob, 38, 4);
        g.fillRect(x - 3, feet - 31 + bob, 6, 26);
        g.fillStyle = shade(PALETTE.chalk, 0.95);
        g.font = "900 12px Unbounded, Arial Black, sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(String(i + 2), x, feet - 17 + bob);
        g.strokeStyle = PALETTE.navy;
        g.lineWidth = 7;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(x - 16, feet - 27 + bob);
        g.lineTo(x - 23, feet - 17 + bob);
        g.moveTo(x + 16, feet - 27 + bob);
        g.lineTo(x + 23, feet - 17 + bob);
        g.stroke();
        g.fillStyle = "#e8b07e";
        g.beginPath();
        g.arc(x, feet - 41 + bob, 10, 0, TAU);
        g.fill();
        g.fillStyle = "#31231d";
        g.beginPath();
        g.arc(x, feet - 44 + bob, 10, Math.PI, TAU);
        g.fill();
        g.strokeStyle = "rgba(11,77,31,0.5)";
        g.lineWidth = 1.6;
        g.beginPath();
        g.arc(x, feet - 41 + bob, 10, 0, TAU);
        g.stroke();
        if (stretch !== 1) g.restore();
      });
    }

    /* Classic Mimi cat keeper. */
    drawKeeper(g) {
      const k = this.keeper;
      const x = k.x;
      /* the leap: Mimi rises by k.jz, her shadow stays on the ground and shrinks */
      const rise = Math.max(0, k.jz || 0) * LIFT;
      const leap = k.jt > 0 ? Math.sin(Math.PI * clamp(k.jt / this.card.keeper.jumpTime, 0, 1)) : 0;
      const y = KEEPER.catY - 5 - rise;
      const lean = k.lean;
      const p = Math.max(k.pounce, leap * 0.85);
      const wag = Math.sin(this.time * 3.2) * 12;
      const sh = 1 - 0.28 * leap;
      g.fillStyle = shade(PALETTE.navy, 0.25 * (1 - 0.3 * leap));
      g.beginPath();
      g.ellipse(x + 3, KEEPER.catY + 14, 24 * sh, 8 * sh, 0, 0, TAU);
      g.fill();
      g.save();
      g.translate(x, y);
      g.rotate(lean * 0.22);
      if (leap > 0) g.scale(1 - 0.05 * leap, 1 + 0.12 * leap);   // stretched out for the ball
      /* tail */
      g.strokeStyle = PALETTE.catDark;
      g.lineWidth = 9;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(0, -20);
      g.quadraticCurveTo(-18 + wag, -36, -22 + wag * 1.4, -22);
      g.stroke();
      /* paws */
      g.fillStyle = PALETTE.white;
      g.save();
      g.translate(10 + p * 18, 21 + p * 3);
      g.rotate(p * 0.8);
      g.beginPath();
      g.ellipse(0, 0, 6, 8, 0, 0, TAU);
      g.fill();
      g.restore();
      g.save();
      g.translate(-10 - p * 18, 21 + p * 3);
      g.rotate(-p * 0.8);
      g.beginPath();
      g.ellipse(0, 0, 6, 8, 0, 0, TAU);
      g.fill();
      g.restore();
      /* body */
      g.fillStyle = PALETTE.cat;
      g.beginPath();
      g.ellipse(0, -4, 21 + p * 4, 23 - p * 3, 0, 0, TAU);
      g.fill();
      /* back stripes */
      g.strokeStyle = PALETTE.catDark;
      g.lineWidth = 4;
      for (let i = 0; i < 3; i++) {
        const sy = -16 + i * 8;
        g.beginPath();
        g.moveTo(-12, sy);
        g.lineTo(12, sy);
        g.stroke();
      }
      /* ears */
      const s = lean * 5;
      g.beginPath();
      g.moveTo(s - 12, 2);
      g.lineTo(s - 9, -14);
      g.lineTo(s - 2, -2);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(s + 12, 2);
      g.lineTo(s + 9, -14);
      g.lineTo(s + 2, -2);
      g.closePath();
      g.fill();
      /* head */
      g.beginPath();
      g.arc(s, 12, 14, 0, TAU);
      g.fill();
      g.strokeStyle = PALETTE.catDark;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(s, 12, 14, 0, TAU);
      g.stroke();
      /* muzzle */
      g.fillStyle = PALETTE.white;
      g.beginPath();
      g.ellipse(s, 19, 7, 5, 0, 0, TAU);
      g.fill();
      /* eyes */
      g.fillStyle = PALETTE.navy;
      g.beginPath();
      g.ellipse(s - 6, 13, 2.4, 2.4 + p * 1.5, 0, 0, TAU);
      g.fill();
      g.beginPath();
      g.ellipse(s + 6, 13, 2.4, 2.4 + p * 1.5, 0, 0, TAU);
      g.fill();
      /* nose */
      g.fillStyle = PALETTE.terra;
      g.beginPath();
      g.arc(s, 17.5, 1.8, 0, TAU);
      g.fill();
      g.restore();
    }

    /* Classic ball trail: double-pass fading ribbon. */
    drawTrail(g) {
      const n = this.trail.length;
      if (n < 3) return;
      const strength = smoothRange(260, 1150, len(this.ball.vx, this.ball.vy) + this.ball.vz * 0.4);
      if (strength <= 0.02) return;
      g.save();
      g.lineCap = "round";
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 1; i < n; i++) {
          const o = i / (n - 1);
          const a = o * o * (pass ? 0.62 : 0.28) * strength;
          g.strokeStyle = shade(PALETTE.white, a);
          g.lineWidth = pass ? n * (0.1 + 0.7 * o) : n * (0.55 + 2.4 * o) * 0.2;
          g.beginPath();
          g.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
          g.lineTo(this.trail[i].x, this.trail[i].y);
          g.stroke();
        }
      }
      g.restore();
    }

    drawBallShadow(g) {
      const b = this.ball;
      const z = Math.max(0, b.z);
      const shrink = 1 - Math.min(0.35, z / 900);
      g.fillStyle = shade(PALETTE.shadow, 0.33 * shrink);
      g.beginPath();
      g.ellipse(b.x + 9, b.y + 9, BALL_R * 1.02 * shrink, BALL_R * 0.8 * shrink, 0, 0, TAU);
      g.fill();
    }

    drawBallGlow(g, radius) {
      const z = Math.max(0, this.ball.z);
      if (z <= 4) return;
      const rg = g.createRadialGradient(this.ball.x, this.ball.y - z * LIFT, radius * 0.4, this.ball.x, this.ball.y - z * LIFT, radius * (2 + z / 500));
      rg.addColorStop(0, "rgba(255,222,122,0.2)");
      rg.addColorStop(1, "rgba(255,222,122,0)");
      g.fillStyle = rg;
      g.beginPath();
      g.arc(this.ball.x, this.ball.y - z * LIFT, radius * (2 + z / 500), 0, TAU);
      g.fill();
    }

    /* Classic vector ball: squash/stretch, 12 rotating patches, shading. */
    drawBall(g) {
      const b = this.ball;
      const z = Math.max(0, b.z);
      const lift = z * LIFT;
      const bx = b.x;
      const by = b.y - lift;
      const scaleUp = 1 + Math.min(z, 460) / 1400;
      const radius = BALL_R * scaleUp;
      const spawnPop = 1;

      /* squash transform along impact axis, or stretch along aim axis */
      const sq = clamp(b.squash, -0.42, 0.42);
      const st = clamp(b.stretch, 0, 0.3);
      let sa = 0;
      let sl = 0;
      if (Math.abs(sq) > 0.004) {
        sa = Math.atan2(b.squashY, b.squashX);
        sl = sq;
      } else if (st > 0.004) {
        sa = Math.atan2(b.stretchY, b.stretchX);
        sl = st;
      }

      /* hand recoil while aiming */
      let rx = 0, ry = 0;
      if (this.state.phase === "aiming" && this.aim) {
        rx = -this.aim.dirX * this.aim.power * 9;
        ry = -this.aim.dirY * this.aim.power * 9;
        if (this.aim.power > 0.97) {
          rx += Math.sin(this.time * 95) * 1.3;
          ry += Math.cos(this.time * 95 / 1.2) * 1.3;
        }
      } else if (this.state.phase === "aiming" && this.drag) {
        const aim0 = this.getAimFromDrag(this.drag);
        if (aim0 && aim0.power < 0.04) {
          rx = 0;
          ry = 0;
        }
      }

      g.save();
      g.translate(bx + rx, by + ry);
      g.rotate(sa);
      g.scale(spawnPop * (1 + sl), spawnPop * (1 - sl * 0.75) * (1 + lift / 1200));
      g.fillStyle = SKIN.base;
      g.beginPath();
      g.arc(0, 0, radius, 0, TAU);
      g.fill();
      g.save();
      g.beginPath();
      g.arc(0, 0, radius - 1.2, 0, TAU);
      g.clip();
      const wobble = 0.45;
      for (let i = 0; i < this.patches.length; i += 3) {
        const nx = this.patches[i], ny = this.patches[i + 1], nz = this.patches[i + 2];
        if (nz < 0.34) continue;
        let t1x = ny, t1y = -nx;
        const t1n = Math.hypot(t1x, t1y);
        if (t1n < 0.02) {
          t1x = 1;
          t1y = 0;
        } else {
          t1x /= t1n;
          t1y /= t1n;
        }
        const t2x = nz * nx / t1n, t2y = nz * ny / t1n;
        const ca = Math.cos(wobble);
        const sA = Math.sin(wobble);
        g.fillStyle = SKIN.patch;
        g.beginPath();
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * TAU;
          const rt = t1x * Math.cos(a) + t2x * Math.sin(a);
          const rt2 = t1y * Math.cos(a) + t2y * Math.sin(a);
          const vx = nx * ca + rt * sA;
          const vy = ny * ca + rt2 * sA;
          const sx = vx * radius;
          const sy = vy * radius;
          if (k === 0) g.moveTo(sx, sy);
          else g.lineTo(sx, sy);
        }
        g.closePath();
        g.globalAlpha = clamp((nz - 0.34) / 0.6, 0, 1) * 0.94;
        g.fill();
      }
      g.globalAlpha = 1;
      /* shading */
      const rg = g.createRadialGradient(-radius * 0.3, -radius * 0.35, radius * 0.2, 0, 0, radius * 1.2);
      rg.addColorStop(0, "rgba(255,252,240,0.22)");
      rg.addColorStop(0.5, "rgba(27,37,64,0)");
      rg.addColorStop(1, "rgba(27,37,64,0.42)");
      g.fillStyle = rg;
      g.beginPath();
      g.arc(0, 0, radius, 0, TAU);
      g.fill();
      g.restore();
      /* ink outline */
      g.strokeStyle = PALETTE.ink;
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(0, 0, radius, 0, TAU);
      g.stroke();
      /* specular */
      g.fillStyle = shade(PALETTE.white, 0.9);
      g.save();
      g.translate(-radius * 0.4, -radius * 0.46);
      g.rotate(-0.7);
      g.scale(1, 0.55);
      g.beginPath();
      g.arc(0, 0, radius * 0.24, 0, TAU);
      g.fill();
      g.restore();
      g.restore();
    }
    simulatePreview(aim) {
      const v = launchVelocity(aim.power, aim.dirX, aim.dirY, this.state.shotType);
      const b = {
        x: this.card.ball.x, y: this.card.ball.y, z: 0,
        vx: v.vx, vy: v.vy, vz: v.vz,
        spin: 0, landedImpact: 0, netDrag: false, inNet: false,
      };
      const points = [];
      const air = this.state.shotType === "air";
      const out = { points, wall: null, around: null, frame: null, landing: null, apex: null, goal: null, air };
      const wallRule = this.card.wall;
      const fdt = 1 / 120;
      let dist = 0;   // ground distance travelled, for the AIR profile
      /* A ground preview is a short teaser; an air preview follows the whole
         arc to where it comes down (or the goal line), because where the ball
         lands is exactly what the player needs to see. */
      const steps = air ? 180 : Math.min(84, Math.round((0.34 + 0.34 * aim.power) / fdt));
      for (let i = 0; i < steps; i++) {
        const prev = { x: b.x, y: b.y, z: b.z };
        this.integrate(b, fdt, this.state.shotType, this.state.bend);
        dist += Math.hypot(b.x - prev.x, b.y - prev.y);
        if (i % 4 === 0) points.push({ x: b.x, y: b.y, z: b.z, d: dist });
        if (air && (!out.apex || b.z > out.apex.z)) out.apex = { x: b.x, y: b.y, z: b.z };
        if (!out.wall) {
          const hit = wallCrossing(prev, b, wallRule);
          if (hit) {
            out.wall = { x: hit.x, y: wallRule.y, z: hit.z, blocked: hit.blocked, d: dist };
            if (hit.blocked) {
              points.push({ x: hit.x, y: wallRule.y, z: hit.z, d: dist });
              break;   // the ball would stop here
            }
          } else if (!out.around) {
            const lc = lineCrossing(prev, b, wallRule.y);
            if (lc) out.around = { x: lc.x, y: wallRule.y, z: lc.z };
          }
        }
        const fh = frameHit(prev, b);
        if (fh && frameBounce(prev, b, fh)) {
          out.frame = { kind: fh.kind, x: b.x, y: b.y, z: b.z };
          points.push({ x: b.x, y: b.y, z: b.z, d: dist });
          break;
        }
        const gc = goalCrossing(prev, b);
        if (gc) {
          out.goal = { x: gc.x, y: GOAL.lineY, z: gc.z, outcome: gc.outcome, d: dist };
          points.push({ x: gc.x, y: GOAL.lineY, z: gc.z, d: dist });
          break;
        }
        if (air && prev.z > 0 && b.z <= 0) {
          out.landing = { x: b.x, y: b.y, d: dist };
          points.push({ x: b.x, y: b.y, z: 0, d: dist });
          break;
        }
        if (b.y < FIELD.top - 40 || b.x < FIELD.left - 70 || b.x > FIELD.right + 70) break;
      }
      return out;
    }

    /* Rounded label chip on the pitch, for the preview's CLEAR / BLOCKED words. */
    drawChip(g, text, x, y, fill, ink) {
      const size = clamp(13 / (this.scale || 1), 14, 26);
      g.save();
      g.font = `900 ${size}px Unbounded, Arial Black, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      const w = g.measureText(text).width + size * 1.1;
      const h = size * 1.55;
      const cx = clamp(x, w / 2 + 6, W - w / 2 - 6);
      g.fillStyle = fill;
      rr(g, cx - w / 2, y - h / 2, w, h, h / 2);
      g.fill();
      g.strokeStyle = PALETTE.ink;
      g.lineWidth = 2.5;
      g.stroke();
      g.fillStyle = ink;
      g.fillText(text, cx, y + size * 0.04);
      g.restore();
    }

    /* AIR only: a small side view of the shot. Seen from above the lift of a
       straight lob lies along the line of travel and is hard to read, so this
       panel plots height against distance with the same simulated points: the
       wall (red when the ball is too low), the crossbar line, and where it ends. */
    drawAirProfile(g, sim) {
      const pts = sim.points;
      if (pts.length < 2) return;
      const w = 178;
      const h = 104;
      const pad = 12;
      const scale = this.scale || 1;
      const leftW = FOCUS.cx - this.camX / scale;
      const rightW = FOCUS.cx + (this.cssW - this.camX) / scale;
      const left = this.ball.x >= FOCUS.cx;   // sit on the side of the screen the ball is not on
      const x0 = left ? Math.max(leftW + 10, 12) : Math.min(rightW - 10, W - 12) - w;
      const y1 = FOCUS.cy + FOCUS.h / 2 - 8;
      const y0 = y1 - h;
      const D = Math.hypot(GOAL.cx - this.ball.x, GOAL.lineY - this.ball.y);
      const ZMAX = 112;
      const px = (d) => x0 + pad + clamp(d / D, 0, 1.04) * (w - 2 * pad - 8);
      const py = (z) => y1 - pad - clamp(z / ZMAX, 0, 1) * (h - 2 * pad);
      g.save();
      g.globalAlpha = 0.93;
      g.fillStyle = PALETTE.bone;
      rr(g, x0, y0, w, h, 14);
      g.fill();
      g.globalAlpha = 1;
      g.strokeStyle = PALETTE.ink;
      g.lineWidth = 3;
      g.stroke();
      /* ground */
      g.strokeStyle = PALETTE.paver;
      g.lineWidth = 3;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(x0 + pad, py(0));
      g.lineTo(x0 + w - pad, py(0));
      g.stroke();
      /* the goal: its mouth up to the crossbar line */
      const gx = px(D);
      g.strokeStyle = PALETTE.white;
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(gx, py(0));
      g.lineTo(gx, py(GOAL.crossbarZ));
      g.stroke();
      g.strokeStyle = PALETTE.ink;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(gx - 5, py(GOAL.crossbarZ));
      g.lineTo(gx + 5, py(GOAL.crossbarZ));
      g.stroke();
      /* the wall at its distance along the shot */
      const wall = sim.wall;
      const wd = wall ? wall.d : (D * (this.ball.y - this.card.wall.y)) / Math.max(1, this.ball.y - GOAL.lineY);
      const wx = px(wd);
      g.fillStyle = PALETTE.navy;
      rr(g, wx - 4, py(this.card.wall.clearance), 8, py(0) - py(this.card.wall.clearance), 3);
      g.fill();
      /* the arc */
      g.lineJoin = "round";
      g.strokeStyle = shade(PALETTE.sun, 0.45);
      g.lineWidth = 9;
      g.beginPath();
      pts.forEach((p, i) => (i ? g.lineTo(px(p.d), py(p.z)) : g.moveTo(px(p.d), py(p.z))));
      g.stroke();
      g.strokeStyle = PALETTE.ink;
      g.lineWidth = 3;
      g.setLineDash([8, 5]);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = PALETTE.sun;
      g.beginPath();
      g.arc(px(0), py(0), 5, 0, TAU);
      g.fill();
      g.stroke();
      /* the ball at the wall: green when over it, red when it would hit */
      if (wall) {
        g.fillStyle = wall.blocked ? PALETTE.terra : PALETTE.greenHi;
        g.strokeStyle = PALETTE.ink;
        g.lineWidth = 2.5;
        g.beginPath();
        g.arc(wx, py(wall.z), 6.5, 0, TAU);
        g.fill();
        g.stroke();
      }
      /* where it ends: lands, hits the frame, or reaches the goal line */
      const end = sim.landing || sim.frame || sim.goal;
      const last = pts[pts.length - 1];
      if (end && !(wall && wall.blocked)) {
        g.strokeStyle = sim.goal && sim.goal.outcome !== "goal" ? PALETTE.terra : PALETTE.ink;
        g.lineWidth = 3;
        g.beginPath();
        g.arc(px(last.d), py(last.z), 6, 0, TAU);
        g.stroke();
      }
      g.fillStyle = PALETTE.navy;
      g.font = "900 13px Unbounded, Arial Black, sans-serif";
      g.textBaseline = "top";
      g.textAlign = this.lang === "ar" ? "right" : "left";
      g.fillText(this.s("air"), this.lang === "ar" ? x0 + w - 10 : x0 + 10, y0 + 7);
      g.restore();
    }

    /* Classic preview language: ink dots, halo, rays, power ring, arrow. */
    drawAimPreview(g) {
      const b = this.ball;
      const aiming = this.state.phase === "aiming" && this.aim;
      const air = this.state.shotType === "air";
      g.save();

      if (!aiming) {
        /* idle pulse ring to show the ball is grabbable */
        const pulse = (Math.sin(this.state.sinceTouch * 2.6) + 1) / 2;
        g.strokeStyle = shade(PALETTE.chalk, 0.4 + pulse * 0.2);
        g.lineWidth = 2;
        g.setLineDash([5, 8]);
        g.beginPath();
        g.arc(b.x, b.y - b.z * LIFT, 44 + pulse * 4, 0, TAU);
        g.stroke();
      }

      if (!aiming) {
        g.restore();
        return;
      }
      const { dirX, dirY, power } = this.aim;
      const maxed = power >= 0.995;
      const sim = this.simulatePreview(this.aim);

      /* pull line toward the drag handle */
      if (this.drag) {
        const px = b.x - dirX * this.aim.pull;
        const py = b.y - dirY * this.aim.pull;
        const w = lerp(BALL_R * 0.85, BALL_R * 0.5, power);
        g.fillStyle = shade(PALETTE.ink, 0.2 + 0.14 * power);
        g.beginPath();
        g.moveTo(b.x + dirY * w, b.y - dirX * w);
        g.lineTo(px + dirY * w, py - dirX * w);
        g.lineTo(px - dirY * w, py + dirX * w);
        g.lineTo(b.x - dirY * w, b.y + dirX * w);
        g.closePath();
        g.fill();
        /* handle puck */
        g.fillStyle = PALETTE.white;
        g.beginPath();
        g.arc(px, py, 11, 0, TAU);
        g.fill();
        g.strokeStyle = PALETTE.ink;
        g.lineWidth = 4;
        g.beginPath();
        g.arc(px, py, 11, 0, TAU);
        g.stroke();
        g.fillStyle = PALETTE.blue;
        g.beginPath();
        g.arc(px, py, 3.5, 0, TAU);
        g.fill();
      }

      /* launch arrow */
      const ang = Math.atan2(dirY, dirX);
      const d = 30 + 78 * power;
      g.save();
      g.translate(b.x, b.y - z0(air, b));
      g.rotate(ang);
      g.strokeStyle = PALETTE.ink;
      g.lineWidth = 5;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(BALL_R + 13, 0);
      g.lineTo(BALL_R + d - 21, 0);
      g.stroke();
      g.fillStyle = maxed ? PALETTE.sun : PALETTE.blue;
      g.beginPath();
      g.moveTo(BALL_R + d - 26, -9);
      g.lineTo(BALL_R + d - 12, 0);
      g.lineTo(BALL_R + d - 26, 9);
      g.closePath();
      g.fill();
      g.restore();

      /* trajectory: GROUND keeps the classic ink dots on a thin solid rail along
         the floor; AIR draws its own picture - the shadow track on the ground,
         the lifted arc in gold with stems that grow with the height, the top of
         the wall, where it comes down, and what it does at the goal line. */
      const n = sim.points.length;
      const u = power > 0.55 ? clamp01((power - 0.55) / 0.45) : 0;
      if (!air) {
        if (n > 1) {
          g.strokeStyle = PALETTE.ink;
          g.globalAlpha = 0.22;
          g.lineWidth = 3;
          g.lineCap = "round";
          g.lineJoin = "round";
          g.beginPath();
          g.moveTo(sim.points[0].x, sim.points[0].y);
          for (let i = 1; i < n; i++) g.lineTo(sim.points[i].x, sim.points[i].y);
          g.stroke();
          g.globalAlpha = 1;
        }
        if (power > 0.55) {
          for (let i = 0; i < n; i++) {
            const p = sim.points[i];
            const t = n <= 1 ? 0 : i / (n - 1);
            g.fillStyle = maxed ? PALETTE.sun : PALETTE.blueLite;
            g.globalAlpha = (1 - t) * 0.3 * u;
            g.beginPath();
            g.arc(p.x, p.y, lerp(8.5, 3.8, t), 0, TAU);
            g.fill();
          }
          g.globalAlpha = 1;
        }
        for (let i = 0; i < n; i++) {
          const p = sim.points[i];
          const t = n <= 1 ? 0 : i / (n - 1);
          const r = lerp(5.5, 2.2, t) * (1 + 0.25 * u * Math.sin(this.time * 18 - i * 0.9));
          g.fillStyle = PALETTE.ink;
          g.globalAlpha = lerp(0.85, 0.12, t);
          g.beginPath();
          g.arc(p.x, p.y, r, 0, TAU);
          g.fill();
        }
        g.globalAlpha = 1;
      } else if (n > 1) {
        const pts = sim.points;
        /* shadow track on the ground */
        g.strokeStyle = PALETTE.ink;
        g.globalAlpha = 0.38;
        g.lineWidth = 3;
        g.lineCap = "round";
        g.setLineDash([2, 9]);
        g.beginPath();
        g.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < n; i++) g.lineTo(pts[i].x, pts[i].y);
        g.stroke();
        g.setLineDash([]);
        /* stems: a vertical line from the ground to the ball, longer = higher */
        g.lineWidth = 2;
        g.globalAlpha = 0.3;
        for (let i = 1; i < n; i++) {
          const p = pts[i];
          if (p.z < 8) continue;
          g.beginPath();
          g.moveTo(p.x, p.y);
          g.lineTo(p.x, p.y - p.z * LIFT);
          g.stroke();
        }
        /* glow and the lifted arc */
        g.globalAlpha = 0.28;
        g.strokeStyle = PALETTE.sun;
        g.lineWidth = 13;
        g.lineJoin = "round";
        g.beginPath();
        g.moveTo(pts[0].x, pts[0].y - pts[0].z * LIFT);
        for (let i = 1; i < n; i++) g.lineTo(pts[i].x, pts[i].y - pts[i].z * LIFT);
        g.stroke();
        g.globalAlpha = 1;
        g.strokeStyle = PALETTE.ink;
        g.lineWidth = 4;
        g.setLineDash([12, 7]);
        g.beginPath();
        g.moveTo(pts[0].x, pts[0].y - pts[0].z * LIFT);
        for (let i = 1; i < n; i++) g.lineTo(pts[i].x, pts[i].y - pts[i].z * LIFT);
        g.stroke();
        g.setLineDash([]);
        /* gold markers; bigger when higher */
        for (let i = 1; i < n; i++) {
          const p = pts[i];
          const r = 3 + Math.min(p.z, 90) / 90 * 4.5;
          g.fillStyle = PALETTE.sun;
          g.strokeStyle = PALETTE.ink;
          g.lineWidth = 2;
          g.beginPath();
          g.arc(p.x, p.y - p.z * LIFT, r, 0, TAU);
          g.fill();
          g.stroke();
        }
        /* the highest point */
        if (sim.apex && sim.apex.z > 14) {
          const ax = sim.apex.x;
          const ay = sim.apex.y - sim.apex.z * LIFT;
          g.strokeStyle = PALETTE.ink;
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(ax - 12, ay - 16);
          g.lineTo(ax, ay - 8);
          g.lineTo(ax + 12, ay - 16);
          g.stroke();
        }
        /* where it comes down */
        if (sim.landing) {
          const lx = sim.landing.x;
          const ly = sim.landing.y;
          const pulse = 1 + Math.sin(this.time * 6) * 0.08;
          g.strokeStyle = PALETTE.ink;
          g.lineWidth = 4;
          g.beginPath();
          g.ellipse(lx, ly, 22 * pulse, 12 * pulse, 0, 0, TAU);
          g.stroke();
          g.strokeStyle = PALETTE.sun;
          g.lineWidth = 2.4;
          g.beginPath();
          g.ellipse(lx, ly, 22 * pulse, 12 * pulse, 0, 0, TAU);
          g.stroke();
          g.strokeStyle = PALETTE.ink;
          g.lineWidth = 4;
          g.beginPath();
          g.moveTo(lx - 7, ly - 4);
          g.lineTo(lx + 7, ly + 4);
          g.moveTo(lx + 7, ly - 4);
          g.lineTo(lx - 7, ly + 4);
          g.stroke();
        }
      }

      /* the wall: BLOCKED, CLEAR (over it) or AROUND (past its end) */
      const wallY = this.card.wall.y;
      if (air && sim.wall) {
        /* a short bar at the top of the wall, to read the ball's height against */
        const wx = sim.wall.x;
        const top = wallY - this.card.wall.clearance * LIFT;
        g.strokeStyle = PALETTE.ink;
        g.lineWidth = 4;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(wx - 18, top);
        g.lineTo(wx + 18, top);
        g.stroke();
      }
      if (sim.wall && sim.wall.blocked) {
        const wx = sim.wall.x;
        const wy = sim.wall.y - sim.wall.z * LIFT;
        g.strokeStyle = PALETTE.terra;
        g.lineWidth = 4;
        g.setLineDash([5, 5]);
        g.beginPath();
        g.arc(wx, wy, BALL_R, 0, TAU);
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = PALETTE.terra;
        g.beginPath();
        g.arc(wx + dirX * BALL_R * 0.8, wy + dirY * BALL_R * 0.8, 4.5, 0, TAU);
        g.fill();
        this.drawChip(g, this.s("previewBlocked"), wx, wy - BALL_R - 22, PALETTE.terra, PALETTE.white);
      } else if (air && sim.wall) {
        const wy = sim.wall.y - sim.wall.z * LIFT;
        g.fillStyle = PALETTE.greenHi;
        g.strokeStyle = PALETTE.ink;
        g.lineWidth = 2;
        starPath(g, sim.wall.x, wy, 11, 5, 5, -Math.PI / 2);
        g.fill();
        g.stroke();
        this.drawChip(g, this.s("previewClear"), sim.wall.x, wy - 30, PALETTE.greenHi, PALETTE.ink);
      } else if (!air && sim.around) {
        this.drawChip(g, this.s("previewAround"), sim.around.x, sim.around.y - 26, PALETTE.greenHi, PALETTE.ink);
      }

      /* the frame: the ball would bounce off it */
      if (sim.frame) {
        const fx = sim.frame.x;
        const fy = sim.frame.y - sim.frame.z * LIFT;
        g.fillStyle = PALETTE.sun;
        g.strokeStyle = PALETTE.ink;
        g.lineWidth = 2.5;
        starPath(g, fx, fy, 13, 6, 8, -Math.PI / 2);
        g.fill();
        g.stroke();
        const word = sim.frame.kind === "bar" ? this.s("previewBar") : this.s("previewPost");
        this.drawChip(g, word, fx, fy - 34, PALETTE.sun, PALETTE.ink);
      } else if (air && sim.goal) {
        /* at the goal line: in (green ring) or over / wide (red X) */
        const gx = sim.goal.x;
        const gy = GOAL.lineY - sim.goal.z * LIFT;
        if (sim.goal.outcome === "goal") {
          g.strokeStyle = PALETTE.greenHi;
          g.lineWidth = 5;
          g.beginPath();
          g.arc(gx, gy, 14, 0, TAU);
          g.stroke();
          g.strokeStyle = PALETTE.ink;
          g.lineWidth = 2;
          g.beginPath();
          g.arc(gx, gy, 17.5, 0, TAU);
          g.stroke();
        } else {
          g.strokeStyle = PALETTE.terra;
          g.lineWidth = 5;
          g.lineCap = "round";
          g.beginPath();
          g.moveTo(gx - 9, gy - 9);
          g.lineTo(gx + 9, gy + 9);
          g.moveTo(gx + 9, gy - 9);
          g.lineTo(gx - 9, gy + 9);
          g.stroke();
        }
      }

      if (air) this.drawAirProfile(g, sim);

      /* power ring around the ball */
      g.save();
      g.translate(b.x, b.y - z0(air, b));
      const C = BALL_R * 2 + 20;
      g.setLineDash([C * 2 / SHOT.steps - 4.5, 4.5]);
      g.lineCap = "butt";
      g.strokeStyle = PALETTE.ink;
      g.lineWidth = 9;
      g.beginPath();
      g.arc(0, 0, BALL_R + 10, -Math.PI / 2, -Math.PI / 2 + TAU * power, false);
      g.stroke();
      g.strokeStyle = maxed ? PALETTE.sun : PALETTE.blue;
      g.lineWidth = 5;
      g.beginPath();
      g.arc(0, 0, BALL_R + 10, -Math.PI / 2, -Math.PI / 2 + TAU * power, false);
      g.stroke();
      g.restore();

      /* energy rays */
      if (power > 0.45) {
        g.save();
        g.translate(b.x, b.y - z0(air, b));
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU + 0.2;
          const t = i / 9;
          const wobble = 0.55 + 0.45 * Math.sin(this.time * 3.1 + i);
          g.strokeStyle = shade(PALETTE.blueLite, 0.12 + 0.3 * t);
          g.lineWidth = 1.5 + 2.8 * t;
          g.beginPath();
          g.moveTo(Math.cos(a) * (BALL_R + 17), Math.sin(a) * (BALL_R + 17));
          g.lineTo(Math.cos(a) * (BALL_R + 22 + 42 * t * wobble), Math.sin(a) * (BALL_R + 22 + 42 * t * wobble));
          g.stroke();
        }
        g.restore();
      }

      /* max power pulses */
      if (maxed) {
        for (let i = 0; i < 3; i++) {
          const t = ((this.time * 1.6 + i / 3) % 1);
          g.strokeStyle = shade(PALETTE.sun, 0.9 * (1 - t));
          g.lineWidth = 3;
          g.beginPath();
          g.arc(b.x, b.y - z0(air, b), BALL_R + 10 + t * 30, 0, TAU);
          g.stroke();
        }
      }
      g.restore();

      function z0(airNow, ball) {
        return airNow ? Math.max(0, ball.z) * LIFT : 0;
      }
      function clamp01(v) {
        return clamp(v, 0, 1);
      }
    }

    render() {
      if (!this.ctx || !this.canvas) return;
      const g = this.ctx;
      const viewW = this.canvas.width / this.dpr;
      const viewH = this.canvas.height / this.dpr;
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.fillStyle = PALETTE.ground;
      g.fillRect(0, 0, viewW, viewH);
      g.save();

      const punchScale = this.prefersReduced ? 1 : 1 + this.punch * 0.03;
      const zoom = this.scale * punchScale;
      const shake = this.prefersReduced ? 0 : this.trauma * this.trauma;
      const sx = Math.sin(this.time * 37) * 7 * shake;
      const sy = Math.cos(this.time * 29) * 4 * shake;
      g.translate(this.camX + sx, this.camY + sy);
      g.scale(zoom, zoom);
      g.translate(-FOCUS.cx, -FOCUS.cy);
      this.drawGround(g);

      if (this.staticCanvas) g.drawImage(this.staticCanvas, 0, 0, W, H);
      this.cloth.draw(g);
      this.drawGoalFrame(g);
      this.drawKeeper(g);
      this.drawAimPreview(g);
      this.drawDefenders(g);
      this.drawTrail(g);
      this.drawBallShadow(g);
      this.drawBallGlow(g, BALL_R);
      this.drawBall(g);
      this.drawParticles(g);
      this.drawPopups(g);
      if (this.flash > 0 && !this.prefersReduced) {
        g.fillStyle = `rgba(255,248,210,${this.flash * 0.55})`;
        g.fillRect(0, 0, W, H);
      }
      g.restore();
    }
  }

  let current = null;

  function start(container, opts) {
    if (!container) return;
    if (current) current.stop();
    /* The ball the player chose in Classic (opts.skin), else the classic ball. */
    const colors = opts && opts.skin && typeof opts.skin === "object" ? opts.skin : {};
    const colour = (v, fallback) => (typeof v === "string" && v.length > 0 && v.length <= 32 ? v : fallback);
    SKIN.base = colour(colors.base, DEFAULT_SKIN.base);
    SKIN.patch = colour(colors.patch, DEFAULT_SKIN.patch);
    const game = new FreeKicksGame(container, opts);
    current = game;
    game.start();
  }

  /* The stage list for menus: [{ id, kind, name: {en, ar}, count }]. */
  function sets() {
    return CARD_LIBRARY.sets.map((s) => ({ id: s.id, kind: s.kind, name: Object.assign({}, s.name), count: s.kicks.length }));
  }

  /* Tooling/runner hook: switch the running game to another card. */
  function setCard(spec) {
    if (current) current.setCard(spec);
  }

  function stop() {
    if (!current) return;
    current.stop();
    current = null;
  }

  /* `physics` is the shared, pure shot model for tooling (the offline card
     validator loads this file in a sandbox and calls simulateShot). */
  window.CrazyKoraFreeKicks = {
    start,
    stop,
    setCard,
    sets,
    /* Stage progress for menus: get(), stars(id), unlocked(id), reset(), status(). */
    progress: {
      key: Progress.key,
      get: Progress.get,
      stars: Progress.stars,
      unlocked: Progress.unlocked,
      quick: Progress.quick,
      quickUnlocked: Progress.quickUnlocked,
      quickUnlockStage: QUICK_UNLOCK_STAGE,
      reset: Progress.reset,
      status: Progress.status,
    },
    /* Quick Five tooling: draw(seed) is pure; drawNew(recentCardIds) picks a fresh seed. */
    quick: {
      draw: drawQuick,
      drawNew: drawNewQuick,
      newSeed,
      seedForDate,
      resolve: resolveQuickKick,
      slots: () => JSON.parse(JSON.stringify(QUICK_SLOTS)),
    },
    physics: {
      simulateShot,
      /* the single-step rules, for tests and tooling */
      step: { integrateBall, frameHit, frameBounce, keeperCatch, stepKeeper, launchVelocity },
      resolveCard,
      keeperTiers: () => JSON.parse(JSON.stringify(KEEPER_TIERS)),
      defaultScenario: () => resolveScenario(),
      constants: () => JSON.parse(JSON.stringify({ W, H, BALL_R, FIELD, GOAL, WALL, KEEPER, BALL_START, SHOT, FOCUS })),
    },
  };




})();
