// The parser line's vocabulary. parse() returns { run(act) } or { error } for the message box.
// A command is a verb (compare, zoom, ...) or just names: "orat", "vga", "bar amiga".

import { SCENES, VERSIONS } from "./data.ts";
import { type View, ZOOMS, type Zoom } from "./hooks/useView.ts";

// Everything a command can do, and so everything the menus and keys can too; App implements it.
export interface Actions {
  scene(index: number): void;
  version(index: number): void;
  toggleCompare(): void;
  compareWith(index: number): void;
  swap(): void;
  toggleCrt(): void;
  zoom(zoom: Zoom): void;
  cycleZoom(): void;
  // AGI's LOOK: the picture on screen (A), as big as the window allows.
  look(): void;
  link(): void;
  about(): void;
  help(): void;
  toggleAgiFont(): void;
}

export type Parsed = { run: (act: Actions) => void } | { error: string };

// Words a player would use for each scene and version, besides the words of its name.
const SCENE_WORDS: Record<string, string> = {
  title: "intro",
  closet: "janitor",
  archive: "library cartridge",
  "pod-bay": "escape",
  desert: "sand",
  spider: "droid",
  crash: "wreck",
  orat: "",
  underground: "",
  keronian: "hologram welcome",
  bar: "ulence band",
  slots: "slot",
  dealer: "tiny dealer ship",
  "sarien-ship": "space arrive arrival",
  deltaur: "hangar",
  generator: "star",
  ending: "xenon end hero mop",
};
const VERSION_WORDS: Record<string, string> = {
  "agi-pc-cga": "cga",
  "agi-pc-herc": "herc hercules mono",
  "agi-pc-ega": "ega tandy pc",
  "agi-atari-st": "st atari",
  "agi-amiga": "amiga",
  "agi-mac-bw": "bw b&w black white mac macintosh",
  "agi-mac": "mac macintosh ii colour color",
  "agi-apple2gs": "iigs gs apple",
  "sci-pc-ega": "ega pc",
  "sci-pc-vga": "vga pc",
  "sci-amiga": "amiga",
  "sci-mac": "mac macintosh",
};
const FILLER = new Set([
  "show",
  "go",
  "goto",
  "see",
  "view",
  "at",
  "to",
  "the",
  "in",
  "on",
  "with",
  "version",
  "scene",
  "me",
  "please",
]);

const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9&]+/)
    .filter(Boolean);
const sceneVocab = SCENES.map((s) => new Set([...words(s.name), ...words(SCENE_WORDS[s.id] || "")]));
const versionVocab = VERSIONS.map((v) => new Set([...words(v.name), ...words(VERSION_WORDS[v.id] || "")]));

// Best match by number of words hit; ties go to the first, or for versions to the engine shown.
function best(vocab: Set<string>[], ws: string[], prefer: (i: number) => number = () => 0) {
  let top = -1,
    score = 0;
  vocab.forEach((set, i) => {
    const s = ws.filter((w) => set.has(w)).length * 2 + prefer(i);
    if (ws.some((w) => set.has(w)) && s > score) {
      top = i;
      score = s;
    }
  });
  return top;
}

function findVersion(ws: string[], state: Pick<View, "a">) {
  const engine = ws.includes("agi") ? "AGI" : ws.includes("sci") ? "SCI" : null;
  const rest = ws.filter((w) => w !== "agi" && w !== "sci");
  const shown = VERSIONS[state.a].engine;
  const prefer = (i: number) =>
    engine ? (VERSIONS[i].engine === engine ? 1 : -99) : VERSIONS[i].engine === shown ? 1 : 0;
  if (!rest.length && engine) {
    // "sci" alone: the same machine in the other engine if there is one, else its first version.
    const same = VERSIONS.findIndex((v) => v.engine === engine && v.name === VERSIONS[state.a].name);
    return same >= 0 ? same : VERSIONS.findIndex((v) => v.engine === engine);
  }
  return best(versionVocab, rest, prefer);
}

export function parse(text: string, state: Pick<View, "a" | "comparing">): Parsed {
  const ws = words(text).filter((w) => !FILLER.has(w));
  const [verb, ...rest] = ws;
  switch (verb) {
    case undefined:
      return { error: "What do you want to see?" };
    case "help":
    case "h":
      return { run: (act) => act.help() };
    case "about":
    case "a":
    case "credits":
      return { run: (act) => act.about() };
    case "swap":
    case "s":
      return state.comparing ? { run: (act) => act.swap() } : { error: "There's nothing to swap: COMPARE first." };
    case "crt":
    case "r":
      return { run: (act) => act.toggleCrt() };
    case "font":
      return { run: (act) => act.toggleAgiFont() };
    // LOOK on its own zooms the picture; "look orat" just goes there.
    case "look":
      if (!rest.length) return { run: (act) => act.look() };
      return parse(rest.join(" "), state);
    case "link":
    case "l":
    case "copy":
      return { run: (act) => act.link() };
    case "zoom":
    case "z": {
      if (!rest.length) return { run: (act) => act.cycleZoom() };
      const z = parseInt(rest[0], 10) as Zoom;
      return ZOOMS.includes(z) ? { run: (act) => act.zoom(z) } : { error: "Zoom can be 1, 2 or 4." };
    }
    case "compare":
    case "c":
    case "vs": {
      if (!rest.length) return { run: (act) => act.toggleCompare() };
      const i = findVersion(rest, state);
      return i < 0 ? { error: `There's no version called "${rest.join(" ")}".` } : { run: (act) => act.compareWith(i) };
    }
    case "quit":
    case "exit":
      return { error: "You can't quit. You're on a website." };
  }
  const si = best(sceneVocab, ws),
    vi = findVersion(
      ws.filter((w) => !sceneVocab[si]?.has(w)),
      state,
    );
  if (si < 0 && vi < 0) return { error: `I don't understand "${text.trim()}".` };
  return {
    run: (act) => {
      if (si >= 0) act.scene(si);
      if (vi >= 0) act.version(vi);
    },
  };
}
