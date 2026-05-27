import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    
    let prompts;
    
    if (session?.user?.id) {
      prompts = await prisma.prompt.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
      });
    } else {
      prompts = await prisma.prompt.findMany({
        where: { isPublic: true },
        orderBy: { createdAt: "desc" },
      });
    }
    
    return NextResponse.json(prompts);
  } catch (error) {
    console.error("Error fetching prompts:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Prompts" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Nicht autorisiert" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, description, content, category, tags, isPublic } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: "Titel und Content sind erforderlich" },
        { status: 400 }
      );
    }

    const prompt = await prisma.prompt.create({
      data: {
        userId: session.user.id,
        title,
        description: description || null,
        content,
        category: category || null,
        tags: tags || null,
        isPublic: isPublic || false,
      },
    });

    return NextResponse.json(prompt, { status: 201 });
  } catch (error) {
    console.error("Error creating prompt:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen des Prompts" },
      { status: 500 }
    );
  }
}