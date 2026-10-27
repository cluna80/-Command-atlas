// Versioned scenario schema. Assignments record training tasks, not executable instructions.
export const SCHEMA_VERSION = 1;

export const NODE_KINDS = [
  'team',
  'personnel',
  'transport',
  'supply',
  'medical',
  'communications',
] as const;

export type NodeKind = (typeof NODE_KINDS)[number];

export type Status = 'Ready' | 'Standby' | 'Blocked';

export interface Assignment {
  objective: string;
  role: string;
  start: string; // 24-hour HH:MM, exercise clock
  status?: Status; // defaults to Ready when absent
  durationMin?: number; // task length; the engine uses 30 when absent
  prerequisites: string;
  resourceRequirements: string;
  completionCriteria: string;
  fallback: string;
}

export interface ExerciseNode {
  id: string;
  kind: NodeKind;
  name: string;
  x: number; // map units (metres in the fictional area)
  y: number;
  personnel: number;
  assignment: Assignment;
}

// fromId must finish before toId can start.
export interface Dependency {
  id: string;
  fromId: string;
  toId: string;
}

export interface Scenario {
  schemaVersion: number;
  name: string;
  map: { width: number; height: number };
  terrain?: { seed: number; image?: string }; // image = uploaded base map as a data URL
  nodes: ExerciseNode[];
  dependencies: Dependency[];
}

export interface ValidationIssue {
  where: string;
  message: string;
}
