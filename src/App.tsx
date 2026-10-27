import { useEffect, useMemo, useState } from 'react';
import { MapCanvas, type View } from './components/MapCanvas';
import { Inspector } from './components/Inspector';
import { TopBar } from './components/TopBar';
import { AssetLibrary } from './components/AssetLibrary';
import { BottomBar } from './components/BottomBar';
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
  const [view, setView] = useState<View>({ panX: 0, panY: 0, zoom: 1 });
  const [fitToken, setFitToken] = useState(0);
  const [notice, setNotice] = useState<{ title: string; issues: ValidationIssue[] } | null>(null);

  const issues = useMemo(() => validateScenario(scenario), [scenario]);
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
      if (e.key === 'Escape') setSelectedId(null);
      if (!selectedId) return;
      if (e.key === 'Delete' || e.key === 'Backspace') deleteNode(selectedId);
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

      <AssetLibrary onAdd={addNode} />

      <main className="mapPane">
        <MapCanvas
          scenario={scenario}
          selectedId={selectedId}
          view={view}
          fitToken={fitToken}
          onViewChange={setView}
          onSelect={setSelectedId}
          onMoveNode={(id, x, y) => updateNode(id, { x, y })}
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
      </main>

      <aside className="inspectorPane">
        {selected ? (
          <Inspector
            key={selected.id}
            node={selected}
            scenario={scenario}
            onApply={applyNode}
            onDelete={() => deleteNode(selected.id)}
            onDuplicate={() => duplicateNode(selected.id)}
            onAddDependency={(fromId) => addDependency(fromId, selected.id)}
            onRemoveDependency={removeDependency}
          />
        ) : (
          <div className="empty">Select a node on the map to edit its assignment.</div>
        )}
      </aside>

      <BottomBar />
    </div>
  );
}
