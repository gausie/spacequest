// native: the game's real output size; the CRT works on that, not the 1600x1200 capture.
// frame: the 4:3 area the picture sits in, where that isn't the picture itself. Macs have square
//   pixels, so their 320x200 is wider than 4:3: it's letterboxed in a 320x240 frame (a 640x480
//   screen) instead of being stretched. The page adds the bars; the shot is just the picture.
// scale: a whole-number scale for the shot instead of fitting the frame to 1600x1200, where that
//   would be fractional and smear 1-bit dither patterns (the B&W Mac's 512 is 3.125x).
// display: which monitor crt.js's plan() should model ('31khz' VGA, 'ega15', 'cga15', 'hercules', 'mac', '15khz-tv', 'tv').
// approx: shown, but the capture is a stand-in; the text says why.
// hidden: kept for when we find a copy, but left out of the site until then.
export const ALL_VERSIONS = [
  { id: "agi-pc-cga",   name: "PC CGA",        engine: "AGI", year: 1986, native: [320, 200], display: "cga15" },
  { id: "agi-pc-herc",  name: "PC Hercules",   engine: "AGI", year: 1986, native: [640, 400], display: "hercules" },
  { id: "agi-pc-ega",   name: "PC EGA/Tandy",  engine: "AGI", year: 1986, native: [320, 200], display: "ega15" },
  { id: "agi-atari-st", name: "Atari ST",      engine: "AGI", year: 1987, native: [320, 200], display: "15khz-tv" },
  { id: "agi-amiga",    name: "Amiga",         engine: "AGI", year: 1987, native: [320, 200], display: "15khz-tv" },
  { id: "agi-mac-bw",   name: "Macintosh B&W", engine: "AGI", year: 1987, native: [512, 342], frame: [512, 384], scale: 3, display: "mac" },
  { id: "agi-mac",      name: "Macintosh II",  engine: "AGI", year: 1988, native: [320, 200], frame: [320, 240], display: "mac" },
  { id: "agi-apple2gs", name: "Apple IIgs",    engine: "AGI", year: 1987, native: [320, 200], display: "tv" },
  { id: "sci-pc-ega",   name: "PC EGA",        engine: "SCI", year: 1991, native: [320, 200], display: "ega15" },
  { id: "sci-pc-vga",   name: "PC VGA",        engine: "SCI", year: 1991, native: [320, 200], display: "31khz" },
  { id: "sci-amiga",    name: "Amiga",         engine: "SCI", year: 1992, native: [320, 200], display: "15khz-tv" },
  { id: "sci-mac",      name: "Macintosh",     engine: "SCI", year: 1992, native: [320, 200], frame: [320, 240], display: "mac" },
];

export const VERSIONS = ALL_VERSIONS.filter(v => !v.hidden);
export const frameOf = v => v.frame || v.native;
// A shot is the frame scaled to 1600x1200, cropped to the picture: 1600x1000 for a Mac.
export const shotSize = v => {
  const [nw, nh] = v.native, [fw, fh] = frameOf(v);
  if (v.scale) return [nw * v.scale, nh * v.scale];
  return [1600 * nw / fw, 1200 * nh / fh];
};
// Draw a shot back at its native pixels, centred in its frame on black: what the CRT shades.
export function frameCanvas(v, img) {
  const [nw, nh] = v.native, [fw, fh] = frameOf(v), c = document.createElement("canvas");
  c.width = fw; c.height = fh;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.fillStyle = "#000"; x.fillRect(0, 0, fw, fh);
  // The shot is nearest-scaled, so shrinking it back recovers the exact source pixels.
  x.imageSmoothingEnabled = false;
  x.drawImage(img, (fw - nw) / 2, (fh - nh) / 2, nw, nh);
  return { w: fw, h: fh, data: new Uint8Array(x.getImageData(0, 0, fw, fh).data.buffer) };
}

export const SCENES = [
  { id: "title",       name: "Title screen" },
  { id: "closet",      name: "Broom closet" },
  { id: "archive",     name: "Data archive" },
  { id: "pod-bay",     name: "Escape pod bay" },
  { id: "desert",      name: "Kerona desert" },
  { id: "spider",      name: "Spider droid" },
  { id: "crash",       name: "Kerona crash site" },
  { id: "orat",        name: "Orat's cave" },
  { id: "underground", name: "Keronian underground" },
  { id: "keronian",    name: "Keronian welcome" },
  { id: "bar",         name: "Ulence Flats bar" },
  { id: "slots",       name: "Slot machine" },
  { id: "dealer",      name: "Tiny's used ships" },
  { id: "sarien-ship", name: "Deltaur approach" },
  { id: "deltaur",     name: "Deltaur hangar" },
  { id: "generator",   name: "Star Generator" },
  { id: "ending",      name: "Hero of Xenon" },
];

export const shotPath = (versionId, sceneId) => `shots/${versionId}/${sceneId}.png`;
