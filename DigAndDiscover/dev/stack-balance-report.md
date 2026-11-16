# Skill stacking balance investigation (2026-11-16)

Status: **investigation only. No game value was changed and nothing in the game was committed.** Everything below was produced by `dev/stack-sim.ts` (runner) and `dev/sim-engine.ts` (engine), which play whole working days with the game's real logic and data (TraitSystem, ExcavationSystem, DiscoverySystem, ToolStats, the store prices). Stacking models, trigger chances and price lists are applied only inside the simulation.

Baseline of the game under test: the working copy at commit `1f5207b` (the request mentioned `40117dd`, which is an older commit). `dev/stack-sim.ts` and `dev/sim-engine.ts` are new and uncommitted.

How to reproduce: `npx esbuild dev/stack-sim.ts --bundle --platform=node --format=cjs --outfile=%TEMP%/stack-sim.cjs`, then `set PHASE=A&& node %TEMP%/stack-sim.cjs` (PHASE = A, B, C, D, E; SEEDS, DAYS, SKILL, TOOL, MODEL, GROWTH, L3 are optional). Seeds are repeatable (run N uses seed (N+1) x 7919), so every table can be re-created.

Settings of the runs below: 120 days (the walk 150), 30 seeds (Phase D 40), play skill 0.65 (a decent player, same as the other simulations), base upgrades at about 30% (Stamina and Digging upgrades, as in `skills-sim`), Master Digger not bought. Money columns are medians over seeds; the bracket is the 10th to 90th percentile.

## 1. Summary

1. **The Old Shovel does not outperform the Pickaxe with the same skills.** With identical skills the Pickaxe earns 2.2 to 2.3 times what the Old Shovel earns (x2.34 with no skills, x2.31 with all 12 at level 3, x2.24 at max, Phase B). The worry came from comparing two different set-ups: an Old Shovel WITH all 12 skills at level 3 (21,762 per day) against a Pickaxe WITHOUT skills (14,563). That comparison is real, but it says the skill stack is big, not that skills erase the tool gaps. Tool gaps stay as they were.
2. **The skill stack is big.** All 12 at level 3 give x3.45 money and x1.63 dig speed on a Pickaxe over 120 days (x2.95 over 12 days: it compounds because deeper deposits are worth more). At max: x5.8. For comparison the whole tool ladder, Old Shovel to Power Drill, is x4.2. So the skills at max are worth more than every tool upgrade combined. They multiply, because they work on different things: the three dig skills x1.6, the five prospecting upgrades x1.7, and Haggler and Second Wind about x1.1 to x1.2 each.
3. **Under today's prices the skill tree is finished within 6 weeks.** In the purchase walk (a player who earns, shops and levels) all 12 are at level 3 on day 36 to 39 and at max on day 44 to 45. Income in month 4 is about 443,000 per day against about 82,000 per day without skills (x5.4).
4. **Controlled stacking helps the feel, not the total.** Cutting the rare huge swings (3x or more, up to 3.7x today) is good, but it only lowers the stack from x3.45 to x3.33. The total comes from the independent categories multiplying, so the size of the economy skills (Second Wind, Master Cutter, Haggler) matters more than how the dig skills combine.
5. **Recommended package** (all numbers in section 5): diminishing stacking for the three dig boosts, Angry Shoveler 6 to 4 percent per level, After Image 5 to 3.5 percent, lighter Second Wind, Master Cutter and Haggler, and new prices for the seven strongest items (the five cheap everyday items keep their prices). Result in the walk: level 3 of everything on day 51 to 56, max on day 94 to 96, month 4 income about 314,000 to 332,000 per day.

## 2. Corrections to the working assumptions

- "The Pickaxe earns less than the free Old Shovel" is not true under equal conditions (point 1 above).
- "Level 3 of everything costs about 9 days of month-2 income" is still right, but the walk is the better measure: with the skills in play the player's income grows 4 to 5 times, so the set is bought faster than a fixed income suggests (day 36 to 39).
- Every earlier skills table (`dev/upgrade-test-results.md`) measured one skill alone on the Pickaxe over 12 days. That is still correct for each skill, and it is why none looked broken. It could not show stacking.

## 3. Method and limits

- The engine is the loop of `dev/skills-sim.ts` extended with: per-day statistics (income split into raw value, Master Cutter and Haggler gains; rocks found and cut; depth; activations; the biggest swing), a purchase walk with prospector levels and household costs (copied from `dev/econ-sim.ts`), and stacking models.
- Stacking models act on the swing roll after TraitSystem has made it, so the game code is untouched: **free** is today (depth multipliers multiply, After Image is a full extra dig); **strongest only** keeps one boost per swing (Big Hole, else After Image, else Angry's depth); **diminishing** keeps every boost but the second counts half and the third a quarter (sorted by size).
- The Angry Shoveler rage timing (speed and stamina) is not changed by any stacking model, only its depth bonus.
- Limits: it is a bot with a fixed play skill digging one column; the purchase policies (cheapest-first and value-first) are two ways to spend, real players vary; Master Digger is left out (it is the endless sink); stamina refill ads, the store's daily deals and real ad breaks are not modelled; spread between seeds is about 8 percent (see the p10 to p90 brackets), so differences below about 5 percent between two cells are noise (the leave-one-out values in Phase D are noisier still, about 0.03); how it feels to a human is not measured.

## 4. Results (raw tables from dev/stack-sim.ts)

Phase A, B and C ran with the current rules. Phase D and E ran with growth 2.9 (GROWTH=2.9) and the preferred model "Recommended + lighter economy skills" (diminishing stacking, Angry 4%, After Image 3.5%, Second Wind 27/39/51%, Master Cutter 4%, Haggler 3%).

### Phase A: stacking under the current rules (Pickaxe, 120 days, 30 seeds, play skill 0.65)

Baseline (mid-game base upgrades, no skills): 14,563 money/day, 0.089 deposits/day.

| group | level | money/day median (p10-p90) | x money | deposits/day | x depth | rocks found/day | avg rock value | Master Cutter +/day | Haggler +/day | cost of the set |
|---|---|---|---|---|---|---|---|---|---|---|
| 3 dig skills (Big Hole, Angry, After Image) | 1 | 18,368 (16,438-19,703) | x1.26 | 0.106 | x1.19 | 6.1 | 3,024 | 0 | 0 | 22K |
| 3 dig skills (Big Hole, Angry, After Image) | 2 | 21,853 (19,324-23,337) | x1.50 | 0.120 | x1.35 | 6.5 | 3,392 | 0 | 0 | 67K |
| 3 dig skills (Big Hole, Angry, After Image) | 3 | 23,645 (22,371-25,492) | x1.62 | 0.132 | x1.48 | 6.9 | 3,477 | 0 | 0 | 165K |
| 3 dig skills (Big Hole, Angry, After Image) | max | 28,131 (25,840-32,311) | x1.93 | 0.154 | x1.74 | 7.5 | 3,776 | 0 | 0 | 821K |
| 7 skills | 1 | 20,808 (18,531-22,437) | x1.43 | 0.113 | x1.27 | 6.4 | 3,172 | 0 | 800 | 36K |
| 7 skills | 2 | 26,513 (23,972-28,302) | x1.82 | 0.132 | x1.49 | 7.0 | 3,619 | 0 | 1,964 | 115K |
| 7 skills | 3 | 33,251 (29,772-35,928) | x2.28 | 0.150 | x1.69 | 7.6 | 4,090 | 0 | 3,563 | 289K |
| 7 skills | max | 41,776 (37,499-44,831) | x2.87 | 0.173 | x1.95 | 8.3 | 4,482 | 0 | 6,963 | 1.14M |
| 5 prospecting upgrades | 1 | 17,354 (15,862-18,842) | x1.19 | 0.088 | x0.99 | 6.4 | 2,587 | 833 | 0 | 12K |
| 5 prospecting upgrades | 2 | 21,034 (19,764-22,082) | x1.44 | 0.087 | x0.98 | 7.1 | 2,693 | 2,022 | 0 | 38K |
| 5 prospecting upgrades | 3 | 24,563 (22,547-26,010) | x1.69 | 0.086 | x0.97 | 7.8 | 2,715 | 3,295 | 0 | 96K |
| 5 prospecting upgrades | max | 31,407 (29,025-32,318) | x2.16 | 0.081 | x0.91 | 9.9 | 2,506 | 6,483 | 0 | 639K |
| all 12 | 1 | 24,596 (21,966-26,277) | x1.69 | 0.112 | x1.26 | 7.2 | 3,192 | 1,296 | 946 | 48K |
| all 12 | 2 | 36,188 (33,499-38,439) | x2.48 | 0.129 | x1.46 | 8.7 | 3,599 | 3,293 | 2,681 | 153K |
| all 12 | 3 | 50,191 (46,503-53,349) | x3.45 | 0.145 | x1.63 | 10.3 | 3,968 | 6,040 | 5,378 | 386K |
| all 12 | max | 84,681 (80,114-90,484) | x5.81 | 0.156 | x1.76 | 14.1 | 4,222 | 14,980 | 14,113 | 1.78M |

#### Month by month (median money/day)

| config | days 1-30 | days 31-60 | days 61-90 | days 91-120 |
|---|---|---|---|---|
| no skills | 6,778 | 12,488 | 18,472 | 20,227 |
| all 12 at level 3 | 21,795 | 42,242 | 59,744 | 76,612 |
| all 12 at max | 38,588 | 72,802 | 99,120 | 127,937 |


### Phase B: all tools under identical skill configurations (current rules, 120 days, 30 seeds)

#### no skills

| tool | price | money/day | vs previous tool | deposits/day | rocks found/day | avg rock value | payback vs previous tool |
|---|---|---|---|---|---|---|---|
| Old Shovel | 0 | 6,234 | - | 0.046 | 5.9 | 1,052 | - |
| Iron Shovel | 180 | 7,735 | x1.24 | 0.055 | 5.9 | 1,318 | 0.1 d |
| Steel Shovel | 1,200 | 9,400 | x1.22 | 0.063 | 5.8 | 1,628 | 0.7 d |
| Hand Axe | 2,800 | 11,280 | x1.20 | 0.071 | 5.7 | 1,988 | 1.5 d |
| Golden Shovel | 5,500 | 12,197 | x1.08 | 0.074 | 5.5 | 2,218 | 6.0 d |
| Pickaxe | 9,000 | 14,563 | x1.19 | 0.089 | 5.6 | 2,597 | 3.8 d |
| Jackhammer | 26,000 | 16,797 | x1.15 | 0.080 | 6.3 | 2,702 | 11.6 d |
| Diamond Shovel | 34,000 | 20,620 | x1.23 | 0.108 | 5.7 | 3,639 | 8.9 d |
| Power Drill | 75,000 | 26,206 | x1.27 | 0.098 | 6.9 | 3,793 | 13.4 d |

#### all 12 at level 3

| tool | price | money/day | vs previous tool | deposits/day | rocks found/day | avg rock value | payback vs previous tool |
|---|---|---|---|---|---|---|---|
| Old Shovel | 0 | 21,762 | - | 0.080 | 10.4 | 1,625 | - |
| Iron Shovel | 180 | 27,694 | x1.27 | 0.092 | 10.3 | 2,130 | 0.0 d |
| Steel Shovel | 1,200 | 32,615 | x1.18 | 0.106 | 10.4 | 2,497 | 0.2 d |
| Hand Axe | 2,800 | 38,494 | x1.18 | 0.118 | 10.3 | 2,970 | 0.5 d |
| Golden Shovel | 5,500 | 41,697 | x1.08 | 0.124 | 10.2 | 3,316 | 1.7 d |
| Pickaxe | 9,000 | 50,191 | x1.20 | 0.145 | 10.3 | 3,968 | 1.1 d |
| Jackhammer | 26,000 | 57,300 | x1.14 | 0.128 | 11.5 | 4,003 | 3.7 d |
| Diamond Shovel | 34,000 | 64,544 | x1.13 | 0.173 | 10.5 | 4,934 | 4.7 d |
| Power Drill | 75,000 | 85,051 | x1.32 | 0.155 | 12.8 | 5,277 | 3.7 d |

#### all 12 at max

| tool | price | money/day | vs previous tool | deposits/day | rocks found/day | avg rock value | payback vs previous tool |
|---|---|---|---|---|---|---|---|
| Old Shovel | 0 | 37,786 | - | 0.086 | 14.1 | 1,880 | - |
| Iron Shovel | 180 | 47,171 | x1.25 | 0.099 | 14.0 | 2,356 | 0.0 d |
| Steel Shovel | 1,200 | 55,619 | x1.18 | 0.114 | 14.1 | 2,744 | 0.1 d |
| Hand Axe | 2,800 | 64,815 | x1.17 | 0.129 | 14.1 | 3,219 | 0.3 d |
| Golden Shovel | 5,500 | 70,941 | x1.09 | 0.133 | 13.9 | 3,613 | 0.9 d |
| Pickaxe | 9,000 | 84,681 | x1.19 | 0.156 | 14.1 | 4,222 | 0.7 d |
| Jackhammer | 26,000 | 97,881 | x1.16 | 0.139 | 15.8 | 4,382 | 2.0 d |
| Diamond Shovel | 34,000 | 111,346 | x1.14 | 0.187 | 14.4 | 5,544 | 2.5 d |
| Power Drill | 75,000 | 141,041 | x1.27 | 0.165 | 17.5 | 5,675 | 2.5 d |

#### Does the Old Shovel with skills beat the Pickaxe with the same skills?

| config (same for all tools) | Old Shovel | Pickaxe | Power Drill | Pickaxe / Old Shovel | Drill / Pickaxe |
|---|---|---|---|---|---|
| no skills | 6,234 | 14,563 | 26,206 | x2.34 | x1.80 |
| all 12 at level 3 | 21,762 | 50,191 | 85,051 | x2.31 | x1.69 |
| all 12 at max | 37,786 | 84,681 | 141,041 | x2.24 | x1.67 |

#### Old Shovel with ALL skills vs other tools WITHOUT skills (different configurations, the comparison that caused the worry)

| tool without skills | its money/day | Old Shovel with all 12 at level 3 | result |
|---|---|---|---|
| Old Shovel | 6,234 | 21,762 | Old Shovel + skills earns more |
| Iron Shovel | 7,735 | 21,762 | Old Shovel + skills earns more |
| Steel Shovel | 9,400 | 21,762 | Old Shovel + skills earns more |
| Hand Axe | 11,280 | 21,762 | Old Shovel + skills earns more |
| Golden Shovel | 12,197 | 21,762 | Old Shovel + skills earns more |
| Pickaxe | 14,563 | 21,762 | Old Shovel + skills earns more |
| Jackhammer | 16,797 | 21,762 | Old Shovel + skills earns more |
| Diamond Shovel | 20,620 | 21,762 | Old Shovel + skills earns more |
| Power Drill | 26,206 | 21,762 | tool alone earns more |


### Phase C: stacking models (120 days, 30 seeds, play skill 0.65)

#### Money per day multiplier over the same tool with no skills: all 12 at level 3

| model (money / depth) | Old Shovel | Steel Shovel | Pickaxe | Diamond Shovel | Power Drill |
|---|---|---|---|---|---|
| Current | x3.49 / x1.72 | x3.47 / x1.66 | x3.45 / x1.63 | x3.13 / x1.60 | x3.25 / x1.58 |
| Reduced chances | x3.25 / x1.61 | x3.27 / x1.57 | x3.12 / x1.54 | x2.84 / x1.52 | x3.01 / x1.51 |
| Controlled: strongest only | x3.32 / x1.59 | x3.24 / x1.55 | x3.28 / x1.53 | x3.01 / x1.51 | x3.10 / x1.49 |
| Controlled: diminishing | x3.41 / x1.63 | x3.39 / x1.57 | x3.33 / x1.56 | x3.13 / x1.53 | x3.10 / x1.50 |
| Reduced + strongest | x3.11 / x1.54 | x3.06 / x1.50 | x2.97 / x1.46 | x2.74 / x1.45 | x2.93 / x1.43 |

#### Money per day multiplier over the same tool with no skills: all 12 at max

| model (money / depth) | Old Shovel | Steel Shovel | Pickaxe | Diamond Shovel | Power Drill |
|---|---|---|---|---|---|
| Current | x6.06 / x1.86 | x5.92 / x1.80 | x5.81 / x1.76 | x5.40 / x1.74 | x5.38 / x1.68 |
| Reduced chances | x5.62 / x1.76 | x5.41 / x1.70 | x5.17 / x1.66 | x4.85 / x1.63 | x5.09 / x1.61 |
| Controlled: strongest only | x5.46 / x1.65 | x5.30 / x1.61 | x5.08 / x1.57 | x4.77 / x1.54 | x4.88 / x1.51 |
| Controlled: diminishing | x5.37 / x1.71 | x5.62 / x1.66 | x5.56 / x1.63 | x5.08 / x1.61 | x5.12 / x1.56 |
| Reduced + strongest | x5.07 / x1.60 | x4.81 / x1.55 | x4.85 / x1.50 | x4.52 / x1.50 | x4.65 / x1.48 |

#### Dig skills alone (3 dig skills) at level 3 and max, Pickaxe, multiplier of money / depth

| model | level 3 | max |
|---|---|---|
| Current | x1.62 / x1.48 | x1.93 / x1.74 |
| Reduced chances | x1.47 / x1.40 | x1.79 / x1.64 |
| Controlled: strongest only | x1.52 / x1.40 | x1.75 / x1.57 |
| Controlled: diminishing | x1.56 / x1.44 | x1.88 / x1.61 |
| Reduced + strongest | x1.43 / x1.36 | x1.58 / x1.50 |

#### How often the exciting effects still fire (Pickaxe, 3 dig skills at level 3 / at max, per working day)

| model | level 3 | max |
|---|---|---|
| Current | 10 big holes, 5.8 rages, 10 ghosts; 54% of swings boosted, biggest swing 3.7x, 4.8 swings of 3x+ | 17 big holes, 7.2 rages, 17 ghosts; 70% of swings boosted, biggest swing 4.2x, 10.2 swings of 3x+ |
| Reduced chances | 10 big holes, 4.6 rages, 7 ghosts; 46% of swings boosted, biggest swing 3.5x, 3.7 swings of 3x+ | 17 big holes, 6.0 rages, 12 ghosts; 62% of swings boosted, biggest swing 4.0x, 8.4 swings of 3x+ |
| Controlled: strongest only | 10 big holes, 5.8 rages, 9 ghosts; 54% of swings boosted, biggest swing 2.2x, 0.0 swings of 3x+ | 17 big holes, 7.3 rages, 13 ghosts; 69% of swings boosted, biggest swing 2.2x, 0.0 swings of 3x+ |
| Controlled: diminishing | 10 big holes, 5.8 rages, 10 ghosts; 54% of swings boosted, biggest swing 2.7x, 0.0 swings of 3x+ | 17 big holes, 7.2 rages, 17 ghosts; 70% of swings boosted, biggest swing 2.8x, 0.0 swings of 3x+ |
| Reduced + strongest | 10 big holes, 4.6 rages, 6 ghosts; 46% of swings boosted, biggest swing 2.2x, 0.0 swings of 3x+ | 17 big holes, 6.2 rages, 9 ghosts; 62% of swings boosted, biggest swing 2.2x, 0.0 swings of 3x+ |


### Phase E: purchase walk (a player earns, shops and levels for 150 days)

Tools and base upgrades follow dev/econ-sim.ts (best affordable tool, cheapest useful upgrade); household costs included; Master Digger left out (it is the endless sink). Prospector level gates tools and skills.

### Phase D: stacking models, value of each item, price proposal (120 days, 30 seeds, play skill 0.65)

#### How big is the whole stack? Multiplier of money / depth over the same tool without skills

| model | all 12 at | Old Shovel | Pickaxe | Power Drill |
|---|---|---|---|---|
| Current | level 3 | x3.49 / x1.72 | x3.45 / x1.63 | x3.25 / x1.58 |
| Current | max | x6.06 / x1.86 | x5.81 / x1.76 | x5.38 / x1.68 |
| Controlled: diminishing | level 3 | x3.41 / x1.63 | x3.33 / x1.56 | x3.10 / x1.50 |
| Controlled: diminishing | max | x5.37 / x1.71 | x5.56 / x1.63 | x5.12 / x1.56 |
| Recommended: diminishing + calmer chances | level 3 | x3.14 / x1.56 | x3.11 / x1.48 | x2.96 / x1.44 |
| Recommended: diminishing + calmer chances | max | x5.25 / x1.63 | x5.08 / x1.55 | x4.77 / x1.51 |
| Recommended + lighter economy skills | level 3 | x2.81 / x1.53 | x2.78 / x1.46 | x2.69 / x1.42 |
| Recommended + lighter economy skills | max | x4.57 / x1.59 | x4.48 / x1.50 | x4.24 / x1.48 |

#### Value of each item inside the level-3 stack (money lost if it is removed), Pickaxe

| item | value (current / diminishing / preferred) | weight | price now (base xgrowth) | proposed | cost to level 3 | cost to max |
|---|---|---|---|---|---|---|
| Big Hole | x1.11 / x1.04 / x1.07 | 0.071 | 4,000 x2.05 | 9,000 x2.9 | 29K -> 111K | 134K -> 967K |
| Angry Shoveler | x1.33 / x1.26 / x1.22 | 0.239 | 8,500 x2.1 | 30,000 x2.9 | 64K -> 369K | 308K -> 3.22M |
| After Image | x1.18 / x1.16 / x1.11 | 0.141 | 9,000 x2.2 | 18,000 x2.9 | 72K -> 222K | 379K -> 1.93M |
| Hot Rock | x1.02 / x1.02 / x1.01 | 0.030 | 1,200 x1.8 | kept | 7K -> 7K | 27K -> 27K |
| Scrap Shot | x1.02 / x1.03 / x1.00 | 0.030 | 1,800 x1.9 | kept | 12K -> 12K | 48K -> 48K |
| Second Wind | x1.22 / x1.16 / x1.09 | 0.144 | 7,500 x2.5 | 18,000 x2.9 | 73K -> 222K | 73K -> 222K |
| Haggler | x1.12 / x1.12 / x1.09 | 0.104 | 4,000 x2.2 | 13,000 x2.9 | 32K -> 160K | 168K -> 1.40M |
| Keen Eye | x1.08 / x1.06 / x1.08 | 0.073 | 700 x1.75 | kept | 4K -> 4K | 81K -> 81K |
| Quick Crack | x1.11 / x1.08 / x1.10 | 0.094 | 1,500 x2 | kept | 11K -> 11K | 47K -> 47K |
| Bigger Bag | x1.09 / x1.10 / x1.07 | 0.082 | 800 x3.6 | kept | 14K -> 14K | 186K -> 186K |
| Double Find | x1.10 / x1.06 / x1.07 | 0.080 | 4,500 x2.1 | 10,000 x2.9 | 34K -> 123K | 163K -> 1.07M |
| Master Cutter | x1.17 / x1.20 / x1.14 | 0.156 | 4,500 x2.1 | 20,000 x2.9 | 34K -> 246K | 163K -> 2.15M |

| set | level 3 now | level 3 proposed | max now | max proposed |
|---|---|---|---|---|
| all 12 | 386K | 1.50M | 1.78M | 11.35M |
| 7 skills | 289K | 1.10M | 1.14M | 7.82M |
| 5 prospecting | 96K | 398K | 639K | 3.54M |

#### Walk: GAME TODAY (current rules, current prices), model "Current", 150 days, 30 seeds, policy cheapest-first vs value-first

| policy | first skill bought | all 12 at level 3 | all 12 at max | Pickaxe bought | Drill bought | money/day, months 1-4 |
|---|---|---|---|---|---|---|
| cheapest | day 14 (12-17) | day 39 (35-43) | day 45 (42-49) | day 15 (13-17) | day 31 (28-35) | 10,470 / 171,450 / 328,188 / 442,999 |
| value | day 17 (14-19) | day 35 (33-38) | day 44 (40-47) | day 15 (13-18) | day 30 (27-34) | 12,278 / 179,074 / 335,400 / 458,479 |

#### Walk: preferred rules, current prices, model "Recommended + lighter economy skills", 150 days, 30 seeds, policy cheapest-first vs value-first

| policy | first skill bought | all 12 at level 3 | all 12 at max | Pickaxe bought | Drill bought | money/day, months 1-4 |
|---|---|---|---|---|---|---|
| cheapest | day 14 (12-17) | day 40 (36-43) | day 48 (43-51) | day 15 (13-17) | day 32 (27-35) | 10,328 / 129,745 / 250,971 / 333,226 |
| value | day 17 (14-19) | day 37 (33-40) | day 46 (43-49) | day 15 (13-18) | day 31 (28-34) | 12,919 / 141,008 / 247,490 / 335,960 |

#### Walk: preferred rules, PROPOSED prices, model "Recommended + lighter economy skills", 150 days, 30 seeds, policy cheapest-first vs value-first

| policy | first skill bought | all 12 at level 3 | all 12 at max | Pickaxe bought | Drill bought | money/day, months 1-4 |
|---|---|---|---|---|---|---|
| cheapest | day 14 (12-17) | day 56 (50-60) | day 96 (90-102) | day 15 (13-17) | day 31 (27-36) | 9,444 / 96,749 / 217,832 / 313,562 |
| value | day 17 (14-19) | day 51 (46-55) | day 94 (89-98) | day 15 (13-18) | day 33 (29-35) | 10,865 / 102,833 / 226,945 / 332,289 |


## 5. Recommendation (for approval; nothing is applied)

### Preferred stacking model: diminishing

Every dig boost that lands on one swing still applies, but sorted by size the second counts half and the third a quarter. Why this one and not "strongest only":

| | Current | Strongest only | Diminishing |
|---|---|---|---|
| Big holes / rages / ghosts per day at level 3 | 10 / 5.8 / 10 | 10 / 5.8 / 9 | 10 / 5.8 / 10 |
| the same at max | 17 / 7.2 / 17 | 17 / 7.3 / 13 | 17 / 7.2 / 17 |
| Biggest single swing (level 3 / max) | 3.7x / 4.2x | 2.2x / 2.2x | 2.7x / 2.8x |
| Swings of 3x or more per day (level 3 / max) | 4.8 / 10.2 | 0 / 0 | 0 / 0 |
| 3 dig skills, money (level 3 / max) | x1.62 / x1.93 | x1.52 / x1.75 | x1.56 / x1.88 |

Diminishing keeps every activation as frequent as today (the exciting part), removes the 3x+ outlier swings, and is easy to explain ("extra boosts on the same swing count for less"). "Strongest only" is simpler to build but suppresses a quarter of the ghost swings at max. Neither lowers the total much (see summary point 4).

### Trigger probabilities and effect sizes

| Skill | Now | Proposed |
|---|---|---|
| Angry Shoveler | 6% per level (30% at level 5) | **4%** per level (20%) |
| After Image | 5% per level | **3.5%** per level |
| Big Hole | 5% per level | unchanged |
| Second Wind (once per day) | refills 40 / 55 / 70% | **27 / 39 / 51%** |
| Master Cutter | 5% per level | **4%** per level |
| Haggler | +4% per level | **+3%** per level |
| Double Find, Quick Crack, Keen Eye, Bigger Bag, Hot Rock, Scrap Shot | as now | unchanged |

Together with diminishing stacking this lowers the full stack (Pickaxe, 120 days) from x3.45 to **x2.81** at level 3 and from x5.8 to **x4.5** at max.

### Prices (growth 2.9 per level on the seven strong items; the five cheap ones keep today's prices)

Each strong item got its share of the level-3 budget by its measured value inside the stack (leave-one-out, Phase D), not a blanket multiplier. Double Find has a weight floor because it was requested as an expensive upgrade even though it measures modestly.

| Item | Now (base x growth) | Proposed | Level 3 now -> proposed | Max now -> proposed |
|---|---|---|---|---|
| Angry Shoveler | 8,500 x2.1 | **30,000 x2.9** | 64K -> 369K | 308K -> 3.22M |
| Master Cutter | 4,500 x2.1 | **20,000 x2.9** | 34K -> 246K | 163K -> 2.15M |
| After Image | 9,000 x2.2 | **18,000 x2.9** | 72K -> 222K | 379K -> 1.93M |
| Second Wind (3 levels) | 7,500 x2.5 | **18,000 x2.9** | 73K -> 222K | same |
| Haggler | 4,000 x2.2 | **13,000 x2.9** | 32K -> 160K | 168K -> 1.40M |
| Double Find | 4,500 x2.1 | **10,000 x2.9** | 34K -> 123K | 163K -> 1.07M |
| Big Hole | 4,000 x2.05 | **9,000 x2.9** | 29K -> 111K | 134K -> 967K |
| Keen Eye, Quick Crack, Bigger Bag, Hot Rock, Scrap Shot | as now | unchanged | | |
| **All 12** | | | **386K -> 1.50M** | **1.78M -> 11.35M** |

Milestones in the purchase walk with these rules and prices (150 days, 30 seeds; cheapest-first and value-first spending):

| | Today's rules and prices | Proposed rules and prices | Target |
|---|---|---|---|
| All 12 at level 3 | day 36 to 39 | **day 51 to 56** | days 45 to 60 |
| All 12 at max | day 44 to 45 | **day 94 to 96** | month 4 or later |
| Pickaxe / Power Drill bought | day 15 / day 30 | day 15 / day 31 to 33 | unchanged |
| Income per day in month 4 | about 443,000 to 458,000 | about 314,000 to 332,000 | |

### Tool profitability (Phase B)

- Every tool pays back its price within days: 0.1 to 13 days with no skills, under 5 days with level-3 skills. Tools are the early milestones and stay worth buying with skills (skills raise the income a tool improves, so payback gets faster).
- Tool steps stay at x1.08 to x1.32 per tier in every configuration; the skills do not flatten them.
- Two tool findings outside this investigation: the Golden Shovel is the weakest step (x1.08 for 5,500), and the Jackhammer digs fewer deposits per day than the Pickaxe (0.080 against 0.089) although it costs three times as much (its income is still higher through more finds).

### Open decisions for the owner

1. **How big may the whole stack be?** After the package it is still x2.8 (level 3) and x4.5 (max), about the size of the whole tool ladder (x4.2). If the tools should stay the bigger axis, trim the economy skills and Keen Eye / Quick Crack / Double Find effects by about another 20 percent. I did not apply this; it is a design choice.
2. **Bigger Bag levels 3 to 5** (bag slots 8 to 10) were asked to be "very expensive". On the new scale (level 5 costs 134K against 3.2M for Angry Shoveler) they are no longer very expensive. Raising its growth from 3.6 to about 4.6 would put level 5 near 360K. Not measured separately.
3. Master Digger (endless sink) was left out of every test; with income of 300K per day in month 4 it should be re-checked together with the new prices.

### If approved, the change list

`src/data/traits.ts` (chances, Second Wind, Master Cutter, Haggler), `src/data/store.ts` (seven price lists, perLevel texts), `src/systems/TraitSystem.ts` and `DigScene.ts` (diminishing combination of boosts, ghost depth scale), then re-run `dev/stack-sim.ts` Phases C and E on the real values and play-test.
