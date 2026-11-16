# Capturing the screenshots

Everything in `public/shots/` is produced by one command:

    tools/capture/capture_all.sh            # every version
    tools/capture/capture_all.sh sci-mac    # or just some

It runs ScummVM headless in Docker, jumps to each scene's room with the debugger, grabs the
window off a virtual X display and publishes the result to `public/shots/`. Your screen and
keyboard aren't touched.

## Prerequisites

- Docker (Colima is fine). The image builds ScummVM from source with only the AGI and SCI
  engines, from the branch of scummvm/scummvm#8080 (for the B&W Mac mode), so the first build
  takes a few minutes.
- `ffmpeg` on the host, for `process.sh`.
- The game data in `games/<version-id>/` (gitignored), one folder per version holding just the
  files ScummVM reads; the three PC AGI versions share `games/agi-pc`. Notes on where each came
  from:

  | Version | Source |
  | --- | --- |
  | AGI Atari ST | recovered from a packed release with `st-unpack` (kept in `work/old-tools/`) |
  | AGI Mac II / Mac B&W | the same files from one HFS image; colour adds `Palette.bin` |
  | SCI Amiga | SPS IPF floppy images, converted to ADF with `disk-analyse` (built with capsimg) and unpacked with `amitools` |

  Downloads, disk images and installer leftovers live in `work/originals/` (gitignored).
- Output goes to `work/cap/docker/` (gitignored): `raw/` straight from ScummVM, `final/` after
  postprocessing; `process.sh` then writes `public/shots/`.

## scenes.json

- `versions`: how to start each version (game id, data path, render mode, native size, keys
  to get past the intro, debugger commands to run after the room change, cursor handling).
- `scenes`: per engine, the room for each scene and its `state`: every on-screen object's
  view, loop, cel and position at the chosen moment. Optional per scene:
  - `wait`: seconds after entering the room at which the state was recorded, and at which it
    is applied (`stage_at` overrides the latter, e.g. to apply it before a message opens);
  - `debug` (before the room change) and `setup` (after it; `{room}` is the SCI room
    object) debugger commands, e.g. `setflag 101 1` or `vv g 178 2` start the spider droid;
  - `dismiss` (SCI): close message boxes as they appear;
  - `ignore`: objects the room moves every frame (set, but not checked);
  - `cels`: per version, a different cel for an object where the versions number their frames
    differently (the EGA SCI Orat's closed mouth is cel 4, VGA's is cel 3).
- `reference`: the version each engine's states are recorded from.

Rooms were all confirmed by looking at the frames, using:

    docker compose run --rm capture survey <version> 1-110       # one frame per room
    docker compose run --rm capture burst <version> <room> 8 1   # frames over time

and states are (re)recorded from the reference version with:

    docker compose run --rm capture record agi [scene ...]
    docker compose run --rm capture record sci [scene ...]

A recorded state is plain data: SCI Roger was then placed by hand to match the AGI shot
(same facing, equivalent spot). `record sci --merge` keeps those edits and only adds objects
the stored state doesn't have yet.

Anything the game picks at random has to be pinned before the room is entered, or versions
end up showing different things: the SCI bar's band is global 170, but entering Ulence Flats
resets it, so that scene starts in the slot machine room (44), sets it, then goes to the bar.
The AGI bar rolls its band (v43) as the room loads, so there the state simply sets the band
object to the Blues Brothers (view 73, loop 1) at the spot logic 70 uses for it.

## How a scene is captured

ScummVM is built with its text console, so capture.py drives the debugger over a pty and
reads its answers (the Dockerfile also patches a crash in the AGI `runopcode` command, and adds
the B&W Mac render mode below).

1. Start ScummVM fresh, get past the intro, `room N`, run the scene's setup commands, wait.
2. Pause in the debugger and apply the recorded state to every object, freezing it:
   AGI `runopcode` (`stop.motion`, `stop.cycling`, `set.loop`, `fix.loop`, `set.cel`,
   `reposition.to`, erase/draw); SCI `send` (no motion, cycler or script, then view, loop,
   cel, x, y, z; the room's own script is stopped too, and Roger's head stops looking around).
3. Let the game draw one moment, pause again and read the state back. Only if it matches is
   the window grabbed (while paused), otherwise it tries again. So every version shows exactly
   the same moment, drawn from its own data.
4. The OpenGL backend scales the game by an exact integer (pixel-perfect), so `normalize()`
   crops and samples it back to native resolution, and refuses the frame if any scaled block
   isn't one colour (a cursor or overlay).
5. Cursors: the pointer is parked outside the window. SCI games keep their own cursor on
   screen, so two frames are taken with it in opposite corners and the corners swapped.
6. `postprocess.py` trims the score bar and parser line (AGI) or the icon bar strip (SCI),
   centres the playfield on a black native-size canvas, and `process.sh` scales it to
   1600x1200.

Scenes without a `state` fall back to a timed screenshot (`wait`), with `align` picking the
frame closest to the reference version.

## Black-and-white Mac

ScummVM's AGI engine has no B&W Mac mode, so the image builds ScummVM from the branch of
scummvm/scummvm#8080, which adds `macintoshbw` (see `SCUMMVM_REF` in the Dockerfile). It copies
what the B&W interpreter's 68k code does: each colour is an 8x8 pattern from its `PAT#` 1001
resource, dithered into a 640x336 bitmap (4x2 pixels per AGI pixel). Pictures tile the
patterns by screen position; cels take the pattern row from the rows left to draw and restart
the column with every RLE run. The real interpreter then copied it to the 512x342 screen without the
last column of each AGI pixel (480x336). ScummVM keeps a 640x400 screen by drawing the first
pattern column twice instead, so `postprocess.py` drops one of those (`keep_columns: [[1, 2, 3],
4]`), which gives the real screen's pixels, and centres it on a `canvas` of 512x342. Text isn't reproduced (the Mac drew it in its own windows with its own fonts), but the
crop removes it anyway.
