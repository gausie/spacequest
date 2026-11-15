"""Render every AGI v2 PICTURE resource to PNG (160x168, EGA palette), for picking rooms.
Usage: python3 agipics.py <agi-data-dir> <out-dir>"""
import os, sys, struct, zlib

EGA = [(0,0,0),(0,0,170),(0,170,0),(0,170,170),(170,0,0),(170,0,170),(170,85,0),(170,170,170),
       (85,85,85),(85,85,255),(85,255,85),(85,255,255),(255,85,85),(255,85,255),(255,255,85),(255,255,255)]

def find(d, name):
    for f in os.listdir(d):
        if f.lower() == name: return os.path.join(d, f)

def resources(d, dirname):
    data = open(find(d, dirname), "rb").read()
    out = {}
    for i in range(len(data) // 3):
        b = data[i*3:i*3+3]
        if b == b"\xff\xff\xff": continue
        vol, off = b[0] >> 4, ((b[0] & 15) << 16) | (b[1] << 8) | b[2]
        v = open(find(d, f"vol.{vol}"), "rb").read()
        if v[off:off+2] != b"\x12\x34": continue
        ln = struct.unpack_from("<H", v, off + 3)[0]
        out[i] = v[off+5:off+5+ln]
    return out

def render(pic):
    W, H = 160, 168
    vis = bytearray([15]) * (W * H)
    col, on = 0, False
    i = 0
    def plot(x, y):
        if on and 0 <= x < W and 0 <= y < H: vis[y*W+x] = col
    def line(x1, y1, x2, y2):
        dx, dy = x2 - x1, y2 - y1
        steps = max(abs(dx), abs(dy))
        if steps == 0: plot(x1, y1); return
        for s in range(steps + 1):
            plot(x1 + round(dx * s / steps + 1e-9 * (1 if dx >= 0 else -1)), y1 + round(dy * s / steps))
    def fill(x, y):
        if not on or vis[y*W+x] != 15 or col == 15: return
        stack = [(x, y)]
        while stack:
            x, y = stack.pop()
            if not (0 <= x < W and 0 <= y < H) or vis[y*W+x] != 15: continue
            vis[y*W+x] = col
            stack += [(x+1, y), (x-1, y), (x, y+1), (x, y-1)]
    def args():
        nonlocal i
        a = []
        while i < len(pic) and pic[i] < 0xF0: a.append(pic[i]); i += 1
        return a
    while i < len(pic):
        op = pic[i]; i += 1
        if op == 0xFF: break
        if op == 0xF0: col, on = pic[i], True; i += 1
        elif op == 0xF1: on = False
        elif op in (0xF2, 0xF3):
            if op == 0xF2: i += 1
            else: pass
        elif op == 0xF4 or op == 0xF5:
            a = args()
            if len(a) < 2: continue
            x, y = a[0], a[1]; plot(x, y); k = 2; horiz = op == 0xF5
            while k < len(a):
                if horiz: line(x, y, a[k], y); x = a[k]
                else: line(x, y, x, a[k]); y = a[k]
                horiz = not horiz; k += 1
        elif op == 0xF6:
            a = args()
            for k in range(0, len(a) - 3, 2): line(a[k], a[k+1], a[k+2], a[k+3])
            if len(a) == 2: plot(a[0], a[1])
        elif op == 0xF7:
            a = args()
            if len(a) < 2: continue
            x, y = a[0], a[1]; plot(x, y)
            for b in a[2:]:
                dx = (b >> 4) & 7; dx = -dx if b & 0x80 else dx
                dy = b & 7; dy = -dy if b & 0x08 else dy
                line(x, y, x + dx, y + dy); x += dx; y += dy
        elif op == 0xF8:
            a = args()
            for k in range(0, len(a) - 1, 2): fill(a[k], a[k+1])
        elif op == 0xF9: i += 1
        elif op == 0xFA: args()  # brush plots: skipped, rare in backgrounds
    return vis

def png(path, pix, w, h, scale=2):
    raw = b""
    for y in range(h):
        row = bytearray([0])
        for x in range(w):
            r, g, b = EGA[pix[y*w+x]]
            row += bytes((r, g, b)) * scale
        raw += bytes(row) * 1
    rows = [raw[k*(w*3*scale+1):(k+1)*(w*3*scale+1)] for k in range(h)]
    raw = b"".join(r for r in rows for _ in range(1))
    def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w*scale, h, 8, 2, 0, 0, 0))
                           + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))

if __name__ == "__main__":
    src, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    pics = resources(src, "picdir")
    for n, p in sorted(pics.items()):
        png(os.path.join(out, f"pic{n:03d}.png"), render(p), 160, 168)
    print(len(pics), "pictures")
