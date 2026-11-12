/* ==========================================================================
   CRAZY KORA — GAME MODES UI LAYER
   --------------------------------------------------------------------------
   Additive UI only. This file never touches the game bundle, its save data,
   physics or level logic. It adds:
     - the Free Kicks hub (Daily Kick, Street Cup stages, Quick Five)
     - a mount point for the playable arena
   Classic's main menu draws the FREE KICKS tile itself; this file only tells
   it how to open the hub, through window.CrazyKoraShell.menu.registerModeTile.
   ========================================================================== */

(() => {
  "use strict";

  /* ---------------------------------------------------------------------- */
  /* Language + copy                                                        */
  /* ---------------------------------------------------------------------- */

  const LANG = (() => {
    const htmlLang = (document.documentElement.lang || "").toLowerCase();
    if (htmlLang) return htmlLang.startsWith("ar") ? "ar" : "en";
    try {
      return (localStorage.getItem("crazy-goal-lang") || "en").toLowerCase().startsWith("ar") ? "ar" : "en";
    } catch {
      return "en";
    }
  })();

  const COPY = {
    en: {
      freeKicks: "FREE KICKS",
      freeKicksDesc: "Bend it around the wall. Curve the ball through impossible angles. Find the perfect shot!",
      play: "PLAY",
      playNote: "One kick. One chance. Bend it around — or over — the wall.",
      newTag: "NEW",
      mainMenu: "MAIN MENU",
      back: "BACK",
      fkTagline: "BEND IT AROUND THE WALL",
      challenge: "THE CHALLENGE",
      challengeText: "Curve your shot around the wall and into the net. Pick your angle, bend the ball, and find the perfect path.",
      gameAria: "Free Kicks arena",
      shotType: "SHOT TYPE",
      ground: "GROUND",
      air: "AIR",
      bend: "BEND",
      bendLeft: "LEFT",
      bendStraight: "STRAIGHT",
      bendRight: "RIGHT",
      power: "POWER",
      dragHint: "DRAG BACK FROM THE BALL, THEN RELEASE",
      releaseHint: "RELEASE TO SHOOT",
      aimAria: "Drag back from the ball and release to shoot. Use the ground and air buttons and the bend slider to shape the shot.",
      resultGoal: "GOAL!",
      resultSaved: "SAVED!",
      resultWall: "WALL BLOCKED!",
      resultWide: "WIDE!",
      resultTooHigh: "TOO HIGH!",
      resultMissed: "MISSED!",
      resultGoalNote: "What a strike! The keeper never had a chance.",
      resultSavedNote: "Mimi got a paw to it. Aim away from her, or switch to AIR.",
      resultSavedAirNote: "Mimi caught it low. Hit it a little harder to float it over her.",
      resultWallNote: "The wall stood firm. Bend it around — or send it over.",
      resultWideNote: "Just wide. Adjust your aim and go again.",
      resultTooHighNote: "Over the bar! Take a little power off that one.",
      resultMissedNote: "The ball never found the target. Line up another.",
      retry: "TAKE ANOTHER KICK",
      streetCup: "STREET CUP",
      cupRules: "Five kicks per stage. 3 goals clear it, 4 earn 2 stars, 5 earn 3.",
      stageN: "STAGE {n}",
      bestGoals: "BEST {g}/5",
      notPlayed: "NOT PLAYED YET",
      lockedHint: "EARN A STAR ON STAGE {n}",
      lockedWord: "locked",
      starsAria: "{s} of 3 stars",
      playNext: "NEXT: STAGE {n} · {name}",
      freePlay: "FREE PLAY",
      quickFive: "QUICK FIVE",
      quickMeta: "NEW KICKS EVERY TIME",
    },
    ar: {
      freeKicks: "الركلات الحرة",
      freeKicksDesc: "لُفّ الكرة حول الحائط. قوّسها بزوايا مستحيلة. ابحث عن التسديدة المثالية!",
      play: "العب",
      playNote: "ركلة واحدة، فرصة واحدة. لُفّها حول الحائط أو فوقه.",
      newTag: "جديد",
      mainMenu: "القائمة الرئيسية",
      back: "رجوع",
      fkTagline: "لُفّها حول الحائط",
      challenge: "التحدّي",
      challengeText: "قوّس تسديدتك حول الحائط وداخل الشبكة. اختر زاويتك، لُفّ الكرة، واعثر على المسار المثالي.",
      gameAria: "ملعب الركلات الحرة",
      shotType: "نوع التسديدة",
      ground: "أرضية",
      air: "هوائية",
      bend: "اللَّفّة",
      bendLeft: "يسار",
      bendStraight: "مستقيم",
      bendRight: "يمين",
      power: "القوة",
      dragHint: "اسحب للخلف من الكرة ثم اترك",
      releaseHint: "اترك للتسديد",
      aimAria: "اسحب للخلف من الكرة ثم اترك للتسديد. استخدم زرّي الأرضية والهوائية ومنزلق اللفّة لتشكيل التسديدة.",
      resultGoal: "هدف!",
      resultSaved: "تم التصدّي!",
      resultWall: "أوقفه الحائط!",
      resultWide: "خارج المرمى!",
      resultTooHigh: "أعلى من العارضة!",
      resultMissed: "أهدرت!",
      resultGoalNote: "تسديدة رائعة! لم يكن للحارس أي فرصة.",
      resultSavedNote: "لمست ميمي الكرة بمخلبها. صوّب بعيدًا عنها، أو بدّل إلى «هوائية».",
      resultSavedAirNote: "أمسكت ميمي الكرة وهي منخفضة. زِد القوة قليلًا لترتفع فوقها.",
      resultWallNote: "صمد الحائط. لُفّ الكرة حوله أو مرّرها فوقه.",
      resultWideNote: "بجانب المرمى بقليل. عدّل تصويبك وحاول مجددًا.",
      resultTooHighNote: "فوق العارضة! خفّف القوة قليلًا.",
      resultMissedNote: "لم تصل الكرة إلى المرمى. جهّز ركلة أخرى.",
      retry: "سدّد مرة أخرى",
      streetCup: "كأس الشارع",
      cupRules: "خمس ركلات في كل مرحلة. 3 أهداف تجتاز المرحلة، و4 تمنح نجمتين، و5 ثلاث نجوم.",
      stageN: "المرحلة {n}",
      bestGoals: "الأفضل {g}/5",
      notPlayed: "لم تُلعب بعد",
      lockedHint: "احصل على نجمة في المرحلة {n}",
      lockedWord: "مغلقة",
      starsAria: "{s} من 3 نجوم",
      playNext: "التالية: المرحلة {n} · {name}",
      freePlay: "لعب حر",
      quickFive: "خمسة سريعة",
      quickMeta: "ركلات جديدة في كل مرة",
    },
  };

  const t = (key) => COPY[LANG]?.[key] ?? COPY.en[key] ?? key;
  const esc = (value) =>
    String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

  /* ---------------------------------------------------------------------- */
  /* Assets + icons                                                         */
  /* ---------------------------------------------------------------------- */

  const scriptURL = document.currentScript?.src;
  const ASSET_BASE = scriptURL ? new URL("./", scriptURL).href : "./assets/";
  const asset = (name) => ASSET_BASE + name;

  const ICONS = {
    back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M15 18l-6-6 6-6"/></svg>`,
    target: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke-linecap="round"/></svg>`,
    play: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M8.2 5.6a1.3 1.3 0 0 1 2-1.1l9 6.4a1.3 1.3 0 0 1 0 2.2l-9 6.4a1.3 1.3 0 0 1-2-1.1V5.6Z"/></svg>`,
    shuffle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 7h4l10 10h4"/><path d="M3 17h4l3-3"/><path d="M14 10l3-3h4"/><path d="M18 4l3 3-3 3"/><path d="M18 14l3 3-3 3"/></svg>`,
    lock: `<svg class="gm-stage-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="5" y="11" width="14" height="9" rx="2.4"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`,
  };

  /* The build publishes its hashed asset URLs as window.CrazyKoraAssets (src/freeKicksAssets.ts).
     The literal file names are only a fallback for a hand-assembled folder. */
  const PUBLISHED = window.CrazyKoraAssets || {};
  const ASSETS = {
    courtyard: PUBLISHED.courtyard || asset("courtyard-WHAwB1X-.webp"),
    star: PUBLISHED.star || asset("arcade-star-C4UzZ6k3.png"),
    sfx: PUBLISHED.sfxSheet || asset("sfx-C1HKXBEz.wav"),
    clips: PUBLISHED.clips || {},
  };

  /* ---------------------------------------------------------------------- */
  /* Free Kicks illustration (decorative SVG, UI only)                      */
  /* ---------------------------------------------------------------------- */

  const spark = (cx, cy, r) => {
    const k = r * 0.3;
    return `M${cx} ${cy - r} L${cx + k} ${cy - k} L${cx + r} ${cy} L${cx + k} ${cy + k} L${cx} ${cy + r} L${cx - k} ${cy + k} L${cx - r} ${cy} L${cx - k} ${cy - k} Z`;
  };

  const defender = (cx) => `
    <g fill="#17223c">
      <path d="M${cx - 11} 150 Q${cx} 142 ${cx + 11} 150 L${cx + 13} 188 Q${cx} 194 ${cx - 13} 188 Z"/>
      <circle cx="${cx}" cy="134" r="9.5" fill="#101a30"/>
      <path d="M${cx - 9} 154 L${cx - 17} 132 L${cx - 13} 129 L${cx - 4} 149 Z"/>
      <path d="M${cx + 9} 154 L${cx + 17} 132 L${cx + 13} 129 L${cx + 4} 149 Z"/>
      <rect x="${cx - 9}" y="188" width="7" height="16" rx="3"/>
      <rect x="${cx + 2}" y="188" width="7" height="16" rx="3"/>
      <path d="M${cx - 10} 154 Q${cx} 149 ${cx + 10} 154" fill="none" stroke="#4ce16c" stroke-opacity=".35" stroke-width="2"/>
    </g>`;

  const cone = (x, y, s) => `
    <g transform="translate(${x} ${y}) scale(${s})">
      <ellipse cx="0" cy="2" rx="13" ry="4" fill="#03250f" opacity=".38"/>
      <path d="M0 -21 L9 0 L-9 0 Z" fill="#cd3a24"/>
      <path d="M-4.8 -11 L-7 0 L7 0 L4.8 -11 Z" fill="#f4ffe2" opacity=".9"/>
      <rect x="-10" y="0" width="20" height="4" rx="2" fill="#8f2314"/>
    </g>`;

  function freeKicksScene(prefix) {
    return `
    <svg class="gm-fk-svg" viewBox="0 0 480 270" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="${prefix}-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#167a3d"/>
          <stop offset=".6" stop-color="#0c5a2a"/>
          <stop offset="1" stop-color="#083a17"/>
        </linearGradient>
        <linearGradient id="${prefix}-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#27ad52"/>
          <stop offset="1" stop-color="#0a5a29"/>
        </linearGradient>
        <radialGradient id="${prefix}-glow">
          <stop offset="0" stop-color="#ffeaa6" stop-opacity=".8"/>
          <stop offset="1" stop-color="#ffeaa6" stop-opacity="0"/>
        </radialGradient>
        <pattern id="${prefix}-net" width="9" height="9" patternUnits="userSpaceOnUse">
          <path d="M9 0H0V9" fill="none" stroke="#eaffd2" stroke-opacity=".3" stroke-width="1"/>
        </pattern>
      </defs>

      <rect width="480" height="270" fill="url(#${prefix}-sky)"/>
      <ellipse cx="86" cy="12" rx="150" ry="88" fill="url(#${prefix}-glow)" opacity=".55"/>
      <ellipse cx="408" cy="4" rx="150" ry="92" fill="url(#${prefix}-glow)" opacity=".38"/>
      <path d="M38 0 L108 0 L214 158 L132 158 Z" fill="#fff7d6" opacity=".045"/>
      <path d="M432 0 L366 0 L276 158 L352 158 Z" fill="#fff7d6" opacity=".04"/>

      <g fill="#03250f" opacity=".6">
        <rect x="0" y="112" width="28" height="46"/>
        <rect x="32" y="98" width="22" height="60"/>
        <rect x="58" y="120" width="34" height="38"/>
        <rect x="96" y="106" width="18" height="52"/>
        <rect x="118" y="124" width="40" height="34"/>
        <rect x="284" y="116" width="24" height="42"/>
        <rect x="312" y="104" width="16" height="54"/>
        <rect x="334" y="122" width="38" height="36"/>
        <rect x="376" y="110" width="20" height="48"/>
        <rect x="400" y="126" width="46" height="32"/>
        <rect x="450" y="114" width="30" height="44"/>
      </g>
      <g fill="#ffe9a8" opacity=".5">
        <rect x="38" y="108" width="3" height="3"/>
        <rect x="46" y="118" width="3" height="3"/>
        <rect x="64" y="128" width="3" height="3"/>
        <rect x="126" y="132" width="3" height="3"/>
        <rect x="340" y="130" width="3" height="3"/>
        <rect x="384" y="120" width="3" height="3"/>
        <rect x="410" y="134" width="3" height="3"/>
        <rect x="458" y="124" width="3" height="3"/>
      </g>

      <rect y="156" width="480" height="114" fill="url(#${prefix}-grass)"/>
      <g fill="#ffffff" opacity=".045">
        <rect y="156" width="480" height="14"/>
        <rect y="186" width="480" height="14"/>
        <rect y="216" width="480" height="14"/>
        <rect y="246" width="480" height="14"/>
      </g>
      <path d="M0 196H480" stroke="#f4ffe2" stroke-opacity=".16" stroke-width="2"/>
      <path d="M296 270 L344 172 H480 L480 270 Z" fill="#f4ffe2" opacity=".055"/>
      <path d="M310 270 L352 172 M344 172 H480" stroke="#f4ffe2" stroke-opacity=".22" stroke-width="2"/>

      <ellipse cx="390" cy="196" rx="76" ry="9" fill="#03250f" opacity=".35"/>
      <g>
        <path d="M334 92 L452 86 L452 178 L334 186 Z" fill="#052a11" opacity=".8"/>
        <path d="M334 92 L452 86 L452 178 L334 186 Z" fill="url(#${prefix}-net)"/>
        <path d="M452 86 L466 98 L466 186 L452 178 Z" fill="#0a4a20" stroke="#eaffd2" stroke-opacity=".25" stroke-width="1.5"/>
        <path d="M334 92 L452 86 M334 186 L452 178 M452 86 L452 178" fill="none" stroke="#eaffd2" stroke-opacity=".45" stroke-width="2"/>
        <rect x="326" y="84" width="10" height="106" rx="3" fill="#f7fbef"/>
        <rect x="448" y="80" width="10" height="102" rx="3" fill="#f7fbef"/>
        <rect x="326" y="80" width="132" height="10" rx="3" fill="#f7fbef"/>
        <g fill="#cd3a24">
          <rect x="326" y="98" width="10" height="12"/>
          <rect x="326" y="122" width="10" height="12"/>
          <rect x="326" y="146" width="10" height="12"/>
          <rect x="326" y="170" width="10" height="12"/>
          <rect x="448" y="94" width="10" height="12"/>
          <rect x="448" y="118" width="10" height="12"/>
          <rect x="448" y="142" width="10" height="12"/>
          <rect x="448" y="166" width="10" height="12"/>
          <rect x="340" y="80" width="14" height="10"/>
          <rect x="368" y="80" width="14" height="10"/>
          <rect x="396" y="80" width="14" height="10"/>
          <rect x="424" y="80" width="14" height="10"/>
        </g>
      </g>

      <ellipse cx="240" cy="206" rx="58" ry="8" fill="#03250f" opacity=".3"/>
      <g>
        <rect x="150" y="174" width="46" height="11" rx="3" fill="#f7fbef" stroke="#0b1526" stroke-width="2"/>
        <rect x="156" y="174" width="8" height="11" fill="#cd3a24"/>
        <rect x="172" y="174" width="8" height="11" fill="#cd3a24"/>
        <path d="M157 185v11M189 185v11" stroke="#0b1526" stroke-width="3" stroke-linecap="round"/>
      </g>
      ${defender(214)}
      ${defender(242)}
      ${defender(268)}
      ${cone(302, 214, 0.82)}
      ${cone(326, 224, 0.62)}

      <g class="gm-ball-glow">
        <circle cx="112" cy="204" r="27" fill="#ffc83a" opacity=".26"/>
      </g>
      <ellipse cx="112" cy="221" rx="20" ry="5" fill="#03250f" opacity=".45"/>
      <g transform="translate(112 204)">
        <circle r="16.5" fill="#f7fbff" stroke="#0b1526" stroke-width="1.6"/>
        <path d="M0 -7.4 L7.2 -2 L5.2 6.2 L-5.2 6.2 L-7.2 -2 Z" fill="#1b2540"/>
        <path d="M-16.2 2.4 L-9.2 -4.4 L-7.4 -2.4 L-8.4 5.4 L-15.4 7 Z" fill="#1b2540" opacity=".92"/>
        <path d="M16.2 2.4 L9.2 -4.4 L7.4 -2.4 L8.4 5.4 L15.4 7 Z" fill="#1b2540" opacity=".92"/>
        <path d="M-2.4 6.4 L2.4 6.4 L1 15.8 L-1 15.8 Z" fill="#1b2540" opacity=".92"/>
        <path d="M-9 -9.4 Q0 -14 9 -9.4" fill="none" stroke="#ffffff" stroke-opacity=".85" stroke-width="2" stroke-linecap="round"/>
      </g>

      <path d="M118 192 C156 96 262 62 394 126" fill="none" stroke="#f4ffe2" stroke-opacity=".18" stroke-width="8" stroke-linecap="round"/>
      <path class="gm-trail" d="M118 192 C156 96 262 62 394 126" fill="none" stroke="#ffd24a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M405 127 L388 117 L391 135 Z" fill="#ffc83a"/>

      <path class="gm-spark" d="${spark(238, 70, 8)}" fill="#ffe9a8"/>
      <path class="gm-spark gm-spark--b" d="${spark(310, 76, 6.5)}" fill="#ffc83a"/>
      <path class="gm-spark gm-spark--c" d="${spark(176, 106, 4.5)}" fill="#f4ffe2"/>
      <circle cx="286" cy="58" r="2" fill="#f4ffe2" opacity=".7"/>
      <circle cx="340" cy="100" r="2.2" fill="#ffe9a8" opacity=".75"/>
    </svg>`;
  }

  /* ---------------------------------------------------------------------- */
  /* Custom screens markup                                                  */
  /* ---------------------------------------------------------------------- */

  const starImg = (className = "") =>
    `<img class="gm-title-star ${className}" src="${ASSETS.star}" alt="" draggable="false" aria-hidden="true">`;

  const root = document.createElement("div");
  root.className = "gm-root";
  root.dir = LANG === "ar" ? "rtl" : "ltr";
  root.lang = LANG;
  root.hidden = true;

  root.innerHTML = `
    <section class="gm-screen gm-fk" data-screen="fk" role="dialog" aria-modal="true" aria-labelledby="gm-fk-title" tabindex="-1" hidden>
      <img class="gm-deco gm-deco--a" src="${ASSETS.star}" alt="" draggable="false" aria-hidden="true">
      <img class="gm-deco gm-deco--b" src="${ASSETS.star}" alt="" draggable="false" aria-hidden="true">
      <div class="gm-inner gm-inner--fk">
        <div class="gm-topbar">
          <button type="button" class="gm-back" data-action="back-menu" aria-label="${esc(t("mainMenu"))}">
            ${ICONS.back}<span>${esc(t("mainMenu"))}</span>
          </button>
          <span class="gm-brand">CRAZY KORA</span>
        </div>

        <div class="gm-fk-head">
          <h2 class="gm-title" id="gm-fk-title">${esc(t("freeKicks"))}</h2>
          <p class="gm-tagline">${esc(t("fkTagline"))}</p>
        </div>

        <div class="gm-fk-grid">
          <div class="gm-fk-art">
            ${freeKicksScene("gm-intro")}
            <span class="gm-fk-art-chip">${esc(t("newTag"))}</span>
          </div>

          <div class="gm-fk-info">
            <div class="gm-objective">
              <span class="gm-objective-icon">${ICONS.target}</span>
              <div>
                <p class="gm-objective-label">${esc(t("streetCup"))}</p>
                <p class="gm-objective-text">${esc(t("cupRules"))}</p>
              </div>
            </div>
            <button type="button" class="gm-play" data-action="play-stage" data-fk-primary>
              <span class="gm-play-icon">${ICONS.play}</span>
              <span>${esc(t("play"))}</span>
            </button>
            <p class="gm-play-note" data-fk-next></p>
            <div class="gm-cup" data-fk-cup></div>
            <button type="button" class="gm-alt" data-action="play-free">${esc(t("freePlay"))}</button>
          </div>
        </div>
      </div>
    </section>

    <section class="gm-screen gm-game" data-screen="game" role="dialog" aria-modal="true" aria-label="${esc(t("gameAria"))}" tabindex="-1" hidden>
      <div class="fk-mount" data-fk-mount></div>
    </section>
  `;

  const fkScreen = root.querySelector(".gm-fk");
  const gameScreen = root.querySelector(".gm-game");

  /* ---------------------------------------------------------------------- */
  /* Free Kicks stage hub (Street Cup): stages, stars, locks                */
  /* ---------------------------------------------------------------------- */

  const cupEl = fkScreen.querySelector("[data-fk-cup]");
  const primaryBtn = fkScreen.querySelector("[data-fk-primary]");
  const nextNote = fkScreen.querySelector("[data-fk-next]");
  const fill = (text, vars) => String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  const stageName = (s) => (s.name && (s.name[LANG] || s.name.en)) || s.id;

  /* Re-read on every open, so the list always shows the latest saved stars. */
  function renderHub() {
    const api = window.CrazyKoraFreeKicks;
    const list = api && api.sets ? api.sets().filter((s) => s.kind === "campaign") : [];
    const progress = api && api.progress;
    if (!list.length || !progress) {
      cupEl.hidden = true;
      primaryBtn.hidden = true;
      nextNote.hidden = true;
      return;
    }
    const saved = progress.get().stages;
    const entries = list.map((s, i) => {
      const e = saved[s.id] || { stars: 0, goals: 0, plays: 0 };
      return { s, i, stars: e.stars, goals: e.goals, plays: e.plays, open: progress.unlocked(s.id) };
    });
    // continue where the player left off: first open stage without a star, else the first not perfect
    const target = entries.find((e) => e.open && e.stars === 0) || entries.find((e) => e.open && e.stars < 3) || entries[entries.length - 1];

    const starsHtml = (n) =>
      [0, 1, 2].map((k) => `<img src="${ASSETS.star}" alt="" draggable="false"${k < n ? ' class="is-lit"' : ""}>`).join("");

    /* Quick Five: a replayable random set, open once the unlock stage has a star. */
    const quickStats = progress.quick ? progress.quick() : { plays: 0, bestGoals: 0, bestStars: 0 };
    const quickOpen = !!(progress.quickUnlocked && progress.quickUnlocked());
    const unlockAt = Math.max(1, entries.findIndex((e) => e.s.id === progress.quickUnlockStage) + 1);
    const quickMeta = !quickOpen ? fill(t("lockedHint"), { n: unlockAt }) : quickStats.plays > 0 ? fill(t("bestGoals"), { g: quickStats.bestGoals }) : t("quickMeta");
    const quickAria = !quickOpen
      ? `${t("quickFive")}, ${t("lockedWord")}. ${quickMeta}`
      : `${t("quickFive")}${quickStats.plays > 0 ? ", " + fill(t("starsAria"), { s: quickStats.bestStars }) : ""}, ${quickMeta}`;
    const quickRow = `<button type="button" class="gm-stage gm-stage--quick" data-action="play-quick"${quickOpen ? "" : ' aria-disabled="true"'} aria-label="${esc(quickAria)}">
            <span class="gm-stage-num" aria-hidden="true">${ICONS.shuffle}</span>
            <span class="gm-stage-main" aria-hidden="true"><span class="gm-stage-name">${esc(t("quickFive"))}</span><span class="gm-stage-meta">${esc(quickMeta)}</span></span>
            ${quickOpen ? `<span class="gm-stage-stars" aria-hidden="true">${starsHtml(quickStats.bestStars)}</span>` : ICONS.lock}
          </button>`;

    cupEl.innerHTML = entries
        .map((e) => {
          const name = stageName(e.s);
          const label = fill(t("stageN"), { n: e.i + 1 });
          let meta;
          let aria;
          if (!e.open) {
            meta = fill(t("lockedHint"), { n: e.i });
            aria = `${label}, ${name}, ${t("lockedWord")}. ${meta}`;
          } else if (e.plays > 0) {
            meta = fill(t("bestGoals"), { g: e.goals });
            aria = `${label}, ${name}, ${fill(t("starsAria"), { s: e.stars })}, ${meta}`;
          } else {
            meta = t("notPlayed");
            aria = `${label}, ${name}, ${meta}`;
          }
          const stars = [0, 1, 2]
            .map((k) => `<img src="${ASSETS.star}" alt="" draggable="false"${k < e.stars ? ' class="is-lit"' : ""}>`)
            .join("");
          const trailing = e.open ? `<span class="gm-stage-stars" aria-hidden="true">${stars}</span>` : ICONS.lock;
          return `<button type="button" class="gm-stage${e.s.id === target.s.id ? " is-next" : ""}" data-action="play-stage" data-stage="${esc(e.s.id)}"${e.open ? "" : ' aria-disabled="true"'} aria-label="${esc(aria)}">
            <span class="gm-stage-num" aria-hidden="true">${e.i + 1}</span>
            <span class="gm-stage-main" aria-hidden="true"><span class="gm-stage-name">${esc(name)}</span><span class="gm-stage-meta">${esc(meta)}</span></span>
            ${trailing}
          </button>`;
        })
        .join("") + quickRow;

    primaryBtn.dataset.stage = target.s.id;
    nextNote.textContent = fill(t("playNext"), { n: target.i + 1, name: stageName(target.s) });
    cupEl.hidden = false;
    primaryBtn.hidden = false;
    nextNote.hidden = false;
  }

  /* ---------------------------------------------------------------------- */
  /* Navigation                                                             */
  /* ---------------------------------------------------------------------- */

  const getMenu = () => document.querySelector(".screen.menu");
  const getOverlay = () => document.getElementById("overlay");

  let lastMenuFocus = null;

  function showScreen(name, focusTarget) {
    const active = name === "game" ? gameScreen : fkScreen;
    fkScreen.hidden = active !== fkScreen;
    gameScreen.hidden = active !== gameScreen;
    root.hidden = false;

    window.requestAnimationFrame(() => {
      if (root.hidden || active.hidden) return;
      (focusTarget || active).focus({ preventScroll: true });
    });
  }

  /* The hub is one tap from Classic's main menu (the FREE KICKS tile). */
  function openFreeKicks() {
    lastMenuFocus = document.activeElement;
    const menu = getMenu();
    if (menu) menu.hidden = true;
    getOverlay()?.classList.add("is-open");
    renderHub();
    showScreen("fk");
  }

  function backToMainMenu() {
    root.hidden = true;
    const menu = getMenu();
    if (menu) menu.hidden = false;
    getOverlay()?.classList.add("is-open");
    /* stars and coins may have changed in there: let the menu redraw itself */
    window.CrazyKoraShell?.menu.refresh();
    if (lastMenuFocus && typeof lastMenuFocus.focus === "function") lastMenuFocus.focus({ preventScroll: true });
  }

  /* A finished stage pays through the shell (the shell is the only writer of the Classic save). */
  function onSetEnd(result) {
    const shell = window.CrazyKoraShell;
    if (!shell) return 0;
    let coins = 0;
    if (result.kind === "campaign" || result.kind === "legend") coins = shell.fk.recordStage(result.setId, result.stars);
    shell.menu.refresh();
    return coins;
  }

  /* A stage id starts that Street Cup stage; no id is free play. */
  function launchFreeKicks(setId) {
    if (!window.CrazyKoraFreeKicks) return;
    const shell = window.CrazyKoraShell;

    showScreen("game");
    const mount = gameScreen.querySelector("[data-fk-mount]");
    if (!mount) return;

    window.CrazyKoraFreeKicks.start(mount, {
      lang: LANG,
      strings: COPY[LANG],
      star: ASSETS.star,
      sfx: ASSETS.sfx,
      clips: ASSETS.clips,
      skin: shell ? shell.skin().colors : undefined,
      audio: shell ? shell.audio : undefined,
      gameplay: shell ? shell.portal : undefined,
      onSetEnd,
      onBack: exitFreeKicksGame,
      set: setId || undefined,
    });
  }

  function exitFreeKicksGame() {
    window.CrazyKoraFreeKicks?.stop();
    renderHub();
    showScreen("fk", primaryBtn.hidden ? fkScreen.querySelector("[data-action='play-free']") : primaryBtn);
  }

  /* ---------------------------------------------------------------------- */
  /* Keyboard support                                                       */
  /* ---------------------------------------------------------------------- */

  document.addEventListener("keydown", (event) => {
    if (root.hidden) return;

    if (event.key === "Escape" || event.key === "Esc") {
      event.preventDefault();
      event.stopPropagation();
      if (!gameScreen.hidden) exitFreeKicksGame();
      else backToMainMenu();
      return;
    }

    if (event.key !== "Tab") return;

    const section = !gameScreen.hidden ? gameScreen : fkScreen;
    const nodes = [
      ...section.querySelectorAll("button, [href], input, select, [tabindex]:not([tabindex='-1'])"),
    ].filter(
      (el) => !el.disabled && el.getClientRects().length > 0
    );
    if (!nodes.length) return;

    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const focused = document.activeElement;

    if (event.shiftKey && (focused === first || !section.contains(focused))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (focused === last || !section.contains(focused))) {
      event.preventDefault();
      first.focus();
    }
  });

  root.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-action]");
    if (!trigger || !root.contains(trigger)) return;

    switch (trigger.dataset.action) {
      case "back-menu":
        backToMainMenu();
        break;
      case "play-stage":
        // a locked stage stays focusable (so its hint can be read) but does nothing
        if (trigger.getAttribute("aria-disabled") === "true") break;
        launchFreeKicks(trigger.dataset.stage);
        break;
      case "play-quick":
        if (trigger.getAttribute("aria-disabled") === "true") break;
        launchFreeKicks("quick");
        break;
      case "play-free":
        launchFreeKicks();
        break;
      default:
        break;
    }
  });

  /* ---------------------------------------------------------------------- */
  /* Boot                                                                   */
  /* ---------------------------------------------------------------------- */

  function boot() {
    if (!root.isConnected) document.body.appendChild(root);
    /* Classic's menu draws the tile; this only says how to open the hub. */
    const shell = window.CrazyKoraShell;
    if (shell && shell.menu) shell.menu.registerModeTile("freeKicks", openFreeKicks);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
