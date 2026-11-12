"""Shrinks the four hero portraits for the single-file builds.

The originals (1064 px PNGs, ~0.7-1.0 MB each) live in assets/originals/characters/.
Output: src/assets/characters/<name>.webp, longest side 720 px (they are shown at <= 360 px,
so this still covers a 2x screen), WebP quality 82, transparency kept.

    python scripts/optimize-assets.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "originals" / "characters"
OUT = ROOT / "src" / "assets" / "characters"
LONGEST = 720
QUALITY = 82

OUT.mkdir(parents=True, exist_ok=True)
total = 0
for png in sorted(SRC.glob("*.png")):
    im = Image.open(png).convert("RGBA")
    scale = LONGEST / max(im.size)
    if scale < 1:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    target = OUT / (png.stem + ".webp")
    im.save(target, "WEBP", quality=QUALITY, method=6)
    total += target.stat().st_size
    print(f"{png.name}: {png.stat().st_size // 1024} KB -> {target.name}: {target.stat().st_size // 1024} KB {im.size}")
print(f"total {total // 1024} KB")
