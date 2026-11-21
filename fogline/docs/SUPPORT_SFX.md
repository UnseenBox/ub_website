# Support SFX — supplied shield, nuclear and beam recordings

Status: proposed for approval.

## Intent

Replace the synthesized cues for Fogline's three support/defence moments with
the newly supplied recordings. Rocket Launcher explosion is already deployed on
the M32 impact and is unchanged.

## Mapping

| Event | In-game key | Supplied file | Shipped file |
| --- | --- | --- | --- |
| Blast Shutters activation (E) | `shutters_up` | `Metal Shield.mp3` | `metal-shield.mp3` |
| Tactical Nuke detonation (D) | `nuke` | `Nuc Explosion sfx.mp3` | `nuc-explosion.mp3` |
| Orbital Lance call-in (S) | `orbital_charge` | `Satelite Beam SFX.mp3` | `satellite-beam.mp3` |
| M32 impact | `rocket_impact` | `Rocket Launcher ( Explosion ).mp3` | already live |

The nuke warning `siren`, orbital impact `orbital_blast` and shielded-hit
`shutter_hit` keep their synthesized sounds: they are different moments and no
supplied replacements were requested for them.

## Technical shape

- Copy the three recordings byte-for-byte into `public/audio/fogline/` beside
  the gun and rocket files.
- Export `SUPPORT_SFX_FILES` from `src/audio/overrides.ts`, mapping the three
  keys to `audio/fogline/<file>.mp3`, and register each through the existing
  `audio.registerOverride` path.
- The synthesized bank already defines all three keys, so a missing or
  undecodable recording falls back to the current sound without code changes.
- No event wiring, timing, volume, balance or gameplay values change.

## Tests

- `SUPPORT_SFX_FILES` maps the exact three keys/files.
- Each shipped file exists in `public/audio/fogline/`.
- The synthesized bank still contains `shutters_up`, `nuke` and `orbital_charge`.
- Browser: trigger E, D and S in a dev run, confirm the new recordings are
  requested with HTTP 200 from the `/arcade/fogline/` subfolder, and that no
  console/audio errors appear.

## Non-goals

- Changing the Rocket Launcher explosion mapping.
- Replacing `shutter_hit`, `orbital_blast` or `siren`.
- Re-encoding recordings, changing volumes, or touching enemy/weapon balance.
