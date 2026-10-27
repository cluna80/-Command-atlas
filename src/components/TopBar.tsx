import { useEffect, useState } from 'react';
import type { Scenario } from '../model/types';
import { BellIcon, GearIcon, HelpIcon } from './icons';

const formatClock = (d: Date) => {
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' });
  const mon = d.toLocaleDateString('en-US', { month: 'short' });
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${wd}, ${d.getDate()} ${mon} ${d.getFullYear()} ${hh}:${mm}`;
};

interface Props {
  scenario: Scenario;
  issueCount: number;
  hasImage: boolean;
  onRename: (name: string) => void;
  onSave: () => void;
  onLoad: (file: File) => void;
  onUploadMap: (file: File) => void;
  onUseGenerated: () => void;
  onResetView: () => void;
}

export function TopBar(p: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [clock, setClock] = useState(() => formatClock(new Date()));
  useEffect(() => {
    const id = setInterval(() => setClock(formatClock(new Date())), 15000);
    return () => clearInterval(id);
  }, []);

  const pick = (fn: (f: File) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    setMenuOpen(false);
    if (f) fn(f);
  };

  return (
    <header className="topbar">
      <div className="brand">COMMAND ATLAS</div>
      <div className="sep" />
      <div className="ctx">Exercise Simulation</div>
      <div className="sep" />
      <div className="ctx">Scenario: <b>{p.scenario.name.toUpperCase()}</b></div>

      <div className="headerRight">
        <span className="training">TRAINING ONLY</span>
        <button className="iconBtn" title="Notifications"><BellIcon /></button>
        <div className="menuWrap">
          <button className="iconBtn" title="Settings" onClick={() => setMenuOpen((o) => !o)}><GearIcon /></button>
          {menuOpen && (
            <div className="menu">
              <div className="menuStatus">
                {p.issueCount ? `${p.issueCount} issue${p.issueCount > 1 ? 's' : ''} to fix` : 'Scenario valid'}
              </div>
              <label className="menuField">
                Scenario name
                <input value={p.scenario.name} onChange={(e) => p.onRename(e.target.value)} />
              </label>
              <button className="menuItem" disabled={p.issueCount > 0} onClick={() => { setMenuOpen(false); p.onSave(); }}>
                Save scenario
              </button>
              <label className="menuItem">
                Load scenario
                <input type="file" accept="application/json,.json" hidden onChange={pick(p.onLoad)} />
              </label>
              <label className="menuItem">
                Upload map image
                <input type="file" accept="image/*" hidden onChange={pick(p.onUploadMap)} />
              </label>
              {p.hasImage && (
                <button className="menuItem" onClick={() => { setMenuOpen(false); p.onUseGenerated(); }}>
                  Use generated terrain
                </button>
              )}
              <button className="menuItem" onClick={() => { setMenuOpen(false); p.onResetView(); }}>
                Re-centre map
              </button>
            </div>
          )}
        </div>
        <button className="iconBtn" title="Help"><HelpIcon /></button>
        <span className="clock">{clock}</span>
      </div>
    </header>
  );
}
