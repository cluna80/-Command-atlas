import { useEffect, useState } from 'react';
import { ClipboardIcon, ClockIcon, DocIcon } from './icons';

const DURATION = 3600; // the ruler spans 00:00 to 01:00
const EVENTS = [
  { t: 720, label: 'Communications outage', tone: 'warn' as const },
  { t: 1800, label: 'Instructor review', tone: 'info' as const },
];
const TICKS = ['00:00', '00:10', '00:20', '00:30', '00:40', '00:50', '01:00'];

const fmt = (s: number) =>
  [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((v) => String(v).padStart(2, '0')).join(':');

export function BottomBar() {
  const [simSec, setSimSec] = useState(18 * 60 + 30);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSimSec((s) => Math.min(DURATION, s + speed)), 1000);
    return () => clearInterval(id);
  }, [running, speed]);

  useEffect(() => {
    if (simSec >= DURATION) setRunning(false);
  }, [simSec]);

  const pct = (simSec / DURATION) * 100;

  return (
    <footer className="footer">
      <div className="stats">
        <div className="stat"><span className="statIcon"><ClipboardIcon /></span>
          <span className="k">Tasks complete</span><span className="v">4 / 8</span></div>
        <div className="stat"><span className="ring" /><span className="k">Supply availability</span><span className="v">82%</span></div>
        <div className="stat"><span className="statIcon amber"><ClockIcon /></span>
          <span className="k">Exercise time</span><span className="v">{fmt(simSec)}</span></div>
        <span className="note">Illustrative values.</span>
        <div className="adj">
          <button className="btn"><span className="gavel">&#9878;</span>Instructor adjudication</button>
          <button className="btn sq" title="Exercise notes"><DocIcon /></button>
        </div>
      </div>

      <div className="controls">
        <button className={`run ${running ? 'live' : ''}`} onClick={() => setRunning(true)} disabled={running}>
          &#9654; Run exercise
        </button>
        <button className="ctl" onClick={() => setRunning(false)}>&#10074;&#10074; Pause</button>
        <button className="ctl" onClick={() => { setRunning(false); setSimSec((s) => Math.min(DURATION, s + 10)); }}>
          &#9197; Step
        </button>
        <div className="speed">
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
          <span className="caret">&#9660;</span>
        </div>

        <div className="timeline">
          <div className="ticks">{TICKS.map((t) => <span key={t}>{t}</span>)}</div>
          <div className="track"><div className="fill" style={{ width: `${pct}%` }} /></div>
          {EVENTS.map((e) => (
            <div className={`event ${e.tone}`} key={e.label} style={{ left: `${(e.t / DURATION) * 100}%` }}>
              <div className="stem" />
              <div className="card"><span className="ic" />{fmt(e.t)} &middot; {e.label}</div>
            </div>
          ))}
          <div className="playhead" style={{ left: `${pct}%` }}>
            <div className="tag">{fmt(simSec)}</div>
            <div className="line" />
          </div>
        </div>
      </div>
    </footer>
  );
}
