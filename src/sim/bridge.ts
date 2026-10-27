// Bridge to the Rust simulation engine running inside the Tauri desktop app.
// The UI never computes task state; it only sends scenarios and shows snapshots.
import { invoke } from '@tauri-apps/api/core';

export type TaskState = 'pending' | 'moving' | 'active' | 'complete';

export interface TaskView {
  id: string;
  state: TaskState;
  start_s: number;
  started_s: number | null;
  finished_s: number | null;
  departed_s: number | null;
  arrive_s: number | null;
  from: [number, number] | null;
  to: [number, number] | null;
}

export interface LogEntry {
  t_s: number;
  event: 'started' | 'completed';
  task_id: string;
}

export interface Snapshot {
  now_s: number;
  origin_s: number;
  finished: boolean;
  tasks: TaskView[];
  log: LogEntry[];
}

/** True when running inside the Tauri desktop app (where the engine exists). */
export const isDesktop = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const simLoad = (scenarioJson: string, horizonMin: number) =>
  invoke<Snapshot>('sim_load', { scenarioJson, horizonMin });

export const simAdvance = (seconds: number) => invoke<Snapshot>('sim_advance', { seconds });

export const simStep = () => invoke<Snapshot>('sim_step');
