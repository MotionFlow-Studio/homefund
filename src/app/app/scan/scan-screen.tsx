"use client";

import { Check, CircleAlert, Clock, ImageOff, RotateCcw, ScanLine, Sparkles, TriangleAlert, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/auth-client";
import { useMyHousehold } from "@/lib/household";
import type { Household, Member } from "@/lib/model";
import type { ReceiptScan } from "@/lib/receipt";
import { assessPhoto, type PhotoQuality } from "@/lib/photo-quality";
import { RETRY_SAME_PHOTO, SCAN_ERROR_TEXT, scanReceiptPhoto, type ScanFailure } from "@/lib/receipt-client";
import { ExpenseForm } from "../expense-form";
import { Camera } from "./camera";
import { ReceiptReview } from "./receipt-review";
import { LoadingScreen } from "@/components/loading";

export function ScanScreen() {
  const router = useRouter();
  const auth = useCurrentUser();
  const household = useMyHousehold(auth.status === "signed_in" ? auth.user.id : "");

  useEffect(() => {
    if (auth.status === "signed_out") router.replace("/signin");
    else if (auth.status === "signed_in" && household.status === "none") router.replace("/app");
  }, [auth.status, household.status, router]);

  if (auth.status !== "signed_in" || household.status !== "ready") {
    return <LoadingScreen />;
  }
  return <ScanFlow household={household.household} me={household.me} />;
}

type Stage =
  | { name: "camera" }
  | { name: "preview"; photo: Blob }
  | { name: "reading"; photo: Blob }
  | { name: "read"; receipt: ReceiptScan }
  | { name: "failed"; error: ScanFailure; photo: Blob; retryAfterSeconds?: number }
  | { name: "manual" };

/** After this long, reading counts as slow and manual entry is offered. */
const SLOW_AFTER_MS = 10_000;

function ScanFlow({ household, me }: { household: Household; me: Member }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ name: "camera" });
  const cancelRef = useRef<AbortController | null>(null);

  // Stop an upload in progress when the screen is left.
  useEffect(() => () => cancelRef.current?.abort(), []);

  const close = () => router.push("/app");

  function cancelReading(next: Stage) {
    cancelRef.current?.abort();
    cancelRef.current = null;
    setStage(next);
  }

  async function read(photo: Blob) {
    setStage({ name: "reading", photo });
    const cancel = new AbortController();
    cancelRef.current = cancel;
    const result = await scanReceiptPhoto(photo, household.currency, cancel.signal);
    if (cancel.signal.aborted) return;
    cancelRef.current = null;
    // On success the photo is dropped; only the result is kept. On failure it
    // stays in memory so it can be sent again without a new shot.
    setStage(
      result.ok
        ? { name: "read", receipt: result.receipt }
        : { name: "failed", error: result.error, photo, retryAfterSeconds: result.retryAfterSeconds },
    );
  }

  switch (stage.name) {
    case "camera":
      return (
        <Camera
          onClose={close}
          onPhoto={(photo) => setStage({ name: "preview", photo })}
          onManual={() => setStage({ name: "manual" })}
        />
      );
    case "preview":
      return (
        <PhotoView photo={stage.photo}>
          <PreviewActions
            photo={stage.photo}
            onRetake={() => setStage({ name: "camera" })}
            onUse={() => read(stage.photo)}
          />
        </PhotoView>
      );
    case "reading":
      return (
        <PhotoView photo={stage.photo} reading>
          <ReadingStatus onManual={() => cancelReading({ name: "manual" })} />
          <button
            type="button"
            onClick={() => cancelReading({ name: "camera" })}
            className="mt-3 h-12 w-full rounded-2xl bg-white/10 font-semibold ring-1 ring-white/15 active:bg-white/25"
          >
            Cancel
          </button>
        </PhotoView>
      );
    case "failed":
      return (
        <ScanFailed
          error={stage.error}
          retryAfterSeconds={stage.retryAfterSeconds}
          onRetry={() => read(stage.photo)}
          onRetake={() => setStage({ name: "camera" })}
          onManual={() => setStage({ name: "manual" })}
          onSignIn={() => router.push("/signin")}
        />
      );
    case "manual":
      return <ExpenseForm household={household} me={me} onClose={close} onSaved={close} />;
    case "read":
      return (
        <ReceiptReview
          receipt={stage.receipt}
          household={household}
          me={me}
          onSaved={close}
          onDiscard={() => setStage({ name: "camera" })}
        />
      );
  }
}

/**
 * Retake or use the photo. A blurry or dark photo is flagged first, because
 * small print in it may be misread.
 */
function PreviewActions({ photo, onRetake, onUse }: { photo: Blob; onRetake: () => void; onUse: () => void }) {
  const [quality, setQuality] = useState<PhotoQuality | null | "checking">("checking");

  useEffect(() => {
    let current = true;
    assessPhoto(photo).then((result) => current && setQuality(result));
    return () => {
      current = false;
    };
  }, [photo]);

  const problem =
    quality && quality !== "checking"
      ? quality.dark
        ? "This photo is too dark."
        : quality.blurry
          ? "This photo looks blurry."
          : null
      : null;

  return (
    <div className="flex flex-col gap-3">
      {problem ? (
        <div role="alert" className="flex gap-3 rounded-2xl bg-amber-400/15 p-3 text-sm text-amber-100">
          <TriangleAlert size={20} aria-hidden className="mt-0.5 shrink-0 text-accent" />
          <p>
            <span className="font-semibold">{problem}</span> Small print may be misread. Retake it with the phone held
            steady{quality !== "checking" && quality?.dark ? " and more light" : ""}.
          </p>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onRetake}
          className={`flex h-14 items-center justify-center gap-2 rounded-2xl text-lg font-semibold active:scale-[0.98] ${
            problem ? "bg-gradient-to-r from-teal-400 to-cyan-500 text-neutral-950 shadow-lg shadow-teal-500/25" : "bg-white/10 ring-1 ring-white/15 active:bg-white/25"
          }`}
        >
          <RotateCcw size={20} aria-hidden /> Retake
        </button>
        <button
          type="button"
          onClick={onUse}
          disabled={quality === "checking"}
          className={`flex h-14 items-center justify-center gap-2 rounded-2xl text-lg font-semibold active:scale-[0.98] disabled:opacity-60 ${
            problem ? "bg-white/10 ring-1 ring-white/15 active:bg-white/25" : "bg-gradient-to-r from-teal-400 to-cyan-500 text-neutral-950 shadow-lg shadow-teal-500/25"
          }`}
        >
          <ScanLine size={20} aria-hidden /> {problem ? "Use anyway" : "Use photo"}
        </button>
      </div>
    </div>
  );
}

const PHOTO_PROBLEMS: ReadonlySet<ScanFailure> = new Set(["not_a_receipt", "unreadable", "unsupported_image", "too_large"]);

/** What went wrong, and the way forward that fits it. */
function ScanFailed({
  error,
  retryAfterSeconds,
  onRetry,
  onRetake,
  onManual,
  onSignIn,
}: {
  error: ScanFailure;
  retryAfterSeconds?: number;
  onRetry: () => void;
  onRetake: () => void;
  onManual: () => void;
  onSignIn: () => void;
}) {
  const [wait, setWait] = useState(retryAfterSeconds ?? 0);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  const signedOut = error === "unauthorized" || error === "forbidden";
  const retrySame = RETRY_SAME_PHOTO.has(error);
  const Icon = error === "offline" ? WifiOff : error === "timeout" || error === "rate_limited" ? Clock : PHOTO_PROBLEMS.has(error) ? ImageOff : CircleAlert;
  const title =
    error === "offline"
      ? "No connection"
      : error === "timeout"
        ? "Reading took too long"
        : error === "unreadable"
          ? "Too blurry to read"
          : error === "not_a_receipt"
            ? "No receipt found"
            : error === "rate_limited" || error === "busy"
              ? "Please wait a moment"
              : "Could not read the receipt";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <div className="card flex flex-col gap-6 p-6 sm:p-8">
        <div>
          <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/30">
            <Icon size={26} aria-hidden />
          </span>
          <h1 className="mt-4 text-2xl font-bold">{title}</h1>
          <p role="alert" className="mt-2 opacity-80">
            {SCAN_ERROR_TEXT[error]}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {signedOut ? (
            <Button onClick={onSignIn}>Sign in again</Button>
          ) : retrySame ? (
            <>
              <Button onClick={onRetry} disabled={wait > 0}>
                {wait > 0 ? `Try again in ${wait} s` : "Try again"}
              </Button>
              <Button variant="secondary" onClick={onRetake}>
                Take a new photo
              </Button>
            </>
          ) : (
            <Button onClick={onRetake}>Take a new photo</Button>
          )}
          <Button variant="secondary" onClick={onManual}>
            Enter it yourself
          </Button>
        </div>
      </div>
    </main>
  );
}

/** Shows the taken photo full screen, with actions underneath. */
function PhotoView({ photo, reading, children }: { photo: Blob; reading?: boolean; children: React.ReactNode }) {
  const imageRef = useRef<HTMLImageElement>(null);

  // A temporary in-memory link to the photo, released when it is no longer shown.
  useEffect(() => {
    const url = URL.createObjectURL(photo);
    if (imageRef.current) imageRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#030712] text-white">
      <div className="relative min-h-0 flex-1 overflow-hidden pt-[env(safe-area-inset-top)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- a local, temporary photo */}
        <img
          ref={imageRef}
          alt="Your receipt photo"
          className={`size-full object-contain transition duration-700 ${reading ? "scale-[0.97] opacity-60 saturate-50" : ""}`}
        />
        {reading ? (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-full">
            <div className="absolute inset-0 bg-gradient-to-b from-teal-500/10 via-transparent to-indigo-500/15" />
            <div className="scan-line absolute inset-x-6 h-1 rounded-full bg-gradient-to-r from-teal-300 via-cyan-300 to-fuchsia-400 shadow-[0_0_24px_6px_rgba(45,212,191,0.55)]" />
          </div>
        ) : null}
      </div>
      <div className="mx-auto w-full max-w-md px-4 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</div>
    </div>
  );
}

const READING_STEPS = ["Finding the receipt…", "Reading the items…", "Sorting into categories…", "Checking the total…"];

function ReadingStatus({ onManual }: { onManual: () => void }) {
  const [step, setStep] = useState(0);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setStep((s) => Math.min(s + 1, READING_STEPS.length - 1)), 2200);
    const slowTimer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(slowTimer);
    };
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-3xl bg-white/[0.07] p-4 ring-1 ring-white/10 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <p role="status" className="text-base font-semibold">
            {slow ? "Taking longer than usual…" : READING_STEPS[step]}
          </p>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-2.5 py-1 text-[0.7rem] font-semibold">
            <Sparkles size={12} aria-hidden /> Meta AI
          </span>
        </div>
        <ol aria-hidden className="mt-3 grid grid-cols-4 gap-1.5">
          {READING_STEPS.map((label, i) => (
            <li key={label} className="flex flex-col gap-1.5">
              <span className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <span
                  className={`block h-full rounded-full bg-gradient-to-r from-teal-300 to-cyan-400 transition-all duration-[2000ms] ${
                    i < step ? "w-full" : i === step ? "w-2/3" : "w-0"
                  }`}
                />
              </span>
              <span className={`flex items-center gap-1 text-[0.65rem] ${i <= step ? "text-white/80" : "text-white/35"}`}>
                {i < step ? <Check size={11} strokeWidth={3} className="text-teal-300" /> : null}
                {["Find", "Read", "Sort", "Check"][i]}
              </span>
            </li>
          ))}
        </ol>
      </div>
      {slow ? (
        <button
          type="button"
          onClick={onManual}
          className="h-12 w-full rounded-2xl bg-gradient-to-r from-teal-400 to-cyan-500 text-neutral-950 shadow-lg shadow-teal-500/25 font-semibold active:scale-[0.98]"
        >
          Enter it yourself instead
        </button>
      ) : null}
    </div>
  );
}
