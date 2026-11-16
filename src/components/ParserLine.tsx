import { type Ref, useRef } from "react";
import styles from "./ParserLine.module.css";

interface Props {
  // Each non-empty line typed, on Enter.
  onCommand: (text: string) => void;
  ref?: Ref<HTMLInputElement>;
}

// The parser line: ">" and whatever's typed. App sends stray keypresses here, as in the game.
export function ParserLine({ onCommand, ref }: Props) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form
      className={styles.parser}
      autoComplete="off"
      ref={form}
      onSubmit={(e) => {
        e.preventDefault();
        const input = form.current?.elements.namedItem("cmd");
        if (!(input instanceof HTMLInputElement)) return;
        const text = input.value;
        input.value = "";
        if (text.trim()) onCommand(text);
      }}
    >
      <label htmlFor="cmd" className={styles.prompt}>
        &gt;
      </label>
      <input
        id="cmd"
        name="cmd"
        className={styles.input}
        ref={ref}
        spellCheck={false}
        aria-label="Type a command, or HELP"
      />
    </form>
  );
}
