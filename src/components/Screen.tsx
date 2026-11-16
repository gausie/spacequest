import { type CSSProperties, type DragEvent, type MouseEvent, type PointerEvent, useRef } from "react";
import type { Scene, Version } from "../data.ts";
import styles from "./Screen.module.css";
import { ScreenLayer } from "./ScreenLayer.tsx";

interface Props {
  a: Version;
  b: Version;
  scene: Scene;
  comparing: boolean;
  crt: boolean;
  // The screen inside the frame is zoom times bigger, and the frame scrolls.
  zoom: number;
  dividerPercent: number;
  frameWidth: number;
  showDropTargets: boolean;
  onMoveDivider: (percent: number) => void;
  onDropVersion: (index: number, side: "a" | "b") => void;
  onZoom: (side: "a" | "b") => void;
}

export function Screen({
  a,
  b,
  scene,
  comparing,
  crt,
  zoom,
  dividerPercent,
  frameWidth,
  showDropTargets,
  onMoveDivider,
  onDropVersion,
  onZoom,
}: Props) {
  const screen = useRef<HTMLDivElement>(null);
  const fractionAcross = (x: number) => {
    const r = screen.current?.getBoundingClientRect();
    return r ? (x - r.left) / r.width : 0.5;
  };

  const onClick = (e: MouseEvent) => {
    if ((e.target as Element).closest("#dividerGrip")) return;
    const clickedSide = comparing && fractionAcross(e.clientX) * 100 > dividerPercent ? "b" : "a";
    onZoom(clickedSide);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    onDropVersion(Number(e.dataTransfer.getData("text/plain")), fractionAcross(e.clientX) > 0.5 ? "b" : "a");
  };
  const dragGrip = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) onMoveDivider(fractionAcross(e.clientX) * 100);
  };

  const screenWidth = frameWidth * zoom;
  return (
    <div className={styles.frame} id="frame" style={{ width: frameWidth, height: (frameWidth * 3) / 4 }}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: zooming by click; the parser's LOOK does it from the keyboard */}
      <div
        className={styles.screen}
        id="screen"
        ref={screen}
        style={{ width: screenWidth, "--divider": `${dividerPercent}%` } as CSSProperties}
        onClick={onClick}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <ScreenLayer id="layerA" version={a} scene={scene} crt={crt} screenWidth={screenWidth} />
        {comparing && (
          <ScreenLayer
            id="layerB"
            version={b}
            scene={scene}
            crt={crt}
            screenWidth={screenWidth}
            className={styles.rightOfDivider}
          />
        )}
        {comparing && <div className={styles.divider} />}
        {comparing && (
          <button
            type="button"
            className={styles.grip}
            id="dividerGrip"
            aria-label="Move the divider"
            onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
            onPointerMove={dragGrip}
          >
            ◄►
          </button>
        )}
        {showDropTargets && (
          <div className={styles.dropTargets}>
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
