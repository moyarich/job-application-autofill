import type { TrackerData } from "../controller-types";
import "./Opportunities.css";
import { Download, FilePlus2, Search, Trash2 } from "lucide-react";
import { statuses, type ApplicationStatus } from "../../index";
import { statusLabels } from "../../utils/profile/fields";
import { downloadJson } from "../../utils/files/resume-files";



export function Opportunities({
  controller,
}: {
  controller: TrackerData;
}) {
  const {
    addJob,
    newJob,
    setNewJob,
    jobs,
    search,
    setSearch,
    filtered,
    prepareJob,
    changeJob,
    setNotesJobId,
    notesJobId,
    setJobs,
  } = controller;
  return (
    <>
      <section className="panel" id="add-application">
        <div className="panel-title">
          <h2>Add an opportunity</h2>
          <p>Save the details of a role you want to apply for.</p>
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
            <FilePlus2 size={15} /> Add job
          </button>
        </form>
      </section>
      <section className="panel" id="applications-list">
        <div className="panel-title horizontal">
          <div>
            <h2>Applications</h2>
            <p>Keep track of every stage, from saved to submitted.</p>
          </div>
          <div className="opportunity-controls">
            <label className="search-control">
              <span className="sr-only">Search applications</span>
              <Search size={15} aria-hidden="true" />
              <input
                aria-label="Search applications"
                className="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search applications"
              />
            </label>
            <button type="button" className="secondary"
              onClick={() => downloadJson("job-applications.json", jobs)}>
              <Download size={15} /> Export
            </button>
          </div>
        </div>
        <div className="job-list">
          {filtered.length === 0 ? (
            <div className="empty">
              No matching applications. Try a different search or add a job.
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
                      View job posting
                    </a>
                  )}
                </div>
                <button
                  className="primary"
                  disabled={!job.url}
                  onClick={() => prepareJob(job)}
                >
                  Apply
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
                  <Trash2 size={16} aria-hidden="true" />
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
