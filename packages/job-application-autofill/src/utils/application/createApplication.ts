import { v5 as uuidv5 } from "uuid";
import { JobApplication } from "../../types/job-application";

export function createApplication(
  company: string,
  role: string,
  url: string,
): JobApplication {
  const trimmedUrl = url.trim();
  if (!company.trim() || !role.trim())
    throw new Error("Company and role are required");
  if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl))
    throw new Error("Job URL must begin with http:// or https://");
  const identity = JSON.stringify([company.trim(), role.trim(), trimmedUrl]);
  return {
    id: uuidv5(identity, uuidv5.URL),
    company: company.trim(),
    role: role.trim(),
    url: trimmedUrl,
    status: "saved",
    createdAt: new Date().toISOString(),
    notes: "",
  };
}
