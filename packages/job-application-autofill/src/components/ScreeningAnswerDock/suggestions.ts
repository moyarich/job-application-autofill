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
  new Set((question.toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter((word) => word.length > 2 && !stopwords.has(word)));

/** Suggestions are approximate examples, never equivalent answers. */
export function relatedAnswers(question: string, examples: PreviousAnswer[], max = 3) {
  const target = questionWords(question);
  if (!target.size) return [];
  return examples.map((example) => {
    const source = questionWords(example.question);
    const shared = [...target].filter((word) => source.has(word)).length;
    const exact = question.trim().toLowerCase() === example.question.trim().toLowerCase();
    const score = exact ? 2 : shared / Math.max(target.size, source.size, 1);
    return { ...example, score };
  }).filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, max);
}
