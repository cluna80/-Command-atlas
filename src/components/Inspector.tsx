import type { ReactNode } from 'react';
import { NODE_KINDS, type Assignment, type Dependency, type ExerciseNode, type Scenario } from '../model/types';
import { nodeErrors } from '../model/scenario';

interface Props {
  node: ExerciseNode;
  scenario: Scenario;
  onNode: (patch: Partial<ExerciseNode>) => void;
  onAssignment: (patch: Partial<Assignment>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onAddDependency: (fromId: string) => void;
  onRemoveDependency: (dep: Dependency) => void;
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className={`field ${error ? 'hasError' : ''}`}>
      <span className="fieldLabel">{label}</span>
      {children}
      {error && <span className="fieldError">{error}</span>}
    </label>
  );
}

export function Inspector({
  node,
  scenario,
  onNode,
  onAssignment,
  onDelete,
  onDuplicate,
  onAddDependency,
  onRemoveDependency,
}: Props) {
  const errors = nodeErrors(node);
  const a = node.assignment;
  const byId = new Map(scenario.nodes.map((n) => [n.id, n]));
  const prerequisites = scenario.dependencies.filter((d) => d.toId === node.id);
  const successors = scenario.dependencies.filter((d) => d.fromId === node.id);
  const candidates = scenario.nodes.filter(
    (n) => n.id !== node.id && !prerequisites.some((d) => d.fromId === n.id),
  );

  return (
    <div className="inspector">
      <h2>Inspector</h2>

      <section>
        <h3>Node</h3>
        <Field label="Name" error={errors.name}>
          <input value={node.name} onChange={(e) => onNode({ name: e.target.value })} />
        </Field>
        <Field label="Type" error={errors.kind}>
          <select value={node.kind} onChange={(e) => onNode({ kind: e.target.value as ExerciseNode['kind'] })}>
            {NODE_KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </Field>
        <Field label="Personnel" error={errors.personnel}>
          <input
            type="number"
            min={0}
            max={999}
            value={Number.isNaN(node.personnel) ? '' : node.personnel}
            onChange={(e) => onNode({ personnel: Number(e.target.value) })}
          />
        </Field>
        <div className="readonly">Position: {Math.round(node.x)} m, {Math.round(node.y)} m</div>
      </section>

      <section>
        <h3>Assignment</h3>
        <Field label="Objective" error={errors.objective}>
          <textarea value={a.objective} onChange={(e) => onAssignment({ objective: e.target.value })} />
        </Field>
        <Field label="Role">
          <input value={a.role} onChange={(e) => onAssignment({ role: e.target.value })} />
        </Field>
        <Field label="Start (HH:MM)" error={errors.start}>
          <input value={a.start} onChange={(e) => onAssignment({ start: e.target.value })} />
        </Field>
        <Field label="Prerequisites">
          <textarea value={a.prerequisites} onChange={(e) => onAssignment({ prerequisites: e.target.value })} />
        </Field>
        <Field label="Resources">
          <textarea
            value={a.resourceRequirements}
            onChange={(e) => onAssignment({ resourceRequirements: e.target.value })}
          />
        </Field>
        <Field label="Completion criteria">
          <textarea
            value={a.completionCriteria}
            onChange={(e) => onAssignment({ completionCriteria: e.target.value })}
          />
        </Field>
        <Field label="Fallback">
          <textarea value={a.fallback} onChange={(e) => onAssignment({ fallback: e.target.value })} />
        </Field>
      </section>

      <section>
        <h3>Dependencies</h3>
        {prerequisites.length === 0 && successors.length === 0 && <div className="readonly">None</div>}
        {prerequisites.map((d) => (
          <div className="depRow" key={d.id}>
            <span>Waits for {byId.get(d.fromId)?.name ?? 'missing node'}</span>
            <button className="linkBtn" onClick={() => onRemoveDependency(d)}>remove</button>
          </div>
        ))}
        {successors.map((d) => (
          <div className="depRow" key={d.id}>
            <span>Must finish before {byId.get(d.toId)?.name ?? 'missing node'}</span>
            <button className="linkBtn" onClick={() => onRemoveDependency(d)}>remove</button>
          </div>
        ))}
        {candidates.length > 0 && (
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) onAddDependency(e.target.value);
              e.target.value = '';
            }}
          >
            <option value="">Add: waits for…</option>
            {candidates.map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
        )}
      </section>

      <div className="inspectorActions">
        <button onClick={onDuplicate}>Duplicate</button>
        <button className="danger" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}
