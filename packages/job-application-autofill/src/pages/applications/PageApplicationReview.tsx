import { ApplicationReview } from "../../components/ApplicationReview/ApplicationReview";
import { changeJobStatus } from "../../utils/application/changeJobStatus";
import { useApplicationReview } from "../../hooks/useApplicationReview";
import { useStoredRecord } from "../../hooks/useStoredRecord";
import { PageStatus } from "../../components/App/PageStatus";

export function PageApplicationReview() {
  const record = useStoredRecord();
  const changeJob = (id: Parameters<typeof changeJobStatus>[0], status: Parameters<typeof changeJobStatus>[1]) =>
    changeJobStatus(id, status, record);
  const review = useApplicationReview({ ...record, changeJob });
  return (
    <PageStatus {...record}>
      <ApplicationReview controller={{ ...record, ...review }} />
    </PageStatus>
  );
}
