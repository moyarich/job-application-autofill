import type React from "react";
import type { Dispatch, SetStateAction } from "react";
import { parseCandidateJson, type CandidateProfile } from "../../index";
import { requestApi, resolveImportedContact, type ContactChoice, type ProfileContact } from "../api/client";
import { filePayload } from "../files/resume-files";
type Update<T> = Dispatch<SetStateAction<T>>;
type Contact = CandidateProfile["contact"];
type ContactKey = keyof Contact;
export type ResumeImportActionsContext = {
  profile: CandidateProfile;
  contactId: string | null;
  activeProfileId: string;
  activeResumeId: string | null;
  contactKeys: ContactKey[];
  pendingImport: CandidateProfile | null;
  resume: File | null;
  flushPending: () => Promise<void>;
  setTab: (next: "parser") => void;
  setMessage: Update<string>;
  setImportChoices: Update<Partial<Record<ContactKey, ContactChoice>>>;
  setPendingImport: Update<CandidateProfile | null>;
  setContactId: Update<string | null>;
  setProfile: Update<CandidateProfile>;
  setResume: Update<File | null>;
  setContacts: Update<ProfileContact[]>;
  setDefaultContactId: Update<string | null>;
  setParseBusy: Update<boolean>;
  setParsePreview: Update<string>;
};
/** Resume import operations, with state owned by the application hook. */
export function createResumeImportActions({
  profile, contactId, activeProfileId, activeResumeId, contactKeys,
  pendingImport, resume, flushPending, setTab, setMessage,
  setImportChoices, setPendingImport, setContactId, setProfile,
  setResume, setContacts, setDefaultContactId, setParseBusy, setParsePreview,
}: ResumeImportActionsContext) {
  // Contact imports are reviewed before any database writes occur.
  function offerImport(incoming: CandidateProfile) {
    setImportChoices({});
    if (
      contactKeys.some(
        (key) =>
          (incoming.contact[key] || "").trim() !==
          (profile.contact[key] || "").trim(),
      )
    ) {
      setPendingImport(incoming);
      setMessage("Contact details extracted. Review them before importing.");
    } else applyImportedContent(incoming, contactId, incoming.contact);
  }
  function applyImportedContent(
    incoming: CandidateProfile,
    selectedId: string | null,
    resolved: Contact,
  ) {
    setContactId(selectedId);
    setProfile({ ...incoming, contact: resolved });
    setPendingImport(null);
    setImportChoices({});
    setResume(null);
    setMessage("Resume imported with its selected contact record.");
  }
  async function confirmImport(strategy: ContactChoice = "resume") {
    if (!pendingImport || !activeResumeId) return;
    try {
      await flushPending();
      const choices = Object.fromEntries(
        contactKeys.map((key) => [key, strategy]),
      ) as Partial<Record<ContactKey, ContactChoice>>;
      const result = await resolveImportedContact(
        activeProfileId,
        activeResumeId,
        pendingImport.contact,
        choices,
      );
      setContacts(result.contacts);
      if (result.contacts.some((item) => item.isDefault)) {
        setDefaultContactId(result.contacts.find((item) => item.isDefault)!.id);
      }
      applyImportedContent(pendingImport, result.contactId, result.contact);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not import resume.",
      );
    }
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
      }>(
        "/api/resume/parse",
        upload,
        activeProfileId,
        activeResumeId ?? undefined,
      );
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

  return { importProfile, chooseResume, parseResume, confirmImport, cancelImport };
}
