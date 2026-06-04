import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { decryptSecret, isCryptoConfigured } from "@/lib/crypto";
import {
  refinePromptAB,
  OllamaApiError,
  DEFAULT_REFINE_MODEL,
  OLLAMA_CLOUD_MODELS,
} from "@/lib/ollama";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/prompts/refine
 *
 * Streams an A/B refinement via Server-Sent Events:
 *   event: meta     → { modelA, modelB, original }
 *   event: delta    → { variant: "a"|"b", text: "..." }
 *   event: result   → { variant, model, usage }
 *   event: done     → {}
 *   event: error    → { message }
 *
 * Body: { promptId, instruction?, modelA?, modelB?, mode?: "ab" | "single" }
 *   - mode "ab" (default): generates two variants in parallel
 *   - mode "single": only variant A, with the user's default model
 *
 * Rate-limit: 20 / hour / user (counted per request, not per variant).
 */
export async function POST(request: NextRequest) {
  // We need the raw stream for SSE, so we can't wrap this in try/catch
  // around the whole body. Instead, use a helper to send a final error event
  // and return the Response. For the pre-stream checks, plain try/catch is fine.

  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Nicht autorisiert" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rl = rateLimit({
    key: `refine:${session.user.id}`,
    limit: 20,
    windowMs: 60 * 60_000,
  });
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ error: `Rate-Limit erreicht. Bitte in ${rl.retryAfter}s erneut versuchen.` }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!isCryptoConfigured()) {
    return new Response(
      JSON.stringify({ error: "Server ist nicht korrekt konfiguriert: ENCRYPTION_KEY fehlt." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Ungültiger Request-Body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const promptId = typeof body.promptId === "string" ? body.promptId : "";
  const instruction = typeof body.instruction === "string" ? body.instruction.slice(0, 500) : undefined;
  const mode = body.mode === "single" ? "single" : "ab";
  const requestedA = typeof body.modelA === "string" ? body.modelA : undefined;
  const requestedB = typeof body.modelB === "string" ? body.modelB : undefined;

  if (!promptId) {
    return new Response(JSON.stringify({ error: "promptId ist erforderlich" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const prompt = await prisma.prompt.findUnique({ where: { id: promptId } });
  if (!prompt) {
    return new Response(JSON.stringify({ error: "Prompt nicht gefunden" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (prompt.userId !== session.user.id) {
    return new Response(JSON.stringify({ error: "Keine Berechtigung" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!prompt.content || prompt.content.trim().length < 10) {
    return new Response(
      JSON.stringify({ error: "Prompt-Inhalt ist zu kurz für eine Verfeinerung (min. 10 Zeichen)" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const config = await prisma.userOllamaConfig.findUnique({
    where: { userId: session.user.id },
  });
  if (!config) {
    return new Response(
      JSON.stringify({ error: "Kein Ollama API-Key konfiguriert. Bitte in den Einstellungen hinterlegen." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const validIds = new Set(OLLAMA_CLOUD_MODELS.map((m) => m.id));
  const fallback = config.defaultModel || DEFAULT_REFINE_MODEL;
  const modelA = requestedA && validIds.has(requestedA) ? requestedA : fallback;
  const modelB =
    requestedB && validIds.has(requestedB)
      ? requestedB
      : OLLAMA_CLOUD_MODELS.find((m) => m.id !== modelA)?.id || modelA;

  const apiKey = decryptSecret({
    ciphertext: config.encryptedApiKey,
    iv: config.keyIv,
    authTag: config.keyAuthTag,
  });

  // === Build SSE stream ===
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      // Heartbeat to keep proxies from closing the connection
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          // controller closed
        }
      }, 15_000);

      // Hook into the request's abort signal so client disconnects
      // cancel both upstream requests promptly
      const onAbort = () => {
        send("error", { message: "Client hat Verbindung getrennt" });
        try { controller.close(); } catch {}
      };
      request.signal.addEventListener("abort", onAbort, { once: true });

      try {
        console.log(`[refine] start mode=${mode} modelA=${modelA} modelB=${modelB} prompt=${promptId}`);
        send("meta", { modelA, modelB, original: prompt.content, mode });

        if (mode === "single") {
          // Single-variant mode: run only A and emit variant "a" deltas
          const result = await refinePromptAB({
            apiKey,
            modelA,
            modelB: modelA, // ignored by streamOne's Promise.allSettled but we read only a
            promptContent: prompt.content,
            userInstruction: instruction,
            signal: request.signal,
            onDelta: (variant, text) => send("delta", { variant, text }),
          });
          // In single mode we only care about "a" — modelB was the same call
          const a = result.a;
          send("result", {
            variant: "a",
            model: a.model || modelA,
            usage: a.usage,
            error: a.error,
          });
          if (a.error) send("error", { message: a.error });
        } else {
          const result = await refinePromptAB({
            apiKey,
            modelA,
            modelB,
            promptContent: prompt.content,
            userInstruction: instruction,
            signal: request.signal,
            onDelta: (variant, text) => send("delta", { variant, text }),
          });

          send("result", {
            variant: "a",
            model: result.a.model || modelA,
            usage: result.a.usage,
            error: result.a.error,
          });
          send("result", {
            variant: "b",
            model: result.b.model || modelB,
            usage: result.b.usage,
            error: result.b.error,
          });
          if (result.a.error && result.b.error) {
            send("error", { message: `Beide Varianten fehlgeschlagen: A=${result.a.error}; B=${result.b.error}` });
          }
        }

        send("done", {});

        // Log only model + tokens
        console.log(
          `[refine] done user=${session.user?.id ?? "?"} prompt=${promptId} mode=${mode} models=${modelA},${modelB}`
        );
      } catch (e) {
        if (e instanceof OllamaApiError) {
          send("error", { message: `Ollama: ${e.message}` });
        } else {
          send("error", { message: e instanceof Error ? e.message : "Unbekannter Fehler" });
        }
      } finally {
        clearInterval(heartbeat);
        try { controller.close(); } catch {}
      }
    },
    cancel() {
      // Browser disconnected
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx buffering
    },
  });
}
