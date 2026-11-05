import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createApplication, emptyCandidate, parseCandidateJson, statuses, validateCandidate,
  type CandidateProfile, type JobApplication, type ApplicationStatus,
} from "../../../packages/job-application-autofill/src/index";
import "./styles.css";

type AtsQuestion = { label: string; kind: "text" | "textarea" | "select" | "combobox" | "radio" | "checkbox"; required: boolean; options: string[] };
type ApplySession = { id: string; jobId: string; state: string; message: string; url: string; screenshot: string | null; reviewUrl: string | null; filled: string[]; missing: string[]; ats?: string; questions?: AtsQuestion[]; answerResult?: { filled: string[]; unresolved: string[] } };

async function requestApi<T>(url: string, data: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Moya-Client": "dashboard" },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Local API request failed");
  return result as T;
}
async function filePayload(file: File): Promise<{ fileName: string; base64: string }> {
  if (file.size > 10 * 1024 * 1024) throw new Error("Maximum resume size is 10 MB.");
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve({ fileName: file.name, base64: result.slice(result.indexOf(",") + 1) });
    };
    reader.onerror = () => reject(new Error("Unable to read resume file"));
    reader.readAsDataURL(file);
  });
}

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
  const [tab, setTab] = useState<"applications" | "profile" | "parser">("applications");
  const [profile, setProfile] = useState(loadProfile);
  const [jobs, setJobs] = useState(loadJobs);
  const [newJob, setNewJob] = useState({ company: "", role: "", url: "" });
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const resumeRef = useRef<HTMLInputElement>(null);
  const [resume, setResume] = useState<File | null>(null);
  const [parseBusy, setParseBusy] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [parsePreview, setParsePreview] = useState("");
  const [session, setSession] = useState<ApplySession | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [notesJobId, setNotesJobId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/apply/active", { headers: { "X-Moya-Client": "dashboard" } })
      .then(response => response.ok ? response.json() : null)
      .then(result => { if (!cancelled && result?.session) setSession(result.session as ApplySession); })
      .catch(() => { /* Local API might not be running. */ });
    return () => { cancelled = true; };
  }, []);
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
      setMessage("Job added. Select Apply on its row to start browser automation.");
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
    if (file && (!/\.(pdf|docx)$/i.test(file.name) || file.size > 10 * 1024 * 1024)) {
      setMessage("Choose a PDF or DOCX resume of 10 MB or less."); return;
    }
    setResume(file);
    setProfile(value => ({ ...value, resumeFileName: file?.name ?? "" }));
    setMessage(file ? "Resume selected. Click Parse resume to extract fields." : "");
  }

  async function parseResume() {
    if (!resume) { setMessage("Choose a PDF or DOCX resume first."); setTab("parser"); return; }
    setParseBusy(true);
    setMessage("");
    try {
      const upload = await filePayload(resume);
      const result = await requestApi<{ profile: CandidateProfile; preview: string; warnings: string[] }>("/api/resume/parse", upload);
      setProfile(previous => {
        const updated = { ...previous };
        for (const [key, value] of Object.entries(result.profile)) {
          if (typeof value === "string" && value.trim()) (updated as unknown as Record<string,string>)[key] = value;
        }
        return updated;
      });
      setParsePreview(result.preview);
      setMessage("Resume parsed. Review and correct extracted information in Candidate profile.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Resume parse failed"); }
    finally { setParseBusy(false); }
  }
  async function prepareJob(job: JobApplication) {
    if (session) { setMessage("Close the current browser session before applying to another job."); return; }
    if (!job.url) { setMessage("Add a job URL before applying."); return; }
    if (errors.length) { setMessage("Complete first name, last name and email in Candidate profile before applying."); setTab("profile"); return; }
    setApplyBusy(true);
    setMessage("Launching Playwright browser and filling supported fields...");
    try {
      const upload = resume ? await filePayload(resume) : null;
      const result = await requestApi<ApplySession>("/api/apply/prepare", { jobUrl: job.url, jobId: job.id, profile, resume: upload });
      setSession(result);
      setReviewed(false);
      setQuestionAnswers({});
      changeJob(job.id, result.state === "ready_for_review" ? "ready_for_review" : "in_progress");
      setMessage(result.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to prepare application"); }
    finally { setApplyBusy(false); }
  }
  async function fillCustomQuestions() {
    if (!session) return;
    setApplyBusy(true);
    try {
      const updated = await requestApi<ApplySession>("/api/apply/" + session.id + "/answers", { answers: questionAnswers });
      setSession(updated);
      setReviewed(false);
      setMessage(updated.answerResult?.unresolved.length
        ? "Could not resolve: " + updated.answerResult.unresolved.join(", ") + ". Please use the browser viewer."
        : updated.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to fill employer questions."); }
    finally { setApplyBusy(false); }
  }
  async function continueAfterChallenge() {
    if (!session) return;
    setApplyBusy(true);
    try {
      const updated = await requestApi<ApplySession>("/api/apply/" + session.id + "/continue", {});
      setSession(updated);
      setReviewed(false);
      changeJob(updated.jobId, updated.state === "ready_for_review" ? "ready_for_review" : "in_progress");
      setMessage(updated.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Challenge is not complete."); }
    finally { setApplyBusy(false); }
  }
  async function finalizeApplication(submit: boolean) {
    if (!session) return;
    if (submit && session.reviewUrl && !reviewed) { setMessage("Open the browser viewer and confirm you reviewed the application first."); return; }
    if (submit && !window.confirm("Confirm final submission? Check every field in the opened browser first.")) return;
    setApplyBusy(true);
    try {
      const result = await requestApi<ApplySession | {closed:boolean}>("/api/apply/" + session.id + "/" + (submit ? "submit" : "close"), submit ? {confirm:true, reviewed: session.reviewUrl ? reviewed : true} : {});
      if (submit) {
        const next = result as ApplySession;
        setSession(next); setMessage(next.message);
        setJobs(items => items.map(job => job.id === session.jobId
          ? { ...job, status: (next.state === "submitted" ? "submitted" : "in_progress") as ApplicationStatus }
          : job));
      } else { setSession(null); setMessage("Browser session closed."); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Browser action failed"); }
    finally { setApplyBusy(false); }
  }
  const parserPanel = <section className="panel">
    <div className="panel-title"><h2>Resume parser</h2><p>Upload a PDF or DOCX to extract contact details and skills. Review the results before applying.</p></div>
    <div className="parser-grid">
      <div className="parser-left">
        <input ref={resumeRef} hidden type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={chooseResume}/>
        <div className="drop-zone" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const file=e.dataTransfer.files[0]; if(file) { if(!/\.(pdf|docx)$/i.test(file.name)||file.size>10*1024*1024) {setMessage("Choose a PDF or DOCX resume of 10 MB or less.");return;} setResume(file);setProfile(p=>({...p,resumeFileName:file.name}));setMessage("Resume ready to parse.");}}}>
          <div className="upload-symbol">⇧</div><strong>{resume?.name || "Drag and drop your resume here"}</strong>
          <p>PDF or DOCX · 10 MB max</p>
          <button className="secondary" type="button" onClick={()=>resumeRef.current?.click()}>Choose resume</button>
        </div>
        <button className="primary parser-button" type="button" disabled={parseBusy || !resume} onClick={parseResume}>{parseBusy ? "Parsing..." : "✧ Parse resume"}</button>
      </div>
      <div className="parsed-profile">
        <div className="parsed-title"><strong>Parsed profile</strong><button className="secondary" onClick={()=>setTab("profile")}>Edit profile</button></div>
        <div><span>Name</span><strong>{[profile.firstName,profile.lastName].filter(Boolean).join(" ") || "Not extracted"}</strong></div>
        <div><span>Email</span><strong>{profile.email || "Not extracted"}</strong></div>
        <div><span>Skills</span><strong>{profile.skills || "Not extracted"}</strong></div>
        <div><span>Resume</span><strong>{profile.resumeFileName || "Not selected"}</strong></div>
      </div>
    </div>
    {parsePreview && <details className="text-preview"><summary>View extracted text preview</summary><pre>{parsePreview}</pre></details>}
  </section>;

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><span className="brand-symbol">M</span><span>Moya<span className="brand-light">Apply</span></span></div>
      <div className="nav-label">WORKSPACE</div>
      <button className={tab === "applications" ? "nav active" : "nav"} onClick={() => setTab("applications")}>◫ &nbsp; Applications</button>
      <button className={tab === "profile" ? "nav active" : "nav"} onClick={() => setTab("profile")}>♙ &nbsp; Candidate profile</button>
      <button className={tab === "parser" ? "nav active" : "nav"} onClick={() => setTab("parser")}>⇧ &nbsp; Resume parser</button>
      <div className="sidebar-bottom">Local-first prototype<br/>React + TypeScript<br/><span>v0.1 foundation</span></div>
    </aside>
    <main className="main">
      <header><div><div className="eyebrow">JOB APPLICATION WORKSPACE</div><h1>{tab === "profile" ? "Candidate profile" : tab === "parser" ? "Resume parser" : "Application tracker"}</h1>
        <p>{tab === "profile" ? "Maintain your structured candidate information." : tab === "parser" ? "Extract profile data from a resume file." : "Organize opportunities and apply to supported job boards."}</p></div>
        <div className="actions"><span className="header-chip">● &nbsp; Saved in this browser</span>
        <button className="secondary" onClick={()=>setTab("parser")}>Parse resume</button>
        <button className="primary" onClick={()=>{setTab("applications");document.getElementById("applications-list")?.scrollIntoView({behavior:"smooth"});}}>Apply to job</button></div>
      </header>
      {message && <div className="notice" role="status">{message}<button onClick={() => setMessage("")} aria-label="Dismiss notification">×</button></div>}
      {tab === "applications" ? <>
        <section className="stats">
          <div className="stat"><span>Total applications</span><strong>{jobs.length}</strong></div>
          <div className="stat"><span>In progress</span><strong>{jobs.filter(x=>x.status==="in_progress"||x.status==="ready_for_review").length}</strong></div>
          <div className="stat"><span>Submitted</span><strong>{jobs.filter(x=>x.status==="submitted").length}</strong></div>
          <div className="stat"><span>Interviews</span><strong>{jobs.filter(x=>x.status==="interview").length}</strong></div>
        </section>
        {parserPanel}
        {session && <section className="panel review-panel"><div className="panel-title"><h2>Application review</h2><p>{session.message}</p></div>
          <p><strong>Session:</strong> {session.state.replaceAll("_", " ")} · {session.url}</p>
          {(session.state === "manual_intervention" || session.state === "login_required") && <div className="validation warning">
            {session.state === "login_required"
              ? "Sign in or create your account in the interactive browser viewer. Enter credentials and MFA codes only on the employer or identity provider website."
              : "Complete the security challenge in the interactive browser viewer."}
            <button className="secondary" disabled={applyBusy} onClick={continueAfterChallenge}>I've finished — continue</button>
          </div>}
          {session.state === "submission_unverified" && <p className="validation warning">Submission was attempted but the employer did not show a recognizable confirmation. Verify the result manually before updating the job status.</p>}
          {session.ats && <p><strong>ATS:</strong> {session.ats}</p>}
          {session.state === "ready_for_review" && <div className="application-questions">
            <div className="panel-title"><h3>Employer-specific questions</h3><p>Only your own answers are filled. Sensitive and voluntary questions stay in the employer browser.</p></div>
            {(session.questions || []).filter(q => !/password|passcode|otp|social security|ssn|date of birth|birth date|credit card|bank account|passport|tax id|gender|race|ethnic|disabil|veteran|sexual orientation|demographic|self.identif/i.test(q.label)).map(q =>
              <label key={q.label}>{q.label}{q.required ? " (required)" : ""}
                {q.options.length > 0 && (q.kind === "select" || q.kind === "radio" || q.kind === "combobox")
                  ? <select value={questionAnswers[q.label] || ""} onChange={e=>setQuestionAnswers(value=>({...value,[q.label]:e.target.value}))}>
                      <option value="">Select an answer</option>{q.options.map(option=><option key={option} value={option}>{option}</option>)}
                    </select>
                  : q.kind === "checkbox"
                    ? <select value={questionAnswers[q.label] || ""} onChange={e=>setQuestionAnswers(value=>({...value,[q.label]:e.target.value}))}>
                        <option value="">Select</option><option value="Yes">Yes</option><option value="No">No</option>
                      </select>
                    : q.kind === "textarea"
                      ? <textarea rows={3} value={questionAnswers[q.label] || ""} onChange={e=>setQuestionAnswers(value=>({...value,[q.label]:e.target.value}))} />
                      : <input value={questionAnswers[q.label] || ""} onChange={e=>setQuestionAnswers(value=>({...value,[q.label]:e.target.value}))} />}
              </label>)}
            <div className="actions">
              <button className="secondary" disabled={applyBusy || !Object.values(questionAnswers).some(Boolean)} onClick={fillCustomQuestions}>Fill my answers</button>
              <button className="secondary" disabled={applyBusy} onClick={continueAfterChallenge}>Refresh form after next step</button>
            </div>
          </div>}
          {session.reviewUrl && <div className="browser-review">
            <div className="browser-review-header">
              <strong>Live employer application</strong>
              <a className="browser-open" href={session.reviewUrl} target="_blank" rel="noopener noreferrer" onClick={() => setReviewed(false)}>Open in full window ↗</a>
            </div>
            <p>Enter the VNC password from your Docker Compose configuration to interact with Chromium. Review every field and complete any missing questions before submitting.</p>
            {session.filled?.length > 0 && <p><strong>Prepared:</strong> {session.filled.join(", ")}</p>}
            {session.missing?.length > 0 && <p className="validation warning"><strong>Review manually:</strong> {session.missing.join(", ")}</p>}
            <iframe className="browser-viewer" title="Interactive Playwright application browser" src={session.reviewUrl} allow="clipboard-read; clipboard-write" referrerPolicy="no-referrer" />
            <label className="review-checkbox"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} /> I inspected the live application and reviewed all fields.</label>
          </div>}
          <div className="actions"><button disabled={applyBusy || session.state !== "ready_for_review" || Boolean(session.reviewUrl && !reviewed)} className="primary" onClick={()=>finalizeApplication(true)}>Confirm & submit</button>
          <button disabled={applyBusy} className="secondary" onClick={()=>finalizeApplication(false)}>Close browser session</button></div>
          <p className="review-note">Review the actual Playwright browser window and answer any required questions before submitting. Submission is never automatic.</p>
        </section>}
        <section className="panel"><div className="panel-title"><h2>Add an opportunity</h2><p>Save a job URL and track its progress.</p></div>
          <form className="add-form" onSubmit={addJob}>
            <label>Company<input required value={newJob.company} onChange={e=>setNewJob(x=>({...x,company:e.target.value}))} placeholder="Company name"/></label>
            <label>Role<input required value={newJob.role} onChange={e=>setNewJob(x=>({...x,role:e.target.value}))} placeholder="Software Engineer"/></label>
            <label>Job URL<input type="url" value={newJob.url} onChange={e=>setNewJob(x=>({...x,url:e.target.value}))} placeholder="https://..."/></label>
            <button className="primary" type="submit">+ Add job</button>
          </form>
        </section>
        <section className="panel" id="applications-list"><div className="panel-title horizontal"><div><h2>Applications</h2><p>Update a job status after taking action.</p></div>
        <button className="secondary" onClick={()=>downloadJson("job-applications.json",jobs)}>Export applications</button>
        <input aria-label="Search applications" className="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search company or role..."/></div>
        <div className="job-list">{filtered.length === 0 ? <div className="empty">No applications found. Add a job above to get started.</div> :
          filtered.map(job => <article className="job" key={job.id}><div className="job-icon">{job.company.slice(0,1).toUpperCase()}</div>
            <div className="job-info"><strong>{job.role}</strong><span>{job.company} · {new Date(job.createdAt).toLocaleDateString()}</span>
              {job.url && <a href={job.url} target="_blank" rel="noopener noreferrer">Open listing ↗</a>}</div>
            <button className="primary" disabled={applyBusy || Boolean(session) || !job.url} onClick={()=>prepareJob(job)}>{applyBusy ? "Working..." : "Apply"}</button>
            <select aria-label={`Status for ${job.company} ${job.role}`} value={job.status} onChange={e=>changeJob(job.id,e.target.value as ApplicationStatus)}>
              {statuses.map(status=><option key={status} value={status}>{statusLabels[status]}</option>)}</select>
            <button className="secondary" onClick={()=>setNotesJobId(notesJobId===job.id ? null : job.id)} aria-label={`Edit notes for ${job.role} at ${job.company}`}>Notes</button>
            <button className="remove" aria-label={`Remove ${job.role} at ${job.company}`} onClick={()=>setJobs(items=>items.filter(x=>x.id!==job.id))}>×</button>
            {notesJobId === job.id && <label className="job-notes">Application notes
              <textarea rows={3} value={job.notes || ""} onChange={e=>setJobs(items=>items.map(item=>item.id===job.id?{...item,notes:e.target.value}:item))} placeholder="Recruiter, interview date, follow-up details..." />
            </label>}
          </article>)}</div></section>
      </> : tab === "parser" ? parserPanel : <>
        <section className="panel"><div className="panel-title horizontal"><div><h2>Personal information</h2><p>Stored locally in your browser. Import or export as JSON.</p></div>
          <div className="actions"><input ref={importRef} hidden type="file" accept=".json,application/json" onChange={importProfile}/>
            <button className="secondary" onClick={()=>importRef.current?.click()}>Import JSON</button>
            <button className="primary" onClick={()=>downloadJson("candidate-profile.json",profile)}>Export JSON</button></div>
        </div>
        <div className="profile-grid">{fields.map(({key,label})=><label key={key}>{label}<input type={key==="email"?"email":"text"} value={profile[key]} onChange={e=>setProfile(x=>({...x,[key]:e.target.value}))} placeholder={label}/></label>)}</div>
        <label className="wide-label">Professional summary<textarea rows={4} value={profile.summary} onChange={e=>setProfile(x=>({...x,summary:e.target.value}))} placeholder="Brief summary of your experience..."/></label>
        <div className={errors.length?"validation warning":"validation"}>{errors.length ? "Missing required profile data: "+errors.join(", ") : "✓ Required profile fields look valid."}</div>
        </section>

      </>}
      <footer>Local-first prototype · Resume data stays on your computer · Playwright requires the local API · Review before submission.</footer>
    </main>
  </div>;
}
const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
createRoot(root).render(<React.StrictMode><App/></React.StrictMode>);
