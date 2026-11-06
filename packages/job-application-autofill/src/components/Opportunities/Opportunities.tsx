import { statuses, type ApplicationStatus } from "../../index";
import { statusLabels } from "../../utils/profile/fields";
import { downloadJson } from "../../utils/files/resume-files";
import type { ApplicationController } from "../../utils/application/useApplication";
export function Opportunities({
  controller,
}: {
  controller: ApplicationController;
}) {
  const {
    addJob,
    newJob,
    setNewJob,
    jobs,
    search,
    setSearch,
    filtered,
    applyBusy,
    session,
    prepareJob,
    changeJob,
    setNotesJobId,
    notesJobId,
    setJobs,
  } = controller;
  return (
    <>
      {" "}
      <section className="panel">
        <div className="panel-title">
          <h2>Add an opportunity</h2>
          <p>Save a job URL and track its progress.</p>
        </div>
        <form className="add-form" onSubmit={addJob}>
          <label>
            Company
            <input
              required
              value={newJob.company}
              onChange={(e) =>
                setNewJob((x) => ({ ...x, company: e.target.value }))
              }
              placeholder="Company name"
            />
          </label>
          <label>
            Role
            <input
              required
              value={newJob.role}
              onChange={(e) =>
                setNewJob((x) => ({ ...x, role: e.target.value }))
              }
              placeholder="Software Engineer"
            />
          </label>
          <label>
            Job URL
            <input
              type="url"
              value={newJob.url}
              onChange={(e) =>
                setNewJob((x) => ({ ...x, url: e.target.value }))
              }
              placeholder="https://..."
            />
          </label>
          <button className="primary" type="submit">
            + Add job
          </button>
        </form>
      </section>
      <section className="panel" id="applications-list">
        <div className="panel-title horizontal">
          <div>
            <h2>Applications</h2>
            <p>Update a job status after taking action.</p>
          </div>
          <button
            className="secondary"
            onClick={() => downloadJson("job-applications.json", jobs)}
          >
            Export applications
          </button>
          <input
            aria-label="Search applications"
            className="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company or role..."
          />
        </div>
        <div className="job-list">
          {filtered.length === 0 ? (
            <div className="empty">
              No applications found. Add a job above to get started.
            </div>
          ) : (
            filtered.map((job) => (
              <article className="job" key={job.id}>
                <div className="job-icon">
                  {job.company.slice(0, 1).toUpperCase()}
                </div>
                <div className="job-info">
                  <strong>{job.role}</strong>
                  <span>
                    {job.company} ·{" "}
                    {new Date(job.createdAt).toLocaleDateString()}
                  </span>
                  {job.url && (
                    <a href={job.url} target="_blank" rel="noopener noreferrer">
                      Open listing ↗
                    </a>
                  )}
                </div>
                <button
                  className="primary"
                  disabled={applyBusy || Boolean(session) || !job.url}
                  onClick={() => prepareJob(job)}
                >
                  {applyBusy ? "Working..." : "Apply"}
                </button>
                <select
                  aria-label={`Status for ${job.company} ${job.role}`}
                  value={job.status}
                  onChange={(e) =>
                    changeJob(job.id, e.target.value as ApplicationStatus)
                  }
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
                <button
                  className="secondary"
                  onClick={() =>
                    setNotesJobId(notesJobId === job.id ? null : job.id)
                  }
                  aria-label={`Edit notes for ${job.role} at ${job.company}`}
                >
                  Notes
                </button>
                <button
                  className="remove"
                  aria-label={`Remove ${job.role} at ${job.company}`}
                  onClick={() =>
                    setJobs((items) => items.filter((x) => x.id !== job.id))
                  }
                >
                  ×
                </button>
                {notesJobId === job.id && (
                  <label className="job-notes">
                    Application notes
                    <textarea
                      rows={3}
                      value={job.notes || ""}
                      onChange={(e) =>
                        setJobs((items) =>
                          items.map((item) =>
                            item.id === job.id
                              ? { ...item, notes: e.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="Recruiter, interview date, follow-up details..."
                    />
                  </label>
                )}
              </article>
            ))
          )}
        </div>
      </section>
    </>
  );
}
