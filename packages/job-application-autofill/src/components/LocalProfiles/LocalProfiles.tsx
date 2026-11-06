import "./LocalProfiles.css";
import type { ApplicationController } from "../../utils/application/useApplication";

export function LocalProfiles({ controller }: { controller: ApplicationController }) {
  const {
    profiles, activeProfileId, resumeVersions, activeResumeId,
    switchProfile, switchResume, createPerson, renamePerson, removePerson,
    createResume, renameResume, removeResume, applicationId, applyBusy, session,
  } = controller;
  const locked = Boolean(applicationId || applyBusy || session);
  return (
    <div className="local-profiles">
      <label htmlFor="local-person">PROFILE</label>
      <select id="local-person" aria-label="Profile" value={activeProfileId}
        disabled={locked} onChange={event => void switchProfile(event.target.value)}>
        {profiles.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
      </select>
      <div className="local-profile-actions">
        <button type="button" disabled={locked} onClick={() => void createPerson()}>New profile</button>
        <button type="button" disabled={locked} onClick={() => void renamePerson()}>Rename</button>
        <button type="button" disabled={locked || profiles.length <= 1 || activeProfileId === "00000000-0000-4000-8000-000000000001"}
          onClick={() => void removePerson()}>Delete</button>
      </div>
      <label htmlFor="local-resume">RESUME VERSION</label>
      <select id="local-resume" aria-label="Resume version" value={activeResumeId ?? ""}
        disabled={locked} onChange={event => void switchResume(event.target.value)}>
        {resumeVersions.map(resume => <option key={resume.id} value={resume.id}>{resume.name}</option>)}
      </select>
      <div className="local-profile-actions">
        <button type="button" disabled={locked} onClick={() => void createResume(false)}>New resume</button>
        <button type="button" disabled={locked} onClick={() => void createResume(true)}>Duplicate</button>
        <button type="button" disabled={locked} onClick={() => void renameResume()}>Rename</button>
        <button type="button" disabled={locked || resumeVersions.length <= 1}
          onClick={() => void removeResume()}>Delete</button>
      </div>
      <p></p>
    </div>
  );
}
