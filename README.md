# Space Quest I versions

Twelve moments from Space Quest I, framed identically across every release. Static site, no build step.

GPL v2 or later (see `LICENSE`). `crt.js` is The Paninos off-line's GPL port of DOSBox Staging's CRT shaders, taken from monkeyisland.pages.dev; notices in `licenses/`. The font is PxPlus IBM VGA 9x16 by VileR, CC BY-SA 4.0.

    python3 -m http.server 8000   # WebGL needs http://, not file://

## Adding screenshots

Until a capture exists the viewer shows a labelled placeholder. To add one:

1. Capture at native resolution (ScummVM: disable aspect correction and filters, 1x scaler, then Ctrl+Alt+S).
2. `./process.sh raw.png <version-id> <scene-id>` writes `shots/<version-id>/<scene-id>.png` at 1600x1200.

Version and scene ids live in `data.js`.

| Version | How to capture |
| --- | --- |
| AGI PC EGA / CGA / Hercules | ScummVM AGI, PC version, render mode EGA / CGA / Hercules |
| AGI Atari ST, Amiga, Mac, Apple IIgs | ScummVM AGI with that platform's game files |
| SCI PC EGA / VGA | ScummVM SCI with the EGA and VGA releases of the 1991 remake |
| SCI Amiga, Mac | ScummVM SCI with those releases |

The Hercules and Mac AGI versions aren't 320x200, so check `native` in `data.js` against your actual capture size and that the 1600x1200 scale looks right.
