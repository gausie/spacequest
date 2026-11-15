// native: the game's real output size; the CRT works on that, not the 1600x1200 capture.
// display: which monitor crt.js's plan() should model ('31khz' VGA, 'ega15', 'cga15', 'hercules', 'mac', '15khz-tv', 'tv').
// approx: shown, but the capture is a stand-in; the text says why.
// hidden: kept for when we find a copy, but left out of the site until then.
export const ALL_VERSIONS = [
  { id: "agi-pc-cga",   name: "PC CGA",        engine: "AGI", year: 1986, native: [320, 200], display: "cga15",
    about: "Four colours, cyan and magenta. The cheapest way to play in 1986." },
  { id: "agi-pc-herc",  name: "PC Hercules",   engine: "AGI", year: 1986, native: [640, 400], display: "hercules",
    about: "Monochrome high-res, with colours turned into dither patterns." },
  { id: "agi-pc-ega",   name: "PC EGA/Tandy",  engine: "AGI", year: 1986, native: [320, 200], display: "ega15",
    about: "The reference version: 16 colours at 160x200, pixels doubled across." },
  { id: "agi-atari-st", name: "Atari ST",      engine: "AGI", year: 1987, native: [320, 200], display: "15khz-tv",
    about: "Same pictures, the ST's own palette for the 16 EGA colours." },
  { id: "agi-amiga",    name: "Amiga",         engine: "AGI", year: 1987, native: [320, 200], display: "15khz-tv",
    about: "Amiga palette and better music." },
  { id: "agi-mac-bw",   name: "Macintosh B&W", engine: "AGI", year: 1987, native: [320, 200], display: "mac", hidden: true,
    about: "The original black-and-white Mac edition, colours turned into dither patterns." },
  { id: "agi-mac",      name: "Macintosh II",  engine: "AGI", year: 1988, native: [320, 200], display: "mac",
    about: "The 16-colour edition for the Mac II, with its own palette." },
  { id: "agi-apple2gs", name: "Apple IIgs",    engine: "AGI", year: 1987, native: [320, 200], display: "tv",
    about: "Its own palette and sampled sound; often called the best AGI port." },
  { id: "sci-pc-ega",   name: "PC EGA",        engine: "SCI", year: 1991, native: [320, 200], display: "ega15",
    about: "The remake for 16-colour machines: VGA art dithered down." },
  { id: "sci-pc-vga",   name: "PC VGA",        engine: "SCI", year: 1991, native: [320, 200], display: "31khz",
    about: "The 1991 remake: 256 colours, point-and-click interface." },
  { id: "sci-amiga",    name: "Amiga",         engine: "SCI", year: 1992, native: [320, 200], display: "15khz-tv", hidden: true,
    about: "The remake reduced to the Amiga's 32 colours." },
  { id: "sci-mac",      name: "Macintosh",     engine: "SCI", year: 1992, native: [320, 200], display: "mac",
    about: "The VGA remake on colour Macs." },
];

export const VERSIONS = ALL_VERSIONS.filter(v => !v.hidden);

export const SCENES = [
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
  { id: "sarien-ship", name: "The Deltaur in space" },
  { id: "deltaur",     name: "Deltaur hangar" },
  { id: "generator",   name: "Star Generator" },
  { id: "ending",      name: "Hero of Xenon" },
];

export const shotPath = (versionId, sceneId) => `shots/${versionId}/${sceneId}.png`;
