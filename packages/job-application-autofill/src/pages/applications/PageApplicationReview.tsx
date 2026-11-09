import { ApplicationReview } from "../../components/ApplicationReview/ApplicationReview";
import { changeJobStatus } from "../../utils/application/changeJobStatus";
import { useApplicationReview } from "../../hooks/useApplicationReview";
import { useProfileSelection } from "../../hooks/useProfileSelection";
import { useJobApplications } from "../../hooks/useJobApplications";
import { useProfileContacts } from "../../hooks/useProfileContacts";
import { useResumeDraft } from "../../hooks/useResumeDraft";
import { PageStatus } from "../../components/PageStatus/PageStatus";

export function PageApplicationReview() {
  const selection = useProfileSelection();
  const applications = useJobApplications({
    profileId: selection.activeProfileId,
    enabled: selection.hydrated,
    applicationId: selection.applicationId,
    setMessage: selection.setMessage,
  });
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
    selection.hydrated &&
    applications.jobsHydrated &&
    contacts.contactsHydrated &&
    (!selection.activeResumeId || draft.resumeHydrated);
  const changeJob = (
    id: Parameters<typeof changeJobStatus>[0],
    status: Parameters<typeof changeJobStatus>[1],
  ) => changeJobStatus(id, status, { ...selection, ...applications });
  const review = useApplicationReview({
    ...selection,
    ...applications,
    ...draft,
    changeJob,
    hydrated: ready,
  });
  return (
    <PageStatus
      hydrated={ready}
      message={selection.message}
      setMessage={selection.setMessage}
    >
      <ApplicationReview
        controller={{ ...selection, ...applications, ...draft, ...review }}
      />
    </PageStatus>
  );
}
