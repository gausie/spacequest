// The parser line. A sentence is matched against a list of rules, AGI style: each has patterns of
// words ("look orat", "zoom *") and either a reply or what to do. Failing those it's taken as the
// names of a scene and a version: "orat", "vga", "bar amiga".

import { SCENES, VERSIONS } from "./data.ts";
import { type View, type ViewSetters, ZOOMS, type Zoom } from "./hooks/useView.ts";

// The view's setters, with App free to wrap any of them (it doesn't wait on the URL updating).
type Setters = { [K in keyof ViewSetters]: (...args: Parameters<ViewSetters[K]>) => void };

// Everything a command can do, and so everything the menus and keys can too: the view's setters
// and what App adds.
export interface Actions extends Setters {
  // AGI's LOOK: the picture on screen (A), as big as the window allows.
  look(): void;
  link(): void;
  save(): void;
  restart(): void;
  about(): void;
  help(): void;
  toggleAgiFont(): void;
}

export type Parsed = { run: (act: Actions) => void } | { reply: string };
type State = Pick<View, "scene" | "a" | "comparing">;

// A pattern is words, where "*" stands for any number of words (even none) and PROFANITY for any
// one of those. A rule's answer is a reply, or for a pattern ending in "*", a function of the
// words that star took.
interface Rule {
  said: string[];
  answer: string | ((rest: string[], state: State) => Parsed);
}

// Dropped wherever they are: "show me the orat", "go to the bar".
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
// Dropped after the first word: "order a beer", "check out the orat". (A alone is ABOUT.)
const ARTICLES = new Set(["a", "an", "some", "of", "into", "from", "my", "your", "out", "around", "up"]);
// Each word on the left is read as the one on the right, on both sides of a match.
const SYNONYMS: Record<string, string> = {
  examine: "look",
  inspect: "look",
  check: "look",
  speak: "talk",
  chat: "talk",
  ask: "talk",
  get: "take",
  grab: "take",
  pick: "take",
  acquire: "take",
  remove: "take",
  attack: "kill",
  hit: "kill",
  punch: "kill",
  shoot: "kill",
  fight: "kill",
  consume: "eat",
  bite: "eat",
  sip: "drink",
  ale: "beer",
  brew: "beer",
  craft: "ship",
  spaceship: "ship",
  spacecraft: "ship",
  boulder: "rock",
  stone: "rock",
  rocks: "rock",
  bush: "plant",
  spinach: "plant",
  barman: "bartender",
  barkeep: "bartender",
  body: "man",
  corpse: "man",
  crewman: "man",
  scientist: "man",
  guy: "man",
  hologram: "head",
  purchase: "buy",
  order: "buy",
  nap: "sleep",
  rest: "sleep",
  strip: "undress",
  room: "area",
  surroundings: "area",
  myself: "self",
  roger: "self",
  wilco: "self",
  clothes: "self",
  outfit: "self",
  uniform: "self",
  machine: "slots",
  slot: "slots",
  gamble: "play",
  bet: "play",
  pull: "play",
  droid: "spider",
  planets: "planet",
  stars: "space",
  window: "port",
  repair: "fix",
};
const PROFANITY = new Set(["asshole", "fuck", "fucking", "shit", "damn", "bastard", "crap", "bitch", "piss"]);

const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9&]+/)
    .filter(Boolean);

const run =
  (f: (act: Actions) => void): Rule["answer"] =>
  () => ({ run: f });

const COMMANDS: Rule[] = [
  { said: ["help", "h"], answer: run((act) => act.help()) },
  { said: ["about", "a", "credits"], answer: run((act) => act.about()) },
  {
    said: ["swap", "s"],
    answer: (_, state) =>
      state.comparing ? { run: (act) => act.swap() } : { reply: "There's nothing to swap: COMPARE first." },
  },
  { said: ["crt", "r"], answer: run((act) => act.toggleCrt()) },
  { said: ["font"], answer: run((act) => act.toggleAgiFont()) },
  // LOOK on its own zooms the picture; "look orat" just goes there.
  { said: ["look *"], answer: (rest, state) => (rest.length ? parseWords(rest, state) : { run: (act) => act.look() }) },
  { said: ["link", "l", "copy"], answer: run((act) => act.link()) },
  {
    said: ["zoom *", "z *"],
    answer: (rest) => {
      if (!rest.length) return { run: (act) => act.cycleZoom() };
      const z = parseInt(rest[0], 10) as Zoom;
      return ZOOMS.includes(z) ? { run: (act) => act.zoom(z) } : { reply: "Zoom can be 1, 2 or 4." };
    },
  },
  {
    said: ["compare *", "c *", "vs *"],
    answer: (rest, state) => {
      if (!rest.length) return { run: (act) => act.toggleCompare() };
      const i = findVersion(rest, state);
      return i < 0 ? { reply: `There's no version called "${rest.join(" ")}".` } : { run: (act) => act.compareWith(i) };
    },
  },
  { said: ["save"], answer: run((act) => act.save()) },
  { said: ["restore"], answer: run((act) => act.reset()) },
  { said: ["restart"], answer: run((act) => act.restart()) },
  { said: ["quit", "exit"], answer: "You can't quit. You're on a website." },
];

// Sierra's own replies from the PC AGI game (1987), lightly adapted, for things that aren't
// site commands. A scene's own list only applies while it's on screen, and comes first.
const REPLIES: Rule[] = [
  { said: ["* PROFANITY *"], answer: "A mind is a terrible thing to waste." },
  { said: ["jump *"], answer: "Sorry. This site is in a NO JUMPING zone." },
  { said: ["run *"], answer: "You can't run." },
  { said: ["sleep *", "climb sleep"], answer: "You've already had your nap!" },
  { said: ["who *"], answer: `You are Roger Wilco. Don't you remember?` },
  { said: ["undress *", "take off self"], answer: "I'll get naked if you get naked. You go first." },
  {
    said: ["take off helmet", "take helmet", "open helmet"],
    answer:
      "You just can't do that. Really. It's not a good idea. Besides, your dental hygiene hasn't been what it should. Do the universe a favor.",
  },
  { said: ["look ceiling", "look sky"], answer: "Nothing up there is going to help you." },
  { said: ["look floor", "look ground", "look down"], answer: "There is nothing there that you can't already see." },
  { said: ["listen *"], answer: "You can't hear anything of note." },
  { said: ["drink *"], answer: "I'll bet you wish you still had that dehydrated water." },
  { said: ["kick *"], answer: "Just the thought makes your toes hurt!" },
  { said: ["open *", "close *"], answer: "That doesn't seem to be the correct action in this case." },
  { said: ["inventory", "inv"], answer: "You possess 0 buckazoid(s)." },
  { said: ["mop *", "clean *", "sweep *"], answer: "Once a janitor always a janitor." },
  {
    said: ["scott *", "murphy"],
    answer: `Hello, Roger. I've been expecting you. You're obviously a person of dubious taste.`,
  },
  { said: ["ken sent"], answer: "Wrong game, pal. Lefty's is in Lost Wages." },
  {
    said: ["mark *", "crowe", "two guys *", "andromeda"],
    answer: "Space Quest was designed and created by Mark Crowe and Scott Murphy, the Two Guys From Andromeda.",
  },
];

const TWISTED = "Good grief, Roger! You are a bit twisted, I must say.";
// What Roger has on, which changes over the game.
const ON_THE_ARCADA = "You are wearing a lovely one-piece casual space travel outfit.";
const ON_KERONA = "You are dressed in the standard issue excursion garment.";
const IN_DISGUISE = "You are attired in the spiffy uniform of a Sarien marauder.";
const lookSelf = (answer: string): Rule => ({ said: ["look self"], answer });

const SCENE_REPLIES: Record<string, Rule[]> = {
  closet: [
    lookSelf(ON_THE_ARCADA),
    { said: ["look man"], answer: "This is another one of your non-functional crewmates. It's a grisly sight." },
    { said: ["search man", "explore man"], answer: "A quick search of the body turns up nothing." },
    {
      said: ["undress man", "take self man"],
      answer:
        "One can only wonder what your purpose for this action is. You can't undress the body. Allow him one last bit of dignity.",
    },
    { said: ["look elevator"], answer: "This is an elevator to one of the lower levels." },
    { said: ["look wall"], answer: "You see nothing that catches your eye." },
    { said: ["kick man"], answer: TWISTED },
  ],
  archive: [
    lookSelf(ON_THE_ARCADA),
    {
      said: ["look area"],
      answer:
        "This is the Arcada's data archive. Many volumes of information are stored on data cartridges. There is a computer console here.",
    },
    { said: ["look table"], answer: "The table is used for holding things above the floor." },
    { said: ["look chair"], answer: "It looks much like many other chairs you have seen in your lifetime." },
    { said: ["sit *"], answer: "You don't have time to be sitting around." },
    { said: ["look door"], answer: "This is another boring door." },
    {
      said: ["look keyboard"],
      answer:
        'The keyboard has the usual keys found on a Xenon keyboard. Above it are the words "Arcada Data Archive."',
    },
    {
      said: ["look wall", "look shelf", "look shelves", "look cartridges"],
      answer:
        "Looking at the wall you see shelves full of data cartridges which can only be removed by the retrieval unit.",
    },
    {
      said: ["look man"],
      answer:
        "A large laser hole has been burned in his uniform through which you can see previously unexposed tissue. Struggling painfully, he raises up on one elbow.",
    },
    { said: ["talk *"], answer: "In his current condition, the man is not much of a conversationalist." },
    { said: ["help man", "aid man"], answer: "It's a grisly sight. There is nothing you can do for him now." },
    { said: ["kick man"], answer: TWISTED },
  ],
  "pod-bay": [
    lookSelf(ON_THE_ARCADA),
    { said: ["look area"], answer: "This is the cavernous Vehicle Bay." },
    { said: ["look wall"], answer: "The walls prove to be uninteresting." },
    { said: ["look space"], answer: "You see stars to infinity." },
    { said: ["look planet"], answer: "There sure are a lot of them." },
    {
      said: ["look pod", "look ship"],
      answer:
        "This is one of the Arcada's escape pods. You vaguely remember receiving some orientation on these when you joined the crew.",
    },
    { said: ["climb *"], answer: "No can do, bud." },
    {
      said: ["press *", "push *"],
      answer: "For safety reasons the platform will not function with the bay doors closed.",
    },
  ],
  desert: [
    lookSelf(ON_KERONA),
    {
      said: ["look rock", "look arch"],
      answer:
        'You see a pair of oddly curved rock formations. They point at each other as if to form an arch. Near the base you notice some very small printing. If you\'re not mistaken the characters translate to "497 Quadgillion Served."',
    },
    {
      said: ["drink *"],
      answer:
        "You place your lips to the nozzle and draw. A fluid, not a very reasonable facsimile of water, is released slowly. While tasting slightly terrible, it quenches your thirst, at least for the time being.",
    },
    { said: ["open *"], answer: `You can't do that. Read the label, Roger!` },
    {
      said: ["read *"],
      answer:
        'The can label says "Pelvitron\'s Dehydrated Water (H2) - All you add is air! Makes 10 gallons!" Directions - To use, simply drink from nozzle. Caution - Do not attempt to open or rupture! Misuse could result in personal injury and/or flash flooding.',
    },
  ],
  spider: [
    lookSelf(ON_KERONA),
    {
      said: ["look area"],
      answer: "You are in a unique area. There is a natural land bridge here as well as life in the form of plants.",
    },
    { said: ["look rock"], answer: "There is a very large rock on the natural bridge." },
    { said: ["look plant"], answer: "It looks a lot like spinach." },
    { said: ["take plant"], answer: "You tear off a piece of the plant." },
    { said: ["smoke *"], answer: "The Health Minister has determined that smoking is hazardous to your health." },
    { said: ["smell *"], answer: "You take a whiff of the plant and find it to be a regrettable experience." },
    {
      said: ["eat *"],
      answer:
        "You plant your teeth into the strange plant and take a large bite, only to find it tastes exquisitely bad. If you had your choice you would choose any form of death over a meal of this.",
    },
    {
      said: ["look spider"],
      answer:
        "You shiver at the sight of the spider droid with its spindly legs and cold metallic body. Its red scanner probing the terrain for anything that moves. Truly an icon of terror.",
    },
  ],
  crash: [
    lookSelf(ON_KERONA),
    {
      said: ["look area"],
      answer: "You seem to be located in an incredibly remote area. There is a thrashed escape pod here.",
    },
    {
      said: ["look pod", "look ship"],
      answer:
        "The pod seems to be semi-destroyed. A glimmering catches your eye. Upon closer inspection you see that a piece of highly reflective glass has broken out of the pod window.",
    },
    { said: ["look port"], answer: "The window was shattered by the impact of landing." },
    { said: ["kick *"], answer: "That's an interesting form of entertainment." },
    { said: ["fix *"], answer: "The pod is definitely destroyed beyond repair. You can't help it." },
  ],
  orat: [
    lookSelf(ON_KERONA),
    { said: ["look area"], answer: "You are in the slimiest of caves. The odor in here is less than desirable." },
    {
      said: ["look orat"],
      answer:
        "Orat is huge and ugly. Of course, your opinion may differ depending on what part of the universe you come from. It should also be mentioned that he is quite mean.",
    },
    { said: ["talk *"], answer: "Orat is a guy of few words and none of them are for you." },
    { said: ["kill *"], answer: "How do you intend to do that." },
    {
      said: ["pet *", "hug *", "kiss *", "stroke *"],
      answer: TWISTED,
    },
    {
      said: ["move rock", "push rock"],
      answer:
        "You have trouble moving your own carcass around. You sure can't move something that weighs several times more than you.",
    },
    {
      said: ["take *"],
      answer:
        "You reach down and take the Orat part in your hand. Some of it oozes to fill the space between your fingers.",
    },
    {
      said: ["eat *"],
      answer:
        "You raise the Orat part to your mouth and attempt to feast on it. Unfortunately for you it is composed mainly of bone. The small amount of flesh still clinging to the bone is incredibly rancid in flavor. You wisely give up on this idea.",
    },
  ],
  underground: [
    lookSelf(ON_KERONA),
    {
      said: ["look pool", "look water", "look liquid"],
      answer:
        "You gaze intently at the purplish pool of liquid, the first real sign of moisture on the planet. The pool seems to have no bottom. The gentle dripping has a soothing effect on your frazzled nerves.",
    },
    {
      said: ["look drip", "look drips"],
      answer: "From tiny cracks in the ceiling several small drops succumb to the influence of gravity.",
    },
    { said: ["drink *"], answer: "That can't be done now." },
  ],
  keronian: [
    lookSelf(ON_KERONA),
    { said: ["look area"], answer: "It's pretty darn dark in here." },
    {
      said: ["look head", "look keronian"],
      answer: "Before you is a huge head. It appears to be a projection of some sort. Its source is unknown.",
    },
    { said: ["talk *"], answer: "Your words go unnoticed." },
  ],
  bar: [
    lookSelf(ON_KERONA),
    {
      said: ["look area", "look bar"],
      answer:
        "This is a seedy little place. Galactic riff-raff are seated at the bar. The bartender drops by occasionally to serve them. A band is cranking out some of the more popular tunes in the quadrant. No one seems to notice or care that you have entered the bar.",
    },
    {
      said: ["look band"],
      answer: "There is a hip combo of green beings jamming. They only seem to be interested in playing music.",
    },
    { said: ["talk band"], answer: "They are not interested in you." },
    {
      said: ["look bartender"],
      answer: "The bartender is a compact looking gent. He seems to be about as friendly as the patrons.",
    },
    {
      said: ["talk bartender"],
      answer: "The bartender is only interested in selling his wares. He is of no help otherwise.",
    },
    {
      said: ["talk *"],
      answer: "No one here seems willing to acknowledge your presence. Maybe they're not too fond of humanoids.",
    },
    { said: ["listen *"], answer: 'The only thing you hear when attempting to eavesdrop is "Eat felch, humanoid!"' },
    {
      said: ["sit *"],
      answer:
        "There are no surfaces on which to place your posterior other than the floor and you don't want to do that.",
    },
    {
      said: ["kick *", "kill *"],
      answer: "It's not advisable to be trying anything aggressive here since you are out-numbered.",
    },
    { said: ["buy beer", "beer", "take beer"], answer: '"That\'ll be $2.00. Thank you very much. Come again."' },
    {
      said: ["drink *"],
      answer:
        "The beer tastes like carbonated Zipple sweat. However, considering recent events, you could learn to love it.",
    },
    {
      said: ["buy wine", "wine", "take wine", "drink wine"],
      answer: '"Wine? Did I say we have wine? Hey did you hear this humanoid? He wants wine! Get serious!"',
    },
    {
      said: ["look sweeper", "look spider"],
      answer:
        "The sweeper is a small motorized device which scans the floor for debris and removes it within moments of detection. There is nothing special about it, otherwise.",
    },
  ],
  slots: [
    lookSelf(ON_KERONA),
    { said: ["look area", "look slots"], answer: "You are presently standing in front of a slot machine." },
    { said: ["play *"], answer: "YOU LOSE, HOMEBOY!!!" },
    { said: ["cash *"], answer: "You're broke! Hit the road, freeloader!" },
    {
      said: ["kick *"],
      answer:
        "That act, while providing a means of venting frustration, serves only to cause you considerable pain when your toes scatter in directions they weren't designed to travel. Wise up, Space Cadet!",
    },
  ],
  dealer: [
    lookSelf(ON_KERONA),
    { said: ["look sign"], answer: "There is a sign here which indicates that this is Tiny's Used Space Ship Lot." },
    {
      said: ["look banner", "look banners"],
      answer:
        "There are some decorative banners which would seem to indicate that making a purchase at Tiny's can be a festive occasion.",
    },
    {
      said: ["look ship"],
      answer:
        "You are standing near one of Tiny's used spacecraft. Upon close inspection they appear to have quite a few kilometers on them.",
    },
    {
      said: ["look tiny", "look dealer"],
      answer:
        "What can be said that isn't seen? Tiny is a large, red skin-covered beast with the personality of a true salesman. Not a prime combination of traits.",
    },
    { said: ["talk *"], answer: "Tiny's not a great conversationalist. He just wants to sell, sell, sell." },
    {
      said: ["test *", "fly *", "drive *"],
      answer:
        '"Sorry, you can only fly it when you buy it. Oh, by the way, there are no refunds either. Company Policy."',
    },
    {
      said: ["buy *"],
      answer:
        "\"So what are ya trying to pull? If you don't have the cash you can hit the road. Go on, get out of here. You're wasting my time!\"",
    },
    { said: ["climb *", "look hole"], answer: "Stay out of the hole!" },
  ],
  "sarien-ship": [
    {
      said: ["look ship", "look deltaur", "look area"],
      answer:
        "Before you lies the Sarien battle cruiser, Deltaur. An imposingly massive ship. Now you understand why the Arcada was so easily overtaken. Your first instinct is to turn the ship around and head for home. But, answer you realize that unless you do something to try to stop the Sariens, there will be no home.",
    },
  ],
  deltaur: [
    lookSelf(IN_DISGUISE),
    { said: ["look area"], answer: "You are in the shuttle launch bay aboard the Sarien ship." },
    { said: ["look wall"], answer: "You don't have much time before this ship blows." },
    { said: ["look ship"], answer: "The ship is a one-man transport vessel." },
    {
      said: ["board *", "climb *"],
      answer: "You swiftly slip into the sleek ship. (Try to say that three times fast.)",
    },
  ],
  generator: [
    lookSelf(IN_DISGUISE),
    {
      said: ["look area"],
      answer: "You are inside an enormous chamber. Before you stands the stolen Star Generator.",
    },
    { said: ["take generator"], answer: "It is permanently attached to the floor." },
    { said: ["look door"], answer: "There is no door here. Are you blind?" },
    {
      said: ["look wall"],
      answer: "Don't you have anything better to do than to stand around and look at walls?",
    },
    { said: ["jump *", "climb *"], answer: "Don't be ridiculous!" },
    {
      said: ["spit *"],
      answer:
        "You gather up a nice mouth full and let it fly. Unfortunately, you forgot you were wearing a helmet. The warm saliva oozes down the side of your face. You feel rather stupid.",
    },
    {
      said: ["press *", "push *"],
      answer:
        "If you started the force field from this close, you would be immediately vaporized. The universe would lose its most valuable janitor! Perhaps you should reconsider.",
    },
  ],
  ending: [
    {
      said: ["look mop"],
      answer: `As a token of appreciation, you are presented with a golden mop. "Thank you, Roger, for cleaning up our galaxy," says the Xenon leader.`,
    },
    {
      said: ["look self", "look area"],
      answer: `Congratulations Roger, you've rid the universe of the evil Sariens and saved your people from certain doom. You're an all-around hero!`,
    },
  ],
};

const synonym = (w: string) => SYNONYMS[w] ?? w;
const compile = (rules: Rule[]) => rules.map((r) => ({ ...r, said: r.said.map((p) => p.split(" ").map(synonym)) }));
// Replies before commands, so "look ceiling" isn't taken as LOOK at a scene called ceiling.
const GLOBAL_RULES = compile([...REPLIES, ...COMMANDS]);
const SCENE_RULES = Object.fromEntries(Object.entries(SCENE_REPLIES).map(([id, rules]) => [id, compile(rules)]));

function matches(pattern: string[], ws: string[]): boolean {
  if (!pattern.length) return !ws.length;
  const [p, ...rest] = pattern;
  if (p === "*") return ws.some((_, i) => matches(rest, ws.slice(i))) || matches(rest, []);
  if (!ws.length) return false;
  if (p === "PROFANITY" ? PROFANITY.has(ws[0]) : p === ws[0]) return matches(rest, ws.slice(1));
  return false;
}

const sceneVocab = SCENES.map((s) => new Set([...words(s.name), ...words(s.words ?? "")]));
const versionVocab = VERSIONS.map((v) => new Set([...words(v.name), ...words(v.words ?? "")]));

const isName = (w: string) =>
  w === "agi" || w === "sci" || sceneVocab.some((v) => v.has(w)) || versionVocab.some((v) => v.has(w));

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

export const parse = (text: string, state: State): Parsed =>
  parseWords(
    words(text).filter((w, i) => !FILLER.has(w) && !(i > 0 && ARTICLES.has(w))),
    state,
  );

function parseWords(ws: string[], state: State): Parsed {
  if (!ws.length) return { reply: "What do you want to see?" };
  // Rules see synonyms as one word ("examine" is "look"); names are matched as typed.
  const said = ws.map(synonym);
  for (const rule of [...(SCENE_RULES[SCENES[state.scene].id] ?? []), ...GLOBAL_RULES]) {
    const pattern = rule.said.find((p) => matches(p, said));
    if (!pattern) continue;
    if (typeof rule.answer === "string") return { reply: rule.answer };
    return rule.answer(ws.slice(pattern.indexOf("*")), state);
  }
  // A verb we don't know shouldn't quietly go to the scene it's about ("pet orat").
  if (!isName(ws[0])) return { reply: `I don't understand "${ws[0]}".` };
  const si = best(sceneVocab, ws),
    vi = findVersion(
      ws.filter((w) => !sceneVocab[si]?.has(w)),
      state,
    );
  if (si < 0 && vi < 0) return { reply: `I don't understand "${ws.join(" ")}".` };
  return {
    run: (act) => {
      if (si >= 0) act.scene(si);
      if (vi >= 0) act.version(vi);
    },
  };
}
