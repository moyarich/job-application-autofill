import { useState, type FormEvent } from "react";
import { createResumeVersion } from "../../utils/api/client";
import { navigateTo } from "../../utils/resumes/navigateTo";
import { routes } from "../../routes";
import { ResumeParser } from "../../components/ResumeParser/ResumeParser";
import { WorkspaceHeader } from "../../components/WorkspaceHeader/WorkspaceHeader";
import { useProfileSelection } from "../../hooks/useProfileSelection";
import { useProfileContacts } from "../../hooks/useProfileContacts";
import { useResumeDraft } from "../../hooks/useResumeDraft";
import { contactKeys } from "../../utils/contacts/contact-context";
import { PageStatus } from "../../components/PageStatus/PageStatus";
import { useResumeImport } from "../../hooks/useResumeImport";
import { createExportResumePdf } from "../../utils/resumes/exportResumePdf";
import { ContactImportReview } from "../../components/ContactImportReview/ContactImportReview";

export function PageResumeImport() {
  const selection = useProfileSelection();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  async function startImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating || !name.trim()) return;
    setCreating(true);
    try {
      const created = await createResumeVersion(selection.activeProfileId, name.trim());
      navigateTo(selection.activeProfileId, created.id, routes.resumeImport);
    } catch (error) {
      selection.setMessage(error instanceof Error ? error.message : "Could not create resume.");
    } finally {
      setCreating(false);
    }
  }
  const contacts = useProfileContacts({
    profileId: selection.activeProfileId,
    enabled: selection.hydrated,
    setMessage: selection.setMessage,
  });
  const draft = useResumeDraft({
    profileId: selection.activeProfileId,
    resumeId: selection.activeResumeId,
    enabled: selection.hydrated && contacts.contactsHydrated,
    contacts: contacts.contacts,
    setMessage: selection.setMessage,
    applicationId: selection.applicationId,
  });
  const ready =
    selection.hydrated && contacts.contactsHydrated &&
    (!selection.activeResumeId || draft.resumeHydrated);
  const flushPending = async () => {
    await draft.flushResume();
    await contacts.flushContacts();
  };
  const record = {
    ...selection,
    ...contacts,
    ...draft,
    contactKeys,
    flushPending,
    hydrated: ready,
    selectedContact: contacts.contacts.find(
      (item) => item.id === draft.contactId,
    ),
    defaultContact: contacts.contacts.find(
      (item) => item.id === contacts.defaultContactId,
    ),
  };
  const importing = useResumeImport(record);
  const controller = {
    ...record,
    ...importing,
    exportResumePdf: createExportResumePdf(record),
  };
  return (
    <PageStatus
      hydrated={ready}
      message={selection.message}
      setMessage={selection.setMessage}
    >
      <>
        <WorkspaceHeader
          title="Import a resume"
        />
        {selection.activeResumeId ? <ResumeParser controller={controller} /> : (
          <section className="panel">
            <div className="panel-title">
              <h2>Start your resume import</h2>
              <p>Name your resume, then choose a PDF, Word document, or JSON file.</p>
            </div>
            <form onSubmit={(event) => void startImport(event)}>
              <label>
                Resume name
                <input required maxLength={80} value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Software Engineer" disabled={creating} />
              </label>
              <button className="primary parser-button" type="submit" disabled={creating}>
                {creating ? "Creating…" : "Continue to import"}
              </button>
            </form>
          </section>
        )}
        {selection.activeResumeId && <ContactImportReview controller={controller} />}
      </>
    </PageStatus>
  );
}
