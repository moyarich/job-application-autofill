import React, { useState, useEffect, useRef } from "react";
import {
  createApplication,
  emptyCandidate,
  parseCandidateJson,
  validateCandidate,
  type CandidateProfile,
  type JobApplication,
  type ApplicationStatus,
} from "../../index";
import type { ApplySession } from "./types";
import { requestApi, readState, saveState } from "../api/client";
import { filePayload } from "../files/resume-files";
export function useApplication() {
  const applicationId = new URLSearchParams(window.location.search).get(
    "application",
  );
  const [activeLoaded, setActiveLoaded] = useState(!applicationId);
  const autoStarted = useRef(false);
  const [tab, setTab] = useState<"applications" | "profile" | "parser">(
    "applications",
  );
  const [profile, setProfile] = useState<CandidateProfile>(() =>
    structuredClone(emptyCandidate),
  );
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const revisionRef = useRef(0);
  const savedRef = useRef("");
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const blockedRef = useRef(false);
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
  const [questionAnswers, setQuestionAnswers] = useState<
    Record<string, string>
  >({});
  const [notesJobId, setNotesJobId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!applicationId) return;
    fetch("/api/apply/active?jobId=" + encodeURIComponent(applicationId), {
      headers: { "X-Moya-Client": "dashboard" },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (!cancelled && result?.session)
          setSession(result.session as ApplySession);
      })
      .catch(() => {
        /* Local API might not be running. */
      })
      .finally(() => {
        if (!cancelled) setActiveLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    readState()
      .then((state) => {
        if (cancelled) return;
        const value = state.profile
          ? parseCandidateJson(JSON.stringify(state.profile))
          : structuredClone(emptyCandidate);
        setProfile(value);
        setJobs(state.jobs);
        revisionRef.current = state.revision;
        savedRef.current = JSON.stringify({ profile: value, jobs: state.jobs });
        setHydrated(true);
      })
      .catch((error) => {
        if (!cancelled) setMessage("SQLite unavailable: " + String(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!hydrated || blockedRef.current || applicationId) return;
    const state = { profile, jobs };
    const signature = JSON.stringify(state);
    if (signature === savedRef.current) return;
    const timer = setTimeout(() => {
      saveQueueRef.current = saveQueueRef.current
        .then(async () => {
          if (blockedRef.current) return;
          const saved = await saveState({
            ...state,
            revision: revisionRef.current,
          });
          revisionRef.current = saved.revision;
          savedRef.current = signature;
        })
        .catch((error) => {
          blockedRef.current = true;
          setMessage(
            "SQLite save failed: " +
              String(error) +
              " Refresh to reload saved data.",
          );
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [hydrated, profile, jobs]);

  useEffect(() => {
    if (!applicationId || !hydrated || !activeLoaded || autoStarted.current)
      return;
    autoStarted.current = true;
    if (session) return;
    const job = jobs.find((item) => item.id === applicationId);
    if (job) void prepareJob(job);
    else
      setMessage(
        "Application not found. Return to the tracker and open the job again.",
      );
  }, [applicationId, hydrated, activeLoaded, jobs, session]);

  useEffect(() => {
    if (applicationId || !hydrated) return;
    const refresh = () => {
      if (JSON.stringify({ profile, jobs }) !== savedRef.current) return;
      void readState()
        .then((state) => {
          revisionRef.current = state.revision;
          const nextProfile = state.profile
            ? parseCandidateJson(JSON.stringify(state.profile))
            : structuredClone(emptyCandidate);
          savedRef.current = JSON.stringify({
            profile: nextProfile,
            jobs: state.jobs,
          });
          setProfile(nextProfile);
          setJobs(state.jobs);
        })
        .catch(() => {});
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [applicationId, hydrated, profile, jobs]);
  const errors = validateCandidate(profile);
  const filtered = jobs.filter((job) =>
    (job.company + " " + job.role).toLowerCase().includes(search.toLowerCase()),
  );

  function addJob(event: React.FormEvent) {
    event.preventDefault();
    try {
      const job = createApplication(newJob.company, newJob.role, newJob.url);
      if (
        jobs.some(
          (item) =>
            item.id === job.id ||
            (item.company === job.company &&
              item.role === job.role &&
              item.url === job.url),
        )
      ) {
        setMessage("This opportunity is already in your tracker.");
        return;
      }
      setJobs((items) => [job, ...items]);
      setNewJob({ company: "", role: "", url: "" });
      setMessage(
        "Job added. Select Apply on its row to start browser automation.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add job");
    }
  }
  function changeJob(id: string, status: ApplicationStatus) {
    if (applicationId)
      void requestApi("/api/jobs/" + id + "/status", { status }).catch(
        (error) => setMessage(String(error)),
      );
    setJobs((items) =>
      items.map((item) => (item.id === id ? { ...item, status } : item)),
    );
  }
  async function exportResumePdf() {
    try {
      const missing = validateCandidate(profile);
      if (missing.length)
        throw new Error(
          "Complete contact information first: " + missing.join(", "),
        );
      // Revalidate the entire user-supplied JSON before producing a document.
      const valid = parseCandidateJson(JSON.stringify(profile));
      const { base64 } = await requestApi<{ base64: string }>(
        "/api/resume/pdf",
        valid,
      );
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const name = [profile.contact.firstName, profile.contact.lastName]
        .filter(Boolean)
        .join("-");
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        (name || "resume").replace(/[^a-z0-9-]/gi, "_") + ".pdf";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(
        "Generated a selectable-text résumé PDF from structured JSON. Review the PDF before submitting.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "PDF export failed.");
    }
  }
  async function importProfile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setProfile(parseCandidateJson(await file.text()));
      setMessage("Profile imported from JSON.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Invalid JSON profile",
      );
    } finally {
      event.target.value = "";
    }
  }
  function chooseResume(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (
      file &&
      (!/\.(pdf|docx)$/i.test(file.name) || file.size > 10 * 1024 * 1024)
    ) {
      setMessage("Choose a PDF or DOCX resume of 10 MB or less.");
      return;
    }
    setResume(file);
    setProfile((value) => ({
      ...value,
      source: { fileName: file?.name ?? "" },
    }));
    setMessage(
      file ? "Resume selected. Click Parse resume to extract fields." : "",
    );
  }

  async function parseResume() {
    if (!resume) {
      setMessage("Choose a PDF or DOCX resume first.");
      setTab("parser");
      return;
    }
    setParseBusy(true);
    setMessage("");
    try {
      const upload = await filePayload(resume);
      const result = await requestApi<{
        profile: CandidateProfile;
        preview: string;
        warnings: string[];
      }>("/api/resume/parse", upload);
      setProfile(result.profile);
      setParsePreview(result.preview);
      setMessage(
        "Resume parsed. Review and correct extracted information in Candidate profile.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Resume parse failed",
      );
    } finally {
      setParseBusy(false);
    }
  }
  async function prepareJob(job: JobApplication) {
    if (!applicationId) {
      const url = new URL(window.location.href);
      url.search = "";
      url.searchParams.set("application", job.id);
      window.open(url.href, "application-" + job.id);
      return;
    }
    if (session) return;
    if (!job.url) {
      setMessage("Add a job URL before applying.");
      return;
    }
    if (errors.length) {
      setMessage(
        "Complete first name, last name and email in Candidate profile before applying.",
      );
      setTab("profile");
      return;
    }
    setApplyBusy(true);
    setMessage(
      "Preparing structured résumé JSON and PDF attachment for browser review...",
    );
    try {
      // The JSON drives autofill. The application also needs a PDF attachment.
      // Reuse the user's uploaded PDF when available; otherwise create one from JSON.
      const validProfile = parseCandidateJson(JSON.stringify(profile));
      const uploadedPdf = resume && /\.pdf$/i.test(resume.name) ? resume : null;
      const generated = uploadedPdf
        ? null
        : await requestApi<{ base64: string }>("/api/resume/pdf", validProfile);
      const attachment =
        uploadedPdf ||
        new File(
          [
            Uint8Array.from(atob(generated!.base64), (char) =>
              char.charCodeAt(0),
            ),
          ],
          (
            [validProfile.contact.firstName, validProfile.contact.lastName]
              .filter(Boolean)
              .join("-") || "resume"
          ).replace(/[^a-z0-9-]/gi, "_") + ".pdf",
          { type: "application/pdf" },
        );
      const upload = await filePayload(attachment);
      const result = await requestApi<ApplySession>("/api/apply/prepare", {
        jobUrl: job.url,
        jobId: job.id,
        profile: validProfile,
        resume: upload,
      });
      setSession(result);
      setReviewed(false);
      setQuestionAnswers({});
      changeJob(
        job.id,
        result.state === "ready_for_review"
          ? "ready_for_review"
          : "in_progress",
      );
      setMessage(result.message);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to prepare application",
      );
    } finally {
      setApplyBusy(false);
    }
  }
  async function fillCustomQuestions() {
    if (!session) return;
    setApplyBusy(true);
    try {
      const updated = await requestApi<ApplySession>(
        "/api/apply/" + session.id + "/answers",
        { answers: questionAnswers },
      );
      setSession(updated);
      setReviewed(false);
      setMessage(
        updated.answerResult?.unresolved.length
          ? "Could not resolve: " +
              updated.answerResult.unresolved.join(", ") +
              ". Please use the browser viewer."
          : updated.message,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to fill employer questions.",
      );
    } finally {
      setApplyBusy(false);
    }
  }
  async function continueAfterChallenge() {
    if (!session) return;
    setApplyBusy(true);
    try {
      const updated = await requestApi<ApplySession>(
        "/api/apply/" + session.id + "/continue",
        {},
      );
      setSession(updated);
      setReviewed(false);
      changeJob(
        updated.jobId,
        updated.state === "ready_for_review"
          ? "ready_for_review"
          : "in_progress",
      );
      setMessage(updated.message);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Challenge is not complete.",
      );
    } finally {
      setApplyBusy(false);
    }
  }
  async function finalizeApplication(submit: boolean) {
    if (!session) return;
    if (submit && session.reviewUrl && !reviewed) {
      setMessage(
        "Open the browser viewer and confirm you reviewed the application first.",
      );
      return;
    }
    if (
      submit &&
      !window.confirm(
        "Confirm final submission? Check every field in the opened browser first.",
      )
    )
      return;
    setApplyBusy(true);
    try {
      const result = await requestApi<ApplySession | { closed: boolean }>(
        "/api/apply/" + session.id + "/" + (submit ? "submit" : "close"),
        submit
          ? { confirm: true, reviewed: session.reviewUrl ? reviewed : true }
          : {},
      );
      if (submit) {
        const next = result as ApplySession;
        setSession(next);
        setMessage(next.message);
        changeJob(
          session.jobId,
          next.state === "submitted" ? "submitted" : "in_progress",
        );
      } else {
        setSession(null);
        setMessage("Browser session closed.");
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Browser action failed",
      );
    } finally {
      setApplyBusy(false);
    }
  }

  return {
    applicationId,
    activeLoaded,
    setActiveLoaded,
    autoStarted,
    tab,
    setTab,
    profile,
    setProfile,
    jobs,
    setJobs,
    hydrated,
    setHydrated,
    revisionRef,
    savedRef,
    saveQueueRef,
    blockedRef,
    newJob,
    setNewJob,
    search,
    setSearch,
    message,
    setMessage,
    importRef,
    resumeRef,
    resume,
    setResume,
    parseBusy,
    setParseBusy,
    applyBusy,
    setApplyBusy,
    parsePreview,
    setParsePreview,
    session,
    setSession,
    reviewed,
    setReviewed,
    questionAnswers,
    setQuestionAnswers,
    notesJobId,
    setNotesJobId,
    errors,
    filtered,
    addJob,
    changeJob,
    exportResumePdf,
    importProfile,
    chooseResume,
    parseResume,
    prepareJob,
    fillCustomQuestions,
    continueAfterChallenge,
    finalizeApplication,
  };
}
export type ApplicationController = ReturnType<typeof useApplication>;
