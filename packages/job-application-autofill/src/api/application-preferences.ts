import type { RJSFSchema } from "@rjsf/utils";

export const preferenceFields = {
  country: "Employment country",
  workAuthorization: "Work authorization",
  sponsorship: "Sponsorship requirements",
  salary: "Salary notes",
  currency: "Salary currency",
  relocation: "Relocation preferences",
  workArrangement: "Work arrangement",
  availability: "Availability notes",
  travel: "Travel preferences",
  employmentType: "Employment type",
  salaryMinimum: "Minimum salary",
  salaryMaximum: "Maximum salary",
  salaryPeriod: "Salary period",
  availabilityType: "Availability",
  startDate: "Earliest start date",
  noticePeriod: "Notice period",
  noticeUnit: "Notice period unit",
} as const;

export type GeneralPreferenceData = Partial<
  Record<keyof typeof preferenceFields, string>
>;
export type BoardPreferenceSchema = {
  jobBoard: string;
  label: string;
  schema: RJSFSchema;
};
export type PreferenceData = Record<
  string,
  string | number | string[] | undefined
>;

export type ApplicationPreference = {
  id: string;
  name: string;
  isDefault: boolean;
  jobBoard: string | null;
  data: PreferenceData;
  revision: number;
  updatedAt: string;
};
export type PreferenceSelection = {
  jobBoard: string | null;
  selectedId: string | null;
  preference: ApplicationPreference | null;
};

export async function preferenceRequest<T>(
  profileId: string,
  path = "",
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch("/api/" + path, {
    method,
    headers: {
      "X-Moya-Client": "dashboard",
      "X-Profile-Id": profileId,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Could not save application preferences.");
  return result;
}
