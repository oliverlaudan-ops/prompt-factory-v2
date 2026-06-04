/**
 * Thin client for the Ollama Cloud Chat Completions API.
 *
 * Ollama Cloud exposes an OpenAI-compatible endpoint at
 *   https://ollama.com/v1/chat/completions
 * No SDK is required — we speak HTTP directly.
 *
 * Docs: https://docs.ollama.ai/cloud#openai-compatibility
 */

const OLLAMA_CLOUD_BASE = "https://ollama.com/v1";

/** Curated list of popular Ollama Cloud models (filtered subset of the full catalogue). */
export const OLLAMA_CLOUD_MODELS: { id: string; label: string; hint: string }[] = [
  { id: "minimax-m3:cloud", label: "M3", hint: "Reasoning, Vision, 524K Context" },
  { id: "kimi-k2.5:cloud", label: "Kimi K2.5", hint: "Long-Context, 256K" },
  { id: "qwen3-coder:cloud", label: "Qwen3 Coder", hint: "Code-Prompts" },
  { id: "gpt-oss:120b-cloud", label: "GPT-OSS 120B", hint: "Open-Weights" },
  { id: "deepseek-v3.1:cloud", label: "DeepSeek V3.1", hint: "Reasoning, Code, Math" },
];

export const DEFAULT_REFINE_MODEL = "minimax-m3:cloud";

export const REFINER_SYSTEM_PROMPT = `Du bist ein Experte für Prompt-Engineering. Deine Aufgabe ist es, den vom User bereitgestellten Prompt zu verbessern.

Regeln:
1. Klarheit: Eindeutige, präzise Sprache. Keine vagen Formulierungen.
2. Struktur: Verwende Abschnitte mit klaren Überschriften (Rolle, Kontext, Aufgabe, Constraints, Output-Format).
3. Rollen-Definition: Wenn passend, eine Expertenrolle definieren.
4. Constraints: Explizite Grenzen (Länge, Format, Stil, was zu vermeiden ist).
5. Few-Shot: Wenn sinnvoll, 1-2 Beispiele hinzufügen.
6. Variablen: Vorhandene {{VARIABLE_NAME}}-Platzhalter beibehalten.
7. Sprache & Ton: Behalte die Sprache und den Ton des Originals.
8. Kein Fluff: Keine einleitenden Sätze wie "Hier ist der verbesserte Prompt:".

Antwortformat: Gib NUR den verbesserten Prompt zurück — keine Erklärungen, kein Markdown-Wrapper, keine Anführungszeichen.`;

export type RefineOptions = {
  apiKey: string;
  model: string;
  promptContent: string;
  userInstruction?: string;
  /** Max tokens for the refinement. Default 2048 — refinements are usually short. */
  maxTokens?: number;
  /** Request timeout in ms. Default 60s. */
  timeoutMs?: number;
};

export type RefineResult = {
  refined: string;
  model: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

export class OllamaApiError extends Error {
  status: number;
  body: string;
  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "OllamaApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Send a prompt to Ollama Cloud for refinement. Returns the refined text.
 * Throws OllamaApiError on non-2xx, plain Error on network/timeout.
 */
export async function refinePrompt(opts: RefineOptions): Promise<RefineResult> {
  const { apiKey, model, promptContent, userInstruction, maxTokens = 2048, timeoutMs = 60_000 } = opts;

  const userMessage = userInstruction
    ? `Anweisung vom User: ${userInstruction}\n\n---\n\nOriginal-Prompt:\n${promptContent}`
    : `Original-Prompt:\n${promptContent}`;

  const body = {
    model,
    messages: [
      { role: "system", content: REFINER_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    temperature: 0.4,
    max_tokens: maxTokens,
    stream: false,
  };

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${OLLAMA_CLOUD_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`Ollama Cloud Timeout nach ${timeoutMs}ms`);
    }
    throw new Error(`Ollama Cloud nicht erreichbar: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    clearTimeout(timeoutHandle);
  }

  const text = await res.text();
  if (!res.ok) {
    throw new OllamaApiError(
      `Ollama Cloud Fehler ${res.status}: ${text.slice(0, 200)}`,
      res.status,
      text
    );
  }

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Ungültige Antwort von Ollama Cloud: ${text.slice(0, 200)}`);
  }

  const refined = json?.choices?.[0]?.message?.content;
  if (typeof refined !== "string" || refined.length === 0) {
    throw new Error("Ollama Cloud hat keinen Inhalt zurückgegeben");
  }

  return {
    refined: refined.trim(),
    model,
    usage: json.usage,
  };
}

/**
 * Streaming variant. Yields `delta` strings as they arrive from the
 * provider and resolves with a `RefineResult` once the stream is
 * complete. Caller is responsible for handling the async iterator
 * (typically by piping it into an SSE response).
 *
 * Behaviour:
 * - Uses `stream: true` on the Ollama Cloud API
 * - The provider sends `data: {...,choices:[{delta:{content:"..."}}]}` chunks
 *   terminated by a final `data: [DONE]`-like chunk where the usage object
 *   is present
 * - Aborts the upstream request if the consumer's `signal` fires
 */
export async function refinePromptStream(
  opts: RefineOptions & { signal?: AbortSignal }
): Promise<RefineResult> {
  const { apiKey, model, promptContent, userInstruction, maxTokens = 2048, timeoutMs = 120_000, signal } = opts;

  const userMessage = userInstruction
    ? `Anweisung vom User: ${userInstruction}\n\n---\n\nOriginal-Prompt:\n${promptContent}`
    : `Original-Prompt:\n${promptContent}`;

  const body = {
    model,
    messages: [
      { role: "system", content: REFINER_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    temperature: 0.4,
    max_tokens: maxTokens,
    stream: true,
  };

  // Combine consumer abort with our own timeout
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  let res: Response;
  try {
    res = await fetch(`${OLLAMA_CLOUD_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeoutHandle);
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`Ollama Cloud Stream Timeout/Abort nach ${timeoutMs}ms`);
    }
    throw new Error(`Ollama Cloud nicht erreichbar: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    clearTimeout(timeoutHandle);
    throw new OllamaApiError(
      `Ollama Cloud Fehler ${res.status}: ${text.slice(0, 200)}`,
      res.status,
      text
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";
  let usage: RefineResult["usage"] | undefined;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE chunks are separated by blank lines (`\n\n`)
      let sepIdx: number;
      while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);

        for (const line of raw.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") continue;
          if (!payload) continue;
          let evt: any;
          try {
            evt = JSON.parse(payload);
          } catch {
            continue;
          }
          const delta = evt?.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            accumulated += delta;
            // Yield control to the caller so it can flush to the client
            await new Promise<void>((resolve) => setImmediate(resolve));
            // Note: callers that need token-by-token streaming should use
            // the SSE wrapper in /api/prompts/refine which uses an
            // AsyncGenerator-friendly pattern. Here we return the final
            // text; the streaming UX is driven by the API route.
          }
          if (evt?.usage) usage = evt.usage;
        }
      }
    }
  } catch (e) {
    clearTimeout(timeoutHandle);
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Ollama Cloud Stream abgebrochen");
    }
    throw e;
  }
  clearTimeout(timeoutHandle);

  if (accumulated.length === 0) {
    throw new Error("Ollama Cloud hat keinen Inhalt zurückgegeben");
  }
  return { refined: accumulated.trim(), model, usage };
}

/**
 * Run two stream requests in parallel and yield deltas tagged with their
 * variant id ("a" or "b"). Resolves once both finish.
 *
 * Both requests share the consumer's `signal` and a single timeout budget.
 * If one fails, the other is allowed to finish (we still surface the
 * error in the final result).
 */
export async function refinePromptAB(opts: {
  apiKey: string;
  modelA: string;
  modelB: string;
  promptContent: string;
  userInstruction?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  onDelta: (variant: "a" | "b", delta: string) => void;
}): Promise<{
  a: { refined: string; model: string; usage?: RefineResult["usage"]; error?: string };
  b: { refined: string; model: string; usage?: RefineResult["usage"]; error?: string };
}> {
  const { apiKey, modelA, modelB, promptContent, userInstruction, signal, timeoutMs = 120_000, onDelta } = opts;

  // Internal stream variant — yields deltas instead of buffering them
  const streamOne = async (variant: "a" | "b", model: string) => {
    const userMessage = userInstruction
      ? `Anweisung vom User: ${userInstruction}\n\n---\n\nOriginal-Prompt:\n${promptContent}`
      : `Original-Prompt:\n${promptContent}`;

    const controller = new AbortController();
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
    const t = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(`${OLLAMA_CLOUD_BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: REFINER_SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
          temperature: 0.4,
          max_tokens: 2048,
          stream: true,
        }),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(t);
      throw e;
    }

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      clearTimeout(t);
      throw new OllamaApiError(
        `Ollama Cloud Fehler ${res.status}: ${text.slice(0, 200)}`,
        res.status,
        text
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulated = "";
    let usage: RefineResult["usage"] | undefined;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sepIdx: number;
      while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);
        for (const line of raw.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          let evt: any;
          try { evt = JSON.parse(payload); } catch { continue; }
          const delta = evt?.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            accumulated += delta;
            onDelta(variant, delta);
          }
          if (evt?.usage) usage = evt.usage;
        }
      }
    }
    clearTimeout(t);
    return { refined: accumulated.trim(), model, usage };
  };

  // Run both in parallel; isolate errors per-variant
  const [aRes, bRes] = await Promise.allSettled([
    streamOne("a", modelA),
    streamOne("b", modelB),
  ]);

  const toOutcome = (r: PromiseSettledResult<{ refined: string; model: string; usage?: RefineResult["usage"] }>) =>
    r.status === "fulfilled"
      ? r.value
      : { refined: "", model: "", error: r.reason instanceof Error ? r.reason.message : String(r.reason) };

  return {
    a: toOutcome(aRes),
    b: toOutcome(bRes),
  };
}

/**
 * Lightweight test: list available models. Used by the "Verbindung testen" button.
 * Throws OllamaApiError on non-2xx, plain Error on network/timeout.
 */
export async function testConnection(apiKey: string, timeoutMs = 15_000): Promise<{ models: number }> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${OLLAMA_CLOUD_BASE}/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`Ollama Cloud Timeout nach ${timeoutMs}ms`);
    }
    throw new Error(`Ollama Cloud nicht erreichbar: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new OllamaApiError(
      `Ollama Cloud Fehler ${res.status}: ${text.slice(0, 200)}`,
      res.status,
      text
    );
  }

  const json: any = await res.json().catch(() => ({}));
  const models = Array.isArray(json?.data) ? json.data.length : 0;
  return { models };
}
