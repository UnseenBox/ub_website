# Fogline — Bunker Defense (prototype)

An original fixed-position, first-person zombie defense shooter for desktop browsers.
You hold a sandbagged bunker; the dead walk out of the fog toward you; you shoot them
through your sights, earn cash, and spend it between waves on better guns, special
ammunition, air support and bunker defences.

The game is **genre-inspired**, not a recreation of any existing title. Its name,
enemies, art, audio, HUD layout and balance are original to this project. All
artwork and audio are generated procedurally at startup, except the M1A first-person
view model which uses the supplied `src/assets/m1a-view.png` artwork. No other
external assets are used.

## Run it

```bash
cd fogline
npm install
npm run dev        # http://localhost:5191
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Type-check and build a static bundle into `dist/` |
| `npm run build:crazygames` | CrazyGames build into `dist-crazygames/`: SDK tag, loading/gameplay events, happytime, the data module as the save, no fullscreen controls, mouse lock on desktop, black ink for blood, and new players start in the first mission. Ads stay off until `VITE_ADS=on` in `.env.crazygames` (Full Launch) |
| `npm run dev:crazygames` | Dev server in CrazyGames mode (loads the real SDK, which shows test overlays on localhost) |
| `npm run test` | Vitest unit tests for the game logic |
| `npm run typecheck` | TypeScript only |

Target resolution is 1280×720. The canvas scales to fit any window and keeps 16:9.

### Test loadout

`npm run dev` starts every run with the full arsenal — all four weapons and their ammo,
$500,000, every mod, support strike and defence at max charges, and the bunker at its
final reinforcement level. Add `?dev=0` to the URL for the normal balance. Production
builds stay normal; add `?dev=1` to opt in.

## Controls

| Input | Action |
| --- | --- |
| Mouse | Aim (the weapon follows the sight) |
| Left mouse | Fire (semi-auto: click per shot; automatic weapons: hold) |
| Right mouse / R | Reload |
| 1 2 3 4 | Weapons: M1A, M4, M249, M32 |
| 5 6 7 8 | Ammo mods: Overpressure (2× damage), Armour-Piercing, Incendiary, Cryo |
| A S D | Support: Gunship Run, Orbital Lance (on the ground under the sight), Tactical Nuke |
| W E | Bunker: Repair Crew, Blast Shutters |
| Space | Armory/shop (pauses combat) |
| Enter | Deploy the next wave |
| Esc / P | Pause menu: volumes, fullscreen, restart, quit |
| F | Fullscreen |

The HUD slots are clickable too. Shots can't pass through the HUD, and the context
menu and text selection are disabled.

## Project layout

```
src/
  main.ts                 Phaser config + scene list
  game/                   scenes (Boot, Menu, Game, Shop, Pause, GameOver), config, perspective math, depths
  data/                   ALL balance: weapons.ts, enemies.ts, waves.ts, upgrades.ts
  systems/                Economy, Bunker, Weapon, Wave, Abilities, Shop catalogue (pure, unit-tested)
                          EnemyManager, CombatSystem, SupportSystem, Fx, Battlefield (Phaser)
  entities/               Zombie (articulated rig + hit zones), WeaponView, Projectile
  rendering/              procedural painters: zombies, environment, weapons, FX, HUD
  audio/                  dsp.ts (offline synth toolkit), SoundBank.ts (every sound), AudioManager.ts (mixer)
  ui/                     HUD, buttons/sliders
docs/
  ASSET_MANIFEST.md       every texture: path, use, animation states, source, replacement status
  AUDIO_MANIFEST.md       every sound: key, use, how it is made, licence
```

Balance lives only in `src/data/*` and `src/game/config.ts` (starting cash,
wave bonus, bunker health, perspective). To add a weapon, append a `WeaponDef`, and
give it a view texture and an icon if you want custom art.

## How the perspective works

The camera is a fixed pinhole at 1.6 m eye height (`game/perspective.ts`). Every enemy
has a world position `(x, z)` in metres. Each frame it is projected to the screen, so
screen Y, scale and depth all come from the distance. Enemies spawn at 95 m inside the
fog, where they stand about 18 px tall. They converge on lanes at the 4.3 m bunker line,
where they stand over 300 px tall. Distance haze comes from five scrolling fog bands
inserted at fixed distances in the depth order, plus a tint on distant figures.

Each zombie is an 11-part camera-facing rig (head, torso, arms, hands, legs). It is
animated procedurally: idle sway while emerging, a limping shamble, a sprint, a heavy
armoured walk, a waddle, a crawl, wall-clawing attacks, hit flinches, staggers, three
death falls and a headless collapse. Hit testing uses the live skeleton: a head circle,
a torso capsule and limb capsules. Hits resolve against the closest enemy first, and
the head is checked before the body.

## Implemented mechanics

- Fixed first-person bunker view: layered sky, mountains, ruined skyline, treeline, perspective ground, props, fog bands, sandbag parapet, bunker frame and film grain
- Mouse aiming with a dynamic crosshair that sits exactly on the pointer, with the gun rotated so its barrel points at it. On phones: drag the left half to aim and use the on-screen FIRE, reload, shop, pause and deploy buttons (see `docs/PHONE_CONTROLS.md`). Spread blooms when firing, the crosshair turns orange over an enemy and red over a head, hit markers confirm hits, and a reload ring shows progress
- First-person view model: aim follow, idle sway, recoil kick, muzzle flash and light, ejected casings, a reload dip and tilt, and a drop-and-raise weapon switch
- 4 weapons, all data-driven:
  - M1A semi-auto starter with unlimited ammo
  - M4 full-auto with red dot
  - M249 belt-fed with screen shake
  - M32 lobbed 40 mm grenades with blast falloff
- Magazine and reserve ammo, reload timing, empty clicks, auto-reload when dry, and ammo packs in the shop
- Separate head, torso and leg zones. Headshots use a per-weapon multiplier, a separate impact sound, a "tink" confirm, gore, a headless death and a bonus payout
- 5 enemy types:
  - Shambler: slow, limping
  - Sprinter: fast
  - Riot Husk: armoured torso, cracked visor as weak point, ricochets unless you use AP
  - Bloater: bursts into 3 Crawlers on death and detonates against the wall
  - Crawler: low and fast
- Bunker health of 1,000 with damage flashes, a lagging damage bar, a critical warning with red vignette, repair, the shutter shield and reinforcement upgrades
- Economy: $500 start, kill rewards, headshot bonus paid once, wave bonuses paid once, no negative balances
- Act 1 campaign (`src/data/missions.ts`): nine missions on a valley map with fog that pulls back as you win. Objectives: hold the line, protect a structure in the field, escort buses across the field, and kill the Colossus boss. Each mission scores 1–3 stars and pays Supplies; first wins unlock weapons and gear for good
- Workshop: Supplies buy permanent upgrades (damage, handling, magazine, reload per weapon, plus bunker health). Loadout: carry 3 weapons and 2 support strikes; missions lend extra gear to try
- Act 2 (opens after the Colossus with 15 Act 1 stars): Spitters, Howlers, Sappers, Juggernauts, The Choir boss; fog nests to shoot apart, supply crates to shoot down, night missions with flares (Q); M82 .50 and flamethrower
- Act 3 (opens after the Choir with 33 stars): the quarry, the rail yard and Meridian Station; Fogborn and Ravagers; a door-gunner mission from Kestrel's helicopter; The Heart of the Fog boss and an ending; M3 rocket launcher and XR-9 railgun
- Act 4 "The Fog Returns" (opens after the Heart with 55 stars): Saltmarsh harbour, Gull Point and Fort Ashby; Lurkers (come up near the wire) and Sporelings (burst into vision-blocking clouds); storm missions with rain and lightning; The Bloom, a boss shielded by spore pods; a second ending
- Veteran: replay any won mission on Veteran (tougher, bigger waves, ×1.5 Supplies) for a ✪ medal; nine medals unlock the Obsidian skin
- TC-3 Tesla gun (chain lightning) and a sixth recruit, Vesna, a mortar crew that shells the far field
- Attachments (Workshop, after Act 3 mission 2): extended mag, hollow points, compensator or speed loader, bought once, one fitted per weapon
- Contested nodes: two won missions a day re-fog on the map and pay +60% Supplies when retaken
- Playtest numbers: F9 on the map shows starts, wins, fail rate and minutes per mission for this save
- Squad (Barracks): Dot repairs, Mara snipes far threats, Brick guards the wire, Kestrel strafes a lane, Rook lobs grenades; two at the side windows, trained with Supplies
- Focus (SHIFT, or tap the bar): five seconds of slowed time, filled by kills; kill streaks raise cash ×1.25/1.5/2 until the bunker is hit
- HQ (map button or H, opens with Act 1 mission 5): daily supply drop (7-day calendar, one missed day forgiven), three daily contracts (one swap a day), Supply Depot that fills while away (upgradeable), Field Notes (enemy codex paid at 10/100/500 kills)
- Fog Surge (after mission 7): one generated mission a day with two modifiers (night, drops, horde, quickened, hardened, bounty, thin walls); big reward for the first win, best score kept
- Last Stand (after Act 1): endless waves at the farm, Supplies per wave and one-time milestones at waves 5–30
- Weapon mastery: kills with a gun unlock Desert, Winter, Fogline and Gold skins (Workshop); day 7 of the drop gives Crimson
- Ammo mods with charges and timed activation, each with clear HUD indicators and hit effects
- Support strikes:
  - Gunship: flies in, strafes and chain-guns enemies, with rotor loop audio
  - Orbital Lance: lock reticle, beam, then a big blast
  - Tactical Nuke: siren, white flash, mushroom cloud, kills everything on the field
- Armory overlay that pauses combat, shows why an item can't be bought, gives purchase feedback, and lets you deploy the next wave from inside it
- Pause on Esc or when the window loses focus. Master, SFX and music volume (saved), and fullscreen
- Audio: gunshots, reloads, kill cues and menu hover/click use the supplied recordings; the remaining sounds are synthesized. There is a compressor bus, per-family voice limits, distance muffling and panning, ambient horde groans, wind and a drone bed, all unlocked on the first click

## Known limitations and temporary assets

- **Most art is procedural placeholder art.** It is deliberately painted at the correct perspective, scale and palette, but it is not hand-illustrated. Zombies are rigs of flat painted parts, not frame-by-frame sprite animation. The M1A first-person view model uses a supplied bitmap (`view_service_photo` / `src/assets/m1a-view.png`) instead of its procedural render; the other weapons and assets remain procedural. Each asset is isolated behind a texture key so it can be swapped (see `docs/ASSET_MANIFEST.md`).
- **Audio is a mix.** The supplied gun, reload, kill, headshot and menu recordings replace those keys at runtime; all other sounds are synthesized. Any key can also be replaced through `AudioManager.registerOverride`.
- There is no lateral movement of enemies around props, and no flanking. Zombies converge on the bunker line and keep their spacing with a simple separation pass.
- Blood and dust use one shared particle depth, so spray from a far enemy can briefly draw over a nearer one.
- There is no save of mid-run progress. Only settings and best wave/kills persist.
- The 8-wave balance comes from scripted playthroughs (see the test report), not from long human play sessions. Tune it in `src/data/waves.ts` and `config.ts`.
- `window.__game`, `window.__fogline` and `window.__audio` are exposed as test hooks.

## Test report (what was actually run)

Automated:
- `npm run test`: 23 Vitest cases over perspective inversion, economy, damage rules (headshot, armour, AP, 2×, blast falloff, single payout), bunker shield and destroy-once, weapon fire rates and reloads, wave schedules (exactly-once bonus, crawler bursts keeping the wave open, escalating composition), shop purchases and caps, abilities, and early-game affordability of the M4.
- `npm run build`: type-check and production bundle succeed.

In-browser playtest at 1280×720. The browser pane was hidden, so it throttled frames. The game loop was stepped by script; DEPLOY, Space, 2, 6, A, Enter and the shop card were real clicks and keypresses.
1. The menu loads. DEPLOY starts a run and unlocks Web Audio.
2. Wave 1 starts after the countdown and Shamblers emerge at 95 m and walk in.
3. Aimed at a head and fired: one-shot kill, `HEADSHOT +$35`, cash $500 → $535, headless death.
4. Body shot: 38 damage, no payout until the kill.
5. A Shambler reached the wall: bunker 1000 → 988, with bunker-impact sounds.
6. Wave 1 cleared (10/10 headshots). The completion bonus of $275 was paid once, for $1,125 total.
7. Space opened the armory and paused combat. Clicking the M4 bought it: $1,125 → $25. A second click was refused ("OWNED") with no charge.
8. Space closed the armory. Key 2 switched to the M4. Holding fire for 1 s fired 12 rounds (11 rds/s) using `shot_m4`, while the M1A uses `shot_service`.
9. Key 6 activated Armour-Piercing (HUD timer shown). Key A called the gunship, which killed 12 zombies in 5 s with its rotor loop and chain-gun audio.
10. Orbital Lance on a 5-zombie cluster killed all 5. Repair took the bunker 588 → 888. Shutters blocked 50 damage and raised the cover line.
11. Enter deployed wave 2. Sampled schedules for waves 3–8 show the planned escalation.
12. Riot Husk: a torso shot without AP did 9.5 damage with a ricochet, with AP 38, and a headshot 114. A Bloater killed far out spawned 3 Crawlers. A Bloater at the wall detonated for 160 damage.
13. M32 grenade into a 4-zombie pack killed all 4. Nuke: 14 on the field went to 0 and paid normal kill rewards.
14. Defeat: the bunker reached 0, BUNKER OVERRUN showed with stats, and Enter redeployed a clean run ($500, 1000 health, starter rifle only). Victory: THE LINE HELD screen shown.
15. Stress test: 70 zombies of mixed types plus continuous M249 fire took about 5–6 ms per frame (update and render).

Not verified by ear: the tests confirm which sound plays and when, but not how it sounds through speakers.
