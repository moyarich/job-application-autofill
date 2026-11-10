import type {
  ResumeImportActionsContext,
  ApplyImportedContent,
} from "./import-context";
import {
  createResumeVersion,
  deleteResumeVersion,
  resolveImportedContact,
  saveResumeContent,
} from "../api/client";
import { routes } from "../../routes";
import { defaultImportedResumeName } from "./importedResumeName";
import type { ContactChoice } from "../api/client";
import type { ContactKey } from "./import-context";

export function createConfirmImport(
  context: ResumeImportActionsContext & {
    applyImportedContent: ApplyImportedContent;
  },
) {
  const {
    activeProfileId,
    activeResumeId,
    contactKeys,
    pendingImport,
    flushPending,
    setMessage,
    setContacts,
    setDefaultContactId,
    applyImportedContent,
  } = context;
  async function confirmImport(strategy: ContactChoice = "resume") {
    if (!pendingImport) return;
    let newResumeId: string | null = null;
    try {
      if (!activeResumeId) {
        const created = await createResumeVersion(
          activeProfileId,
          defaultImportedResumeName(pendingImport),
        );
        newResumeId = created.id;
      } else {
        await flushPending();
      }
      const choices = Object.fromEntries(
        contactKeys.map((key) => [key, strategy]),
      ) as Partial<Record<ContactKey, ContactChoice>>;
      const result = await resolveImportedContact(
        activeProfileId,
        activeResumeId ?? newResumeId!,
        pendingImport.contact,
        choices,
      );
      setContacts(result.contacts);
      if (result.contacts.some((item) => item.isDefault)) {
        setDefaultContactId(result.contacts.find((item) => item.isDefault)!.id);
      }
      if (newResumeId) {
        await saveResumeContent(activeProfileId, newResumeId, {
          revision: 0,
          profile: { ...pendingImport, contact: result.contact },
          contactId: result.contactId,
        });
        const url = new URL(window.location.href);
        url.pathname = routes.resumes;
        url.search = "";
        url.searchParams.set("profile", activeProfileId);
        url.searchParams.set("resume", newResumeId);
        window.location.assign(url.href);
        return;
      }
      applyImportedContent(pendingImport, result.contactId, result.contact);
    } catch (error) {
      if (newResumeId) {
        try {
          await deleteResumeVersion(activeProfileId, newResumeId);
        } catch {
          /* Preserve original error. */
        }
      }
      setMessage(
        error instanceof Error ? error.message : "Could not import resume.",
      );
    }
  }
  return confirmImport;
}
