import { useEffect, useMemo, useState } from 'react';
import { MapCanvas, type View } from './components/MapCanvas';
import { Inspector } from './components/Inspector';
import {
  createNode,
  createSampleScenario,
  newId,
  parseScenario,
  serializeScenario,
  validateScenario,
} from './model/scenario';
import { NODE_KINDS, type Assignment, type Dependency, type ExerciseNode, type NodeKind, type Scenario, type ValidationIssue } from './model/types';

export default function App() {
  const [scenario, setScenario] = useState<Scenario>(() => createSampleScenario());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>({ panX: 0, panY: 0, zoom: 1 });
  const [fitToken, setFitToken] = useState(0);
  const [notice, setNotice] = useState<{ title: string; issues: ValidationIssue[] } | null>(null);

  const issues = useMemo(() => validateScenario(scenario), [scenario]);
  const selected = scenario.nodes.find((n) => n.id === selectedId) ?? null;

  const updateNode = (id: string, patch: Partial<ExerciseNode>) =>
    setScenario((s) => ({ ...s, nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }));

  const updateAssignment = (id: string, patch: Partial<Assignment>) =>
    setScenario((s) => ({
      ...s,
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, assignment: { ...n.assignment, ...patch } } : n)),
    }));

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

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
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

  // Keyboard: Delete removes the selected node, Ctrl/Cmd+D duplicates it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
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
      <header className="topbar">
        <div className="brand">COMMAND ATLAS</div>
        <input
          className="scenarioName"
          value={scenario.name}
          onChange={(e) => setScenario((s) => ({ ...s, name: e.target.value }))}
          aria-label="Scenario name"
        />
        <span className={`status ${issues.length ? 'bad' : 'ok'}`}>
          {issues.length ? `${issues.length} issue${issues.length > 1 ? 's' : ''}` : 'Valid'}
        </span>
        <span className="spacer" />
        <label className="btn">
          Load
          <input type="file" accept="application/json,.json" onChange={onFile} hidden />
        </label>
        <button className="btn primary" onClick={save}>Save</button>
        <span className="training">TRAINING ONLY</span>
      </header>

      <aside className="palette">
        <div className="panelTitle">Add to map</div>
        {NODE_KINDS.map((k) => (
          <button key={k} className="paletteItem" onClick={() => addNode(k)}>
            + {k}
          </button>
        ))}
        <div className="panelTitle" style={{ marginTop: 16 }}>View</div>
        <button className="paletteItem" onClick={() => setFitToken((t) => t + 1)}>Reset view</button>
      </aside>

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
                <li key={idx}>
                  <span className="where">{i.where}:</span> {i.message}
                </li>
              ))}
            </ul>
            <button className="linkBtn" onClick={() => setNotice(null)}>Dismiss</button>
          </div>
        )}
      </main>

      <aside className="inspectorPane">
        {selected ? (
          <Inspector
            node={selected}
            scenario={scenario}
            onNode={(patch) => updateNode(selected.id, patch)}
            onAssignment={(patch) => updateAssignment(selected.id, patch)}
            onDelete={() => deleteNode(selected.id)}
            onDuplicate={() => duplicateNode(selected.id)}
            onAddDependency={(fromId) => addDependency(fromId, selected.id)}
            onRemoveDependency={removeDependency}
          />
        ) : (
          <div className="empty">Select a node on the map to edit its assignment.</div>
        )}
      </aside>
    </div>
  );
}
