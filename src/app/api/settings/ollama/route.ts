import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { encryptSecret, isCryptoConfigured } from "@/lib/crypto";
import { OLLAMA_CLOUD_MODELS, DEFAULT_REFINE_MODEL } from "@/lib/ollama";

/**
 * GET /api/settings/ollama
 * Returns whether the user has a configured Ollama Cloud key (and which model).
 * The cleartext key is NEVER returned.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    if (!isCryptoConfigured()) {
      return NextResponse.json(
        { error: "Server ist nicht korrekt konfiguriert: ENCRYPTION_KEY fehlt." },
        { status: 500 }
      );
    }

    const config = await prisma.userOllamaConfig.findUnique({
      where: { userId: session.user.id },
    });

    return NextResponse.json({
      hasKey: !!config,
      defaultModel: config?.defaultModel ?? DEFAULT_REFINE_MODEL,
      modelOptions: OLLAMA_CLOUD_MODELS,
    });
  } catch (error) {
    console.error("Error loading Ollama config:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Einstellungen" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/ollama
 * Body: { apiKey: string, defaultModel?: string }
 * Encrypts and stores the key. If a config row already exists, updates it.
 */
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    if (!isCryptoConfigured()) {
      return NextResponse.json(
        { error: "Server ist nicht korrekt konfiguriert: ENCRYPTION_KEY fehlt." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const defaultModel = typeof body.defaultModel === "string" ? body.defaultModel.trim() : "";

    if (!apiKey) {
      return NextResponse.json(
        { error: "API-Key ist erforderlich" },
        { status: 400 }
      );
    }
    if (apiKey.length < 8) {
      return NextResponse.json(
        { error: "API-Key sieht zu kurz aus" },
        { status: 400 }
      );
    }
    if (defaultModel && !OLLAMA_CLOUD_MODELS.some((m) => m.id === defaultModel)) {
      return NextResponse.json(
        { error: "Unbekanntes Modell" },
        { status: 400 }
      );
    }

    const { ciphertext, iv, authTag } = encryptSecret(apiKey);

    await prisma.userOllamaConfig.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        encryptedApiKey: ciphertext,
        keyIv: iv,
        keyAuthTag: authTag,
        defaultModel: defaultModel || DEFAULT_REFINE_MODEL,
      },
      update: {
        encryptedApiKey: ciphertext,
        keyIv: iv,
        keyAuthTag: authTag,
        defaultModel: defaultModel || DEFAULT_REFINE_MODEL,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error saving Ollama config:", error);
    return NextResponse.json(
      { error: "Fehler beim Speichern der Einstellungen" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/ollama
 * Removes the user's stored Ollama config (key + model).
 */
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    await prisma.userOllamaConfig
      .delete({ where: { userId: session.user.id } })
      .catch(() => null);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting Ollama config:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen der Einstellungen" },
      { status: 500 }
    );
  }
}
