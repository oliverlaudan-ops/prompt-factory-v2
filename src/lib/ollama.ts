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
