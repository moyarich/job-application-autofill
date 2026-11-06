import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
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
import {
  requestApi, readState, saveState, readProfiles, createLocalProfile,
  renameLocalProfile, deleteLocalProfile, createResumeVersion, renameResumeVersion,
  deleteResumeVersion, DEFAULT_PROFILE_ID, ACTIVE_PROFILE_STORAGE_KEY,
  resolveImportedContact, chooseDefaultContact,
  type LocalProfile, type ResumeVersion, type ProfileContact, type ContactChoice,
} from "../api/client";
import { filePayload } from "../files/resume-files";
export function useApplication() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const query = new URLSearchParams(location.search);
  const applicationId = params.applicationId ?? null;
  const activeProfileId = query.get("profile") || localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) || DEFAULT_PROFILE_ID;
  const requestedResumeId = query.get("resume") || undefined;
  const [profiles, setProfiles] = useState<LocalProfile[]>([]);
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>([]);
  const [activeResumeId, setActiveResumeId] = useState<string | null>(requestedResumeId ?? null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeLoaded, setActiveLoaded] = useState(!applicationId);
  const autoStarted = useRef(false);
  const tab = location.pathname === "/profile" ? "profile" :
    location.pathname === "/import" ? "parser" : "applications";
  function setTab(next: "applications" | "profile" | "parser") {
    navigate({ pathname: next === "parser" ? "/import" : "/" + next, search: location.search });
  }
  const [profile, setProfile] = useState<CandidateProfile>(() =>
    structuredClone(emptyCandidate),
  );
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  type Contact = CandidateProfile["contact"];
  type ContactKey = keyof Contact;
  const [contacts, setContacts] = useState<ProfileContact[]>([]);
  const [contactId, setContactId] = useState<string>("");
  const [defaultContactId, setDefaultContactId] = useState<string>("");
  const [pendingImport, setPendingImport] = useState<CandidateProfile | null>(null);
  const [importChoices, setImportChoices] = useState<Partial<Record<ContactKey,ContactChoice>>>({});
  const contactKeys = Object.keys(emptyCandidate.contact) as ContactKey[];
  const conflictKeys = pendingImport ? contactKeys.filter(key =>
    pendingImport.contact[key].trim() !== profile.contact[key].trim()) : [];
  const selectedContact = contacts.find(item => item.id === contactId);
  const defaultContact = contacts.find(item => item.id === defaultContactId);
  function editContact(key: ContactKey, value: string) {
    setProfile(previous => ({ ...previous, contact: { ...previous.contact, [key]: value } }));
    setContacts(previous => previous.map(item => item.id === contactId ? {...item,[key]:value} : item));
  }
  function chooseContact(id: string) {
    const selected = contacts.find(item => item.id === id);
    if (!selected) return;
    setContactId(id);
    const contact = Object.fromEntries(contactKeys.map(key => [key,selected[key]])) as Contact;
    setProfile(previous => ({ ...previous,contact }));
  }
  async function markDefaultContact() {
    try {
      await flushPending();
      const changed = await chooseDefaultContact(activeProfileId,contactId);
      setContacts(previous => previous.map(item => ({...item,isDefault:item.id === changed.id})));
      setDefaultContactId(changed.id);
      setMessage("Default contact updated for new resumes.");
    } catch (error) { setMessage(String(error)); }
  }
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
      headers: { "X-Moya-Client": "dashboard", "X-Profile-Id": activeProfileId },
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
    Promise.all([readProfiles(), readState(activeProfileId, requestedResumeId)])
      .then(([available, state]) => {
        if (!available.profiles.some(item => item.id === activeProfileId))
          throw new Error("The selected local profile does not exist.");
        setProfiles(available.profiles);
        setResumeVersions(state.resumes);
        setActiveResumeId(state.resumeId);
        localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, activeProfileId);
        if (cancelled) return;
        const value = state.profile
          ? parseCandidateJson(JSON.stringify(state.profile))
          : { ...structuredClone(emptyCandidate), contact: state.contact ?? structuredClone(emptyCandidate.contact) };
        setProfile(value);
        setContacts(state.contacts);
        setContactId(state.contactId);
        setDefaultContactId(state.defaultContactId);
        setJobs(state.jobs);
        revisionRef.current = state.revision;
        savedRef.current = JSON.stringify({ profile: value, contact: value.contact, contactId: state.contactId, jobs: state.jobs });
        setHydrated(true);
      })
      .catch((error) => {
        if (!cancelled) setMessage("We couldn’t load your saved information. Check the connection and try again. " + String(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!hydrated || blockedRef.current || applicationId) return;
    const state = { profile, contact: profile.contact, contactId, jobs };
    const signature = JSON.stringify(state);
    if (signature === savedRef.current) return;
    const timer = setTimeout(() => {
      saveQueueRef.current = saveQueueRef.current
        .then(async () => {
          if (blockedRef.current) return;
          const saved = await saveState({
            ...state,
            revision: revisionRef.current,
          }, activeProfileId, activeResumeId!);
          revisionRef.current = saved.revision;
          savedRef.current = signature;
        })
        .catch((error) => {
          blockedRef.current = true;
          setMessage(
            "Your changes could not be saved: " +
              String(error) +
              " Reload to restore your last saved changes.",
          );
        });
    }, 350);
    saveTimerRef.current = timer;
    return () => clearTimeout(timer);
  }, [hydrated, profile, contactId, jobs, activeProfileId, activeResumeId]);

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
      if (JSON.stringify({ profile, contact: profile.contact, contactId, jobs }) !== savedRef.current) return;
      void readState(activeProfileId, activeResumeId ?? undefined)
        .then((state) => {
          revisionRef.current = state.revision;
          const nextProfile = state.profile
            ? parseCandidateJson(JSON.stringify(state.profile))
            : { ...structuredClone(emptyCandidate), contact: state.contact ?? structuredClone(emptyCandidate.contact) };
          savedRef.current = JSON.stringify({
            profile: nextProfile,
            contact: nextProfile.contact,
            contactId: state.contactId,
            jobs: state.jobs,
          });
          setContacts(state.contacts);
          setContactId(state.contactId);
          setDefaultContactId(state.defaultContactId);
          setProfile(nextProfile);
          setJobs(state.jobs);
        })
        .catch(() => {});
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [applicationId, hydrated, profile, contactId, jobs, activeProfileId, activeResumeId]);
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
      void requestApi("/api/jobs/" + id + "/status", { status }, activeProfileId, activeResumeId ?? undefined).catch(
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
        valid, activeProfileId, activeResumeId ?? undefined,
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
        "Your resume PDF is ready. Review it before submitting.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "PDF export failed.");
    }
  }
  // Contact imports are reviewed before any database writes occur.
  function offerImport(incoming: CandidateProfile) {
    setImportChoices({});
    if (contactKeys.some(key => incoming.contact[key].trim() !== profile.contact[key].trim())) {
      setPendingImport(incoming);
      setMessage("Review contact differences before importing this resume.");
    } else applyImportedContent(incoming,contactId,incoming.contact);
  }
  function applyImportedContent(incoming: CandidateProfile, selectedId: string, resolved: Contact) {
    setContactId(selectedId);
    setProfile({...incoming,contact:resolved});
    setPendingImport(null);
    setImportChoices({});
    setResume(null);
    setMessage("Resume imported with its selected contact record.");
  }
  async function confirmImport() {
    if (!pendingImport || !activeResumeId) return;
    try {
      await flushPending();
      const result = await resolveImportedContact(activeProfileId,activeResumeId,
        pendingImport.contact,importChoices);
      setContacts(result.contacts);
      applyImportedContent(pendingImport,result.contactId,result.contact);
    } catch(error) { setMessage(error instanceof Error ? error.message : "Could not import resume."); }
  }
  function cancelImport() {
    setPendingImport(null);
    setImportChoices({});
    setMessage("Import cancelled. No information was changed.");
  }
  async function importProfile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      offerImport(parseCandidateJson(await file.text()));

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
      }>("/api/resume/parse", upload, activeProfileId, activeResumeId ?? undefined);
      offerImport(result.profile);
      setParsePreview(result.preview);

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
      url.pathname = "/apply/" + encodeURIComponent(job.id);
      url.search = "";
      url.searchParams.set("profile", activeProfileId);
      if (activeResumeId) url.searchParams.set("resume", activeResumeId);
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
      "Preparing structured resume JSON and PDF attachment for browser review...",
    );
    try {
      // The JSON drives autofill. The application also needs a PDF attachment.
      // Generate from resolved data, never attach an outdated imported PDF.
      const validProfile = parseCandidateJson(JSON.stringify(profile));
      const generated = await requestApi<{ base64: string }>("/api/resume/pdf", validProfile, activeProfileId, activeResumeId ?? undefined);
      const attachment = new File(
        [Uint8Array.from(atob(generated.base64), char => char.charCodeAt(0))],
        ([validProfile.contact.firstName, validProfile.contact.lastName].filter(Boolean).join("-") || "resume")
          .replace(/[^a-z0-9-]/gi, "_") + ".pdf",
        { type: "application/pdf" },
      );
      const upload = await filePayload(attachment);
      const result = await requestApi<ApplySession>("/api/apply/prepare", {
        jobUrl: job.url,
        jobId: job.id,
        profile: validProfile,
        resume: upload,
      }, activeProfileId, activeResumeId ?? undefined);
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
        { answers: questionAnswers }, activeProfileId, activeResumeId ?? undefined,
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
  async function prepareAccountSignUp(password?: string) {
    if (!session) return;
    setApplyBusy(true);
    try {
      const updated = await requestApi<ApplySession>(
        "/api/apply/" + session.id + "/account-signup",
        { ...(password ? { password } : {}) },
        activeProfileId, activeResumeId ?? undefined,
      );
      setSession(updated);
      setReviewed(false);
      setMessage(updated.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to prepare employer account.");
    } finally {
      setApplyBusy(false);
    }
  }
  async function setEmployerAccountStatus(status: "ready" | "setup_required") {
    if (!session?.employerAccount) return;
    setApplyBusy(true);
    try {
      const account = await requestApi<NonNullable<ApplySession["employerAccount"]>>(
        "/api/employer-accounts/status",
        { jobId: session.jobId, status },
        activeProfileId, activeResumeId ?? undefined,
      );
      setSession(current => current ? { ...current, employerAccount: account } : current);
      setMessage(status === "ready"
        ? "Account marked ready for this employer and local profile."
        : "Account signup required for this employer.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update employer account status.");
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
        {}, activeProfileId, activeResumeId ?? undefined,
      );
      setSession(current => ({
        ...updated,
        employerAccount: updated.employerAccount ?? current?.employerAccount,
        signupPrepared: updated.signupPrepared ?? current?.signupPrepared,
      }));
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
          : {}, activeProfileId, activeResumeId ?? undefined,
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
        setMessage("Application preview closed.");
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Browser action failed",
      );
    } finally {
      setApplyBusy(false);
    }
  }


  // Persist the source version before switching; pending debounce callbacks cannot
  // write into the destination profile because they capture explicit IDs.
  async function flushPending() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    await saveQueueRef.current;
    if (blockedRef.current) throw new Error("The current changes could not be saved. Resolve that error before switching.");
    const current = { profile, contact: profile.contact, contactId, jobs };
    const signature = JSON.stringify(current);
    if (signature !== savedRef.current) {
      const saved = await saveState({ ...current, revision: revisionRef.current }, activeProfileId, activeResumeId!);
      revisionRef.current = saved.revision;
      savedRef.current = signature;
    }
  }
  function navigateTo(nextPerson: string, nextResume?: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("profile", nextPerson);
    if (nextResume) url.searchParams.set("resume", nextResume);
    else url.searchParams.delete("resume");
    url.pathname = "/applications";
    window.location.assign(url.href);
  }
  async function switchProfile(next: string) {
    if (applicationId || applyBusy || session) return;
    if (next === activeProfileId) return;
    try {
      await flushPending();
      navigateTo(next);
    } catch (error) { setMessage(String(error)); }
  }
  async function switchResume(next: string) {
    if (applicationId || applyBusy || session || next === activeResumeId) return;
    try {
      await flushPending();
      navigateTo(activeProfileId, next);
    } catch (error) { setMessage(String(error)); }
  }
  async function createPerson() {
    const value = window.prompt("Name for the new local profile");
    if (!value) return;
    try {
      await flushPending();
      const result = await createLocalProfile(value);
      navigateTo(result.id);
    } catch (error) { setMessage(String(error)); }
  }
  async function renamePerson() {
    const value = window.prompt("Rename local profile", profiles.find(item => item.id === activeProfileId)?.name);
    if (!value) return;
    try {
      const result = await renameLocalProfile(activeProfileId, value);
      setProfiles(items => items.map(item => item.id === result.id ? result : item));
    } catch (error) { setMessage(String(error)); }
  }
  async function removePerson() {
    if (activeProfileId === DEFAULT_PROFILE_ID || !window.confirm("Permanently delete this person, all resume versions, and all saved applications?")) return;
    try {
      await deleteLocalProfile(activeProfileId);
      navigateTo(DEFAULT_PROFILE_ID);
    } catch (error) { setMessage(String(error)); }
  }
  async function createResume(copy = false) {
    const value = window.prompt(copy ? "Name for the copied resume" : "Name for the new resume version");
    if (!value) return;
    try {
      await flushPending();
      const result = await createResumeVersion(activeProfileId, value, copy ? activeResumeId ?? undefined : undefined);
      navigateTo(activeProfileId, result.id);
    } catch (error) { setMessage(String(error)); }
  }
  async function renameResume() {
    if (!activeResumeId) return;
    const value = window.prompt("Rename resume version", resumeVersions.find(item => item.id === activeResumeId)?.name);
    if (!value) return;
    try {
      const result = await renameResumeVersion(activeProfileId, activeResumeId, value);
      setResumeVersions(items => items.map(item => item.id === result.id ? result : item));
    } catch (error) { setMessage(String(error)); }
  }
  async function removeResume() {
    if (!activeResumeId || resumeVersions.length <= 1 || !window.confirm("Permanently delete this resume version?")) return;
    try {
      await deleteResumeVersion(activeProfileId, activeResumeId);
      const remaining = resumeVersions.find(item => item.id !== activeResumeId);
      navigateTo(activeProfileId, remaining?.id);
    } catch (error) { setMessage(String(error)); }
  }
  return {
    profiles, activeProfileId, resumeVersions, activeResumeId,
    switchProfile, switchResume, createPerson, renamePerson, removePerson,
    createResume, renameResume, removeResume,
    applicationId,
    activeLoaded,
    setActiveLoaded,
    autoStarted,
    tab,
    setTab,
    profile,
    setProfile,
    contacts,
    contactId,
    defaultContactId,
    selectedContact,
    defaultContact,
    editContact,
    chooseContact,
    markDefaultContact,
    pendingImport,
    importChoices,
    setImportChoices,
    conflictKeys,
    confirmImport,
    cancelImport,
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
    prepareAccountSignUp,
    setEmployerAccountStatus,
    finalizeApplication,
  };
}
export type ApplicationController = ReturnType<typeof useApplication>;
