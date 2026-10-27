import { useState, type ReactElement } from 'react';
import type { ExerciseNode, NodeKind } from '../model/types';
import {
  ChevronIcon,
  CommsIcon,
  EventIcon,
  MedicalIcon,
  PersonnelIcon,
  SearchIcon,
  SupplyIcon,
  TeamIcon,
  TransportIcon,
} from './icons';

interface Entry {
  label: string;
  kind?: NodeKind; // entries without a kind are informational only
}
interface Group {
  title: string;
  color: string;
  icon: () => ReactElement;
  open: boolean;
  items: Entry[];
}

const GROUPS: Group[] = [
  {
    title: 'Personnel', color: '#60a5fa', icon: PersonnelIcon, open: true,
    items: [{ label: 'Individual (Generic)', kind: 'personnel' }, { label: 'Team (Generic)', kind: 'team' }],
  },
  {
    title: 'Teams', color: '#2f7df6', icon: TeamIcon, open: true,
    items: [
      { label: 'Infantry Team', kind: 'team' },
      { label: 'Support Team', kind: 'team' },
      { label: 'Observer Team', kind: 'team' },
    ],
  },
  {
    title: 'Transport', color: '#94a3b8', icon: TransportIcon, open: true,
    items: [
      { label: 'Truck (Logistics)', kind: 'transport' },
      { label: 'Utility Vehicle', kind: 'transport' },
      { label: 'Helicopter (Transport)', kind: 'transport' },
    ],
  },
  { title: 'Supply', color: '#7aa2d6', icon: SupplyIcon, open: false, items: [{ label: 'Supply point', kind: 'supply' }] },
  { title: 'Medical', color: '#f4f6fa', icon: MedicalIcon, open: false, items: [{ label: 'Medical facility', kind: 'medical' }] },
  { title: 'Communications', color: '#a78bfa', icon: CommsIcon, open: false, items: [{ label: 'Radio relay', kind: 'communications' }] },
  {
    title: 'Events', color: '#f5b400', icon: EventIcon, open: false,
    items: [{ label: 'Communications outage' }, { label: 'Instructor review' }],
  },
];

export function AssetLibrary({
  onAdd,
  selected,
  selectionCount = 0,
  onDeleteSelection,
  onOpen3D,
}: {
  onAdd: (kind: NodeKind) => void;
  selected: ExerciseNode | null;
  selectionCount?: number;
  onDeleteSelection?: () => void;
  onOpen3D: () => void;
}) {
  const [groups, setGroups] = useState(GROUPS);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  return (
    <aside className="library">
      <div className="libTitle">Selected unit</div>
      {selectionCount > 1 ? (
        <div className="selCard">
          <div className="selName">{selectionCount} units selected</div>
          <div className="selHint">Drag any selected unit to move them together. Shift-click to add or remove units.</div>
          <button className="selBtn danger" onClick={onDeleteSelection}>Delete selected</button>
        </div>
      ) : selected ? (
        <div className="selCard">
          <div className="selName">{selected.name}</div>
          <button className="selBtn" onClick={onOpen3D}>3D view</button>
        </div>
      ) : (
        <div className="selEmpty">Click a unit on the map to open its 3D view.</div>
      )}
      <div className="libTitle" style={{ marginTop: 14 }}>Asset Library</div>
      <label className="search">
        <SearchIcon />
        <input
          placeholder="Search assets"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value) setGroups((gs) => gs.map((g) => ({ ...g, open: true })));
          }}
        />
      </label>
      {groups.map((g, gi) => {
        const items = g.items.filter((it) => !q || it.label.toLowerCase().includes(q) || g.title.toLowerCase().includes(q));
        if (q && items.length === 0) return null;
        return (
          <div className="group" key={g.title}>
            <button
              className="groupHead"
              onClick={() => setGroups((gs) => gs.map((x, i) => (i === gi ? { ...x, open: !x.open } : x)))}
            >
              <span className="secIcon" style={{ color: g.color }}>{g.icon()}</span>
              {g.title}
              <span className="chev"><ChevronIcon open={g.open || !!q} /></span>
            </button>
            {(g.open || !!q) && (
              <div className="items">
                {items.map((it) => (
                  <button
                    key={it.label}
                    className={`libItem ${it.kind ? '' : 'info'}`}
                    disabled={!it.kind}
                    onClick={() => it.kind && onAdd(it.kind)}
                    title={it.kind ? 'Click to add to the map' : 'Event, placed by the instructor'}
                  >
                    <span className="mini" style={{ background: g.color }} />
                    {it.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}
