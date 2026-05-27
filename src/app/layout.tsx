import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prompt Factory",
  description: "Deine persönliche Prompt-Bibliothek",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">{children}</body>
    </html>
  );
}