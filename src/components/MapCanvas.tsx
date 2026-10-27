import { useEffect, useRef } from 'react';
import type { NodeKind, Scenario } from '../model/types';
import { NODE_SIZE } from '../model/scenario';

export interface View {
  panX: number;
  panY: number;
  zoom: number;
}

interface Props {
  scenario: Scenario;
  selectedId: string | null;
  view: View;
  fitToken: number; // bump to fit the whole map into the viewport
  onViewChange: (v: View) => void;
  onSelect: (id: string | null) => void;
  onMoveNode: (id: string, x: number, y: number) => void;
}

const COLORS: Record<NodeKind, string> = {
  team: '#2f7df6',
  personnel: '#60a5fa',
  transport: '#94a3b8',
  supply: '#1f3c66',
  medical: '#f4f6fa',
  communications: '#a78bfa',
};

const CONTOURS: [number, number, number][] = [
  [0.2, 0.2, 220],
  [0.22, 0.21, 330],
  [0.75, 0.8, 260],
  [0.55, 0.12, 180],
];

const FIT_PADDING = 60;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function MapCanvas({ scenario, selectedId, view, fitToken, onViewChange, onSelect, onMoveNode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef({ scenario, selectedId, view, onViewChange, onSelect, onMoveNode });
  propsRef.current = { scenario, selectedId, view, onViewChange, onSelect, onMoveNode };
  const drag = useRef<null | { mode: 'pan' | 'node'; id?: string; sx: number; sy: number; ox: number; oy: number }>(null);

  const draw = () => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const { scenario: s, selectedId: sel, view: v } = propsRef.current;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0a1322';
    ctx.fillRect(0, 0, w, h);

    // ---- World layer (map units) ----
    ctx.setTransform(dpr * v.zoom, 0, 0, dpr * v.zoom, dpr * v.panX, dpr * v.panY);
    const { width: MW, height: MH } = s.map;

    ctx.fillStyle = '#36552f';
    ctx.fillRect(0, 0, MW, MH);
    ctx.strokeStyle = 'rgba(201,185,138,0.22)';
    ctx.lineWidth = 1.5 / v.zoom;
    for (const [fx, fy, r] of CONTOURS) {
      ctx.beginPath();
      ctx.arc(fx * MW, fy * MH, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.ellipse(0.87 * MW, 0.2 * MH, 0.1 * MW, 0.08 * MH, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#2c5f78';
    ctx.fill();
    ctx.strokeStyle = '#4b8ca8';
    ctx.lineWidth = 3 / v.zoom;
    ctx.stroke();

    const river: [number, number][] = [[0.28, 0], [0.26, 0.2], [0.23, 0.45], [0.27, 0.7], [0.21, 1]];
    ctx.beginPath();
    river.forEach(([fx, fy], i) => (i ? ctx.lineTo(fx * MW, fy * MH) : ctx.moveTo(fx * MW, fy * MH)));
    ctx.strokeStyle = '#2f6d8f';
    ctx.lineWidth = 14 / v.zoom;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1 / v.zoom;
    ctx.beginPath();
    for (let x = 0; x <= MW; x += 100) { ctx.moveTo(x, 0); ctx.lineTo(x, MH); }
    for (let y = 0; y <= MH; y += 100) { ctx.moveTo(0, y); ctx.lineTo(MW, y); }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(230,237,247,0.35)';
    ctx.lineWidth = 2 / v.zoom;
    ctx.strokeRect(0, 0, MW, MH);

    const byId = new Map(s.nodes.map((n) => [n.id, n]));
    ctx.setLineDash([10 / v.zoom, 8 / v.zoom]);
    ctx.strokeStyle = '#8fa3bf';
    ctx.lineWidth = 2 / v.zoom;
    for (const d of s.dependencies) {
      const a = byId.get(d.fromId);
      const b = byId.get(d.toId);
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    const half = NODE_SIZE / 2;
    for (const n of s.nodes) {
      const x0 = n.x - half;
      const y0 = n.y - half;
      ctx.fillStyle = COLORS[n.kind];
      ctx.fillRect(x0, y0, NODE_SIZE, NODE_SIZE);
      ctx.strokeStyle = n.id === sel ? '#38bdf8' : 'rgba(0,0,0,0.5)';
      ctx.lineWidth = (n.id === sel ? 4 : 2) / v.zoom;
      ctx.strokeRect(x0, y0, NODE_SIZE, NODE_SIZE);
    }

    // ---- Screen layer (fixed pixel size for text and badges) ----
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = 'center';
    for (const n of s.nodes) {
      const cx = n.x * v.zoom + v.panX;
      const cy = n.y * v.zoom + v.panY;
      const sh = (NODE_SIZE * v.zoom) / 2;

      ctx.fillStyle = n.kind === 'medical' ? '#c0392b' : '#0a1322';
      ctx.font = 'bold 16px Inter, system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.kind === 'medical' ? '+' : n.kind.charAt(0).toUpperCase(), cx, cy);

      // personnel badge at top-right corner
      ctx.fillStyle = '#0a1322';
      ctx.beginPath();
      ctx.arc(cx + sh, cy - sh, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e6edf7';
      ctx.font = 'bold 11px Inter, system-ui, sans-serif';
      ctx.fillText(String(n.personnel), cx + sh, cy - sh);

      // name label, one line, below the node
      ctx.font = '12px Inter, system-ui, sans-serif';
      ctx.textBaseline = 'top';
      const tw = ctx.measureText(n.name).width + 12;
      const ly = cy + sh + 5;
      ctx.fillStyle = 'rgba(10,19,34,0.9)';
      ctx.fillRect(cx - tw / 2, ly, tw, 20);
      ctx.fillStyle = '#e6edf7';
      ctx.fillText(n.name, cx, ly + 4);
    }
  };

  useEffect(() => {
    draw();
  });

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // Fit the whole map into the viewport on mount, on reset, and when the map size changes.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const { width: MW, height: MH } = propsRef.current.scenario.map;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    const zoom = clamp(Math.min((w - FIT_PADDING * 2) / MW, (h - FIT_PADDING * 2) / MH), 0.25, 1.5);
    propsRef.current.onViewChange({ zoom, panX: (w - MW * zoom) / 2, panY: (h - MH * zoom) / 2 });
  }, [fitToken, scenario.map.width, scenario.map.height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { view: v, onViewChange: change } = propsRef.current;
      const zoom = clamp(v.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), 0.25, 4);
      const wx = (sx - v.panX) / v.zoom;
      const wy = (sy - v.panY) / v.zoom;
      change({ zoom, panX: sx - wx * zoom, panY: sy - wy * zoom });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  const localPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  };

  const hitNode = (wx: number, wy: number) => {
    const half = NODE_SIZE / 2;
    const { scenario: s } = propsRef.current;
    for (let i = s.nodes.length - 1; i >= 0; i--) {
      const n = s.nodes[i];
      if (Math.abs(wx - n.x) <= half && Math.abs(wy - n.y) <= half) return n;
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { sx, sy } = localPoint(e);
    const { view: v, onSelect: select } = propsRef.current;
    const wx = (sx - v.panX) / v.zoom;
    const wy = (sy - v.panY) / v.zoom;
    const hit = hitNode(wx, wy);
    if (hit) {
      select(hit.id);
      drag.current = { mode: 'node', id: hit.id, sx, sy, ox: hit.x, oy: hit.y };
    } else {
      select(null);
      drag.current = { mode: 'pan', sx, sy, ox: v.panX, oy: v.panY };
    }
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d) return;
    const { sx, sy } = localPoint(e);
    const { view: v, onViewChange: change, onMoveNode: move, scenario: s } = propsRef.current;
    if (d.mode === 'pan') {
      change({ ...v, panX: d.ox + (sx - d.sx), panY: d.oy + (sy - d.sy) });
    } else if (d.id) {
      const half = NODE_SIZE / 2;
      const x = clamp(d.ox + (sx - d.sx) / v.zoom, half, s.map.width - half);
      const y = clamp(d.oy + (sy - d.sy) / v.zoom, half, s.map.height - half);
      move(d.id, Math.round(x), Math.round(y));
    }
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div className="mapWrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <div className="mapHint">Drag nodes to place · drag background to pan · scroll to zoom</div>
    </div>
  );
}
