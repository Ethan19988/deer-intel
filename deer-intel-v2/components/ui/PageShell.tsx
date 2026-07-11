"use client";

import Link from "next/link";
import { Suspense, type CSSProperties, type ReactNode } from "react";
import Sidebar from "@/components/ui/Sidebar";

type PageShellProps = {
  children: ReactNode;
  maxWidth?: string;
};

const mobileNavLinks = [
  { href: "/", label: "Today" },
  { href: "/map", label: "Map" },
  { href: "/cameras", label: "Cameras" },
  { href: "/hunt-log", label: "Hunts" },
  { href: "/settings", label: "Settings" },
];

export default function PageShell({
  children,
  maxWidth = "1180px",
}: PageShellProps) {
  return (
    <div className="di-app-shell" style={appShellStyle}>
      <Suspense fallback={<aside className="di-sidebar" aria-label="Primary" />}>
        <Sidebar />
      </Suspense>

      <main className="di-page-shell" style={pageStyle}>
        <div className="di-page-content" style={{ ...contentStyle, maxWidth }}>
          <div className="di-main-content">{children}</div>
        </div>
      </main>

      <nav className="di-mobile-nav" aria-label="Primary">
        {mobileNavLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

const appShellStyle: CSSProperties = {
  display: "flex",
  minHeight: "100vh",
  background: "var(--bg)",
  color: "var(--text)",
};

const pageStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "clamp(1rem, 4vw, 2rem)",
};

const contentStyle: CSSProperties = {
  width: "100%",
  margin: "0 auto",
};
