import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const prompt = await prisma.prompt.findUnique({ where: { id } });

    if (!prompt) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    if (!prompt.isPublic) {
      const session = await auth();
      if (!session?.user?.id || session.user.id !== prompt.userId) {
        return NextResponse.json(
          { error: "Keine Berechtigung" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(prompt);
  } catch (err) {
    console.error("Error fetching prompt:", err);
    return NextResponse.json(
      { error: "Fehler beim Laden" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const { title, description, content, category, tags, isPublic } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: "Titel und Content sind erforderlich" },
        { status: 400 }
      );
    }

    const existing = await prisma.prompt.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    if (existing.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const updated = await prisma.prompt.update({
      where: { id },
      data: {
        title,
        description: description || null,
        content,
        category: category || null,
        tags: tags || null,
        isPublic: Boolean(isPublic),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Error updating prompt:", err);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { id } = await context.params;

    const prompt = await prisma.prompt.findUnique({ where: { id } });
    if (!prompt) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    if (prompt.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    await prisma.prompt.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error deleting prompt:", err);
    return NextResponse.json(
      { error: "Fehler beim Löschen" },
      { status: 500 }
    );
  }
}
