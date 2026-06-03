import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(_req: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { id } = await context.params;

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
      data: { isFavorite: !existing.isFavorite },
      select: { id: true, isFavorite: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Error toggling favorite:", err);
    return NextResponse.json(
      { error: "Fehler beim Umschalten des Favoriten" },
      { status: 500 }
    );
  }
}
