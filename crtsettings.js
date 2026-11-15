// CRT tweaks shared by the viewer and the lab. Overrides are per preset because the
// presets differ by monitor and size; the tube (curvature, corners, vignette) is global.
const KEY = "sq-crt";

export const HYLLIAN = [
  ["Beam", [
    ["BEAM_MIN_WIDTH", "Beam width, dark", 0, 2, 0.01],
    ["BEAM_MAX_WIDTH", "Beam width, bright", 0, 2, 0.01],
    ["SCANLINES_STRENGTH", "Scanline strength", 0, 1, 0.01],
    ["COLOR_BOOST", "Colour boost", 1, 5, 0.05],
  ]],
  ["Filter", [
    ["HFILTER_PROFILE", "Filter: Hermite / Catmull-Rom", 0, 1, 1],
    ["CRT_ANTI_RINGING", "Anti-ringing", 0, 1, 0.1],
    ["SHARPNESS_HACK", "Sharpness", 1, 4, 1],
  ]],
  ["Mask", [
    ["PHOSPHOR_LAYOUT", "Phosphor layout", 0, 17, 1],
    ["MASK_INTENSITY", "Mask intensity", 0, 1, 0.01],
    ["MASK_STRENGTH", "Mask strength", 0, 1, 0.01],
  ]],
  ["VGA lines", [
    ["SPOT_WIDTH", "Spot width", 0.5, 1.5, 0.01],
    ["SPOT_HEIGHT", "Spot height", 0.5, 1.5, 0.01],
    ["SCANLINE_STRENGTH_MIN", "Scanlines, bright", 0, 1, 0.01],
    ["SCANLINE_STRENGTH_MAX", "Scanlines, dark", 0, 1, 0.01],
    ["COLOR_BOOST_EVEN", "Boost, even rows", 1, 6, 0.05],
    ["COLOR_BOOST_ODD", "Boost, odd rows", 1, 6, 0.05],
  ]],
  ["Gamma", [
    ["INPUT_GAMMA", "Input gamma", 1, 3, 0.01],
    ["OUTPUT_GAMMA", "Output gamma", 1, 3, 0.01],
    ["GAMMA_INPUT", "Input gamma", 1, 3, 0.01],
    ["GAMMA_OUTPUT", "Output gamma", 1, 3, 0.01],
  ]],
];

// The tube around DOSBox's picture, as monkeyisland.pages.dev sets it: a slight curvature,
// rounded corners and a vignette. crt.js's own TUBE is all of that switched off.
export const TUBE = { warpX: 0.03, warpY: 0.04, c_shape: 0.25, csize: 0.02, bsize1: 0, sborder: 0.75, vigstr: 0.35, vigdef: 1.0 };

// The PC's 31 kHz monitor keeps DOSBox's finest VGA preset, with its dot mask, at every size.
const VGA_PRESET = "vga-4k";

export const TUBE_CONTROLS = [
  ["warpX", "Curvature across", 0, 0.25, 0.005],
  ["warpY", "Curvature down", 0, 0.25, 0.005],
  ["c_shape", "Curve shape", 0.05, 0.6, 0.01],
  ["csize", "Corner size", 0, 0.1, 0.005],
  ["bsize1", "Border size", 0, 3, 0.05],
  ["sborder", "Border sharpness", 0.25, 2, 0.05],
  ["vigstr", "Vignette strength", 0, 1, 0.01],
  ["vigdef", "Vignette size", 0.5, 3, 0.05],
];

export const MONITORS = {
  "31khz": "PC monitor, 31 kHz (VGA)",
  ega15: "EGA monitor, 15 kHz",
  cga15: "CGA monitor, 15 kHz",
  hercules: "Mono, IBM 5151 type",
  mac: "Mac monitor",
  "15khz-tv": "15 kHz TV or 1084S",
  tv: "15 kHz TV",
};

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
export const settings = { overrides: {}, tube: {}, monitor: {}, ...load() };
export function save() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {} }
export function reset() { settings.overrides = {}; settings.tube = {}; settings.monitor = {}; save(); }

// What the CRT shows for a version at a given height: plan() plus the user's tweaks. The picture
// fills the height it's given, with scanlines antialiased from 2 pixels per line (exact = 2).
export function crtParams(v, height, exact = 2) {
  const display = settings.monitor[v.id] || v.display;
  const p = CRT.plan(display, v.native[1], height, exact, display === "31khz" ? VGA_PRESET : undefined);
  // Lines 2 pixels tall make bands on a curved tube, so then the picture isn't bent.
  const straight = p.straight ? { warpX: 0, warpY: 0 } : null;
  return { plan: p, display, params: { ...p.preset, ...TUBE, ...settings.overrides[p.name], ...settings.tube, ...straight } };
}
