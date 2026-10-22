"""Builds a webfont from a type specimen image: A-Z (with É), 0-9, black on light grey.

Used for River Plate TV, from the specimens on https://www.grupoberro.com/trabajos/club-atl%C3%A9tico-river-plate
(River Plate Bold and Light). Needs potrace, and pip install fonttools pillow brotli.

Usage: python build_font.py <specimen.jpg> <style: Bold|Light> <out_dir>

Each glyph is cut out of the image, traced with potrace and placed on a common baseline. Colon,
period, hyphen, space, Á Í Ó Ú Ñ are added; lowercase maps to the capitals; digits are tabular.
"""
import os
import re
import subprocess
import sys
import tempfile

from PIL import Image
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.transformPen import TransformPen
from fontTools.svgLib.path import parse_path

SRC, STYLE, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
UPM, CAP = 1000, 720  # units per em; capital height in units

img = Image.open(SRC).convert("RGB")
W, H = img.size
px = img.load()
# Black ink only (the red caption under the specimen is left out).
ink = [[px[x, y][0] < 110 and px[x, y][1] < 110 and px[x, y][2] < 110 for x in range(W)] for y in range(H)]


def runs(values, gap):
    """Index ranges where values is true, joining runs separated by fewer than `gap` falses."""
    out, start, last = [], None, None
    for i, v in enumerate(values):
        if v:
            if start is None:
                start = i
            elif i - last > gap:
                out.append((start, last))
                start = i
            last = i
    if start is not None:
        out.append((start, last))
    return out


rows = runs([any(r) for r in ink], gap=15)
rows = [r for r in rows if r[1] - r[0] > 60]  # the three lines of the specimen
assert len(rows) == 3, f"expected 3 lines, found {rows}"
LINES = ["ABCDÉFGHIJKLMN", "OPQRSTUVWXYZ", "1234567890"]

glyph_boxes = {}  # char -> (x0, x1, y0, y1, baseline, cap_top)
for (y0, y1), chars in zip(rows, LINES):
    cols = runs([any(ink[y][x] for y in range(y0, y1 + 1)) for x in range(W)], gap=2)
    assert len(cols) == len(chars), f"line {chars}: {len(cols)} shapes"
    # The baseline is where most glyphs end; the cap top where most start (É's accent and Q's tail stick out).
    bottoms, tops = [], []
    for x0, x1 in cols:
        ys = [y for y in range(y0, y1 + 1) if any(ink[y][x] for x in range(x0, x1 + 1))]
        bottoms.append(ys[-1])
        tops.append(ys[0])
    base = sorted(bottoms)[len(bottoms) // 2]
    top = sorted(tops)[len(tops) // 2]
    for (x0, x1), ch in zip(cols, chars):
        glyph_boxes[ch] = (x0, x1, y0, y1, base, top)

cap_px = sum(b[4] - b[5] for b in glyph_boxes.values()) / len(glyph_boxes)
SCALE = CAP / cap_px
SIDE = round(CAP * 0.055)  # space each side of a glyph


def trace(x0, x1, y0, y1):
    """Traces the ink in a box; returns potrace's SVG path data and the box height."""
    pad = 4
    w, h = x1 - x0 + 1 + 2 * pad, y1 - y0 + 1 + 2 * pad
    with tempfile.TemporaryDirectory() as d:
        pbm = os.path.join(d, "g.pbm")
        with open(pbm, "w") as f:
            f.write(f"P1\n{w} {h}\n")
            for y in range(y0 - pad, y1 + pad + 1):
                f.write(" ".join("1" if 0 <= y < H and x0 - pad <= x <= x1 + pad and 0 <= x < W and ink[y][x] else "0"
                                 for x in range(x0 - pad, x1 + pad + 1)) + "\n")
        svg = subprocess.run(["potrace", "-s", "-o", "-", "-t", "4", "-a", "1.0", "-O", "0.4", pbm],
                             check=True, capture_output=True, text=True).stdout
    paths = re.findall(r'<path d="([^"]+)"', svg, re.S)
    return " ".join(paths), pad


def outline(ch, keep=None):
    """The glyph's outline as (path data, transform to font units), and its width in units."""
    x0, x1, y0, y1, base, top = glyph_boxes[ch]
    if keep == "body":   # É without its accent
        y0 = top - 2
    if keep == "accent":  # just É's accent
        y1 = top - 3
    d, pad = trace(x0, x1, y0, y1)
    # potrace draws in tenths of a pixel, y up, from the bottom-left of the padded box.
    bottom_px = y1 + pad  # image row of the box's bottom edge
    s = SCALE / 10
    dx = -pad * SCALE
    dy = (base - bottom_px) * SCALE
    return d, (s, 0, 0, s, dx, dy), (x1 - x0 + 1) * SCALE


glyphs, advances, cmap = {}, {}, {}


def add(name, draw, advance, chars=()):
    pen = T2CharStringPen(advance, None)
    draw(pen)
    glyphs[name] = pen.getCharString()
    advances[name] = (round(advance), 0)
    for c in chars:
        cmap[ord(c)] = name


def from_path(d, t, shift=0):
    def draw(pen):
        a, b, c, e, f, g = t
        parse_path(d, TransformPen(pen, (a, b, c, e, f + shift, g)))
    return draw


def rect(x0, y0, x1, y1):
    def draw(pen):
        pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0)); pen.closePath()
    return draw


def both(*draws):
    def draw(pen):
        for dr in draws:
            dr(pen)
    return draw


# Stem width, from I: dots and dashes use it.
STEM = (glyph_boxes["I"][1] - glyph_boxes["I"][0] + 1) * SCALE
digit_w = max((glyph_boxes[c][1] - glyph_boxes[c][0] + 1) * SCALE for c in "0123456789")

shapes = {}
for ch in "ABCDFGHIJKLMNOPQRSTUVWXYZ0123456789":
    shapes[ch] = outline(ch)
shapes["E"] = outline("É", "body")
accent_d, accent_t, _ = outline("É", "accent")

add(".notdef", rect(50, 0, 450, CAP), 500)
add("space", lambda pen: None, CAP * 0.28, "  ")
for ch, (d, t, w) in shapes.items():
    if ch.isdigit():  # tabular: every digit as wide as the widest, centred
        add(ch, from_path(d, t, SIDE + (digit_w - w) / 2), digit_w + 2 * SIDE, ch)
    else:
        add(ch, from_path(d, t, SIDE), w + 2 * SIDE, ch + ch.lower())

# The accent where it is over É; centred (a little to the right, as acutes sit) over other letters.
ex0, ex1, ey0, _, _, etop = glyph_boxes["É"]
acc_cols = [x for x in range(ex0, ex1 + 1) if any(ink[y][x] for y in range(ey0, etop - 3))]
acc_off, acc_w = (acc_cols[0] - ex0) * SCALE, (acc_cols[-1] - acc_cols[0] + 1) * SCALE
for base_ch, acc_ch in [("E", "É"), ("A", "Á"), ("I", "Í"), ("O", "Ó"), ("U", "Ú")]:
    d, t, w = shapes[base_ch]
    shift = SIDE if base_ch == "E" else SIDE + (w - acc_w) / 2 + acc_w * 0.15 - acc_off
    add(base_ch + "acute", both(from_path(d, t, SIDE), from_path(accent_d, accent_t, shift)), w + 2 * SIDE,
        acc_ch + acc_ch.lower())

# Ñ: N with a tilde drawn as a slanted wave of stem-thick bars.
d, t, w = shapes["N"]
th = STEM * 0.42
y0, y1 = CAP + th * 0.9, CAP + th * 0.9 + th * 2.2
cx, span = SIDE + w / 2, w * 0.62


def tilde(pen):
    pts = [(-0.5, 0.15), (-0.18, 1), (0.18, 0.15), (0.5, 1)]
    path = [(cx + px_ * span, y0 + py * (y1 - y0 - th)) for px_, py in pts]
    pen.moveTo(path[0])
    for p in path[1:]:
        pen.lineTo(p)
    for p in reversed(path):
        pen.lineTo((p[0], p[1] + th))
    pen.closePath()


add("Ntilde", both(from_path(d, t, SIDE), tilde), w + 2 * SIDE, "Ññ")

dot = STEM * 0.85
add("colon", both(rect(SIDE, 0, SIDE + dot, dot), rect(SIDE, CAP * 0.5, SIDE + dot, CAP * 0.5 + dot)), dot + 2 * SIDE, ":")
add("period", rect(SIDE, 0, SIDE + dot, dot), dot + 2 * SIDE, ".")
add("hyphen", rect(SIDE, CAP * 0.42, SIDE + CAP * 0.28, CAP * 0.42 + STEM * 0.7), CAP * 0.28 + 2 * SIDE, "-‐")

order = list(glyphs)
fb = FontBuilder(UPM, isTTF=False)
fb.setupGlyphOrder(order)
fb.setupCharacterMap(cmap)
family = "River Plate TV"
fb.setupNameTable({"familyName": family, "styleName": STYLE,
                   "uniqueFontIdentifier": f"{family} {STYLE}",
                   "fullName": f"{family} {STYLE}", "psName": f"RiverPlateTV-{STYLE}",
                   "version": "1.0", "copyright": "Traced from the River Plate Bold/Light specimen published by Grupo Berro for Club Atlético River Plate (2022). Lettering design: Club Atlético River Plate."})
fb.setupCFF(f"RiverPlateTV-{STYLE}", {"FullName": f"{family} {STYLE}"}, glyphs, {})
fb.setupHorizontalMetrics(advances)
fb.setupHorizontalHeader(ascent=900, descent=-220)
fb.setupOS2(sTypoAscender=900, sTypoDescender=-220, usWinAscent=1000, usWinDescent=260, sCapHeight=CAP,
            usWeightClass=700 if STYLE == "Bold" else 300)
fb.setupPost()
os.makedirs(OUT, exist_ok=True)
fb.save(os.path.join(OUT, f"RiverPlateTV-{STYLE}.otf"))
fb.font.flavor = "woff2"
fb.save(os.path.join(OUT, f"RiverPlateTV-{STYLE}.woff2"))
print(f"{STYLE}: {len(order)} glyphs, cap {cap_px:.0f}px, stem {STEM:.0f}u")
