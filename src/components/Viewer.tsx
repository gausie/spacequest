import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { SCENES, VERSIONS } from "../data.ts";
import { crtSupported } from "../hooks/useCrt.ts";
import type { View, ViewSetters } from "../hooks/useView.ts";
import { SceneList } from "./SceneList.tsx";
import { Screen } from "./Screen.tsx";
import { VersionStrip } from "./VersionStrip.tsx";
import styles from "./Viewer.module.css";

interface Props {
  view: View;
  set: ViewSetters;
  onZoom: (side: "a" | "b") => void;
}

export function Viewer({ view, set, onZoom }: Props) {
  const viewer = useRef<HTMLElement>(null),
    screenColumn = useRef<HTMLElement>(null),
    versionStrip = useRef<HTMLElement>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  const [draggingVersion, setDraggingVersion] = useState(false);

  // The screen at 1x is as big as the window allows: its column's width, or less when the height
  // runs out. On narrow screens the page scrolls instead, so only the width counts.
  const fitFrameToWindow = useCallback(() => {
    const box = viewer.current,
      column = screenColumn.current,
      strip = versionStrip.current;
    if (!box || !column || !strip) return;
    const style = getComputedStyle(box);
    const heightAboveStrip =
      style.position === "absolute"
        ? box.clientHeight -
          parseFloat(style.paddingTop) -
          parseFloat(style.paddingBottom) -
          strip.offsetHeight -
          parseFloat(style.rowGap)
        : Infinity;
    // A multiple of 4 so the height is a whole number too: a half pixel brings back scrollbars.
    setFrameWidth(Math.max(0, Math.floor(Math.min(column.clientWidth, (heightAboveStrip * 4) / 3) / 4) * 4));
  }, []);

  useLayoutEffect(() => {
    const ro = new ResizeObserver(fitFrameToWindow);
    for (const r of [viewer, screenColumn, versionStrip]) if (r.current) ro.observe(r.current);
    // The fonts change the boxes' sizes once they're in.
    document.fonts.ready.then(fitFrameToWindow);
    return () => ro.disconnect();
  }, [fitFrameToWindow]);

  const crt = view.crt && crtSupported;
  return (
    <section className={styles.viewer} ref={viewer}>
      <SceneList scene={view.scene} onPick={set.scene} />
      <section className={styles.screenColumn} ref={screenColumn}>
        {frameWidth > 0 && (
          <Screen
            a={VERSIONS[view.a]}
            b={VERSIONS[view.b]}
            scene={SCENES[view.scene]}
            comparing={view.comparing}
            crt={crt}
            zoom={view.zoom}
            frameWidth={frameWidth}
            showDropTargets={draggingVersion}
            onStopComparing={set.toggleCompare}
            onZoom={onZoom}
            onDropVersion={(index, side) => set.pick(index, side === "b")}
          />
        )}
      </section>
      <VersionStrip
        ref={versionStrip}
        scene={view.scene}
        a={view.a}
        b={view.b}
        comparing={view.comparing}
        onDrag={setDraggingVersion}
        onPick={set.pick}
      />
    </section>
  );
}
