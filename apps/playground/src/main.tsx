import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createApplication, emptyCandidate, parseCandidateJson, statuses, validateCandidate,
  type CandidateProfile, type JobApplication, type ApplicationStatus,
} from "@moyarich/job-application-autofill";
import "./styles.css";

const PROFILE_KEY = "moya-job-autofill:profile:v1";
const JOBS_KEY = "moya-job-autofill:jobs:v1";

function loadProfile(): CandidateProfile {
  try {
    const saved = localStorage.getItem(PROFILE_KEY);
    return saved ? parseCandidateJson(saved) : { ...emptyCandidate };
  } catch { return { ...emptyCandidate }; }
}
function loadJobs(): JobApplication[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(JOBS_KEY) || "[]");
    if (!Array.isArray(data)) return [];
    return data.filter((job): job is JobApplication =>
      typeof job === "object" && job !== null &&
      typeof job.id === "string" && typeof job.company === "string" &&
      typeof job.role === "string" && statuses.includes(job.status));
  } catch { return []; }
}
function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2) + "\n"], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const fields: { key: keyof CandidateProfile; label: string; placeholder?: string }[] = [
  { key: "firstName", label: "First name" }, { key: "lastName", label: "Last name" },
  { key: "email", label: "Email" }, { key: "phone", label: "Phone" },
  { key: "location", label: "Location" }, { key: "linkedIn", label: "LinkedIn URL" },
  { key: "github", label: "GitHub URL" }, { key: "website", label: "Website" },
  { key: "skills", label: "Skills (comma-separated)" },
];
const statusLabels: Record<ApplicationStatus, string> = {
  saved: "Saved", in_progress: "In progress", ready_for_review: "Ready for review",
  submitted: "Submitted", interview: "Interview", rejected: "Rejected",
};

function App() {
  const [tab, setTab] = useState<"applications" | "profile">("applications");
  const [profile, setProfile] = useState(loadProfile);
  const [jobs, setJobs] = useState(loadJobs);
  const [newJob, setNewJob] = useState({ company: "", role: "", url: "" });
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const resumeRef = useRef<HTMLInputElement>(null);
  const [resume, setResume] = useState<File | null>(null);
  useEffect(() => { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); }, [profile]);
  useEffect(() => { localStorage.setItem(JOBS_KEY, JSON.stringify(jobs)); }, [jobs]);
  const errors = validateCandidate(profile);
  const filtered = jobs.filter(job =>
    (job.company + " " + job.role).toLowerCase().includes(search.toLowerCase()));

  function addJob(event: React.FormEvent) {
    event.preventDefault();
    try {
      const job = createApplication(newJob.company, newJob.role, newJob.url);
      setJobs(items => [job, ...items]);
      setNewJob({ company: "", role: "", url: "" });
      setMessage("Job saved. Application submission is not implemented.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not add job"); }
  }
  function changeJob(id: string, status: ApplicationStatus) {
    setJobs(items => items.map(item => item.id === id ? { ...item, status } : item));
  }
  async function importProfile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setProfile(parseCandidateJson(await file.text()));
      setMessage("Profile imported from JSON.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invalid JSON profile");
    } finally { event.target.value = ""; }
  }
  function chooseResume(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (file && !/\.(pdf|docx)$/i.test(file.name)) {
      setMessage("Choose a PDF or DOCX resume."); return;
    }
    setResume(file);
    setProfile(value => ({ ...value, resumeFileName: file?.name ?? "" }));
    setMessage(file ? "Resume selected for this session; not uploaded or parsed." : "");
  }

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><span className="brand-symbol">M</span><span>Moya<span className="brand-light">Apply</span></span></div>
      <div className="nav-label">WORKSPACE</div>
      <button className={tab === "applications" ? "nav active" : "nav"} onClick={() => setTab("applications")}>◫ &nbsp; Applications</button>
      <button className={tab === "profile" ? "nav active" : "nav"} onClick={() => setTab("profile")}>♙ &nbsp; Candidate profile</button>
      <div className="sidebar-bottom">Local-first prototype<br/>React + TypeScript<br/><span>v0.1 foundation</span></div>
    </aside>
    <main className="main">
      <header><div><div className="eyebrow">JOB APPLICATION WORKSPACE</div><h1>{tab === "profile" ? "Candidate profile" : "Application tracker"}</h1>
        <p>{tab === "profile" ? "Maintain the structured information you'll use for future automation." : "Organize opportunities and keep every application in one place."}</p></div>
        <div className="header-chip">● &nbsp; Saved in this browser</div>
      </header>
      {message && <div className="notice" role="status">{message}<button onClick={() => setMessage("")} aria-label="Dismiss notification">×</button></div>}
      {tab === "applications" ? <>
        <section className="stats">
          <div className="stat"><span>Total applications</span><strong>{jobs.length}</strong></div>
          <div className="stat"><span>In progress</span><strong>{jobs.filter(x=>x.status==="in_progress"||x.status==="ready_for_review").length}</strong></div>
          <div className="stat"><span>Submitted</span><strong>{jobs.filter(x=>x.status==="submitted").length}</strong></div>
          <div className="stat"><span>Interviews</span><strong>{jobs.filter(x=>x.status==="interview").length}</strong></div>
        </section>
        <section className="panel"><div className="panel-title"><h2>Add an opportunity</h2><p>Save a job URL and track its progress.</p></div>
          <form className="add-form" onSubmit={addJob}>
            <label>Company<input required value={newJob.company} onChange={e=>setNewJob(x=>({...x,company:e.target.value}))} placeholder="Company name"/></label>
            <label>Role<input required value={newJob.role} onChange={e=>setNewJob(x=>({...x,role:e.target.value}))} placeholder="Software Engineer"/></label>
            <label>Job URL<input type="url" value={newJob.url} onChange={e=>setNewJob(x=>({...x,url:e.target.value}))} placeholder="https://..."/></label>
            <button className="primary" type="submit">+ Add job</button>
          </form>
        </section>
        <section className="panel"><div className="panel-title horizontal"><div><h2>Applications</h2><p>Update a job status after taking action.</p></div>
        <input aria-label="Search applications" className="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search company or role..."/></div>
        <div className="job-list">{filtered.length === 0 ? <div className="empty">No applications found. Add a job above to get started.</div> :
          filtered.map(job => <article className="job" key={job.id}><div className="job-icon">{job.company.slice(0,1).toUpperCase()}</div>
            <div className="job-info"><strong>{job.role}</strong><span>{job.company} · {new Date(job.createdAt).toLocaleDateString()}</span>
              {job.url && <a href={job.url} target="_blank" rel="noopener noreferrer">Open listing ↗</a>}</div>
            <select aria-label={`Status for ${job.company} ${job.role}`} value={job.status} onChange={e=>changeJob(job.id,e.target.value as ApplicationStatus)}>
              {statuses.map(status=><option key={status} value={status}>{statusLabels[status]}</option>)}</select>
            <button className="remove" aria-label={`Remove ${job.role} at ${job.company}`} onClick={()=>setJobs(items=>items.filter(x=>x.id!==job.id))}>×</button>
          </article>)}</div></section>
      </> : <>
        <section className="panel"><div className="panel-title horizontal"><div><h2>Personal information</h2><p>Stored locally in your browser. Import or export as JSON.</p></div>
          <div className="actions"><input ref={importRef} hidden type="file" accept=".json,application/json" onChange={importProfile}/>
            <button className="secondary" onClick={()=>importRef.current?.click()}>Import JSON</button>
            <button className="primary" onClick={()=>downloadJson("candidate-profile.json",profile)}>Export JSON</button></div>
        </div>
        <div className="profile-grid">{fields.map(({key,label})=><label key={key}>{label}<input type={key==="email"?"email":"text"} value={profile[key]} onChange={e=>setProfile(x=>({...x,[key]:e.target.value}))} placeholder={label}/></label>)}</div>
        <label className="wide-label">Professional summary<textarea rows={4} value={profile.summary} onChange={e=>setProfile(x=>({...x,summary:e.target.value}))} placeholder="Brief summary of your experience..."/></label>
        <div className={errors.length?"validation warning":"validation"}>{errors.length ? "Missing required profile data: "+errors.join(", ") : "✓ Required profile fields look valid."}</div>
        </section>
        <section className="panel"><div className="panel-title"><h2>Resume document</h2><p>PDF/DOCX selection only. Resume parsing and automated uploads require a future local backend.</p></div>
          <input ref={resumeRef} hidden type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={chooseResume}/>
          <div className="resume-box"><span>▤</span><div><strong>{resume?.name || profile.resumeFileName || "No resume selected"}</strong><p>The browser does not retain file bytes between sessions.</p></div><button className="secondary" onClick={()=>resumeRef.current?.click()}>Choose file</button></div>
        </section>
      </>}
      <footer>Local prototype • No automatic applications or resume parsing yet • Do not store secrets in your profile.</footer>
    </main>
  </div>;
}
const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
createRoot(root).render(<React.StrictMode><App/></React.StrictMode>);
