"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { CurrentUser } from "@/lib/auth-client";
import { formatInviteCode, isInviteCode, normalizeInviteCode } from "@/lib/invite-code";
import { INVITE_ERROR_TEXT, joinHousehold } from "@/lib/invites";

/** Joins an existing household with the code its owner shared. */
export function JoinHousehold({
  user,
  initialCode = "",
  onJoined,
}: {
  user: CurrentUser;
  initialCode?: string;
  onJoined?: () => void;
}) {
  const [code, setCode] = useState(() => {
    const clean = normalizeInviteCode(initialCode);
    return isInviteCode(clean) ? formatInviteCode(clean) : initialCode;
  });
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("memberName") ?? "").trim();
    if (!isInviteCode(normalizeInviteCode(code))) return setError("Enter the 8-character code, for example K7XQ-M3PA.");
    if (!name) return setError("Enter your name.");
    setError(null);
    setJoining(true);
    const result = await joinHousehold(code, name);
    if (!result.ok) {
      setJoining(false);
      return setError(INVITE_ERROR_TEXT[result.error]);
    }
    onJoined?.();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Invite code</span>
        <input
          name="code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase().slice(0, 12));
            setError(null);
          }}
          placeholder="K7XQ-M3PA"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          className="h-14 rounded-2xl border border-black/10 bg-white/90 shadow-sm shadow-black/[0.03] px-4 text-center font-mono text-2xl tracking-[0.2em] uppercase outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15 dark:border-white/15 dark:bg-white/5"
        />
      </label>
      <Field label="Your name" name="memberName" defaultValue={user.name} autoComplete="name" maxLength={60} required />
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <Button type="submit" loading={joining}>
        Join household
      </Button>
    </form>
  );
}
