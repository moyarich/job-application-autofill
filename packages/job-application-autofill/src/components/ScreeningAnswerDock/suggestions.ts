import { reusableAnswer, reusableQuestion, normalizedQuestion } from "../../../../job-sites/screening-policy.ts";

export type PreviousAnswer = {
  applicationId: string;
  question: string;
  answer: string;
  company: string;
  role: string;
  updatedAt: string;
};

const stopwords = new Set([
  "a", "an", "the", "to", "of", "for", "in", "on", "at", "or", "and",
  "you", "your", "we", "our", "is", "are", "do", "does", "have",
  "with", "can", "would", "please", "tell", "us", "about", "this",
  "job", "position", "role", "what", "why", "how", "describe",
]);
export const questionWords = (question: string) =>
  new Set((normalizedQuestion(question).match(/[a-z0-9]+/g) || [])
    .filter((word) => word.length > 2 && !stopwords.has(word)));

/** Similarity ranks examples but never authorizes employer autofill. */
export function relatedAnswers(question: string, examples: PreviousAnswer[], max = 3) {
  if (!reusableQuestion(question) || !Number.isSafeInteger(max) || max <= 0) return [];
  const target = questionWords(question);
  if (!target.size) return [];
  const seen = new Set<string>();
  return examples.filter((example) => reusableAnswer(example.question, example.answer) &&
      Boolean(example.company.trim()) && Boolean(example.role.trim()))
    .map((example) => {
      const source = questionWords(example.question);
      const shared = [...target].filter((word) => source.has(word)).length;
      const exact = normalizedQuestion(question) === normalizedQuestion(example.question);
      const score = exact ? 2 : shared >= 2 ? shared / Math.max(target.size, source.size, 1) : 0;
      return { ...example, score };
    })
    .filter((entry) => entry.score >= 0.3)
    .sort((a, b) => b.score - a.score || b.updatedAt.localeCompare(a.updatedAt))
    .filter((entry) => {
      const identity = normalizedQuestion(entry.question) + "\0" + entry.answer.trim();
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    })
    .slice(0, Math.min(max, 5));
}

export type LibraryFilters = {
  search: string;
  company: string;
  role: string;
  sort: "recent" | "company" | "question";
};

/** Pure, deterministic, profile-owned history view; no writes or answer reuse. */
export function filterAnswerLibrary(examples: PreviousAnswer[], filters: LibraryFilters) {
  const search = normalizedQuestion(filters.search);
  return examples.filter((item) => reusableAnswer(item.question, item.answer) &&
    (!filters.company || item.company === filters.company) &&
    (!filters.role || item.role === filters.role) &&
    (!search || [item.question, item.answer, item.company, item.role]
      .some((value) => normalizedQuestion(value).includes(search))))
    .sort((a, b) => filters.sort === "company"
      ? a.company.localeCompare(b.company) || b.updatedAt.localeCompare(a.updatedAt)
      : filters.sort === "question"
        ? a.question.localeCompare(b.question) || b.updatedAt.localeCompare(a.updatedAt)
        : b.updatedAt.localeCompare(a.updatedAt) || a.question.localeCompare(b.question));
}
