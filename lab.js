import { VERSIONS, SCENES, frameCanvas } from "./data.js";
import { settings, save, reset, crtParams, HYLLIAN, TUBE, TUBE_CONTROLS, MONITORS } from "./crtsettings.js";
import { loadShot } from "./shots.js";

const $ = s => document.querySelector(s);
const lab = { v: 2, scene: 0, show: "crt", zoom: 1, cx: 0.5, cy: 0.5, split: 0.5 };
let renderer = null, source = null, onChange = () => {};

export function initLab(changed) {
  onChange = changed;
  try { renderer = new CRT.Renderer($("#labCanvas")); }
  catch (e) { $("#labMsg").hidden = false; $("#labMsg").textContent = "This browser has no WebGL2, so no CRT."; return; }

  document.querySelectorAll("[data-labview]").forEach(b => b.onclick = () => { lab.show = b.dataset.labview; draw(); });
  document.querySelectorAll("[data-labzoom]").forEach(b => b.onclick = () => { lab.zoom = +b.dataset.labzoom; draw(); });
  $("#labReset").onclick = () => { reset(); renderPanel(); draw(); onChange(); };

  // Drag the picture to pan when zoomed; drag the handle to move the split.
  const scr = $("#labScreen");
  scr.addEventListener("pointerdown", e => {
    if (e.target.closest("#labHandle") || lab.zoom === 1) return;
    scr.setPointerCapture(e.pointerId);
    const r = scr.getBoundingClientRect(), sx = e.clientX, sy = e.clientY, cx = lab.cx, cy = lab.cy;
    scr.onpointermove = ev => {
      lab.cx = cx - (ev.clientX - sx) / r.width / lab.zoom;
      lab.cy = cy - (ev.clientY - sy) / r.height / lab.zoom;
      draw();
    };
    scr.onpointerup = () => { scr.onpointermove = null; };
  });
  const h = $("#labHandle");
  h.addEventListener("pointerdown", e => {
    h.setPointerCapture(e.pointerId);
    h.onpointermove = ev => {
      const r = scr.getBoundingClientRect();
      lab.split = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
      draw();
    };
    h.onpointerup = () => { h.onpointermove = null; };
  });
  new ResizeObserver(() => draw()).observe(scr);
}

export function openLab(vi, scene) {
  lab.v = vi; lab.scene = scene;
  renderMachine();
  loadSource();
}

function renderMachine() {
  const list = VERSIONS.map((v, i) => `<button class="scene" data-i="${i}" aria-current="${i === lab.v}">
    <span class="n">${v.engine}</span> ${v.name}</button>`).join("");
  $("#labMachine").innerHTML = list;
  $("#labMachine").querySelectorAll("button").forEach(b => b.onclick = () => openLab(+b.dataset.i, lab.scene));
}

function loadSource() {
  const v = VERSIONS[lab.v], s = SCENES[lab.scene];
  loadShot(v, s, img => {
    source = frameCanvas(v, img);
    renderer.setSource(source);
    renderPanel();
    draw();
  });
}

function current() {
  const c = $("#labCanvas");
  return crtParams(VERSIONS[lab.v], c.height * lab.zoom);
}

function draw() {
  if (!renderer || !source) return;
  const c = $("#labCanvas"), r = $("#labScreen").getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
  const { plan, params, display } = current();
  const z = lab.zoom, half = 0.5 / z;
  lab.cx = Math.min(Math.max(lab.cx, half), 1 - half);
  lab.cy = Math.min(Math.max(lab.cy, half), 1 - half);
  const view = [lab.cx - half, lab.cy - half, 1 / z, 1 / z];
  const oimage = lab.show === "raw" ? 2 : lab.show === "split" ? lab.split : -1;
  renderer.draw({ ...params, oimage }, { view, flat: plan.flat, half: plan.half });

  $("#labHandle").parentElement.hidden = lab.show !== "split";
  $("#labHandle").parentElement.style.left = `${lab.split * 100}%`;
  document.querySelectorAll("[data-labview]").forEach(b => b.setAttribute("aria-pressed", b.dataset.labview === lab.show));
  document.querySelectorAll("[data-labzoom]").forEach(b => b.setAttribute("aria-pressed", +b.dataset.labzoom === z));
  const v = VERSIONS[lab.v];
  $("#labCaption").textContent = `${v.engine} ${v.name} · ${SCENES[lab.scene].name}`;
  $("#labPlan").innerHTML = `<dl>
    <dt>Monitor</dt><dd>${MONITORS[display] || display}</dd>
    <dt>Preset</dt><dd>${plan.name}</dd>
    <dt>Scanlines</dt><dd>${plan.scan}, ${plan.k.toFixed(2)} px each</dd>
    <dt>Answer</dt><dd>${plan.off ? "DOSBox would switch the CRT off here" : plan.flat ? "too small: lines blended" : plan.half ? "half-line rows" : plan.aa ? "antialiased" : "whole pixels"}</dd></dl>`;
}

function slider(key, label, min, max, step, value, def, set) {
  const row = document.createElement("label");
  row.className = "sl";
  const fmt = n => (step >= 1 ? String(n) : (+n).toFixed(step < 0.01 ? 3 : 2));
  row.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${value}"><output>${fmt(value)}</output>`;
  row.classList.toggle("changed", value !== def);
  const input = row.querySelector("input"), out = row.querySelector("output");
  input.oninput = () => { out.textContent = fmt(input.value); row.classList.toggle("changed", +input.value !== def); set(+input.value); draw(); };
  input.onchange = () => onChange();
  return row;
}

function renderPanel() {
  const v = VERSIONS[lab.v], { plan, params, display } = current(), base = plan.preset;
  const box = $("#labSettings");
  box.replaceChildren();

  const mon = document.createElement("label");
  mon.className = "sl";
  mon.innerHTML = `<span>Monitor</span><select>${Object.entries(MONITORS).map(([k, n]) =>
    `<option value="${k}"${k === display ? " selected" : ""}>${n}${k === v.display ? " *" : ""}</option>`).join("")}</select>`;
  mon.querySelector("select").onchange = e => {
    if (e.target.value === v.display) delete settings.monitor[v.id]; else settings.monitor[v.id] = e.target.value;
    save(); renderPanel(); draw(); onChange();
  };
  box.append(mon);

  for (const [group, rows] of HYLLIAN) {
    const live = rows.filter(([k]) => k in base);
    if (!live.length) continue;
    const h = document.createElement("h3"); h.textContent = `${group} · ${plan.name}`; box.append(h);
    for (const [k, label, min, max, step] of live) {
      box.append(slider(k, label, min, max, step, params[k], base[k], val => {
        (settings.overrides[plan.name] ||= {})[k] = val; save();
      }));
    }
  }
  const h = document.createElement("h3"); h.textContent = "Tube · all monitors"; box.append(h);
  for (const [k, label, min, max, step] of TUBE_CONTROLS) {
    box.append(slider(k, label, min, max, step, params[k], TUBE[k], val => { settings.tube[k] = val; save(); }));
  }
}
