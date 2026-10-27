// Procedural fictional terrain and map art: relief, biomes, contours, forest, roads,
// buildings, grid, and named features. Deterministic for a given seed.
import { fbm, mulberry32, valueNoise } from './noise';

export interface Field {
  w: number;
  h: number;
  elev: Float32Array; // 0..1 after river carving
  cover: Float32Array; // 0..1 vegetation density
  moisture: Float32Array; // 0..1 (low = dry)
  water: Uint8Array; // 1 = water
}

type RGB = [number, number, number];
type Stop = [number, RGB];
type Pt = [number, number];

const RELIEF_M = 380;
const SCALE = 2; // rendered art is 2 px per map unit
const RIVER_HALF = 0.012;
const LAKE_LEVEL = 0.12;
const TAU = Math.PI * 2;

const TOWN_NAMES = ['Riverbrook', 'Millford', 'Ashton Cross', 'Hollin Bridge'];
const PEAK_NAMES = ['Pine Ridge', 'North Point', 'West Ridge', 'East Ridge', 'Stone Creek', 'Cold Spring', 'Hollow Ridge', 'Eagle Crest', 'Larch Hill', 'Black Tarn'];
const LAKE_NAMES = ['Clearwater Lake', 'Silver Tarn', 'Long Mere', 'Still Water'];

const LAND: Stop[] = [
  [0.12, [88, 110, 60]],
  [0.4, [76, 102, 56]],
  [0.6, [102, 106, 68]],
  [0.78, [126, 118, 98]],
  [1, [174, 168, 154]],
];
const DRY: RGB = [146, 134, 92];
const FOREST: RGB = [34, 58, 33];
const SAND: RGB = [166, 156, 116];
const WATER_DEEP: RGB = [26, 74, 98];
const WATER_SHALLOW: RGB = [60, 122, 144];

const smoothstep = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
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

/** Separable box blur, radius r cells. */
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let n = 0;
      for (let k = -r; k <= r; k++) {
        const xx = x + k;
        if (xx >= 0 && xx < w) { s += src[y * w + xx]; n++; }
      }
      tmp[y * w + x] = s / n;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let n = 0;
      for (let k = -r; k <= r; k++) {
        const yy = y + k;
        if (yy >= 0 && yy < h) { s += tmp[yy * w + x]; n++; }
      }
      out[y * w + x] = s / n;
    }
  }
  return out;
}

/** River centre-line as a function of vertical fraction (0 = top, 1 = bottom). */
export function makeRiverX(seed: number): (fy: number) => number {
  const rnd = mulberry32(seed + 7);
  const p1 = rnd() * TAU;
  const p2 = rnd() * TAU;
  return (fy: number) => 0.34 + 0.08 * Math.sin(fy * 4.2 + p1) + 0.03 * Math.sin(fy * 11 + p2);
}

export function generateField(w: number, h: number, seed: number): Field {
  const nBase = valueNoise(seed);
  const nWx = valueNoise(seed + 11);
  const nWy = valueNoise(seed + 12);
  const nRidge = valueNoise(seed + 101);
  const nCover = valueNoise(seed + 202);
  const nMoist = valueNoise(seed + 303);
  const riverX = makeRiverX(seed);

  const elev = new Float32Array(w * h);
  const cover = new Float32Array(w * h);
  const moisture = new Float32Array(w * h);
  let lo = Infinity;
  let hi = -Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const nx = (x / w) * 3.2;
      const ny = (y / h) * 3.2;
      // Domain warp: bend the coordinates so landforms look organic, not blobby.
      const wx = nx + 0.7 * (fbm(nWx, nx, ny, 3) - 0.5);
      const wy = ny + 0.7 * (fbm(nWy, nx, ny, 3) - 0.5);
      const base = fbm(nBase, wx, wy, 6);
      const ridge = 1 - Math.abs(2 * fbm(nRidge, wx * 1.4, wy * 1.4, 5) - 1);
      elev[i] = 0.65 * base + 0.35 * ridge * ridge;
      if (elev[i] < lo) lo = elev[i];
      if (elev[i] > hi) hi = elev[i];
      cover[i] = fbm(nCover, nx * 2.2, ny * 2.2, 4);
      moisture[i] = fbm(nMoist, nx * 1.6, ny * 1.6, 4);
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
      moisture[i] = clamp01(moisture[i] + 0.25 * (1 - smoothstep(0, 0.06, d)));
      if (d < RIVER_HALF) {
        e = LAKE_LEVEL * 0.6;
        water[i] = 1;
      }
      elev[i] = clamp01(e);
    }
  }
  for (let i = 0; i < elev.length; i++) if (elev[i] < LAKE_LEVEL) water[i] = 1;

  return { w, h, elev, cover, moisture, water };
}

function shadeField(f: Field, worldW: number, data: Uint8ClampedArray) {
  const { w, h, elev, cover, moisture, water } = f;
  const cell = worldW / w;
  const zen = Math.PI / 4; // 45 degree sun
  const az = 2.356; // north-west light
  const sample = (x: number, y: number) =>
    elev[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  const waterF = Float32Array.from(water);
  const ao = boxBlur(elev, w, h, 5); // local average height: valleys sit below it
  const shore = boxBlur(waterF, w, h, 3);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const e = elev[i];
      const dzdx = ((sample(x + 1, y) - sample(x - 1, y)) * RELIEF_M) / (2 * cell);
      const dzdy = ((sample(x, y + 1) - sample(x, y - 1)) * RELIEF_M) / (2 * cell);
      const slope = Math.atan(Math.hypot(dzdx, dzdy));
      const aspect = Math.atan2(dzdy, -dzdx);
      const hs = clamp01(Math.cos(zen) * Math.cos(slope) + Math.sin(zen) * Math.sin(slope) * Math.cos(az - aspect));
      const occlusion = clamp01(1 - 3 * Math.max(0, ao[i] - e));

      let c: RGB;
      if (water[i]) {
        c = mix(WATER_DEEP, WATER_SHALLOW, clamp01(e / LAKE_LEVEL));
      } else {
        c = ramp(LAND, e);
        const dry = clamp01((0.5 - moisture[i]) * 2.2);
        c = mix(c, DRY, dry * 0.55);
        const fo = smoothstep(0.52, 0.66, cover[i]);
        c = mix(c, FOREST, fo * 0.85);
        if (shore[i] > 0.02) c = mix(c, SAND, clamp01(shore[i] * 2.5) * 0.7);
        const j = (hash(x, y) - 0.5) * 14 * (0.4 + fo);
        c = [c[0] + j, c[1] + j, c[2] + j];
      }

      // Contours: fine lines every 1/40 of relief, index lines every 1/8.
      const minor = Math.floor(e * 40);
      const index = Math.floor(e * 8);
      const minorEdge =
        (x + 1 < w && Math.floor(sample(x + 1, y) * 40) !== minor) ||
        (y + 1 < h && Math.floor(sample(x, y + 1) * 40) !== minor);
      const indexEdge =
        (x + 1 < w && Math.floor(sample(x + 1, y) * 8) !== index) ||
        (y + 1 < h && Math.floor(sample(x, y + 1) * 8) !== index);
      let k = 1;
      if (!water[i]) {
        if (minorEdge) k *= 0.9;
        if (indexEdge) k *= 0.72;
      }

      const lum = (0.3 + 0.9 * hs) * occlusion * k;
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

function drawGrid(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 100) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y <= H; y += 100) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
}

/** Forest as clusters of canopy with soft shadows (light from the north-west). */
function drawForest(ctx: CanvasRenderingContext2D, f: Field, W: number, H: number, seed: number) {
  const rnd = mulberry32(seed + 99);
  for (let n = 0; n < 2600; n++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const i = fieldIndex(f, x, y, W, H);
    if (f.water[i] || f.cover[i] < 0.58) continue;
    const count = 3 + Math.floor(rnd() * 5);
    for (let k = 0; k < count; k++) {
      const tx = x + (rnd() - 0.5) * 16;
      const ty = y + (rnd() - 0.5) * 16;
      const r = 2.2 + rnd() * 2.6;
      const g = 44 + rnd() * 40;
      ctx.fillStyle = 'rgba(6,16,8,0.5)';
      ctx.beginPath();
      ctx.arc(tx + 1.8, ty + 2.2, r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = `rgb(${Math.round(g * 0.5)},${Math.round(g)},${Math.round(g * 0.45)})`;
      ctx.beginPath();
      ctx.arc(tx, ty, r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(190,235,170,0.14)';
      ctx.beginPath();
      ctx.arc(tx - r * 0.3, ty - r * 0.3, r * 0.45, 0, TAU);
      ctx.fill();
    }
  }
}

type RoadClass = 'highway' | 'road' | 'track';
const ROADS: [RoadClass, Pt, Pt, Pt][] = [
  ['highway', [0, 0.5], [0.35, 0.62], [1, 0.42]],
  ['road', [0.56, 0.44], [0.5, 0.7], [0.3, 1]],
  ['road', [0.56, 0.44], [0.72, 0.3], [1, 0.12]],
  ['track', [0.1, 0], [0.2, 0.4], [0.12, 0.8]],
  ['track', [0.8, 1], [0.7, 0.7], [0.92, 0.55]],
];

function drawRoads(ctx: CanvasRenderingContext2D, W: number, H: number, riverX: (fy: number) => number) {
  for (const [cls, p0, c, p1] of ROADS) {
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(p0[0] * W, p0[1] * H);
      ctx.quadraticCurveTo(c[0] * W, c[1] * H, p1[0] * W, p1[1] * H);
    };
    ctx.lineCap = 'round';
    if (cls === 'track') {
      path();
      ctx.strokeStyle = '#8f8160';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      continue;
    }
    const outer = cls === 'highway' ? 11 : 8;
    const inner = cls === 'highway' ? 7 : 5;
    path();
    ctx.strokeStyle = '#3b3428';
    ctx.lineWidth = outer;
    ctx.stroke();
    path();
    ctx.strokeStyle = cls === 'highway' ? '#e3d8b4' : '#d4c9a6';
    ctx.lineWidth = inner;
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

/** One building: shadow, roof, and a ridge line so it reads as a roof, not a flat box. */
function building(ctx: CanvasRenderingContext2D, x: number, y: number, bw: number, bh: number, roof: string) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x - bw / 2 + 2, y - bh / 2 + 2, bw, bh);
  ctx.fillStyle = roof;
  ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh);
  ctx.strokeStyle = 'rgba(20,18,14,0.55)';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(x - bw / 2, y - bh / 2, bw, bh);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  if (bw >= bh) {
    ctx.beginPath();
    ctx.moveTo(x - bw / 2, y);
    ctx.lineTo(x + bw / 2, y);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x, y - bh / 2);
    ctx.lineTo(x, y + bh / 2);
    ctx.stroke();
  }
}

const ROOFS = ['#9d9383', '#7d766a', '#b7ad98', '#8c6f5a'];

function drawTown(ctx: CanvasRenderingContext2D, f: Field, W: number, H: number, seed: number) {
  const rnd = mulberry32(seed + 55);
  const cx = 0.56 * W;
  const cy = 0.44 * H;
  for (let n = 0; n < 90; n++) {
    const a = rnd() * TAU;
    const rr = Math.sqrt(rnd());
    const x = cx + Math.cos(a) * 0.08 * W * rr;
    const y = cy + Math.sin(a) * 0.07 * H * rr;
    if (f.water[fieldIndex(f, x, y, W, H)]) continue;
    building(ctx, x, y, 7 + rnd() * 6, 6 + rnd() * 6, ROOFS[Math.floor(rnd() * ROOFS.length)]);
  }
  // Outlying farms: small groups of buildings in open ground.
  for (let n = 0; n < 8; n++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const i = fieldIndex(f, x, y, W, H);
    if (f.water[i] || f.cover[i] > 0.5) continue;
    for (let k = 0; k < 3; k++) {
      building(ctx, x + (k - 1) * 14, y + (k % 2) * 8, 12, 9, ROOFS[k]);
    }
  }
}

function findPeaks(f: Field, W: number, H: number, count: number): { x: number; y: number; e: number }[] {
  const step = 6;
  const r = 12;
  const found: { x: number; y: number; e: number }[] = [];
  for (let y = r; y < f.h - r; y += step) {
    for (let x = r; x < f.w - r; x += step) {
      const e = f.elev[y * f.w + x];
      let isMax = true;
      for (let dy = -r; dy <= r && isMax; dy += 3) {
        for (let dx = -r; dx <= r; dx += 3) {
          if (f.elev[(y + dy) * f.w + (x + dx)] > e) { isMax = false; break; }
        }
      }
      if (isMax && e > 0.45) found.push({ x: ((x + 0.5) / f.w) * W, y: ((y + 0.5) / f.h) * H, e });
    }
  }
  found.sort((a, b) => b.e - a.e);
  const picked: typeof found = [];
  for (const p of found) {
    if (picked.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > 220)) picked.push(p);
    if (picked.length === count) break;
  }
  return picked;
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) {
  ctx.font = `600 ${size}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.3;
  ctx.strokeStyle = 'rgba(8,14,24,0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#f3f1e4';
  ctx.fillText(text, x, y);
}

function drawNames(ctx: CanvasRenderingContext2D, f: Field, W: number, H: number, seed: number, riverX: (fy: number) => number) {
  const rnd = mulberry32(seed + 77);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const peakNames = [...PEAK_NAMES].sort(() => rnd() - 0.5);

  findPeaks(f, W, H, 3).forEach((p, i) => {
    const metres = Math.round(120 + p.e * RELIEF_M * 1.1);
    label(ctx, `▲ ${peakNames[i]} ${metres} m`, p.x, p.y, 16);
  });

  // Lake label: centroid of standing water away from the river.
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let y = 0; y < f.h; y++) {
    for (let x = 0; x < f.w; x++) {
      const i = y * f.w + x;
      if (!f.water[i]) continue;
      const fx = (x + 0.5) / f.w;
      if (Math.abs(fx - riverX((y + 0.5) / f.h)) < 0.08) continue;
      sx += fx;
      sy += (y + 0.5) / f.h;
      n++;
    }
  }
  if (n >= 30) label(ctx, pick(LAKE_NAMES), (sx / n) * W, (sy / n) * H, 15);

  label(ctx, pick(TOWN_NAMES), 0.56 * W, 0.36 * H, 20);
}

/** Renders the full map art (in map units, scaled by SCALE). */
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

  drawGrid(ctx, worldW, worldH);
  drawForest(ctx, field, worldW, worldH, seed);
  drawRoads(ctx, worldW, worldH, riverX);
  drawTown(ctx, field, worldW, worldH, seed);
  drawNames(ctx, field, worldW, worldH, seed, riverX);

  ctx.strokeStyle = 'rgba(230,237,247,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, worldW, worldH);
  return out;
}
