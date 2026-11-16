import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Dropdown, type MenuItem } from "./Dropdown.tsx";
import styles from "./MenuBar.module.css";

// A title can be an icon (the Sierra logo); title still names it for screen readers.
export interface Menu {
  title: string;
  icon?: ReactNode;
  items: MenuItem[];
}

interface Props {
  menus: Menu[];
  open: number; // -1: none
  setOpen: (i: number) => void;
  // The bar takes the status line's place only while it's in use.
  shown: boolean;
}

// The menu titles; one space between them, the open one inverted over its own text, as in AGI.
export function MenuBar({ menus, open, setOpen, shown }: Props) {
  const titles = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (open < 0) return;
    const away = (e: PointerEvent) => {
      if (!(e.target as Element).closest("#dropdown, #statusline")) setOpen(-1);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open, setOpen]);

  const step = (by: number) => setOpen((open + by + menus.length) % menus.length);
  const anchor = open >= 0 ? titles.current[open] : null;
  if (!shown) return null;

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
            setOpen(open === i ? -1 : i);
          }}
          onPointerEnter={() => {
            if (open >= 0 && open !== i) setOpen(i);
          }}
        >
          {m.icon ?? m.title}
        </button>
      ))}
      {anchor && (
        <Dropdown key={open} items={menus[open].items} anchor={anchor} onClose={() => setOpen(-1)} onStep={step} />
      )}
    </nav>
  );
}
