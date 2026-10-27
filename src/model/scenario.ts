import {
  NODE_KINDS,
  SCHEMA_VERSION,
  type Assignment,
  type ExerciseNode,
  type NodeKind,
  type Scenario,
  type ValidationIssue,
} from './types';

export const NODE_SIZE = 56;
const MAX_NAME = 60;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyAssignment(): Assignment {
  return {
    objective: '',
    role: '',
    start: '09:00',
    prerequisites: '',
    resourceRequirements: '',
    completionCriteria: '',
    fallback: '',
  };
}

export function createNode(kind: NodeKind, x: number, y: number, existing: ExerciseNode[]): ExerciseNode {
  const count = existing.filter((n) => n.kind === kind).length + 1;
  return {
    id: newId(kind),
    kind,
    name: `${kind.charAt(0).toUpperCase()}${kind.slice(1)} ${count}`,
    x,
    y,
    personnel: kind === 'personnel' ? 1 : 0,
    assignment: { ...emptyAssignment(), objective: 'Describe the training objective.' },
  };
}

export function createSampleScenario(): Scenario {
  const assign = (objective: string, role: string, start: string): Assignment => ({
    ...emptyAssignment(),
    objective,
    role,
    start,
    completionCriteria: 'Objective reported complete by instructor.',
    fallback: 'Hold position and request instructor direction.',
  });
  return {
    schemaVersion: SCHEMA_VERSION,
    name: 'Fictional evacuation and sustainment',
    map: { width: 1400, height: 1000 },
    terrain: { seed: 42 },
    nodes: [
      {
        id: 'alpha', kind: 'team', name: 'Team Alpha', x: 520, y: 520, personnel: 3,
        assignment: assign('Assist evacuation.', 'Evacuation support', '09:00'),
        profile: { callsign: 'ALPHA', commander: 'Team lead (training role)', radioChannel: 'CH-2', notes: 'Evacuation support tasking.' },
        roster: [
          { id: 'alpha-1', name: 'A1 · Team lead', role: 'Team lead', qualifications: ['Radio operator', 'First aid'], availability: 'available' },
          { id: 'alpha-2', name: 'A2 · Driver', role: 'Driver', qualifications: ['Light vehicle'], availability: 'available' },
          { id: 'alpha-3', name: 'A3 · Medic', role: 'Medic', qualifications: ['First aid', 'Casualty handling'], availability: 'limited' },
        ],
      },
      {
        id: 'bravo', kind: 'team', name: 'Team Bravo', x: 1280, y: 860, personnel: 2,
        assignment: assign('Resupply Medical.', 'Supply run', '09:30'),
        profile: { callsign: 'BRAVO', commander: 'Team lead (training role)', radioChannel: 'CH-3', notes: 'Supply run tasking.' },
        roster: [
          { id: 'bravo-1', name: 'B1 · Team lead', role: 'Team lead', qualifications: ['Radio operator'], availability: 'available' },
          { id: 'bravo-2', name: 'B2 · Loader', role: 'Loader', qualifications: ['Materials handling'], availability: 'available' },
        ],
      },
      {
        id: 'medical', kind: 'medical', name: 'Medical', x: 1300, y: 380, personnel: 4,
        assignment: assign('Maintain casualty intake.', 'Medical facility', '08:30'),
      },
      {
        id: 'supply', kind: 'supply', name: 'Supply', x: 560, y: 900, personnel: 3,
        assignment: assign('Stage supplies for transport.', 'Supply facility', '08:00'),
      },
    ],
    dependencies: [{ id: 'dep-supply-alpha', fromId: 'supply', toId: 'alpha' }],
  };
}

/** Default travel speed in km/h by unit type. Zero means the unit cannot move on its own. */
export function defaultSpeedKmh(kind: string): number {
  if (kind === 'team' || kind === 'personnel') return 4;
  if (kind === 'transport') return 40;
  return 0;
}

/** Field-level errors for one node, keyed by field name. */
export function nodeErrors(node: ExerciseNode): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = typeof node.name === 'string' ? node.name.trim() : '';
  if (!name) errors.name = 'Name is required.';
  else if (name.length > MAX_NAME) errors.name = `Name must be ${MAX_NAME} characters or fewer.`;
  if (!(NODE_KINDS as readonly string[]).includes(node.kind)) errors.kind = 'Unknown node type.';
  if (!Number.isInteger(node.personnel) || node.personnel < 0 || node.personnel > 999) {
    errors.personnel = 'Personnel must be a whole number from 0 to 999.';
  }
  if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) errors.position = 'Position must be numeric.';
  const a = node.assignment;
  if (!a || typeof a !== 'object') {
    errors.objective = 'Assignment is missing.';
    return errors;
  }
  if (!a.objective?.trim()) errors.objective = 'Objective is required.';
  if (!TIME_RE.test(a.start ?? '')) errors.start = 'Start must be a 24-hour time such as 09:00.';
  if (a.durationMin !== undefined && (!Number.isInteger(a.durationMin) || a.durationMin < 1 || a.durationMin > 1440)) {
    errors.duration = 'Duration must be a whole number of minutes from 1 to 1440.';
  }
  if (node.roster && node.roster.some((p) => !p.name?.trim())) {
    errors.roster = 'Every person in the roster needs a name.';
  }
  if (node.speedKmh !== undefined && !(node.speedKmh > 0)) {
    errors.speed = 'Speed must be greater than 0 km/h.';
  }
  if (a && a.destinationId && !((node.speedKmh ?? defaultSpeedKmh(node.kind)) > 0)) {
    errors.destination = 'This unit has no speed, so it cannot move. Set a speed or choose Stay in place.';
  }
  if (a.status !== undefined && !['Ready', 'Standby', 'Blocked'].includes(a.status)) {
    errors.status = 'Status must be Ready, Standby, or Blocked.';
  }
  return errors;
}

function hasCycle(nodeIds: string[], edges: { fromId: string; toId: string }[]): boolean {
  const adj = new Map<string, string[]>(nodeIds.map((id) => [id, []]));
  for (const e of edges) adj.get(e.fromId)?.push(e.toId);
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (id: string): boolean => {
    const s = state.get(id);
    if (s === 'visiting') return true;
    if (s === 'done') return false;
    state.set(id, 'visiting');
    for (const next of adj.get(id) ?? []) if (visit(next)) return true;
    state.set(id, 'done');
    return false;
  };
  return nodeIds.some((id) => visit(id));
}

export function validateScenario(s: Scenario): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (s.schemaVersion !== SCHEMA_VERSION) {
    issues.push({ where: 'file', message: `Unsupported schema version ${s.schemaVersion}; expected ${SCHEMA_VERSION}.` });
  }
  if (!s.name?.trim()) issues.push({ where: 'scenario', message: 'Scenario name is required.' });
  if (!(s.map?.width > 0) || !(s.map?.height > 0)) {
    issues.push({ where: 'scenario', message: 'Map width and height must be positive.' });
  }

  if (s.terrain !== undefined && !Number.isInteger(s.terrain?.seed)) {
    issues.push({ where: 'scenario', message: 'terrain.seed must be an integer.' });
  }

  if (s.terrain?.image !== undefined && !/^data:image\//.test(s.terrain.image)) {
    issues.push({ where: 'scenario', message: 'terrain.image must be an image data URL.' });
  }

  const ids = new Set<string>();
  for (const n of s.nodes) {
    if (ids.has(n.id)) issues.push({ where: n.name, message: 'Duplicate node id.' });
    ids.add(n.id);
    for (const [field, message] of Object.entries(nodeErrors(n))) {
      issues.push({ where: n.name, message: `${field}: ${message}` });
    }
  }

  for (const n of s.nodes) {
    const dest = n.assignment?.destinationId;
    if (dest === undefined) continue;
    if (!ids.has(dest)) issues.push({ where: n.name, message: `destination: '${dest}' is not a node.` });
    else if (dest === n.id) issues.push({ where: n.name, message: 'destination: a unit cannot move to itself.' });
  }

  const seen = new Set<string>();
  const edges: { fromId: string; toId: string }[] = [];
  for (const d of s.dependencies) {
    const where = `dependency ${d.id}`;
    if (!ids.has(d.fromId) || !ids.has(d.toId)) issues.push({ where, message: 'References a missing node.' });
    if (d.fromId === d.toId) issues.push({ where, message: 'A node cannot depend on itself.' });
    const key = `${d.fromId}>${d.toId}`;
    if (seen.has(key)) issues.push({ where, message: 'Duplicate dependency.' });
    seen.add(key);
    edges.push({ fromId: d.fromId, toId: d.toId });
  }
  if (hasCycle([...ids], edges)) {
    issues.push({ where: 'dependencies', message: 'Dependencies form a cycle; a task cannot wait on itself.' });
  }
  return issues;
}

export function parseScenario(text: string): { scenario: Scenario | null; issues: ValidationIssue[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { scenario: null, issues: [{ where: 'file', message: 'File is not valid JSON.' }] };
  }
  const s = raw as Partial<Scenario> | null;
  if (!s || typeof s !== 'object' || !Array.isArray(s.nodes) || !Array.isArray(s.dependencies)) {
    return {
      scenario: null,
      issues: [{ where: 'file', message: 'File is not a scenario: nodes and dependencies are required.' }],
    };
  }
  const issues = validateScenario(s as Scenario);
  return issues.length ? { scenario: null, issues } : { scenario: s as Scenario, issues: [] };
}

export function serializeScenario(s: Scenario): string {
  return JSON.stringify({ ...s, schemaVersion: SCHEMA_VERSION }, null, 2);
}
