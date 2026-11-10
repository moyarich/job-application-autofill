import { JobDescription } from "../JobDescription/JobDescription";
import { applicationReviewPath } from "../../routes";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TrackerData } from "../feature-props";
import { Pagination } from "../Pagination/Pagination";
import { SearchInput } from "../SearchInput/SearchInput";
import { ApplicationFilters } from "../ApplicationFilters/ApplicationFilters";
import {
  paginateApplications,
  searchApplications,
  type ApplicationFilter,
  type ApplicationSort,
} from "../../utils/application/application-list";
import "./Opportunities.css";
import {
  Download,
  FilePlus2,
  Trash2,
  Link2,
  MapPin,
  BriefcaseBusiness,
  LoaderCircle,
  ChevronDown,
  ExternalLink,
  FileText,
  Pencil,
  StickyNote,
  X,
} from "lucide-react";
import { statuses, type ApplicationStatus } from "../../index";
import { statusLabels } from "../../utils/profile/fields";
import { downloadJson } from "../../utils/files/resume-files";

export function Opportunities({
  controller,
  showAddForm,
  onCloseAddForm,
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
    removeJob: deleteApplication,
    setMessage,
  } = controller;
  const previousJobCount = useRef(jobs.length);
  useEffect(() => {
    if (jobs.length > previousJobCount.current) onCloseAddForm();
    previousJobCount.current = jobs.length;
  }, [jobs.length, onCloseAddForm]);
  const [statusFilter, setStatusFilter] = useState<ApplicationFilter>("all");
  const [sort, setSort] = useState<ApplicationSort>("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [descriptionJobId, setDescriptionJobId] = useState<string | null>(null);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    company: "",
    role: "",
    url: "",
  });
  const [editError, setEditError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  function startEdit(job: (typeof jobs)[number]) {
    setEditingJobId(job.id);
    setEditDraft({ company: job.company, role: job.role, url: job.url });
    setEditError("");
  }
  function saveEdit(jobId: string) {
    const company = editDraft.company.trim(),
      role = editDraft.role.trim(),
      url = editDraft.url.trim();
    if (!company || !role || !/^https?:\/\/\S+$/i.test(url)) {
      setEditError("Company, role, and a valid job posting URL are required.");
      return;
    }
    setJobs((items) =>
      items.map((job) =>
        job.id === jobId ? { ...job, company, role, url } : job,
      ),
    );
    setEditingJobId(null);
    setEditError("");
  }
  async function removeJob(job: (typeof jobs)[number]) {
    if (deletingId) return;
    if (
      !window.confirm(
        "Delete the application for " +
          job.role +
          " at " +
          job.company +
          "? Its saved screening answers will also be deleted.",
      )
    )
      return;
    setDeletingId(job.id);
    try {
      await deleteApplication(job.id);
      setMessage("Application deleted.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not delete application.",
      );
    } finally {
      setDeletingId(null);
    }
  }
  const filtered = useMemo(
    () => searchApplications(jobs, search, statusFilter, sort),
    [jobs, search, statusFilter, sort],
  );
  const paginated = paginateApplications(filtered, page, pageSize);
  const updateSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };
  return (
    <>
      {showAddForm && (
        <section
          className="panel application-create-panel"
          id="add-application"
        >
          <div className="panel-title horizontal">
            <h2>Add application</h2>
            <button
              type="button"
              className="application-icon-button"
              onClick={onCloseAddForm}
              aria-label="Close add application form"
            >
              <X size={18} />
            </button>
          </div>
          <form className="add-form job-intake" onSubmit={addJob}>
            <label className="job-url-field">
              <span>
                <Link2 size={14} aria-hidden="true" /> Job posting URL
              </span>
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
            <button className="primary" type="submit" disabled={metadataBusy}>
              {metadataBusy ? (
                <LoaderCircle size={15} className="application-spinner" />
              ) : (
                <FilePlus2 size={15} />
              )}{" "}
              {metadataBusy ? "Reading posting…" : "Add application"}
            </button>
            {jobDetails && (jobDetails.location || jobDetails.description) && (
              <div className="detected-job-summary">
                <div className="detected-job-facts">
                  {jobDetails.location && (
                    <span>
                      <MapPin size={14} />
                      {jobDetails.location}
                    </span>
                  )}
                  {jobDetails.employmentType && (
                    <span>
                      <BriefcaseBusiness size={14} />
                      {jobDetails.employmentType.replaceAll("_", " ")}
                    </span>
                  )}
                  {jobDetails.requisitionId && (
                    <span>{jobDetails.requisitionId}</span>
                  )}
                  {jobDetails.salary && (
                    <span className="job-salary">{jobDetails.salary}</span>
                  )}
                </div>
                {jobDetails.description && (
                  <details>
                    <summary>View job description</summary>
                    <JobDescription content={jobDetails.description} />
                  </details>
                )}
              </div>
            )}
          </form>
          {metadataBusy && (
            <p className="job-metadata-status" role="status">
              Reading job posting…
            </p>
          )}
          {!metadataBusy && metadataError && (
            <p className="job-metadata-status" role="status">
              {metadataError}
            </p>
          )}
        </section>
      )}
      <section className="panel applications-panel" id="applications-list">
        <div className="panel-title applications-heading">
          <div>
            <h2>
              Applications{" "}
              <span className="application-count">{jobs.length}</span>
            </h2>
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
              onStatusChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
              onSortChange={(value) => {
                setSort(value);
                setPage(1);
              }}
            />
            <button
              type="button"
              className="secondary"
              onClick={() => downloadJson("job-applications.json", jobs)}
            >
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
                  {job.details?.location && (
                    <span className="job-location">
                      <MapPin size={12} aria-hidden="true" />
                      {job.details.location}
                    </span>
                  )}
                  {job.details?.salary && (
                    <span className="job-salary">{job.details.salary}</span>
                  )}
                </div>
                <div className="job-actions">
                  <div className="job-apply-card">
                    <label className="application-resume-selector">
                      Resume
                      <select
                        aria-label={`Resume for ${job.role} at ${job.company}`}
                        value={job.resumeId ?? ""}
                        onChange={(event) =>
                          setJobs((items) =>
                            items.map((item) =>
                              item.id === job.id
                                ? {
                                    ...item,
                                    resumeId: event.target.value || null,
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        <option value="">Select resume</option>
                        {resumeVersions.map((resume) => (
                          <option key={resume.id} value={resume.id}>
                            {resume.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="application-resume-selector application-account-selector">
                      Account
                      <select
                        aria-label={`Account action for ${job.role} at ${job.company}`}
                        value={job.accountAction ?? "signup"}
                        onChange={(event) =>
                          setJobs((items) =>
                            items.map((item) =>
                              item.id === job.id
                                ? {
                                    ...item,
                                    accountAction: event.target.value as
                                      "signup" | "login",
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        <option value="signup">Sign up</option>
                        <option value="login">Log in</option>
                      </select>
                    </label>
                    <button
                      className="primary"
                      disabled={
                        !job.url ||
                        (!["in_progress", "ready_for_review"].includes(
                          job.status,
                        ) &&
                          (!job.resumeId ||
                            !resumeVersions.some(
                              (resume) => resume.id === job.resumeId,
                            )))
                      }
                      onClick={() => void prepareJob(job)}
                    >
                      {["in_progress", "ready_for_review"].includes(job.status)
                        ? "Continue application"
                        : "Apply"}
                    </button>
                  </div>
                  <details className="job-action-menu">
                    <summary
                      aria-label={`Actions for ${job.role} at ${job.company}`}
                    >
                      Actions <ChevronDown size={16} aria-hidden="true" />
                    </summary>
                    <div className="job-action-menu-content">
                      <label className="job-status-control">
                        Status
                        <select
                          aria-label={`Status for ${job.company} ${job.role}`}
                          value={job.status}
                          onChange={(event) => {
                            changeJob(
                              job.id,
                              event.target.value as ApplicationStatus,
                            );
                            event.currentTarget
                              .closest(".job-action-menu")
                              ?.removeAttribute("open");
                          }}
                        >
                          {statuses.map((status) => (
                            <option key={status} value={status}>
                              {statusLabels[status]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <a
                        className="job-menu-item"
                        href={applicationReviewPath(job.id)}
                      >
                        <FileText size={16} aria-hidden="true" /> View
                        application
                      </a>
                      {job.details?.description && (
                        <button
                          type="button"
                          className="job-menu-item"
                          onClick={(event) => {
                            setDescriptionJobId(
                              descriptionJobId === job.id ? null : job.id,
                            );
                            event.currentTarget
                              .closest(".job-action-menu")
                              ?.removeAttribute("open");
                          }}
                        >
                          <FileText size={16} aria-hidden="true" /> Job
                          description
                        </button>
                      )}
                      {job.url && (
                        <a
                          className="job-menu-item"
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink size={16} aria-hidden="true" /> View job
                          posting
                        </a>
                      )}
                      <button
                        type="button"
                        className="job-menu-item"
                        onClick={(event) => {
                          setNotesJobId(notesJobId === job.id ? null : job.id);
                          event.currentTarget
                            .closest(".job-action-menu")
                            ?.removeAttribute("open");
                        }}
                      >
                        <StickyNote size={16} aria-hidden="true" /> Notes
                      </button>
                      <button
                        type="button"
                        className="job-menu-item"
                        onClick={(event) => {
                          startEdit(job);
                          event.currentTarget
                            .closest(".job-action-menu")
                            ?.removeAttribute("open");
                        }}
                      >
                        <Pencil size={16} aria-hidden="true" /> Edit application
                      </button>
                      <button
                        type="button"
                        className="job-menu-item job-menu-danger"
                        aria-label={`Remove ${job.role} at ${job.company}`}
                        disabled={deletingId !== null}
                        onClick={() => void removeJob(job)}
                      >
                        <Trash2 size={16} aria-hidden="true" />{" "}
                        {deletingId === job.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </details>
                </div>
                {editingJobId === job.id && (
                  <form
                    className="application-edit-form"
                    aria-label={"Edit " + job.role + " application"}
                    onSubmit={(event) => {
                      event.preventDefault();
                      saveEdit(job.id);
                    }}
                  >
                    <h3>Edit application</h3>
                    <div className="application-edit-fields">
                      <label>
                        Company
                        <input
                          required
                          maxLength={500}
                          value={editDraft.company}
                          onChange={(event) =>
                            setEditDraft((old) => ({
                              ...old,
                              company: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        Role
                        <input
                          required
                          maxLength={500}
                          value={editDraft.role}
                          onChange={(event) =>
                            setEditDraft((old) => ({
                              ...old,
                              role: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        Job posting URL
                        <input
                          required
                          type="url"
                          maxLength={4000}
                          value={editDraft.url}
                          onChange={(event) =>
                            setEditDraft((old) => ({
                              ...old,
                              url: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                    {editError && <p role="alert">{editError}</p>}
                    <div className="actions">
                      <button type="submit" className="primary">
                        Save changes
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          setEditingJobId(null);
                          setEditError("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
                {descriptionJobId === job.id && job.details?.description && (
                  <div className="job-description-expanded">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setDescriptionJobId(null)}
                    >
                      Close description
                    </button>
                    <JobDescription content={job.details.description} />
                  </div>
                )}
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
        {filtered.length > 0 && (
          <Pagination
            page={paginated.page}
            pageCount={paginated.pageCount}
            start={paginated.start}
            end={paginated.end}
            total={paginated.total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        )}
      </section>
    </>
  );
}
