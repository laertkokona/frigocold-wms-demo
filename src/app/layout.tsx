import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = { title: "FrigoCold WMS", description: "Sistemi i menaxhimit të magazinës frigoriferike — Frigo ALBA" };
export const viewport: Viewport = { themeColor: "#0d1220", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sq" className="dark">
      <body className="min-h-screen font-sans">
        {children}
        <Toaster theme="dark" position="bottom-center" toastOptions={{ style: { background: "hsl(222 28% 14%)", border: "1px solid hsl(222 22% 22%)", color: "hsl(210 30% 94%)" } }} />
      </body>
    </html>
  );
}
