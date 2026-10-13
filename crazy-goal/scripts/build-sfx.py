"""
Builds the game's sound effects from CC0 recordings.

    python scripts/build-sfx.py <folder holding the unzipped packs>

The packs are "Impact Sounds" and "Interface Sounds" from kenney.nl, unzipped into
<folder>/impact and <folder>/interface, plus "RPG Audio" in <folder>/rpg and four
recordings from bigsoundbank.com (0236, 0237, 0812 and 1017 .mp3) in <folder>/street.
Ogg and MP3 files do not decode on every phone, so
the sounds the game uses are converted and packed end to end into one mono WAV,
src/assets/sfx.wav, with src/assets/sfx.json saying where each one starts. One file means
one download and one decode. Each clip has its silence trimmed, is resampled, and is
levelled so they sit together.

Requires: pip install soundfile numpy
"""
import json
import os
import sys

import numpy as np
import soundfile as sf

RATE = 24000
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets')
# Silence between clips, so one can never bleed into the next.
GAP = int(RATE * 0.03)

# game sound -> (pack, file stem, how many numbered variants to take)
SOUNDS = {
    # The ball.
    'kick': ('impact', 'impactPunch_heavy', 3),
    'kick_soft': ('impact', 'impactPunch_medium', 3),
    'thud': ('impact', 'impactSoft_heavy', 3),
    'thud_soft': ('impact', 'impactSoft_medium', 3),
    # What it hits.
    'stone': ('impact', 'impactGeneric_light', 3),
    'wood': ('impact', 'impactWood_medium', 3),
    'plank': ('impact', 'impactPlank_medium', 2),
    'metal': ('impact', 'impactMetal_heavy', 3),
    'post': ('impact', 'impactMetal_light', 3),
    'tin': ('impact', 'impactTin_medium', 3),
    'glass_tap': ('impact', 'impactGlass_light', 3),
    'glass_break': ('impact', 'impactGlass_heavy', 3),
    'glass_bits': ('impact', 'impactGlass_medium', 2),
    'bell': ('impact', 'impactBell_heavy', 2),
    'net': ('impact', 'footstep_carpet', 3),
    'sand': ('impact', 'footstep_snow', 3),
    'grit': ('impact', 'footstep_concrete', 2),
    'tap': ('impact', 'impactWood_light', 3),
    # The interface.
    'click': ('interface', 'click', 2),
    'drop': ('interface', 'drop', 2),
    'switch': ('interface', 'switch', 2),
}

# Sounds cut from a named file: game sound -> [(pack, file, start, end, fade out)], in seconds.
CUTS = {
    # The street reacts.
    'cheer': [('street', '0236.mp3', 0.0, 3.3, 0.5), ('street', '0237.mp3', 0.0, 4.2, 0.6)],
    'applause': [('street', '0812.mp3', 1.4, 5.4, 0.9)],
    'whistle': [('street', '1017.mp3', 2.15, 2.8, 0.03), ('street', '1017.mp3', 5.2, 5.85, 0.03)],
    # Letting go of a pull without shooting.
    'cloth': [('rpg', 'cloth2.ogg', 0, None, 0.03), ('rpg', 'cloth3.ogg', 0, None, 0.03)],
}


def find(root, stem, index):
    """Kenney numbers variants _000, _001...; the folder inside the zip is Audio/."""
    for sub in ('Audio', ''):
        path = os.path.join(root, sub, f'{stem}_{index:03d}.ogg')
        if os.path.exists(path):
            return path
    return None


def convert(path, start=0.0, end=None, fade_out=0.012):
    data, rate = sf.read(path, dtype='float32', always_2d=True)
    mono = data.mean(axis=1)
    mono = mono[int(start * rate):int(end * rate) if end else len(mono)]
    # Trim silence from both ends, leaving a few milliseconds so the attack is not clipped.
    loud = np.flatnonzero(np.abs(mono) > 0.004)
    if len(loud) == 0:
        return None
    start = max(0, loud[0] - int(rate * 0.003))
    end = min(len(mono), loud[-1] + int(rate * 0.02))
    mono = mono[start:end]
    # Linear resample: plenty for short percussive effects.
    n = max(1, int(round(len(mono) * RATE / rate)))
    mono = np.interp(np.linspace(0, len(mono) - 1, n), np.arange(len(mono)), mono).astype('float32')
    # A short fade out so a trimmed tail never clicks.
    fade = min(len(mono), int(RATE * fade_out))
    mono[-fade:] *= np.linspace(1, 0, fade, dtype='float32')
    # And a very short fade in, for a clip cut from the middle of a longer one.
    rise = min(len(mono), int(RATE * 0.004))
    mono[:rise] *= np.linspace(0, 1, rise, dtype='float32')
    peak = float(np.max(np.abs(mono)))
    if peak > 0:
        mono *= 0.89 / peak
    return mono


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    packs = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    sheet = []
    cursor = 0
    index_of = {}

    def add(name, samples):
        nonlocal cursor
        # [start, length] in seconds, to four decimals.
        index_of.setdefault(name, []).append([round(cursor / RATE, 4), round(len(samples) / RATE, 4)])
        sheet.append(samples)
        sheet.append(np.zeros(GAP, dtype='float32'))
        cursor += len(samples) + GAP

    for name, cuts in CUTS.items():
        for pack, file, start, end, fade_out in cuts:
            src = os.path.join(packs, pack, file)
            if not os.path.exists(src):
                src = os.path.join(packs, pack, 'Audio', file)
            samples = convert(src, start, end, fade_out) if os.path.exists(src) else None
            if samples is None:
                print(f'!! {name}: missing {file}')
                continue
            add(name, samples)
            print(f'{name:<10} {len(samples) / RATE * 1000:6.0f} ms  <- {file}')
    for name, (pack, stem, count) in SOUNDS.items():
        made = 0
        for index in range(8):
            if made >= count:
                break
            src = find(os.path.join(packs, pack), stem, index)
            if not src:
                continue
            samples = convert(src)
            if samples is None:
                continue
            add(name, samples)
            # Brightness (spectral centroid) helps tell a thud from a click without ears.
            spectrum = np.abs(np.fft.rfft(samples))
            centroid = float((spectrum * np.fft.rfftfreq(len(samples), 1 / RATE)).sum() / (spectrum.sum() or 1))
            print(f'{name}_{made:<2} {len(samples) / RATE * 1000:6.0f} ms  {centroid:6.0f} Hz  <- {os.path.basename(src)}')
            made += 1
        if made < count:
            print(f'!! {name}: wanted {count}, found {made}')
    wav = os.path.join(OUT, 'sfx.wav')
    sf.write(wav, np.concatenate(sheet), RATE, subtype='PCM_16')
    with open(os.path.join(OUT, 'sfx.json'), 'w', encoding='utf8') as f:
        json.dump(index_of, f, separators=(',', ':'))
    print(f'{len(index_of)} sounds, {cursor / RATE:.1f} s, {os.path.getsize(wav) / 1024:.0f} KB')


if __name__ == '__main__':
    main()
