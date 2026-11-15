"""Print each AGI v2 logic's messages (decrypted). Usage: agimsgs.py <dir> [keyword...]"""
import sys, struct
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from agipics import resources
KEY = b"Avis Durgan"
d, kws = sys.argv[1], [k.lower() for k in sys.argv[2:]]
for n, r in sorted(resources(d, "logdir").items()):
    mo = struct.unpack_from("<H", r, 0)[0] + 2
    cnt = r[mo]; tbl = mo + 3
    blob = bytes(b ^ KEY[i % 11] for i, b in enumerate(r[tbl + cnt*2:]))
    text = blob.replace(b"\x00", b" | ").decode("latin1")
    if not kws or any(k in text.lower() for k in kws):
        print(f"--- logic {n}: {text[:300]}")
