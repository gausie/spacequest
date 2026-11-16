import styles from "./HelpText.module.css";

export function HelpText() {
  return (
    <>
      <p>Press ESC to use the menu, or type a command and press ENTER:</p>
      <dl className={styles.keys}>
        <dt>orat, bar, xenon</dt>
        <dd>go to a scene</dd>
        <dt>vga, amiga, mac</dt>
        <dd>show a version</dd>
        <dt>compare amiga</dt>
        <dd>split the screen</dd>
        <dt>look</dt>
        <dd>see the picture up close</dd>
        <dt>zoom 2, crt</dt>
        <dd>display</dd>
      </dl>
      <p>
        Keys: ◄ ► version, ▲ ▼ scene, F2 compare, F3 swap, F4 CRT, F9 copy link. Drag a version onto the screen to
        compare.
      </p>
    </>
  );
}
