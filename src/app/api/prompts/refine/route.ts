import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { decryptSecret, isCryptoConfigured } from "@/lib/crypto";
import { refinePrompt, OllamaApiError, DEFAULT_REFINE_MODEL } from "@/lib/ollama";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/prompts/refine
 * Body: { promptId: string, instruction?: string, model?: string }
 *
 * Loads the prompt (owner-check), decrypts the user's Ollama key, and
 * asks the configured model to refine the prompt. The cleartext key and
 * the refined prompt body are never persisted by this endpoint — we only
 * return the refinement to the client.
 *
 * Rate-limit: 20 / hour / user. We log only model + token counts.
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const rl = rateLimit({
      key: `refine:${session.user.id}`,
      limit: 20,
      windowMs: 60 * 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        {
          error: `Rate-Limit erreicht. Bitte in ${rl.retryAfter}s erneut versuchen.`,
        },
        { status: 429 }
      );
    }

    if (!isCryptoConfigured()) {
      return NextResponse.json(
        { error: "Server ist nicht korrekt konfiguriert: ENCRYPTION_KEY fehlt." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const promptId = typeof body.promptId === "string" ? body.promptId : "";
    const instruction = typeof body.instruction === "string" ? body.instruction.slice(0, 500) : undefined;
    const requestedModel = typeof body.model === "string" ? body.model : undefined;

    if (!promptId) {
      return NextResponse.json({ error: "promptId ist erforderlich" }, { status: 400 });
    }

    const prompt = await prisma.prompt.findUnique({ where: { id: promptId } });
    if (!prompt) {
      return NextResponse.json({ error: "Prompt nicht gefunden" }, { status: 404 });
    }
    if (prompt.userId !== session.user.id) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }
    if (!prompt.content || prompt.content.trim().length < 10) {
      return NextResponse.json(
        { error: "Prompt-Inhalt ist zu kurz für eine Verfeinerung (min. 10 Zeichen)" },
        { status: 400 }
      );
    }

    const config = await prisma.userOllamaConfig.findUnique({
      where: { userId: session.user.id },
    });
    if (!config) {
      return NextResponse.json(
        { error: "Kein Ollama API-Key konfiguriert. Bitte in den Einstellungen hinterlegen." },
        { status: 400 }
      );
    }

    const apiKey = decryptSecret({
      ciphertext: config.encryptedApiKey,
      iv: config.keyIv,
      authTag: config.keyAuthTag,
    });

    const model = requestedModel || config.defaultModel || DEFAULT_REFINE_MODEL;

    try {
      const result = await refinePrompt({
        apiKey,
        model,
        promptContent: prompt.content,
        userInstruction: instruction,
      });

      // Log only model + token counts — never the prompts or the key
      console.log(
        `[refine] user=${session.user.id} prompt=${promptId} model=${result.model} ` +
          `tokens=${result.usage?.total_tokens ?? "?"}`
      );

      return NextResponse.json({
        ok: true,
        original: prompt.content,
        refined: result.refined,
        model: result.model,
        usage: result.usage,
      });
    } catch (e) {
      if (e instanceof OllamaApiError) {
        // Surface Ollama's error to the user — they need to know if e.g.
        // their key is invalid or their model is down
        return NextResponse.json(
          { error: `Ollama: ${e.message}` },
          { status: e.status === 401 || e.status === 403 ? 400 : 502 }
        );
      }
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Unbekannter Fehler" },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("Error refining prompt:", error);
    return NextResponse.json(
      { error: "Fehler beim Verfeinern des Prompts" },
      { status: 500 }
    );
  }
}
