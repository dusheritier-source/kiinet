import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import PWARegistrar from "@/components/PWARegistrar";
import ThemeSync from "@/components/ThemeSync";
import { AuthProvider } from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";
import ReactQueryProvider from "@/components/ReactQueryProvider";
import BottomNav from "@/components/BottomNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Kinet",
    template: "%s | Kinet",
  },
  applicationName: "Kinet",
  description: "Share, discover, and connect with your community.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kinet",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  userScalable: false,
  themeColor: "#22d3ee",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-background text-foreground`}>
        <ReactQueryProvider>
          <AuthProvider>
            <PWARegistrar />
            <ThemeSync />
            <Navbar />
            <main className="mobile-safe-shell mx-auto min-h-[100svh] w-full min-w-0 overflow-x-hidden px-3 py-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-4 md:px-6 md:py-6 md:pb-6">
              {children}
            </main>
            <BottomNav />
          </AuthProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
