import { basename } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Relative base: the built site works from any path (a subfolder on GitHub Pages, say).
export default defineConfig({
  base: "./",
  plugins: [react()],
  // Readable class names (Thumb_label): each module's file name keeps them unique.
  css: {
    modules: { generateScopedName: (local, file) => `${basename(file).replace(/\.module\.css.*$/, "")}_${local}` },
  },
});
