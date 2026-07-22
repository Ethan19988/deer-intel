"use client";

import Link from "next/link";
import { Suspense, type CSSProperties, type ReactNode } from "react";
import Sidebar from "@/components/ui/Sidebar";
import {
  CameraIcon,
  ClipboardIcon,
  HomeIcon,
  MapIcon,
  MapPinIcon,
} from "@/components/ui/FieldIcons";

type PageShellProps = {
  children: ReactNode;
  maxWidth?: string;
  /**
   * Full-bleed layout: drop the page padding and max-width so the content
   * (e.g. the map) fills the entire area next to the sidebar.
   */
  bare?: boolean;
};

const mobileNavLinks = [
  { href: "/", label: "Today", icon: <HomeIcon size={20} /> },
  { href: "/map", label: "Map", icon: <MapIcon size={20} /> },
  { href: "/properties", label: "Properties", icon: <MapPinIcon size={20} /> },
  { href: "/cameras", label: "Cameras", icon: <CameraIcon size={20} /> },
  { href: "/hunt-log", label: "Hunts", icon: <ClipboardIcon size={20} /> },
];

export default function PageShell({
  children,
  maxWidth = "1180px",
  bare = false,
}: PageShellProps) {
  return (
    <div className="di-app-shell" style={appShellStyle}>
      <Suspense fallback={<aside className="di-sidebar" aria-label="Primary" />}>
        <Sidebar />
      </Suspense>

      <main
        className={`di-page-shell${bare ? " di-page-shell-bare" : ""}`}
        style={bare ? pageBareStyle : pageStyle}
      >
        <div
          className="di-page-content"
          style={
            bare ? contentBareStyle : { ...contentStyle, maxWidth }
          }
        >
          <div className="di-main-content">{children}</div>
        </div>
      </main>

      <Link
        href="/settings"
        className="di-mobile-settings"
        aria-label="Settings"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </Link>

      <nav className="di-mobile-nav" aria-label="Primary">
        {mobileNavLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <span className="di-mobile-nav-icon" aria-hidden="true">
              {link.icon}
            </span>
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

const pageBareStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: 0,
};

const contentBareStyle: CSSProperties = {
  width: "100%",
  maxWidth: "none",
  margin: 0,
};
