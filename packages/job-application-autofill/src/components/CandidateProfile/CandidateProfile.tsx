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
    errors,
  } = controller;
  return (
    <>
      <section className="panel">
        <div className="panel-title horizontal">
          <div>
            <h2>Personal information</h2>
            <p>Stored in local SQLite. Import or export as JSON.</p>
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
              Import JSON
            </button>
            <button
              className="primary"
              onClick={() => downloadJson("candidate-profile.json", profile)}
            >
              Export JSON
            </button>
            <button className="primary" onClick={exportResumePdf}>
              Export PDF
            </button>
          </div>
        </div>
        <div className="profile-grid">
          {fields.map(({ key, label }) => (
            <label key={key}>
              {label}
              <input
                type={key === "email" ? "email" : "text"}
                value={profile.contact[key]}
                onChange={(e) =>
                  setProfile((x) => ({
                    ...x,
                    contact: { ...x.contact, [key]: e.target.value },
                  }))
                }
                placeholder={label}
              />
            </label>
          ))}
        </div>
        <label className="wide-label">
          Professional summary
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
            <h2>Work experience</h2>
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
              + Add job
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
                Responsibilities
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
                Remove job
              </button>
            </div>
          ))}
        </section>
        <div className={errors.length ? "validation warning" : "validation"}>
          {errors.length
            ? "Missing required profile data: " + errors.join(", ")
            : "✓ Required profile fields look valid."}
        </div>
      </section>
    </>
  );
}
