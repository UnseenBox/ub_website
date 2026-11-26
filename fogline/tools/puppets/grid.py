"""Draws a coordinate grid over a creature cut-out, to read part polygons off it."""
import sys
from PIL import Image, ImageDraw

name = sys.argv[1]
step = int(sys.argv[2]) if len(sys.argv) > 2 else 100
im = Image.open(f'tools/puppets/src/{name}.webp').convert('RGBA')
bg = Image.new('RGBA', im.size, (70, 110, 140, 255))
bg.alpha_composite(im)
d = ImageDraw.Draw(bg, 'RGBA')
for x in range(0, im.width, step // 2):
    d.line([(x, 0), (x, im.height)], fill=(255, 255, 0, 110 if x % step == 0 else 45), width=1)
for y in range(0, im.height, step // 2):
    d.line([(0, y), (im.width, y)], fill=(255, 255, 0, 110 if y % step == 0 else 45), width=1)
for x in range(0, im.width, step):
    for y in range(0, im.height, step):
        d.text((x + 3, y + 2), f'{x},{y}', fill=(255, 255, 160, 255))
bg.convert('RGB').save(f'tools/puppets/out/{name}_grid.png')
print(name, im.size)
