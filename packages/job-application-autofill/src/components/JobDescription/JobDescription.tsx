import { useMemo } from "react";
import { markdownToHtml } from "@moyarich/resume/validate";
import "./JobDescription.css";

export function JobDescription({ content }: { content: string }) {
  const html = useMemo(() => markdownToHtml(content), [content]);
  return <div className="job-description" dangerouslySetInnerHTML={{ __html: html }} />;
}
