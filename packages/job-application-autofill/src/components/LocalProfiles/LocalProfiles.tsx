import { Copy, FilePlus2, Pencil, Plus, Trash2 } from "lucide-react";
import "./LocalProfiles.css";
import type { ApplicationController } from "../../utils/application/useApplication";

export function LocalProfiles({ controller }: { controller: ApplicationController }) {
  const {
    profiles, activeProfileId, resumeVersions, activeResumeId,
    switchProfile, switchResume, createPerson, renamePerson, removePerson,
    createResume, renameResume, removeResume, applicationId, applyBusy, session,
  } = controller;
  const locked = Boolean(applicationId || applyBusy || session);
  const currentResume = resumeVersions.find(item => item.id === activeResumeId);
  return (
    <div className="local-profiles">
      <label htmlFor="local-person">Current profile</label>
      <select id="local-person" aria-label="Profile" value={activeProfileId}
        disabled={locked} onChange={event => void switchProfile(event.target.value)}>
        {profiles.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
      </select>
      <div className="local-profile-actions" aria-label="Manage profiles">
        <button type="button" disabled={locked} onClick={() => void createPerson()}><Plus size={13} /> New</button>
        <button type="button" disabled={locked} onClick={() => void renamePerson()}><Pencil size={12} /> Rename</button>
        <button className="action-danger" type="button"
          disabled={locked || profiles.length <= 1 || activeProfileId === "00000000-0000-4000-8000-000000000001"}
          onClick={() => void removePerson()}><Trash2 size={12} /> Delete</button>
      </div>
      <label htmlFor="local-resume">Active resume</label>
      <select id="local-resume" aria-label="Resume version" value={activeResumeId ?? ""}
        disabled={locked} onChange={event => void switchResume(event.target.value)}>
        {resumeVersions.map(resume => <option key={resume.id} value={resume.id}>{resume.name}</option>)}
      </select>
      <div className="local-profile-actions" aria-label="Manage resumes">
        <button type="button" disabled={locked} onClick={() => void createResume(false)}><FilePlus2 size={13} /> New</button>
        <button type="button" disabled={locked} onClick={() => void createResume(true)}><Copy size={12} /> Copy</button>
        <button type="button" disabled={locked} onClick={() => void renameResume()}><Pencil size={12} /> Rename</button>
        <button className="action-danger" type="button" disabled={locked || resumeVersions.length <= 1}
          onClick={() => void removeResume()}><Trash2 size={12} /> Delete</button>
      </div>
      {currentResume && <p className="resume-context">
        {currentResume.contactId ? "Linked contact record" : "Draft · no contact linked yet"}
      </p>}
    </div>
  );
}
