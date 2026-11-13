"""Cuts the CrazyGames preview videos from the scenes filmed by src/debug/recordTrailer.ts.

For each orientation it takes covers/trailer-<tag>-<scene>.mjpeg (+ .json of event times),
finds the busiest CLIP seconds of each scene (knockouts count most, then booms, chains, hits),
and joins: the static cover (CrazyGames asks for it as the opening frame), a short dissolve,
then the clips. Silent H.264, 30 fps, 1080p, under 20 seconds.

    python scripts/make-trailer.py              # both orientations
    python scripts/make-trailer.py landscape    # one
"""
import json
import os
import subprocess
import sys

CLIP = 6.0
COVER = 1.0
FADE = 0.3
FPS = 30
WEIGHTS = {'kill': 4.0, 'boom': 2.5, 'chain': 2.5, 'hit': 1.0}
SIZES = {'landscape': (1920, 1080), 'portrait': (1080, 1620)}
COVERS = {'landscape': 'covers/cover-landscape-1920x1080.png', 'portrait': 'covers/cover-portrait-1080x1620.png'}
ORDER = ['crowd', 'kraken', 'boom', 'gang']
PICK = 3


def best_window(meta):
    events = meta['events']
    length = meta['seconds']
    best = (-1.0, 0.0)
    t = 0.5
    while t + CLIP <= length + 1e-6:
        score = sum(WEIGHTS.get(kind, 0) for at, kind in events if t <= at < t + CLIP)
        # a knockout right at the end of the clip is cut off mid-flight: favour ones well inside it
        score += 0.5 * sum(1 for at, kind in events if kind == 'kill' and t + 0.8 <= at < t + CLIP - 0.8)
        if score > best[0]:
            best = (score, t)
        t += 0.25
    return best


def build(tag):
    w, h = SIZES[tag]
    scenes = []
    for name in ORDER:
        base = f'covers/trailer-{tag}-{name}'
        if not (os.path.exists(base + '.mjpeg') and os.path.exists(base + '.json')):
            continue
        with open(base + '.json', encoding='utf-8') as f:
            meta = json.load(f)
        score, start = best_window(meta)
        scenes.append({'name': name, 'file': base + '.mjpeg', 'start': start, 'score': score})
        print(f'{tag} {name}: best {CLIP:.0f}s from {start:.2f}s, score {score:.1f}')
    if not scenes:
        print(f'{tag}: no scenes filmed')
        return
    keep = sorted(scenes, key=lambda s: -s['score'])[:PICK]
    keep.sort(key=lambda s: ORDER.index(s['name']))

    args = ['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', str(FPS), '-t', str(COVER), '-i', COVERS[tag]]
    for s in keep:
        args += ['-f', 'mjpeg', '-framerate', str(FPS), '-i', s['file']]
    parts = [f'[0:v]scale={w}:{h}:flags=lanczos:out_range=tv,setsar=1,format=yuv420p,fps={FPS}[c]']
    for i, s in enumerate(keep, start=1):
        parts.append(
            f'[{i}:v]trim=start={s["start"]:.3f}:duration={CLIP},setpts=PTS-STARTPTS,'
            f'scale={w}:{h}:flags=lanczos:out_range=tv,setsar=1,format=yuv420p,fps={FPS}[v{i}]'
        )
    # cover dissolves into the first clip; the clips follow with hard cuts
    parts.append(f'[c][v1]xfade=transition=fade:duration={FADE}:offset={COVER - FADE}[x1]')
    chain = 'x1'
    rest = ''.join(f'[v{i}]' for i in range(2, len(keep) + 1))
    if rest:
        parts.append(f'[{chain}]{rest}concat=n={len(keep)}:v=1:a=0[out]')
    else:
        parts.append(f'[{chain}]null[out]')
    out = f'covers/preview-{tag}-{w}x{h}.mp4'
    args += ['-filter_complex', ';'.join(parts), '-map', '[out]', '-an', '-c:v', 'libx264', '-preset', 'slow',
             '-crf', '18', '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-r', str(FPS), '-movflags', '+faststart', out]
    subprocess.run(args, check=True)
    probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration,size', '-of', 'csv=p=0', out],
                           capture_output=True, text=True, check=True).stdout.strip()
    print(f'{out}: {probe} ({", ".join(s["name"] for s in keep)})')


if __name__ == '__main__':
    for tag in (sys.argv[1:] or ['landscape', 'portrait']):
        build(tag)
