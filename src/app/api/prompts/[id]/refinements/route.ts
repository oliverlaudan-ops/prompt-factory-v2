import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * GET  /api/prompts/[id]/refinements  — list (latest first)
 * POST /api/prompts/[id]/refinements  — save a new refinement
 *
 * Both require the user to own the prompt.
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { id: promptId } = await params;
    const prompt = await prisma.prompt.findUnique({
      where: { id: promptId },
      select: { userId: true },
    });
    if (!prompt) {
      return NextResponse.json({ error: "Prompt nicht gefunden" }, { status: 404 });
    }
    if (prompt.userId !== session.user.id) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const url = new URL(request.url);
    const limitParam = Number(url.searchParams.get("limit"));
    const limit = Math.min(50, Math.max(1, Number.isFinite(limitParam) ? limitParam : 10));

    const refinements = await prisma.refinement.findMany({
      where: { promptId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ refinements });
  } catch (error) {
    console.error("Error loading refinements:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Verfeinerungen" },
      { status: 500 }
    );
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { id: promptId } = await params;
    const prompt = await prisma.prompt.findUnique({ where: { id: promptId } });
    if (!prompt) {
      return NextResponse.json({ error: "Prompt nicht gefunden" }, { status: 404 });
    }
    if (prompt.userId !== session.user.id) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await request.json();
    const sourceText = typeof body.sourceText === "string" ? body.sourceText : "";
    const refinedText = typeof body.refinedText === "string" ? body.refinedText : "";
    const model = typeof body.model === "string" ? body.model : "";
    const instruction = typeof body.instruction === "string" ? body.instruction.slice(0, 500) : null;
    const promptTokens = Number.isFinite(body.promptTokens) ? Number(body.promptTokens) : null;
    const completionTokens = Number.isFinite(body.completionTokens) ? Number(body.completionTokens) : null;
    const totalTokens = Number.isFinite(body.totalTokens) ? Number(body.totalTokens) : null;

    if (!sourceText || !refinedText || !model) {
      return NextResponse.json(
        { error: "sourceText, refinedText und model sind erforderlich" },
        { status: 400 }
      );
    }

    const refinement = await prisma.refinement.create({
      data: {
        promptId,
        sourceText,
        refinedText,
        model,
        instruction: instruction || null,
        promptTokens,
        completionTokens,
        totalTokens,
      },
    });

    return NextResponse.json({ ok: true, refinement });
  } catch (error) {
    console.error("Error saving refinement:", error);
    return NextResponse.json(
      { error: "Fehler beim Speichern der Verfeinerung" },
      { status: 500 }
    );
  }
}
