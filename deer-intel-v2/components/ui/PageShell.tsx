"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type CSSProperties, type ReactNode } from "react";
import Sidebar from "@/components/ui/Sidebar";

type PageShellProps = {
  children: ReactNode;
  maxWidth?: string;
};

// Inline glyphs for the mobile tab bar so it reads like a native field app's
// bottom navigation (icon over label) rather than a row of text buttons.
const NAV_ICONS: Record<string, string> = {
  "/": '<path d="M3 11.2 12 4l9 7.2V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  "/map":
    '<path fill-rule="evenodd" d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z"/>',
  "/cameras":
    '<path fill-rule="evenodd" d="M4 8.6A1.6 1.6 0 0 1 5.6 7H8l1.1-1.7A1 1 0 0 1 9.9 5h4.2a1 1 0 0 1 .8.4L16 7h2.4A1.6 1.6 0 0 1 20 8.6v7.8A1.6 1.6 0 0 1 18.4 18H5.6A1.6 1.6 0 0 1 4 16.4V8.6zM12 16a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 12 16z"/>',
  "/hunt-log":
    '<path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/>',
  "/settings":
    '<path fill-rule="evenodd" d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.9 3h-3.8l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h3.8l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4zM12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>',
};

const mobileNavLinks = [
  { href: "/", label: "Today" },
  { href: "/map", label: "Map" },
  { href: "/cameras", label: "Cameras" },
  { href: "/hunt-log", label: "Hunts" },
  { href: "/settings", label: "Settings" },
];

function isNavLinkActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export default function PageShell({
  children,
  maxWidth = "1180px",
}: PageShellProps) {
  const pathname = usePathname();

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
        {mobileNavLinks.map((link) => {
          const isActive = isNavLinkActive(pathname, link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
            >
              <svg
                className="di-mobile-nav-icon"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: NAV_ICONS[link.href] ?? "" }}
              />
              <span className="di-mobile-nav-label">{link.label}</span>
            </Link>
          );
        })}
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
