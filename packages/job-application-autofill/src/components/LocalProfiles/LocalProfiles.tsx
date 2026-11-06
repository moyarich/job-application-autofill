import { Pencil, Plus, Trash2 } from "lucide-react";
import "./LocalProfiles.css";
import type { ApplicationController } from "../../utils/application/useApplication";

export function LocalProfiles({ controller }: { controller: ApplicationController }) {
  const { profiles,activeProfileId,switchProfile,createPerson,renamePerson,removePerson,
    applicationId,applyBusy,session } = controller;
  const locked = Boolean(applicationId || applyBusy || session);
  return (
    <div className="local-profiles">
      <label htmlFor="local-person">Current profile</label>
      <select id="local-person" aria-label="Profile" value={activeProfileId}
        disabled={locked} onChange={event => void switchProfile(event.target.value)}>
        {profiles.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
      </select>
      <div className="local-profile-actions" aria-label="Manage profiles">
        <button type="button" disabled={locked} onClick={() => void createPerson()}><Plus size={13} /> New profile</button>
        <button type="button" disabled={locked} onClick={() => void renamePerson()}><Pencil size={12} /> Rename</button>
        <button className="action-danger" type="button"
          disabled={locked || profiles.length <= 1 || activeProfileId === "00000000-0000-4000-8000-000000000001"}
          onClick={() => void removePerson()}><Trash2 size={12} /> Delete</button>
      </div>
    </div>
  );
}
