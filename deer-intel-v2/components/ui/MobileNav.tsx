"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import AccountNavControl from "@/components/auth/AccountNavControl";
import {
  isActivePath,
  MOBILE_TABS,
  NAV_GROUPS,
  QUICK_ADD_LINKS,
  SETTINGS_LINK,
} from "@/components/ui/navConfig";

// Phone navigation: four field tabs plus More, which opens every other place
// in the app (the same list as the desktop sidebar).
export default function MobileNav({ activePath }: { activePath?: string } = {}) {
  const currentPath = usePathname() ?? "/";
  const pathname = activePath ?? currentPath;
  const [moreOpen, setMoreOpen] = useState(false);
  const tabHrefs = new Set(MOBILE_TABS.map((tab) => tab.href));
  const moreActive =
    !MOBILE_TABS.some((tab) => isActivePath(pathname, tab.href)) && pathname !== "/";

  // Close the menu after navigating.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMoreOpen(false);
  }, [currentPath]);

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
            id="di-more-menu"
            role="dialog"
            aria-label="More"
            className="di-more-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div style={groupStyle}>
              <p style={headingStyle}>Add</p>
              <div style={addGridStyle}>
                {QUICK_ADD_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="di-more-link di-more-add"
                    onClick={() => setMoreOpen(false)}
                  >
                    <span aria-hidden="true">{link.icon(18)}</span>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
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
                        className="di-more-link"
                        aria-current={isActivePath(pathname, link.href) ? "page" : undefined}
                      >
                        <span aria-hidden="true">{link.icon(20)}</span>
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
            <div style={footerStyle}>
              <Link
                href={SETTINGS_LINK.href}
                className="di-more-link"
                aria-current={isActivePath(pathname, SETTINGS_LINK.href) ? "page" : undefined}
              >
                <span aria-hidden="true">{SETTINGS_LINK.icon(20)}</span>
                {SETTINGS_LINK.label}
              </Link>
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

const addGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "0.4rem",
};

const footerStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
  paddingTop: "0.75rem",
  borderTop: "1px solid var(--border)",
};
