/** Matches backend E.164 check: + then country code and subscriber number. */
export function isValidE164Phone(input: string): boolean {
  const s = input.trim();
  if (!s) return false;
  return /^\+[1-9]\d{6,14}$/.test(s);
}
