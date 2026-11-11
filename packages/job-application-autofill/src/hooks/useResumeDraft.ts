import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { usePendingSave } from "./PendingSaves";
import { Resume } from "@moyarich/resume";
import { parseResumeJson } from "@moyarich/resume/validate";
import { validateResume } from "../utils/resumes/validateResume";

import { ProfileContact } from "../types/api-types";
import { readResumeContent, saveResumeContent } from "../api/client";

import { EMPTY_CANDIDATE } from "../constants";
interface ResumeDraft {
  profileId: string;
  resumeId: string | null;
  enabled: boolean;
  contacts: ProfileContact[];
  setMessage: Dispatch<SetStateAction<string>>;
  applicationId: string | null;
}

/** Owns the selected resume's draft, revision and autosave; never writes contacts or jobs. */
export function useResumeDraft({
  profileId,
  resumeId,
  enabled,
  contacts,
  setMessage,
  applicationId,
}: ResumeDraft) {
  const [profile, setProfile] = useState<Resume>(() =>
    structuredClone(EMPTY_CANDIDATE),
  );
  const [contactId, setContactId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const revisionRef = useRef(0);
  const savedRef = useRef("");
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const blockedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errors = validateResume(profile);

  useEffect(() => {
    setHydrated(false);
    if (!enabled || !resumeId) {
      setProfile(structuredClone(EMPTY_CANDIDATE));
      setContactId(null);
      revisionRef.current = 0;
      savedRef.current = "";
      blockedRef.current = false;
      return;
    }
    let cancelled = false;
    readResumeContent(profileId, resumeId)
      .then((result) => {
        if (cancelled) return;
        const linked = contacts.find((item) => item.id === result.contactId);
        const contact = linked
          ? (Object.fromEntries(
              Object.entries(linked).filter(
                ([key]) =>
                  !["id", "profileId", "name", "isDefault"].includes(key),
              ),
            ) as Resume["contact"])
          : structuredClone(EMPTY_CANDIDATE.contact);
        const value = result.profile
          ? parseResumeJson(JSON.stringify(result.profile))
          : { ...structuredClone(EMPTY_CANDIDATE), contact };
        setProfile(value);
        setContactId(result.contactId);
        revisionRef.current = result.revision;
        savedRef.current = JSON.stringify({
          profile: value,
          contactId: result.contactId,
        });
        blockedRef.current = false;
        setHydrated(true);
      })
      .catch((error) => {
        if (!cancelled)
          setMessage("Could not load resume content: " + String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [profileId, resumeId, enabled]);

  async function persistResume() {
    if (blockedRef.current || !resumeId) return;
    const signature = JSON.stringify({ profile, contactId });
    if (signature === savedRef.current) return;
    const result = await saveResumeContent(profileId, resumeId, {
      revision: revisionRef.current,
      profile,
      contactId,
    });
    revisionRef.current = result.revision;
    savedRef.current = signature;
  }

  useEffect(() => {
    if (!hydrated || applicationId || blockedRef.current) return;
    if (JSON.stringify({ profile, contactId }) === savedRef.current) return;
    const current = setTimeout(() => {
      saveQueueRef.current = saveQueueRef.current
        .then(persistResume)
        .catch((error) => {
          blockedRef.current = true;
          setMessage(
            "Your resume could not be saved: " +
              String(error) +
              " Reload to restore your last saved changes.",
          );
        });
    }, 350);
    saveTimerRef.current = current;
    return () => clearTimeout(current);
  }, [hydrated, profile, contactId, profileId, resumeId, applicationId]);

  async function flushResume() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    await saveQueueRef.current;
    if (blockedRef.current)
      throw new Error("The current resume changes could not be saved.");
    try {
      await persistResume();
    } catch (error) {
      blockedRef.current = true;
      throw error;
    }
  }

  usePendingSave(
    () =>
      hydrated &&
      !applicationId &&
      JSON.stringify({ profile, contactId }) !== savedRef.current,
    flushResume,
  );

  return {
    profile,
    setProfile,
    contactId,
    setContactId,
    errors,
    resumeHydrated: hydrated,
    revisionRef,
    savedRef,
    saveQueueRef,
    blockedRef,
    flushResume,
  };
}
