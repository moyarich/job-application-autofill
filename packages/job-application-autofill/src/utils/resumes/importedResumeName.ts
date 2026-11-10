import type { CandidateProfile } from "../../index";

/** Derive an editable resume name only after the import has been confirmed. */
export function defaultImportedResumeName(profile: CandidateProfile): string {
  const source = profile.source.fileName
    .trim()
    .replace(/\.(pdf|docx|json)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const person = [profile.contact.firstName, profile.contact.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return (source || (person ? person + " Resume" : "Imported resume")).slice(
    0,
    80,
  );
}
