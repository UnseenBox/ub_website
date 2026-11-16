# Tool, sprite and upgrade balance (2026-11-16)

The measure is in-game days to dig one shaft to bedrock (one working day = 7 AM to 5 PM). Fewer days means more useful. Every number comes from `dev/upgrade-sim.ts`, which uses the live game's formulas (`src/systems/ToolStats.ts`) and prices (`src/data/store.ts`).

## Tools

| Tool | 0% upgrades | 50% upgrades | Price |
|---|---|---|---|
| Drill | 3.24 | 0.32 | 75,000 |
| Diamond Shovel | 3.77 | 0.29 | 34,000 |
| Jackhammer | 5.99 | 0.46 | 26,000 |
| Pickaxe | 6.80 | 0.49 | 9,000 |
| Golden Shovel | 9.25 | 0.72 | 5,500 |
| Hand Axe | 10.69 | 1.00 | 2,800 |
| Steel Shovel | 13.26 | 1.53 | 1,200 |
| Iron Shovel | 16.01 | 3.22 | 180 |
| Old Shovel | 19.72 | 6.01 | 0 |

Prices already follow usefulness at 0% upgrades, so no tool price changed. Two near-ties remain: at 50% and above the Diamond edges out the Drill (0.29 vs 0.32), and the Pickaxe edges out the Jackhammer at 100% (0.08 vs 0.09). Neither changes the order by much.

## Upgrades

Each upgrade alone at max level, on the Pickaxe:

| Upgrade | Max | Days saved | Base price (before -> now) | Cost to max |
|---|---|---|---|---|
| Master Digger | 99 | 88% | 12,000 (unchanged) | 4.1 trillion |
| Quick Recovery | 8 | 47% | 260 -> 400 | 23,505 |
| Digging Damage | 8 | 45% | 300 -> 370 | 25,865 |
| Efficient Swings | 8 | 38% | 340 -> 330 | 23,075 |
| Bigger Tank | 8 | 10% | 200 -> 240 | 14,100 |
| Swing Speed | 8 | 1% | 380 -> 180 | 12,580 |

Swing Speed was the specific problem: it was the second most expensive upgrade but saved almost nothing. Stamina regeneration is the real limit on digging, and a human player clicks more slowly than the cooldown anyway. The same 1% holds on every tool (0 to 2%), so the price was lowered, not the formula.

Price order now matches usefulness: Master Digger > Quick Recovery > Digging Damage > Efficient Swings > Bigger Tank > Swing Speed.

## Master Digger maximum

- The intended maximum is 99 levels. It is the `maxLevel` in the store data, and the simulation reads the same value.
- The live game reached 91 earlier only because the test had 1 trillion money. Reaching 99 costs about 4.1 trillion, so with a 1e13 test budget the live game reached 99 exactly.
- Realistically the Master Digger tops out far lower. The economy simulation (`dev/econ-sim.ts`) gives a steady player about $6 million in four months, which buys roughly level 25 to 30. This is an open design question; the price was not changed.

## In-game checks

- With every upgrade at max, the Power Drill showed: dig depth 54, swing time 88.4 ms, max stamina 260, power 89.25 (15 x 5.95). All match the formulas.

## Prospecting upgrades and skills (2026-11-16, `dev/skills-sim.ts`)

The simulation plays whole working days with the real game logic (TraitSystem, ExcavationSystem, the live formulas and prices): dig one shaft, cut rocks in batches, relocate at bedrock. Setup: Pickaxe, the five older upgrades at about 30%, 12 days, 150 seeds, play skill 0.65. Each row is one upgrade or skill alone at max level. "Money gain" is rock money per day, "depth gain" is how fast the shaft goes down. Run it with `npx esbuild dev/skills-sim.ts --bundle --platform=node --format=cjs --outfile=%TEMP%/skills-sim.cjs` then `node`. Env: TOOL, DAYS, SEEDS, SKILL.

Baseline: 4,988 money per day, 5.4 rocks per day.

| Upgrade or skill | Max | Money gain | Depth gain | Base price | Cost to max |
|---|---|---|---|---|---|
| After Image | 5 | +39.9% | +6.5% | 9,000 | 379,020 |
| Angry Shoveler | 5 | +37.4% | +11.5% | 8,500 | 307,865 |
| Bigger Bag | 5 | +30.4% | +5.5% | 800 | 185,745 |
| Master Cutter | 5 | +25.4% | 0% | 4,500 | 162,985 |
| Big Hole | 5 | +24.8% | +10.1% | 4,000 | 134,115 |
| Haggler | 5 | +20.0% | 0% | 4,000 | 168,450 |
| Quick Crack | 5 | +17.8% | -0.8% | 1,500 | 46,500 |
| Keen Eye | 8 | +15.8% | -1.9% | 700 | 81,165 |
| Double Find | 5 | +14.1% | -1.3% | 4,500 | 162,985 |
| Second Wind | 3 | +13.5% | +2.1% | 7,500 | 73,125 |
| Scrap Shot | 5 | +4.3% | +2.4% | 1,800 | 47,525 |
| Hot Rock | 5 | +3.4% | +1.2% | 1,200 | 26,845 |

What the numbers say, and the choices made:

- **Price order follows usefulness.** After Image and Angry Shoveler are the strongest and the dearest. Bigger Bag is strong because a bag of 10 lets the player dig all day and cut everything after closing time (cutting costs no digging time then); that is why only its last three levels are very expensive (levels 4 and 5 cost about 37,000 and 134,000). Quick Crack is the cheap everyday upgrade. Hot Rock and Scrap Shot are fun more than strong, so they are cheap: a worthless rock is only about 8% of rocks, roughly one every two days.
- **Double Find** is priced higher than its gain (about 14%) because it was asked for as an expensive upgrade; **Master Cutter** (+25%) is priced the same.
- **Rage needs a long streak window.** With a 1.5 s window the same-spot streak broke every swing at low stamina (swings come 1.5 to 2 s apart when the tank is empty), so Angry Shoveler almost never fired (+3%). A 4 s window gives the +37% above.
- **Scrap Shot caught a hardness exploit while being tuned.** A minimum hole depth let the projectiles dig 8 units even where the main swing digs 3, which gave +44% depth. The depth is now a fraction of the real swing (0.3 of it), so hard ground still slows it, and the result is +2.4%.
- The older tool and upgrade results above are unchanged: `dev/upgrade-sim.ts` still gives 19.72 / 16.01 / 13.26 / 10.69 / 9.25 / 6.80 / 6.00 / 3.77 / 3.24 days to bedrock, so the new hole shapes did not change how fast a shaft goes down.
- Not measured: how the skills feel in a real session, and Master Digger together with the skills. A real play-test is still the thing to do.
