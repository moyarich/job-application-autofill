import type { Resume } from "@moyarich/resume";
import { markdownToPlainText } from "@moyarich/resume/markdown";

export function resumeToPlainText(profile: Resume): Resume {
  return {
    ...profile,
    summary: markdownToPlainText(profile.summary),
    experience: profile.experience.map((e) => ({
      ...e,
      description: markdownToPlainText(e.description),
    })),
    education: profile.education.map((e) => ({
      ...e,
      description: markdownToPlainText(e.description),
    })),
    projects: profile.projects.map((e) => ({
      ...e,
      description: markdownToPlainText(e.description),
    })),
    ...(profile.additionalSections
      ? {
          additionalSections: profile.additionalSections.map((s) => ({
            ...s,
            content: markdownToPlainText(s.content),
          })),
        }
      : {}),
  };
}
