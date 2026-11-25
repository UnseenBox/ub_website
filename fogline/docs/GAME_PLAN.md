# Fogline — from prototype to a hit: the game plan

Status: proposal. Based on the `fogline-aim-mobile-ui` branch (commit `2cd416e`, 24 Nov 2026).
Target: CrazyGames first (desktop + mobile), then other web portals.

---

## 1. Where the game is today

What already works, and works well:

- A strong core feeling: a fixed first-person bunker, a believable perspective, articulated
  zombies with head/torso/leg hit zones, satisfying guns (M1A, M4, M249, M32), gore,
  headshot feedback, a gunship, an orbital strike and a nuke.
- A clean, data-driven code base (`src/data/*`), unit tests, touch controls and a
  first-time briefing.

Why it feels shallow (your diagnosis is right):

| Problem | What the player feels |
| --- | --- |
| One 8-wave run, then everything resets | "Why play again? Nothing I did stays." |
| The only goal is "survive the wave" | Every minute feels like the minute before |
| One location, one bunker | No sense of travelling, discovering or winning ground |
| Weapons are bought, never improved | No attachment to a gun, no build choices |
| You are alone (plus a chopper) | No team, no characters, no one to care about |
| No story | No reason *why* you are holding this line |
| Only `bestWave` / `bestKills` are saved | Nothing to come back to tomorrow |
| 13 HUD slots and a 13-step briefing on day one | Overwhelming before the fun starts |

The fix is not "more zombies". It is a **second loop around the battle**: a campaign
that remembers what you did, gives every mission a small purpose, and always shows
the next thing you are about to unlock.

---

## 2. The vision in one paragraph

> **Fogline** is a bunker-defense shooter where you push back a living fog, one position
> at a time. Each mission is a short, intense stand (4–6 minutes) at a new place —
> a farm bunker, a town rooftop, a bridge checkpoint, a chopper door gun. Between
> missions you upgrade your guns, recruit a squad of survivors, and watch the fog
> retreat across the valley map. Three acts, three giant bosses, one goal: reach the
> source of the fog and shut it down.

Design pillars (every feature must serve at least one):

1. **Aim is king.** Skillful headshots are always the best answer. Upgrades make you
   stronger, never make aiming irrelevant.
2. **Always a next unlock.** At every end-of-mission screen, the player can see the next
   reward and how close it is.
3. **Short missions, long sessions.** Missions are 4–6 minutes so "one more" is easy;
   the session gets long because the chain of goals is long.
4. **One new thing at a time.** Systems unlock in the story, never all at once.
5. **Ground you can see.** Progress is visible: the fog pulls back on the map, the HQ
   grows, the squad gets bigger.

---

## 3. The two loops

```
 CORE LOOP (one mission, 4–6 min)
   Deploy → waves (3–4) + a mission objective → earn $ → spend $ in the armory
   between waves → objective done → results (stars, Supplies, XP)

 META LOOP (between missions)
   Results → valley map (fog retreats, new node opens) → Workshop (upgrade guns)
   → Barracks (squad) → Loadout (pick guns + supports) → next mission

 DAILY LOOP (reasons to come back)
   Login supply drop → 3 daily contracts → Daily Fog Surge → collect the Supply Depot
```

### Currencies — keep it to two

| Currency | Earned | Spent on | Resets? |
| --- | --- | --- | --- |
| **Cash ($)** | Kills, headshots, wave bonuses (as today) | In-mission armory: ammo, mods, support charges, repairs | Every mission |
| **Supplies** | Mission results, stars, daily contracts, depot | Workshop upgrades, squad levels, HQ buildings | Never |

Plus **Stars** (1–3 per mission) that gate acts. No premium currency: CrazyGames is
ad-funded, so rewarded ads double rewards instead.

This keeps today's armory loop intact (it is fun) and adds a permanent layer on top.

---

## 4. Story — strong, but told in seconds

Rule: **no long cutscenes.** Story is told in 1–3 radio lines at mission start/end,
one illustrated "intel card" per act, and the map itself. Everything is skippable.

### Premise

Three weeks ago, something went wrong at **Meridian Station**, a research site at the
head of Harrow Valley. A grey fog rolled out of it. Wherever the fog touches, the dead get
up and walk. The army threw a chain of bunkers across the valley to stop it.
Soldiers call that chain **the Fogline**.

You are **Warden**, the last gunner on a failing line. At first your job is to hold.
Then Dr. Varga discovers the fog is *alive*: it feeds on the dead it raises, and when
enough of them fall, it thins. Holding is no longer enough. You are going to push it back
to where it came from.

### Cast (the "team" you asked for)

| Character | Role in story | Role in game |
| --- | --- | --- |
| **Major Hale** (Command) | Gives orders, grows to trust you | Mission briefings, objectives |
| **Kestrel** (chopper pilot) | Cocky, loyal; shot down in Act 2, rescued by you | Gunship support; her voice is the chopper radio |
| **Dr. Ines Varga** (scientist) | Explains the fog, has a secret about Meridian | Teaches each new enemy (replaces the long briefing); enemy codex |
| **"Dot" Okafor** (engineer) | Builds and fixes everything | Workshop + bunker upgrades |
| **Squad recruits** (6) | Survivors you rescue on missions | AI squad members (see §7) |

Using the people you already have (the chopper, the bunker repairs, the weapon drops)
and giving them faces and names turns existing features into characters for free.

### Three acts

| Act | Name | Locations | New threat | Ends with |
| --- | --- | --- | --- | --- |
| 1 | **Hold the Line** | Farm bunker, orchard road, grain silo, evac station | Shamblers, Sprinters, Crawlers, Brutes | Boss: **The Colossus** breaks the farm line. Command decides to push. |
| 2 | **Push the Fog** | Millbrook town rooftops, highway, river bridge, Kestrel's crash site | Riot Husks, Bloaters, Spitters, Howlers | Boss: **The Choir**, a giant Howler that commands the horde |
| 3 | **The Source** | Quarry, rail yard, Meridian gate, the lab | Sappers, Juggernauts, fog-mutated elites | Boss: **The Heart of the Fog** inside Meridian. Ending + Endless "the fog returns" |

Each act ends on a twist that gives a reason to start the next one:
Act 1 → "the fog can be pushed back". Act 2 → "Varga worked at Meridian; this was
an experiment". Act 3 → the ending, with a hook for live updates (new fog regions).

---

## 5. The campaign map

A new **Valley Map** scene replaces "8 waves and game over" as the game's spine.

- A stylised military paper map of Harrow Valley, painted procedurally like the rest of
  the art. Grey fog covers everything not yet won.
- **Nodes** are missions, joined by roads. Winning a node pulls the fog back with an
  animation. That is the most important "progress" image in the game.
- **Main path** (story missions) plus **side nodes**: supply runs (Supplies), rescues
  (new squad member), and "contested" nodes that re-fog and can be replayed for rewards.
- **Stars gate the acts** (soft gate): for example Act 2 needs 18 of 27 Act 1 stars. This
  makes replaying for stars meaningful and lets weaker players catch up on power.
- Every node shows: location art, objective icon, threat level vs. your power, star
  slots, first-time reward ("Unlocks: M249").

### Content size

3 acts × 9 missions (8 + boss) = **27 missions**, plus side nodes, the daily challenge and
Endless. At ~5 minutes each, that is 2–3 hours of campaign before stars and dailies: enough
for one to two weeks of daily play, which is what drives retention numbers.

---

## 6. Missions — mini goals instead of "just survive"

Every mission has a **main objective** and an optional **bonus objective** (the 3rd star).
All of them fit the fixed first-person view; no free movement is needed.

| Objective type | How it plays | Reuses |
| --- | --- | --- |
| **Hold** | Survive 3–4 waves (today's game) | Wave system |
| **Evacuate** | Civilians or a bus cross the field from left to right; zombies chase them; save at least N | Zombie lanes, new "civilian" walker |
| **Protect the asset** | A radio mast / fuel depot / second bunker in the field has its own HP bar; enemies split between it and you | Bunker HP logic on a second target |
| **Destroy the nests** | Fog nests pulse in the far field and keep spawning until you shoot their glowing cores | Hit zones, spawn groups |
| **Supply drop** | Crates parachute into the field mid-wave; shoot the chute or the crate locks before the horde reaches it | Projectile/hit test |
| **Night** | Darkness; fire flares (new consumable) and a searchlight cone to see | Fog bands, lighting tint |
| **Rail shooter** | Door gunner on Kestrel's chopper with a minigun as the field scrolls under you | Perspective projection with a moving camera |
| **Boss** | Giant enemy with glowing weak points, destroyed in phases while waves keep coming | Brute rig, scaled up |

Bonus objectives (3rd star) are short, readable lines, for example "15 headshots",
"Keep the bunker above 50%", "Save every civilian", "Don't use the nuke".

**Mission length: 3–4 waves (about 4–6 minutes).** Today's 8-wave run becomes the first
2–3 missions of Act 1. Short missions mean failing costs little, and every mission
ends on a reward screen, which is where the "one more" decision happens.

### Locations change the view

Each location is a preset for `EnvironmentArt` (sky, skyline, props, fog colour, ground)
plus a **position frame**: the bunker window, a rooftop parapet, a bridge checkpoint, a
watchtower, the chopper door. Same engine, very different places. This is the cheapest
big win for variety.

### In-mission spice (micro-goals without UI)

- **Explosive props** in the field (fuel drums, a tanker, a gas station) for chain kills.
- **Kill streaks**: a streak counter with a small cash multiplier; it resets when the
  bunker is hit.
- **Focus**: headshots fill a meter; when full, press to slow time for 4 s. A skill reward
  that feels amazing and keeps "aim is king".
- **Radio chatter** reacting to events ("Big one on the left!", "Nice shot, Warden").

---

## 7. The squad — you are no longer alone

Rescued survivors join the **Barracks**. Before a mission, you post up to 2 squad members
(3 later, 4 at max HQ) into **side firing positions**, visible at the left and right
edges of the view with their own muzzle flashes and voice lines.

| Recruit | Specialty | Behaviour |
| --- | --- | --- |
| **Mara** (Sniper) | Long range | Slow, high-damage shots at the farthest target; priority on Spitters/Howlers |
| **Brick** (Gunner) | Close defence | Sprays anything within 15 m of the wall |
| **Dot** (Engineer) | Support | Repairs the bunker slowly during waves |
| **Fuse** (Demolitions) | Crowds | Throws a grenade at the biggest cluster every 12 s |
| **Sparks** (Radio) | Support | Support strikes recharge 25% faster |
| **Doc Reyes** (Medic) | Sustain | Once per mission, revives the bunker from 0 to 30% |

- Each recruit levels up with Supplies (levels 1–10). One perk at levels 5 and 10.
- They are always **weaker than the player**. They make the team feel alive and cover
  your weak side; they never play the game for you.
- Recruiting happens on rescue missions, so it is story, not a menu.

---

## 8. Weapons and upgrades

### More guns, each one answers a new problem

Every new enemy comes with a tool that counters it ("lock and key"), which makes each
unlock feel useful right away.

| Weapon | Unlock | Answers |
| --- | --- | --- |
| M1A (starter) | Start | Headshots, all-round |
| M4 Carbine | Act 1, mission 2 | Sprinters, crowds |
| Pump shotgun | Act 1, mission 5 | Crawlers and anything at the wall |
| M249 SAW | Act 1 boss | Big waves |
| .50 Anti-material rifle | Act 2, mission 2 | Riot Husks, Spitters, boss weak points |
| M32 grenade launcher | Act 2, mission 5 | Packs, Bloaters |
| Flamethrower | Act 2 boss | Close swarms, nests |
| Rocket launcher | Act 3, mission 3 | Juggernauts |
| Prototype railgun | Act 3 boss reward | Endgame, pierces a whole lane |

### Workshop (permanent upgrades, paid with Supplies)

Each weapon has **4 upgrade tracks**, 5 levels each:

- **Damage**
- **Handling** (fire rate / spread)
- **Magazine**
- **Reload**

Costs grow by about ×1.4 per level. Every **5 total levels** on a gun raise its
**Weapon Rank**, which unlocks one **attachment slot**:

| Attachment | Effect |
| --- | --- |
| Extended magazine | +40% magazine |
| Scope | Zoom on the right mouse button |
| Laser | Tighter hip spread |
| Hollow points | +headshot damage |
| Bayonet / underbarrel | Weapon-specific special |

Attachments are **choices** (one slot, several options), which gives build depth without
spreadsheets.

### Mastery and cosmetics

Kills with a weapon fill its **mastery bar**. Mastery unlocks skins (desert, winter,
gold, "Fogline" camo). They are cheap to make with procedural art and are a strong
long-term collection goal.

### Loadout

Before each mission you pick **3 weapons + 2 supports** (a weapon lent by the mission comes on top). This adds strategy
("Spitters on this map, take the .50") and keeps the HUD small. Today's HUD shows 13
slots on day one; with loadouts it shows 4–6, growing slowly.

### Bunker / HQ upgrades

The current "Reinforced Bunker" level moves into the Workshop as a permanent track:
wall HP, shutter duration, repair amount, plus new **field defences**: barbed wire
(slows), claymores (one-shot burst at 10 m), and an auto-turret (late game).

---

## 9. Progression and difficulty — logical, not grindy

### The power model

- **Enemy power**: each mission has a *threat level* (1–60) that scales health ×1.08 and
  wave size ×1.06 per level.
- **Player power**: a single *power* number derived from weapon levels, attachments,
  squad and bunker. The map shows "Threat 14 · Your power 12" with colour (green,
  yellow, red).
- Tuning target: a player who plays every main mission once and upgrades with what they
  earn stays **at or slightly above** the recommended power. A player who replays for
  stars gets ahead and the game gets easier for them. A skilled aimer can beat missions
  at -3 power.

### Difficulty shape

- **Sawtooth.** Each act starts easier than the previous act's end (new location,
  breather), rises through the act, and spikes at the boss.
- **Failure is never wasted.** A failed mission still pays 40% of its Supplies, and the
  result screen suggests a concrete upgrade ("Upgrade M4 Damage: +12% power").
- **Comeback help.** After 2 failures on the same mission, offer a free reinforcement
  (an extra gunship charge) or a rewarded ad for +50% starting cash.

### Reward rhythm (the most important table in this plan)

Every mission end must show **something new or a bar that almost fills**.

| Reward | Frequency |
| --- | --- |
| Supplies + a weapon level affordable | Every mission |
| New weapon, recruit, location or support | Every 2–3 missions |
| New enemy (taught by Varga) | Every 2–3 missions |
| Boss + act intel card + big unlock | Every 9 missions |
| Daily contract / supply drop | Every day |

---

## 10. Retention — reasons to come back tomorrow

| Feature | What it is | Why it works |
| --- | --- | --- |
| **Daily supply drop** | 7-day login calendar; day 7 = a recruit's skin or a weapon skin. The streak forgives one missed day. | Simple daily habit |
| **Daily contracts** | 3 tasks a day ("40 headshots with the M4", "Win an Evacuate mission", "Kill 3 Brutes"). Reroll one per day. | Gives a goal for a short session; pushes variety |
| **Fog Surge (daily challenge)** | One special mission a day with a fixed seed and modifiers ("Night + only Sprinters", "Pistols only", "Double Bloaters"). Big reward, best score saved. | Different every day, shareable |
| **Supply Depot (HQ)** | Produces Supplies per hour, capped at 8 hours. Upgrade it to raise the cap. | "My stuff is waiting for me" |
| **Endless "Last Stand"** | Unlocks after Act 1. Infinite waves, best wave + score saved, rewards at milestones. | Mastery players live here |
| **Contested nodes** | Every day, 1–2 won nodes re-fog and pay bonus rewards when retaken | Reuses existing content |
| **Field Notes (codex)** | Varga's notes on every enemy, filled by kills (10 / 100 / 500 milestones) | Collection completion |

Keep the HQ small: one screen with 5 buildings (Workshop, Barracks, Radio, Depot,
Infirmary) that **appear as the story unlocks them**. No real-time build timers on
weapons. Timers only on the Depot's production.

---

## 11. The first 15 minutes (this decides your CrazyGames numbers)

Portal players decide in the first minute whether to stay. Today a new player gets a
13-step briefing before the first real fight. Replace it with **teaching by doing**,
one idea per mission:

| Time | What happens | What it teaches / unlocks |
| --- | --- | --- |
| 0:00 | One big **PLAY** button. No menu choices. | — |
| 0:05 | Mission 1 "Last Light" starts. Radio: "They're coming out of the fog, Warden. Aim for the heads." Only the M1A, no other HUD. | Aim, fire, headshots |
| 0:40 | First reload prompt appears when the magazine runs low | Reload |
| 2:30 | Mission won, 3 stars, Supplies, the map appears, fog pulls back | Map + stars |
| 3:00 | Dot: "Let me tune that rifle." Guided free M1A Damage upgrade | Workshop |
| 3:30 | Mission 2: Sprinters. A supply drop brings the **M4** | Weapon switch, armory (cash) |
| 7:00 | Mission 3: Kestrel's first radio call; **gunship** unlocked | Support strikes |
| 10:30 | Mission 4 "Evacuation": save the bus; rescue **Mara** (sniper) | New objective type, squad |
| 14:00 | Mission 5: first Brute (Varga explains it) + daily contracts open | Daily loop |
| 15:00 | Depot built: "Come back later — supplies are being collected" | Reason to return |

Targets: something new on screen at least every 3 minutes, and the player is shooting
zombies within **10 seconds** of pressing PLAY.

---

## 12. CrazyGames specifics

- **SDK integration**: the `crazy-goal` project already has a working `Portal`
  (`crazy-goal/src/portal/Portal.ts`): gameplayStart/Stop, happytime, midgame and rewarded
  ads, with a minimum gap between breaks. Copy that pattern into Fogline instead of
  writing it again.
- **Cloud save**: move `SaveManager` (localStorage only today) onto a `Profile` that
  saves through the SDK data module when available, with localStorage as the fallback.
  The campaign makes saves important; losing progress kills retention.
- **Happytime** on boss kills, act completion and 3-star results.
- **Midgame ads** only between missions, never during one, at least 3 minutes apart.
- **Rewarded ads**, always optional:
  - Double the mission Supplies
  - "Last-second reinforcements": restore 50% bunker once per mission
  - Free daily contract reroll
  - Extra starting cash after a failure
- **Load time**: keep the first download small. `bg-music.mp3` is 2.5 MB and
  `chopper-radio.mp3` 1.2 MB; stream music after the first frame and load per-act
  assets lazily.
- **Mobile**: touch controls exist. Loadouts (fewer buttons) make the phone HUD much
  cleaner. Test portrait-locked phones show the "rotate" prompt.
- **Launch path**: CrazyGames tests games on limited traffic before a wider release and
  looks at playtime and retention, so ship **Phase 1 + the first-15-minutes flow**
  before submitting, not the whole plan.

---

## 13. Roadmap

Each phase ships on its own and should move a metric.

### Phase 0 — Foundations (enables everything)

- `Profile` save v2: Supplies, stars per mission, unlocks, weapon levels, squad, daily
  state, with migration from today's save. SDK cloud save + localStorage fallback.
- `src/data/missions.ts`: mission = location + position frame + waves (3–4) +
  objective + bonus objective + rewards + radio lines.
- Results screen: stars, Supplies, progress bars, "next unlock".
- Progressive HUD: only unlocked slots are shown.

### Phase 1 — Campaign core: Act 1 (biggest effect on playtime)

Status: built (24 Nov 2026). Act 1 has 9 missions: Hold, Protect (relay mast, fuel depot), Evacuate
(bus convoys) and the Colossus boss, across three locations (Harlow farm, Orchard road, Millbrook
station). Workshop covers every weapon plus the bunker. The 13-step briefing stays available from the
menu as Training; campaign players get one-time control hints and Dr. Varga's intro per new enemy.


- Valley Map scene with fog retreat animation and Act 1's 9 nodes.
- Workshop with the 4 upgrade tracks for M1A, M4, M249.
- Loadout screen (2 weapons + 2 supports).
- Story radio lines and the Act 1 intel card; Varga teaches enemies in place of the
  13-step briefing.
- Objectives: Hold, Evacuate, Protect the asset.
- 3 location presets (farm, orchard road, evac station).
- Boss: The Colossus.
- Shotgun.
- **Goal**: average playtime above 12 minutes in testing.

### Phase 2 — Squad and variety

Status: built (25 Nov 2026). Act 2 "Push the Fog" (9 missions: Millbrook town, Highway 9, the river
bridge) ends with The Choir. Squad of three (Dot engineer, Mara sniper, Brick gunner) in the Barracks,
two at the side windows. Spitter, Howler, Sapper and Juggernaut from ENEMY_ROSTER.md (reused bodies with
colour tints for now). M82 .50 (pierces, armour-piercing) and M2 flamethrower. Nests, supply drops,
night with flares (Q), Focus slow-mo (SHIFT, from Act 2), kill streaks, explosive fuel drums.
Act 2 opens after the Colossus with 15 Act 1 stars.


- Barracks + 3 recruits (Mara, Brick, Dot) with side-position art and lines.
- Objectives: Destroy the nests, Supply drop, Night.
- New enemies from `docs/ENEMY_ROSTER.md` (Spitter, Howler, Sapper, Juggernaut) — the
  design is already written.
- Act 2 (9 missions) + Kestrel's crash site rescue + boss The Choir.
- .50 rifle, flamethrower; Focus slow-mo; kill streaks; explosive props.

### Phase 3 — Retention layer

Status: built (25 Nov 2026). An HQ screen (map button or H) opens after Act 1 mission 5 with the daily
supply drop (7-day calendar, one missed day forgiven, day 7 = Crimson skin), three daily contracts drawn
from what the player owns (one swap a day, +100 for all three), the Supply Depot (15–40 an hour, 8–12 hour
cap, 5 levels) and Field Notes (Varga's 3 pages per enemy at 10/100/500 kills). Fog Surge opens after
mission 7: a hold mission built daily from a recent win with 2 of 7 modifiers, 250 Supplies for the day's
first win, best score kept. Last Stand opens after Act 1: endless waves at the farm, 8 Supplies a wave,
milestones at 5–30. Weapon mastery unlocks Desert/Winter/Fogline/Gold skins (repainted view models). Rules
are pure in `systems/Retention.ts`, tested in `retention.test.ts`; the save stores them under `meta`.
Not built: the Infirmary and the separate HQ "buildings" art (the HQ is one tabbed screen).


- Daily supply drop, daily contracts, Fog Surge daily challenge.
- HQ screen + Supply Depot.
- Endless "Last Stand" with milestones.
- Field Notes codex, weapon mastery and skins.
- **Goal**: day-1 and day-7 retention up against Phase 1.

### Phase 4 — Act 3 and polish

Status: built (25 Nov 2026). Act 3 "The Source" (9 missions: Harlow quarry, the rail yard, Meridian gate,
the lab) opens after the Choir with 33 stars from Acts 1–2 and ends with The Heart of the Fog, a boss that
holds out in the yard, spits at the bunker and summons Fogborn. New elites: Fogborn (mutated sprinter) and
Ravager (mutated brute that bursts into Fogborn). Door Gunner (a3m3) is fought from Kestrel's helicopter on
a mounted M134, with no squad. M3 rocket launcher and XR-9 railgun; four attachments (extended mag, hollow
points, compensator, speed loader) bought once in the Workshop after a3m2 and fitted one per weapon.
Kestrel (pilot: strafing runs) and Rook (grenadier) join, for five recruits. Ending scene after the Heart,
pointing to Last Stand. Contested nodes: two won missions a day re-fog and pay +60% Supplies when retaken.
The "balance pass from real play data" is not done (there is no real data yet); instead every save now
records starts, wins, fails and minutes per mission, shown on the map with F9 (`window.__foglineStats()`).
New art is procedural or tinted reused bodies, like Phases 1–2.

- Act 3 + the chopper door-gunner mission + boss The Heart + the ending.
- Rocket launcher, railgun, attachments, remaining recruits.
- Balance pass from real play data; contested nodes.

### Phase 5 — CrazyGames release (last, by decision)

Status: built (26 Nov 2026), not submitted. `src/portal/Portal.ts` (adapted from crazy-goal, CrazyGames
only) reports loading and gameplay (paused in the armory, pause menu, ads and results), calls happytime on
boss kills and first three-star or first daily Fog Surge wins, and hands the SDK's data module to
`Profile.attachCloud()` so progress follows a signed-in player. The platform's mute switch silences the game.
Ads follow `src/portal/adRules.ts`: midgame breaks only when leaving a result, never before the third won
mission, 180 s apart; optional rewarded ads (45 s apart) for double Supplies, a retry with +50% cash after a
loss, reinforcements that restore half the bunker once per mission, and a second daily contract swap.
`npm run build:crazygames` builds to `dist-crazygames/` with the SDK script tag; `.env.crazygames` keeps ads
off (Basic Launch blocks them) until `VITE_ADS=on` for Full Launch. The eight boot images are now WebP
(11.3 MB → 2 MB); the build is 8.9 MB, of which 5.4 MB is audio that loads after the menu appears.
Still to do by hand: run the build on the CrazyGames developer portal's QA tool and submit it.

- Portal integration adapted from `crazy-goal` (§12): gameplay events, happytime,
  midgame and rewarded ads, `--mode crazygames` build.
- Cloud save: `Profile.attachCloud()` already merges a cloud copy; hook it to the SDK
  data module.

### Phase 6 — Act 4 "The Fog Returns" (added 26 Nov 2026, after the user chose more content)

The ending's hook comes true: spores from the Heart rode the river to the north coast.

- Act 4 (9 missions) on the coast: Saltmarsh harbour, Gull Point lighthouse, Fort Ashby. Opens after
  the Heart with 55 stars from Acts 1–3.
- New enemies: the **Lurker** (bursts out of the ground 16–28 m from the wire, skipping the long walk)
  and the **Sporeling** (bursts into a spore cloud that hides what is behind it for a few seconds).
- New condition: **storm** (rain, a dim field, lightning that lights everything for a moment).
- Boss: **The Bloom**, a spore flower in Fort Ashby's yard. Four spore pods around it shield it
  (it takes a fifth of the damage while any pod lives), and it regrows them once when half dead.
- A second epilogue after the Bloom; the Heart's ending now leads into Act 4.

Status: built (26 Nov 2026). As designed above; the Bloom also spits from the yard and calls Lurkers.
Lurkers and Sporelings join Last Stand from waves 13–14 once met. Rewards along the way: Tesla gun
(a4m3), Vesna (a4m6). New art is procedural or tinted reused bodies, like Acts 2–3.

### Phase 7 — Veteran and the full arsenal

Status: built (26 Nov 2026). Veteran: health ×1.35, wave size ×1.2, +0.05 speed, +12 threat, ×1.5
Supplies; a ✪ medal on the map node; `veteranMission()` in Campaign.ts. Tesla gun: 95 damage, four jumps
within 6 m at 75% each. Vesna shells the field beyond 36 m every 12 s.

- **Veteran**: any won mission can be replayed on Veteran (tougher, bigger waves) for a Veteran medal
  and 1.5× Supplies. Nine medals unlock the Obsidian skin for every weapon.
- **Tesla gun**: chain lightning that jumps from the target to nearby dead.
- **Sixth recruit**: Vesna, a mortar crew that shells the farthest group (the artillery the plan asked
  for, without a fourth support key on the HUD).

---

## 14. Where it lands in the code

| New / changed | Purpose |
| --- | --- |
| `src/data/missions.ts`, `src/data/locations.ts`, `src/data/story.ts` | Campaign content as data, like waves today |
| `src/data/squad.ts`, `src/data/workshop.ts`, `src/data/dailies.ts` | Recruits, upgrade tracks and costs, contract pool |
| `src/systems/Profile.ts` (replaces `SaveManager.ts`) | Persistent progress, migration, cloud save |
| `src/systems/Progression.ts` | Power, threat, rewards, unlock rules (pure, unit-tested) |
| `src/systems/ObjectiveSystem.ts` | Mission objectives and bonus checks |
| `src/systems/SquadSystem.ts` | AI squad targeting and firing |
| `src/portal/Portal.ts` | CrazyGames SDK, adapted from `crazy-goal` |
| `src/game/MapScene.ts`, `WorkshopScene.ts`, `LoadoutScene.ts`, `ResultsScene.ts`, `HQScene.ts` | Meta screens |
| `src/rendering/EnvironmentArt.ts` | Takes a `LocationDef` instead of one fixed scene |
| `src/game/GameScene.ts` | Starts from a `MissionDef`; reports objective events |
| `src/ui/Tutorial.ts` | Shrinks to per-mission contextual tips |

The balance stays where it is today: data files plus pure, unit-tested systems.

---

## 15. Measuring success

| Metric | Target | Driven by |
| --- | --- | --- |
| Time to first shot | < 10 s after PLAY | §11 |
| Average playtime | > 12 min | Short missions, reward rhythm, map |
| Missions per session | 3+ | Results screen "next unlock" |
| Day-1 return | Clearly above Phase 0 | Dailies, Depot, cliffhanger act endings |
| Mission fail rate | 15–30% (not 0%, not 60%) | Power model, comeback help |

Track these locally (a debug panel counting mission starts, wins, fails and time per
mission) during playtests, then on the CrazyGames developer dashboard after launch.

---

## 16. What not to do

- **No open world or free movement.** The fixed view is the game's identity and its
  performance budget.
- **No long cutscenes or text walls.** Three radio lines at most per mission.
- **No more than two currencies.**
- **No energy or stamina systems.** Portal players leave instead of waiting.
- **No real-time timers on weapon upgrades.**
- **No 13 buttons on day one.** Unlock the HUD with the story.
- **Don't build all phases before shipping.** Phase 0 + 1 is a real game; ship it,
  measure, then continue.
