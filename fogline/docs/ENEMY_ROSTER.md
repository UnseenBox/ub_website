# Enemy roster expansion — design

Status: proposed for approval.
Approach: reuse the existing `shamble` / `run` / `heavy` rigs, add new procedural
looks and new behaviour hooks. No new character rigs.

## Goals

- Add four enemies: **Spitter**, **Howler**, **Sapper**, **Juggernaut**.
- The Spitter debuts in **wave 2**; Howler in wave 3, Sapper in wave 4 and
  Juggernaut in wave 5. Waves 6–8 mix all four with the existing roster.
- Give each enemy one clear job the player can read and counter.
- Preserve the current wave/economy feel, existing sounds and the M1A aim fix.

## Non-goals

- New articulated rigs, new weapons or a save-format change.
- Pathfinding. Enemies keep the existing lane-walk, crowd separation and wall line.
- A codex/UI screen. Enemy identity is communicated by silhouette, sound and the
  existing wave banner.

## Roster

| Enemy | ID | Rig | Height | HP | Speed | Wall attack | Reward | Debut |
| --- | --- | --- | ---: | ---: | ---: | --- | ---: | --- |
| Spitter | `spitter` | shamble | 1.82 m | 110 | 1.85 m/s | 10 dmg / 1.8 s after it advances | 45 | wave 2 |
| Howler | `howler` | shamble | 1.88 m | 90 | 2.0 m/s | 8 dmg / 1.8 s after it advances | 55 | wave 3 |
| Sapper | `sapper` | run | 1.78 m | 45 | 7.4 m/s | detonates for 70 | 40 | wave 4 |
| Juggernaut | `juggernaut` | heavy | 2.35 m | 900 | 1.25 m/s | 42 dmg / 2.1 s | 180 | wave 5 |

Zone multipliers and stagger thresholds:

| Enemy | Head | Torso | Legs | Armoured zones | Stagger threshold |
| --- | ---: | ---: | ---: | --- | ---: |
| Spitter | 1.25 | 1 | 0.7 | — | 45 |
| Howler | 1.2 | 1 | 0.7 | — | 40 |
| Sapper | 1.1 | 1 | 0.8 | — | 25 |
| Juggernaut | 1.0 | 0.3 | 0.45 | torso, legs | 700 |

The Juggernaut's head is deliberately **not** armoured: the visor slit is the
weak point. AP rounds still strip its torso/legs armour.

## Behaviour

### Spitter — ranged pressure

- Walks to a hold point 24–32 m out, then stops and spits up to **3** times.
- Each spit has a **0.75 s wind-up** with a green charge glow and a wet launch
  cue, then an acid glob arcs to a random point on the sandbags. Impact deals
  **14** bunker damage and leaves a brief green splash.
- Spits every **4.4 s**. After the third, it advances and claws for 10 damage.
- Fragile, and its throat sac is the bright weak point. Killing it stops the
  barrage. First spit of a run shows a one-line HUD tip.
- Counterplay: look past the front rank and kill it during the wind-up.

### Howler — force multiplier

- Walks to a hold point 38–44 m out and stays there for up to **3** howls.
- First howl after **4–6 s**, then every **8 s**. A howl is a 1.35 s scream with
  a visible ring and a rising audio cue.
- All living non-Howler enemies within **30 m** get **+35 % speed for 4.5 s**.
- Its **first** howl also calls **2 Shamblers** in from the fog. The summons are
  counted through `notifyExtraSpawned`, so the wave cannot end early.
- After the third howl it advances and claws for 8 damage.
- Counterplay: kill the Howler before the front rank closes, or accept the
  speed boost and the extra bodies.

### Sapper — rusher / chain hazard

- Sprints at **7.4 m/s** — faster than a Sprinter — with a lit charge vest.
- A beep plays while it is close, speeding up as it approaches. This is the
  warning to shoot it.
- Reaching the wall detonates for **70** bunker damage instead of clawing.
- Dying anywhere triggers a **4.0 m** blast for **60** damage to nearby enemies
  (friendly fire). Sappers caught in another Sapper's blast can chain.
- At the wall the blast also damages nearby enemies.
- Counterplay: shoot it early, ideally next to a crowd, and keep it away from the
  wall. It has only 45 HP.

### Juggernaut — wave anchor

- Slow, heavily armoured, 900 HP, immune to ordinary stagger.
- Torso and legs are armoured; the **visor/head** takes full damage and the
  headshot multiplier. AP rounds make body shots viable.
- Heavy slam for 42 damage every 2.1 s. Existing camera shake and bunker impact
  audio carry the weight.
- Appears as a single anchor in wave 5, then again in 6 and 7, and two in wave 8.
- Counterplay: focus the visor, use AP or explosives, and do not let it reach the
  wall while the front rank is still alive.

## Wave schedule

Existing waves keep their names and multipliers; new groups are added around the
current ones. Counts are scheduled spawns (Howler summons are extra).

| Wave | Name | Groups (enemy × count @ delay / interval) | Scheduled |
| ---: | --- | --- | ---: |
| 1 | First Contact | shambler ×10 @0/2.6 | 10 |
| 2 | The Long Walk | shambler ×12 @0/2.0 · **spitter ×2 @14/9** · shambler ×8 @20/1.0 burst 2 | 22 |
| 3 | Fast Movers | shambler ×14 @0/1.8 · runner ×4 @9/4.5 · **howler ×2 @18/10** | 20 |
| 4 | Mixed Column | shambler ×18 @0/1.5 · runner ×8 @6/3.0 · **sapper ×4 @12/4.0** · runner ×4 @30/0.6 burst 2 | 34 |
| 5 | Riot Line | shambler ×14 @0/1.7 · plated ×4 @8/6.0 · runner ×6 @14/2.6 · **juggernaut ×1 @22** | 25 |
| 6 | Pressure | shambler ×24 @0/1.1 · runner ×10 @5/2.2 · plated ×6 @12/4.5 · spitter ×3 @8/7 · howler ×2 @16/11 · sapper ×4 @20/3.5 · juggernaut ×1 @34 | 50 |
| 7 | Swollen Dead | shambler ×18 @0/1.2 · carrier ×3 @4/9 · runner ×10 @10/2.0 · plated ×6 @16/4.0 · spitter ×3 @12/8 · howler ×2 @18/10 · sapper ×4 @22/3.0 · juggernaut ×1 @30 | 47 |
| 8 | Last Stand | shambler ×30 @0/0.9 burst 2 · runner ×16 @6/1.6 · plated ×10 @10/3.2 · carrier ×5 @14/7 · spitter ×4 @12/6 · howler ×3 @18/9 · sapper ×6 @22/2.8 · juggernaut ×2 @36/20 · runner ×8 @45/0.4 burst 4 | 84 |

Difficulty still rises monotonically: 10 → 22 → 20 → 34 → 25 → 50 → 47 → 84.
The two count dips (wave 3 and wave 5) are intentional: those waves introduce a
new behaviour instead of raw volume. Health and speed multipliers are unchanged.

## Data model

Extend `EnemyDef` rather than adding one-off flags to `Zombie`:

```ts
voiceCount: number;              // groan_variants that exist in SoundBank

special?: {
  burstInto?: { id: string; count: number };
  detonateDamage?: number;       // already exists; Sapper uses it

  ranged?: {
    damage: number;
    interval: number;
    stopRange: [number, number];
    shots: number;
    windup: number;
  };

  howl?: {
    interval: number;
    firstDelay: number;
    radius: number;
    speedMul: number;
    duration: number;
    maxHowls: number;
    stopRange: [number, number];
    summon?: { id: string; count: number; maxCalls: number };
  };

  deathBlast?: { radius: number; damage: number };
};
```

- `voiceCount` replaces the hardcoded voice-variant ternary in
  `GameScene.updateAmbience`.
- `ranged` and `howl` share one hold/channel mechanic: pick a `holdZ` from the
  range on reset, stop there while `holdsLeft > 0`, channel, then advance.

## Code changes

| File | Change |
| --- | --- |
| `src/data/enemies.ts` | `voiceCount`, new `special` hooks, four definitions. |
| `src/data/waves.ts` | New groups and counts in the table above. |
| `src/entities/Zombie.ts` | `spit` / `howl` states, `holdZ`, `holdsLeft`, `holdCooldown`, `spitReady`, `howlReady`, `haste`. Small pose additions for spitting (hunch + hands to mouth) and howling (head back, arms out). |
| `src/systems/EnemyManager.ts` | `onSpit`, `onHowl`, `hasteAround(x, z, radius, mul, duration)`. |
| `src/systems/CombatSystem.ts` | `deathBlast` on kill and wall detonation; new `enemyBlast` damage source that skips fire/cryo mods; Sapper detonation audio. |
| `src/game/GameScene.ts` | Wire spit/howl callbacks, acid globs, Sapper beeps, Howler FX and the first-Spitter tip. `hitBunker` gains optional impact coordinates and an impact kind so acid uses the splash cue instead of the claw cue. |
| `src/entities/AcidGlob.ts` | New pooled screen-space acid projectile (launch, arc, impact callback). Separate from the player's 40 mm `ProjectileManager`, which damages enemies. |
| `src/rendering/ZombieArt.ts` | Four looks plus new head/torso painter cases (`spitter`, `howler`, `jugg`, `sapper`). Existing looks untouched. |
| `src/rendering/FxArt.ts` | `acid_glob` texture (24×24). |
| `src/systems/Fx.ts` | `acidCharge`, `acidSplash`, `howlRing`, `sapperBlast` wrappers using existing emitters/glow/ring pools. |
| `src/audio/SoundBank.ts` | Four voice sets and five SFX (below). |
| `docs/AUDIO_MANIFEST.md`, `docs/ASSET_MANIFEST.md` | New keys and rows. |
| `src/systems/logic.test.ts` | Data, schedule and special-hook tests. |

## Art

One look per enemy, in `ZombieArt.ts`:

- `spitter_0` — sickly yellow-green skin, bare distended torso with throat/chest
  sacs, drooling mouth, olive rags. `head: 'spitter'`, `torso: 'spitter'`.
- `howler_0` — pale blue-grey skin, thin torn shirt, gaping black throat, head
  tipped back. `head: 'howler'`, `torso: 'shirt'`, `sleeve: 'bare'`.
- `sapper_0` — pale runner build, dark clothes, yellow/black hazard vest with
  straps, wires and a red charge light. `head: 'normal'`, `torso: 'sapper'`.
- `juggernaut_0` — grey dead skin under dark welded plates, rivets, scratches,
  orange visor slit. `head: 'jugg'`, `torso: 'jugg'`, `sleeve: 'armor'`.

The `heavy` rig at 2.35 m gives the Juggernaut its size; `Zombie.updateScreen`
already derives scale from `def.height / RIG_HEIGHT[rig]`. The Spitter/Howler
read at range through colour, posture and glow rather than a new silhouette.

## Audio

New synthesized keys in `SoundBank.ts`:

| Key | Use |
| --- | --- |
| `groan_spitter_0..1` | Wet gurgle with bubbling sweeps |
| `groan_howler_0..1` | Long rising shriek, formant "ee", reverb |
| `groan_sapper_0..1` | Fast panicked breathing with a metallic click |
| `groan_juggernaut_0..1` | Very low subharmonic growl with a metal ring |
| `acid_spit` | Wet launch, downward noise sweep |
| `acid_splash` | Sizzle + low thud on the sandbags |
| `howl` | 1.4 s rising scream, reverb tail |
| `sapper_beep` | Short 2.6 kHz electronic chirp |
| `sapper_boom` | Low blast + shrapnel debris |

Existing recordings and mixer caps are unchanged. Distant voices still use the
current distance low-pass/pan path.

## Tests

Automated (`npm test`):

- Every enemy referenced by every wave exists in `ENEMIES`.
- Wave 2 contains `spitter`; wave 3 `howler`; wave 4 `sapper`; wave 5
  `juggernaut`; waves 6–8 contain all four.
- Wave counts increase overall and wave 8 is still more than 4× wave 1.
- Every definition has `looks > 0`, `voiceCount > 0`, positive health/speed, and
  a description.
- Spitter/Howler hold ranges are ordered and positive; Sapper has both
  `detonateDamage` and `deathBlast`; Juggernaut is armoured on torso/legs and has
  a head multiplier of 1.
- Existing 26 tests keep passing (economy, wave completion, aiming, weapons).

Manual in the browser:

- Wave 2: Spitter holds, glows, spits, damages the bunker; killing it stops the
  spit. No console errors.
- Wave 3: Howler howls, nearby enemies speed up, two Shamblers are summoned and
  the wave still ends only after they die.
- Wave 4: Sapper beeps, detonates at the wall, and a chain reaction can kill a
  neighbouring Sapper.
- Wave 5: Juggernaut takes visor damage, shrugs off body shots, and slams.
- Audio cues play; M1A muzzle/crosshair gap is still fixed at (0, 80).

## Delivery

- Single source of truth becomes `D:\UnseenBox-ship\fogline`; run the dev server
  and all checks there.
- Rebuild, refresh `public/arcade/fogline/`, run the website production build.
- Commit only `fogline/`, `public/arcade/fogline/` and
  `data/seed/playables.ts`; push `fogline-arcade`, merge to `main`, verify
  `/en/play/fogline` and `/arcade/fogline/index.html` live.

## Risks

- **Readability at range.** Acid charge glow, bright spit trail, Sapper beep and
  Howler ring are the tells. If the Spitter still reads poorly, enlarge the
  charge glow before changing stats.
- **Sapper chains overkill.** 60 damage / 4 m can clear a packed wall. Tune the
  radius first, then damage.
- **Howler summons extend waves.** `notifyExtraSpawned` is mandatory; the wave
  test covers the count bookkeeping.
- **Juggernaut balance.** 900 HP is a starting point. Tune health and torso
  armour after one full playtest rather than changing its speed.
- **Two working copies.** Avoid drift by developing and verifying only in the
  ship worktree from here on.
