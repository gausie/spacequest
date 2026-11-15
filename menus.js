// Turbo Vision pull-down menus for the menu bar. Each menu is a function returning its items, so
// marks and disabled states are read fresh every time it opens.
//   { label, hot, keys, radio, disabled, run }  or  "-" for a separator
const box = document.getElementById("dropdown");
let open = null, menus = {};

function render(items) {
  box.replaceChildren(...items.map(it => {
    if (it === "-") { const s = document.createElement("div"); s.className = "dd-sep"; return s; }
    const b = document.createElement("button");
    b.className = "dd-item"; b.setAttribute("role", "menuitem");
    if (it.disabled) b.setAttribute("aria-disabled", "true");
    // Colour the hotkey letter the way the menu bar does: the first match, case-insensitive.
    const i = it.hot ? it.label.toLowerCase().indexOf(it.hot.toLowerCase()) : -1;
    const label = i < 0 ? it.label : `${it.label.slice(0, i)}<span class="k">${it.label[i]}</span>${it.label.slice(i + 1)}`;
    b.innerHTML = `<span>${it.radio ? "•" : ""}</span><span>${label}</span><span class="ms">${it.keys || ""}</span>`;
    b.onclick = () => { if (it.disabled) return; close(); it.run(); };
    b.dataset.hot = (it.hot || "").toLowerCase();
    return b;
  }));
}

function show(name, title) {
  open = name;
  render(menus[name]());
  document.querySelectorAll(".menu-title").forEach(t => t.setAttribute("aria-expanded", t === title));
  const r = title.getBoundingClientRect();
  box.hidden = false;
  box.style.top = `${r.bottom}px`;
  // Keep the box on screen when the title is near the right edge.
  box.style.left = `${Math.max(0, Math.min(r.left, innerWidth - box.offsetWidth))}px`;
  box.querySelector(".dd-item:not([aria-disabled])")?.focus();
}

export function close() {
  if (!open) return false;
  open = null; box.hidden = true;
  document.querySelectorAll(".menu-title").forEach(t => t.setAttribute("aria-expanded", "false"));
  return true;
}

export function initMenus(defs) {
  menus = defs;
  document.querySelectorAll(".menu-title").forEach(t => {
    t.onclick = e => { e.stopPropagation(); open === t.dataset.menu ? close() : show(t.dataset.menu, t); };
  });
  document.addEventListener("pointerdown", e => { if (!e.target.closest("#dropdown, .menu-title")) close(); });
  box.addEventListener("keydown", e => {
    const items = [...box.querySelectorAll(".dd-item:not([aria-disabled])")], i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") items[(i + 1) % items.length].focus();
    else if (e.key === "ArrowUp") items[(i - 1 + items.length) % items.length].focus();
    else if (e.key === "Escape") close();
    else { const hit = items.find(b => b.dataset.hot && b.dataset.hot === e.key.toLowerCase()); if (!hit) return; hit.click(); }
    e.preventDefault(); e.stopPropagation();
  });
}
