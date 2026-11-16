"""Trim the interface off native captures and centre the playfield on a common canvas.

    postprocess.py <raw-dir> <out-dir>

<raw-dir>/<version>/<scene>.png -> <out-dir>/<version>/<scene>.png. Crops come from each
version's "playfield" in scenes.json ([x, y, w, h] in native pixels); the result is centred
on a black canvas of the version's native size (or its "canvas", where ScummVM's output isn't
the real screen), so every version lines up.

"keep_columns": [columns, n] keeps those columns of every n of the playfield. The B&W Mac
interpreter dithered into a 640 wide bitmap, 4 columns per AGI pixel, and copied it to its
512x342 screen without the last of them (480 wide). ScummVM's macintoshbw mode (PR #8080)
keeps 640 columns by drawing the first pattern column twice ([0, 0, 1, 2]), so dropping one of
those two ([[1, 2, 3], 4]) gives back the real screen's pixels."""
import json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CFG = json.load(open(os.path.join(HERE, "scenes.json")))
DEFAULT = {"agi": [0, 8, 320, 168], "sci": [0, 10, 320, 190]}


def keep_columns(im, columns, n):
    out = Image.new("RGB", (im.width // n * len(columns), im.height))
    for i, c in enumerate(c for c in range(im.width) if c % n in columns):
        out.paste(im.crop((c, 0, c + 1, im.height)), (i, 0))
    return out


def main(raw, out):
    for version, v in CFG["versions"].items():
        src = os.path.join(raw, version)
        if not os.path.isdir(src): continue
        x, y, w, h = v.get("playfield") or DEFAULT[v["engine"]]
        nw, nh = v.get("canvas") or v["native"]
        keep = v.get("keep_columns")
        os.makedirs(os.path.join(out, version), exist_ok=True)
        for f in sorted(os.listdir(src)):
            if not f.endswith(".png") or f.count(".") > 1: continue
            im = Image.open(os.path.join(src, f)).convert("RGB").crop((x, y, x + w, y + h))
            if keep: im = keep_columns(im, *keep)
            canvas = Image.new("RGB", (nw, nh))
            canvas.paste(im, ((nw - im.width) // 2, (nh - im.height) // 2))
            canvas.save(os.path.join(out, version, f))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
