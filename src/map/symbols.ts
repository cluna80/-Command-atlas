// Map icons: a pictogram for each unit type on a round backdrop.
// Pictograms are SVG paths on a 24-unit grid, drawn in map units so they scale with the map.
import type { NodeKind } from '../model/types';

export const FRIENDLY = '#2f7df6';
const INK = '#f4f8ff';
const MEDICAL_RED = '#c0392b';

const PERSON_HEAD = 'M12 2.5a4 4 0 1 1 0 8a4 4 0 1 1 0-8z';
const PERSON_BODY = 'M4 21.5c0-4.6 3.6-7.4 8-7.4s8 2.8 8 7.4z';
const TRUCK_CARGO = 'M1.5 6h13v10.5h-13z';
const TRUCK_CAB = 'M15.5 9.5h4.2l3.3 3.6v3.4h-7.5z';
const WHEEL_L = 'M7 16.2a2.6 2.6 0 1 1 0 .01z';
const WHEEL_R = 'M18 16.2a2.6 2.6 0 1 1 0 .01z';
const CRATE_TOP = 'M12 2.5l9 4.5-9 4.5-9-4.5z';
const CRATE_SIDES = 'M3 7v9.5l9 4.5 9-4.5V7l-9 4.5z';
const CRATE_EDGE = 'M12 12v9.5';
const CROSS = 'M9.5 4.5h5v5h5v5h-5v5h-5v-5h-5v-5h5z';
const RADIO_BODY = 'M5.5 10h13v10.5h-13z';
const RADIO_ANTENNA = 'M9 10L18 2.5';
const RADIO_GRILL = 'M8 14.5h8M8 17h8';

/** Draws a path given in 24-unit icon space, centred at (dx, dy) with scale `sc`. */
function icon(ctx: CanvasRenderingContext2D, d: string, dx: number, dy: number, sc: number, fill: boolean) {
  ctx.save();
  ctx.translate(dx, dy);
  ctx.scale(sc, sc);
  ctx.translate(-12, -12);
  const p = new Path2D(d);
  if (fill) ctx.fill(p);
  else ctx.stroke(p);
  ctx.restore();
}

function person(ctx: CanvasRenderingContext2D, dx: number, dy: number, sc: number, color: string) {
  ctx.fillStyle = color;
  icon(ctx, PERSON_HEAD, dx, dy, sc, true);
  icon(ctx, PERSON_BODY, dx, dy, sc, true);
}

/** Draws the icon centred on (cx, cy) in a square of `size` map units. */
export function drawUnitSymbol(ctx: CanvasRenderingContext2D, kind: NodeKind, cx: number, cy: number, size: number, squad = 0) {
  const r = size * 0.46;
  const k = (size * 0.62) / 24; // icon scale: 24 icon units -> map units
  const medical = kind === 'medical';

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Backdrop with soft shadow
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = size * 0.12;
  ctx.shadowOffsetY = size * 0.05;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  const base = medical ? '#f4f6fa' : FRIENDLY;
  const sheen = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  sheen.addColorStop(0, medical ? '#ffffff' : '#7fb3ff');
  sheen.addColorStop(1, base);
  ctx.fillStyle = sheen;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = size * 0.035;
  ctx.strokeStyle = 'rgba(8,16,30,0.75)';
  ctx.stroke();

  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6 * k * 0.5;

  switch (kind) {
    case 'personnel':
      person(ctx, cx, cy, k * 1.05, INK);
      break;
    case 'team':
      person(ctx, cx - 5 * k, cy + 1.2 * k, k * 0.72, INK);
      person(ctx, cx + 5 * k, cy + 1.2 * k, k * 0.72, INK);
      person(ctx, cx, cy - 0.6 * k, k * 0.95, INK);
      break;
    case 'transport':
      icon(ctx, TRUCK_CARGO, cx, cy, k, true);
      icon(ctx, TRUCK_CAB, cx, cy, k, true);
      ctx.fillStyle = FRIENDLY;
      icon(ctx, WHEEL_L, cx, cy, k * 1.1, true);
      icon(ctx, WHEEL_R, cx, cy, k * 1.1, true);
      ctx.fillStyle = INK;
      icon(ctx, WHEEL_L, cx, cy, k * 0.6, true);
      icon(ctx, WHEEL_R, cx, cy, k * 0.6, true);
      break;
    case 'supply':
      icon(ctx, CRATE_TOP, cx, cy, k, true);
      icon(ctx, CRATE_SIDES, cx, cy, k, true);
      ctx.strokeStyle = FRIENDLY;
      ctx.lineWidth = 1.4 * k;
      icon(ctx, CRATE_EDGE, cx, cy, k, false);
      break;
    case 'medical':
      ctx.fillStyle = MEDICAL_RED;
      icon(ctx, CROSS, cx, cy, k, true);
      break;
    case 'communications':
      icon(ctx, RADIO_BODY, cx, cy, k, true);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5 * k;
      icon(ctx, RADIO_ANTENNA, cx, cy, k, false);
      ctx.strokeStyle = FRIENDLY;
      ctx.lineWidth = 1.2 * k;
      icon(ctx, RADIO_GRILL, cx, cy, k, false);
      break;
  }
  // Squad pips: one dot per roster member along the lower rim, up to six.
  const count = Math.min(6, Math.max(0, squad));
  if (count > 0) {
    ctx.fillStyle = INK;
    for (let i = 0; i < count; i++) {
      const a = Math.PI * (0.3 + (0.4 * (count === 1 ? 0.5 : i / (count - 1))));
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82, size * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
