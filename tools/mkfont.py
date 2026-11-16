# Usage: python3 mkfont.py <scummvm>/graphics/fonts/dosfont.cpp src/assets/agi-pc-8x8.ttf  (needs fonttools)
# Builds the PC BIOS 8x8 font (what PC AGI draws its text with) as a TTF with AGI's pixel shape
# on a 4:3 screen. font-size is one 8-row cell.
import re, sys
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

PIXEL_WIDTH, PIXEL_HEIGHT = 100, 120  # font units: 1 wide by 1.2 tall, as on a 4:3 screen
CELL = 8
UNITS_PER_EM = CELL * PIXEL_HEIGHT
ADVANCE = CELL * PIXEL_WIDTH
# The baseline is under row 6, so row 7 holds the descenders.
ASCENT, DESCENT = 7 * PIXEL_HEIGHT, PIXEL_HEIGHT
# What the PC shows for bytes 0-31 (0 is blank), which cp437 decoding gives as control codes.
CP437_LOW_GLYPHS = " ☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼"

source = open(sys.argv[1]).read()
array = source[source.index("fontData_PCBIOS[256 * 8] = {"):]
array = array[array.index("{") + 1 : array.index("};")]
array = re.sub(r"//[^\n]*|/\*.*?\*/", "", array, flags=re.S)  # its comments hold hex too
bitmap = [int(x, 16) for x in re.findall(r"0x([0-9A-Fa-f]{2})", array)]
assert len(bitmap) == 256 * CELL, len(bitmap)


def unicode_for(byte):
    if byte == 0: return None
    if byte < 32: return ord(CP437_LOW_GLYPHS[byte])
    if byte == 127: return ord("⌂")
    return ord(bytes([byte]).decode("cp437"))


def glyph_for(byte):
    pen = TTGlyphPen(None)
    for row in range(CELL):
        bits, x = bitmap[byte * CELL + row], 0
        top, bottom = (7 - row) * PIXEL_HEIGHT, (6 - row) * PIXEL_HEIGHT
        while x < CELL:
            if bits & (0x80 >> x):
                run_start = x
                while x < CELL and bits & (0x80 >> x): x += 1
                pen.moveTo((run_start * PIXEL_WIDTH, bottom)); pen.lineTo((run_start * PIXEL_WIDTH, top))
                pen.lineTo((x * PIXEL_WIDTH, top)); pen.lineTo((x * PIXEL_WIDTH, bottom)); pen.closePath()
            else:
                x += 1
    return pen.glyph()


order, glyphs, cmap, metrics = [".notdef"], {".notdef": TTGlyphPen(None).glyph()}, {}, {".notdef": (ADVANCE, 0)}
for byte in range(256):
    u = unicode_for(byte)
    if u is None or u in cmap: continue
    name = f"c{byte:02x}"
    order.append(name); glyphs[name] = glyph_for(byte); cmap[u] = name; metrics[name] = (ADVANCE, 0)
cmap[ord("\N{NO-BREAK SPACE}")] = cmap[ord(" ")]

font = FontBuilder(UNITS_PER_EM, isTTF=True)
font.setupGlyphOrder(order); font.setupCharacterMap(cmap); font.setupGlyf(glyphs)
font.setupHorizontalMetrics(metrics); font.setupHorizontalHeader(ascent=ASCENT, descent=-DESCENT)
font.setupNameTable({"familyName": "AGI PC 8x8", "styleName": "Regular"})
font.setupOS2(sTypoAscender=ASCENT, sTypoDescender=-DESCENT, sTypoLineGap=0, usWinAscent=ASCENT, usWinDescent=DESCENT)
font.setupPost(isFixedPitch=1)
font.save(sys.argv[2])
print("glyphs", len(order))
