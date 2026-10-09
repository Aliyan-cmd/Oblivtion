import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Obliivon — turn your group chat into deadlines",
  description:
    "Reads a WhatsApp group chat, extracts only the deadlines and events, and gives you a summary plus a calendar file. Hinglish aware, powered by Groq.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#080b14] font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
