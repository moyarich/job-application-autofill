import { useMemo, useState } from "react";
import type { TrackerData } from "../feature-props";
import { Pagination } from "../Pagination/Pagination";
import { SearchInput } from "../SearchInput/SearchInput";
import { ApplicationFilters } from "../ApplicationFilters/ApplicationFilters";
import { paginateApplications, searchApplications, type ApplicationFilter, type ApplicationSort } from "../../utils/application/application-list";
import "./Opportunities.css";
import { Download, FilePlus2, Trash2 } from "lucide-react";
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
    metadataBusy,
    metadataError,
    jobs,
    resumeVersions,
    search,
    setSearch,
    prepareJob,
    changeJob,
    setNotesJobId,
    notesJobId,
    setJobs,
  } = controller;
  const [statusFilter, setStatusFilter] = useState<ApplicationFilter>("all");
  const [sort, setSort] = useState<ApplicationSort>("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const filtered = useMemo(() => searchApplications(jobs, search, statusFilter, sort), [jobs, search, statusFilter, sort]);
  const paginated = paginateApplications(filtered, page, pageSize);
  const updateSearch = (value: string) => { setSearch(value); setPage(1); };
  return (
    <>
      <section className="panel" id="add-application">
        <div className="panel-title">
          <h2>Add a job application</h2>
        </div>
        <form className="add-form" onSubmit={addJob}>
          <label>
            Job URL
            <input
              type="url"
              required
              value={newJob.url}
              onChange={(e) =>
                setNewJob((x) => ({ ...x, url: e.target.value }))
              }
              placeholder="https://company.example/jobs/..."
            />
          </label>
          <label>
            Company
            <input
              required
              value={newJob.company}
              onChange={(e) =>
                setNewJob((x) => ({ ...x, company: e.target.value }))
              }
              placeholder="Detected from job posting"
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
              placeholder="Detected from job posting"
            />
          </label>
          <button className="primary" type="submit">
            <FilePlus2 size={15} /> Add job
          </button>
        </form>
        {metadataBusy && <p className="job-metadata-status" role="status">Reading job posting…</p>}
        {!metadataBusy && metadataError && <p className="job-metadata-status" role="status">{metadataError}</p>}
      </section>
      <section className="panel" id="applications-list">
        <div className="panel-title applications-heading">
          <div>
            <h2>Your job applications</h2>
          </div>
          <div className="opportunity-controls">
            <SearchInput
              label="Search applications"
              value={search}
              onChange={updateSearch}
              placeholder="Search company, role, notes…"
            />
            <ApplicationFilters
              status={statusFilter}
              sort={sort}
              onStatusChange={(value) => { setStatusFilter(value); setPage(1); }}
              onSortChange={(value) => { setSort(value); setPage(1); }}
            />
            <button type="button" className="secondary"
              onClick={() => downloadJson("job-applications.json", jobs)}>
              <Download size={15} /> Export
            </button>
          </div>
        </div>
        <div className="job-list">
          {filtered.length === 0 ? (
            <div className="empty">
              {jobs.length === 0
                ? "No applications yet."
                : "No matching applications."}
            </div>
          ) : (
            paginated.items.map((job) => (
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
                <label className="application-resume-selector">
                  Resume
                  <select
                    aria-label={`Resume for ${job.role} at ${job.company}`}
                    value={job.resumeId ?? ""}
                    onChange={(event) => setJobs((items) => items.map((item) =>
                      item.id === job.id ? { ...item, resumeId: event.target.value || null } : item
                    ))}
                  >
                    <option value="">Select resume</option>
                    {resumeVersions.map((resume) => (
                      <option key={resume.id} value={resume.id}>{resume.name}</option>
                    ))}
                  </select>
                </label>
                <button
                  className="primary"
                  disabled={!job.url || !job.resumeId || !resumeVersions.some((resume) => resume.id === job.resumeId)}
                  onClick={() => void prepareJob(job)}
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
        {filtered.length > 0 && <Pagination
          page={paginated.page}
          pageCount={paginated.pageCount}
          start={paginated.start}
          end={paginated.end}
          total={paginated.total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />}
      </section>
    </>
  );
}
