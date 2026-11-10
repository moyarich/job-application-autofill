import { AnswerMap } from "../../types/api-types";
import { SavedAnswers } from "./SavedAnswers";

export function EmployerQuestions({
  busy,
  saving,
  message,
  savedAnswers,
  onSave,
  onAutofill,
}: {
  busy: boolean;
  saving: boolean;
  message: string;
  savedAnswers: AnswerMap;
  onSave: () => void;
  onAutofill: () => void;
}) {
  const disabled = busy || saving;

  return (
    <div className="application-questions">
      <div className="panel-title">
        <h3>Employer questions</h3>
        <p>
          Answer any custom questions directly in the employer application
          below. Save completed answers to this application. Previous answers
          are available as optional, labeled examples only.
        </p>
      </div>

      <div className="actions">
        <button
          type="button"
          className="secondary"
          disabled={disabled}
          onClick={onSave}
        >
          {saving ? "Saving answers…" : "Save answers from employer form"}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={disabled}
          onClick={onAutofill}
        >
          Autofill this step
        </button>
      </div>

      {message && <p role="status">{message}</p>}

      <SavedAnswers
        answers={savedAnswers}
        label="Saved responses"
        className="saved-application-answers"
      />
    </div>
  );
}
