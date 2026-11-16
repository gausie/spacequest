import { parseAsBoolean, parseAsNumberLiteral, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useEffect, useRef, useState } from "react";
import { SCENES, VERSIONS } from "../data.ts";

// What's on screen, by index into SCENES and VERSIONS.
export const ZOOMS = [1, 2, 4] as const;
export type Zoom = (typeof ZOOMS)[number];

export interface View {
  scene: number;
  a: number;
  // B only shows when comparing; otherwise it's the version comparing would bring back.
  b: number;
  comparing: boolean;
  crt: boolean;
  zoom: Zoom;
  dividerPercent: number;
}

const sceneIds = SCENES.map((s) => s.id),
  versionIds = VERSIONS.map((v) => v.id);
const DEFAULT_B = "sci-pc-ega";
const NEXT_ZOOM: Record<Zoom, Zoom> = { 1: 2, 2: 4, 4: 1 };

// The view lives in the query string so it can be linked: ?s=orat&a=agi-pc-ega&b=sci-pc-vga&crt=true&z=2.
// Defaults are left out of the URL; comparing is on whenever b is there.
const parsers = {
  scene: parseAsStringLiteral(sceneIds).withDefault(sceneIds[0]),
  a: parseAsStringLiteral(versionIds).withDefault("agi-pc-ega"),
  b: parseAsStringLiteral(versionIds),
  crt: parseAsBoolean.withDefault(false),
  zoom: parseAsNumberLiteral(ZOOMS).withDefault(1),
};
const urlKeys = { scene: "s", zoom: "z" };

const step = <T>(list: readonly T[], current: T, by: number) =>
  list[(list.indexOf(current) + by + list.length) % list.length];

export function useView() {
  const [q, setQ] = useQueryStates(parsers, { urlKeys });
  const [dividerPercent, setDividerPercent] = useState(50);
  // Turning comparing off and on again brings back the same B.
  const lastB = useRef(q.b ?? DEFAULT_B);
  useEffect(() => {
    if (q.b) lastB.current = q.b;
  }, [q.b]);

  const view: View = {
    scene: sceneIds.indexOf(q.scene),
    a: versionIds.indexOf(q.a),
    b: versionIds.indexOf(q.b ?? lastB.current),
    comparing: q.b !== null,
    crt: q.crt,
    zoom: q.zoom,
    dividerPercent,
  };

  const set = {
    scene: (index: number) => setQ({ scene: sceneIds[index] }),
    sceneStep: (by: number) => setQ((p) => ({ scene: step(sceneIds, p.scene, by) })),
    version: (index: number) => setQ({ a: versionIds[index] }),
    versionStep: (by: number) => setQ((p) => ({ a: step(versionIds, p.a, by) })),
    toggleCompare: () => setQ((p) => ({ b: p.b ? null : lastB.current })),
    compareWith: (index: number) => setQ({ b: versionIds[index] }),
    swap: () => setQ((p) => (p.b ? { a: p.b, b: p.a } : {})),
    toggleCrt: () => setQ((p) => ({ crt: !p.crt })),
    zoom: (zoom: Zoom) => setQ({ zoom }),
    cycleZoom: () => setQ((p) => ({ zoom: NEXT_ZOOM[p.zoom] })),
    moveDivider: (percent: number) => setDividerPercent(Math.min(100, Math.max(0, percent))),
  };
  return { view, set };
}

export type ViewSetters = ReturnType<typeof useView>["set"];
