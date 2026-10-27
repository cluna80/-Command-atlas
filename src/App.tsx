import { useEffect, useMemo, useRef, useState } from 'react';
import { MapCanvas, type View } from './components/MapCanvas';
import { Inspector } from './components/Inspector';
import { TopBar } from './components/TopBar';
import { AssetLibrary } from './components/AssetLibrary';
import { BottomBar } from './components/BottomBar';
import { View3D } from './components/View3D';
import { useSimulation } from './sim/useSimulation';
import {
  NODE_SIZE,
  createNode,
  createSampleScenario,
  newId,
  parseScenario,
  serializeScenario,
  validateScenario,
} from './model/scenario';
import type { Dependency, ExerciseNode, NodeKind, Scenario, ValidationIssue } from './model/types';

const MAP_WIDTH = 1400;
const GENERATED_HEIGHT = 1000;

const clampNodes = (nodes: ExerciseNode[], width: number, height: number) =>
  nodes.map((n) => ({
    ...n,
    x: Math.min(width - NODE_SIZE / 2, Math.max(NODE_SIZE / 2, n.x)),
    y: Math.min(height - NODE_SIZE / 2, Math.max(NODE_SIZE / 2, n.y)),
  }));

export default function App() {
  const [scenario, setScenario] = useState<Scenario>(() => createSampleScenario());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [multi, setMulti] = useState<string[]>([]);
  const selection = multi.length > 1 ? multi : selectedId ? [selectedId] : [];

  // Undo / redo. Changes made within 400 ms of each other count as one step (for example, a drag).
  const committed = useRef(scenario);
  const hist = useRef<{ past: Scenario[]; future: Scenario[]; last: number }>({ past: [], future: [], last: 0 });
  const [, setHistoryTick] = useState(0);
  useEffect(() => {
    if (scenario === committed.current) return;
    const now = Date.now();
    if (now - hist.current.last > 400) {
      hist.current.past.push(committed.current);
      if (hist.current.past.length > 100) hist.current.past.shift();
    }
    hist.current.future = [];
    hist.current.last = now;
    committed.current = scenario;
    setHistoryTick((t) => t + 1);
  }, [scenario]);
  const undo = () => {
    const h = hist.current;
    const prev = h.past.pop();
    if (!prev) return;
    h.future.push(committed.current);
    committed.current = prev;
    h.last = 0;
    setScenario(prev);
    setMulti([]);
    setHistoryTick((t) => t + 1);
  };
  const redo = () => {
    const h = hist.current;
    const next = h.future.pop();
    if (!next) return;
    h.past.push(committed.current);
    committed.current = next;
    h.last = 0;
    setScenario(next);
    setMulti([]);
    setHistoryTick((t) => t + 1);
  };

  const toggleMulti = (id: string) => {
    const base = multi.length ? multi : selectedId ? [selectedId] : [];
    const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    setMulti(next);
    setSelectedId(next.length ? id : null);
  };
  const deleteSelection = () => {
    const ids = selection;
    setScenario((s) => ({
      ...s,
      nodes: s.nodes.filter((n) => !ids.includes(n.id)),
      dependencies: s.dependencies.filter((d) => !ids.includes(d.fromId) && !ids.includes(d.toId)),
    }));
    setMulti([]);
    setSelectedId(null);
  };
  // Dragging a unit that is part of a multi-selection moves the whole selection by the same amount.
  const moveNodes = (id: string, x: number, y: number) => {
    const ids = selection.includes(id) && selection.length > 1 ? selection : [id];
    setScenario((s) => {
      const lead = s.nodes.find((n) => n.id === id);
      if (!lead) return s;
      const dx = x - lead.x;
      const dy = y - lead.y;
      return { ...s, nodes: s.nodes.map((n) => (ids.includes(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n)) };
    });
  };
  const [view, setView] = useState<View>({ panX: 0, panY: 0, zoom: 1 });
  const [fitToken, setFitToken] = useState(0);
  const [view3d, setView3d] = useState(false);
  const [notice, setNotice] = useState<{ title: string; issues: ValidationIssue[] } | null>(null);

  const issues = useMemo(() => validateScenario(scenario), [scenario]);
  const sim = useSimulation(scenario);
  const selected = scenario.nodes.find((n) => n.id === selectedId) ?? null;
  const resetView = () => setFitToken((t) => t + 1);

  const updateNode = (id: string, patch: Partial<ExerciseNode>) =>
    setScenario((s) => ({ ...s, nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }));

  const applyNode = (node: ExerciseNode) =>
    setScenario((s) => ({ ...s, nodes: s.nodes.map((n) => (n.id === node.id ? node : n)) }));

  const addNode = (kind: NodeKind) => {
    const node = createNode(kind, scenario.map.width / 2, scenario.map.height / 2, scenario.nodes);
    setScenario((s) => ({ ...s, nodes: [...s.nodes, node] }));
    setSelectedId(node.id);
  };

  const deleteNode = (id: string) => {
    setScenario((s) => ({
      ...s,
      nodes: s.nodes.filter((n) => n.id !== id),
      dependencies: s.dependencies.filter((d) => d.fromId !== id && d.toId !== id),
    }));
    setSelectedId(null);
  };

  const duplicateNode = (id: string) => {
    const src = scenario.nodes.find((n) => n.id === id);
    if (!src) return;
    const copy: ExerciseNode = {
      ...src,
      id: newId(src.kind),
      name: `${src.name} (copy)`.slice(0, 60),
      x: src.x + 60,
      y: src.y + 60,
      assignment: { ...src.assignment },
    };
    setScenario((s) => ({ ...s, nodes: [...s.nodes, copy] }));
    setSelectedId(copy.id);
  };

  const addDependency = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setScenario((s) => {
      if (s.dependencies.some((d) => d.fromId === fromId && d.toId === toId)) return s;
      const dep: Dependency = { id: newId('dep'), fromId, toId };
      return { ...s, dependencies: [...s.dependencies, dep] };
    });
  };

  const removeDependency = (dep: Dependency) =>
    setScenario((s) => ({ ...s, dependencies: s.dependencies.filter((d) => d.id !== dep.id) }));

  const save = () => {
    if (issues.length) {
      setNotice({ title: 'Fix these before saving', issues });
      return;
    }
    setNotice(null);
    const slug = scenario.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'scenario';
    const blob = new Blob([serializeScenario(scenario)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}.scenario.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadScenario = async (file: File) => {
    const { scenario: loaded, issues: found } = parseScenario(await file.text());
    if (loaded) {
      setScenario(loaded);
      setSelectedId(null);
      setFitToken((t) => t + 1);
      setNotice(null);
    } else {
      setNotice({ title: `Could not load ${file.name}`, issues: found });
    }
  };

  const loadBaseMap = async (file: File) => {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2800 / bitmap.width);
    const c = document.createElement('canvas');
    c.width = Math.round(bitmap.width * scale);
    c.height = Math.round(bitmap.height * scale);
    c.getContext('2d')!.drawImage(bitmap, 0, 0, c.width, c.height);
    bitmap.close();
    const dataUrl = c.toDataURL('image/jpeg', 0.9);
    const height = Math.round((MAP_WIDTH * c.height) / c.width);
    setScenario((s) => ({
      ...s,
      map: { width: MAP_WIDTH, height },
      terrain: { seed: s.terrain?.seed ?? 1, image: dataUrl },
      nodes: clampNodes(s.nodes, MAP_WIDTH, height),
    }));
    setFitToken((t) => t + 1);
  };

  const useGeneratedTerrain = () => {
    setScenario((s) => ({
      ...s,
      map: { width: MAP_WIDTH, height: GENERATED_HEIGHT },
      terrain: { seed: s.terrain?.seed ?? 1 },
      nodes: clampNodes(s.nodes, MAP_WIDTH, GENERATED_HEIGHT),
    }));
    setFitToken((t) => t + 1);
  };

  const uploadMapFile = async (file: File) => {
    try {
      await loadBaseMap(file);
    } catch {
      setNotice({ title: `Could not use ${file.name}`, issues: [{ where: 'file', message: 'Choose a JPG, PNG, or other image file.' }] });
    }
  };

  // Keyboard: Delete removes the selected node, Ctrl/Cmd+D duplicates it, Escape clears selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === 'Escape') {
        setSelectedId(null);
        setMulti([]);
      }
      if (!selectedId) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selection.length > 1) deleteSelection();
        else deleteNode(selectedId);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateNode(selectedId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="app">
      <TopBar
        scenario={scenario}
        issueCount={issues.length}
        hasImage={!!scenario.terrain?.image}
        onRename={(name) => setScenario((s) => ({ ...s, name }))}
        onSave={save}
        onLoad={loadScenario}
        onUploadMap={uploadMapFile}
        onUseGenerated={useGeneratedTerrain}
        onResetView={resetView}
      />

      <AssetLibrary
        onAdd={addNode}
        selected={selected}
        selectionCount={selection.length}
        onDeleteSelection={deleteSelection}
        onOpen3D={() => setView3d(true)}
      />

      <main className="mapPane">
        <MapCanvas
          scenario={scenario}
          selectedId={selectedId}
          view={view}
          fitToken={fitToken}
          tasks={sim.snap?.tasks ?? []}
          nowS={sim.snap?.now_s ?? 0}
          onViewChange={setView}
          onSelect={(id) => {
            setMulti([]);
            setSelectedId(id);
          }}
          multiIds={multi}
          onShiftSelect={toggleMulti}
          onMoveNode={moveNodes}
        />
        {notice && (
          <div className="notice">
            <strong>{notice.title}</strong>
            <ul>
              {notice.issues.map((i, idx) => (
                <li key={idx}><span className="where">{i.where}:</span> {i.message}</li>
              ))}
            </ul>
            <button className="linkBtn" onClick={() => setNotice(null)}>Dismiss</button>
          </div>
        )}
        <div className="histBar">
          <button onClick={undo} disabled={hist.current.past.length === 0} title="Undo (Ctrl+Z)">Undo</button>
          <button onClick={redo} disabled={hist.current.future.length === 0} title="Redo (Ctrl+Shift+Z)">Redo</button>
        </div>
      </main>

      <aside className="inspectorPane">
        {selected ? (
          <Inspector
            key={selected.id}
            node={selected}
            scenario={scenario}
            onApply={applyNode}
            onPatch={(patch) => updateNode(selected.id, patch)}
            onDelete={() => deleteNode(selected.id)}
            onDuplicate={() => duplicateNode(selected.id)}
            onAddDependency={(fromId) => addDependency(fromId, selected.id)}
            onRemoveDependency={removeDependency}
          />
        ) : (
          <div className="empty">Select a node on the map to edit its assignment.</div>
        )}
      </aside>

      {view3d && selected && (
        <div className="overlay3d">
          <View3D
            scenario={scenario}
            unit={selected}
            tasks={sim.snap?.tasks ?? []}
            nowS={sim.snap?.now_s ?? 0}
            running={sim.running}
            speed={sim.speed}
            onClose={() => setView3d(false)}
          />
        </div>
      )}

      <BottomBar
        snap={sim.snap}
        running={sim.running}
        speed={sim.speed}
        onSpeed={sim.setSpeed}
        onRun={sim.run}
        onPause={sim.pause}
        onStep={sim.step}
        error={sim.error}
        stale={sim.stale}
        desktop={sim.desktop}
      />
    </div>
  );
}
