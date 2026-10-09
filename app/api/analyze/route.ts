import { runPipeline } from "@/lib/pipeline";
import { buildResponse } from "@/lib/serialize";
import { buildRedactor } from "@/lib/redact";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

type Body = {
  chat?: string;
  model?: string;
  redact?: boolean;
  sources?: boolean;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const chat = (body.chat || "").trim();
  if (!chat) {
    return Response.json({ error: "No chat text provided." }, { status: 400 });
  }

  const apiKey =
    req.headers.get("x-groq-key")?.trim() || process.env.GROQ_API_KEY?.trim();

  if (!apiKey) {
    return Response.json(
      {
        error:
          "No Groq API key. Set GROQ_API_KEY in your environment, or paste a key in the settings panel.",
      },
      { status: 401 },
    );
  }

  const encoder = new TextEncoder();
  const redact = body.redact === true;
  const sources = body.sources === true;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      };

      try {
        const { known, msgs, trace, windows } = await runPipeline(chat, {
          model: body.model,
          apiKey,
          onProgress: (update) => send({ type: "progress", ...update }),
        });

        const redaction = redact ? buildRedactor(msgs) : null;

        const payload = buildResponse(known, msgs, windows, {
          redact: redaction?.redact,
          sources,
          trace,
        });

        send({ type: "result", payload });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unexpected error during analysis.";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
