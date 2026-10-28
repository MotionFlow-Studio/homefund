"use client";

import { Camera as CameraIcon, Flashlight, FlashlightOff, Images, X } from "lucide-react";
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
export function Camera({ onPhoto, onClose }: { onPhoto: (photo: Blob) => void; onClose: () => void }) {
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
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
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
            <div className="relative aspect-[5/8] max-h-full w-full max-w-sm rounded-2xl border-2 border-white/80 shadow-[0_0_0_200vmax_rgba(0,0,0,0.45)]" />
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
            <p className="rounded-full bg-black/50 px-3 py-1.5 text-sm font-medium">Fit the whole receipt in the frame</p>
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
          <NoLiveCamera denied={state === "denied"} onPicked={onPicked} />
        ) : null}
      </div>

      {state === "live" || state === "starting" ? (
        <div className="flex items-center justify-between px-8 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <label className="flex size-12 cursor-pointer items-center justify-center rounded-full bg-white/15 active:bg-white/25">
            <Images size={22} aria-hidden />
            <span className="sr-only">Choose a photo from your library</span>
            <input type="file" accept="image/*" className="sr-only" onChange={onPicked} />
          </label>
          <button
            type="button"
            onClick={takePhoto}
            disabled={state !== "live" || taking}
            aria-label="Take photo"
            className="flex size-[4.5rem] items-center justify-center rounded-full border-4 border-white/90 transition active:scale-95 disabled:opacity-40"
          >
            <span className="size-14 rounded-full bg-white" />
          </button>
          <span className="size-12" />
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
      className={`flex size-11 items-center justify-center rounded-full ${pressed ? "bg-accent text-neutral-900" : "bg-black/50 text-white"}`}
    >
      {children}
    </button>
  );
}

/** When the live camera cannot be used: the phone's camera app or the photo library. */
function NoLiveCamera({
  denied,
  onPicked,
}: {
  denied: boolean;
  onPicked: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
      <CameraIcon size={40} aria-hidden className="opacity-70" />
      <p className="max-w-xs text-sm opacity-80">
        {denied
          ? "HomeFund may not use the camera. You can allow it in your browser settings, or take the photo with your camera app."
          : "The live camera is not available here. Take the photo with your camera app or pick one from your library."}
      </p>
      <label className="flex h-12 w-full max-w-xs cursor-pointer items-center justify-center gap-2 rounded-2xl bg-brand font-semibold">
        <CameraIcon size={20} aria-hidden /> Take a photo
        <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={onPicked} />
      </label>
      <label className="flex h-12 w-full max-w-xs cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white/15 font-semibold">
        <Images size={20} aria-hidden /> Choose from library
        <input type="file" accept="image/*" className="sr-only" onChange={onPicked} />
      </label>
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
