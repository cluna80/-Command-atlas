// Procedural fictional terrain: elevation, river, lakes, forest cover, and rendered map art.
import { fbm, mulberry32, valueNoise } from './noise';

export interface Field {
  w: number;
  h: number;
  elev: Float32Array; // 0..1, after river carving
  cover: Float32Array; // 0..1 vegetation density
  water: Uint8Array; // 1 = water
}

type RGB = [number, number, number];
type Stop = [number, RGB];

const RELIEF_M = 380; // metres of relief across the full elevation range
const SCALE = 2; // rendered art is 2 px per map unit
const RIVER_HALF = 0.012; // half-width of the river as a fraction of map width
const LAKE_LEVEL = 0.12;
const TAU = Math.PI * 2;

const LAND_STOPS: Stop[] = [
  [0.12, [92, 112, 62]],
  [0.4, [78, 104, 58]],
  [0.6, [104, 108, 70]],
  [0.78, [128, 120, 100]],
  [1, [176, 170, 156]],
];
const WATER_DEEP: RGB = [28, 78, 102];
const WATER_SHALLOW: RGB = [52, 110, 134];
const FOREST: RGB = [38, 64, 36];

const smoothstep = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
function ramp(stops: Stop[], t: number): RGB {
  if (t <= stops[0][0]) return stops[0][1];
  for (let k = 1; k < stops.length; k++) {
    const [t1, c1] = stops[k];
    if (t <= t1) {
      const [t0, c0] = stops[k - 1];
      return mix(c0, c1, (t - t0) / (t1 - t0));
    }
  }
  return stops[stops.length - 1][1];
}
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** River centre-line as a function of vertical fraction (0 = top, 1 = bottom). */
export function makeRiverX(seed: number): (fy: number) => number {
  const rnd = mulberry32(seed + 7);
  const p1 = rnd() * TAU;
  const p2 = rnd() * TAU;
  return (fy: number) => 0.34 + 0.08 * Math.sin(fy * 4.2 + p1) + 0.03 * Math.sin(fy * 11 + p2);
}

export function generateField(w: number, h: number, seed: number): Field {
  const nBase = valueNoise(seed);
  const nRidge = valueNoise(seed + 101);
  const nCover = valueNoise(seed + 202);
  const riverX = makeRiverX(seed);

  const elev = new Float32Array(w * h);
  const cover = new Float32Array(w * h);
  let lo = Infinity;
  let hi = -Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const nx = (x / w) * 3.2;
      const ny = (y / h) * 3.2;
      const base = fbm(nBase, nx, ny, 5);
      const ridge = 1 - Math.abs(2 * fbm(nRidge, nx * 1.4, ny * 1.4, 4) - 1);
      const e = 0.7 * base + 0.3 * ridge * ridge;
      elev[i] = e;
      cover[i] = fbm(nCover, nx * 2.2, ny * 2.2, 4);
      if (e < lo) lo = e;
      if (e > hi) hi = e;
    }
  }

  const water = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const rx = riverX((y + 0.5) / h);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let e = (elev[i] - lo) / (hi - lo);
      const d = Math.abs((x + 0.5) / w - rx);
      e -= 0.12 * (1 - smoothstep(0, 0.035, d)); // river valley
      if (d < RIVER_HALF) {
        e = LAKE_LEVEL * 0.6;
        water[i] = 1;
      }
      elev[i] = clamp01(e);
    }
  }
  for (let i = 0; i < elev.length; i++) if (elev[i] < LAKE_LEVEL) water[i] = 1;

  return { w, h, elev, cover, water };
}

function shadeField(f: Field, worldW: number, data: Uint8ClampedArray) {
  const { w, h, elev, cover, water } = f;
  const cell = worldW / w;
  const zen = Math.PI / 4; // 45 degree sun altitude
  const az = 2.356; // 315 degree compass azimuth, in maths convention
  const sample = (x: number, y: number) =>
    elev[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const e = elev[i];
      const dzdx = ((sample(x + 1, y) - sample(x - 1, y)) * RELIEF_M) / (2 * cell);
      const dzdy = ((sample(x, y + 1) - sample(x, y - 1)) * RELIEF_M) / (2 * cell);
      const slope = Math.atan(Math.hypot(dzdx, dzdy));
      const aspect = Math.atan2(dzdy, -dzdx);
      const hs = clamp01(
        Math.cos(zen) * Math.cos(slope) + Math.sin(zen) * Math.sin(slope) * Math.cos(az - aspect),
      );

      let c: RGB;
      if (water[i]) {
        c = mix(WATER_DEEP, WATER_SHALLOW, clamp01(e / LAKE_LEVEL));
        c = [c[0] * (0.85 + 0.2 * hs), c[1] * (0.85 + 0.2 * hs), c[2] * (0.85 + 0.2 * hs)];
      } else {
        c = ramp(LAND_STOPS, e);
        const fo = smoothstep(0.52, 0.66, cover[i]);
        c = mix(c, FOREST, fo * 0.85);
        const j = (hash(x, y) - 0.5) * 16 * (0.4 + fo);
        c = [c[0] + j, c[1] + j, c[2] + j];
      }

      // Contour lines: darken the cell where its elevation band differs from a neighbour's.
      const level = Math.floor(e * 14);
      const edge =
        (x + 1 < w && Math.floor(sample(x + 1, y) * 14) !== level) ||
        (y + 1 < h && Math.floor(sample(x, y + 1) * 14) !== level);
      const contour = edge && !water[i] ? 0.78 : 1;

      const lum = (0.35 + 0.85 * hs) * contour;
      data[i * 4] = c[0] * lum;
      data[i * 4 + 1] = c[1] * lum;
      data[i * 4 + 2] = c[2] * lum;
      data[i * 4 + 3] = 255;
    }
  }
}

function fieldIndex(f: Field, x: number, y: number, W: number, H: number): number {
  const cx = Math.min(f.w - 1, Math.max(0, Math.floor((x / W) * f.w)));
  const cy = Math.min(f.h - 1, Math.max(0, Math.floor((y / H) * f.h)));
  return cy * f.w + cx;
}

function drawTrees(ctx: CanvasRenderingContext2D, f: Field, W: number, H: number, seed: number) {
  const rnd = mulberry32(seed + 99);
  for (let n = 0; n < 9000; n++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const i = fieldIndex(f, x, y, W, H);
    if (f.water[i] || f.cover[i] < 0.6) continue;
    const r = 2.4 + rnd() * 1.8;
    ctx.fillStyle = 'rgba(12,24,12,0.45)';
    ctx.beginPath();
    ctx.arc(x + 1.2, y + 1.6, r, 0, TAU);
    ctx.fill();
    const g = 52 + rnd() * 30;
    ctx.fillStyle = `rgb(${Math.round(g * 0.55)},${Math.round(g)},${Math.round(g * 0.5)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
}

function drawRoads(ctx: CanvasRenderingContext2D, W: number, H: number, riverX: (fy: number) => number) {
  type Pt = [number, number];
  const roads: [Pt, Pt, Pt][] = [
    [[0, 0.5], [0.35, 0.62], [1, 0.42]], // east-west road across the river
    [[0.56, 0.44], [0.5, 0.7], [0.3, 1]], // south-west from the town
    [[0.56, 0.44], [0.72, 0.3], [1, 0.12]], // north-east from the town
  ];
  for (const [p0, c, p1] of roads) {
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(p0[0] * W, p0[1] * H);
      ctx.quadraticCurveTo(c[0] * W, c[1] * H, p1[0] * W, p1[1] * H);
    };
    ctx.lineCap = 'round';
    path();
    ctx.strokeStyle = '#3b3428';
    ctx.lineWidth = 9;
    ctx.stroke();
    path();
    ctx.strokeStyle = '#d9d0b2';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Bridge where the road meets the river.
    for (let t = 0; t <= 1; t += 0.002) {
      const x = (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0];
      const y = (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1];
      if (Math.abs(x - riverX(y)) < RIVER_HALF) {
        ctx.fillStyle = '#7d7360';
        ctx.fillRect(x * W - 9, y * H - 5, 18, 10);
        ctx.strokeStyle = '#2b251c';
        ctx.lineWidth = 1;
        ctx.strokeRect(x * W - 9, y * H - 5, 18, 10);
        break;
      }
    }
  }
}

function drawTown(ctx: CanvasRenderingContext2D, f: Field, W: number, H: number, seed: number) {
  const rnd = mulberry32(seed + 55);
  const cx = 0.56 * W;
  const cy = 0.44 * H;
  const rx = 0.08 * W;
  const ry = 0.07 * H;
  const roofs = ['#9d9383', '#7d766a', '#b7ad98', '#8c6f5a'];
  for (let n = 0; n < 80; n++) {
    const a = rnd() * TAU;
    const rr = Math.sqrt(rnd());
    const x = cx + Math.cos(a) * rx * rr;
    const y = cy + Math.sin(a) * ry * rr;
    if (f.water[fieldIndex(f, x, y, W, H)]) continue;
    const bw = 7 + rnd() * 6;
    const bh = 6 + rnd() * 6;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x - bw / 2 + 2, y - bh / 2 + 2, bw, bh);
    ctx.fillStyle = roofs[Math.floor(rnd() * roofs.length)];
    ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh);
    ctx.strokeStyle = 'rgba(20,18,14,0.6)';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x - bw / 2, y - bh / 2, bw, bh);
  }
}

/** Renders the full terrain for a map as a canvas in map units, scaled by SCALE. */
export function renderTerrain(worldW: number, worldH: number, seed: number): HTMLCanvasElement {
  const w = Math.max(16, Math.round(worldW / 2));
  const h = Math.max(16, Math.round(worldH / 2));
  const field = generateField(w, h, seed);
  const riverX = makeRiverX(seed);

  const small = document.createElement('canvas');
  small.width = w;
  small.height = h;
  const sctx = small.getContext('2d')!;
  const img = sctx.createImageData(w, h);
  shadeField(field, worldW, img.data);
  sctx.putImageData(img, 0, 0);

  const out = document.createElement('canvas');
  out.width = worldW * SCALE;
  out.height = worldH * SCALE;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(small, 0, 0, out.width, out.height);
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  drawTrees(ctx, field, worldW, worldH, seed);
  drawRoads(ctx, worldW, worldH, riverX);
  drawTown(ctx, field, worldW, worldH, seed);
  return out;
}
