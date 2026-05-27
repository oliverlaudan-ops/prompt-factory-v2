import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import Link from "next/link";

async function getPrompts(userId?: string) {
  if (userId) {
    return prisma.prompt.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }
  
  return prisma.prompt.findMany({
    where: { isPublic: true },
    orderBy: { createdAt: "desc" },
  });
}

export default async function Home() {
  const session = await auth();
  const prompts = await getPrompts(session?.user?.id);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                Prompt Factory
              </h1>
              <p className="text-gray-600 mt-2">
                {session 
                  ? `Willkommen zurück, ${session.user.name || session.user.email}!` 
                  : "Deine persönliche Prompt-Bibliothek"}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {session ? (
                <Link
                  href="/api/auth/signout"
                  className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg"
                >
                  Abmelden
                </Link>
              ) : (
                <Link
                  href="/auth/signin"
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Anmelden
                </Link>
              )}
            </div>
          </div>
        </header>

        {!session && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800">
              📢 <strong>Hinweis:</strong> Melde dich an, um deine eigene Prompt-Bibliothek zu verwalten.
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {prompts.map((prompt) => (
            <div key={prompt.id} className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-2">{prompt.title}</h3>
              <p className="text-gray-600 text-sm mb-4">{prompt.description}</p>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="bg-gray-100 px-2 py-1 rounded">{prompt.category}</span>
                {prompt.isFavorite && <span>⭐</span>}
              </div>
            </div>
          ))}
        </div>

        {prompts.length === 0 && (
          <div className="text-center py-20">
            <h2 className="text-2xl font-semibold text-gray-700">
              Noch keine Prompts
            </h2>
            <p className="text-gray-500 mt-2">
              {session
                ? "Erstelle deinen ersten Prompt!"
                : "Melde dich an, um Prompts zu erstellen."}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}