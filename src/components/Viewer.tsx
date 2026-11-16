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

// Scenes | screen, versions underneath.
export function Viewer({ view: state, set, onZoom }: Props) {
  const view = useRef<HTMLElement>(null),
    col = useRef<HTMLElement>(null),
    vers = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState(false);

  // The screen at 1x is as big as the window allows: its column's width, or less when the height
  // runs out (the view's height less the versions box under it). On narrow screens the page
  // scrolls instead, so only the width counts.
  const fit = useCallback(() => {
    const v = view.current,
      c = col.current,
      s = vers.current;
    if (!v || !c || !s) return;
    const vs = getComputedStyle(v);
    const h =
      vs.position === "absolute"
        ? v.clientHeight -
          parseFloat(vs.paddingTop) -
          parseFloat(vs.paddingBottom) -
          s.offsetHeight -
          parseFloat(vs.rowGap)
        : Infinity;
    // A multiple of 4 so the height is a whole number too: a half pixel brings back scrollbars.
    setWidth(Math.max(0, Math.floor(Math.min(c.clientWidth, (h * 4) / 3) / 4) * 4));
  }, []);

  useLayoutEffect(() => {
    const ro = new ResizeObserver(fit);
    for (const r of [view, col, vers]) if (r.current) ro.observe(r.current);
    // The fonts change the boxes' sizes once they're in.
    document.fonts.ready.then(fit);
    return () => ro.disconnect();
  }, [fit]);

  const crt = state.crt && crtSupported;
  return (
    <section className={styles.viewer} ref={view}>
      <SceneList scene={state.scene} onPick={set.scene} />
      <section className={styles.screenwin} ref={col}>
        {width > 0 && (
          <Screen
            a={VERSIONS[state.a]}
            b={VERSIONS[state.b]}
            scene={SCENES[state.scene]}
            compare={state.compare}
            crt={crt}
            zoom={state.zoom}
            split={state.split}
            width={width}
            dragging={dragging}
            onSplit={set.split}
            onZoom={onZoom}
            onDropVersion={(index, side) => {
              setDragging(false);
              if (side === "b") set.compare(index);
              else set.version(index);
            }}
          />
        )}
      </section>
      <VersionStrip
        ref={vers}
        scene={state.scene}
        a={state.a}
        b={state.b}
        compare={state.compare}
        onDrag={setDragging}
        onPick={(index, asB) => (asB ? set.compare(index) : set.version(index))}
      />
    </section>
  );
}
