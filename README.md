# Space Quest I versions

Seventeen scenes from Space Quest I, captured the same way in every release. Vite, React and TypeScript; builds to a static site.

GPL v2 or later (see `LICENSE`). `src/vendor/crt.ts` is The Paninos off-line's GPL port of DOSBox Staging's CRT shaders, taken from monkeyisland.pages.dev and adapted into a TypeScript module; notices in `public/licenses/`. `src/assets/agi-pc-8x8.ttf` is the IBM PC BIOS 8x8 font that AGI used, built by `tools/mkfont.py` from ScummVM's `graphics/fonts/dosfont.cpp` (`python3 tools/mkfont.py dosfont.cpp src/assets/agi-pc-8x8.ttf`, needs fonttools). The text font is PxPlus IBM VGA 9x16 by VileR, CC BY-SA 4.0.

    pnpm install
    pnpm dev          # http://localhost:5173
    pnpm build        # type-checks, then writes the static site to dist/
    pnpm lint         # Biome: recommended rules, React and CSS; `pnpm fix` formats and fixes

`src/components/` has one React component per file, starting from `App.tsx`, each with its own CSS module (class names come out as `Thumb_label`); `src/global.css` has only the fonts, colour and size variables and base element styles, and `Box.module.css` the AGI frame that other modules `composes:`. The view lives in
the query string (nuqs, in `src/hooks/useView.ts`), keys are react-hotkeys-hook
(`src/hooks/useGlobalKeys.ts`), and menus, keys and the parser all act through the `Actions` in `src/parser.ts`. The CRT is `src/hooks/useCrt.ts`. Screenshots and other files served as-is are in `public/`.

## Adding screenshots

To add a capture:

1. Capture at native resolution (ScummVM: disable aspect correction and filters, 1x scaler, then Ctrl+Alt+S).
2. `./process.sh raw.png <version-id> <scene-id>` writes `public/shots/<version-id>/<scene-id>.png` at 1600x1200.

Version and scene ids live in `src/data.ts`.

| Version                              | How to capture                                               |
| ------------------------------------ | ------------------------------------------------------------ |
| AGI PC EGA / CGA / Hercules          | ScummVM AGI, PC version, render mode EGA / CGA / Hercules    |
| AGI Atari ST, Amiga, Mac, Apple IIgs | ScummVM AGI with that platform's game files                  |
| SCI PC EGA / VGA                     | ScummVM SCI with the EGA and VGA releases of the 1991 remake |
| SCI Amiga, Mac                       | ScummVM SCI with those releases                              |

The Hercules and Mac AGI versions aren't 320x200, so check `native` in `src/data.ts` against your actual capture size and that the 1600x1200 scale looks right.
