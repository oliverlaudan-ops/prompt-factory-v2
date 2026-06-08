import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  // CSRF protection: in production, the request Origin must match NEXTAUTH_URL.
  // In development, allow same-hostname requests (Vite/Next.js dev servers
  // often run on different ports than the configured NEXTAUTH_URL).
  if (process.env.NODE_ENV === "production") {
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    const expected = (process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
    if (!origin || (expected && !origin.startsWith(expected))) {
      // Allow Origin == Host (same-origin request, no Origin header needed by
      // some browsers in same-origin POSTs — defensive fallback)
      const originHost = origin ? new URL(origin).host : null;
      if (originHost !== host) {
        return NextResponse.json(
          { error: "Ungültiger Origin" },
          { status: 403 }
        );
      }
    }
  }

  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-Mail und Passwort sind erforderlich" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Passwort muss mindestens 8 Zeichen lang sein" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Diese E-Mail ist bereits registriert" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name: name || null,
        email: email.toLowerCase(),
        password: hashedPassword,
      },
    });

    return NextResponse.json(
      { id: user.id, email: user.email, name: user.name },
      { status: 201 }
    );
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json(
      { error: "Interner Fehler bei der Registrierung" },
      { status: 500 }
    );
  }
}
