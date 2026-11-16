import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./MessageBox.module.css";

// A reply goes away on any click, like AGI's messages. Text (About, Help) and a picture have an X
// and ignore clicks inside them; only text scrolls.
export type MessageKind = "reply" | "text" | "picture";

interface Props {
  kind: MessageKind;
  onClose: () => void;
  children: ReactNode;
}

// AGI's message box: white with a red frame, centred over everything. Long text scrolls inside the
// frame, so the frame stays put, with the scrollbar in the X's column. Esc and Enter close it too
// (useGlobalKeys handles those keys).
export function MessageBox({ kind, onClose, children }: Props) {
  const box = useRef<HTMLDivElement>(null),
    body = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(false);

  // A few pixels of rounding overflow shouldn't show a scrollbar that scrolls nowhere.
  // biome-ignore lint/correctness/useExhaustiveDependencies: new content is measured again
  useLayoutEffect(() => {
    if (kind !== "text") return;
    const measure = () => {
      const b = body.current;
      if (b) setScrolls(b.scrollHeight - b.clientHeight > 4);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [children, kind]);

  useEffect(() => {
    box.current?.focus();
  }, []);

  const closable = kind !== "reply";
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: a click on the backdrop; Esc and Enter close it from the keyboard (useGlobalKeys)
    <div
      className={styles.wrap}
      onClick={(e) => {
        if (!closable || e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={[styles.box, styles[kind], closable && styles.closable].filter(Boolean).join(" ")}
        id="msgbox"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        ref={box}
      >
        {closable && (
          <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
            X
          </button>
        )}
        <div className={`${styles.body}${scrolls ? ` ${styles.scrolls}` : ""}`} ref={body}>
          {children}
        </div>
      </div>
    </div>
  );
}
