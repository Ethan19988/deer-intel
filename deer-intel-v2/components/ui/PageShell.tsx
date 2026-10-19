"use client";

import { usePathname } from "next/navigation";
import { Suspense, type CSSProperties, type ReactNode } from "react";
import MobileNav from "@/components/ui/MobileNav";
import PropertySwitcher from "@/components/ui/PropertySwitcher";
import Sidebar from "@/components/ui/Sidebar";

// Pages that aren't about one property don't show the property switcher.
const NO_SWITCHER = ["/properties", "/settings", "/party", "/login", "/reset-password"];

type PageShellProps = {
  children: ReactNode;
  maxWidth?: string;
  /**
   * Full-bleed layout: drop the page padding and max-width so the content
   * (e.g. the map) fills the entire area next to the sidebar.
   */
  bare?: boolean;
};

export default function PageShell({
  children,
  maxWidth = "1180px",
  bare = false,
}: PageShellProps) {
  const pathname = usePathname() ?? "/";
  const showSwitcher = !bare && !NO_SWITCHER.some((path) => pathname === path);

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
          {showSwitcher ? <PropertySwitcher /> : null}
          <div className="di-main-content">{children}</div>
        </div>
      </main>

      <MobileNav />
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
