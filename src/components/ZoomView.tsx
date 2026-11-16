import { type Scene, shotPath, type Version, versionLabel } from "../data.ts";
import styles from "./ZoomView.module.css";

export function ZoomView({ version, scene }: { version: Version; scene: Scene }) {
  return (
    <>
      <p className={styles.caption}>
        {scene.name}: {versionLabel(version)}, {version.year}
      </p>
      <img alt="" className={styles.picture} src={shotPath(version.id, scene.id)} />
    </>
  );
}
