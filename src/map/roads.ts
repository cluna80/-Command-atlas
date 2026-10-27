// Road network data. Roads are polylines in map metres. Scenarios without their own
// roads use the default network, which matches the roads drawn on the generated map.
export type RoadClass = 'highway' | 'road' | 'track';

export interface Road {
  id: string;
  class: RoadClass;
  points: [number, number][];
}

const DEFAULT_CURVES: [string, RoadClass, [number, number], [number, number], [number, number]][] = [
  ['highway-ew', 'highway', [0, 0.5], [0.35, 0.62], [1, 0.42]],
  ['road-sw', 'road', [0.56, 0.44], [0.5, 0.7], [0.3, 1]],
  ['road-ne', 'road', [0.56, 0.44], [0.72, 0.3], [1, 0.12]],
  ['track-w', 'track', [0.1, 0], [0.2, 0.4], [0.12, 0.8]],
  ['track-e', 'track', [0.8, 1], [0.7, 0.7], [0.92, 0.55]],
];

function sampleQuadratic(p0: [number, number], c: [number, number], p1: [number, number], W: number, H: number, n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0];
    const y = (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1];
    out.push([x * W, y * H]);
  }
  return out;
}

export function defaultRoads(W: number, H: number): Road[] {
  return DEFAULT_CURVES.map(([id, cls, p0, c, p1]) => ({
    id,
    class: cls,
    points: sampleQuadratic(p0, c, p1, W, H, 16),
  }));
}

export function effectiveRoads(s: { map: { width: number; height: number }; roads?: Road[] }): Road[] {
  return s.roads && s.roads.length > 0 ? s.roads : defaultRoads(s.map.width, s.map.height);
}
