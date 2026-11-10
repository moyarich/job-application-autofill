import { AnswerMap } from "../../types/api-types";

export function SavedAnswers({
  answers,
  label,
  className,
}: {
  answers: AnswerMap;
  label: string;
  className: string;
}) {
  const entries = Object.entries(answers);
  if (entries.length === 0) return null;

  return (
    <details className={className}>
      <summary>
        {label} ({entries.length})
      </summary>
      {entries.map(([question, answer]) => (
        <div key={question}>
          <strong>{question}</strong>
          <p>{answer}</p>
        </div>
      ))}
    </details>
  );
}
