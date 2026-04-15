import { useEffect, useRef, useState } from "react";
import { buildWavePath } from "@/lib/waveform";

interface UseAnimatedWavePathOptions {
  width: number;
  height: number;
  amplitude: number;
  frequency: number;
  points?: number;
  phaseStep?: number;
  getPhaseOffset?: () => number;
}

export const useAnimatedWavePath = ({
  width,
  height,
  amplitude,
  frequency,
  points = 100,
  phaseStep = 0.02,
  getPhaseOffset,
}: UseAnimatedWavePathOptions) => {
  const phaseRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const [path, setPath] = useState(() =>
    buildWavePath({
      width,
      height,
      amplitude,
      frequency,
      phase: phaseRef.current,
      points,
      phaseOffset: getPhaseOffset?.() ?? 0,
    })
  );

  useEffect(() => {
    const animate = () => {
      phaseRef.current += phaseStep;

      setPath(
        buildWavePath({
          width,
          height,
          amplitude,
          frequency,
          phase: phaseRef.current,
          points,
          phaseOffset: getPhaseOffset?.() ?? 0,
        })
      );

      frameRef.current = window.requestAnimationFrame(animate);
    };

    frameRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [amplitude, frequency, getPhaseOffset, height, phaseStep, points, width]);

  return path;
};
