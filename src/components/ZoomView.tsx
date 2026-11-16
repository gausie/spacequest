import { type Scene, shotPath, type Version } from "../data.ts";
import styles from "./ZoomView.module.css";

// The picture as large as the window allows, under its caption.
export function ZoomView({ version, scene }: { version: Version; scene: Scene }) {
  return (
    <>
      <p className={styles.caption}>
        {scene.name}: {version.engine} {version.name}, {version.year}
      </p>
      <img alt="" className={styles.picture} src={shotPath(version.id, scene.id)} />
    </>
  );
}
