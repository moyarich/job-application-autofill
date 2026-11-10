const groups = [
  "ABCDEFGHJKLMNPQRSTUVWXYZ",
  "abcdefghijkmnopqrstuvwxyz",
  "23456789",
  "!@#$%*",
];
const alphabet = groups.join("");

function randomIndex(size: number) {
  const limit = 256 - (256 % size);
  const byte = new Uint8Array(1);
  do {
    crypto.getRandomValues(byte);
  } while (byte[0] >= limit);
  return byte[0] % size;
}

/** Include every required character class, then securely shuffle their positions. */
export function generateAccountPassword(length = 24): string {
  if (!Number.isInteger(length) || length < 12 || length > 128)
    throw new Error("Account password length must be 12–128 characters.");
  const characters = groups.map((group) => group[randomIndex(group.length)]);
  while (characters.length < length)
    characters.push(alphabet[randomIndex(alphabet.length)]);
  for (let i = characters.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [characters[i], characters[j]] = [characters[j], characters[i]];
  }
  return characters.join("");
}

export function accountPasswordValid(password: string): boolean {
  return (
    password.length >= 12 &&
    password.length <= 128 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^a-zA-Z0-9\s]/.test(password) &&
    !/\s/.test(password)
  );
}
