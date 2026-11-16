import { type Ref, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SCENES, VERSIONS } from "../data.ts";
import { Thumb } from "./Thumb.tsx";
import styles from "./VersionStrip.module.css";

interface Props {
  scene: number;
  a: number;
  b: number;
  compare: boolean;
  // Click sets A; shift-click sets B while comparing.
  onPick: (index: number, asB: boolean) => void;
  onDrag: (dragging: boolean) => void;
  ref?: Ref<HTMLElement>;
}

// The versions, in release order. No scrollbar: ◄ ► cells inside the frame, level with the
// pictures, show when there's more that way, and each click moves about a box-width.
export function VersionStrip({ scene, a, b, compare, onPick, onDrag, ref }: Props) {
  const strip = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const s = strip.current;
    if (!s) return;
    const end = s.scrollWidth - s.clientWidth;
    setMore({ left: s.scrollLeft > 1, right: s.scrollLeft < end - 1 });
  }, []);

  useLayoutEffect(() => {
    if (!strip.current) return;
    const ro = new ResizeObserver(measure);
    ro.observe(strip.current);
    return () => ro.disconnect();
  }, [measure]);

  // Keep the version on screen in view as it changes (arrow keys, the parser).
  // biome-ignore lint/correctness/useExhaustiveDependencies: a and compare are what move the mark
  useEffect(() => {
    strip.current
      ?.querySelector("[data-mark='→'], [data-mark='A']")
      ?.closest("button")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    measure();
  }, [a, compare, measure]);

  const scroll = (dir: number) =>
    strip.current?.scrollBy({ left: dir * strip.current.clientWidth * 0.8, behavior: "smooth" });
  const markOf = (i: number) => (i === a ? (compare ? "A" : "→") : compare && i === b ? "B" : "");

  return (
    <section className={styles.vers} aria-label="Versions" ref={ref}>
      {more.left && (
        <button
          type="button"
          className={`${styles.arrow} ${styles.left}`}
          aria-label="Scroll versions left"
          onClick={() => scroll(-1)}
        >
          ◄
        </button>
      )}
      {more.right && (
        <button
          type="button"
          className={`${styles.arrow} ${styles.right}`}
          aria-label="Scroll versions right"
          onClick={() => scroll(1)}
        >
          ►
        </button>
      )}
      <div className={styles.strip} ref={strip} onScroll={measure}>
        <div className={styles.grid}>
          {VERSIONS.map((v, i) => (
            <Thumb
              key={v.id}
              version={v}
              scene={SCENES[scene]}
              index={i}
              mark={markOf(i)}
              onDrag={onDrag}
              onPick={(e) => onPick(i, compare && e.shiftKey)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
