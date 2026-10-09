import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oblivion — Ephemeral Knowledge Graph",
  description:
    "Transform overwhelming chat exports into a minimal Attention Ledger showing only active obligations and pending questions. Zero-knowledge, local-first.",
  keywords: ["chat", "productivity", "AI", "privacy", "local-first"],
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
