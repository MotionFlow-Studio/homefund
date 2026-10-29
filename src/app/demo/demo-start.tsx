"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { AUTH_ERROR_TEXT, cachedUser, startDemo, type CurrentUser } from "@/lib/auth-client";
import { isDemoEmail } from "@/lib/demo";

/*
 * Opens a fresh demo family. It starts right away, unless someone with a real
 * account uses this device: the demo would sign them out, so they confirm first.
 */

type State = { step: "checking" } | { step: "confirm"; user: CurrentUser } | { step: "starting" } | { step: "error"; message: string };

export function DemoStart() {
  const router = useRouter();
  const [state, setState] = useState<State>({ step: "checking" });
  const started = useRef(false);

  async function start() {
    if (started.current) return;
    started.current = true;
    setState({ step: "starting" });
    const result = await startDemo();
    if (result.ok) {
      router.replace("/app");
      return;
    }
    started.current = false;
    setState({ step: "error", message: AUTH_ERROR_TEXT[result.error] });
  }

  useEffect(() => {
    cachedUser().then((user) => {
      if (user && !isDemoEmail(user.email)) setState({ step: "confirm", user });
      else void start();
    });
    // Runs once when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.step === "confirm") {
    return (
      <AuthCard title="Open the demo family?" footer={<Link href="/app" className="font-semibold text-brand">Back to my budget</Link>}>
        <p className="text-center leading-relaxed opacity-80">
          You are signed in as <strong>{state.user.name || state.user.email}</strong>. The demo signs you out on this device.
          Your own data stays safe on the server.
        </p>
        <Button className="mt-6 w-full" onClick={start}>
          Open the demo
        </Button>
      </AuthCard>
    );
  }

  if (state.step === "error") {
    return (
      <AuthCard title="The demo could not start" footer={<Link href="/" className="font-semibold text-brand">Back to the home page</Link>}>
        <p role="alert" className="text-center opacity-80">
          {state.message}
        </p>
        <Button className="mt-6 w-full" onClick={start}>
          Try again
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Meet the Walkers" footer="A fresh copy, just for you. It is removed after a day.">
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-5 text-center">
        <div className="flex -space-x-3" aria-hidden>
          {[
            ["EW", "#0f766e"],
            ["JW", "#2563eb"],
            ["L", "#db2777"],
          ].map(([initials, color], i) => (
            <span
              key={initials}
              className="flex size-14 animate-bounce items-center justify-center rounded-full text-lg font-bold text-white ring-4 ring-background"
              style={{ backgroundColor: color, animationDelay: `${i * 120}ms`, animationDuration: "1.4s" }}
            >
              {initials}
            </span>
          ))}
        </div>
        <p className="leading-relaxed opacity-80">
          Setting up Emma, James and Lily: two paydays, the bills, two weeks of shopping and a scanned receipt.
        </p>
        <span className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
          <span className="demo-progress block h-full rounded-full bg-gradient-to-r from-teal-400 via-cyan-500 to-indigo-500" />
        </span>
      </div>
    </AuthCard>
  );
}
