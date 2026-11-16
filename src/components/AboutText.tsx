// The CRT shaders' source, linked as the GPL asks (the site is built from this repository).
const CRT_SOURCE = "https://github.com/gausie/spacequest/blob/main/src/vendor/crt.ts";

import { GitHubMark } from "./GitHubMark.tsx";

export function AboutText() {
  return (
    <>
      <p>
        Made by{" "}
        <a href="https://github.com/gausie" target="_blank" rel="noreferrer">
          <GitHubMark />
          gausie
        </a>
        .
      </p>
      <p>
        Seventeen scenes from <i>Space Quest I: The Sarien Encounter</i> (Sierra On-Line, 1986), captured the same way
        in every version of the AGI original and the 1991 SCI remake.
      </p>
      <p>Captures are scaled to 1600x1200 with nearest-neighbour pixels, which also corrects 320x200 to 4:3.</p>
      <p>
        Inspired by{" "}
        <a href="https://monkeyisland.pages.dev/" target="_blank" rel="noreferrer">
          The Secret of Monkey Island: all 13 versions side by side
        </a>{" "}
        by The Paninos off-line.
      </p>
      <p>
        CRT:{" "}
        <a href={CRT_SOURCE} target="_blank" rel="noreferrer">
          crt.ts
        </a>{" "}
        by The Paninos off-line, a WebGL2 port of DOSBox Staging's CRT shaders (crt-hyllian: Hyllian and the DOSBox
        Staging Team, MIT; vga-1080p: the DOSBox Staging Team, GPL v2+; curvature, corners and vignette from
        crt-guest-advanced-hd: guest(r) and Dr. Venom, GPL v2+).{" "}
        <a href="licenses/crt-shaders-GPL.txt" target="_blank" rel="noreferrer">
          All notices
        </a>
        . Text font: PxPlus IBM VGA 9x16 by VileR, CC BY-SA 4.0.
      </p>
      <p>
        Free software under the{" "}
        <a href="licenses/GPL-2.0.txt" target="_blank" rel="noreferrer">
          GNU GPL v2 or later
        </a>
        . Fan-made, not affiliated with or endorsed by Sierra, Activision or Microsoft. Screenshots are used for
        comparison and commentary.
      </p>
    </>
  );
}
