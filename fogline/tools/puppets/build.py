"""Cuts a creature picture into jointed parts for the puppet runtime.

Run from the fogline folder:  python tools/puppets/build.py crimson [more names]

Each spec (tools/puppets/specs/<name>.json) draws a polygon around every part, with its joint
(pivot), its parent and its draw order. The tool then:
  * gives every pixel no polygon claimed to the nearest part, so nothing is lost;
  * repaints what a part hides behind the parts above it, so a moving limb never opens a hole;
  * packs the parts into one atlas (src/assets/puppets/<name>.webp) with a JSON description
    (src/puppet/rigs/<name>.json), and writes previews to tools/puppets/out/.
"""
import json
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

#: How far (px) under an occluding part a hidden area is repainted.
HIDDEN_REACH = 55
PAD = 3


def polygon_mask(size, poly):
    im = Image.new('L', size, 0)
    ImageDraw.Draw(im).polygon([tuple(p) for p in poly], fill=255)
    return np.array(im) > 0


def erase(rgba, rules):
    lum = rgba[..., :3].astype(float).mean(axis=2)
    for rule in rules:
        m = polygon_mask((rgba.shape[1], rgba.shape[0]), rule['poly'])
        if 'minLum' in rule:
            m &= lum >= rule['minLum']
        if 'maxLum' in rule:
            m &= lum <= rule['maxLum']
        rgba[..., 3][m] = 0


def repaint(rgb, visible, hidden):
    """Colour for the hidden pixels, grown from the part's own visible pixels."""
    if not hidden.any() or not visible.any():
        return rgb
    _, (iy, ix) = ndi.distance_transform_edt(~visible, return_indices=True)
    grown = rgb[iy, ix]
    smooth = cv2.inpaint(grown, hidden.astype(np.uint8) * 255, 5, cv2.INPAINT_TELEA)
    # A little of the nearest-pixel texture keeps the patch from reading as a flat smear.
    mixed = (smooth.astype(float) * 0.65 + grown.astype(float) * 0.35).astype(np.uint8)
    out = rgb.copy()
    out[hidden] = mixed[hidden]
    return out


def build(name):
    spec = json.load(open(f'tools/puppets/specs/{name}.json'))
    rgba = np.array(Image.open(f'tools/puppets/src/{name}.webp').convert('RGBA')).copy()
    erase(rgba, spec.get('erase', []))
    h, w = rgba.shape[:2]
    alpha = rgba[..., 3]
    solid = alpha > 10

    cut = [p for p in spec['parts'] if 'poly' in p]
    cut.sort(key=lambda p: p['z'])
    masks = {p['name']: polygon_mask((w, h), p['poly']) for p in cut}

    # Every opaque pixel outside all polygons joins the nearest part.
    owner = np.full((h, w), -1, np.int32)
    for i, p in enumerate(cut):
        owner[masks[p['name']]] = i
    loose = solid & (owner < 0)
    if loose.any():
        _, (iy, ix) = ndi.distance_transform_edt(owner < 0, return_indices=True)
        nearest = owner[iy, ix]
        for i, p in enumerate(cut):
            masks[p['name']] |= loose & (nearest == i)

    layers = {}
    for i, p in enumerate(cut):
        full = masks[p['name']] & solid
        if not full.any():
            raise SystemExit(f'{name}: part {p["name"]} is empty')
        above_all = np.zeros((h, w), bool)
        for q in cut[i + 1:]:
            above_all |= masks[q['name']]
        # Work inside a window around the part: far faster than the whole picture.
        ys, xs = np.where(full)
        m = p.get('reach', HIDDEN_REACH) + 8
        wy0, wy1 = max(0, ys.min() - m), min(h, ys.max() + 1 + m)
        wx0, wx1 = max(0, xs.min() - m), min(w, xs.max() + 1 + m)
        mask = full[wy0:wy1, wx0:wx1].copy()
        above = above_all[wy0:wy1, wx0:wx1]
        a_in = alpha[wy0:wy1, wx0:wx1]
        visible = mask & ~above
        hidden = mask & above
        if visible.any():
            reach = ndi.distance_transform_edt(~visible) <= p.get('reach', HIDDEN_REACH)
            mask &= ~(hidden & ~reach)
            hidden &= reach
        rgb = rgba[wy0:wy1, wx0:wx1, :3].copy()
        fill = spec.get('underFill', {}).get(p['name'])
        if fill:
            rgb[hidden] = np.array(fill, np.uint8)
        else:
            rgb = repaint(rgb, visible, hidden)
        soft = ndi.gaussian_filter(mask.astype(float), 0.7)
        a = np.minimum(a_in.astype(float), np.clip(soft * 1.35, 0, 1) * 255)
        a[~ndi.binary_dilation(mask)] = 0
        layer = np.dstack([rgb, a.astype(np.uint8)])
        ys, xs = np.where(layer[..., 3] > 8)
        x0, y0 = max(0, xs.min() - PAD), max(0, ys.min() - PAD)
        x1, y1 = min(wx1 - wx0, xs.max() + 1 + PAD), min(wy1 - wy0, ys.max() + 1 + PAD)
        layers[p['name']] = (Image.fromarray(layer[y0:y1, x0:x1], 'RGBA'), (int(wx0 + x0), int(wy0 + y0)))

    # Copied parts: another part's picture, mirrored or resized, hung on its own joint.
    by_name = {p['name']: p for p in spec['parts']}
    for p in spec['parts']:
        if 'copyOf' not in p:
            continue
        source, (ox, oy) = layers[p['copyOf']]
        sp = by_name[p['copyOf']]['pivot']
        lx, ly = sp[0] - ox, sp[1] - oy
        im = source
        if p.get('flip'):
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
            lx = im.width - lx
        k = p.get('scale', 1.0)
        shade = p.get('shade', 1.0)
        if k != 1.0:
            im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        if shade != 1.0:
            arr = np.array(im).astype(float)
            arr[..., :3] *= shade
            im = Image.fromarray(arr.clip(0, 255).astype(np.uint8), 'RGBA')
        layers[p['name']] = (im, (round(p['pivot'][0] - lx * k), round(p['pivot'][1] - ly * k)))

    # Shelf packing into one atlas.
    order = sorted(layers, key=lambda n: -layers[n][0].height)
    limit = max(1024, max(layers[n][0].width for n in order) + 4)
    frames, x, y, shelf, used_w = {}, 0, 0, 0, 0
    for n in order:
        im = layers[n][0]
        if x + im.width + 4 > limit:
            x, y, shelf = 0, y + shelf + 4, 0
        frames[n] = (x + 2, y + 2, im.width, im.height)
        x += im.width + 4
        used_w = max(used_w, x)
        shelf = max(shelf, im.height)
    atlas = Image.new('RGBA', (used_w + 2, y + shelf + 6), (0, 0, 0, 0))
    for n in order:
        atlas.paste(layers[n][0], frames[n][:2])
    atlas.save(f'src/assets/puppets/{name}.webp', quality=92, method=6)

    cx, feet = spec['origin']
    parts = []
    for p in sorted(spec['parts'], key=lambda p: p['z']):
        im, (ox, oy) = layers[p['name']]
        fx, fy, fw, fh = frames[p['name']]
        parts.append({
            'name': p['name'], 'parent': p.get('parent'), 'z': p['z'],
            'pivot': [p['pivot'][0] - cx, p['pivot'][1] - feet],
            'offset': [ox - cx, oy - feet],
            'frame': [fx, fy, fw, fh],
        })
    json.dump({'name': name, 'height': feet - spec.get('top', 0), 'origin': [cx, feet], 'parts': parts},
              open(f'src/puppet/rigs/{name}.json', 'w'), separators=(',', ':'))

    # Previews: the rest pose reassembled, and which part owns each pixel.
    rest = Image.new('RGBA', (w, h), (70, 110, 140, 255))
    for p in sorted(spec['parts'], key=lambda p: p['z']):
        im, (ox, oy) = layers[p['name']]
        rest.paste(im, (ox, oy), im)
    colours = np.zeros((h, w, 3), np.uint8) + np.array([30, 30, 30], np.uint8)
    rng = np.random.RandomState(7)
    labels = []
    for p in cut:
        c = rng.randint(50, 250, 3)
        m = masks[p['name']] & solid
        colours[m] = c
        if m.any():
            ys, xs = np.where(m)
            labels.append((p['name'], int(xs.mean()), int(ys.mean()), p['pivot']))
    own = Image.fromarray(colours)
    d = ImageDraw.Draw(own)
    for n, lx, ly, (px, py) in labels:
        d.ellipse([px - 5, py - 5, px + 5, py + 5], fill=(255, 255, 255), outline=(0, 0, 0))
        d.text((lx - 18, ly - 6), n, fill=(0, 0, 0))
    sheet = Image.new('RGB', (w * 2 + 20, h), (255, 255, 255))
    sheet.paste(rest.convert('RGB'), (0, 0))
    sheet.paste(own, (w + 20, 0))
    sheet.save(f'tools/puppets/out/{name}_parts.png')
    print(f'{name}: {len(parts)} parts, atlas {atlas.size}')


if __name__ == '__main__':
    for creature in sys.argv[1:]:
        build(creature)
