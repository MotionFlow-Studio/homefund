/*
 * Invite codes: 8 characters from an alphabet without look-alikes (no 0/O,
 * 1/I/L), shown as two groups of four, e.g. "K7XQ-M3PA". About 40 bits, so
 * guessing is hopeless within the 48 hours a code lives, with rate limits on
 * top.
 */

export const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;

/** How long a code works, in hours. */
export const INVITE_HOURS = 48;

/** Cleans what the user typed: case, spaces and dashes do not matter. */
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "");
}

export function isInviteCode(code: string): boolean {
  return code.length === INVITE_CODE_LENGTH && [...code].every((c) => INVITE_ALPHABET.includes(c));
}

/** "K7XQM3PA" -> "K7XQ-M3PA". */
export function formatInviteCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
