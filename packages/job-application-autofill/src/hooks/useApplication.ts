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
} from "../index";
import type { ApplySession } from "../utils/application/types";
import {
  requestApi,
  readState,
  saveState,
  readProfiles,
  createLocalProfile,
  renameLocalProfile,
  deleteLocalProfile,
  createResumeVersion,
  renameResumeVersion,
  deleteResumeVersion,
  DEFAULT_PROFILE_ID,
  ACTIVE_PROFILE_STORAGE_KEY,
  resolveImportedContact,
  chooseDefaultContact,
  addProfileContact,
  type LocalProfile,
  type ResumeVersion,
  type ProfileContact,
  type ContactChoice,
} from "../utils/api/client";
import { filePayload } from "../utils/files/resume-files";
import { createApplicationReviewActions } from "../utils/application/review-actions";
import { createResumeImportActions } from "../utils/resumes/import-actions";
import { createProfileResumeActions } from "../utils/resumes/library-actions";
export function useApplication() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const query = new URLSearchParams(location.search);
  const applicationId = params.applicationId ?? null;
  const activeProfileId =
    query.get("profile") ||
    localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) ||
    DEFAULT_PROFILE_ID;
  const requestedResumeId = query.get("resume") || undefined;
  const [profiles, setProfiles] = useState<LocalProfile[]>([]);
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>([]);
  const [activeResumeId, setActiveResumeId] = useState<string | null>(
    requestedResumeId ?? null,
  );
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeLoaded, setActiveLoaded] = useState(!applicationId);
  const autoStarted = useRef(false);
  const tab =
    location.pathname === "/resumes/edit"
      ? "profile"
      : location.pathname === "/resumes/view"
        ? "view"
        : location.pathname === "/resumes"
          ? "resumes"
          : location.pathname === "/profile"
            ? "personal"
            : location.pathname === "/resumes/import"
              ? "parser"
              : location.pathname === "/workspace"
                ? "workspace"
                : "applications";
  function setTab(
    next:
      | "applications"
      | "profile"
      | "personal"
      | "parser"
      | "workspace"
      | "resumes",
  ) {
    navigate({
      pathname:
        next === "parser"
          ? "/resumes/import"
          : next === "profile"
            ? "/resumes/edit"
            : next === "resumes"
              ? "/resumes"
              : next === "personal"
                ? "/profile"
                : "/" + next,
      search: location.search,
    });
  }
  const [profile, setProfile] = useState<CandidateProfile>(() =>
    structuredClone(emptyCandidate),
  );
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  type Contact = CandidateProfile["contact"];
  type ContactKey = keyof Contact;
  const [contacts, setContacts] = useState<ProfileContact[]>([]);
  const [contactId, setContactId] = useState<string | null>(null);
  const [defaultContactId, setDefaultContactId] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<CandidateProfile | null>(
    null,
  );
  const [importChoices, setImportChoices] = useState<
    Partial<Record<ContactKey, ContactChoice>>
  >({});
  const contactKeys = Object.keys(emptyCandidate.contact) as ContactKey[];
  const conflictKeys = pendingImport
    ? contactKeys.filter(
        (key) =>
          (pendingImport.contact[key] || "").trim() !==
          (profile.contact[key] || "").trim(),
      )
    : [];
  const selectedContact = contacts.find((item) => item.id === contactId);
  const defaultContact = contacts.find((item) => item.id === defaultContactId);
  function editContact(key: ContactKey, value: string) {
    setProfile((previous) => ({
      ...previous,
      contact: { ...previous.contact, [key]: value },
    }));
    setContacts((previous) =>
      previous.map((item) =>
        item.id === contactId ? { ...item, [key]: value } : item,
      ),
    );
  }
  function chooseContact(id: string) {
    if (!id) {
      setContactId(null);
      setMessage("Contact unlinked. This resume remains editable as a draft.");
      return;
    }
    const selected = contacts.find((item) => item.id === id);
    if (!selected) return;
    setContactId(id);
    const contact = Object.fromEntries(
      contactKeys.map((key) => [key, selected[key] || ""]),
    ) as Contact;
    setProfile((previous) => ({ ...previous, contact }));
  }
  async function saveContactRecord() {
    if (contactId) return;
    const missing = validateCandidate(profile);
    if (missing.length) {
      setMessage(
        "Complete the contact details before saving a contact record: " +
          missing.join(", "),
      );
      return;
    }
    try {
      await flushPending();
      const created = await addProfileContact(
        activeProfileId,
        "Primary contact",
        profile.contact,
      );
      setContacts((previous) => [...previous, created]);
      setContactId(created.id);
      if (created.isDefault) setDefaultContactId(created.id);
      setMessage("Contact saved and selected for this resume.");
    } catch (error) {
      setMessage(String(error));
    }
  }
  async function markDefaultContact() {
    if (!contactId) return;
    try {
      await flushPending();
      const changed = await chooseDefaultContact(activeProfileId, contactId);
      setContacts((previous) =>
        previous.map((item) => ({
          ...item,
          isDefault: item.id === changed.id,
        })),
      );
      setDefaultContactId(changed.id);
      setMessage("Default contact updated for new resumes.");
    } catch (error) {
      setMessage(String(error));
    }
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
    if (!applicationId || session?.state !== "preparing") return;
    let cancelled = false;
    const timer = setInterval(() => {
      fetch("/api/apply/" + session.id, {
        headers: {
          "X-Moya-Client": "dashboard",
          "X-Profile-Id": activeProfileId,
        },
      })
        .then((response) => {
          if (!response.ok)
            throw new Error(
              "Application session is unavailable. Reload to retry.",
            );
          return response.json();
        })
        .then((updated) => {
          if (!cancelled) setSession(updated);
        })
        .catch((error) => {
          if (!cancelled) setMessage(String(error));
        });
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [applicationId, session?.id, session?.state, activeProfileId]);
  useEffect(() => {
    let cancelled = false;
    if (!applicationId) return;
    fetch("/api/apply/active?jobId=" + encodeURIComponent(applicationId), {
      headers: {
        "X-Moya-Client": "dashboard",
        "X-Profile-Id": activeProfileId,
      },
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
    // The browser can retain a profile/resume ID after a fresh database is created.
    // Resolve the profile against the database before requesting its resume.
    readProfiles()
      .then(async (available) => {
        const selectedProfileId = available.profiles.some(
          (item) => item.id === activeProfileId,
        )
          ? activeProfileId
          : available.defaultProfileId;
        const profileChanged = selectedProfileId !== activeProfileId;
        const state = await readState(
          selectedProfileId,
          profileChanged ? undefined : requestedResumeId,
        ).catch(async (error) => {
          if (profileChanged || !requestedResumeId) throw error;
          return readState(selectedProfileId);
        });
        if (cancelled) return;
        if (
          profileChanged ||
          (requestedResumeId && state.resumeId !== requestedResumeId)
        ) {
          localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, selectedProfileId);
          const next = new URLSearchParams(location.search);
          next.set("profile", selectedProfileId);
          next.set("resume", state.resumeId);
          navigate(
            { pathname: location.pathname, search: next.toString() },
            { replace: true },
          );
          return;
        }
        return { available, state };
      })
      .then((result) => {
        if (!result || cancelled) return;
        const { available, state } = result;
        setProfiles(available.profiles);
        setResumeVersions(state.resumes);
        setActiveResumeId(state.resumeId);
        localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, activeProfileId);
        if (cancelled) return;
        const value = state.profile
          ? parseCandidateJson(JSON.stringify(state.profile))
          : {
              ...structuredClone(emptyCandidate),
              contact: state.contact ?? structuredClone(emptyCandidate.contact),
            };
        setProfile(value);
        setContacts(state.contacts);
        setContactId(state.contactId);
        setDefaultContactId(state.defaultContactId);
        setJobs(state.jobs);
        revisionRef.current = state.revision;
        savedRef.current = JSON.stringify({
          profile: value,
          contact: value.contact,
          contactId: state.contactId,
          jobs: state.jobs,
        });
        setHydrated(true);
      })
      .catch((error) => {
        if (!cancelled)
          setMessage(
            "We couldn’t load your saved information. Check the connection and try again. " +
              String(error),
          );
      });
    return () => {
      cancelled = true;
    };
  }, [activeProfileId, requestedResumeId]);
  useEffect(() => {
    if (!hydrated || blockedRef.current || applicationId) return;
    const state = { profile, contact: profile.contact, contactId, jobs };
    const signature = JSON.stringify(state);
    if (signature === savedRef.current) return;
    const timer = setTimeout(() => {
      saveQueueRef.current = saveQueueRef.current
        .then(async () => {
          if (blockedRef.current) return;
          const saved = await saveState(
            {
              ...state,
              revision: revisionRef.current,
            },
            activeProfileId,
            activeResumeId!,
          );
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
      if (
        JSON.stringify({
          profile,
          contact: profile.contact,
          contactId,
          jobs,
        }) !== savedRef.current
      )
        return;
      void readState(activeProfileId, activeResumeId ?? undefined)
        .then((state) => {
          revisionRef.current = state.revision;
          const nextProfile = state.profile
            ? parseCandidateJson(JSON.stringify(state.profile))
            : {
                ...structuredClone(emptyCandidate),
                contact:
                  state.contact ?? structuredClone(emptyCandidate.contact),
              };
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
  }, [
    applicationId,
    hydrated,
    profile,
    contactId,
    jobs,
    activeProfileId,
    activeResumeId,
  ]);
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
      void requestApi(
        "/api/jobs/" + id + "/status",
        { status },
        activeProfileId,
        activeResumeId ?? undefined,
      ).catch((error) => setMessage(String(error)));
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
        activeProfileId,
        activeResumeId ?? undefined,
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
      setMessage("Your resume PDF is ready. Review it before submitting.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "PDF export failed.");
    }
  }
  const { importProfile, chooseResume, parseResume, confirmImport, cancelImport } =
    createResumeImportActions({
      profile, contactId, activeProfileId, activeResumeId, contactKeys,
      pendingImport, resume, flushPending, setTab, setMessage,
      setImportChoices, setPendingImport, setContactId, setProfile,
      setResume, setContacts, setDefaultContactId, setParseBusy, setParsePreview,
    });

  const { prepareJob, fillCustomQuestions, continueAfterChallenge,
    prepareAccountSignUp, setEmployerAccountStatus, finalizeApplication } =
    createApplicationReviewActions({
      applicationId, activeProfileId, activeResumeId, profile, contactId,
      errors, session, reviewed, questionAnswers, setTab, changeJob,
      setMessage, setApplyBusy, setSession, setReviewed, setQuestionAnswers,
    });

  // Persist the source version before switching; pending debounce callbacks cannot
  // write into the destination profile because they capture explicit IDs.
  async function flushPending() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    await saveQueueRef.current;
    if (blockedRef.current)
      throw new Error(
        "The current changes could not be saved. Resolve that error before switching.",
      );
    const current = { profile, contact: profile.contact, contactId, jobs };
    const signature = JSON.stringify(current);
    if (signature !== savedRef.current) {
      const saved = await saveState(
        { ...current, revision: revisionRef.current },
        activeProfileId,
        activeResumeId!,
      );
      revisionRef.current = saved.revision;
      savedRef.current = signature;
    }
  }
  const { switchProfile, switchResume, createPerson, renamePerson,
    removePerson, createResume, renameResume, removeResume,
    openResume, exportResumeVersion } = createProfileResumeActions({
      applicationId, applyBusy, sessionActive: Boolean(session),
      activeProfileId, activeResumeId, pathname: location.pathname,
      profile, profiles, resumeVersions, flushPending, setMessage,
      setProfiles, setResumeVersions,
    });
  return {
    profiles,
    activeProfileId,
    resumeVersions,
    activeResumeId,
    switchProfile,
    switchResume,
    createPerson,
    renamePerson,
    removePerson,
    createResume,
    renameResume,
    removeResume,
    openResume,
    exportResumeVersion,
    flushPending,
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
    saveContactRecord,
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
