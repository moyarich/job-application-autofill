import "./ContactImportReview.css";
import type { ApplicationController } from "../../utils/application/useApplication";
import { fields } from "../../utils/profile/fields";

export function ContactImportReview({ controller }: { controller: ApplicationController }) {
  const { pendingImport, profile, conflictKeys, importChoices,
    setImportChoices, confirmImport, cancelImport } = controller;
  if (!pendingImport) return null;
  return (
    <section className="panel contact-import-review" aria-label="Review imported contact details">
      <h2>Review contact differences</h2>
      <p>Choose how to handle each difference. No contact information changes until you confirm.</p>
      {conflictKeys.map(key => (
        <fieldset key={key} className="contact-import-field">
          <legend>{fields.find(field => field.key === key)?.label ?? key}</legend>
          <p>Current contact: <strong>{profile.contact[key] || "(blank)"}</strong> · Imported: <strong>{pendingImport.contact[key] || "(blank)"}</strong></p>
          <label><input type="radio" name={"contact-import-"+key}
            checked={(importChoices[key] ?? "resume") === "resume"}
            onChange={() => setImportChoices(previous => ({...previous,[key]:"resume"}))} />
            Use imported value in a separate contact record for this resume</label>
          <label><input type="radio" name={"contact-import-"+key}
            checked={importChoices[key] === "shared"}
            onChange={() => setImportChoices(previous => ({...previous,[key]:"shared"}))} />
            Update the current contact record for all resumes using it</label>
          <label><input type="radio" name={"contact-import-"+key}
            checked={importChoices[key] === "keep"}
            onChange={() => setImportChoices(previous => ({...previous,[key]:"keep"}))} />
            Keep the current contact value</label>
        </fieldset>
      ))}
      <div className="actions">
        <button type="button" className="primary" onClick={confirmImport}>Confirm import</button>
        <button type="button" className="secondary" onClick={cancelImport}>Cancel import</button>
      </div>
    </section>
  );
}
