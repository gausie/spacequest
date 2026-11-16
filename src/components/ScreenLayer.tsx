import { useCallback, useEffect, useRef } from "react";
import { type Scene, shotPath, type Version } from "../data.ts";
import { useCrt } from "../hooks/useCrt.ts";
import styles from "./ScreenLayer.module.css";

interface Props {
  id: string;
  version: Version;
  scene: Scene;
  crt: boolean;
  screenWidth: number;
  className?: string;
}

// One picture on the screen: the capture, and over it a canvas with the CRT version when it's on.
export function ScreenLayer({ id, version, scene, crt, screenWidth, className = "" }: Props) {
  const img = useRef<HTMLImageElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const drawCrt = useCrt(canvas);
  const drawCrtIfOn = useCallback(() => {
    if (crt && img.current) drawCrt(img.current, version);
  }, [crt, version, drawCrt]);

  // A new picture redraws on load; this covers CRT being switched on and resizes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: screenWidth and scene are what trigger a redraw
  useEffect(() => {
    drawCrtIfOn();
  }, [drawCrtIfOn, screenWidth, scene]);

  return (
    <div className={[styles.layer, crt && styles.crt, className].filter(Boolean).join(" ")} id={id}>
      <img ref={img} alt="" draggable={false} src={shotPath(version.id, scene.id)} onLoad={drawCrtIfOn} />
      <canvas ref={canvas} />
    </div>
  );
}
