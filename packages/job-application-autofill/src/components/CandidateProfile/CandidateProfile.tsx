import "./CandidateProfile.css";
import { Download, FileText, FileUp, Plus, Trash2 } from "lucide-react";
import { fields } from "../../utils/profile/fields";
import { downloadJson } from "../../utils/files/resume-files";
import type { ApplicationController } from "../../utils/application/useApplication";
export function CandidateProfile({
  controller,
}: {
  controller: ApplicationController;
}) {
  const {
    importRef,
    importProfile,
    profile,
    exportResumePdf,
    setProfile,
    contacts, contactId, defaultContactId, chooseContact, markDefaultContact, saveContactRecord, editContact,
    errors,
  } = controller;
  return (
    <>
      <section className="panel">
        <div className="panel-title horizontal">
          <div>
            <h2>Contact details</h2>
            <p>Choose a saved contact or add details to a draft. A saved contact can be reused across resumes.</p>
          </div>
          <div className="actions">
            <input
              ref={importRef}
              hidden
              type="file"
              accept=".json,application/json"
              onChange={importProfile}
            />
            <button
              className="secondary"
              onClick={() => importRef.current?.click()}
            >
              <FileUp size={15} /> Import JSON
            </button>
            <button
              className="primary"
              onClick={() => downloadJson("candidate-profile.json", profile)}
            >
              <Download size={15} /> Export JSON
            </button>
            <button className="secondary" onClick={exportResumePdf}>
              <FileText size={15} /> Export PDF
            </button>
          </div>
        </div>
        <div className="contact-record-selector">
          <label htmlFor="resume-contact-record">Selected contact</label>
          <select id="resume-contact-record" value={contactId ?? ""}
            onChange={event => chooseContact(event.target.value)}>
            <option value="">Draft — no saved contact</option>
            {contacts.map(item => <option key={item.id} value={item.id}>
              {item.name}{item.isDefault ? " (default)" : ""}
            </option>)}
          </select>
          {!contactId && <button type="button" className="primary"
            onClick={() => void saveContactRecord()}>Save contact</button>}
          {contactId && contactId !== defaultContactId && <button type="button" className="secondary"
            onClick={() => void markDefaultContact()}>Set as default</button>}
          <p className="contact-hint">
            {contactId
              ? "Edits to this contact are reflected in other resumes linked to the same record."
              : "Draft contact details are kept with this resume. Save a complete contact to enable applications."}
          </p>
        </div>
        <div className="profile-grid">
          {fields.map(({ key, label }) => (
            <label key={key}>
              {label}
              <input
                type={key === "email" ? "email" : "text"}
                value={profile.contact[key]}
                onChange={(e) => editContact(key, e.target.value)}
                placeholder={label}
              />
            </label>
          ))}
        </div>
        <label className="wide-label">
          Resume-specific professional summary
          <textarea
            rows={4}
            value={profile.summary}
            onChange={(e) =>
              setProfile((x) => ({ ...x, summary: e.target.value }))
            }
            placeholder="Brief summary of your experience..."
          />
        </label>
        <label className="wide-label">
          Skills (comma-separated)
          <textarea
            rows={2}
            value={profile.skills.join(", ")}
            onChange={(e) =>
              setProfile((x) => ({
                ...x,
                skills: e.target.value
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean),
              }))
            }
            placeholder="React, AWS, TypeScript"
          />
        </label>
        <section className="employment-editor">
          <div className="panel-title horizontal">
            <div><h2>Work experience for this resume</h2><p>Titles, dates, and descriptions can differ between resume versions.</p></div>
            <button
              className="secondary"
              onClick={() =>
                setProfile((x) => ({
                  ...x,
                  experience: [
                    ...x.experience,
                    {
                      company: "",
                      jobTitle: "",
                      location: "",
                      startDate: "",
                      endDate: null,
                      isCurrent: false,
                      description: "",
                    },
                  ],
                }))
              }
            >
              <Plus size={15} /> Add position
            </button>
          </div>
          {profile.experience.map((job, index) => (
            <div className="employment-entry" key={index}>
              <div className="profile-grid">
                {(
                  ["company", "jobTitle", "location", "startDate"] as const
                ).map((key) => (
                  <label key={key}>
                    {
                      {
                        company: "Employer",
                        jobTitle: "Job title",
                        location: "Location",
                        startDate: "Start date (YYYY-MM)",
                      }[key]
                    }
                    <input
                      value={job[key]}
                      onChange={(e) =>
                        setProfile((x) => ({
                          ...x,
                          experience: x.experience.map((item, i) =>
                            i === index
                              ? { ...item, [key]: e.target.value }
                              : item,
                          ),
                        }))
                      }
                    />
                  </label>
                ))}
                <label>
                  End date (YYYY-MM)
                  <input
                    disabled={job.isCurrent}
                    value={job.endDate ?? ""}
                    onChange={(e) =>
                      setProfile((x) => ({
                        ...x,
                        experience: x.experience.map((item, i) =>
                          i === index
                            ? { ...item, endDate: e.target.value }
                            : item,
                        ),
                      }))
                    }
                  />
                </label>
                <label className="review-checkbox">
                  <input
                    type="checkbox"
                    checked={job.isCurrent}
                    onChange={(e) =>
                      setProfile((x) => ({
                        ...x,
                        experience: x.experience.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                isCurrent: e.target.checked,
                                endDate: e.target.checked ? null : "",
                              }
                            : item,
                        ),
                      }))
                    }
                  />
                  Current role
                </label>
              </div>
              <label className="wide-label">
                Highlights and responsibilities
                <textarea
                  rows={3}
                  value={job.description}
                  onChange={(e) =>
                    setProfile((x) => ({
                      ...x,
                      experience: x.experience.map((item, i) =>
                        i === index
                          ? { ...item, description: e.target.value }
                          : item,
                      ),
                    }))
                  }
                />
              </label>
              <button
                className="remove"
                aria-label="Remove employment entry"
                onClick={() =>
                  setProfile((x) => ({
                    ...x,
                    experience: x.experience.filter((_, i) => i !== index),
                  }))
                }
              >
                <Trash2 size={14} aria-hidden="true" /> Remove position
              </button>
            </div>
          ))}
        </section>
        <div className={errors.length ? "validation warning" : "validation"}>
          {errors.length
            ? "Please complete: " + errors.join(", ")
            : contactId ? "Resume contact is ready for applications." : "Save a contact record before applying."}
        </div>
      </section>
    </>
  );
}
