import { useEffect, useMemo, useRef, useState } from 'react';
import type { NodeKind, Scenario } from '../model/types';
import { NODE_SIZE } from '../model/scenario';
import { renderTerrain } from '../map/terrain';
import type { TaskView } from '../sim/bridge';
import { LayersIcon, LocateIcon } from './icons';

export interface View {
  panX: number;
  panY: number;
  zoom: number;
}

interface Props {
  scenario: Scenario;
  selectedId: string | null;
  view: View;
  fitToken: number; // bump to re-centre on the field
  tasks: TaskView[]; // engine task states; empty before a run
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
const STATE_LABEL: Record<TaskView['state'], string> = { pending: 'waiting', active: 'active', complete: 'done' };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Field view: the map always covers the viewport, so no edge or margin is ever shown. */
export function fitView(w: number, h: number, MW: number, MH: number): View {
  const zoom = Math.max(w / MW, h / MH);
  return { zoom, panX: (w - MW * zoom) / 2, panY: (h - MH * zoom) / 2 };
}

export function clampView(v: View, w: number, h: number, MW: number, MH: number): View {
  const minZoom = Math.max(w / MW, h / MH);
  const zoom = clamp(v.zoom, minZoom, minZoom * 4);
  return {
    zoom,
    panX: clamp(v.panX, w - MW * zoom, 0),
    panY: clamp(v.panY, h - MH * zoom, 0),
  };
}

export function MapCanvas({ scenario, selectedId, view, fitToken, tasks, onViewChange, onSelect, onMoveNode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const generated = useMemo(
    () =>
      scenario.terrain?.image
        ? null
        : renderTerrain(scenario.map.width, scenario.map.height, scenario.terrain?.seed ?? 1),
    [scenario.map.width, scenario.map.height, scenario.terrain?.seed, scenario.terrain?.image],
  );
  const imageSrc = scenario.terrain?.image;
  const [uploaded, setUploaded] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    setUploaded(null);
    if (!imageSrc) return;
    const img = new Image();
    let live = true;
    img.onload = () => {
      if (live) setUploaded(img);
    };
    img.src = imageSrc;
    return () => {
      live = false;
    };
  }, [imageSrc]);
  const terrain: CanvasImageSource | null = imageSrc ? uploaded : generated;

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const propsRef = useRef({ scenario, selectedId, view, onViewChange, onSelect, onMoveNode, terrain, taskById });
  propsRef.current = { scenario, selectedId, view, onViewChange, onSelect, onMoveNode, terrain, taskById };
  const drag = useRef<null | { mode: 'pan' | 'node'; id?: string; sx: number; sy: number; ox: number; oy: number }>(null);

  const size = () => {
    const wrap = wrapRef.current;
    return { w: wrap?.clientWidth ?? 0, h: wrap?.clientHeight ?? 0 };
  };

  const zoomAt = (sx: number, sy: number, factor: number) => {
    const { w, h } = size();
    if (!w || !h) return;
    const { view: v, scenario: s, onViewChange: change } = propsRef.current;
    const wx = (sx - v.panX) / v.zoom;
    const wy = (sy - v.panY) / v.zoom;
    const z = v.zoom * factor;
    change(clampView({ zoom: z, panX: sx - wx * z, panY: sy - wy * z }, w, h, s.map.width, s.map.height));
  };

  const recenter = () => {
    const { w, h } = size();
    if (!w || !h) return;
    const { scenario: s, onViewChange: change } = propsRef.current;
    change(fitView(w, h, s.map.width, s.map.height));
  };

  const draw = () => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const { scenario: s, selectedId: sel, view: v, terrain: base, taskById: states } = propsRef.current;
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

    // World layer (map units)
    ctx.setTransform(dpr * v.zoom, 0, 0, dpr * v.zoom, dpr * v.panX, dpr * v.panY);
    const { width: MW, height: MH } = s.map;
    if (base) {
      ctx.drawImage(base, 0, 0, MW, MH);
    } else {
      ctx.fillStyle = '#2b3a2a';
      ctx.fillRect(0, 0, MW, MH);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1 / v.zoom;
    ctx.beginPath();
    for (let x = 0; x <= MW; x += 100) { ctx.moveTo(x, 0); ctx.lineTo(x, MH); }
    for (let y = 0; y <= MH; y += 100) { ctx.moveTo(0, y); ctx.lineTo(MW, y); }
    ctx.stroke();

    const byId = new Map(s.nodes.map((n) => [n.id, n]));
    ctx.setLineDash([10 / v.zoom, 8 / v.zoom]);
    ctx.strokeStyle = '#c7d7ea';
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
      const st = states.get(n.id)?.state;
      const x0 = n.x - half;
      const y0 = n.y - half;
      ctx.globalAlpha = st === 'pending' ? 0.5 : 1;
      ctx.fillStyle = COLORS[n.kind];
      ctx.fillRect(x0, y0, NODE_SIZE, NODE_SIZE);
      if (st === 'complete') {
        ctx.fillStyle = 'rgba(34,197,94,0.45)';
        ctx.fillRect(x0, y0, NODE_SIZE, NODE_SIZE);
      }
      ctx.globalAlpha = 1;
      if (st === 'active') {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 6 / v.zoom;
        ctx.strokeRect(x0 - 3 / v.zoom, y0 - 3 / v.zoom, NODE_SIZE + 6 / v.zoom, NODE_SIZE + 6 / v.zoom);
      }
      ctx.strokeStyle = n.id === sel ? '#38bdf8' : st === 'complete' ? '#22c55e' : 'rgba(0,0,0,0.55)';
      ctx.lineWidth = (n.id === sel ? 4 : 2) / v.zoom;
      ctx.strokeRect(x0, y0, NODE_SIZE, NODE_SIZE);
    }

    // Screen layer (fixed pixel size for text and badges)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = 'center';
    for (const n of s.nodes) {
      const st = states.get(n.id)?.state;
      const cx = n.x * v.zoom + v.panX;
      const cy = n.y * v.zoom + v.panY;
      const sh = (NODE_SIZE * v.zoom) / 2;

      ctx.fillStyle = n.kind === 'medical' ? '#c0392b' : '#0a1322';
      ctx.font = 'bold 16px Inter, system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.kind === 'medical' ? '+' : n.kind.charAt(0).toUpperCase(), cx, cy);
      if (st === 'complete') {
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 14px Inter, system-ui, sans-serif';
        ctx.fillText('✓', cx - sh + 9, cy - sh + 9);
      }

      ctx.fillStyle = '#0a1322';
      ctx.beginPath();
      ctx.arc(cx + sh, cy - sh, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e6edf7';
      ctx.font = 'bold 11px Inter, system-ui, sans-serif';
      ctx.fillText(String(n.personnel), cx + sh, cy - sh);

      ctx.font = '12px Inter, system-ui, sans-serif';
      ctx.textBaseline = 'top';
      const label = st ? `${n.name} · ${STATE_LABEL[st]}` : n.name;
      const tw = ctx.measureText(label).width + 12;
      const ly = cy + sh + 5;
      ctx.fillStyle = 'rgba(10,19,34,0.9)';
      ctx.fillRect(cx - tw / 2, ly, tw, 20);
      ctx.fillStyle = st === 'active' ? '#7dd3fc' : st === 'complete' ? '#86efac' : '#e6edf7';
      ctx.fillText(label, cx, ly + 4);
    }
  };

  useEffect(() => {
    draw();
  });

  // Re-centre on mount, on reset, and when the map size changes.
  useEffect(() => {
    recenter();
  }, [fitToken, scenario.map.width, scenario.map.height]);

  // Keep the field locked to the viewport when the window is resized.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => {
      const { w, h } = size();
      const { view: v, scenario: s, onViewChange: change } = propsRef.current;
      if (!w || !h) return;
      const next = clampView(v, w, h, s.map.width, s.map.height);
      if (next.zoom !== v.zoom || next.panX !== v.panX || next.panY !== v.panY) change(next);
      draw();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
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
    const hit = hitNode((sx - v.panX) / v.zoom, (sy - v.panY) / v.zoom);
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
    const { w, h } = size();
    const { view: v, onViewChange: change, onMoveNode: move, scenario: s } = propsRef.current;
    if (d.mode === 'pan') {
      change(clampView({ ...v, panX: d.ox + (sx - d.sx), panY: d.oy + (sy - d.sy) }, w, h, s.map.width, s.map.height));
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
      <div className="compass" aria-label="North">
        <div className="needle" />
        <span>N</span>
      </div>
      <div className="mapTools">
        <button title="Zoom in" onClick={() => { const { w, h } = size(); zoomAt(w / 2, h / 2, 1.25); }}>+</button>
        <button title="Zoom out" onClick={() => { const { w, h } = size(); zoomAt(w / 2, h / 2, 1 / 1.25); }}>&minus;</button>
        <button title="Layers" disabled><LayersIcon /></button>
        <button title="Re-centre on field" onClick={recenter}><LocateIcon /></button>
      </div>
      <div className="scale">
        <div className="bar"><span /><span /><span /></div>
        <div className="scaleLabels"><span>0</span><span>0.5</span><span>1 km</span></div>
      </div>
    </div>
  );
}
