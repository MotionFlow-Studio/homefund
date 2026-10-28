"use client";

import { Mic, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { localToday } from "@/lib/budget";
import { VOICE_ERROR_TEXT, VOICE_MAX_SECONDS, type VoiceEntry } from "@/lib/voice-entry";
import { sendVoice, startRecording, type Recording } from "@/lib/voice-recorder";

type Stage = { name: "starting" } | { name: "listening" } | { name: "working" } | { name: "error"; message: string };

/** Listens for one spoken expense or income and hands back what was understood. */
export function VoiceSheet({ currency, onResult, onClose }: { currency: string; onResult: (entry: VoiceEntry) => void; onClose: () => void }) {
  const [stage, setStage] = useState<Stage>({ name: "starting" });
  const [seconds, setSeconds] = useState(0);
  const recording = useRef<Recording | null>(null);
  const ring = useRef<HTMLSpanElement>(null);

  async function begin() {
    setStage({ name: "starting" });
    setSeconds(0);
    try {
      recording.current = await startRecording();
      setStage({ name: "listening" });
    } catch {
      setStage({ name: "error", message: "HomeFund needs your microphone. Allow it in your browser settings, then try again." });
    }
  }

  async function finish() {
    const rec = recording.current;
    if (!rec) return;
    recording.current = null;
    setStage({ name: "working" });
    try {
      const wav = await rec.stop();
      const result = await sendVoice(wav, currency, localToday());
      if (result.ok) onResult(result.entry);
      else setStage({ name: "error", message: VOICE_ERROR_TEXT[result.error] });
    } catch {
      setStage({ name: "error", message: VOICE_ERROR_TEXT.failed });
    }
  }

  useEffect(() => {
    queueMicrotask(() => void begin());
    return () => recording.current?.cancel();
    // Starts once when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The ring follows the voice; the timer stops at the limit.
  useEffect(() => {
    if (stage.name !== "listening") return;
    let frame = 0;
    const started = performance.now();
    const tick = () => {
      const level = recording.current?.level() ?? 0;
      if (ring.current) ring.current.style.transform = `scale(${1 + level * 0.6})`;
      const s = Math.floor((performance.now() - started) / 1000);
      setSeconds(s);
      if (s >= VOICE_MAX_SECONDS) void finish();
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.name]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Say an expense" className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
      <div className="relative w-full max-w-md rounded-t-[2rem] bg-background p-8 pb-[max(2rem,env(safe-area-inset-bottom))] text-center shadow-2xl sm:rounded-[2rem]">
        <button
          type="button"
          onClick={() => {
            recording.current?.cancel();
            onClose();
          }}
          aria-label="Close"
          className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
        >
          <X size={20} />
        </button>

        <div className="relative mx-auto mt-4 flex size-36 items-center justify-center">
          <span
            ref={ring}
            aria-hidden
            className={`absolute inset-0 rounded-full bg-gradient-to-br from-teal-400/40 to-indigo-500/40 transition-transform duration-75 ${stage.name === "working" ? "animate-pulse" : ""}`}
          />
          <button
            type="button"
            onClick={() => (stage.name === "listening" ? void finish() : stage.name === "error" ? void begin() : undefined)}
            aria-label={stage.name === "listening" ? "Done" : "Start again"}
            className="relative flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-indigo-600 text-white shadow-xl shadow-indigo-500/40 transition active:scale-95"
          >
            {stage.name === "listening" ? <Square size={30} fill="currentColor" aria-hidden /> : <Mic size={36} aria-hidden />}
          </button>
        </div>

        <div aria-live="polite" className="mt-6 min-h-24">
          {stage.name === "listening" ? (
            <>
              <p className="text-xl font-bold">Listening… {seconds}s</p>
              <p className="mt-2 text-sm opacity-70">Say what you spent or received, then tap the button.</p>
              <p className="mt-3 text-sm font-medium text-brand">“Groceries at FreshMart, 42 dollars” · “Got a 200 dollar bonus”</p>
            </>
          ) : stage.name === "working" ? (
            <>
              <p className="text-xl font-bold">Understanding…</p>
              <p className="mt-2 text-sm opacity-70">Muse Voice Transcribe and Muse Spark 1.3 are on it.</p>
            </>
          ) : stage.name === "error" ? (
            <>
              <p className="text-lg font-semibold">{stage.message}</p>
              <p className="mt-2 text-sm opacity-70">Tap the microphone to try again.</p>
            </>
          ) : (
            <p className="text-lg font-semibold opacity-70">Starting the microphone…</p>
          )}
        </div>
      </div>
    </div>
  );
}
