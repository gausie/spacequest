import styles from "./Icon.module.css";

// GitHub's mark (src/assets/github.svg): 16x16, so half-size pixels in one text cell.
export function GitHubMark() {
  return <span className={`${styles.icon} ${styles.github}`} aria-hidden="true" />;
}
