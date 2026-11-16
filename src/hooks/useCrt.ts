import { type RefObject, useCallback, useEffect, useRef } from "react";
import { frameOf, type Version } from "../data.ts";
// The Paninos off-line's port of DOSBox Staging's CRT shaders (GPL).
import { plan, Renderer, type Source, supported } from "../vendor/crt.ts";

export const crtSupported = supported();

// The tube around DOSBox's picture, as monkeyisland.pages.dev sets it: a slight curvature,
// rounded corners and a vignette. crt.js's own TUBE is all of that switched off.
const TUBE = {
  warpX: 0.03,
  warpY: 0.04,
  c_shape: 0.25,
  csize: 0.02,
  bsize1: 0,
  sborder: 0.75,
  vigstr: 0.35,
  vigdef: 1.0,
};

// The PC's 31 kHz monitor keeps DOSBox's finest VGA preset, with its dot mask, at every size.
const VGA_PRESET = "vga-4k";

// Draw a shot back at its native pixels, centred in its frame on black: what the CRT shades.
function frameCanvas(v: Version, img: HTMLImageElement): Source {
  const [nw, nh] = v.native,
    [fw, fh] = frameOf(v),
    c = document.createElement("canvas");
  c.width = fw;
  c.height = fh;
  const x = c.getContext("2d", { willReadFrequently: true });
  if (!x) throw new Error("no 2D canvas");
  x.fillStyle = "#000";
  x.fillRect(0, 0, fw, fh);
  // The shot is nearest-scaled, so shrinking it back recovers the exact source pixels.
  x.imageSmoothingEnabled = false;
  x.drawImage(img, (fw - nw) / 2, (fh - nh) / 2, nw, nh);
  return { w: fw, h: fh, data: new Uint8Array(x.getImageData(0, 0, fw, fh).data.buffer) };
}

// A WebGL CRT on a canvas. The returned draw(img, version) shades the picture for the canvas's
// current size: plan() picks the monitor's preset, with scanlines antialiased from 2 pixels per
// line, over the whole frame (a letterboxed picture's bars are part of the scan too).
// The WebGL context is only made once the CRT is first drawn, and given back on unmount, since
// browsers keep only a few alive.
export function useCrt(canvas: RefObject<HTMLCanvasElement | null>) {
  const renderer = useRef<Renderer | null>(null);
  // Which picture the renderer has, so a resize only redraws instead of uploading it again.
  const uploaded = useRef("");

  useEffect(() => {
    const c = canvas.current;
    return () => {
      // StrictMode's rehearsal unmount leaves the canvas in the page, and a canvas can't get a
      // second context, so only a real unmount gives it back.
      if (c?.isConnected) return;
      renderer.current?.gl.getExtension("WEBGL_lose_context")?.loseContext();
      renderer.current = null;
    };
  }, [canvas]);

  return useCallback(
    (img: HTMLImageElement, v: Version) => {
      const c = canvas.current;
      if (!crtSupported || !c || !img.complete || !img.naturalWidth) return;
      try {
        renderer.current ??= new Renderer(c);
      } catch (e) {
        console.error(e);
        return;
      }
      const r = renderer.current;
      const picture = `${v.id} ${img.currentSrc}`;
      if (uploaded.current !== picture) {
        r.setSource(frameCanvas(v, img));
        uploaded.current = picture;
      }
      const box = c.getBoundingClientRect(),
        dpr = window.devicePixelRatio || 1;
      c.width = Math.round(box.width * dpr);
      c.height = Math.round(box.height * dpr);
      const p = plan(v.display, frameOf(v)[1], c.height, 2, v.display === "31khz" ? VGA_PRESET : undefined);
      // Lines 2 pixels tall make bands on a curved tube, so then the picture isn't bent.
      const straight = p.straight ? { warpX: 0, warpY: 0 } : null;
      r.draw({ ...p.preset, ...TUBE, ...straight }, { flat: p.flat, half: p.half });
    },
    [canvas],
  );
}
