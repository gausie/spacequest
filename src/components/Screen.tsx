import { type CSSProperties, type DragEvent, type MouseEvent, type PointerEvent, useRef } from "react";
import type { Scene, Version } from "../data.ts";
import styles from "./Screen.module.css";
import { ScreenLayer } from "./ScreenLayer.tsx";

interface Props {
  a: Version;
  b: Version;
  scene: Scene;
  compare: boolean;
  crt: boolean;
  zoom: number;
  split: number;
  // The frame's width at 1x; zoom makes the screen inside it bigger and the frame scrolls.
  width: number;
  // A version is being dragged from the strip: show where it can be dropped.
  dragging: boolean;
  onSplit: (split: number) => void;
  // A version dragged from the strip: the left half sets A, the right half B.
  onDropVersion: (index: number, side: "a" | "b") => void;
  onZoom: (side: "a" | "b") => void;
}

export function Screen({
  a,
  b,
  scene,
  compare,
  crt,
  zoom,
  split,
  width,
  dragging,
  onSplit,
  onDropVersion,
  onZoom,
}: Props) {
  const screen = useRef<HTMLDivElement>(null);
  const fraction = (x: number) => {
    const r = screen.current?.getBoundingClientRect();
    return r ? (x - r.left) / r.width : 0.5;
  };

  const onClick = (e: MouseEvent) => {
    if ((e.target as Element).closest("#handleBtn")) return;
    // When comparing, the side you clicked.
    onZoom(compare && fraction(e.clientX) * 100 > split ? "b" : "a");
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    onDropVersion(Number(e.dataTransfer.getData("text/plain")), fraction(e.clientX) > 0.5 ? "b" : "a");
  };
  const onGrip = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) onSplit(fraction(e.clientX) * 100);
  };

  const shown = width * zoom;
  return (
    <div className={styles.frame} id="frame" style={{ width, height: (width * 3) / 4 }}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: zooming by click; the parser's LOOK does it from the keyboard */}
      <div
        className={styles.screen}
        id="screen"
        ref={screen}
        style={{ width: shown, "--split": `${split}%` } as CSSProperties}
        onClick={onClick}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <ScreenLayer id="layerA" version={a} scene={scene} crt={crt} width={shown} />
        {compare && (
          <ScreenLayer id="layerB" version={b} scene={scene} crt={crt} width={shown} className={styles.right} />
        )}
        {compare && <div className={styles.handle} />}
        {compare && (
          // The ◄► grip follows the divider but stops at the screen's edges.
          <button
            type="button"
            className={styles.grip}
            id="handleBtn"
            aria-label="Move the divider"
            onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
            onPointerMove={onGrip}
          >
            ◄►
          </button>
        )}
        {dragging && (
          <div className={styles.drop}>
            <span>
              ◄ Drop here
              <br />
              to set A
            </span>
            <span>
              Drop here
              <br />
              to set B ►
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
