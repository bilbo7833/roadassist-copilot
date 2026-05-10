import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RoadAssist Co-Pilot",
  description: "AI co-pilot for roadside assistance claims",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full bg-zinc-50 text-zinc-900">{children}</body>
    </html>
  );
}
