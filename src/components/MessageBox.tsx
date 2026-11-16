import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./MessageBox.module.css";

interface Props {
  // For a picture: no width limit and no scrolling.
  wide?: boolean;
  // Something to read or look at (About, Help, a picture) gets an X, and clicks inside it leave it
  // open. A short reply has none and goes away on any click, like AGI's messages.
  closeButton?: boolean;
  onClose: () => void;
  children: ReactNode;
}

// AGI's message box: white with a red frame, centred over everything. The text scrolls inside the
// frame, so the frame stays put on a long message, with the scrollbar in the X's column. Esc and
// Enter close it too (App handles those keys).
export function MessageBox({ wide = false, closeButton = false, onClose, children }: Props) {
  const box = useRef<HTMLDivElement>(null),
    body = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(true);

  // A few pixels of rounding overflow shouldn't show a scrollbar that scrolls nowhere. Only boxes
  // with an X scroll at all (see the CSS).
  // biome-ignore lint/correctness/useExhaustiveDependencies: new content is measured again
  useLayoutEffect(() => {
    const measure = () => {
      const b = body.current;
      if (!b) return;
      setFits(!closeButton || b.scrollHeight - b.clientHeight <= 4);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [children, closeButton]);

  useEffect(() => {
    box.current?.focus();
  }, []);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: a click on the backdrop; Esc and Enter close it from the keyboard (useGlobalKeys)
    <div
      className={styles.wrap}
      id="msgwrap"
      onClick={(e) => {
        if (!closeButton || !(e.target as Element).closest("#msgbox")) onClose();
      }}
    >
      <div
        className={[styles.box, wide && styles.wide, closeButton && styles.closable].filter(Boolean).join(" ")}
        id="msgbox"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        ref={box}
      >
        {closeButton && (
          <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
            X
          </button>
        )}
        <div className={`${styles.body}${fits ? ` ${styles.fits}` : ""}`} ref={body}>
          {children}
        </div>
      </div>
    </div>
  );
}
