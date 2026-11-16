import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Dropdown, type MenuItem } from "./Dropdown.tsx";
import styles from "./MenuBar.module.css";

// With an icon (the Sierra logo), title is still its name for screen readers.
export interface Menu {
  title: string;
  icon?: ReactNode;
  items: MenuItem[];
}

interface Props {
  menus: Menu[];
  open: number | null;
  setOpen: (i: number | null) => void;
  visible: boolean;
}

export function MenuBar({ menus, open, setOpen, visible }: Props) {
  const titles = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (open === null) return;
    const closeOnClickAway = (e: PointerEvent) => {
      if (!(e.target as Element).closest("#dropdown, #statusline")) setOpen(null);
    };
    document.addEventListener("pointerdown", closeOnClickAway);
    return () => document.removeEventListener("pointerdown", closeOnClickAway);
  }, [open, setOpen]);

  if (!visible) return null;
  const anchor = open === null ? null : titles.current[open];

  return (
    <nav className={styles.menubar} aria-label="Menu">
      {menus.map((m, i) => (
        <button
          key={m.title}
          type="button"
          ref={(el) => {
            titles.current[i] = el;
          }}
          className={styles.title}
          aria-haspopup="menu"
          aria-expanded={i === open}
          aria-label={m.icon ? m.title : undefined}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(open === i ? null : i);
          }}
          onPointerEnter={() => {
            if (open !== null && open !== i) setOpen(i);
          }}
        >
          {m.icon ?? m.title}
        </button>
      ))}
      {open !== null && anchor && (
        <Dropdown
          key={open}
          items={menus[open].items}
          anchor={anchor}
          onClose={() => setOpen(null)}
          onMoveToAdjacentMenu={(direction) => setOpen((open + direction + menus.length) % menus.length)}
        />
      )}
    </nav>
  );
}
