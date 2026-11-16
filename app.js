import { VERSIONS, SCENES, frameCanvas } from "./data.js";
import { setShot, isMissing } from "./shots.js";
import { crtParams } from "./crtsettings.js";
import { installCursor } from "./cursor.js";
import { initMenus, openMenu, close as closeMenu } from "./menus.js";
import { parse } from "./parser.js";

const $ = s => document.querySelector(s);
const state = { scene: 0, a: 2, b: 8, zoom: 1, crt: false, compare: false, split: 50 };
const crtOK = window.CRT?.supported();

/* ---------- CRT ---------- */
const layers = ["A", "B"].map(k => {
  const el = $(`#layer${k}`), img = el.querySelector("img"), canvas = el.querySelector("canvas");
  let renderer = null;
  if (crtOK) try { renderer = new CRT.Renderer(canvas); } catch (e) { console.error(e); }
  return { img, canvas, renderer, v: null };
});

function drawCRT(layer) {
  const { img, canvas, renderer, v } = layer;
  if (!state.crt || !renderer || !img.complete || !img.naturalWidth) return;
  renderer.setSource(frameCanvas(v, img));
  const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
  const { plan, params } = crtParams(v, canvas.height);
  renderer.draw(params, { flat: plan.flat, half: plan.half });
}
const redrawCRT = () => layers.forEach(drawCRT);

function loadLayer(layer, vi) {
  layer.v = VERSIONS[vi];
  setShot(layer.img, layer.v, SCENES[state.scene], () => drawCRT(layer));
  // Reassigning the same src doesn't fire load again, so toggling CRT on needs a direct draw.
  if (layer.img.complete && layer.img.naturalWidth) drawCRT(layer);
}

/* ---------- message box ---------- */
function msg(html, kind = "") {
  // The text scrolls inside the frame, so the frame stays put on a long message.
  $("#msgbox").innerHTML = `<button class="msgclose" aria-label="Close">X</button><div class="scroll msgbody">${html}</div>`;
  $("#msgbox .msgclose").onclick = closeMsg;
  $("#msgbox").className = `box msgbox ${kind}`;
  $("#msgwrap").hidden = false;
  fitMsg();  // only once shown: hidden, everything measures 0
  $("#msgbox").focus();
}
// A few pixels of rounding overflow shouldn't show a scrollbar that scrolls nowhere.
function fitMsg() {
  const b = $(".msgbody"); if (!b) return;
  b.classList.remove("fits");
  b.classList.toggle("fits", b.scrollHeight - b.clientHeight <= 4);
}
const msgOpen = () => !$("#msgwrap").hidden;
function closeMsg() { $("#msgwrap").hidden = true; $("#cmd").focus(); }
$("#msgbox").tabIndex = -1;
// Clicks inside the box (selecting text, links) leave it open; outside it, they close it.
$("#msgwrap").onclick = e => { if (!e.target.closest("#msgbox")) closeMsg(); };
const about = () => msg($("#t-about").innerHTML);
// Clicking the screen shows that picture as big as the window allows, in a message box.
function zoomShot(layer) {
  const v = layer.v, s = SCENES[state.scene];
  msg(`<p class="zcap">${s.name}: ${v.engine} ${v.name}, ${v.year}</p><img class="zimg" alt="" src="${layer.img.src}">`, "zoom");
}
const help = () => msg($("#t-help").innerHTML);

/* ---------- rendering ---------- */
function renderScenes() {
  $("#scenes").replaceChildren(...SCENES.map((s, i) => {
    const b = document.createElement("button");
    b.className = "scene";
    b.innerHTML = `<span>${s.name}</span>`;
    b.setAttribute("aria-current", i === state.scene);
    b.onclick = () => { state.scene = i; update(); };
    return b;
  }));
}

function renderThumbs() {
  const s = SCENES[state.scene];
  $("#thumbs").replaceChildren(...VERSIONS.map((v, i) => {
    const b = document.createElement("button");
    b.className = "thumb";
    b.dataset.key = `${v.id}/${s.id}`;
    b.classList.toggle("a", i === state.a);
    b.classList.toggle("b", state.compare && i === state.b);
    b.classList.toggle("missing", isMissing(v, s));
    const mark = i === state.a ? (state.compare ? "A" : "→") : state.compare && i === state.b ? "B" : "";
    b.innerHTML = `<img alt="" draggable="false"><small>${v.year} ${v.engine}${v.approx ? " *" : ""}</small><small data-mark="${mark}">${v.name}</small>`;
    setShot(b.querySelector("img"), v, s);
    b.draggable = true;
    b.ondragstart = e => { e.dataTransfer.setData("text/plain", i); document.body.classList.add("dragging"); };
    b.ondragend = () => document.body.classList.remove("dragging");
    b.onclick = e => { if (state.compare && e.shiftKey) state.b = i; else state.a = i; update(); };
    return b;
  }));
}

// The ◄ ► cells show only when the strip can scroll that way; each click moves about a box-width.
const strip = $(".vers .scroll"), scrollers = document.querySelectorAll(".vscroll");
function updateScrollers() {
  const end = strip.scrollWidth - strip.clientWidth;
  scrollers.forEach(b => { b.hidden = +b.dataset.dir < 0 ? strip.scrollLeft <= 1 : strip.scrollLeft >= end - 1; });
}
scrollers.forEach(b => b.onclick = () => strip.scrollBy({ left: +b.dataset.dir * strip.clientWidth * 0.8, behavior: "smooth" }));
strip.addEventListener("scroll", updateScrollers, { passive: true });

// The screen at 1x is as big as the window allows: its column's width, or less when the
// height runs out (the view's height less the versions box under it). Zoom keeps the frame
// that size and scrolls a bigger screen inside it.
function fitScreen() {
  const f = $("#frame"), sc = $("#screen"), view = $("#v-viewer"), vs = getComputedStyle(view);
  if (!f.parentElement.clientWidth) return;  // viewer hidden; measured again when it's shown
  const w0 = f.parentElement.clientWidth;
  // On narrow screens the page scrolls instead (the view isn't fixed to the window).
  const h = vs.position === "absolute"
    ? view.clientHeight - parseFloat(vs.paddingTop) - parseFloat(vs.paddingBottom) - $(".vers").offsetHeight - parseFloat(vs.rowGap)
    : Infinity;
  // A multiple of 4 so the height is a whole number too: a half pixel brings back scrollbars.
  const w = Math.floor(Math.min(w0, h * 4 / 3) / 4) * 4;
  f.style.width = `${w}px`; f.style.height = `${w * 3 / 4}px`;
  sc.style.width = `${w * state.zoom}px`;
}

// The status line: what you're looking at, where AGI had "Score:0 of 202 ... Sound:on".
function statusText() {
  const s = SCENES[state.scene], A = VERSIONS[state.a], B = VERSIONS[state.b];
  const ver = v => `${v.engine} ${v.name}`;
  return [`${s.name}`, state.compare ? `${ver(A)} │ ${ver(B)}` : `${ver(A)}, ${A.year}, ${A.native.join("x")}`];
}

function update() {
  const A = VERSIONS[state.a];
  document.body.classList.toggle("crt", state.crt && crtOK);
  document.body.classList.toggle("compare", state.compare);
  fitScreen();
  $("#screen").style.setProperty("--split", `${state.split}%`);
  $("#handle").hidden = $("#handleBtn").hidden = !state.compare;
  const [l, r] = statusText();
  $("#stLeft").textContent = l; $("#stRight").textContent = r + (A.approx ? " *" : "");
  loadLayer(layers[0], state.a);
  if (state.compare) loadLayer(layers[1], state.b);
  renderScenes(); renderThumbs();
  document.querySelector(".thumb.a")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  updateScrollers();
  document.querySelector(".scene[aria-current=true]")?.scrollIntoView({ block: "nearest" });
  writeHash();
}

function writeHash() {
  const p = new URLSearchParams({ s: SCENES[state.scene].id, a: VERSIONS[state.a].id });
  if (state.compare) p.set("b", VERSIONS[state.b].id);
  if (state.crt) p.set("crt", "1");
  if (state.zoom !== 1) p.set("z", state.zoom);
  history.replaceState(null, "", `#${p}`);
}

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const si = SCENES.findIndex(s => s.id === p.get("s")); if (si >= 0) state.scene = si;
  const ai = VERSIONS.findIndex(v => v.id === p.get("a")); if (ai >= 0) state.a = ai;
  const bi = VERSIONS.findIndex(v => v.id === p.get("b")); if (bi >= 0) { state.b = bi; state.compare = true; }
  state.crt = p.get("crt") === "1";
  if ([1, 2, 4].includes(+p.get("z"))) state.zoom = +p.get("z");
  if (p.get("v") === "about") about();
}

// Reading text is in the VGA font (body.vga in the page); the AGI 8x8 for everything is a
// per-viewer choice.
const agiFont = () => !document.body.classList.contains("vga");
function setAgiFont(on) {
  document.body.classList.toggle("vga", !on);
  try { localStorage.setItem("sq-font", on ? "agi" : ""); } catch {}
  fitScreen(); updateScrollers();
}
try { if (localStorage.getItem("sq-font") === "agi") document.body.classList.remove("vga"); } catch {}

/* ---------- actions (menus, parser and keys all go through these) ---------- */
async function copyLink() {
  try { await navigator.clipboard.writeText(location.href); msg("<p>The link to this view has been copied.</p>"); }
  catch { msg(`<p>Couldn't copy the link. Here it is:</p><p>${location.href}</p>`); }
}
const act = {
  scene: i => { state.scene = i; update(); },
  version: i => { state.a = i; update(); },
  compare: (i = null) => { if (i !== null) { state.b = i; state.compare = true; } else state.compare = !state.compare; update(); },
  swap: () => { [state.a, state.b] = [state.b, state.a]; update(); },
  crt: () => { if (!crtOK) return msg("<p>This browser has no WebGL2, so no CRT.</p>"); state.crt = !state.crt; update(); },
  zoom: z => { state.zoom = z ?? ({ 1: 2, 2: 4, 4: 1 })[state.zoom]; update(); },
  link: copyLink, about, help,
  font: () => setAgiFont(!agiFont()),
};

const logo = () => $("#t-logo").content.firstElementChild.cloneNode(true);
document.querySelector(".logo-slot").replaceWith(logo());
initMenus([
  { title: "Sierra", icon: logo(), items: () => [
    { label: "About these versions", run: about },
    { label: "Help", keys: "<F1>", run: help },
  ] },
  { title: "Special", items: () => [
    { label: "Compare", keys: "<F2>", check: state.compare, run: () => act.compare() },
    { label: "Swap A and B", keys: "<F3>", disabled: !state.compare, run: act.swap },
    "-",
    { label: "Copy link", keys: "<F9>", run: copyLink },
  ] },
  { title: "Display", items: () => [
    ...[1, 2, 4].map(z => ({ label: `Zoom ${z}x`, radio: state.zoom === z, run: () => act.zoom(z) })),
    { label: "CRT", keys: "<F4>", check: state.crt, disabled: !crtOK, run: act.crt },
    "-",
    { label: "Use AGI font", check: agiFont(), run: act.font },
  ] },
]);

$("#parser").onsubmit = e => {
  e.preventDefault();
  const input = $("#cmd"), text = input.value;
  input.value = "";
  if (!text.trim()) return;
  const r = parse(text, state);
  if (r.error) return msg(`<p>${r.error}</p>`);
  r.run(act);
};

const screen = $("#screen");
$("#handleBtn").onpointerdown = e => {
  const t = e.currentTarget;
  t.setPointerCapture(e.pointerId);
  t.onpointermove = ev => {
    const r = screen.getBoundingClientRect();
    state.split = Math.min(100, Math.max(0, ((ev.clientX - r.left) / r.width) * 100));
    screen.style.setProperty("--split", `${state.split}%`);
  };
  t.onpointerup = () => { t.onpointermove = null; };
};

screen.onclick = e => {
  if (e.target.closest(".handle, .hbtn")) return;
  const r = screen.getBoundingClientRect();
  // When comparing, the side you clicked.
  const right = state.compare && (e.clientX - r.left) / r.width * 100 > state.split;
  zoomShot(layers[right ? 1 : 0]);
};
screen.ondragover = e => e.preventDefault();
screen.ondrop = e => {
  e.preventDefault();
  document.body.classList.remove("dragging");
  const i = +e.dataTransfer.getData("text/plain"), r = screen.getBoundingClientRect();
  if (e.clientX - r.left > r.width / 2) { state.b = i; state.compare = true; } else state.a = i;
  update();
};

// Letters go to the parser, as in the game. Arrows browse, function keys do what the menus say.
const FKEYS = { F1: help, F2: () => act.compare(), F3: () => state.compare && act.swap(), F4: act.crt, F9: copyLink };
document.addEventListener("keydown", e => {
  if (msgOpen()) {
    if (["Enter", "Escape"].includes(e.key) && !e.target.closest("a, button:not(.msgclose)")) { e.preventDefault(); closeMsg(); }
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest("#dropdown")) return;
  if (FKEYS[e.key]) { e.preventDefault(); return FKEYS[e.key](); }
  if (e.key === "Escape") { e.preventDefault(); if (!closeMenu()) openMenu(); return; }
  const cmd = $("#cmd"), typing = cmd.value !== "";
  const n = VERSIONS.length, m = SCENES.length;
  if (e.key === "ArrowDown") state.scene = (state.scene + 1) % m;
  else if (e.key === "ArrowUp") state.scene = (state.scene - 1 + m) % m;
  else if (e.key === "ArrowRight" && !typing) state.a = (state.a + 1) % n;
  else if (e.key === "ArrowLeft" && !typing) state.a = (state.a - 1 + n) % n;
  else {
    // Anything typed lands in the parser, wherever the focus was.
    if (e.key.length === 1 && document.activeElement !== cmd) cmd.focus();
    return;
  }
  e.preventDefault(); update();
});

let resizeTimer;
window.addEventListener("resize", () => { fitScreen(); updateScrollers(); fitMsg(); clearTimeout(resizeTimer); resizeTimer = setTimeout(redrawCRT, 100); });

installCursor();
readHash(); update();
// The font changes the boxes' sizes, so fit again once it's in.
document.fonts.ready.then(() => { fitScreen(); updateScrollers(); });
$("#cmd").focus();
