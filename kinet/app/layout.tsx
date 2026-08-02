import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import PWARegistrar from "@/components/PWARegistrar";
import ThemeSync from "@/components/ThemeSync";
import { AuthProvider } from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";
import ReactQueryProvider from "@/components/ReactQueryProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Welcome",
  description: "Share, discover, and connect with your community.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Welcome",
  },
};

export const viewport = {
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
            <main className="mx-auto min-h-screen w-full max-w-screen-2xl px-3 py-4 pb-20 sm:px-4 md:px-6 md:py-6">
              {children}
            </main>
          </AuthProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
