// A pixel-art mouse pointer in the style of Sierra's SCI arrow, drawn at whole-pixel scales so it
// stays crisp, and used for every cursor except dragging.
const ARROW = [
  "k.........",
  "kk........",
  "kwk.......",
  "kwwk......",
  "kwwwk.....",
  "kwwwwk....",
  "kwwwwwk...",
  "kwwwwwwk..",
  "kwwwwwwwk.",
  "kwwwwwkkkk",
  "kwwkwwk...",
  "kwk.kwwk..",
  "kk..kwwk..",
  "k....kwwk.",
  ".....kwwk.",
  "......kk..",
];
const COLOURS = { k: "#000000", w: "#FFFFFF" };

function png(rows, scale) {
  const c = document.createElement("canvas");
  c.width = rows[0].length * scale; c.height = rows.length * scale;
  const x = c.getContext("2d");
  rows.forEach((r, y) => [...r].forEach((ch, i) => {
    if (!COLOURS[ch]) return;
    x.fillStyle = COLOURS[ch]; x.fillRect(i * scale, y * scale, scale, scale);
  }));
  return c.toDataURL("image/png");
}

export function installCursor() {
  const scale = 2, set = ["image-set", "-webkit-image-set"].find(f => CSS.supports("cursor", `${f}(url("a.png") 1x) 0 0, auto`));
  // The 2x image keeps the pointer the same size, but sharp, on high-density screens.
  const img = set ? `${set}(url("${png(ARROW, scale)}") 1x, url("${png(ARROW, scale * 2)}") 2x)` : `url("${png(ARROW, scale)}")`;
  const css = `${img} 1 1`;
  const root = document.documentElement.style;
  root.setProperty("--cur-arrow", `${css}, default`);
  root.setProperty("--cur-point", `${css}, pointer`);
}
