import type { Page } from "playwright";
import type { ApplicationQuestion } from "../index.ts";
import { discoverQuestions, fillQuestionAnswers } from "../index.ts";

/** Detection is read-only. Answers are filled only when explicitly provided. */
export const detectScreeningQuestions = (page: Page): Promise<ApplicationQuestion[]> =>
  discoverQuestions(page);

export async function fillScreeningAnswers(page: Page, answers: Record<string, string>) {
  const questions = await detectScreeningQuestions(page);
  return fillQuestionAnswers(page, questions, answers);
}
