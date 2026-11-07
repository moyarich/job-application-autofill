import { ApplicationReview } from "../../components/ApplicationReview/ApplicationReview";
import { useJobTracker } from "../../hooks/useJobTracker";
import { useApplicationReview } from "../../hooks/useApplicationReview";
import type { useWorkspace } from "../../hooks/useWorkspace";

export function PageApplicationReview({ workspace }: { workspace: ReturnType<typeof useWorkspace> }) {
  const tracker = useJobTracker(workspace);
  const review = useApplicationReview(workspace, tracker);
  return <ApplicationReview controller={{ ...workspace, ...review }} />;
}
