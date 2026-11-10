import { useState } from "react";
import { requestApi } from "../../utils/api/client";
import { relatedAnswers, type PreviousAnswer } from "./suggestions";
import { AnswerLibrary } from "./AnswerLibrary";
import { reusableQuestion } from "../../../../job-sites/screening-policy.ts";
import "./ScreeningAnswerDock.css";

type Question = { label: string; kind: string; required: boolean; options: string[] };
type Props = {
  sessionId: string;
  currentJobId: string;
  onLibraryChanged: () => Promise<void>;
  profileId: string;
  resumeId?: string;
  questions: Question[];
  savedAnswers: Record<string, string>;
  previousAnswers: PreviousAnswer[];
  currentAnswerRecords: PreviousAnswer[];
};

const blocked = /(?:agree|agreement|arbitration|non.disclosure|consent|acknowledge|signature|terms and conditions|privacy policy|gender|race|ethnic|veteran|disability|birth date|social security|password)/i;

/**
 * Suggestions never leave the selected application. No suggestions are applied
 * automatically, and only an exact question-label match may be sent to Workday.
 */
export function ScreeningAnswerDock({
  sessionId, currentJobId, onLibraryChanged, profileId, resumeId, questions, savedAnswers, previousAnswers, currentAnswerRecords,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [imported, setImported] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [completed, setCompleted] = useState<string[]>([]);
  const [visibleSuggestions, setVisibleSuggestions] = useState<string | null>(null);
  const suggested = questions.filter((question) =>
    !blocked.test(question.label) && typeof savedAnswers[question.label] === "string" &&
    savedAnswers[question.label].trim(),
  );
  const eligible = questions.filter((question) => !blocked.test(question.label) && reusableQuestion(question.label));
  async function apply(label: string, answer: string) {
    if (!answer.trim() || (imported[label] && answer.trim() === imported[label].trim())) return;
    setBusy(label);
    setMessage("");
    try {
      const response = await requestApi<{ answerResult: { filled: string[]; unresolved: string[] } }>(
        "/api/apply/" + encodeURIComponent(sessionId) + "/answers",
        { answers: { [label]: answer } },
        profileId, resumeId,
      );
      if (response.answerResult.filled.includes(label)) {
        setCompleted((old) => [...new Set([...old, label])]);
        setMessage("Answer filled in the employer form. Review it before continuing.");
      } else setMessage("The employer field could not be matched. Enter this answer manually.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to fill this answer.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <aside className="screening-dock" aria-label="Screening answer assistant">
      <button type="button" className="screening-dock-toggle" aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}>
        <span>Screening answers</span>
        <small>{suggested.length} saved matches · {questions.length} detected questions</small>
        <span aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
      {expanded && (
        <div className="screening-dock-content">
          <p>Current answers are kept with this application. Previous jobs provide labeled examples only; choose and edit one before filling.</p>
          {eligible.length === 0 && <p>There are no safe, editable screening questions detected on this step.</p>}
          {eligible.map((question) => {
            const key = question.label;
            const matched = savedAnswers[key]?.trim() || "";
            const answer = drafts[key] ?? matched;
            return (
              <div className="screening-dock-item" key={key}>
                <strong>{key}</strong>
                {matched && <small>Saved for this application</small>}
                {!matched && <small>No saved response for this question</small>}
                {relatedAnswers(key, previousAnswers).length > 0 && (
                  <div className="screening-dock-suggestions">
                    <button type="button" className="secondary" aria-expanded={visibleSuggestions === key}
                      onClick={() => setVisibleSuggestions((current) => current === key ? null : key)}>
                      {visibleSuggestions === key ? "Hide previous examples" : "View related past answers"}
                    </button>
                    {visibleSuggestions === key && relatedAnswers(key, previousAnswers).map((example) => (
                      <div className="screening-dock-example"
                        key={example.applicationId + ":" + example.question}>
                        <small>From {example.company} · {example.role}</small>
                        <strong>{example.question}</strong>
                        <p>{example.answer}</p>
                        <button type="button" className="secondary"
                          onClick={() => {
                            setDrafts((old) => ({ ...old, [key]: example.answer }));
                            setImported((old) => ({ ...old, [key]: example.answer }));
                            setMessage("Copied into the draft only. Edit it for this role before filling.");
                          }}>
                          Adapt this response
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <textarea rows={3} value={answer} aria-label={"Suggested answer for " + key}
                  placeholder="Write a response specific to this role"
                  onChange={(event) => setDrafts((old) => ({ ...old, [key]: event.target.value }))}/>
                {imported[key] && answer.trim() === imported[key].trim() && (
                  <small>Edit this imported response for the current job before filling.</small>
                )}
                <button type="button" className="secondary" disabled={!answer.trim() || busy !== null || Boolean(imported[key] && answer.trim() === imported[key].trim())}
                  onClick={() => void apply(key, answer)}>
                  {busy === key ? "Filling…" : completed.includes(key) ? "Fill again" : "Use this answer"}
                </button>
              </div>
            );
          })}
          <AnswerLibrary
            currentJobId={currentJobId}
            profileId={profileId}
            onChanged={onLibraryChanged}
            examples={[...currentAnswerRecords, ...previousAnswers]}
            questions={eligible.map((question) => question.label)}
            onAdapt={(question, answer) => {
              setDrafts((previous) => ({ ...previous, [question]: answer }));
              setImported((previous) => ({ ...previous, [question]: answer }));
              setMessage("Example copied into a draft. Edit the response for this job before filling.");
            }}
          />
          {message && <p role="status">{message}</p>}
          <small>Legal consent and sensitive disclosures are completed directly on the employer's form.</small>
        </div>
      )}
    </aside>
  );
}
