import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { tabForPath, tabRoutes, type WorkspaceTab } from "../routes";
import {
  emptyCandidate,
  parseCandidateJson,
  validateCandidate,
  type CandidateProfile,
  type JobApplication,
} from "../index";
import {
  requestApi,
  readState,
  saveState,
  readProfiles,
  DEFAULT_PROFILE_ID,
  ACTIVE_PROFILE_STORAGE_KEY,
  chooseDefaultContact,
  addProfileContact,
  type LocalProfile,
  type ResumeVersion,
  type ProfileContact,
} from "../utils/api/client";
import { createSwitchProfile } from "../utils/resumes/switchProfile";
import { createSwitchResume } from "../utils/resumes/switchResume";
import { createCreatePerson } from "../utils/resumes/createPerson";
import { createRenamePerson } from "../utils/resumes/renamePerson";
import { createRemovePerson } from "../utils/resumes/removePerson";
import { createExportResumeVersion } from "../utils/resumes/exportResumeVersion";
import { createOpenResume } from "../utils/resumes/openResume";
import { createCreateResume } from "../utils/resumes/createResume";
import { createRenameResume } from "../utils/resumes/renameResume";
import { createRemoveResume } from "../utils/resumes/removeResume";
export function useWorkspace() {
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
  const [message, setMessage] = useState("");
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
  const libraryContext = {
    applicationId, applyBusy: false, sessionActive: false,
    activeProfileId, activeResumeId, pathname: location.pathname,
    profile, profiles, resumeVersions, flushPending, setMessage,
    setProfiles, setResumeVersions,
  };
  const switchProfile = createSwitchProfile(libraryContext);
  const switchResume = createSwitchResume(libraryContext);
  const createPerson = createCreatePerson(libraryContext);
  const renamePerson = createRenamePerson(libraryContext);
  const removePerson = createRemovePerson(libraryContext);
  const exportResumeVersion = createExportResumeVersion(libraryContext);
  const openResume = createOpenResume(libraryContext);
  const createResume = createCreateResume(libraryContext);
  const renameResume = createRenameResume(libraryContext);
  const removeResume = createRemoveResume(libraryContext);
  return {
    applicationId, tab, setTab, activeProfileId, activeResumeId,
    profiles, resumeVersions, profile, setProfile, jobs, setJobs,
    contacts, setContacts, contactId, setContactId, defaultContactId, setDefaultContactId, selectedContact, defaultContact,
    editContact, chooseContact, markDefaultContact, saveContactRecord,
    hydrated, revisionRef, savedRef, saveQueueRef, blockedRef,
    message, setMessage, errors, contactKeys, flushPending,
    switchProfile, switchResume, createPerson, renamePerson, removePerson,
    createResume, renameResume, removeResume, openResume, exportResumeVersion,
    exportResumePdf,
  };
}
