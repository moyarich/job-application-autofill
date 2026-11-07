import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { tabForPath, tabRoutes, type WorkspaceTab } from "../routes";
import {
  emptyCandidate, parseCandidateJson, validateCandidate,
  type CandidateProfile, type JobApplication,
} from "../index";
import {
  readResumeContent,
  saveResumeContent,
  readJobs,
  saveJobs,
  readResumes,
  readContacts,
  updateProfileContact,
  readProfiles,
  DEFAULT_PROFILE_ID,
  ACTIVE_PROFILE_STORAGE_KEY,
  type LocalProfile,
  type ResumeVersion,
  type ProfileContact,
} from "../utils/api/client";
export function useStoredRecord() {
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
  const tab = tabForPath(location.pathname);
  function setTab(next: WorkspaceTab) {
    navigate({ pathname: tabRoutes[next], search: location.search });
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
  const contactKeys = Object.keys(emptyCandidate.contact) as ContactKey[];
  const selectedContact = contacts.find((item) => item.id === contactId);
  const defaultContact = contacts.find((item) => item.id === defaultContactId);
  const [hydrated, setHydrated] = useState(false);
  const revisionRef = useRef(0);
  const savedRef = useRef("");
  const savedJobsRef = useRef("");
  const savedContactRef = useRef("");
  const jobsRevisionRef = useRef(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const blockedRef = useRef(false);
  const [message, setMessage] = useState("");
  // Each route owns its own data instance; the server remains authoritative.
  useEffect(() => {
    let cancelled = false;
    readProfiles()
      .then(async (available) => {
        const selectedProfileId = available.profiles.some(
          (item) => item.id === activeProfileId,
        ) ? activeProfileId : available.defaultProfileId;
        const profileChanged = selectedProfileId !== activeProfileId;
        const resumes = await readResumes(selectedProfileId);
        const chosen = !profileChanged && requestedResumeId &&
          resumes.some((item) => item.id === requestedResumeId)
          ? requestedResumeId : resumes[0]?.id;
        if (!chosen) throw new Error("No resume exists for profile.");
        if (cancelled) return;
        if (profileChanged || (requestedResumeId && chosen !== requestedResumeId)) {
          localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, selectedProfileId);
          const next = new URLSearchParams(location.search);
          next.set("profile", selectedProfileId);
          next.set("resume", chosen);
          navigate({ pathname: location.pathname, search: next.toString() }, { replace: true });
          return;
        }
        const [resume, contacts, applications] = await Promise.all([
          readResumeContent(selectedProfileId, chosen),
          readContacts(selectedProfileId),
          readJobs(selectedProfileId),
        ]);
        return { available, resumes, resume, contacts, applications };
      })
      .then((result) => {
        if (!result || cancelled) return;
        const { available, resumes, resume, contacts, applications } = result;
        setProfiles(available.profiles);
        setResumeVersions(resumes);
        setActiveResumeId(resume.resumeId);
        localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, activeProfileId);
        const selectedContact = contacts.find((c) => c.id === resume.contactId);
        const contact = selectedContact ?? structuredClone(emptyCandidate.contact);
        const value = resume.profile
          ? parseCandidateJson(JSON.stringify(resume.profile))
          : { ...structuredClone(emptyCandidate), contact };
        setProfile(value);
        setContacts(contacts);
        setContactId(resume.contactId);
        setDefaultContactId(contacts.find((c) => c.isDefault)?.id ?? null);
        setJobs(applications.jobs);
        revisionRef.current = resume.revision;
        jobsRevisionRef.current = applications.revision;
        savedRef.current = JSON.stringify({ profile: value, contactId: resume.contactId });
        savedJobsRef.current = JSON.stringify(applications.jobs);
        savedContactRef.current = resume.contactId ? JSON.stringify(value.contact) : "";
        setHydrated(true);
      })
      .catch((error) => {
        if (!cancelled) setMessage(
          "We couldn’t load your saved information. Check the connection and try again. " +
          String(error),
        );
      });
    return () => { cancelled = true; };
  }, [activeProfileId, requestedResumeId]);

  async function persistChanges() {
    if (blockedRef.current || !activeResumeId) return;
    const resumeSignature = JSON.stringify({ profile, contactId });
    const jobsSignature = JSON.stringify(jobs);
    const contactSignature = contactId ? JSON.stringify(profile.contact) : "";

    // Contact records are updated only through the contact API, never a resume write.
    if (contactId && contactSignature !== savedContactRef.current) {
      const selected = contacts.find((item) => item.id === contactId);
      if (!selected) throw new Error("Selected contact no longer exists.");
      await updateProfileContact(activeProfileId, contactId, selected.name, profile.contact);
      savedContactRef.current = contactSignature;
    }
    if (resumeSignature !== savedRef.current) {
      const result = await saveResumeContent(activeProfileId, activeResumeId, {
        revision: revisionRef.current, profile, contactId,
      });
      revisionRef.current = result.revision;
      savedRef.current = resumeSignature;
    }
    if (jobsSignature !== savedJobsRef.current) {
      const result = await saveJobs(activeProfileId, {
        revision: jobsRevisionRef.current, jobs,
      });
      jobsRevisionRef.current = result.revision;
      savedJobsRef.current = jobsSignature;
    }
  }

  useEffect(() => {
    if (!hydrated || blockedRef.current || applicationId) return;
    if (JSON.stringify({ profile, contactId }) === savedRef.current &&
        JSON.stringify(jobs) === savedJobsRef.current &&
        (!contactId || JSON.stringify(profile.contact) === savedContactRef.current))
      return;
    const timer = setTimeout(() => {
      saveQueueRef.current = saveQueueRef.current.then(persistChanges)
        .catch((error) => {
          blockedRef.current = true;
          setMessage(
            "Your changes could not be saved: " + String(error) +
            " Reload to restore your last saved changes.",
          );
        });
    }, 350);
    saveTimerRef.current = timer;
    return () => clearTimeout(timer);
  }, [hydrated, profile, contactId, contacts, jobs, activeProfileId, activeResumeId, applicationId]);

  useEffect(() => {
    if (applicationId || !hydrated) return;
    const refresh = () => {
      if (JSON.stringify({ profile, contactId }) !== savedRef.current ||
          JSON.stringify(jobs) !== savedJobsRef.current ||
          (contactId && JSON.stringify(profile.contact) !== savedContactRef.current))
        return;
      void Promise.all([
        readResumeContent(activeProfileId, activeResumeId!),
        readContacts(activeProfileId),
        readJobs(activeProfileId),
      ]).then(([resume, contacts, applications]) => {
        const contact = contacts.find((item) => item.id === resume.contactId);
        const value = resume.profile
          ? parseCandidateJson(JSON.stringify(resume.profile))
          : { ...structuredClone(emptyCandidate),
              contact: contact ?? structuredClone(emptyCandidate.contact) };
        revisionRef.current = resume.revision;
        jobsRevisionRef.current = applications.revision;
        savedRef.current = JSON.stringify({ profile: value, contactId: resume.contactId });
        savedJobsRef.current = JSON.stringify(applications.jobs);
        savedContactRef.current = resume.contactId ? JSON.stringify(value.contact) : "";
        setContacts(contacts);
        setContactId(resume.contactId);
        setDefaultContactId(contacts.find((item) => item.isDefault)?.id ?? null);
        setProfile(value);
        setJobs(applications.jobs);
      }).catch(() => {});
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [applicationId, hydrated, profile, contactId, jobs, activeProfileId, activeResumeId]);

  const errors = validateCandidate(profile);
  // Persist the source version before switching; pending debounce callbacks cannot
  // write into the destination profile because they capture explicit IDs.
  async function flushPending() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    await saveQueueRef.current;
    if (blockedRef.current) throw new Error(
      "The current changes could not be saved. Resolve that error before switching.",
    );
    try {
      await persistChanges();
    } catch (error) {
      blockedRef.current = true;
      throw error;
    }
  }

  return {
    applicationId, tab, setTab, activeProfileId, activeResumeId,
    profiles, setProfiles, resumeVersions, setResumeVersions,
    profile, setProfile, jobs, setJobs,
    contacts, setContacts, contactId, setContactId,
    defaultContactId, setDefaultContactId, contactKeys,
    selectedContact, defaultContact, hydrated, message, setMessage,
    revisionRef, jobsRevisionRef, savedRef, savedJobsRef, saveQueueRef, blockedRef,
    errors, flushPending,
  };
}
