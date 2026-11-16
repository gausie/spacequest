# Usage: python3 mkfont.py <scummvm>/graphics/fonts/dosfont.cpp src/assets/agi-pc-8x8.ttf  (needs fonttools)
# Builds the PC BIOS 8x8 font (what PC AGI draws its text with) as a TTF with AGI's pixel
# shape on a 4:3 screen: each pixel 1 wide x 1.2 tall. font-size = one 8-row cell.
import re, sys
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
src = open(sys.argv[1]).read()
body = src[src.index("fontData_PCBIOS[256 * 8] = {"):]
body = body[body.index("{") + 1: body.index("};")]
body = re.sub(r"//[^\n]*|/\*.*?\*/", "", body, flags=re.S)  # comments hold hex too
data = [int(x, 16) for x in re.findall(r"0x([0-9A-Fa-f]{2})", body)]
assert len(data) == 2048, len(data)
LOW = " ☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼"
def uni(c):
    if c < 32: return ord(LOW[c]) if c else None
    if c == 127: return 0x2302
    return ord(bytes([c]).decode("cp437"))
PW, PH = 100, 120
order, glyphs, cmap, adv = [".notdef"], {}, {}, {}
def draw(c):
    pen = TTGlyphPen(None)
    for r in range(8):
        bits = data[c * 8 + r]; x = 0
        while x < 8:
            if bits & (0x80 >> x):
                x0 = x
                while x < 8 and bits & (0x80 >> x): x += 1
                y1 = (7 - r) * PH - PH; y0 = y1 + PH
                # rows from the top; baseline under row 6, so row 7 is the descender
                top, bot = (7 - r) * PH, (6 - r) * PH
                pen.moveTo((x0 * PW, bot)); pen.lineTo((x0 * PW, top)); pen.lineTo((x * PW, top)); pen.lineTo((x * PW, bot)); pen.closePath()
            else: x += 1
    return pen.glyph()
glyphs[".notdef"] = TTGlyphPen(None).glyph(); adv[".notdef"] = (800, 0)
for c in range(256):
    u = uni(c)
    if u is None or u in cmap: continue
    n = f"c{c:02x}"; order.append(n); glyphs[n] = draw(c); cmap[u] = n; adv[n] = (800, 0)
cmap[0xA0] = cmap[0x20]  # nbsp
fb = FontBuilder(960, isTTF=True)
fb.setupGlyphOrder(order); fb.setupCharacterMap(cmap); fb.setupGlyf(glyphs)
fb.setupHorizontalMetrics(adv); fb.setupHorizontalHeader(ascent=840, descent=-120)
fb.setupNameTable({"familyName": "AGI PC 8x8", "styleName": "Regular"})
fb.setupOS2(sTypoAscender=840, sTypoDescender=-120, sTypoLineGap=0, usWinAscent=840, usWinDescent=120)
fb.setupPost(isFixedPitch=1)
fb.save(sys.argv[2])
print("glyphs", len(order))
