import type { ResumeImportData } from "../feature-props";
import { useState } from "react";
import { CheckCircle2, ContactRound, Info } from "lucide-react";
import "./ContactImportReview.css";


import type { ContactChoice } from "../../utils/api/client";
import { fields } from "../../utils/profile/fields";

export function ContactImportReview({ controller }: { controller: ResumeImportData }) {
  if (!controller.pendingImport) return null;
  return <ContactImportDecision key={JSON.stringify(controller.pendingImport)} controller={controller} />;
}

function ContactImportDecision({ controller }: { controller: ResumeImportData }) {
  const { pendingImport, contactId, selectedContact, confirmImport, cancelImport } = controller;
  const [strategy, setStrategy] = useState<ContactChoice>("resume");
  if (!pendingImport) return null;

  const hasLinkedContact = Boolean(contactId && selectedContact);
  const imported = fields.filter(({key}) => pendingImport.contact[key]?.trim());
  const fullName = [pendingImport.contact.firstName,pendingImport.contact.lastName].filter(Boolean).join(" ");
  const options = [
    { value: "resume" as const, title: "Use imported contact", description: "Save it as a separate contact for this resume. Other resumes will not change." },
    { value: "keep" as const, title: "Keep existing contact", description: "Import the resume content without changing its linked contact." },
    { value: "shared" as const, title: "Update linked contact", description: "Replace matching fields on the existing contact. This changes every resume using it." },
  ];

  return (
    <section className="panel contact-import-review" aria-label="Review imported contact details">
      <div className="contact-import-heading">
        <span className="contact-import-symbol"><ContactRound size={22} aria-hidden="true" /></span>
        <div>
          <h2>Imported contact details</h2>
        </div>
      </div>
      <div className="imported-contact-preview">
        <div className="contact-import-preview-heading">
          <CheckCircle2 size={17} aria-hidden="true" />
          <strong>{fullName || "Imported contact details"}</strong>
        </div>
        {imported.length ? (
          <dl>
            {imported.map(({key,label}) => (
              <div key={key}><dt>{label}</dt><dd>{pendingImport.contact[key]}</dd></div>
            ))}
          </dl>
        ) : (
          <p>No contact details found. The resume can still be imported.</p>
        )}
      </div>
      {hasLinkedContact ? (
        <fieldset className="contact-import-options">
          <legend>How should these details be used?</legend>
          {options.map(option => (
            <label key={option.value} className={strategy === option.value ? "contact-import-option selected" : "contact-import-option"}>
              <input type="radio" name="contact-import-strategy"
                value={option.value} checked={strategy === option.value}
                onChange={() => setStrategy(option.value)} />
              <span><strong>{option.title}</strong><small>{option.description}</small></span>
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="contact-import-explanation">
          <Info size={16} aria-hidden="true" />
          A contact is saved when a first name, last name, and email are available. Otherwise, the resume stays a draft.
        </p>
      )}
      <div className="actions contact-import-actions">
        <button className="primary" type="button" onClick={() => void confirmImport(hasLinkedContact ? strategy : "resume")}>
          Import resume
        </button>
        <button className="secondary" type="button" onClick={cancelImport}>Cancel import</button>
      </div>
    </section>
  );
}
