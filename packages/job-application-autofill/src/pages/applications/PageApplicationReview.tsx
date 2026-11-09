import { useEffect, useRef, useState } from "react";
import { ApplicationReview } from "../../components/ApplicationReview/ApplicationReview";
import { changeJobStatus } from "../../utils/application/changeJobStatus";
import { useApplicationReview } from "../../hooks/useApplicationReview";
import { useProfileSelection } from "../../hooks/useProfileSelection";
import { useJobApplications } from "../../hooks/useJobApplications";
import { useProfileContacts } from "../../hooks/useProfileContacts";
import { useResumeDraft } from "../../hooks/useResumeDraft";
import { PageStatus } from "../../components/PageStatus/PageStatus";
import { readJobs, saveJob } from "../../utils/api/client";
import { useNavigate } from "react-router";

export function PageApplicationReview() {
  const navigate = useNavigate();
  const [resumeBusy, setResumeBusy] = useState(false);
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
  const autoStart = new URLSearchParams(window.location.search).get("start") === "1";
  const startAttempt = useRef("");
  useEffect(() => {
    if (!autoStart || !ready || !review.activeLoaded || review.session || review.applyBusy) return;
    const job = applications.jobs.find((item) => item.id === selection.applicationId);
    if (!job?.resumeId || job.resumeId !== selection.activeResumeId) return;
    const key = job.id + ":" + job.resumeId;
    if (startAttempt.current === key) return;
    startAttempt.current = key;
    void review.prepareJob(job);
  }, [autoStart, ready, review.activeLoaded, review.session, review.applyBusy, applications.jobs, selection.applicationId, selection.activeResumeId]);
  async function chooseApplicationResume(resumeId: string) {
    const job = applications.jobs.find((item) => item.id === selection.applicationId);
    if (!job || resumeBusy) return;
    setResumeBusy(true);
    try {
      if (resumeId && !selection.resumeVersions.some((item) => item.id === resumeId))
        throw new Error("Resume not found in the active profile.");
      const latest = await readJobs(selection.activeProfileId);
      const current = latest.jobs.find((item) => item.id === job.id);
      if (!current) throw new Error("Application no longer exists.");
      const updated = { ...current, resumeId: resumeId || null };
      await saveJob(selection.activeProfileId, {
        revision: latest.revisions[job.id], job: updated,
      });
      applications.setJobs((items) => items.map((item) =>
        item.id === job.id ? updated : item));
      const params = new URLSearchParams(window.location.search);
      params.set("profile", selection.activeProfileId);
      if (resumeId) params.set("resume", resumeId);
      else params.delete("resume");
      navigate({ pathname: window.location.pathname, search: params.toString() });
    } catch (error) {
      selection.setMessage("Could not assign resume: " + String(error));
    } finally {
      setResumeBusy(false);
    }
  }
  return (
    <PageStatus
      hydrated={ready}
      message={selection.message}
      setMessage={selection.setMessage}
    >
      <ApplicationReview
        controller={{ ...selection, ...applications, ...draft, ...review }}
        onChooseResume={chooseApplicationResume}
        resumeBusy={resumeBusy}
      />
    </PageStatus>
  );
}
