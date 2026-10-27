import { newId } from '../model/scenario';
import type { Availability, ExerciseNode, Person, UnitProfile as Profile } from '../model/types';

const AVAILABILITY: Availability[] = ['available', 'limited', 'unavailable'];
const AVAILABILITY_COLOR: Record<Availability, string> = {
  available: '#22c55e',
  limited: '#f5b400',
  unavailable: '#e5484d',
};

interface Props {
  node: ExerciseNode;
  onPatch: (patch: Partial<ExerciseNode>) => void;
}

/** Unit profile and roster: who is in the unit, their role, qualifications and availability. */
export function UnitProfile({ node, onPatch }: Props) {
  const profile: Profile = node.profile ?? { callsign: '', commander: '', radioChannel: '', notes: '' };
  const roster = node.roster ?? [];
  const setProfile = (patch: Partial<Profile>) => onPatch({ profile: { ...profile, ...patch } });
  const setPerson = (id: string, patch: Partial<Person>) =>
    onPatch({ roster: roster.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const removePerson = (id: string) => onPatch({ roster: roster.filter((p) => p.id !== id) });
  const addPerson = () =>
    onPatch({
      roster: [...roster, { id: newId('person'), name: 'New person', role: '', qualifications: [], availability: 'available' }],
    });

  return (
    <div className="profile">
      <section>
        <h3>Unit profile</h3>
        <div className="block">
          <label>Callsign</label>
          <input value={profile.callsign} onChange={(e) => setProfile({ callsign: e.target.value })} />
        </div>
        <div className="block">
          <label>Commander</label>
          <input value={profile.commander} onChange={(e) => setProfile({ commander: e.target.value })} />
        </div>
        <div className="block">
          <label>Radio channel</label>
          <input value={profile.radioChannel} onChange={(e) => setProfile({ radioChannel: e.target.value })} />
        </div>
        <div className="block">
          <label>Notes</label>
          <textarea value={profile.notes} onChange={(e) => setProfile({ notes: e.target.value })} />
        </div>
      </section>

      <section>
        <h3>Roster ({roster.length})</h3>
        {roster.length === 0 && <div className="readonly">No one assigned yet.</div>}
        {roster.map((p) => (
          <div className="person" key={p.id}>
            <div className="personHead">
              <span className="statusDot" style={{ background: AVAILABILITY_COLOR[p.availability] }} />
              <input
                className="personName"
                value={p.name}
                onChange={(e) => setPerson(p.id, { name: e.target.value })}
                aria-label="Name"
              />
              <button className="linkBtn" title="Remove person" onClick={() => removePerson(p.id)}>&times;</button>
            </div>
            <div className="personGrid">
              <input placeholder="Role" value={p.role} onChange={(e) => setPerson(p.id, { role: e.target.value })} />
              <select value={p.availability} onChange={(e) => setPerson(p.id, { availability: e.target.value as Availability })}>
                {AVAILABILITY.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <input
              placeholder="Qualifications, comma separated"
              defaultValue={p.qualifications.join(', ')}
              key={p.id + p.qualifications.join('|')}
              onBlur={(e) =>
                setPerson(p.id, {
                  qualifications: e.target.value.split(',').map((x) => x.trim()).filter(Boolean),
                })
              }
            />
          </div>
        ))}
        <button className="addBtn" onClick={addPerson}>+ Add person</button>
      </section>
    </div>
  );
}
