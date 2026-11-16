import { useState } from "react";
import { type Menu, MenuBar } from "./MenuBar.tsx";
import { SierraLogo } from "./SierraLogo.tsx";
import styles from "./StatusLine.module.css";

interface Props {
  sceneName: string;
  versionText: string;
  menus: Menu[];
  openMenu: number | null;
  setOpenMenu: (i: number | null) => void;
}

// AGI's status line, which turns into the menu bar while you hover it, click it or press Esc,
// as Esc did in the game. It shows what you're looking at where AGI had "Score:0 of 202".
export function StatusLine({ sceneName, versionText, menus, openMenu, setOpenMenu }: Props) {
  const [hover, setHover] = useState(false);
  const showingMenu = hover || openMenu !== null;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover and tap only reveal the menu bar; Esc opens it from the keyboard
    <header
      className={`${styles.statusline}${showingMenu ? ` ${styles.menu}` : ""}`}
      id="statusline"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      // A tap on the line itself (no hover on touch screens) opens the first menu. Clicks on a
      // title or in the open menu (which is inside this element) are theirs.
      onClick={(e) => {
        if (!(e.target as Element).closest("[aria-haspopup], #dropdown")) setOpenMenu(0);
      }}
    >
      <div className={styles.status}>
        <span className={styles.left}>
          <SierraLogo />
          <span>{sceneName}</span>
        </span>
        <span className={styles.right}>{versionText}</span>
      </div>
      {showingMenu && <MenuBar menus={menus} open={openMenu} setOpen={setOpenMenu} />}
    </header>
  );
}
