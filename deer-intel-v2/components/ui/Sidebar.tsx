"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AccountNavControl from "@/components/auth/AccountNavControl";
import BuckMark from "@/components/ui/BuckMark";
import {
  isActivePath as isActive,
  NAV_GROUPS,
  SETTINGS_LINK,
} from "@/components/ui/navConfig";

const ICON_SIZE = 18;
const FOOTER_LINKS = [SETTINGS_LINK];

export default function Sidebar({ activePath }: { activePath?: string } = {}) {
  const currentPath = usePathname() ?? "/";
  const pathname = activePath ?? currentPath;

  return (
    <aside className="di-sidebar" aria-label="Primary">
      <Link href="/" className="di-camo-band di-sidebar-brand">
        <span className="di-sidebar-mark" aria-hidden="true">
          <BuckMark size={22} />
        </span>
        Deer Intel
      </Link>

      <nav className="di-sidebar-nav">
        {NAV_GROUPS.map((group, index) => (
          <div key={group.heading ?? `group-${index}`} className="di-sidebar-group">
            {group.heading ? (
              <p className="di-sidebar-heading">{group.heading}</p>
            ) : null}
            {group.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="di-sidebar-link"
                aria-current={
                  isActive(pathname, link.href) ? "page" : undefined
                }
              >
                <span className="di-sidebar-icon" aria-hidden="true">
                  {link.icon(ICON_SIZE)}
                </span>
                {link.label}
              </Link>
            ))}
          </div>
        ))}

        <div className="di-sidebar-spacer" />

        <div className="di-sidebar-group">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="di-sidebar-link"
              aria-current={
                isActive(pathname, link.href) ? "page" : undefined
              }
            >
              {link.label}
            </Link>
          ))}
          <AccountNavControl />
        </div>
      </nav>
    </aside>
  );
}
