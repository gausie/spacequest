import { VERSIONS, shotPath } from "./data.js";

const missing = new Set();
const placeholders = new Map();

// Stand-in until a capture exists: a native-res test card scaled to 1600x1200 like a real capture.
function placeholder(v, s) {
  const key = `${v.id}/${s.id}`;
  if (placeholders.has(key)) return placeholders.get(key);
  const [w, h] = v.native, c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d");
  const hue = VERSIONS.indexOf(v) * 30;
  for (let i = 0; i < 8; i++) { x.fillStyle = `hsl(${hue + i * 12} 60% ${10 + i * 6}%)`; x.fillRect(0, (h / 8) * i, w, h / 8 + 1); }
  x.fillStyle = "#fff"; x.textAlign = "center"; x.font = `${Math.round(h / 16)}px monospace`;
  x.fillText(`${v.engine} ${v.name}`, w / 2, h / 2 - h / 14);
  x.fillText(s.name, w / 2, h / 2 + h / 40);
  x.fillStyle = "#fff8"; x.font = `${Math.round(h / 24)}px monospace`;
  x.fillText(`no capture yet: ${shotPath(v.id, s.id)}`, w / 2, h / 2 + h / 7);
  const big = document.createElement("canvas"); big.width = 1600; big.height = 1200;
  const bx = big.getContext("2d"); bx.imageSmoothingEnabled = false; bx.drawImage(c, 0, 0, 1600, 1200);
  const url = big.toDataURL();
  placeholders.set(key, url);
  return url;
}

export const isMissing = (v, s) => missing.has(`${v.id}/${s.id}`);

// Sets src to the capture, falling back to the placeholder if it 404s.
export function setShot(img, v, s, onload) {
  const key = `${v.id}/${s.id}`;
  img.onload = onload || null;
  img.onerror = () => {
    missing.add(key); img.onerror = null; img.src = placeholder(v, s);
    document.querySelectorAll(`[data-key="${key}"]`).forEach(el => el.classList.add("missing"));
  };
  img.src = missing.has(key) ? placeholder(v, s) : shotPath(v.id, s.id);
}

export function loadShot(v, s, cb) {
  const img = new Image();
  setShot(img, v, s, () => cb(img));
}
