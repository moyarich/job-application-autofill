import { expect, it } from "vitest";
import {
  generateAccountPassword,
  accountPasswordValid,
} from "../../packages/job-application-autofill/src/utils/password/password.ts";

it("always generates every character class required by Workday", () => {
  for (const length of [12, 24, 128]) {
    for (let i = 0; i < 100; i++) {
      const password = generateAccountPassword(length);
      expect(password).toHaveLength(length);
      expect(accountPasswordValid(password)).toBe(true);
    }
  }
});
it("rejects a password missing any required character class", () => {
  for (const password of [
    "UpperLower!_MissingNumber",
    "lowercase1!withoutuppercase",
    "UPPERCASE1!WITHOUTLOWER",
    "UpperLower1234NoSymbol",
  ])
    expect(accountPasswordValid(password)).toBe(false);
  expect(() => generateAccountPassword(3)).toThrow();
});
