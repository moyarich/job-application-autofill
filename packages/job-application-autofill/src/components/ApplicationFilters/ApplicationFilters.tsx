import { ArrowDownUp, ListFilter } from "lucide-react";
import { statuses } from "../../index";
import { statusLabels } from "../../utils/profile/fields";
import type {
  ApplicationFilter,
  ApplicationSort,
} from "../../utils/application/application-list";
import { SelectFilter, type FilterOption } from "../SelectFilter/SelectFilter";

const statusOptions: readonly FilterOption<ApplicationFilter>[] = [
  { value: "all", label: "All statuses" },
  ...statuses.map((status) => ({ value: status, label: statusLabels[status] })),
];

const sortOptions: readonly FilterOption<ApplicationSort>[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "company", label: "Company A–Z" },
  { value: "role", label: "Role A–Z" },
  { value: "status", label: "Status A–Z" },
];

export function ApplicationFilters({
  status,
  sort,
  onStatusChange,
  onSortChange,
}: {
  status: ApplicationFilter;
  sort: ApplicationSort;
  onStatusChange: (status: ApplicationFilter) => void;
  onSortChange: (sort: ApplicationSort) => void;
}) {
  return (
    <>
      <SelectFilter
        label="Filter applications by status"
        icon={ListFilter}
        value={status}
        options={statusOptions}
        onChange={onStatusChange}
      />
      <SelectFilter
        label="Sort applications"
        icon={ArrowDownUp}
        value={sort}
        options={sortOptions}
        onChange={onSortChange}
      />
    </>
  );
}
