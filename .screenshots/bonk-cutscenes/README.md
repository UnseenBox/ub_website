# BONK! cutscene stills

Rendered from the game's own canvas code at **1920×1080** (`Cutscene.draw`), not mockups.
Bright comic staging: bold flat colour, thick ink outlines, halftone dots, paper grain and
torn-paper title cards.
`00-contact-sheet.png` is the labelled overview; the numbered files are the individual shots.

| # | File | Scene | Beat |
| --- | --- | --- | --- |
| 01–05 | `01-evicted-hall` … `05-evicted-still-yours` | Win — *Still Yours.* | hallway throw → burst → the boxes → the van leaves |
| 06–08 | `06-home-morning` … `08-home-step` | Win — *Home.* | morning after → the little things → coffee on the step |
| 09–11 | `09-moving-sofa` … `11-moving-day` | Lose — *Moving Day.* | the sofa goes → the keys stay → walking away |
| 12–14 | `12-new-tenants` … `14-new-management` | Lose — *New Management.* | the new tenants → hand on the glass → walking away |

## Regenerate

1. `cd everything-is-a-weapon && npm run dev`
2. Open `http://localhost:5173/cutscene-preview.html`.
3. In the console, run `await __captureAll()`. PNGs are written to `everything-is-a-weapon/covers/`.

The preview page also accepts `?scene=evicted&t=1.68` for a single frame.

## Where the code lives

- `everything-is-a-weapon/src/rendering/Cutscene.ts` — the four scenes, cameras, lighting and titles.
- `everything-is-a-weapon/cutscene-preview.html` — frame-accurate review harness.
- `public/arcade/bonk/` — the shipped web build used by the site.
