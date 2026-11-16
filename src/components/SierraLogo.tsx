import styles from "./Icon.module.css";

// The Sierra mountain (src/assets/sierra.svg), which SCI0 menu bars used as the first menu's title.
export function SierraLogo() {
  return <span className={`${styles.icon} ${styles.sierra}`} aria-hidden="true" />;
}
