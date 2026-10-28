"use client";

import { RotateCcw, ScanLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/auth-client";
import { useMyHousehold } from "@/lib/household";
import type { Household, Member } from "@/lib/model";
import type { ReceiptScan } from "@/lib/receipt";
import { SCAN_ERROR_TEXT, scanReceiptPhoto, type ScanFailure } from "@/lib/receipt-client";
import { ExpenseForm } from "../expense-form";
import { Camera } from "./camera";
import { ReceiptReview } from "./receipt-review";

export function ScanScreen() {
  const router = useRouter();
  const auth = useCurrentUser();
  const household = useMyHousehold(auth.status === "signed_in" ? auth.user.id : "");

  useEffect(() => {
    if (auth.status === "signed_out") router.replace("/signin");
    else if (auth.status === "signed_in" && household.status === "none") router.replace("/app");
  }, [auth.status, household.status, router]);

  if (auth.status !== "signed_in" || household.status !== "ready") {
    return <main className="flex flex-1 items-center justify-center opacity-60">Loading…</main>;
  }
  return <ScanFlow household={household.household} me={household.me} />;
}

type Stage =
  | { name: "camera" }
  | { name: "preview"; photo: Blob }
  | { name: "reading"; photo: Blob }
  | { name: "read"; receipt: ReceiptScan }
  | { name: "failed"; error: ScanFailure }
  | { name: "manual" };

function ScanFlow({ household, me }: { household: Household; me: Member }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ name: "camera" });
  const cancelRef = useRef<AbortController | null>(null);

  // Stop an upload in progress when the screen is left.
  useEffect(() => () => cancelRef.current?.abort(), []);

  const close = () => router.push("/app");

  async function read(photo: Blob) {
    setStage({ name: "reading", photo });
    const cancel = new AbortController();
    cancelRef.current = cancel;
    const result = await scanReceiptPhoto(photo, household.currency, cancel.signal);
    if (cancel.signal.aborted) return;
    cancelRef.current = null;
    // The photo is dropped here; only the result is kept.
    setStage(result.ok ? { name: "read", receipt: result.receipt } : { name: "failed", error: result.error });
  }

  switch (stage.name) {
    case "camera":
      return <Camera onClose={close} onPhoto={(photo) => setStage({ name: "preview", photo })} />;
    case "preview":
      return (
        <PhotoView photo={stage.photo}>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setStage({ name: "camera" })}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-white/15 text-lg font-semibold active:bg-white/25"
            >
              <RotateCcw size={20} aria-hidden /> Retake
            </button>
            <button
              type="button"
              onClick={() => read(stage.photo)}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-brand text-lg font-semibold active:scale-[0.98]"
            >
              <ScanLine size={20} aria-hidden /> Use photo
            </button>
          </div>
        </PhotoView>
      );
    case "reading":
      return (
        <PhotoView photo={stage.photo} reading>
          <ReadingStatus />
          <button
            type="button"
            onClick={() => {
              cancelRef.current?.abort();
              cancelRef.current = null;
              setStage({ name: "camera" });
            }}
            className="mt-4 h-12 w-full rounded-2xl bg-white/15 font-semibold active:bg-white/25"
          >
            Cancel
          </button>
        </PhotoView>
      );
    case "failed":
      return (
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
          <div>
            <h1 className="text-2xl font-bold">Could not read the receipt</h1>
            <p className="mt-2 opacity-80">{SCAN_ERROR_TEXT[stage.error]}</p>
          </div>
          <div className="flex flex-col gap-3">
            <Button onClick={() => setStage({ name: "camera" })}>Try again</Button>
            <Button variant="secondary" onClick={() => setStage({ name: "manual" })}>
              Enter it yourself
            </Button>
          </div>
        </main>
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
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="relative min-h-0 flex-1 overflow-hidden pt-[env(safe-area-inset-top)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- a local, temporary photo */}
        <img
          ref={imageRef}
          alt="Your receipt photo"
          className={`size-full object-contain transition-opacity ${reading ? "opacity-50" : ""}`}
        />
        {reading ? (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-full">
            <div className="scan-line absolute inset-x-6 h-0.5 rounded-full bg-accent shadow-[0_0_16px_4px_rgba(251,191,36,0.6)]" />
          </div>
        ) : null}
      </div>
      <div className="px-4 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</div>
    </div>
  );
}

const READING_STEPS = ["Finding the receipt…", "Reading the items…", "Sorting into categories…", "Checking the total…"];

function ReadingStatus() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setStep((s) => Math.min(s + 1, READING_STEPS.length - 1)), 2200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <p role="status" className="text-center text-lg font-semibold">
      {READING_STEPS[step]}
    </p>
  );
}
