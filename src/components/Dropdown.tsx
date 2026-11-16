import { type KeyboardEvent, useLayoutEffect, useRef, useState } from "react";
import styles from "./Dropdown.module.css";

// radio: on for the one chosen of a group (•); check: on for a toggle that's on (■).
export type MenuItem =
  | { label: string; keys?: string; radio?: boolean; check?: boolean; disabled?: boolean; run: () => void }
  | "-";

interface Props {
  items: MenuItem[];
  anchor: HTMLElement;
  onClose: () => void;
  // Left/right arrows move to the neighbouring menu.
  onStep: (by: number) => void;
}

const enabledItems = (box: HTMLElement | null) => [
  ...(box?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not([aria-disabled])") ?? []),
];

// One open menu: AGI's box with a black frame, the item under the pointer or focus inverted.
export function Dropdown({ items, anchor, onClose, onStep }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!box.current) return;
    const r = anchor.getBoundingClientRect(),
      w = box.current.offsetWidth;
    // Keep the box on screen when the title is near the right edge.
    setPos({ top: r.bottom, left: Math.max(0, Math.min(r.left, innerWidth - w)) });
    enabledItems(box.current)[0]?.focus();
  }, [anchor]);

  const onKeyDown = (e: KeyboardEvent) => {
    const enabled = enabledItems(box.current);
    const i = enabled.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") enabled[(i + 1) % enabled.length]?.focus();
    else if (e.key === "ArrowUp") enabled[(i - 1 + enabled.length) % enabled.length]?.focus();
    else if (e.key === "ArrowRight") onStep(1);
    else if (e.key === "ArrowLeft") onStep(-1);
    else if (e.key === "Escape") onClose();
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className={styles.dropdown} id="dropdown" role="menu" ref={box} style={pos} onKeyDown={onKeyDown}>
      {items.map((it, i) =>
        it === "-" ? (
          // A separator is keyed by the item before it; labels are unique within a menu.
          <div key={`after ${(items[i - 1] as Exclude<MenuItem, "-">).label}`} className={styles.sep} />
        ) : (
          <button
            key={it.label}
            type="button"
            className={styles.item}
            role="menuitem"
            aria-disabled={it.disabled || undefined}
            onPointerEnter={(e) => e.currentTarget.focus()}
            onClick={() => {
              if (it.disabled) return;
              onClose();
              it.run();
            }}
          >
            <span>
              <span className={styles.mark}>{it.radio ? "•" : it.check ? "■" : ""}</span>
              {it.label}
            </span>
            <span>{it.keys}</span>
          </button>
        ),
      )}
    </div>
  );
}
