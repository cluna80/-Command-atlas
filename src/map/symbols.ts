// Unit symbols for the map. Simple fictional training symbology: a frame per unit
// type with a glyph inside. Drawn in map units, so they scale with the map.
import type { NodeKind } from '../model/types';

export const FRIENDLY = '#2f7df6';
const INK = '#f4f8ff';
const MEDICAL_RED = '#c0392b';

/** Draws the symbol centred on (cx, cy) in a square of `size` map units. */
export function drawUnitSymbol(ctx: CanvasRenderingContext2D, kind: NodeKind, cx: number, cy: number, size: number) {
  const half = size / 2;
  const x0 = cx - half;
  const y0 = cy - half;
  const s = size * 0.42; // glyph half-extent
  const stroke = size * 0.07;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Frame
  const medical = kind === 'medical';
  ctx.fillStyle = medical ? '#f4f6fa' : FRIENDLY;
  ctx.fillRect(x0, y0, size, size);
  ctx.strokeStyle = 'rgba(8,16,30,0.7)';
  ctx.lineWidth = size * 0.04;
  ctx.strokeRect(x0, y0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = size * 0.03;
  ctx.strokeRect(x0 + size * 0.06, y0 + size * 0.06, size * 0.88, size * 0.88);

  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = stroke;

  switch (kind) {
    case 'team': {
      // Crossed bars: a combat-team style mark
      ctx.beginPath();
      ctx.moveTo(cx - s, cy - s);
      ctx.lineTo(cx + s, cy + s);
      ctx.moveTo(cx + s, cy - s);
      ctx.lineTo(cx - s, cy + s);
      ctx.stroke();
      break;
    }
    case 'personnel': {
      // Single figure: head and shoulders
      ctx.beginPath();
      ctx.arc(cx, cy - s * 0.35, s * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy + s * 0.75, s * 0.55, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      break;
    }
    case 'transport': {
      // Vehicle: cab and cargo with two wheels
      ctx.beginPath();
      ctx.rect(cx - s, cy - s * 0.5, s * 1.25, s * 0.85);
      ctx.moveTo(cx + s * 0.25, cy - s * 0.5);
      ctx.lineTo(cx + s * 0.25, cy + s * 0.35);
      ctx.lineTo(cx + s, cy + s * 0.35);
      ctx.lineTo(cx + s, cy - s * 0.05);
      ctx.lineTo(cx + s * 0.7, cy - s * 0.5);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx - s * 0.5, cy + s * 0.55, s * 0.22, 0, Math.PI * 2);
      ctx.arc(cx + s * 0.6, cy + s * 0.55, s * 0.22, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'supply': {
      // Stores: a box with a lid line
      ctx.beginPath();
      ctx.rect(cx - s * 0.8, cy - s * 0.6, s * 1.6, s * 1.2);
      ctx.moveTo(cx - s * 0.8, cy - s * 0.1);
      ctx.lineTo(cx + s * 0.8, cy - s * 0.1);
      ctx.stroke();
      break;
    }
    case 'medical': {
      // Red cross on a white field
      ctx.fillStyle = MEDICAL_RED;
      const arm = s * 0.45;
      ctx.fillRect(cx - arm / 2, cy - s, arm, s * 2);
      ctx.fillRect(cx - s, cy - arm / 2, s * 2, arm);
      break;
    }
    case 'communications': {
      // Radio: mast with two sets of waves
      ctx.beginPath();
      ctx.arc(cx, cy + s * 0.2, s * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy + s * 0.2, s * 0.6, Math.PI * 1.25, Math.PI * 1.75);
      ctx.arc(cx, cy + s * 0.2, s * 0.6, Math.PI * 0.25, Math.PI * 0.75, true);
      ctx.moveTo(cx, cy + s * 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy + s * 0.2, s * 0.95, Math.PI * 1.3, Math.PI * 1.7);
      ctx.arc(cx, cy + s * 0.2, s * 0.95, Math.PI * 0.3, Math.PI * 0.7, true);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}
