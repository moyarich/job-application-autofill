import { JobDescription } from "../JobDescription/JobDescription";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TrackerData } from "../feature-props";
import { Pagination } from "../Pagination/Pagination";
import { SearchInput } from "../SearchInput/SearchInput";
import { ApplicationFilters } from "../ApplicationFilters/ApplicationFilters";
import { paginateApplications, searchApplications, type ApplicationFilter, type ApplicationSort } from "../../utils/application/application-list";
import "./Opportunities.css";
import { Download, FilePlus2, Trash2, Link2, MapPin, BriefcaseBusiness, LoaderCircle, ChevronDown, X } from "lucide-react";
import { statuses, type ApplicationStatus } from "../../index";
import { statusLabels } from "../../utils/profile/fields";
import { downloadJson } from "../../utils/files/resume-files";



export function Opportunities({
  controller, showAddForm, onCloseAddForm,
}: {
  controller: TrackerData;
  showAddForm: boolean;
  onCloseAddForm: () => void;
}) {
  const {
    addJob,
    newJob,
    setNewJob,
    jobDetails,
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
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const previousJobCount = useRef(jobs.length);
  useEffect(() => {
    if (jobs.length > previousJobCount.current) onCloseAddForm();
    previousJobCount.current = jobs.length;
  }, [jobs.length, onCloseAddForm]);
  const [statusFilter, setStatusFilter] = useState<ApplicationFilter>("all");
  const [sort, setSort] = useState<ApplicationSort>("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const filtered = useMemo(() => searchApplications(jobs, search, statusFilter, sort), [jobs, search, statusFilter, sort]);
  const paginated = paginateApplications(filtered, page, pageSize);
  const updateSearch = (value: string) => { setSearch(value); setPage(1); };
  return (
    <>
      {showAddForm && <section className="panel application-create-panel" id="add-application">
        <div className="panel-title horizontal">
          <h2>Add application</h2>
          <button type="button" className="application-icon-button" onClick={onCloseAddForm} aria-label="Close add application form"><X size={18} /></button>
        </div>
        <form className="add-form job-intake" onSubmit={addJob}>
          <label className="job-url-field">
            <span><Link2 size={14} aria-hidden="true" /> Job posting URL</span>
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
          <fieldset className="application-account-choice">
            <legend>Employer account</legend>
            <label><input type="radio" name="account-action" value="signup" checked={newJob.accountAction === "signup"}
              onChange={() => setNewJob((current) => ({ ...current, accountAction: "signup" }))} /> Sign up</label>
            <label><input type="radio" name="account-action" value="login" checked={newJob.accountAction === "login"}
              onChange={() => setNewJob((current) => ({ ...current, accountAction: "login" }))} /> Log in</label>
            <span>Uses your configured credentials.</span>
          </fieldset>
          <button className="primary" type="submit" disabled={metadataBusy}>
            {metadataBusy ? <LoaderCircle size={15} className="application-spinner" /> : <FilePlus2 size={15} />} {metadataBusy ? "Reading posting…" : "Add application"}
          </button>
          {jobDetails && (jobDetails.location || jobDetails.description) && (
            <div className="detected-job-summary">
              <div className="detected-job-facts">
                {jobDetails.location && <span><MapPin size={14} />{jobDetails.location}</span>}
                {jobDetails.employmentType && <span><BriefcaseBusiness size={14} />{jobDetails.employmentType.replaceAll("_", " ")}</span>}
                {jobDetails.requisitionId && <span>{jobDetails.requisitionId}</span>}
                {jobDetails.salary && <span className="job-salary">{jobDetails.salary}</span>}
              </div>
              {jobDetails.description && <details><summary>View job description</summary><JobDescription content={jobDetails.description} /></details>}
            </div>
          )}
        </form>
        {metadataBusy && <p className="job-metadata-status" role="status">Reading job posting…</p>}
        {!metadataBusy && metadataError && <p className="job-metadata-status" role="status">{metadataError}</p>}
      </section>}
      <section className="panel applications-panel" id="applications-list">
        <div className="panel-title applications-heading">
          <div>
            <h2>Applications <span className="application-count">{jobs.length}</span></h2>
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
                  {job.details?.location && <span className="job-location"><MapPin size={12} aria-hidden="true" />{job.details.location}</span>}
                  {job.details?.salary && <span className="job-salary">{job.details.salary}</span>}
                  {job.details?.description && <details className="saved-job-description"><summary>Job description</summary><JobDescription content={job.details.description} /></details>}
                  {job.url && (
                    <a href={job.url} target="_blank" rel="noopener noreferrer">
                      View job posting
                    </a>
                  )}
                </div>
                <div className="job-actions">
                  <label className="sr-only" htmlFor={`status-${job.id}`}>Status for {job.role} at {job.company}</label>
                  <select id={`status-${job.id}`} className="application-status-select"
                    value={job.status} onChange={(e) => changeJob(job.id, e.target.value as ApplicationStatus)}>
                    {statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                  </select>
                  <button className="primary" disabled={!job.url || !job.resumeId || !resumeVersions.some((resume) => resume.id === job.resumeId)}
                    onClick={() => void prepareJob(job)}>Apply</button>
                  <button type="button" className="secondary application-details-toggle"
                    aria-expanded={expandedJobId === job.id} aria-controls={`application-details-${job.id}`}
                    onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}>
                    Details <ChevronDown size={15} aria-hidden="true" />
                  </button>
                </div>
                {expandedJobId === job.id && <div className="application-row-details" id={`application-details-${job.id}`}>
                  <label className="application-resume-selector">
                    Resume
                    <select aria-label={`Resume for ${job.role} at ${job.company}`} value={job.resumeId ?? ""}
                      onChange={(event) => setJobs((items) => items.map((item) =>
                        item.id === job.id ? { ...item, resumeId: event.target.value || null } : item))}>
                      <option value="">Select resume</option>
                      {resumeVersions.map((resume) => <option key={resume.id} value={resume.id}>{resume.name}</option>)}
                    </select>
                  </label>
                  <label className="application-resume-selector">
                    Employer account
                    <select aria-label={`Account action for ${job.role} at ${job.company}`}
                      value={job.accountAction ?? "signup"}
                      onChange={(event) => setJobs((items) => items.map((item) =>
                        item.id === job.id ? { ...item, accountAction: event.target.value as "signup" | "login" } : item))}>
                      <option value="signup">Sign up</option><option value="login">Log in</option>
                    </select>
                  </label>
                  <button type="button" className="secondary" onClick={() => setNotesJobId(notesJobId === job.id ? null : job.id)}>Notes</button>
                  <button type="button" className="remove" aria-label={`Remove ${job.role} at ${job.company}`}
                    onClick={() => setJobs((items) => items.filter((x) => x.id !== job.id))}>
                    <Trash2 size={16} aria-hidden="true" /> Remove
                  </button>
                </div>}
                {expandedJobId === job.id && notesJobId === job.id && (
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
