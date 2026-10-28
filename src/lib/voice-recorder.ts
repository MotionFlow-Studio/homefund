import { VOICE_MAX_SECONDS, type VoiceEntry, type VoiceError } from "@/lib/voice-entry";

/*
 * Records a short spoken entry and turns it into the 16 kHz mono WAV the
 * transcription model expects. Everything happens in memory; nothing is
 * stored on the phone.
 */

export type Recording = {
  /** Microphone level 0-1, for the listening animation. */
  level: () => number;
  stop: () => Promise<Blob>;
  cancel: () => void;
};

export async function startRecording(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  const context = new AudioContext();
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  context.createMediaStreamSource(stream).connect(analyser);
  const samples = new Uint8Array(analyser.fftSize);

  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
  recorder.start();
  const limit = window.setTimeout(() => recorder.state === "recording" && recorder.stop(), VOICE_MAX_SECONDS * 1000);

  const release = () => {
    window.clearTimeout(limit);
    stream.getTracks().forEach((t) => t.stop());
    void context.close();
  };

  return {
    level() {
      analyser.getByteTimeDomainData(samples);
      let peak = 0;
      for (const v of samples) peak = Math.max(peak, Math.abs(v - 128));
      return Math.min(1, peak / 64);
    },
    stop() {
      return new Promise((resolve, reject) => {
        const finish = async () => {
          release();
          try {
            resolve(await toWav16k(new Blob(chunks, { type: recorder.mimeType })));
          } catch (error) {
            reject(error);
          }
        };
        if (recorder.state === "inactive") void finish();
        else {
          recorder.onstop = () => void finish();
          recorder.stop();
        }
      });
    },
    cancel() {
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
      release();
    },
  };
}

/** Decodes any recorded audio and writes it as 16-bit mono PCM WAV at 16 kHz. */
async function toWav16k(blob: Blob): Promise<Blob> {
  const RATE = 16_000;
  const decoded = await new AudioContext().decodeAudioData(await blob.arrayBuffer());
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * RATE), RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const pcm = (await offline.startRendering()).getChannelData(0);

  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => [...value].forEach((ch, i) => view.setUint8(offset + i, ch.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export async function sendVoice(
  wav: Blob,
  currency: string,
  today: string,
): Promise<{ ok: true; entry: VoiceEntry } | { ok: false; error: VoiceError }> {
  const form = new FormData();
  form.append("audio", wav, "speech.wav");
  form.append("currency", currency);
  form.append("today", today);
  let response: Response;
  try {
    response = await fetch("/api/voice", { method: "POST", body: form, credentials: "same-origin" });
  } catch {
    return { ok: false, error: "offline" };
  }
  if (response.ok) return { ok: true, entry: (await response.json()) as VoiceEntry };
  const { error } = (await response.json().catch(() => ({}))) as { error?: VoiceError };
  const known: VoiceError[] = ["no_speech", "too_long", "rate_limited", "busy"];
  return { ok: false, error: error && known.includes(error) ? error : "failed" };
}
