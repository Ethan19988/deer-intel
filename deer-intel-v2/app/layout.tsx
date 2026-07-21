import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import AuthGate from "@/components/auth/AuthGate";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import ThemeManager from "@/components/ThemeManager";

// Runs before first paint to set <html data-theme> from the saved preference,
// so dark/night users never see a flash of the light theme. Kept in sync with
// lib/theme.ts (same storage key and resolution rules).
const themeInitScript = `(function(){try{var t=localStorage.getItem('deer-intel:theme');if(t!=='light'&&t!=='dark'&&t!=='night'&&t!=='auto'){t='light';}var r=t;if(t==='auto'){r=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}document.documentElement.dataset.theme=r;}catch(e){}})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Warm, characterful display face used only for headings (see globals.css).
// Body copy stays on Geist for readability; this carries the personality.
const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Deer Intel",
  description: "A simple hunting property, map, camera, and hunt log app.",
  applicationName: "Deer Intel",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Deer Intel",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2f7d43",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ThemeManager />
        <ServiceWorkerRegistration />
        <AuthProvider>
          <AuthGate>{children}</AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
