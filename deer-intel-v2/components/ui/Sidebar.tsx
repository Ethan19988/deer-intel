"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AccountNavControl from "@/components/auth/AccountNavControl";

type NavLink = { href: string; label: string };
type NavGroup = { heading?: string; links: NavLink[] };

// Navigation grouped by what the hunter is doing, not by data type.
const NAV_GROUPS: NavGroup[] = [
  { links: [{ href: "/", label: "Today" }] },
  {
    heading: "Scout the land",
    links: [
      { href: "/map", label: "Map" },
      { href: "/properties", label: "Properties" },
      { href: "/cameras", label: "Cameras" },
      { href: "/stands", label: "Stands" },
    ],
  },
  {
    heading: "Plan the hunt",
    links: [
      { href: "/ai", label: "Hunt Plan" },
      { href: "/hunt-log", label: "Hunt Log" },
    ],
  },
];

const FOOTER_LINKS: NavLink[] = [{ href: "/settings", label: "Settings" }];

function isActive(pathname: string, href: string) {
  const [path] = href.split("?");

  if (path === "/") return pathname === "/";

  return pathname === path || pathname.startsWith(`${path}/`);
}

export default function Sidebar() {
  const pathname = usePathname() ?? "/";

  return (
    <aside className="di-sidebar" aria-label="Primary">
      <Link href="/" className="di-camo-band di-sidebar-brand">
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
