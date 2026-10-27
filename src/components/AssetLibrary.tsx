import { useState } from 'react';
import type { NodeKind } from '../model/types';
import { ChevronIcon, SearchIcon } from './icons';

interface Entry {
  label: string;
  kind?: NodeKind; // entries without a kind are informational only
}
interface Group {
  title: string;
  color: string;
  open: boolean;
  items: Entry[];
}

const GROUPS: Group[] = [
  {
    title: 'Personnel', color: '#60a5fa', open: true,
    items: [{ label: 'Individual (Generic)', kind: 'personnel' }, { label: 'Team (Generic)', kind: 'team' }],
  },
  {
    title: 'Teams', color: '#2f7df6', open: true,
    items: [
      { label: 'Infantry Team', kind: 'team' },
      { label: 'Support Team', kind: 'team' },
      { label: 'Observer Team', kind: 'team' },
    ],
  },
  {
    title: 'Transport', color: '#94a3b8', open: true,
    items: [
      { label: 'Truck (Logistics)', kind: 'transport' },
      { label: 'Utility Vehicle', kind: 'transport' },
      { label: 'Helicopter (Transport)', kind: 'transport' },
    ],
  },
  { title: 'Supply', color: '#1f3c66', open: false, items: [{ label: 'Supply point', kind: 'supply' }] },
  { title: 'Medical', color: '#f4f6fa', open: false, items: [{ label: 'Medical facility', kind: 'medical' }] },
  { title: 'Communications', color: '#a78bfa', open: false, items: [{ label: 'Radio relay', kind: 'communications' }] },
  {
    title: 'Events', color: '#f5b400', open: false,
    items: [{ label: 'Communications outage' }, { label: 'Instructor review' }],
  },
];

export function AssetLibrary({ onAdd }: { onAdd: (kind: NodeKind) => void }) {
  const [groups, setGroups] = useState(GROUPS);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  return (
    <aside className="library">
      <div className="libTitle">Asset Library</div>
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
              <span className="glyph" style={{ background: g.color }} />
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
