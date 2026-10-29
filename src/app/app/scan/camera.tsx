"use client";

import { Camera as CameraIcon, Flashlight, FlashlightOff, Images, Keyboard, ScanLine, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type CameraState = "starting" | "live" | "denied" | "unavailable";

/** Chrome's full-resolution still capture; not in every browser or in the DOM types. */
type ImageCaptureLike = { takePhoto(): Promise<Blob> };
declare const ImageCapture: { new (track: MediaStreamTrack): ImageCaptureLike } | undefined;

/**
 * Full-screen camera for receipts: live viewfinder with a frame to line the
 * receipt up in, a shutter, the flashlight where the phone has one, and the
 * photo library. Falls back to the phone's own camera app when live camera
 * access is not possible. The camera is turned off whenever the app is in the
 * background or a photo has been taken.
 */
export function Camera({
  onPhoto,
  onClose,
  onManual,
}: {
  onPhoto: (photo: Blob) => void;
  onClose: () => void;
  /** Type the expense in instead. */
  onManual?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>("starting");
  const [torch, setTorch] = useState<boolean | null>(null);
  const [flash, setFlash] = useState(false);
  const [taking, setTaking] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (streamRef.current) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("unavailable");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 3840 }, height: { ideal: 2160 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        const track = stream.getVideoTracks()[0];
        const capabilities = (track.getCapabilities?.() ?? {}) as { torch?: boolean };
        setTorch(capabilities.torch ? false : null);
        setState("live");
      } catch (error) {
        if (cancelled) return;
        setState(error instanceof DOMException && error.name === "NotAllowedError" ? "denied" : "unavailable");
      }
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        stop();
        setTorch((on) => (on === null ? null : false));
      } else {
        start();
      }
    }

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [stop]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || torch === null) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] });
      setTorch(!torch);
    } catch {
      setTorch(null);
    }
  }

  async function takePhoto() {
    const stream = streamRef.current;
    const video = videoRef.current;
    if (!stream || !video || taking) return;
    setTaking(true);
    setFlash(true);
    navigator.vibrate?.(15);

    let photo: Blob | null = null;
    const track = stream.getVideoTracks()[0];
    // A real still is sharper than a video frame where the browser offers one.
    if (typeof ImageCapture !== "undefined" && torch !== true) {
      try {
        photo = await new ImageCapture(track).takePhoto();
      } catch {
        photo = null;
      }
    }
    if (!photo) photo = await grabFrame(video);

    stop();
    setTaking(false);
    if (photo) onPhoto(photo);
    else setState("unavailable");
  }

  function onPicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Let go of the file reference so the browser can drop its temporary copy.
    event.target.value = "";
    if (file) {
      stop();
      onPhoto(file);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#030712] text-white">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          aria-label="Camera view"
          className={`absolute inset-0 size-full object-cover transition-opacity ${state === "live" ? "opacity-100" : "opacity-0"}`}
        />

        {state === "live" ? (
          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center p-8 pt-24 pb-6">
            <div className="relative aspect-[5/8] max-h-full w-full max-w-sm rounded-3xl shadow-[0_0_0_200vmax_rgba(2,6,23,0.55)]">
              {["top-0 left-0 border-t-4 border-l-4 rounded-tl-3xl", "top-0 right-0 border-t-4 border-r-4 rounded-tr-3xl", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-3xl", "bottom-0 right-0 border-b-4 border-r-4 rounded-br-3xl"].map((corner) => (
                <span key={corner} className={`absolute size-12 border-teal-300 drop-shadow-[0_0_10px_rgba(45,212,191,0.8)] ${corner}`} />
              ))}
              <span className="scan-line absolute inset-x-5 h-0.5 rounded-full bg-gradient-to-r from-transparent via-teal-300 to-transparent opacity-70 shadow-[0_0_14px_3px_rgba(45,212,191,0.5)]" />
            </div>
          </div>
        ) : null}

        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-200 ${flash ? "opacity-80" : "opacity-0"}`}
          onTransitionEnd={() => setFlash(false)}
        />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <RoundButton label="Close camera" onClick={onClose}>
            <X size={22} />
          </RoundButton>
          {state === "live" ? (
            <p className="flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-sm font-medium ring-1 ring-white/15 backdrop-blur-md">
              <ScanLine size={15} aria-hidden className="text-teal-300" /> Fit the whole receipt in the frame
            </p>
          ) : null}
          {torch !== null ? (
            <RoundButton label={torch ? "Turn flashlight off" : "Turn flashlight on"} onClick={toggleTorch} pressed={torch}>
              {torch ? <Flashlight size={20} /> : <FlashlightOff size={20} />}
            </RoundButton>
          ) : (
            <span className="size-11" />
          )}
        </div>

        {state === "starting" ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm opacity-70">Starting camera…</p>
        ) : null}
        {state === "denied" || state === "unavailable" ? (
          <NoLiveCamera denied={state === "denied"} onPicked={onPicked} onManual={onManual} />
        ) : null}
      </div>

      {state === "live" || state === "starting" ? (
        <div className="bg-gradient-to-t from-black via-black/90 to-transparent px-6 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <p className="mb-4 flex items-center justify-center gap-1.5 text-xs font-medium text-white/60">
            <Sparkles size={13} aria-hidden className="text-fuchsia-300" /> SAM 3.1 finds it, Muse Spark 1.3 reads every line
          </p>
          <div className="mx-auto flex max-w-sm items-center justify-between">
            <label className="flex w-16 cursor-pointer flex-col items-center gap-1.5 text-[0.7rem] font-medium text-white/70">
              <span className="flex size-12 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur active:bg-white/25">
                <Images size={21} aria-hidden />
              </span>
              Library
              <input type="file" accept="image/*" className="sr-only" onChange={onPicked} aria-label="Choose a photo from your library" />
            </label>
            <button
              type="button"
              onClick={takePhoto}
              disabled={state !== "live" || taking}
              aria-label="Take photo"
              className="flex size-[5rem] items-center justify-center rounded-full bg-gradient-to-br from-teal-300 via-cyan-400 to-indigo-500 p-1 shadow-[0_0_40px_-4px_rgba(45,212,191,0.7)] transition active:scale-95 disabled:opacity-40"
            >
              <span className="flex size-full items-center justify-center rounded-full bg-black/80 p-1">
                <span className="size-full rounded-full bg-white" />
              </span>
            </button>
            {onManual ? (
              <button type="button" onClick={onManual} className="flex w-16 flex-col items-center gap-1.5 text-[0.7rem] font-medium text-white/70">
                <span className="flex size-12 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur active:bg-white/25">
                  <Keyboard size={21} aria-hidden />
                </span>
                Type it
              </button>
            ) : (
              <span className="w-16" />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RoundButton({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex size-11 items-center justify-center rounded-full ring-1 backdrop-blur-md ${pressed ? "bg-accent text-neutral-900 ring-amber-200" : "bg-white/10 text-white ring-white/15"}`}
    >
      {children}
    </button>
  );
}

/**
 * When the live camera cannot be used: the phone's camera app or the photo
 * library. On a computer a photo can also be dropped here.
 */
function NoLiveCamera({
  denied,
  onPicked,
  onManual,
}: {
  denied: boolean;
  onPicked: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onManual?: () => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file?.type.startsWith("image/")) onPicked({ target: { files: [file], value: "" } } as unknown as React.ChangeEvent<HTMLInputElement>);
      }}
      className="absolute inset-0 flex items-center justify-center overflow-hidden px-6"
    >
      <div aria-hidden className="absolute -top-40 left-1/2 h-96 w-[40rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-teal-500/30 via-cyan-500/20 to-indigo-500/30 blur-3xl" />
      <div
        className={`relative flex w-full max-w-sm flex-col items-center gap-4 rounded-[2rem] border-2 border-dashed p-8 text-center transition ${
          over ? "border-teal-300 bg-teal-400/10" : "border-white/15 bg-white/[0.04]"
        }`}
      >
        <span className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-500 to-indigo-500 shadow-lg shadow-cyan-500/30">
          <ScanLine size={30} aria-hidden />
        </span>
        <h1 className="text-xl font-bold">Scan a receipt</h1>
        <p className="text-sm leading-relaxed text-white/70">
          {denied
            ? "HomeFund may not use the camera. Allow it in your browser settings, or take the photo with your camera app."
            : "Take the photo with your camera app, pick one from your library or drop it here."}
        </p>
        <label className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-400 to-cyan-500 font-semibold text-neutral-950 shadow-lg shadow-teal-500/25">
          <CameraIcon size={20} aria-hidden /> Take a photo
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={onPicked} />
        </label>
        <label className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white/10 font-semibold ring-1 ring-white/15">
          <Images size={20} aria-hidden /> Choose from library
          <input type="file" accept="image/*" className="sr-only" onChange={onPicked} />
        </label>
        {onManual ? (
          <button type="button" onClick={onManual} className="text-sm font-semibold text-teal-300">
            Type it in instead
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** The current video frame as a JPEG. */
function grabFrame(video: HTMLVideoElement): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context || !canvas.width) return Promise.resolve(null);
  context.drawImage(video, 0, 0);
  return new Promise((resolve) =>
    canvas.toBlob(
      (blob) => {
        canvas.width = 0;
        canvas.height = 0;
        resolve(blob);
      },
      "image/jpeg",
      0.92,
    ),
  );
}
