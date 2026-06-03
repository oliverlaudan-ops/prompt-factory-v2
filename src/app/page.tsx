import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { DeleteButton } from "./delete-button";
import { SignOutButton } from "./signout-button";
import { FavoriteButton } from "./favorite-button";
import { CopyButton } from "./copy-button";

async function getPrompts(userId?: string) {
  if (userId) {
    return prisma.prompt.findMany({
      where: { userId },
      orderBy: [{ isFavorite: "desc" }, { createdAt: "desc" }],
    });
  }

  return prisma.prompt.findMany({
    where: { isPublic: true },
    orderBy: [{ isFavorite: "desc" }, { createdAt: "desc" }],
  });
}

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  const prompts = await getPrompts(session?.user?.id);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                Prompt Factory
              </h1>
              <p className="text-gray-600 mt-2">
                {session?.user
                  ? `Willkommen zurück, ${session.user.name || session.user.email}!`
                  : "Deine persönliche Prompt-Bibliothek"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {session?.user ? (
                <>
                  <Link
                    href="/prompts/new"
                    className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                  >
                    + Neuer Prompt
                  </Link>
                  <SignOutButton />
                </>
              ) : (
                <>
                  <Link
                    href="/auth/signup"
                    className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
                  >
                    Registrieren
                  </Link>
                  <Link
                    href="/auth/signin"
                    className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                  >
                    Anmelden
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>

        {!session?.user && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800">
              📢 <strong>Hinweis:</strong> Melde dich an, um deine eigene
              Prompt-Bibliothek zu verwalten und neue Prompts zu erstellen.
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {prompts.map((prompt) => {
            const isOwner = session?.user?.id === prompt.userId;
            return (
              <div
                key={prompt.id}
                className="bg-white rounded-lg shadow p-6 flex flex-col"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 flex-1">
                    {prompt.title}
                  </h3>
                  {isOwner && (
                    <FavoriteButton
                      id={prompt.id}
                      initial={prompt.isFavorite}
                    />
                  )}
                  {!isOwner && prompt.isFavorite && <span>⭐</span>}
                </div>
                {prompt.description && (
                  <p className="text-gray-600 text-sm mb-3">
                    {prompt.description}
                  </p>
                )}
                {prompt.content && (
                  <pre className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded p-2 mb-3 overflow-x-auto whitespace-pre-wrap break-words line-clamp-4">
                    {prompt.content}
                  </pre>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-500 mt-auto">
                  {prompt.category && (
                    <span className="bg-gray-100 px-2 py-1 rounded">
                      {prompt.category}
                    </span>
                  )}
                  {prompt.isPublic && (
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
                      öffentlich
                    </span>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                  <CopyButton content={prompt.content} />
                  {isOwner && (
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/prompts/${prompt.id}/edit`}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        ✏️ Bearbeiten
                      </Link>
                      <DeleteButton id={prompt.id} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {prompts.length === 0 && (
          <div className="text-center py-20">
            <h2 className="text-2xl font-semibold text-gray-700">
              Noch keine Prompts
            </h2>
            <p className="text-gray-500 mt-2">
              {session?.user ? (
                <>
                  Leg direkt los —{" "}
                  <Link
                    href="/prompts/new"
                    className="text-blue-600 hover:underline font-medium"
                  >
                    erstelle deinen ersten Prompt
                  </Link>
                  .
                </>
              ) : (
                "Melde dich an, um Prompts zu erstellen."
              )}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
