"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import AccountNavControl from "@/components/auth/AccountNavControl";
import {
  FOOTER_LINKS,
  isActivePath,
  MOBILE_TABS,
  NAV_GROUPS,
} from "@/components/ui/navConfig";

// Phone navigation: four field tabs plus More, which opens every other place
// in the app (the same list as the desktop sidebar).
export default function MobileNav({ activePath }: { activePath?: string } = {}) {
  const currentPath = usePathname() ?? "/";
  const pathname = activePath ?? currentPath;
  const [moreOpen, setMoreOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const tabHrefs = new Set(MOBILE_TABS.map((tab) => tab.href));
  const moreActive =
    !MOBILE_TABS.some((tab) => isActivePath(pathname, tab.href)) && pathname !== "/";

  // Close the menu after navigating.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMoreOpen(false);
  }, [currentPath]);

  // Move focus into the dialog when it opens so keyboard and screen-reader
  // users land on its first link rather than behind the backdrop.
  useEffect(() => {
    if (!moreOpen) return;
    sheetRef.current?.querySelector<HTMLElement>("a[href], button")?.focus();
  }, [moreOpen]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  return (
    <>
      {moreOpen ? (
        <div className="di-more-backdrop" onClick={() => setMoreOpen(false)}>
          <div
            ref={sheetRef}
            id="di-more-menu"
            role="dialog"
            aria-modal="true"
            aria-label="More"
            className="di-more-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            {NAV_GROUPS.map((group, index) => {
              const links = group.links.filter((link) => !tabHrefs.has(link.href));
              if (links.length === 0) return null;
              return (
                <div key={group.heading ?? index} style={groupStyle}>
                  {group.heading ? <p style={headingStyle}>{group.heading}</p> : null}
                  <div style={gridStyle}>
                    {links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`di-more-link${group.quickAdd ? " di-more-add" : ""}`}
                        aria-label={group.quickAdd ? `Add ${link.label.toLowerCase()}` : undefined}
                        aria-current={
                          !group.quickAdd && isActivePath(pathname, link.href)
                            ? "page"
                            : undefined
                        }
                        // Hash/query links on the current page don't change the
                        // pathname, so close the sheet explicitly.
                        onClick={() => setMoreOpen(false)}
                      >
                        <span aria-hidden="true">{link.icon(group.quickAdd ? 18 : 20)}</span>
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
            <div style={footerStyle}>
              <div style={footerLinksStyle}>
                {FOOTER_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="di-more-link"
                    aria-current={isActivePath(pathname, link.href) ? "page" : undefined}
                  >
                    <span aria-hidden="true">{link.icon(20)}</span>
                    {link.label}
                  </Link>
                ))}
              </div>
              <AccountNavControl />
            </div>
          </div>
        </div>
      ) : null}

      <nav className="di-mobile-nav" aria-label="Primary">
        {MOBILE_TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActivePath(pathname, tab.href) ? "page" : undefined}
          >
            <span className="di-mobile-nav-icon" aria-hidden="true">
              {tab.icon(20)}
            </span>
            {tab.label}
          </Link>
        ))}
        <button
          type="button"
          className="di-mobile-more"
          aria-expanded={moreOpen}
          aria-controls="di-more-menu"
          aria-current={moreActive ? "page" : undefined}
          onClick={() => setMoreOpen((open) => !open)}
        >
          <span className="di-mobile-nav-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </span>
          More
        </button>
      </nav>
    </>
  );
}

const groupStyle: CSSProperties = {
  display: "grid",
  gap: "0.45rem",
};

const headingStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.8rem",
  fontWeight: 700,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "0.5rem",
};

const footerLinksStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "0.5rem",
};

const footerStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
  paddingTop: "0.75rem",
  borderTop: "1px solid var(--border)",
};
