import { describe, expect, it } from "vitest";
import { formatInviteCode, INVITE_ALPHABET, isInviteCode, normalizeInviteCode } from "./invite-code";

describe("invite codes", () => {
  it("accepts what people type", () => {
    expect(normalizeInviteCode(" k7xq-m3pa ")).toBe("K7XQM3PA");
    expect(normalizeInviteCode("K7XQ M3PA")).toBe("K7XQM3PA");
    expect(isInviteCode("K7XQM3PA")).toBe(true);
    expect(formatInviteCode("K7XQM3PA")).toBe("K7XQ-M3PA");
  });

  it("rejects wrong length and look-alike characters", () => {
    expect(isInviteCode("K7XQM3P")).toBe(false);
    expect(isInviteCode("K7XQM3PA9")).toBe(false);
    expect(isInviteCode("O7XQM3PA")).toBe(false);
    expect(isInviteCode("17XQM3PA")).toBe(false);
  });

  it("has no characters that are easy to mix up", () => {
    for (const c of "01ILO") expect(INVITE_ALPHABET).not.toContain(c);
  });
});
