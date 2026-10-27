import SharedSightingsManager from "@/components/SharedSightingsManager";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Bebas_Neue } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { PartyProvider } from "@/components/party/PartyProvider";
import PartyBuckSync from "@/components/party/PartyBuckSync";
import PartyBuckPhotoSync from "@/components/party/PartyBuckPhotoSync";
import AuthGate from "@/components/auth/AuthGate";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import StoragePersistenceBanner from "@/components/StoragePersistenceBanner";
import AccountSwitchPrompt from "@/components/auth/AccountSwitchPrompt";
import ThemeManager from "@/components/ThemeManager";

// Runs before first paint to set <html data-theme> from the saved preference,
// so dark/night users never see a flash of the light theme. Kept in sync with
// lib/theme.ts (same storage key and resolution rules).
const themeInitScript = `(function(){try{var t=localStorage.getItem('deer-intel:theme');if(t!=='daylight'&&t!=='light'&&t!=='dark'&&t!=='night'&&t!=='auto'){t='dark';}var r=t;if(t==='auto'){r=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}if(t==='daylight'){var s={sunriseMin:435,sunsetMin:1095};try{var p=JSON.parse(localStorage.getItem('deer-intel:sun')||'null');if(p&&isFinite(p.sunriseMin)&&isFinite(p.sunsetMin)){s=p;}}catch(e){}var d=new Date(),m=d.getHours()*60+d.getMinutes();r=(m>=s.sunriseMin+60&&m<s.sunsetMin-150)?'light':'dark';}document.documentElement.dataset.theme=r;}catch(e){}})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Condensed all-caps face used for every heading, matching the DEER INTEL
// wordmark (also Bebas Neue). It is exposed under both names: --font-display
// for headings across the app, --font-headline for the sign-in hero. Bebas has
// a single weight, so globals.css turns off faux-bold for it.
const bebas = Bebas_Neue({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
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
  themeColor: "#0b0d0b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bebas.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ThemeManager />
        <ServiceWorkerRegistration />
        <AuthProvider>
          <PartyProvider>
            <PartyBuckSync />
            <PartyBuckPhotoSync />
            <SharedSightingsManager />
            <AuthGate>{children}</AuthGate>
          </PartyProvider>
          <AccountSwitchPrompt />
        </AuthProvider>
        <StoragePersistenceBanner />
      </body>
    </html>
  );
}
