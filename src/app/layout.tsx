import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { GlobalErrorBanner } from "@/components/error-banner";

export const metadata: Metadata = {
  title: "Maestro",
  description: "Orchestrate your OpenCode agent swarms",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          <GlobalErrorBanner />
          {children}
        </Providers>
      </body>
    </html>
  );
}
