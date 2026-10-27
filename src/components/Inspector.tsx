import { useState } from 'react';
import { NODE_KINDS, type Dependency, type ExerciseNode, type Scenario, type Status } from '../model/types';
import { nodeErrors } from '../model/scenario';
import { DocIcon } from './icons';

type Tab = 'details' | 'personnel' | 'equipment';
const ROLE_OPTIONS = ['Evacuation support', 'Supply run', 'Medical support', 'Observation'];
const STATUSES: Status[] = ['Ready', 'Standby', 'Blocked'];
const STATUS_COLOR: Record<Status, string> = { Ready: '#22c55e', Standby: '#f5b400', Blocked: '#e5484d' };

interface Draft {
  name: string;
  kind: ExerciseNode['kind'];
  personnel: string;
  role: string;
  status: Status;
  start: string;
  objective: string;
  prerequisites: string;
  resourceRequirements: string;
  completionCriteria: string;
  fallback: string;
}

function toDraft(n: ExerciseNode): Draft {
  const a = n.assignment;
  return {
    name: n.name,
    kind: n.kind,
    personnel: String(n.personnel),
    role: a.role,
    status: a.status ?? 'Ready',
    start: a.start,
    objective: a.objective,
    prerequisites: a.prerequisites,
    resourceRequirements: a.resourceRequirements,
    completionCriteria: a.completionCriteria,
    fallback: a.fallback,
  };
}

function fromDraft(n: ExerciseNode, d: Draft): ExerciseNode {
  return {
    ...n,
    name: d.name,
    kind: d.kind,
    personnel: d.personnel.trim() === '' ? NaN : Number(d.personnel),
    assignment: {
      ...n.assignment,
      role: d.role,
      status: d.status,
      start: d.start,
      objective: d.objective,
      prerequisites: d.prerequisites,
      resourceRequirements: d.resourceRequirements,
      completionCriteria: d.completionCriteria,
      fallback: d.fallback,
    },
  };
}

interface Props {
  node: ExerciseNode;
  scenario: Scenario;
  onApply: (node: ExerciseNode) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onAddDependency: (fromId: string) => void;
  onRemoveDependency: (dep: Dependency) => void;
}

/** Keyed by node id in the parent, so switching nodes resets the draft. */
export function Inspector({ node, scenario, onApply, onDelete, onDuplicate, onAddDependency, onRemoveDependency }: Props) {
  const [tab, setTab] = useState<Tab>('details');
  const [draft, setDraft] = useState<Draft>(() => toDraft(node));
  const [showMore, setShowMore] = useState(false);

  const candidate = fromDraft(node, draft);
  const errors = nodeErrors(candidate);
  const hasErrors = Object.keys(errors).length > 0;
  const dirty = JSON.stringify(toDraft(node)) !== JSON.stringify(draft);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const byId = new Map(scenario.nodes.map((n) => [n.id, n]));
  const prerequisites = scenario.dependencies.filter((d) => d.toId === node.id);
  const successors = scenario.dependencies.filter((d) => d.fromId === node.id);
  const candidates = scenario.nodes.filter((n) => n.id !== node.id && !prerequisites.some((d) => d.fromId === n.id));
  const roleOptions = draft.role && !ROLE_OPTIONS.includes(draft.role) ? [draft.role, ...ROLE_OPTIONS] : ROLE_OPTIONS;
  const status = draft.status;

  return (
    <div className="inspector">
      <div className="insHead">
        <span className="insIcon" style={{ background: node.kind === 'medical' ? '#f4f6fa' : '#2f7df6' }}>
          {node.kind === 'medical' ? '+' : node.kind.charAt(0).toUpperCase()}
        </span>
        <span className="insName">{node.name}</span>
        <span className="liveDot" />
      </div>

      <div className="tabs">
        {(['details', 'personnel', 'equipment'] as Tab[]).map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'details' ? 'DETAILS' : t === 'personnel' ? 'PERSONNEL' : 'EQUIPMENT'}
          </button>
        ))}
      </div>

      {tab !== 'details' ? (
        <div className="comingSoon">
          {tab === 'personnel' ? 'Personnel roster' : 'Equipment list'} is not built yet. Details are in the Details tab.
        </div>
      ) : (
        <div className="form">
          <div className="row">
            <label>Assignment</label>
            <select className="field" value={draft.role} onChange={(e) => set('role', e.target.value)}>
              {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="row">
            <label>Personnel</label>
            <div>
              <input className={`field ${errors.personnel ? 'bad' : ''}`} type="number" min={0} max={999}
                value={draft.personnel} onChange={(e) => set('personnel', e.target.value)} />
              {errors.personnel && <div className="fieldError">{errors.personnel}</div>}
            </div>
          </div>
          <div className="row">
            <label>Status</label>
            <div className="statusField">
              <span className="statusDot" style={{ background: STATUS_COLOR[status] }} />
              <select className="field" value={status} onChange={(e) => set('status', e.target.value as Status)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="row">
            <label>Start</label>
            <div>
              <input className={`field ${errors.start ? 'bad' : ''}`} value={draft.start}
                onChange={(e) => set('start', e.target.value)} />
              {errors.start && <div className="fieldError">{errors.start}</div>}
            </div>
          </div>
          <div className="row">
            <label>Dependency</label>
            <div className="readonly">
              {prerequisites.length ? prerequisites.map((d) => byId.get(d.fromId)?.name ?? 'missing').join(', ') : 'None'}
            </div>
          </div>
          <div className="block">
            <label>Objective</label>
            <textarea className={errors.objective ? 'bad' : ''} value={draft.objective}
              onChange={(e) => set('objective', e.target.value)} />
            {errors.objective && <div className="fieldError">{errors.objective}</div>}
          </div>

          <button className="moreToggle" onClick={() => setShowMore((m) => !m)}>
            {showMore ? 'Hide' : 'More'} fields
          </button>
          {showMore && (
            <div className="more">
              <div className="block">
                <label>Name</label>
                <input className={errors.name ? 'bad' : ''} value={draft.name} onChange={(e) => set('name', e.target.value)} />
                {errors.name && <div className="fieldError">{errors.name}</div>}
              </div>
              <div className="block">
                <label>Type</label>
                <select value={draft.kind} onChange={(e) => set('kind', e.target.value as ExerciseNode['kind'])}>
                  {NODE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div className="block"><label>Prerequisites</label>
                <textarea value={draft.prerequisites} onChange={(e) => set('prerequisites', e.target.value)} /></div>
              <div className="block"><label>Resources</label>
                <textarea value={draft.resourceRequirements} onChange={(e) => set('resourceRequirements', e.target.value)} /></div>
              <div className="block"><label>Completion criteria</label>
                <textarea value={draft.completionCriteria} onChange={(e) => set('completionCriteria', e.target.value)} /></div>
              <div className="block"><label>Fallback</label>
                <textarea value={draft.fallback} onChange={(e) => set('fallback', e.target.value)} /></div>
              <div className="block">
                <label>Dependencies</label>
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
                  <select defaultValue="" onChange={(e) => { if (e.target.value) onAddDependency(e.target.value); e.target.value = ''; }}>
                    <option value="">Add: waits for...</option>
                    {candidates.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                )}
              </div>
            </div>
          )}

          <button
            className="apply"
            disabled={hasErrors || !dirty}
            onClick={() => onApply(candidate)}
            title={hasErrors ? 'Fix the highlighted fields first' : dirty ? '' : 'No changes'}
          >
            &#10003; Apply changes
          </button>
          <div className="insActions">
            <button onClick={onDuplicate}>Duplicate</button>
            <button className="danger" onClick={onDelete}>Delete</button>
          </div>
        </div>
      )}
      <span className="docHint"><DocIcon /></span>
    </div>
  );
}
