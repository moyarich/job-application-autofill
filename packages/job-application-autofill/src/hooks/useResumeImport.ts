import { useState, useRef } from "react";
import { Resume } from "@moyarich/resume";
import { ContactChoice } from "../types/api-types";

import { createOfferImport } from "../utils/resumes/offerImport";
import { createApplyImportedContent } from "../utils/resumes/applyImportedContent";
import { createConfirmImport } from "../utils/resumes/confirmImport";
import { createCancelImport } from "../utils/resumes/cancelImport";
import { createImportProfile } from "../utils/resumes/importProfile";
import { createChooseResume } from "../utils/resumes/chooseResume";
import { createParseResume } from "../utils/resumes/parseResume";

type ContactKey = keyof Resume["contact"];

import type { ResumeImportData } from "../types/resume-import-data";

export function useResumeImport(workspace: ResumeImportData) {
  const {
    profile,
    contactId,
    activeProfileId,
    activeResumeId,
    revisionRef,
    contactKeys,
    flushPending,
    setTab,
    setMessage,
    setProfile,
    setContactId,
  } = workspace;
  const { setContacts, setDefaultContactId } = workspace;
  const [pendingImport, setPendingImport] = useState<Resume | null>(null);
  const [importChoices, setImportChoices] = useState<
    Partial<Record<ContactKey, ContactChoice>>
  >({});
  const importRef = useRef<HTMLInputElement>(null);
  const resumeRef = useRef<HTMLInputElement>(null);
  const [resume, setResume] = useState<File | null>(null);
  const [parseBusy, setParseBusy] = useState(false);
  const [parsePreview, setParsePreview] = useState("");
  const conflictKeys = pendingImport
    ? contactKeys.filter(
        (key) =>
          (pendingImport.contact[key] || "").trim() !==
          (profile.contact[key] || "").trim(),
      )
    : [];
  const importContext = {
    revisionRef,
    profile,
    contactId,
    activeProfileId,
    activeResumeId,
    contactKeys,
    pendingImport,
    resume,
    flushPending,
    setTab,
    setMessage,
    setImportChoices,
    setPendingImport,
    setContactId,
    setProfile,
    setResume,
    setContacts,
    setDefaultContactId,
    setParseBusy,
    setParsePreview,
  };
  const applyImportedContent = createApplyImportedContent(importContext);
  const offerImport = createOfferImport({
    ...importContext,
    applyImportedContent,
  });
  const importProfile = createImportProfile({ ...importContext, offerImport });
  const chooseResume = createChooseResume(importContext);
  const parseResume = createParseResume({ ...importContext, offerImport });
  const confirmImport = createConfirmImport({
    ...importContext,
    applyImportedContent,
  });
  const cancelImport = createCancelImport(importContext);

  return {
    pendingImport,
    importChoices,
    setImportChoices,
    conflictKeys,
    importRef,
    resumeRef,
    resume,
    setResume,
    parseBusy,
    setParseBusy,
    parsePreview,
    setParsePreview,
    importProfile,
    chooseResume,
    parseResume,
    confirmImport,
    cancelImport,
  };
}
