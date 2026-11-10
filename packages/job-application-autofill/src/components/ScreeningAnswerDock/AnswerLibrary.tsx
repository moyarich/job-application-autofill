import { mutateApplicationAnswer } from "../../api/answers";
import { useMemo, useState } from "react";
import { filterAnswerLibrary, type LibraryFilters } from "./suggestions";
import { ApplicationQnA } from "../../types/application-q-n-a";

export type AnswerLibraryProps = {
  examples: ApplicationQnA[];
  questions: string[];
  onAdapt: (question: string, answer: string) => void;
  currentJobId: string;
  profileId: string;
  onChanged: () => Promise<void>;
};

/** The historical library is read-only. Adapting only updates the current draft. */
export function AnswerLibrary({
  examples,
  questions,
  onAdapt,
  currentJobId,
  profileId,
  onChanged,
}: AnswerLibraryProps) {
  const [filters, setFilters] = useState<LibraryFilters>({
    search: "",
    company: "",
    role: "",
    sort: "recent",
  });
  const [target, setTarget] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function mutate(
    method: "POST" | "PATCH" | "DELETE",
    payload: Record<string, string>,
  ) {
    setWorking(true);
    setFeedback("");
    try {
      await mutateApplicationAnswer(currentJobId, profileId, method, payload);
      await onChanged();
      setEditing(null);
      if (method === "POST") {
        setNewQuestion("");
        setNewAnswer("");
      }
      setFeedback(method === "DELETE" ? "Answer deleted." : "Answer saved.");
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Unable to save the answer.",
      );
    } finally {
      setWorking(false);
    }
  }
  const keyFor = (item: ApplicationQnA) =>
    item.applicationId + ":" + item.question;
  const companies = useMemo(
    () =>
      [...new Set(examples.map((item) => item.company).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [examples],
  );
  const roles = useMemo(
    () =>
      [
        ...new Set(
          examples
            .filter(
              (item) => !filters.company || item.company === filters.company,
            )
            .map((item) => item.role)
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [examples, filters.company],
  );
  const found = useMemo(
    () => filterAnswerLibrary(examples, filters),
    [examples, filters],
  );
  return (
    <section
      className="answer-library"
      aria-label="Previous application answers"
    >
      <button
        className="secondary answer-library-toggle"
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((old) => !old)}
      >
        {expanded ? "Hide answer library" : "Browse answer library"} (
        {examples.length})
      </button>
      {expanded && (
        <div className="answer-library-body">
          <p>
            Past answers are examples, not approved responses for this job.
            Select a current question and adapt the wording before filling.
          </p>
          <div className="answer-library-filters">
            <label>
              Search questions and answers
              <input
                type="search"
                value={filters.search}
                placeholder="Search keywords, employer or answer"
                onChange={(event) =>
                  setFilters((old) => ({ ...old, search: event.target.value }))
                }
              />
            </label>
            <label>
              Employer
              <select
                value={filters.company}
                onChange={(event) =>
                  setFilters((old) => ({
                    ...old,
                    company: event.target.value,
                    role: "",
                  }))
                }
              >
                <option value="">All employers</option>
                {companies.map((company) => (
                  <option key={company} value={company}>
                    {company}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Job title
              <select
                value={filters.role}
                onChange={(event) =>
                  setFilters((old) => ({ ...old, role: event.target.value }))
                }
              >
                <option value="">All job titles</option>
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sort
              <select
                value={filters.sort}
                onChange={(event) =>
                  setFilters((old) => ({
                    ...old,
                    sort: event.target.value as LibraryFilters["sort"],
                  }))
                }
              >
                <option value="recent">Most recent</option>
                <option value="company">Employer</option>
                <option value="question">Question</option>
              </select>
            </label>
          </div>
          <label className="answer-library-target">
            Adapt for current question
            <select
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            >
              <option value="">Select a current question</option>
              {questions.map((question) => (
                <option key={question} value={question}>
                  {question}
                </option>
              ))}
            </select>
          </label>
          <form
            className="answer-library-create"
            onSubmit={(event) => {
              event.preventDefault();
              void mutate("POST", { question: newQuestion, answer: newAnswer });
            }}
          >
            <strong>New answer for this application</strong>
            <label>
              Question
              <input
                required
                maxLength={300}
                value={newQuestion}
                onChange={(event) => setNewQuestion(event.target.value)}
              />
            </label>
            <label>
              Answer
              <textarea
                required
                maxLength={4000}
                rows={3}
                value={newAnswer}
                onChange={(event) => setNewAnswer(event.target.value)}
              />
            </label>
            <button
              type="submit"
              className="secondary"
              disabled={working || !newQuestion.trim() || !newAnswer.trim()}
            >
              Save new answer
            </button>
          </form>
          {feedback && <p role="status">{feedback}</p>}
          <p role="status">
            {found.length} matching {found.length === 1 ? "answer" : "answers"}
          </p>
          {found.length === 0 && (
            <p>No matching saved answers. Try different filters.</p>
          )}
          {found.slice(0, 40).map((item) => (
            <article
              className="screening-dock-example"
              key={item.applicationId + ":" + item.question}
            >
              <small>
                {item.company} · {item.role}
              </small>
              <strong>{item.question}</strong>
              {editing === keyFor(item) ? (
                <label className="answer-library-editor">
                  Edit saved answer
                  <textarea
                    rows={4}
                    maxLength={4000}
                    value={editValue}
                    onChange={(event) => setEditValue(event.target.value)}
                  />
                </label>
              ) : (
                <p>{item.answer}</p>
              )}
              <div className="answer-library-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={!target || working}
                  onClick={() => onAdapt(target, item.answer)}
                >
                  Adapt into draft
                </button>
                {editing === keyFor(item) ? (
                  <>
                    <button
                      type="button"
                      className="secondary"
                      disabled={working || !editValue.trim()}
                      onClick={() =>
                        void mutate("PATCH", {
                          applicationId: item.applicationId,
                          question: item.question,
                          expectedAnswer: item.answer,
                          expectedUpdatedAt: item.updatedAt,
                          answer: editValue,
                        })
                      }
                    >
                      Save changes
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setEditing(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="secondary"
                    disabled={working}
                    onClick={() => {
                      setEditing(keyFor(item));
                      setEditValue(item.answer);
                    }}
                  >
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  className="secondary"
                  disabled={working}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Delete this saved answer from " + item.company + "?",
                      )
                    )
                      void mutate("DELETE", {
                        applicationId: item.applicationId,
                        question: item.question,
                        expectedAnswer: item.answer,
                        expectedUpdatedAt: item.updatedAt,
                      });
                  }}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
          {found.length > 40 && (
            <p>Showing the first 40 results. Narrow your search to see more.</p>
          )}
        </div>
      )}
    </section>
  );
}
