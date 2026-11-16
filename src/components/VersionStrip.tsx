import { type Ref, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SCENES, VERSIONS } from "../data.ts";
import { type GutterMark, Thumb } from "./Thumb.tsx";
import styles from "./VersionStrip.module.css";

interface Props {
  scene: number;
  a: number;
  b: number;
  comparing: boolean;
  onPick: (index: number, asB: boolean) => void;
  onDrag: (dragging: boolean) => void;
  ref?: Ref<HTMLElement>;
}

// The versions, in release order. No scrollbar: ◄ ► cells inside the frame, level with the
// pictures, show when there's more that way, and each click moves about a box-width.
export function VersionStrip({ scene, a, b, comparing, onPick, onDrag, ref }: Props) {
  const strip = useRef<HTMLDivElement>(null),
    grid = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState({ left: false, right: false });

  const updateScrollArrows = useCallback(() => {
    const s = strip.current;
    if (!s) return;
    const furthest = s.scrollWidth - s.clientWidth;
    const left = s.scrollLeft > 1,
      right = s.scrollLeft < furthest - 1;
    // Scroll events come every frame; only a change needs a render.
    setCanScroll((p) => (p.left === left && p.right === right ? p : { left, right }));
  }, []);

  useLayoutEffect(() => {
    if (!strip.current) return;
    const ro = new ResizeObserver(updateScrollArrows);
    ro.observe(strip.current);
    return () => ro.disconnect();
  }, [updateScrollArrows]);

  // Keep the version on screen in view as it changes (arrow keys, the parser).
  useEffect(() => {
    grid.current?.children[a]?.scrollIntoView({ block: "nearest", inline: "nearest" });
    updateScrollArrows();
  }, [a, updateScrollArrows]);

  const scrollAboutAPage = (direction: 1 | -1) =>
    strip.current?.scrollBy({ left: direction * strip.current.clientWidth * 0.8, behavior: "smooth" });
  const gutterMarkFor = (i: number): GutterMark =>
    i === a ? (comparing ? "A" : "→") : comparing && i === b ? "B" : "";

  return (
    <section className={styles.vers} aria-label="Versions" ref={ref}>
      {canScroll.left && (
        <button
          type="button"
          className={`${styles.arrow} ${styles.left}`}
          aria-label="Scroll versions left"
          onClick={() => scrollAboutAPage(-1)}
        >
          ◄
        </button>
      )}
      {canScroll.right && (
        <button
          type="button"
          className={`${styles.arrow} ${styles.right}`}
          aria-label="Scroll versions right"
          onClick={() => scrollAboutAPage(1)}
        >
          ►
        </button>
      )}
      <div className={styles.strip} ref={strip} onScroll={updateScrollArrows}>
        <div className={styles.grid} ref={grid}>
          {VERSIONS.map((v, i) => (
            <Thumb
              key={v.id}
              version={v}
              scene={SCENES[scene]}
              index={i}
              gutterMark={gutterMarkFor(i)}
              onDrag={onDrag}
              onPick={(e) => onPick(i, comparing && e.shiftKey)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
