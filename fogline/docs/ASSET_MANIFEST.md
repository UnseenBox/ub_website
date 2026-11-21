# Asset manifest

Every visual asset is **original and procedurally generated** at boot by the painters
in `src/rendering/`, except the supplied bitmaps loaded in `BootScene`: the M1A
first-person view model (`src/assets/m1a-view.png` → `view_service_photo`) and the
main-menu background (`src/assets/main-menu.png` → `menu_bg`). No other third-party
art is used. To replace one, load an image under the same texture key in `BootScene`
after the painters run (or remove the painter call). Keep the listed dimensions and
pivots so perspective scaling stays correct.

Status legend: **P** = procedural placeholder (final-quality slot, replace with illustrated art when available).

## Menu

| Key | Size | Use | Source | Status |
| --- | --- | --- | --- | --- |
| `menu_bg` | 16:9 (1280×720 displayed) | Full-screen title-screen background | supplied `Main Menu.png` → `src/assets/main-menu.png` | supplied |
| `menu_buttons` (`btn_deploy`, `btn_fullscreen`, `btn_patch`) | 1536×1024 sheet | DEPLOY and FULLSCREEN title-screen buttons | supplied `Post-Apocalyptic Military Menu Buttons.png` → `src/assets/menu-buttons.png` | supplied |

## Battlefield (`rendering/EnvironmentArt.ts`)

| Key | Size | Use | States | Source | Status |
| --- | --- | --- | --- | --- | --- |
| `backdrop` | 1280×272 | Overcast sky, two mountain ranges, ruined skyline, radio mast, dead-pine treeline, horizon haze | static | procedural | P |
| `clouds` | 1280×190 | Tileable cloud layer, scrolls slowly | scroll | procedural | P |
| `ground` | 1280×472 | Perspective ground: mud/grass mottling, cracked road with centre line, stones, tufts, puddles, craters, old blood | static | procedural | P |
| `fog_tile` | 512×96 | Tileable fog noise used by 5 depth-sorted fog bands | scroll | procedural | P |
| `tree_0..2` | 260×330 | Dead trees placed in world space (pivot bottom-centre) | static | procedural | P |
| `pole`, `car`, `hedgehog`, `barrier`, `barrel`, `wire_coil` | various | World props (telephone pole, burned car, tank trap, jersey barrier, burning barrel, concertina wire) | static (+fire particles on barrel) | procedural | P |
| `parapet` | 1280×224 | Foreground sandbag wall with barbed wire, ammo crate and radio. It blocks shots below `VIEW.wallTop` | static | procedural | P |
| `shutters` | 1280×170 | Blast-shutter steel plates (E ability) | rise/lower | procedural | P |
| `frame` | 1280×720 | Bunker concrete lip, side walls and vignette | static | procedural | P |
| `grain` | 256×256 | Film-grain noise overlay | jitter | procedural | P |

## Enemies (`rendering/ZombieArt.ts` → atlas `zombie_atlas`, 1024×1024)

Each look provides `<look>_head`, `_torso`, `_upperArm`, `_foreArm`, `_hand`, `_thigh` and `_shin`
frames, plus a shared `shadow`. Pivots and lengths are in `PART` and `LEN`. The rig in
`entities/Zombie.ts` animates the parts. Left-side limbs reuse the right-side frame, flipped.

| Look | Enemy | Variants | Animation states (rig-driven) | Status |
| --- | --- | --- | --- | --- |
| `shambler_0..2` | Shambler | white tee / dark jacket / flannel | emerge-idle, limping walk, reach, claw attack, flinch, stagger, death ×3, headless collapse, fade-out | P |
| `runner_0..1` | Sprinter | hoodie / tank top, screaming head | sprint (pumping arms), frantic claw, flinch, deaths | P |
| `plated_0..1` | Riot Husk | riot armour, cracked visor helmet | heavy walk, pound attack, ricochet flash, deaths | P |
| `carrier_0` | Bloater | swollen body, sores, pustules | waddle with breathing belly, detonation, burst | P |
| `crawler_0` | Crawler | legless torso | crawl, swipe, death | P |

## Weapons (`rendering/WeaponArt.ts`)

| Key | Size | Use | Status |
| --- | --- | --- | --- |
| `view_service_photo` | 1280×720 | M1A first-person view model (supplied bitmap in `src/assets/m1a-view.png`, transparent, pivot bottom-centre). Replaces the procedural `view_service` render for the service rifle; `view_service` is still generated but unused. | supplied |
| `view_m4`, `view_m249`, `view_m32` | 300×400 | First-person view models with a gloved support hand, drawn muzzle-up (pivot bottom-centre) | P |
| `icon_service`, `icon_m4`, `icon_m249`, `icon_m32` | 128×48 | Side-profile HUD and shop icons | P |
| `icon_mod_*`, `icon_gunship`, `icon_orbital`, `icon_nuke`, `icon_repair`, `icon_wall`, `icon_reinforce` | 48×48 | HUD and shop icons | P |

## Audio (`public/audio/fogline`)

| File | Source | Use | Status |
| --- | --- | --- | --- |
| `gun-1.mp3` | supplied `GUN 1.mp3` | M1A shot | Final |
| `gun-2.mp3` | supplied `GUN 2.mp3` | M4 shot | Final |
| `gun-3.mp3` | supplied `GUN 3 SFX.mp3` | M249 shot | Final |
| `rocket-launch.mp3` | supplied `Rocket Launcher ( Launching ).mp3` | M32 launch | Final |
| `rocket-explosion.mp3` | supplied `Rocket Launcher ( Explosion ).mp3` | M32 impact | Final |
| `metal-shield.mp3` | supplied `Metal Shield.mp3` | Blast Shutters activation | Final |
| `nuc-explosion.mp3` | supplied `Nuc Explosion sfx.mp3` | Tactical Nuke detonation | Final |
| `satellite-beam.mp3` | supplied `Satelite Beam SFX.mp3` | Orbital Lance call-in | Final |
| `gun-reload.mp3`, `kill-*.mp3`, `killing.mp3`, `hover.mp3`, `click.mp3` | supplied | Reload, kills, headshot, UI | Final |

## Effects (`rendering/FxArt.ts`) and HUD (`rendering/HudArt.ts`)

| Key | Use | Status |
| --- | --- | --- |
| `flash_0..2` | Muzzle flash variants (additive) | P |
| `dot`, `chunk_0..1`, `smoke_0..1`, `glow`, `ring`, `scorch`, `px` | Blood, gore, dust, debris, smoke, fire, explosion glow, shockwave, scorch decal, casings | P |
| `tracer`, `beam` | Bullet tracers, orbital beam | P |
| `gunship`, `rotor` | Attack helicopter and rotor blur | P |
| `grenade` | 40 mm projectile | P |
| `hud_panel` | Bottom HUD metal plate with slot insets and labels | P |
