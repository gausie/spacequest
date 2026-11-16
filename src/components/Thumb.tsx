import type { MouseEvent } from "react";
import { type Scene, shotPath, type Version } from "../data.ts";
import styles from "./Thumb.module.css";

// → for the version on screen, or A and B when comparing.
export type GutterMark = "" | "→" | "A" | "B";

interface Props {
  version: Version;
  scene: Scene;
  index: number;
  gutterMark: GutterMark;
  onPick: (e: MouseEvent) => void;
  onDrag: (dragging: boolean) => void;
}

// A version in the strip. Selection is only ever shown in the label, never on the picture.
export function Thumb({ version, scene, index, gutterMark, onPick, onDrag }: Props) {
  return (
    <button
      type="button"
      className={styles.thumb}
      draggable
      onClick={onPick}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(index));
        onDrag(true);
      }}
      onDragEnd={() => onDrag(false)}
    >
      <img alt="" draggable={false} loading="lazy" decoding="async" src={shotPath(version.id, scene.id)} />
      <small className={styles.label}>
        {version.year} {version.engine}
      </small>
      <small className={styles.label} data-mark={gutterMark || undefined}>
        {version.name}
      </small>
    </button>
  );
}
