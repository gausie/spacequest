import { useEffect, useRef } from "react";
import { SCENES } from "../data.ts";
import styles from "./SceneList.module.css";

// Styled after AGI's restore dialog: the current scene has the arrow, the row under the pointer
// or focus is inverted like a menu item.
export function SceneList({ scene, onPick }: { scene: number; onPick: (i: number) => void }) {
  const list = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: scrolls the new scene into view
  useEffect(() => {
    list.current?.querySelector("[aria-current=true]")?.scrollIntoView({ block: "nearest" });
  }, [scene]);
  return (
    <nav className={styles.scenes} aria-label="Scenes">
      <p className={styles.intro}>Use the arrow keys to select the scene you wish to see.</p>
      <div className={styles.list} ref={list}>
        {SCENES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={styles.scene}
            aria-current={i === scene}
            onClick={() => onPick(i)}
          >
            <span>{s.name}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
