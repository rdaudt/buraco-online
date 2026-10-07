import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Buraco Clube — sua mesa está aberta",
  description: "Buraco online para amigos. Crie uma mesa para 2 ou 4 jogadores e jogue quantas rodadas quiser.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
