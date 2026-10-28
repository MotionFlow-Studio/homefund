import "server-only";
import { env } from "@/server/env";

const BASE_URL = "https://api.meta.ai/v1";

/** A failed call to the Meta Model API. `status` is the HTTP status, 0 if none. */
export class MetaApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function headers(accept = "application/json") {
  const key = env.metaApiKey;
  if (!key) throw new MetaApiError(0, "META_API_KEY is not set");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: accept };
}

function imageContent(prompt: string, jpeg: Buffer) {
  return [
    {
      type: "message",
      role: "user",
      content: [
        { type: "input_text", text: prompt },
        { type: "input_image", image_url: `data:image/jpeg;base64,${jpeg.toString("base64")}` },
      ],
    },
  ];
}

/**
 * Asks SAM 3.1 to find something in a photo. SAM only answers as a stream;
 * the text deltas are joined and returned, e.g. `<|box;x1=..;...|><|mask;...|>`.
 * Empty text means nothing was found.
 */
export async function segment(jpeg: Buffer, prompt: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(`${BASE_URL}/responses`, {
    method: "POST",
    headers: headers("text/event-stream"),
    body: JSON.stringify({
      model: "sam-3.1",
      stream: true,
      metadata: { include_confidence: "true", mask_encoding: "one_bit" },
      input: imageContent(prompt, jpeg),
    }),
    signal,
  });
  if (!response.ok) throw new MetaApiError(response.status, "SAM request failed");

  let text = "";
  for (const line of (await response.text()).split("\n")) {
    if (!line.startsWith("data:")) continue;
    try {
      const event = JSON.parse(line.slice(5));
      if (event.type === "response.output_text.delta") text += event.delta;
      if (event.type === "error" || event.type === "response.failed") {
        throw new MetaApiError(response.status, "SAM stream failed");
      }
    } catch (error) {
      if (error instanceof MetaApiError) throw error;
    }
  }
  return text;
}

/**
 * Asks Muse Spark 1.3 a text question with instructions and gets an answer
 * that follows the given JSON schema. Returns the JSON text.
 */
export async function askAsJson(
  instructions: string,
  question: string,
  schema: { name: string; schema: object },
  effort: "minimal" | "low" | "medium" | "high",
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(`${BASE_URL}/responses`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: "muse-spark-1.3",
      reasoning: { effort },
      text: { format: { type: "json_schema", name: schema.name, schema: schema.schema, strict: true } },
      input: [
        { type: "message", role: "system", content: [{ type: "input_text", text: instructions }] },
        { type: "message", role: "user", content: [{ type: "input_text", text: question }] },
      ],
    }),
    signal,
  });
  if (!response.ok) throw new MetaApiError(response.status, "Muse Spark request failed");
  return outputText(await response.json());
}

function outputText(body: { output_text?: unknown; output?: { content?: { type: string; text?: string }[] }[] }): string {
  if (typeof body.output_text === "string") return body.output_text;
  return (body.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text")
    .map((part) => part.text ?? "")
    .join("");
}

/**
 * Asks Muse Spark 1.3 about an image and gets an answer that follows the
 * given JSON schema. Returns the JSON text.
 */
export async function readImageAsJson(
  jpeg: Buffer,
  prompt: string,
  schema: { name: string; schema: object },
  effort: "minimal" | "low" | "medium" | "high",
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(`${BASE_URL}/responses`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: "muse-spark-1.3",
      reasoning: { effort },
      text: { format: { type: "json_schema", name: schema.name, schema: schema.schema, strict: true } },
      input: imageContent(prompt, jpeg),
    }),
    signal,
  });
  if (!response.ok) throw new MetaApiError(response.status, "Muse Spark request failed");

  return outputText(await response.json());
}
