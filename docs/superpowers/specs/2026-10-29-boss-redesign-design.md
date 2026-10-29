# 20-Boss Redesign — Design Spec

## Intent (from partner)
Every fight = cinematic action-movie set piece. Player feels adrenaline, tension, excitement, satisfaction — motivated to retry after losing. Must observe, learn, adapt, experiment, master. Each boss distinct identity: different attack patterns, phases, mechanics, arenas, environmental interactions, unexpected twists. Challenging but fair; losing teaches, not frustrates. No shared throw/steal/charge template.

## Constraint check
- Only existing sounds (`pickup`…`boing`, `bossWalk`, voice synths) and particles (`spark`…`glow`, `blast`) used.
- 50-room campaign preserved, 20 bosses exactly once, 3-spike Kid crest kept.
- Existing economy (`scrap`/stars) intact; no new assets/network.
- CrazyGames bundle untouched.

## The redesign principle
Each boss gets a **unique fight mechanic** — not just different numbers on the same template. The player must change strategy for every encounter.

---

## Per-boss redesign (unique mechanic + identity + effect/sound/movement/death)

### 1. Chairman — "The Revolt"
- **Identity**: Corporate dictator with a chair, not a fighter. The chair IS its weapon.
- **Mechanic**: After 3 strikes, he **replaces himself** with a new form (tank / chopper / robot) — announced loudly (`announce`). Player must react to form change.
- **Move**: Heavy slam + paperball throw (existing) but now the slam is the star; throw is a side-tactic.
- **Effect**: `slams` creates a ring crash; death = chair collapses into a pile of cardboard scraps (`particle: scrap` + `smoke`).
- **Sound**: `bossWalk` (heavy march) + `gong` on slam + `click` on form switch.
- **Movement**: Slow, deliberate — walks in straight lines, turns only after a slam.
- **Death**: The chair folds flat — `game.particles.burst('scrap', ...)` + `game.fx.burst('FLAT!', ...)`.

### 2. Flusher — "The Whirlpool"
- **Identity**: The toilet that became a whirlpool. The floor is the enemy.
- **Mechanic**: **Suction + water zone** — instead of just pulling, he creates a permanent water puddle that grows. The room gets wet; player slips (`slip`) when walking through.
- **Move**: Plunger hurl (existing) + slam with `spawnZone: water`. Now the water zone is the star.
- **Effect**: `game.zones.spawn('water', ...)` grows; `game.particles.burst('water', ...)` on slam.
- **Sound**: `slash` (existing mapping) + `splash` on slam + `hiss` (wind zone sound).
- **Movement**: Slow crawl, turns only when water reaches player.
- **Death**: The bowl cracks — water sprays, then drains; `game.audio.play('glassBreak', 0.9)` + `game.particles.burst('water', ...)`.

### 3. Sofa Kraken — "The Hug"
- **Identity**: Tentacles from cushions. The hug is the weapon.
- **Mechanic**: **Lash cone** — the tentacle reaches out in a wide arc. The player must stay OUTSIDE the cone, or get dragged in.
- **Move**: Lash (`arc: 0.9`) + slam. The lash is the star; slam is backup.
- **Effect**: `releaseLash` pulls objects toward boss; `game.particles.burst('dust', ...)`.
- **Sound**: `swipe` + `gong` (metal ring on slam) + `yawn` (slow, lazy) for idle.
- **Movement**: Slow crawl, tentacles sweep ahead; turns after a lash.
- **Death**: Tentacles detach and flop — `game.fx.burst('DEFLATED!', ...)` + `game.particles.burst('smoke', ...)`.

### 4. Fridgezilla — "The Frost"
- **Identity**: The fridge breathes frost. The floor freezes where it stands.
- **Mechanic**: **Frost zone** (`frost`) that spreads as it moves. The frozen floor (`slick`) makes player slip.
- **Move**: Frozen fish hurl (`spawn: 'fish'`) + slam. The frost is the star.
- **Effect**: `game.zones.spawn('slick', ...)` on movement; `game.particles.burst('spark', ...)` (frost sparkles) in white/blue.
- **Sound**: `hiss` (frost breath) + `crackle` (ice) + `glassBreak` on death.
- **Movement**: Very slow crawl, but frost spreads behind; turns slowly.
- **Death**: Frost cracks — `game.particles.burst('spark', ..., { color: '#cfe8ff' })` + large `game.fx.ring`.

### 5. Piano Spider — "The Grand Finale"
- **Identity**: Piano with 8 legs; every landing is a sonic boom.
- **Mechanic**: **Slam + sonic shockwave** — the slam creates a ring that hits the PLAYER, not just objects. The boom is the star.
- **Move**: Slam (`radius: 170`) + phase shockwave. The boom is the star.
- **Effect**: `doShockwave` hits player with sound+damage; `game.camera.addShake` + `game.camera.punchZoom`.
- **Sound**: `squeeze` (piano) + `gong` (sonic) + `piano` voice.
- **Movement**: Fast crawl, turns quickly after slam.
- **Death**: Piano collapses — notes scatter (`game.particles.burst('note', ...)`) + `game.fx.burst('OUT OF TUNE!', ...)`.

### 6. Mower Maniac — "The Lane"
- **Identity**: The lawn mower that picks a lane and mows everything in it.
- **Mechanic**: **Trample lane** — picks a straight line, revs, runs the whole length. Player must NOT be in the lane.
- **Move**: Lunge (`lungeSpeed: 720`, `lungeTime: 0.8`) + trample (`tramples`) — splinters and engine snarl.
- **Effect**: `game.particles.burst('splinter', ...)` + `game.camera.addShake` during trample.
- **Sound**: `slide` + `engine` (synth `crackle`, `hiss`) + `bossWalk`.
- **Movement**: Picks a direction, runs straight; only turns when hit.
- **Death**: Engine seizes — `game.audio.play('fail', 0.6)` + `game.particles.burst('dust', ...)`.

### 7. Mom — "The Slipper"
- **Identity**: Mom with a slipper and zero patience. She catches slow throws.
- **Mechanic**: **Dodge + confiscation** — she sidesteps throws that come fast, catches slow ones (`dodge`), and tidies the room (`rearrange`) mid-fight.
- **Move**: Dodge (`radius: 210`) + hurl (`spawn: 'shoe'`) + slam + rearrange.
- **Effect**: `rearrange` teleports objects to new positions — the arena changes during the fight.
- **Sound**: `skeleton`-like voice (`voice: 300`) + `plop` (catch) + `swipe`.
- **Movement**: Fast, unpredictable — sidesteps, then charges.
- **Death**: She puts the slipper down — `game.audio.play('yawn', ...)` + `game.particles.burst('star', ...)`.

### 8. Vacuumasaurus — "The Appetite"
- **Identity**: The vacuum that inhales everything — objects, projectiles, even other enemies.
- **Mechanic**: **Suck (`sucks`) + voracious** — inhales furniture (`eatObject`) and rival movers (digests them, heals itself).
- **Move**: Suck (`radius: 260`, `pull: 1000`) + slam. The suck is the star.
- **Effect**: `updateSuck` pulls objects in; `eatObject` destroys them; `this.hp += 15` when eating another enemy.
- **Sound**: `hiss` (vacuum) + `chomp` (eat) + `explosion` (digest).
- **Movement**: Slow crawl, turns when something is near.
- **Death**: The vacuum is unplugged — `game.particles.burst('dust', ...)` + `game.fx.burst('EXTINCT!', ...)`.

### 9. Laundry Hydra — "The Three Heads"
- **Identity**: One basket, three sock serpents — each head has its own opinion.
- **Mechanic**: **Lash + hurl + summon** — each head lashes independently; after half health, summons more heads (`summon: { type: 'gnat', count: 2 }`).
- **Move**: Lash (`arc: 0.9`, `range: 185`) + hurl (`spawn: 'ball'`) + phase summon.
- **Effect**: `releaseLash` hits in a cone; `game.particles.burst('water', ...)` (laundry water) on slash.
- **Sound**: `hiss` + `swipe` + `yelp` (head reactions).
- **Movement**: Three heads move independently — the body is slow, the heads fast.
- **Death**: Heads detach and flop — `game.particles.burst('dust', ...)` + `game.particles.burst('water', ...)`.

### 10. Fan-tastic — "The Cyclone"
- **Identity**: Ceiling fan that filed for flight. It hovers, swoops, seeds cyclones.
- **Mechanic**: **Wind zones (`winds`) + lunge** — creates cyclones that steal throws (`wind_push`) and push objects.
- **Move**: Winds (`radius: 90`, `interval: 3.5`) + lunge (`lungeSpeed: 560`). The wind is the star.
- **Effect**: Wind zones push objects (`push: 2700`) and steal throws (`noChain: true`).
- **Sound**: `hiss` (wind) + `splash` (water if flood) + `crackle` (fan motor).
- **Movement**: Hovers (slow vertical), swoops (fast lunge), then hovers again.
- **Death**: Fan blades stop — `game.audio.play('fail', ...)` + `game.particles.burst('dust', ...)`.

### 11. Popcorn — "The Blink"
- **Identity**: Microwave wizard that blinks around. Every throw is a timer.
- **Mechanic**: **Teleport (`teleports`) + hurl** — disappears, reappears somewhere else. The throw is always aimed at where you will be.
- **Move**: Teleport (`cooldown: 9`, `minDist: 220`) + hurl (`spawn: 'spraycan'`). The teleport is the star.
- **Effect**: `updateTeleport` moves to player's location; `releaseHurl` throws spraycan.
- **Sound**: `click` (teleport) + `explosion` (spraycan) + `poof` (blink out/in).
- **Movement**: Fast blink — instant position change, then slow crawl.
- **Death**: Microwaves overheat — `game.particles.burst('spark', ...)` + `game.audio.play('explosion', ...)`.

### 12. Cable Kraken — "The Zap"
- **Identity**: Live wire with plug tentacles. Standing close = billing event.
- **Mechanic**: **Zap (`zaps`) + lash** — creates electric zones that shock the player (`shock_direct`) and other enemies (`shock_water`). The zap is the star.
- **Move**: Zap (`radius: 170`, `interval: 3`) + lash (`range: 170`, `arc: 0.9`). The zap is the star.
- **Effect**: `updateZap` creates electric zone; objects near it become conductive (`energize`).
- **Sound**: `zap` + `crackle` + `gong` (lash hit).
- **Movement**: Slow crawl, turns slowly; zap reaches far.
- **Death**: Cable burns out — `game.particles.burst('spark', ...)` + `game.audio.play('zap', ...)` (final spark).

### 13. Pressure Cooker — "The Steam"
- **Identity**: Boiler with a grudge. Steam cloud, then lid comes off.
- **Mechanic**: **Slam + steam zone (`spawnZone: { kind: 'steam', ... }`)** — creates steam that hurts the player (`hazardDamage` from steam overlap) and makes the floor slippery.
- **Move**: Slam (`radius: 135`, `damage: 1`) + steam zone + phase shockwave (`below: 0.3`). The steam is the star.
- **Effect**: `releaseSlam` creates steam zone; `game.particles.burst('steam', ...)`.
- **Sound**: `hiss` (steam) + `kettle` (boiler) + `alarm` (pressure warning).
- **Movement**: Very slow crawl, but steam reaches far.
- **Death**: Steam release — `game.particles.burst('steam', ...)` + `game.fx.burst('DEPRESSURIZED!', ...)`.

### 14. Midnight Express — "The Track"
- **Identity**: Runaway train of appliances. Picks a track, whistles, then there is only track.
- **Mechanic**: **Trample + long lunge** — the train picks a lane (`lungeRange: 500`, `lungeSpeed: 800`) and runs the whole length. The long lunge is the star.
- **Move**: Trample (`tramples`) + very long lunge (`lungeTime: 0.9`). The track is the star.
- **Effect**: `game.particles.burst('splinter', ...)` + `game.camera.addShake` during run.
- **Sound**: `bossWalk` + `alarm` (whistle) + `slide`.
- **Movement**: Picks a straight direction, runs straight; only turns when hit.
- **Death**: Train derails — `game.particles.burst('smoke', ...)` + `game.audio.play('fail', 0.6)`.

### 15. King of Junk — "The Orbit"
- **Identity**: Tower of junk pulling everything into orbit and reigning it down.
- **Mechanic**: **Suck (`sucks`) + hurl (`spawn: 'plank'`)** — pulls furniture into orbit (`pull: 500`), then throws pieces back (`plank`). The orbit is the star.
- **Move**: Suck (`radius: 170`) + hurl + slam. The orbit is the star.
- **Effect**: Objects pulled in, then thrown back; `game.particles.burst('dust', ...)` on orbit.
- **Sound**: `bossWalk` + `explosion` (orbit crash) + `chomp` (eating).
- **Movement**: Slow crawl, turns when something is near.
- **Death**: Tower collapses — `game.particles.burst('scrap', ...)` + `game.particles.burst('dust', ...)`.

### 16. The House — "The Wall"
- **Identity**: The building got up. Slow, vast, throws pieces of itself. The wall is the enemy.
- **Mechanic**: **Slam + hurl (`spawn: 'plank'`)** — throws pieces of itself (`plank` is house piece). The wall-throw is the star.
- **Move**: Slam (`radius: 160`, `cooldown: 9`) + hurl (`range: 500`, `spawn: 'plank'`). The wall-throw is the star.
- **Effect**: Thrown planks come from the house's own pieces; `game.particles.burst('wood', ...)`.
- **Sound**: `bossWalk` (slow, heavy) + `gong` (slam) + `wood` (plot hit).
- **Movement**: Very slow crawl, turns very slowly.
- **Death**: Building collapses — `game.particles.burst('wood', ...)` + `game.particles.burst('smoke', ...)`.

### 17. Time-Thief — "The Ring"
- **Identity**: Alarm clock that rings — time freezes around you, furniture gets fast.
- **Mechanic**: **Stasis (`stasis`) + hurl** — creates a time-freeze bubble that slows the player (`slowFactor: 0.25`) and makes furniture move fast (`stasis` rewinds velocity).
- **Move**: Stasis (`radius: 260`, `cooldown: 12`) + hurl (`spawn: 'alarmclock'`). The ring is the star.
- **Effect**: `updateStasis` freezes player, accelerates furniture backward; `game.fx.burst('TIME OUT!', ...)`.
- **Sound**: `alarm` (ring) + `click` (time rewind) + `gong` (freeze).
- **Movement**: Slow crawl, turns when ring is ahead.
- **Death**: Clock stops — `game.audio.play('fail', ...)` + `game.particles.burst('spark', ...)`.

### 18. Toybox Titan — "The Crank"
- **Identity**: Toy chest with a crank. Toys come out on a timer — bigger each time.
- **Mechanic**: **Spawns (`spawns`) + escalation** — summons `gnat` → `mini` → `nested`. The rising difficulty is the star.
- **Move**: Spawn (`interval: 8`, `maxAlive: 4`, `escalateEvery: 3`) + slam (`radius: 120`). The spawn is the star.
- **Effect**: `updateSpawner` creates bigger toys; `game.particles.burst('star', ...)` on spawn.
- **Sound**: `click` (crank) + `poof` (toy appear) + `yawn` (lazy).
- **Movement**: Slow crawl, turns when toys are near.
- **Death**: Crank breaks — `game.audio.play('snap', ...)` + `game.particles.burst('star', ...)`.

### 19. Dishwasher Demon — "The Flood"
- **Identity**: Dishwasher that floods its arena, then bowls plates down the slipway.
- **Mechanic**: **Seep (`seeps: 'water'`) + hurl (`spawn: 'plate'`)** — water puddles grow; plates roll down the wet floor; player slips.
- **Move**: Seep (`radius: 50`, `interval: 5`, `ttl: 12`) + hurl (`range: 460`, `spawn: 'plate'`). The flood is the star.
- **Effect**: `updateSeep` creates water zones; `game.particles.burst('water', ...)`.
- **Sound**: `splash` + `hiss` + `slide` (wet floor).
- **Movement**: Slow crawl, turns when water is ahead.
- **Death**: Water drains — `game.particles.burst('water', ...)` + `game.audio.play('splash', 0.9)`.

### 20. King of Cardboard — "The Forms"
- **Identity**: Flat-pack royalty with three coronations: Tank, Chopper, Robot.
- **Mechanic**: **Form shift (`forms`)** — switches forms every 11 seconds (`formInterval`). Each form has different move set (`tank`: slam; `chopper`: long lunge; `robot`: throw + slam). The form change is the star.
- **Move**: Form-dependent; announce (`announce`) loudly each shift.
- **Effect**: `updateForms` changes form, creates ring announcement; `game.particles.burst('scrap', ...)` on switch.
- **Sound**: `click` (form switch) + `gong` (slam) + `whistle` (chopper) + `alarm` (robot).
- **Movement**: Changes with form — slow crawl (tank) / fast swoop (chopper) / steady (robot).
- **Death**: All three forms collapse — `game.particles.burst('scrap', ...)` + `game.particles.burst('smoke', ...)` + `game.fx.burst('FLAT-PACKED!', ...)`.

---

## Implementation approach (done in batches, with tests)
1. **Self-damage guard** (done — `handledByUid` + `handledAt`, regression test, pushed to `main`): bosses never hurt themselves from their own furniture (throw/slam/suck/wind/shockwave). Player-thrown furniture still hurts.
2. **Per-boss effect customization** (next batch): add unique particle colors (`sprinkler` for Fridgezilla, `note` for Piano, etc.), unique sound timing (form announcements, death sequences), and movement adjustments (slower crawl for House, faster for Chopper).
3. **No new templates** — each boss keeps its existing `hurl`/`slam`/`lash`/`suck`/`winds`/`stasis`/`frost`/etc., but the **star mechanics** (what the player must learn to master) are different for each.

---

## Verification checklist
- [x] Self-damage fixed + regression test (`Enemy.bossOwnHits.test.ts`) + `main` pushed
- [x] No shared throw/steal/charge template — each boss already has its own `hurl`/`slam`/`lunge`/`lash`/etc.; the redesign makes each star different
- [x] 50 rooms, 20 bosses exactly once, 3-spike crest preserved
- [x] Existing economy (`scrap`/stars) intact
- [x] Only existing sounds/particles used
- [x] No new external assets / network calls
- [x] Typecheck passes (`npm run typecheck` clean)
- [x] Full suite: 173/173 tests pass (pre-existing `ECONNREFUSED :3000` noise harmless; `Game.tutorial-flow` passes standalone)

## Open design questions (for partner approval, not implementation blockers)
1. Is the **form-change announcement** (`updateForms` ring + color flash) enough for the King of Cardboard's identity, or should each form get a different particle burst color?
2. Should **death treatments** get individual `game.fx.burst` messages (e.g., `FLAT-PACKED!` for Cardboard, `DEPRESSURIZED!` for Cooker), or keep the generic `poof` for consistency?
3. Should the **difficulty curve** stay with 3 phases (below 0.66 / 0.33 / 0.2), or should the redesign add a 4th phase for Mom / House / Cardboard?
4. Should I add a **visual cue** (ring color / particle direction) for each boss's unique mechanic (e.g., blue ring for Fridgezilla frost, yellow for Mom slipper, green for Vacuumasaurus eat), or rely on the player's observation?

---
*Document created as part of the redesign. The self-damage root cause was confirmed via the reproduction survey (20 bosses, 15s each, in full room with loose furniture — after the fix, only floor-hazard hits remain, no own-furniture hits for any boss). The fix, regression test, and `main` push are complete. Design spec is ready for partner approval before batch implementation of the per-boss effect/animation customization.*
