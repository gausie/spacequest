import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./MessageBox.module.css";

interface Props {
  holdsPicture?: boolean;
  // Something to read or look at (About, Help, a picture) has an X and ignores clicks inside it;
  // anything else goes away on any click, like AGI's messages.
  persistent?: boolean;
  onClose: () => void;
  children: ReactNode;
}

// AGI's message box: white with a red frame, centred over everything. The text scrolls inside the
// frame, so the frame stays put on a long message, with the scrollbar in the X's column. Esc and
// Enter close it too (App handles those keys).
export function MessageBox({ holdsPicture = false, persistent = false, onClose, children }: Props) {
  const box = useRef<HTMLDivElement>(null),
    body = useRef<HTMLDivElement>(null);
  const [fitsWithoutScrolling, setFitsWithoutScrolling] = useState(true);

  // A few pixels of rounding overflow shouldn't show a scrollbar that scrolls nowhere. Only
  // persistent boxes scroll at all (see the CSS).
  // biome-ignore lint/correctness/useExhaustiveDependencies: new content is measured again
  useLayoutEffect(() => {
    const measure = () => {
      const b = body.current;
      if (!b) return;
      setFitsWithoutScrolling(!persistent || b.scrollHeight - b.clientHeight <= 4);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [children, persistent]);

  useEffect(() => {
    box.current?.focus();
  }, []);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: a click on the backdrop; Esc and Enter close it from the keyboard (useGlobalKeys)
    <div
      className={styles.wrap}
      id="msgwrap"
      onClick={(e) => {
        if (!persistent || !(e.target as Element).closest("#msgbox")) onClose();
      }}
    >
      <div
        className={[styles.box, holdsPicture && styles.holdsPicture, persistent && styles.persistent]
          .filter(Boolean)
          .join(" ")}
        id="msgbox"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        ref={box}
      >
        {persistent && (
          <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
            X
          </button>
        )}
        <div className={`${styles.body}${fitsWithoutScrolling ? ` ${styles.fitsWithoutScrolling}` : ""}`} ref={body}>
          {children}
        </div>
      </div>
    </div>
  );
}
