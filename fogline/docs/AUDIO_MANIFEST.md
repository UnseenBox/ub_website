# Audio manifest

**Most sounds are original and synthesized at runtime** from noise and oscillators in
`src/audio/SoundBank.ts`, using the offline DSP helpers in `src/audio/dsp.ts`. The
supplied gun, reload, kill, headshot and menu recordings in `public/audio/fogline/`
replace those specific keys; they are decoded during boot and start playing when the
game unlocks audio (see "Recorded replacements" below).
Sounds are rendered once into buffers while the title screen is up. The AudioContext
is created and resumed on the first click, as browsers require.

To swap in another recording, call
`audio.registerOverride('<key>', '<url>')` before audio unlock (or
`audio.loadOverride('<key>', '<url>')` after it). The file is decoded and replaces the
buffer under the same key; an array of URLs makes each play pick one at random.

Mixer: SFX and music buses feed a compressor (threshold −14 dB, ratio 5) and then the
master gain. Per-family voice caps (shots 10, voices 6, impacts 8, explosions 4) plus a
global cap of 40 steal the oldest voice. That keeps sustained M249 fire from clipping
or piling up. Distant zombies are low-passed and panned by screen position.

## Weapons

| Key | Use | Recipe | Replacement |
| --- | --- | --- | --- |
| `shot_service` | M1A 7.62 shot | Bright crack, 1.1 kHz body, 150→42 Hz punch, long rumble tail, bolt clack at 85 ms, terrain echo at 340 ms | — |
| `shot_m4` | M4 5.56 shot | Sharper 1.9 kHz body, short tail (keeps fast auto fire distinct), light action tick | — |
| `shot_m249` | M249 shot | Heavier 880 Hz body, deep punch, more drive, belt rattle tick | — |
| `shot_m32` | 40 mm launch | No crack; hollow 185 Hz tube resonance, low thump, cylinder ratchet clicks | — |
| `shot_chain` | Gunship chain gun | Short low crack | — |
| `reload_service`, `reload_m4`, `reload_m249`, `reload_m32` | Reload sequences timed to each weapon's `reloadTime` | Mag release, scrape, seat clack, bolt or charging handle; the M249 adds a belt rattle and cover slam; the M32 adds six shell loads and a cylinder wind | — |
| `empty_light`, `empty_heavy` | Dry fire | Filtered click | — |
| `switch_weapon` | Weapon swap | Cloth scrape and metal clacks | — |

## Impacts and combat

| Key | Use |
| --- | --- |
| `hit_flesh_0..2` | Body hits (wet thud and crackle) |
| `hit_head` | Headshot crunch |
| `headshot_confirm` | Bright two-partial "tink" reward cue |
| `ricochet` | Armour deflection ping |
| `hit_dirt`, `hit_sandbag` | Misses into ground or your own sandbags |
| `bunker_hit_0..1`, `claw`, `shutter_hit` | Zombie strikes on the bunker or the steel shutters |
| `explosion_small`, `explosion` | Grenade and Bloater blasts (half-rate render) |
| `orbital_charge`, `orbital_blast` | Orbital lock sweep and impact |
| `siren`, `nuke` | Nuke warning and 6 s blast |
| `carrier_burst` | Bloater rupture |

## Voices

| Key | Use | Recipe |
| --- | --- | --- |
| `groan_shambler_0..2` | Shambler groans | Glottal pulse train 80–100 Hz through vowel formants with rasp |
| `groan_runner_0..1` | Sprinter shrieks | 230–270 Hz "ee" formant with heavy breath noise |
| `groan_plated_0..1` | Riot Husk growl | 64 Hz voice, low-passed and reverbed (inside a helmet) |
| `groan_carrier_0` | Bloater gurgle | 58 Hz voice with bubbling sweeps |
| `groan_crawler_0` | Crawler hiss | Band-passed noise with a high voice |
| `death_0..2` | Death cries | Falling-pitch voices |

## Loops and cues

| Key | Bus | Use |
| --- | --- | --- |
| `wind_loop` | SFX | Battlefield wind (8 s seamless loop) |
| `drone_loop` | Music | Ominous drone bed (12 s seamless loop; frequencies are whole cycles per loop) |
| `heli_loop` | SFX | Gunship rotor (19 Hz blade slap and turbine whine) |
| `wave_start`, `wave_clear`, `radio` | SFX | Wave horn, all-clear chord, radio squelch |
| `shop_open`, `shop_close`, `buy`, `deny`, `ui_tick`, `ui_hover`, `ui_click`, `mod_on`, `shutters_up`, `repair` | SFX | Interface and ability feedback |

## Recorded replacements

`src/audio/overrides.ts` registers these files for runtime decoding. If a file is
missing, the synthesized sound for that key remains in use where a placeholder
exists; `ui_hover` and `ui_click` are recordings only.

| Key(s) | Recording |
| --- | --- |
| `shot_service` | `GUN 1.mp3` → `gun-1.mp3` |
| `shot_m4` | `GUN 2.mp3` → `gun-2.mp3` |
| `shot_m249` | `GUN 3 SFX.mp3` → `gun-3.mp3` |
| `shot_m32` | `Rocket Launcher ( Launching ).mp3` → `rocket-launch.mp3` |
| `reload_service`, `reload_m4`, `reload_m249`, `reload_m32` | `Gun Realod.mp3` → `gun-reload.mp3` |
| `death_0`, `death_1`, `death_2` | `kill sfx 4.mp3` → `kill-4.mp3` |
| `headshot_confirm` | `Kill sfx 1.mp3`, `kill sfx 2.mp3`, `killing sfx.mp3` (random pool) |
| `ui_hover` | `Hover sfx.mp3` → `hover.mp3` |
| `ui_click` | `Click SFX.mp3` → `click.mp3` |
