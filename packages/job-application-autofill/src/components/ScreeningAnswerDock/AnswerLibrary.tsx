import { useMemo, useState } from "react";
import { filterAnswerLibrary, type LibraryFilters, type PreviousAnswer } from "./suggestions";

type Props = {
  examples: PreviousAnswer[];
  questions: string[];
  onAdapt: (question: string, answer: string) => void;
};

/** The historical library is read-only. Adapting only updates the current draft. */
export function AnswerLibrary({ examples, questions, onAdapt }: Props) {
  const [filters, setFilters] = useState<LibraryFilters>({
    search: "", company: "", role: "", sort: "recent",
  });
  const [target, setTarget] = useState("");
  const [expanded, setExpanded] = useState(false);
  const companies = useMemo(() =>
    [...new Set(examples.map((item) => item.company).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b)), [examples]);
  const roles = useMemo(() =>
    [...new Set(examples.filter((item) => !filters.company || item.company === filters.company)
      .map((item) => item.role).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b)), [examples, filters.company]);
  const found = useMemo(() => filterAnswerLibrary(examples, filters),
    [examples, filters]);
  return (
    <section className="answer-library" aria-label="Previous application answers">
      <button className="secondary answer-library-toggle" type="button"
        aria-expanded={expanded} onClick={() => setExpanded((old) => !old)}>
        {expanded ? "Hide answer library" : "Browse answer library"} ({examples.length})
      </button>
      {expanded && (
        <div className="answer-library-body">
          <p>Past answers are examples, not approved responses for this job. Select a current question and adapt the wording before filling.</p>
          <div className="answer-library-filters">
            <label>Search questions and answers
              <input type="search" value={filters.search}
                placeholder="Search keywords, employer or answer"
                onChange={(event) => setFilters((old) => ({ ...old, search: event.target.value }))}/>
            </label>
            <label>Employer
              <select value={filters.company}
                onChange={(event) => setFilters((old) => ({ ...old, company: event.target.value, role: "" }))}>
                <option value="">All employers</option>
                {companies.map((company) => <option key={company} value={company}>{company}</option>)}
              </select>
            </label>
            <label>Job title
              <select value={filters.role}
                onChange={(event) => setFilters((old) => ({ ...old, role: event.target.value }))}>
                <option value="">All job titles</option>
                {roles.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </label>
            <label>Sort
              <select value={filters.sort}
                onChange={(event) => setFilters((old) => ({ ...old, sort: event.target.value as LibraryFilters["sort"] }))}>
                <option value="recent">Most recent</option>
                <option value="company">Employer</option>
                <option value="question">Question</option>
              </select>
            </label>
          </div>
          <label className="answer-library-target">Adapt for current question
            <select value={target} onChange={(event) => setTarget(event.target.value)}>
              <option value="">Select a current question</option>
              {questions.map((question) => <option key={question} value={question}>{question}</option>)}
            </select>
          </label>
          <p role="status">{found.length} matching {found.length === 1 ? "answer" : "answers"}</p>
          {found.length === 0 && <p>No matching saved answers. Try different filters.</p>}
          {found.slice(0, 40).map((item) => (
            <article className="screening-dock-example" key={item.applicationId + ":" + item.question}>
              <small>{item.company} · {item.role}</small>
              <strong>{item.question}</strong>
              <p>{item.answer}</p>
              <button type="button" className="secondary" disabled={!target}
                onClick={() => onAdapt(target, item.answer)}>
                Adapt into draft
              </button>
            </article>
          ))}
          {found.length > 40 && <p>Showing the first 40 results. Narrow your search to see more.</p>}
        </div>
      )}
    </section>
  );
}
