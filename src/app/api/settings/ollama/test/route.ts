import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { decryptSecret, isCryptoConfigured } from "@/lib/crypto";
import { testConnection } from "@/lib/ollama";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/settings/ollama/test
 * Tests the stored Ollama Cloud key by calling GET /v1/models.
 * Returns { ok: true, models: number } on success, or { ok: false, error: string }.
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    // Light rate limit: 5 tests / 5 min / user — prevents abuse / brute force
    const rl = rateLimit({
      key: `ollama-test:${session.user.id}`,
      limit: 5,
      windowMs: 5 * 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: `Zu viele Tests. Versuche es in ${rl.retryAfter}s erneut.` },
        { status: 429 }
      );
    }

    if (!isCryptoConfigured()) {
      return NextResponse.json(
        { ok: false, error: "Server ist nicht korrekt konfiguriert: ENCRYPTION_KEY fehlt." },
        { status: 500 }
      );
    }

    const config = await prisma.userOllamaConfig.findUnique({
      where: { userId: session.user.id },
    });
    if (!config) {
      return NextResponse.json(
        { ok: false, error: "Kein API-Key konfiguriert" },
        { status: 400 }
      );
    }

    const apiKey = decryptSecret({
      ciphertext: config.encryptedApiKey,
      iv: config.keyIv,
      authTag: config.keyAuthTag,
    });

    try {
      const result = await testConnection(apiKey);
      return NextResponse.json({ ok: true, models: result.models, model: config.defaultModel });
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : "Unbekannter Fehler" },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("Error testing Ollama connection:", error);
    return NextResponse.json(
      { ok: false, error: "Unerwarteter Serverfehler" },
      { status: 500 }
    );
  }
}
