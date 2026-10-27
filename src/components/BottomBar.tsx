import type { Snapshot } from '../sim/bridge';
import { ClipboardIcon, ClockIcon, DocIcon } from './icons';

interface Props {
  snap: Snapshot | null;
  running: boolean;
  speed: number;
  onSpeed: (n: number) => void;
  onRun: () => void;
  onPause: () => void;
  onStep: () => void;
  error: string | null;
  stale: boolean;
  desktop: boolean;
}

const fmt = (s: number) =>
  [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((v) => String(v).padStart(2, '0')).join(':');
const hm = (s: number) => fmt(s).slice(0, 5);

export function BottomBar(p: Props) {
  const origin = p.snap?.origin_s ?? 0;
  const now = p.snap?.now_s ?? 0;
  const elapsed = Math.max(0, now - origin);
  const tasks = p.snap?.tasks ?? [];
  const complete = tasks.filter((t) => t.state === 'complete').length;
  const active = tasks.filter((t) => t.state === 'active').length;

  // Ruler covers the plan: at least one hour, extended in half-hour steps past the last finish.
  const lastEnd = Math.max(origin, ...tasks.map((t) => t.finished_s ?? t.start_s));
  const ruler = Math.max(3600, Math.ceil((lastEnd - origin + 1800) / 1800) * 1800);
  const pct = Math.min(100, (elapsed / ruler) * 100);
  const ticks = Array.from({ length: 7 }, (_, i) => hm(origin + (ruler / 6) * i));

  const message = !p.desktop
    ? 'Browser preview: the simulation runs in the desktop app (npm run tauri dev).'
    : p.error
      ? p.error
      : p.stale
        ? 'Scenario changed since this run started. Press Run to restart it.'
        : null;

  return (
    <footer className="footer">
      <div className="stats">
        <div className="stat">
          <span className="statIcon"><ClipboardIcon /></span>
          <span className="k">Tasks complete</span><span className="v">{complete} / {tasks.length}</span>
        </div>
        <div className="stat"><span className="ring" /><span className="k">Active tasks</span><span className="v">{active}</span></div>
        <div className="stat">
          <span className="statIcon amber"><ClockIcon /></span>
          <span className="k">Exercise time</span><span className="v">{fmt(now)}</span>
        </div>
        {message && <span className={`note ${p.error ? 'bad' : ''}`}>{message}</span>}
        <div className="adj">
          <button className="btn"><span className="gavel">&#9878;</span>Instructor adjudication</button>
          <button className="btn sq" title="Exercise notes"><DocIcon /></button>
        </div>
      </div>

      <div className="controls">
        <button className={`run ${p.running ? 'live' : ''}`} onClick={p.onRun} disabled={p.running}>
          {p.running ? '■ Running' : '▶ Run exercise'}
        </button>
        <button className="ctl" onClick={p.onPause} disabled={!p.running}>&#10074;&#10074; Pause</button>
        <button className="ctl" onClick={p.onStep} disabled={p.running}>&#9197; Step</button>
        <div className="speed">
          <select value={p.speed} onChange={(e) => p.onSpeed(Number(e.target.value))}>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
            <option value={8}>8x</option>
          </select>
          <span className="caret">&#9660;</span>
        </div>

        <div className="timeline">
          <div className="ticks">{ticks.map((t) => <span key={t}>{t}</span>)}</div>
          <div className="track">
            <div className="fill" style={{ width: `${pct}%` }} />
            {(p.snap?.log ?? []).map((e, i) => (
              <span
                key={i}
                className={`logMark ${e.event}`}
                style={{ left: `${Math.min(100, ((e.t_s - origin) / ruler) * 100)}%` }}
                title={`${fmt(e.t_s)} ${e.event} ${e.task_id}`}
              />
            ))}
          </div>
          <div className="playhead" style={{ left: `${pct}%`, transform: pct < 6 ? 'none' : undefined }}>
            <div className="tag">{fmt(now)}</div>
            <div className="line" />
          </div>
        </div>
      </div>
    </footer>
  );
}
