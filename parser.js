// The parser line's vocabulary. parse() returns { run(act) } or { error } for the message box.
// A command is a verb (compare, zoom, ...) or just names: "orat", "vga", "bar amiga".
import { VERSIONS, SCENES } from "./data.js";

// Words a player would use for each scene and version, besides the words of its name.
const SCENE_WORDS = {
  title: "intro", closet: "janitor", archive: "library cartridge", "pod-bay": "escape", desert: "sand",
  spider: "droid", crash: "wreck", orat: "", underground: "", keronian: "hologram welcome",
  bar: "ulence band", slots: "slot", dealer: "tiny dealer ship", "sarien-ship": "space arrive arrival", deltaur: "hangar",
  generator: "star", ending: "xenon end hero mop",
};
const VERSION_WORDS = {
  "agi-pc-cga": "cga", "agi-pc-herc": "herc hercules mono", "agi-pc-ega": "ega tandy pc", "agi-atari-st": "st atari",
  "agi-amiga": "amiga", "agi-mac-bw": "bw b&w black white mac macintosh", "agi-mac": "mac macintosh ii colour color",
  "agi-apple2gs": "iigs gs apple", "sci-pc-ega": "ega pc", "sci-pc-vga": "vga pc", "sci-amiga": "amiga", "sci-mac": "mac macintosh",
};
const FILLER = new Set(["show", "go", "goto", "see", "view", "look", "at", "to", "the", "in", "on", "with", "version", "scene", "me", "please"]);

const words = s => s.toLowerCase().split(/[^a-z0-9&]+/).filter(Boolean);
const sceneVocab = SCENES.map(s => new Set([...words(s.name), ...words(SCENE_WORDS[s.id] || "")]));
const versionVocab = VERSIONS.map(v => new Set([...words(v.name), ...words(VERSION_WORDS[v.id] || "")]));

// Best match by number of words hit; ties go to the first, or for versions to the engine shown.
function best(vocab, ws, prefer = () => 0) {
  let top = -1, score = 0;
  vocab.forEach((set, i) => {
    const s = ws.filter(w => set.has(w)).length * 2 + prefer(i);
    if (ws.some(w => set.has(w)) && s > score) { top = i; score = s; }
  });
  return top;
}

function findVersion(ws, state) {
  const engine = ws.includes("agi") ? "AGI" : ws.includes("sci") ? "SCI" : null;
  const rest = ws.filter(w => w !== "agi" && w !== "sci");
  const shown = VERSIONS[state.a].engine;
  const prefer = i => engine ? (VERSIONS[i].engine === engine ? 1 : -99) : (VERSIONS[i].engine === shown ? 1 : 0);
  if (!rest.length && engine) {
    // "sci" alone: the same machine in the other engine if there is one, else its first version.
    const same = VERSIONS.findIndex(v => v.engine === engine && v.name === VERSIONS[state.a].name);
    return same >= 0 ? same : VERSIONS.findIndex(v => v.engine === engine);
  }
  return best(versionVocab, rest, prefer);
}

export function parse(text, state) {
  const ws = words(text).filter(w => !FILLER.has(w));
  const [verb, ...rest] = ws;
  switch (verb) {
    case undefined: return { error: "What do you want to see?" };
    case "help": case "h": return { run: act => act.help() };
    case "about": case "a": case "credits": return { run: act => act.about() };
    case "swap": case "s": return state.compare ? { run: act => act.swap() } : { error: "There's nothing to swap: COMPARE first." };
    case "crt": case "r": return { run: act => act.crt() };
    case "font": return { run: act => act.font() };
    case "link": case "l": case "copy": return { run: act => act.link() };
    case "zoom": case "z": {
      const z = parseInt(rest[0], 10);
      if (rest.length && ![1, 2, 4].includes(z)) return { error: "Zoom can be 1, 2 or 4." };
      return { run: act => act.zoom(rest.length ? z : undefined) };
    }
    case "compare": case "c": case "vs": {
      if (!rest.length) return { run: act => act.compare() };
      const i = findVersion(rest, state);
      return i < 0 ? { error: `There's no version called "${rest.join(" ")}".` } : { run: act => act.compare(i) };
    }
    case "quit": case "exit": return { error: "You can't quit. You're on a website." };
  }
  const si = best(sceneVocab, ws), vi = findVersion(ws.filter(w => !sceneVocab[si]?.has(w)), state);
  if (si < 0 && vi < 0) return { error: `I don't understand "${text.trim()}".` };
  return { run: act => { if (si >= 0) act.scene(si); if (vi >= 0) act.version(vi); } };
}
