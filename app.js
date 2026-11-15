import { VERSIONS, SCENES } from "./data.js";
import { setShot, isMissing } from "./shots.js";
import { crtParams } from "./crtsettings.js";
import { initLab, openLab } from "./lab.js";
import { initWindows, showAll } from "./windows.js";
import { installCursor } from "./cursor.js";
import { initMenus, close as closeMenu } from "./menus.js";

const $ = s => document.querySelector(s);
const state = { view: "viewer", scene: 0, a: 2, b: 8, zoom: 1, crt: false, compare: false, split: 50 };
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
  // The capture is nearest-scaled, so shrinking it back to native size recovers the exact source pixels.
  const [w, h] = v.native, tmp = document.createElement("canvas");
  tmp.width = w; tmp.height = h;
  const ctx = tmp.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, w, h);
  renderer.setSource({ w, h, data: new Uint8Array(ctx.getImageData(0, 0, w, h).data.buffer) });
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

/* ---------- rendering ---------- */
function renderScenes() {
  $("#scenes").replaceChildren(...SCENES.map((s, i) => {
    const b = document.createElement("button");
    b.className = "scene";
    b.innerHTML = `<span class="n">${String(i + 1).padStart(2, "0")}</span> ${s.name}`;
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
    b.innerHTML = `<img alt="" draggable="false"><small class="yr">${v.year} · ${v.engine}${v.approx ? " *" : ""}</small><small>${v.name}</small>`;
    setShot(b.querySelector("img"), v, s);
    b.draggable = true;
    b.ondragstart = e => { e.dataTransfer.setData("text/plain", i); document.body.classList.add("dragging"); };
    b.ondragend = () => document.body.classList.remove("dragging");
    b.onclick = e => { if (state.compare && e.shiftKey) state.b = i; else state.a = i; update(); };
    return b;
  }));
}

function renderInfo() {
  const show = v => `<h2>${v.engine} · ${v.name}</h2>
    <dl><dt>Year</dt><dd>${v.year}</dd><dt>Engine</dt><dd>${v.engine}</dd><dt>Native</dt><dd>${v.native.join("x")}</dd></dl>
    <p>${v.about}</p>${v.approx ? `<p class="approx">⚠ ${v.approx}</p>` : ""}`;
  const A = VERSIONS[state.a], B = VERSIONS[state.b];
  $("#info").innerHTML = show(A) + (state.compare ? `<div class="ab">${show(B)}</div>` : "");
}

function renderWall() {
  const s = SCENES[state.scene];
  $("#wallTitle").textContent = `The wall · ${s.name}`;
  $("#wall").replaceChildren(...VERSIONS.map((v, i) => {
    const b = document.createElement("button");
    b.dataset.key = `${v.id}/${s.id}`;
    b.innerHTML = `<img alt=""><span>${v.year} · ${v.engine} ${v.name}</span>`;
    setShot(b.querySelector("img"), v, s);
    b.onclick = () => { state.a = i; state.view = "viewer"; update(); };
    return b;
  }));
}

function update() {
  const s = SCENES[state.scene], A = VERSIONS[state.a], B = VERSIONS[state.b];
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("on", v.id === `v-${state.view}`));
  document.querySelectorAll(".menu-btn").forEach(b => b.setAttribute("aria-pressed", b.dataset.view === state.view));
  document.body.classList.toggle("crt", state.crt && crtOK);
  document.body.classList.toggle("compare", state.compare);
  $("#screen").style.width = `${state.zoom * 100}%`;
  $("#screen").style.setProperty("--split", `${state.split}%`);
  $("#handle").hidden = !state.compare;
  $("#bSwap").hidden = !state.compare;
  $("#bCompare").setAttribute("aria-pressed", state.compare);
  $("#bCrt").setAttribute("aria-pressed", state.crt);
  $("#bCrt").disabled = !crtOK;
  document.querySelectorAll("[data-zoom]").forEach(b => b.setAttribute("aria-pressed", +b.dataset.zoom === state.zoom));
  $("#caption").textContent = state.compare
    ? `${s.name} · A: ${A.engine} ${A.name} │ B: ${B.engine} ${B.name}`
    : `${s.name} · ${A.engine} ${A.name}, ${A.year}`;
  if (state.view === "viewer") {
    loadLayer(layers[0], state.a);
    if (state.compare) loadLayer(layers[1], state.b);
    renderScenes(); renderThumbs(); renderInfo();
    document.querySelector(".thumb.a")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  if (state.view === "wall") renderWall();
  if (state.view === "lab") openLab(state.a, state.scene);
  if (state.view === "about") showAll($("#v-about"));
  writeHash();
}

function writeHash() {
  const p = new URLSearchParams({ s: SCENES[state.scene].id, a: VERSIONS[state.a].id });
  if (state.compare) p.set("b", VERSIONS[state.b].id);
  if (state.crt) p.set("crt", "1");
  if (state.zoom !== 1) p.set("z", state.zoom);
  if (state.view !== "viewer") p.set("v", state.view);
  history.replaceState(null, "", `#${p}`);
}

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const si = SCENES.findIndex(s => s.id === p.get("s")); if (si >= 0) state.scene = si;
  const ai = VERSIONS.findIndex(v => v.id === p.get("a")); if (ai >= 0) state.a = ai;
  const bi = VERSIONS.findIndex(v => v.id === p.get("b")); if (bi >= 0) { state.b = bi; state.compare = true; }
  state.crt = p.get("crt") === "1";
  if ([1, 2, 4].includes(+p.get("z"))) state.zoom = +p.get("z");
  if (["wall", "lab", "about"].includes(p.get("v"))) state.view = p.get("v");
}

/* ---------- controls ---------- */
document.querySelectorAll(".menu-btn[data-view]").forEach(b => b.onclick = () => { state.view = b.dataset.view; update(); });

const nextZoom = () => ({ 1: 2, 2: 4, 4: 1 })[state.zoom];
// The ≡ menu lists the views, with a mark on the current one.
const VIEWS = [["viewer", "Viewer", "v"], ["wall", "The wall", "w"], ["lab", "CRT lab", "b"], ["about", "About", "a"]];
initMenus({
  views: () => VIEWS.map(([id, label, hot]) => ({
    label, hot, keys: hot.toUpperCase(), radio: state.view === id,
    disabled: id === "lab" && !crtOK, run: () => { state.view = id; update(); },
  })),
});
$("#counts").textContent = `${VERSIONS.length} versions · ${SCENES.length} scenes · ${VERSIONS.length * SCENES.length} screens`;
$("#bCompare").onclick = () => { state.compare = !state.compare; update(); };
$("#bSwap").onclick = () => { [state.a, state.b] = [state.b, state.a]; update(); };
$("#bCrt").onclick = () => { state.crt = !state.crt; update(); };
document.querySelectorAll("[data-zoom]").forEach(b => b.onclick = () => { state.zoom = +b.dataset.zoom; update(); });
$("#bLink").onclick = async () => {
  const b = $("#bLink"), html = b.innerHTML;
  try { await navigator.clipboard.writeText(location.href); b.textContent = "Copied"; }
  catch { b.textContent = "Copy failed"; }
  setTimeout(() => { b.innerHTML = html; }, 1200);
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

screen.ondragover = e => e.preventDefault();
screen.ondrop = e => {
  e.preventDefault();
  document.body.classList.remove("dragging");
  const i = +e.dataTransfer.getData("text/plain"), r = screen.getBoundingClientRect();
  if (e.clientX - r.left > r.width / 2) { state.b = i; state.compare = true; } else state.a = i;
  update();
};

document.addEventListener("keydown", e => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest("input, select, #dropdown")) return;
  const n = VERSIONS.length, m = SCENES.length, k = e.key.toLowerCase();
  if (k === "arrowright") state.a = (state.a + 1) % n;
  else if (k === "arrowleft") state.a = (state.a - 1 + n) % n;
  else if (k === "arrowdown") state.scene = (state.scene + 1) % m;
  else if (k === "arrowup") state.scene = (state.scene - 1 + m) % m;
  else if (k === "c") state.compare = !state.compare;
  else if (k === "s") [state.a, state.b] = [state.b, state.a];
  else if (k === "r") state.crt = !state.crt;
  else if (k === "l") return $("#bLink").click();
  else if (k === "z") state.zoom = nextZoom();
  else if (k === "escape") { if (closeMenu() || state.view === "viewer") return; state.view = "viewer"; }
  else if (["1", "2", "4"].includes(k)) state.zoom = +k;
  else if (k === "v") state.view = "viewer";
  else if (k === "w") state.view = "wall";
  else if (k === "b") state.view = "lab";
  else if (k === "a") state.view = "about";
  else return;
  e.preventDefault(); update();
});

let resizeTimer;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(redrawCRT, 100); });

installCursor();
initWindows();
if (crtOK) initLab(redrawCRT);
readHash(); update();
