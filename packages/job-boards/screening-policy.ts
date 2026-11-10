/**
 * One conservative policy for stored, suggested and entered screening answers.
 * False negatives are preferable to sending a sensitive or employer-specific value.
 */
const RESTRICTED = /(?:password|passcode|verification|one.time|otp|social security|ssn|birth|\bage\b|credit|bank|financial account|passport|driver.?s licen|tax(?:payer)? id|national id|gender|race|ethnic|disabil|medical|health|veteran|sexual orientation|demographic|self.identif|pronouns|religion|citizenship number|visa number|agree|agreement|consent|arbitration|signature|non.disclosure|acknowledg|privacy policy|terms (?:and|&) conditions|captcha|robot|honeypot|leave (?:this )?(?:field )?(?:empty|blank))/i;

/** Labels here are *not* credentials or legal actions. */
export function reusableQuestion(label: unknown): label is string {
  return typeof label === "string" && label.trim().length > 0 &&
    label.length <= 300 && !RESTRICTED.test(label);
}

export function reusableAnswer(label: unknown, answer: unknown): boolean {
  return reusableQuestion(label) && typeof answer === "string" &&
    answer.trim().length > 0 && answer.length <= 4000;
}

export function normalizedQuestion(label: string) {
  return label.replace(/\s+/g, " ").trim().toLocaleLowerCase("en-US");
}
