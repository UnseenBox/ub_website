# BONK Character System — Implementation Plan

**Date:** 2026-10-23
**Branch:** `bonk-2.0`
**Scope:** Four playable heroes, one visual system across character select, main-menu cast, and animated in-game sprites. No new screens, no new gameplay.

## Locked direction

The tenant is locked from `.screenshots/tenant-hero-final.webp`.

- Soft pear-shaped build, tired contrapposto, weight on the cane.
- Messy auburn bun, teal sleep mask/headband pushed up, half-lidded amber eyes, dark circles, dry smirk.
- Violet open dressing gown, cream sash.
- Pale blue high-neck pajama top.
- Long pale blue wide-leg pajama pants with violet piping.
- Pink bunny slippers.
- White ceramic mug, wooden cane, Waffle the dachshund.
- **Fully covered:** no exposed midriff, legs, or cleavage. Only face, neck, and hands are visible.

The other three carry the same style lane and world, but their own build, outfit silhouette, hair, feet, prop, and pet.

## Shared visual rules

- Style: clean painterly 2D illustration, soft shading, bold readable silhouette. Same warm cream hallway, teal arch, and ink-outline world for all four.
- Palette: one accent colour per hero; the hallway and teal trim stay consistent across the set.
- Character select and the menu cast use the **same portrait files**.
- In-game sprites match the portrait's outfit, palette, hair, and silhouette. Props that are held weapons in gameplay (cane, pan, rolling pin, flashlight) stay in portraits and do not become permanent sprite attachments.
- Every hero is fully clothed. The tenant is the coverage baseline.

## Final cast design

| Hero | Build | Outfit | Hair / face | Feet | Signature prop | Pet |
|---|---|---|---|---|---|---|
| Tenant (Violet) | soft pear, ~4.5 heads | violet open robe, cream sash, pale blue high-neck top, long wide-leg pants with violet piping | auburn bun, teal sleep mask/headband, tired dry smirk | pink bunny slippers | white mug, wooden cane | Waffle, dachshund |
| Flatmate (Teal) | tall, lanky, angular | teal silk pajama shirt buttoned wrong, matching wide-leg pants, pink sleep mask pushed up on forehead | black high ponytail, yellow scrunchie, unimpressed | yellow duck slippers | phone, frying pan | Biscuit, ginger cat |
| Gran (Rose) | short, round, wide | rose quilted bed jacket over modest floral nightgown, long sleeves, high neck | loose white curls, cat-eye glasses, hearing aid, mischievous grin | pink feather-trimmed slippers | wooden rolling pin | Captain, scarlet macaw (a second macaw perches on the rolling pin in the portrait) |
| Kid (Lime) | small, skinny, all knees and elbows | lime dinosaur onesie with hood teeth, teal spikes, stuffed tail, teal sneakers | orange cowlick, missing tooth, sticker, huge grin | teal sneakers with yellow laces | chunky flashlight | Nugget, hamster in a clear ball (a second hamster stands beside the ball in the portrait) |

**Canonical pet names:** Waffle, Biscuit, Captain, Nugget. `cast-brief.md` uses Biscuit for the flatmate's cat.

## Asset contract

- Portrait files replace the existing imports:
  - `src/ui-kit/bonk2/assets/icons/character-violet@2x.png`
  - `src/ui-kit/bonk2/assets/icons/character-teal@2x.png`
  - `src/ui-kit/bonk2/assets/icons/character-rose@2x.png`
  - `src/ui-kit/bonk2/assets/icons/character-lime@2x.png`
- Format: **768 × 1024 PNG**, 3:4, opaque warm-hallway scene, character full-body with breathing room at the top and bottom.
- Pet icons stay in `src/ui-kit/bonk2/assets/icons/pet-*.png`; they are already separate and readable.
- The menu cast reuses the four production portraits. `src/ui/screens/characters.ts` keeps its private portrait imports; there is no `characterArt.ts` refactor.
- `banners/bonk-cast@2x.png` is replaced in place by a composite banner built from those four portraits by `scripts/build-cast-banner.mjs`. `src/ui/screens/lobby.ts` keeps its existing banner import.
- Character-select card stage is 3:4 and uses `object-fit: cover`; the portrait is the card art, not a cutout on an accent background.
- Lobby cast is a single 1560 × 600 transparent strip of four tilted 3:4 portrait cards. No lobby code or CSS changes are needed for the cast.
- Production portrait budget: 768 × 1024 PNG, roughly 250–450 KB each. Gran is palette-quantized to about 253 KB; the other three are 305–447 KB.

## Tasks

### Task 1 — Shared character data (superseded during implementation)

**Files:** `src/ui/screens/characters.ts`, `src/rendering/heroLooks.ts`

The original plan proposed a shared `src/ui/characterArt.ts` registry and a four-node lobby cast. During implementation the simpler path held up: keep the existing private portrait imports in `characters.ts`, reuse the same files in the composite banner, and keep `lobby.ts` unchanged. The only shared registry is the in-game look data in `heroLooks.ts` (Task 5).

**Verify:** `npm run typecheck`.

### Task 2 — Portraits

**Files:** the four `character-*.png` assets.

1. Tenant: normalize the locked hero to 768 × 1024 PNG. Do not regenerate the design.
2. Flatmate, gran, kid: generate 768 × 1024 full-body scenes in the same style lane, using the prompts in `.screenshots/flatmate-prompt.txt`, `.screenshots/gran-prompt.txt`, `.screenshots/kid-prompt.txt`.
3. Reject any candidate with exposed midriff, legs, or cleavage on the tenant/flatmate/gran; reject any candidate that loses the character's silhouette, hair, feet, or signature prop.
4. Keep the tenant as the colour reference. The flatmate and gran scenes came out already close to the warm hallway/teal-arch world; the kid is brighter but reads as the same apartment at night. Light per-image grading only, no heavy shared filter.
5. Preserve 768 × 1024. Tenant 447 KB, flatmate 305 KB, gran 253 KB palette PNG, kid 436 KB.
6. Fix the two portrait-only flourishes rather than cropping them: gran has a second macaw on the rolling pin, and the kid has a second hamster beside the ball. Gameplay still has one pet each.

**Done when:** all four portraits are present, same dimensions, fully clothed, and visually distinct in build/silhouette.

### Task 3 — Character-select cards

**Files:** `src/ui-kit/bonk2/rooms.css`

1. `.b2-hero__stage { aspect-ratio: 3 / 4; }`
2. `.b2-hero__portrait { width: 100%; height: 100%; object-fit: cover; }`
3. Replace the white radial wash with a subtle top-to-bottom vignette so the portrait colours survive.
4. Add a small text shadow to `.b2-hero__num` and keep the pet badge readable over the scene.
5. Check the four-card grid at desktop, 820 px, and 520 px widths. The modal body may scroll; cards must not squash or clip the face.

**Verify:** open Characters sheet, screenshot 1440 × 900 and 390 × 844.

### Task 4 — Menu cast banner (implemented as a composite)

**Files:** `scripts/build-cast-banner.mjs` (new), `src/ui-kit/bonk2/assets/banners/bonk-cast@2x.png`

1. Build a 1560 × 600 transparent PNG from the four production portraits: 336 × 448 cards, cream frame, inner ink hairline, soft shadow, and a small alternating tilt.
2. Replace `bonk-cast@2x.png` in place so the existing `lobby.ts` import resolves to the new art. No lobby markup or CSS refactor.
3. Rerun `node scripts/build-cast-banner.mjs` whenever a portrait changes.
4. Confirm PLAY stays visible at 1366 × 768 and 390 × 844. The four cards stay in one row on mobile; they are small but legible above PLAY.

### Task 5 — Shared in-game look registry (test-first)

**Files:** `src/rendering/heroLooks.ts` (new), `src/rendering/heroLooks.test.ts` (new), `src/rendering/PlayerArt.ts`

1. Write `heroLooks.test.ts` first. It asserts:
   - all four `HeroId`s exist in `HERO_LOOKS`;
   - the four `outfit` values are distinct;
   - the four `hairStyle` values are distinct;
   - the four `feet` values are distinct;
   - tenant is `outfit: 'openRobePajamas'`, `hairStyle: 'bun'`, `feet: 'bunny'`, `maskStyle: 'forehead'`;
   - every hero declares `coverage: 'full'` and a positive `scale`.
2. Add `src/rendering/heroLooks.ts` with the exported `HeroLook` type and `HERO_LOOKS` record.
3. Move the existing palette values from `PlayerArt.ts` into `HERO_LOOKS`; keep the current colour values as the starting point, then correct them to the portraits:
   - tenant: violet robe, pale blue top/pants, violet piping, cream sash, pink bunny slippers, teal mask, auburn bun;
   - flatmate: teal shirt/pants, pink mask on forehead, yellow duck slippers, near-black ponytail, warm brown skin;
   - gran: rose bed jacket, dusty-pink floral nightgown, cream feather trim, loose white curls, pink feather slippers, glasses;
   - kid: lime onesie, yellow belly, teal spikes, orange cowlick, teal sneakers with cream soles and yellow laces, orange flashlight accent.
4. `PlayerArt.ts` imports `HERO_LOOKS`; `useLook` keeps the existing globals populated from the active look plus a `SPINE` accent for the kid's teal dino plates.
5. The optional `spike` colour is only used by the kid; all other looks fall back to `outfitLight`.

**Verify:** `npm test -- heroLooks` and `npm run typecheck`.

### Task 6 — Outfit silhouettes in `PlayerArt.ts`

**Files:** `src/rendering/PlayerArt.ts`

Keep the existing pose/state system (`bob`, `lean`, `flare`, `ax/ay`, held/throw/charge/hurt/rage/down) and replace only the body/outfit passes.

1. `drawPants(...)`:
   - two wide-leg shapes from waist to ankle;
   - tenant: pale blue with violet piping; flatmate: teal straight leg; gran: a dusty-pink nightgown skirt over the legs (no bare legs).
2. `drawOpenRobePajamas` for the tenant:
   - pale blue high-neck top torso;
   - violet robe panels over the shoulders and sides, open in the centre;
   - cream sash at the waist, short tails;
   - no exposed midriff.
3. `drawPajamaShirt` for the flatmate:
   - teal buttoned shirt with a visible placket and mismatched buttons;
   - matching teal pants;
   - no robe.
4. `drawBedJacket` for the gran:
   - wide rose quilted body with a diamond quilt pattern;
   - dusty-pink nightgown hem below the jacket;
   - cream feather collar/cuffs.
5. Keep `drawOnesie` for the kid:
   - lime body and yellow belly patch;
   - hood spikes and tail plates use the teal `spike` colour, not the onesie green;
   - teal sneaker feet replace dino claws.
6. Keep the arms drawn before/after the body based on `ay`, and keep the ink outline last.

**Verify:** render all four in the idle, run, aim, held, hurt, and down states. No state may lose the head, feet, or outfit outline.

### Task 7 — Hair, feet, masks, accessories

**Files:** `src/rendering/PlayerArt.ts`

1. `slipper()` accepts `FeetKind`:
   - `bunny` keeps the current ears/face;
   - `duck` uses a yellow body, orange bill, and a small eye;
   - `feather` uses a fluffy pink body with a cream feather tuft;
   - `sneaker` uses a chunky teal upper, cream sole/toe bumper, and yellow laces (kid);
   - `claw` remains in the union as an unused fallback.
2. Hair:
   - tenant: auburn bun + loose strands; teal mask/headband on the forehead; no pencil;
   - flatmate: near-black high ponytail with a yellow scrunchie, swinging with `trail`;
   - gran: grey cap plus overlapping white pin-curl puffs, matching the portrait's loose curls;
   - kid: orange cowlick under the dino hood, teal crest spikes.
3. Masks:
   - tenant: forehead sleep mask (existing `sleepMask`);
   - flatmate: pink mask pushed up on the forehead;
   - gran and kid: no sleep mask.
4. Accessories:
   - gran: hearing aid dot/line and the existing shawl pin;
   - flatmate: gold hoop earring;
   - kid: cream hood teeth around the face opening, thicker lime hood rim.
5. Preserve the `facingAway` path: back of the head shows the correct hair, mask strap, or hood.

### Task 8 — Visual verification

**Commands:**
```powershell
npm run typecheck
npm test
npm run test:physics
npm run build
```

**Manual checks:**
1. Characters sheet: four distinct 3:4 cards; tenant matches the locked portrait; no card crops the face; pet badges readable. Desktop verified; 390 × 844 uses a two-column grid and fits the sheet.
2. Main menu: composite four-portrait banner; PLAY visible at desktop and 390 × 844. The mobile cards stay in one row and remain legible.
3. Gameplay: inspect all four heroes in idle, run, aim, hurt, and down states. Tenant, flatmate, gran, and kid were verified in the temporary sprite lab; verify one live run after the final build.
4. Cutscene: each hero's down/defeat pose still reads.
5. Asset audit: four portraits are 768 × 1024, no unintended transparency. The banner is 1560 × 600; `lobby.ts` still imports the same filename.

### Task 9 — Commit

1. Rebuild the published arcade mirror from the game's `dist`: copy `index.html`, `assets/`, and `sfx/` into `public/arcade/bonk/`; keep `poster.jpg`.
2. `git status` — confirm only the character system files, the mirror, and this plan changed. Leave `.screenshots` untracked; it holds process art, not production assets.
3. Stage the four portraits, the composite banner, `heroLooks.ts`, `heroLooks.test.ts`, `PlayerArt.ts`, `rooms.css`, `scripts/build-cast-banner.mjs`, `public/arcade/bonk/`, and this plan.
4. Commit on `bonk-2.0` with a message such as `feat: unify BONK cast art and hero sprites`.
5. Push to `origin/bonk-2.0`; do not merge.

## Guardrails

- Do not add new screens, modes, or gameplay.
- Do not change pause behavior.
- Do not swap the procedural sprites for static sprite sheets; animation states must survive.
- Do not regenerate the locked tenant unless a later review explicitly asks.
- Do not use the rejected exposed tenant candidates.
- Keep `Hero.ts` names and pet names canonical; only update stale art briefs.
