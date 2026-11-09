import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { themeScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "FrigoCold WMS",
  description: "Sistemi i menaxhimit të magazinës frigoriferike — Frigo ALBA",
  // Installable as an app ("Install app" in Chrome): the home-screen icon opens one window and brings it back, not a new tab each time.
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "FrigoCold", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#972e2b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sq" className="dark" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="min-h-screen font-sans">
        {children}
        <Toaster position="bottom-center" toastOptions={{ style: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" } }} />
      </body>
    </html>
  );
}
