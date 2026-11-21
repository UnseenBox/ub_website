# Weapon SFX — supplied gun and rocket recordings

Status: proposed for approval.

## Intent

Give each Fogline firearm its own supplied report so the M4, M249 and M32 stop
sharing the M1A's `GUN 1` recording. The M32 also gets the supplied rocket
explosion on impact instead of the synthesized generic explosion.

## Mapping

| Weapon | In-game key | Supplied file | Shipped file |
| --- | --- | --- | --- |
| M1A | `shot_service` | `GUN 1.mp3` (already live) | `gun-1.mp3` |
| M4 | `shot_m4` | `GUN 2.mp3` | `gun-2.mp3` |
| M249 | `shot_m249` | `GUN 3 SFX.mp3` | `gun-3.mp3` |
| M32 launch | `shot_m32` | `Rocket Launcher ( Launching ).mp3` | `rocket-launch.mp3` |
| M32 impact | `rocket_impact` | `Rocket Launcher ( Explosion ).mp3` | `rocket-explosion.mp3` |

Reload audio stays the shared supplied `Gun Realod.mp3` → `gun-reload.mp3`.
The M1A keeps `GUN 1`; no supplied recording is discarded or re-encoded.

## Behaviour

- `src/audio/overrides.ts` registers each shot key separately instead of one
  file for every weapon.
- `WeaponSoundConfig` gains an optional `impact: string` key. The M32 sets it to
  `rocket_impact`; other guns leave it unset.
- `ProjectileManager.launch` receives the impact cue from the firing weapon and
  carries it on the shell, so switching weapons mid-flight cannot change the
  sound that lands.
- `GameScene` plays the shell's impact cue at the blast point with the existing
  distance volume and pan. If a future projectile omits the cue, it falls back
  to `explosion_small`.
- `SoundBank` aliases `rocket_impact` to the synthesized `explosion_small`
  buffer as a decode-failure fallback. When the supplied recording decodes, it
  replaces that key before gameplay starts.
- Existing shot volume, pitch jitter, muzzle flash, recoil, rate of fire and
  reload timing are unchanged.

## Files

- Add: `fogline/public/audio/fogline/gun-2.mp3`
- Add: `fogline/public/audio/fogline/gun-3.mp3`
- Add: `fogline/public/audio/fogline/rocket-launch.mp3`
- Add: `fogline/public/audio/fogline/rocket-explosion.mp3`
- Modify: `fogline/src/audio/overrides.ts`, `SoundBank.ts`
- Modify: `fogline/src/data/weapons.ts`, `fogline/src/entities/Projectile.ts`,
  `fogline/src/game/GameScene.ts`
- Modify: `fogline/docs/AUDIO_MANIFEST.md`, `ASSET_MANIFEST.md`
- Test: `fogline/src/systems/logic.test.ts`

## Tests

- The four weapons use four distinct shot keys.
- The M32 declares `rocket_impact`; the other guns do not.
- Every audio URL registered by `overrides.ts` exists under
  `fogline/public/audio/fogline/`.
- Every weapon shot key exists in the synthesized bank before overrides load.
- Existing tests and typecheck stay green.
- Browser: fire M1A, M4, M249 and M32; each uses its supplied file, the rocket
  impact plays at the blast, and the console/network shows no 404 or decode
  errors.

## Non-goals

- Rebalancing weapon volume, pitch jitter or fire rate.
- Changing reload, kill, UI or ambience recordings.
- Re-encoding the supplied MP3s.
