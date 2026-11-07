import { ApplicationReview } from "../../components/ApplicationReview/ApplicationReview";
import { changeJobStatus } from "../../utils/application/changeJobStatus";
import { useApplicationReview } from "../../hooks/useApplicationReview";
import type { useWorkspace } from "../../hooks/useWorkspace";

export function PageApplicationReview({ workspace }: { workspace: ReturnType<typeof useWorkspace> }) {
  const changeJob = (id: Parameters<typeof changeJobStatus>[0], status: Parameters<typeof changeJobStatus>[1]) =>
    changeJobStatus(id, status, workspace);
  const review = useApplicationReview({ ...workspace, changeJob });
  return <ApplicationReview controller={{ ...workspace, ...review }} />;
}
