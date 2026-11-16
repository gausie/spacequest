import { useEffect, useState } from "react";

const KEY = "sq-font";
const saved = () => {
  try {
    return localStorage.getItem(KEY) === "agi";
  } catch {
    return false;
  }
};

// Reading text is in the VGA font (body.vga); the 8x8 for everything is a per-viewer choice.
export function useAgiFont() {
  const [agiFont, setAgiFont] = useState(saved);
  useEffect(() => {
    document.body.classList.toggle("vga", !agiFont);
    try {
      localStorage.setItem(KEY, agiFont ? "agi" : "");
    } catch {
      /* private mode: not remembered */
    }
  }, [agiFont]);
  return [agiFont, () => setAgiFont((f) => !f)] as const;
}
