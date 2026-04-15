export interface WavePathOptions {
  width: number;
  height: number;
  amplitude: number;
  frequency: number;
  phase: number;
  points?: number;
  phaseOffset?: number;
}

const DEFAULT_POINTS = 100;

export const buildWavePath = ({
  width,
  height,
  amplitude,
  frequency,
  phase,
  points = DEFAULT_POINTS,
  phaseOffset = 0,
}: WavePathOptions) => {
  const centerY = height / 2;
  const safePoints = Math.max(2, points);
  const pointsList: string[] = [];

  for (let index = 0; index < safePoints; index += 1) {
    const x = (index / (safePoints - 1)) * width;
    const y =
      centerY +
      amplitude *
        Math.sin((x / width) * frequency * Math.PI * 2 + phase + phaseOffset);

    pointsList.push(`${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
  }

  return pointsList.join(" ");
};
