import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  GripVertical,
  Maximize2,
  MessageSquareText,
  Minus,
  X,
} from "lucide-react";
import { requestApi } from "../../utils/api/client";
import { relatedAnswers, type PreviousAnswer } from "./suggestions";
import { AnswerLibrary } from "./AnswerLibrary";
import { reusableQuestion } from "@moyarich/job-boards/screening-policy";
import "./ScreeningAnswerDock.css";

type Question = {
  label: string;
  kind: string;
  required: boolean;
  options: string[];
};
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

const blocked =
  /(?:agree|agreement|arbitration|non.disclosure|consent|acknowledge|signature|terms and conditions|privacy policy|gender|race|ethnic|veteran|disability|birth date|social security|password)/i;

/**
 * Suggestions never leave the selected application. No suggestions are applied
 * automatically, and only an exact question-label match may be sent to Workday.
 */
export function ScreeningAnswerDock({
  sessionId,
  currentJobId,
  onLibraryChanged,
  profileId,
  resumeId,
  questions,
  savedAnswers,
  previousAnswers,
  currentAnswerRecords,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const initialBox = () => ({
    x: Math.max(12, window.innerWidth - 504),
    y: Math.max(12, window.innerHeight - 552),
    width: Math.min(480, window.innerWidth - 24),
    height: Math.min(520, window.innerHeight - 24),
  });
  const [box, setBox] = useState(initialBox);
  const popup = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const gesture = useRef<{
    mode: "move" | "resize";
    x: number;
    y: number;
    box: typeof box;
  } | null>(null);
  function constrain(next: typeof box) {
    const width = Math.min(
      Math.max(Math.min(300, innerWidth - 24), next.width),
      innerWidth - 24,
    );
    const height = Math.min(
      Math.max(Math.min(240, innerHeight - 24), next.height),
      innerHeight - 24,
    );
    return {
      width,
      height,
      x: Math.max(12, Math.min(next.x, innerWidth - width - 12)),
      y: Math.max(12, Math.min(next.y, innerHeight - height - 12)),
    };
  }
  useEffect(() => {
    if (!expanded) return;
    setBox((current) => constrain(current));
    popup.current?.focus();
    const resize = () => setBox((current) => constrain(current));
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [expanded]);
  function closePopup() {
    setExpanded(false);
    trigger.current?.focus();
  }
  function startGesture(
    event: ReactPointerEvent<HTMLElement>,
    mode: "move" | "resize",
  ) {
    if (
      event.button !== 0 ||
      (mode === "move" && (event.target as HTMLElement).closest("button"))
    )
      return;
    event.preventDefault();
    gesture.current = { mode, x: event.clientX, y: event.clientY, box };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveGesture(event: ReactPointerEvent<HTMLElement>) {
    const start = gesture.current;
    if (!start) return;
    const dx = event.clientX - start.x,
      dy = event.clientY - start.y;
    setBox(
      constrain(
        start.mode === "move"
          ? { ...start.box, x: start.box.x + dx, y: start.box.y + dy }
          : {
              ...start.box,
              width: start.box.width + dx,
              height: start.box.height + dy,
            },
      ),
    );
  }
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [imported, setImported] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [completed, setCompleted] = useState<string[]>([]);
  const [visibleSuggestions, setVisibleSuggestions] = useState<string | null>(
    null,
  );
  const suggested = questions.filter(
    (question) =>
      !blocked.test(question.label) &&
      typeof savedAnswers[question.label] === "string" &&
      savedAnswers[question.label].trim(),
  );
  const eligible = questions.filter(
    (question) =>
      !blocked.test(question.label) && reusableQuestion(question.label),
  );
  async function apply(label: string, answer: string) {
    if (
      !answer.trim() ||
      (imported[label] && answer.trim() === imported[label].trim())
    )
      return;
    setBusy(label);
    setMessage("");
    try {
      const response = await requestApi<{
        answerResult: { filled: string[]; unresolved: string[] };
      }>(
        "/api/apply/" + encodeURIComponent(sessionId) + "/answers",
        { answers: { [label]: answer } },
        profileId,
        resumeId,
      );
      if (response.answerResult.filled.includes(label)) {
        setCompleted((old) => [...new Set([...old, label])]);
        setMessage(
          "Answer filled in the employer form. Review it before continuing.",
        );
      } else
        setMessage(
          "The employer field could not be matched. Enter this answer manually.",
        );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to fill this answer.",
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="secondary screening-answer-launcher"
        aria-expanded={expanded}
        aria-haspopup="dialog"
        onClick={() => setExpanded((open) => !open)}
      >
        <MessageSquareText size={16} aria-hidden="true" /> Screening answers
        <small>
          {suggested.length} saved matches · {questions.length} questions
        </small>
      </button>
      {expanded &&
        createPortal(
          <aside
            ref={popup}
            className="screening-answer-popup"
            role="dialog"
            aria-modal="false"
            aria-label="Screening answer assistant"
            tabIndex={-1}
            style={{
              left: box.x,
              top: box.y,
              width: box.width,
              height: box.height,
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                closePopup();
              }
            }}
          >
            <header
              className="screening-popup-header"
              tabIndex={0}
              aria-label="Move screening answers using arrow keys"
              onPointerDown={(event) => startGesture(event, "move")}
              onPointerMove={moveGesture}
              onPointerUp={() => {
                gesture.current = null;
              }}
              onPointerCancel={() => {
                gesture.current = null;
              }}
              onKeyDown={(event) => {
                if (
                  event.target !== event.currentTarget ||
                  !event.key.startsWith("Arrow")
                )
                  return;
                event.preventDefault();
                setBox((current) =>
                  constrain({
                    ...current,
                    x:
                      current.x +
                      (event.key === "ArrowRight"
                        ? 16
                        : event.key === "ArrowLeft"
                          ? -16
                          : 0),
                    y:
                      current.y +
                      (event.key === "ArrowDown"
                        ? 16
                        : event.key === "ArrowUp"
                          ? -16
                          : 0),
                  }),
                );
              }}
            >
              <GripVertical size={16} aria-hidden="true" />
              <div>
                <strong>Screening answers</strong>
                <small>
                  {suggested.length} saved matches · {questions.length}{" "}
                  questions
                </small>
              </div>
              <button
                type="button"
                aria-label="Reset popup size and position"
                onClick={() => setBox(initialBox())}
              >
                <Maximize2 size={15} />
              </button>
              <button
                type="button"
                aria-label="Minimize screening answers"
                onClick={closePopup}
              >
                <Minus size={16} />
              </button>
              <button
                type="button"
                aria-label="Close screening answers"
                onClick={closePopup}
              >
                <X size={16} />
              </button>
            </header>
            <div className="screening-dock-content">
              <p>
                Current answers are kept with this application. Previous jobs
                provide labeled examples only; choose and edit one before
                filling.
              </p>
              {eligible.length === 0 && (
                <p>
                  There are no safe, editable screening questions detected on
                  this step.
                </p>
              )}
              {eligible.map((question) => {
                const key = question.label;
                const matched = savedAnswers[key]?.trim() || "";
                const answer = drafts[key] ?? matched;
                return (
                  <div className="screening-dock-item" key={key}>
                    <strong>{key}</strong>
                    {matched && <small>Saved for this application</small>}
                    {!matched && (
                      <small>No saved response for this question</small>
                    )}
                    {relatedAnswers(key, previousAnswers).length > 0 && (
                      <div className="screening-dock-suggestions">
                        <button
                          type="button"
                          className="secondary"
                          aria-expanded={visibleSuggestions === key}
                          onClick={() =>
                            setVisibleSuggestions((current) =>
                              current === key ? null : key,
                            )
                          }
                        >
                          {visibleSuggestions === key
                            ? "Hide previous examples"
                            : "View related past answers"}
                        </button>
                        {visibleSuggestions === key &&
                          relatedAnswers(key, previousAnswers).map(
                            (example) => (
                              <div
                                className="screening-dock-example"
                                key={
                                  example.applicationId + ":" + example.question
                                }
                              >
                                <small>
                                  From {example.company} · {example.role}
                                </small>
                                <strong>{example.question}</strong>
                                <p>{example.answer}</p>
                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={() => {
                                    setDrafts((old) => ({
                                      ...old,
                                      [key]: example.answer,
                                    }));
                                    setImported((old) => ({
                                      ...old,
                                      [key]: example.answer,
                                    }));
                                    setMessage(
                                      "Copied into the draft only. Edit it for this role before filling.",
                                    );
                                  }}
                                >
                                  Adapt this response
                                </button>
                              </div>
                            ),
                          )}
                      </div>
                    )}
                    <textarea
                      rows={3}
                      value={answer}
                      aria-label={"Suggested answer for " + key}
                      placeholder="Write a response specific to this role"
                      onChange={(event) =>
                        setDrafts((old) => ({
                          ...old,
                          [key]: event.target.value,
                        }))
                      }
                    />
                    {imported[key] &&
                      answer.trim() === imported[key].trim() && (
                        <small>
                          Edit this imported response for the current job before
                          filling.
                        </small>
                      )}
                    <button
                      type="button"
                      className="secondary"
                      disabled={
                        !answer.trim() ||
                        busy !== null ||
                        Boolean(
                          imported[key] &&
                          answer.trim() === imported[key].trim(),
                        )
                      }
                      onClick={() => void apply(key, answer)}
                    >
                      {busy === key
                        ? "Filling…"
                        : completed.includes(key)
                          ? "Fill again"
                          : "Use this answer"}
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
                  setDrafts((previous) => ({
                    ...previous,
                    [question]: answer,
                  }));
                  setImported((previous) => ({
                    ...previous,
                    [question]: answer,
                  }));
                  setMessage(
                    "Example copied into a draft. Edit the response for this job before filling.",
                  );
                }}
              />
              {message && <p role="status">{message}</p>}
              <small>
                Legal consent and sensitive disclosures are completed directly
                on the employer's form.
              </small>
            </div>
            <button
              type="button"
              className="screening-popup-resize"
              aria-label="Resize screening answers"
              onPointerDown={(event) => startGesture(event, "resize")}
              onPointerMove={moveGesture}
              onPointerUp={() => {
                gesture.current = null;
              }}
              onPointerCancel={() => {
                gesture.current = null;
              }}
              onKeyDown={(event) => {
                if (!event.key.startsWith("Arrow")) return;
                event.preventDefault();
                setBox((current) =>
                  constrain({
                    ...current,
                    width:
                      current.width +
                      (event.key === "ArrowRight"
                        ? 16
                        : event.key === "ArrowLeft"
                          ? -16
                          : 0),
                    height:
                      current.height +
                      (event.key === "ArrowDown"
                        ? 16
                        : event.key === "ArrowUp"
                          ? -16
                          : 0),
                  }),
                );
              }}
            />
          </aside>,
          document.body,
        )}
    </>
  );
}
