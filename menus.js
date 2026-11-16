// AGI's menu bar. It takes the status line's place while it's in use: hovering the line, clicking
// it, or Esc, which is how the game opened it. Each menu is a function returning its items so
// marks and disabled states are read fresh every time it opens.
//   { label, keys, radio, check, disabled, run }  or  "-" for a separator
// radio: on for the one chosen of a group (•); check: on for a toggle that's on (■).
const line = document.getElementById("statusline"), bar = document.getElementById("menubar");
const box = document.getElementById("dropdown");
let defs = [], open = -1, hovering = false;

const titles = () => [...bar.querySelectorAll(".mtitle")];
const items = () => [...box.querySelectorAll(".dd-item:not([aria-disabled])")];

function sync() {
  line.classList.toggle("menu", hovering || open >= 0);
  titles().forEach((t, i) => t.setAttribute("aria-expanded", i === open));
}

function render(list) {
  box.replaceChildren(...list.map(it => {
    if (it === "-") { const s = document.createElement("div"); s.className = "dd-sep"; return s; }
    const b = document.createElement("button");
    b.className = "dd-item"; b.setAttribute("role", "menuitem");
    if (it.disabled) b.setAttribute("aria-disabled", "true");
    b.innerHTML = `<span><span class="mk">${it.radio ? "•" : it.check ? "■" : ""}</span>${it.label}</span><span>${it.keys || ""}</span>`;
    b.onclick = () => { if (it.disabled) return; close(); it.run(); };
    b.onpointerenter = () => b.focus();
    return b;
  }));
}

function show(i, focusFirst = true) {
  open = (i + defs.length) % defs.length; sync();
  render(defs[open].items());
  const r = titles()[open].getBoundingClientRect();
  box.hidden = false;
  box.style.top = `${r.bottom}px`;
  // Keep the box on screen when the title is near the right edge.
  box.style.left = `${Math.max(0, Math.min(r.left, innerWidth - box.offsetWidth))}px`;
  if (focusFirst) items()[0]?.focus();
}

export function close() {
  if (open < 0) return false;
  open = -1; box.hidden = true; sync();
  return true;
}

// Esc from the page: open the first menu, as AGI does.
export function openMenu() { show(0); }

export function initMenus(list) {
  defs = list;
  bar.replaceChildren(...defs.map((d, i) => {
    const t = document.createElement("button");
    t.className = "mtitle"; t.setAttribute("aria-haspopup", "menu");
    // A title can be a node (the Sierra logo) instead of text; the label still names it.
    if (d.icon) { t.append(d.icon); t.setAttribute("aria-label", d.title); } else t.textContent = d.title;
    t.onclick = e => { e.stopPropagation(); open === i ? close() : show(i); };
    t.onpointerenter = () => { if (open >= 0 && open !== i) show(i, false); };
    return t;
  }));
  line.onpointerenter = () => { hovering = true; sync(); };
  line.onpointerleave = () => { hovering = false; sync(); };
  // A tap on the status line (no hover on touch screens) opens the first menu.
  line.onclick = e => { if (!e.target.closest(".mtitle")) show(0); };
  document.addEventListener("pointerdown", e => { if (!e.target.closest("#dropdown, #statusline")) close(); });
  box.addEventListener("keydown", e => {
    const its = items(), i = its.indexOf(document.activeElement);
    if (e.key === "ArrowDown") its[(i + 1) % its.length]?.focus();
    else if (e.key === "ArrowUp") its[(i - 1 + its.length) % its.length]?.focus();
    else if (e.key === "ArrowRight") show(open + 1);
    else if (e.key === "ArrowLeft") show(open - 1);
    else if (e.key === "Escape") close();
    else return;
    e.preventDefault(); e.stopPropagation();
  });
}
