"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import AccountNavControl from "@/components/auth/AccountNavControl";
import {
  CameraIcon,
  ClipboardIcon,
  DeerIcon,
  FileIcon,
  GearIcon,
  HomeIcon,
  MapIcon,
  MapPinIcon,
  StandIcon,
  TargetIcon,
} from "@/components/ui/FieldIcons";

type NavLink = { href: string; label: string; icon: ReactNode };
type NavGroup = { heading?: string; links: NavLink[] };

const ICON_SIZE = 18;

// Navigation grouped by what the hunter is doing, not by data type.
const NAV_GROUPS: NavGroup[] = [
  { links: [{ href: "/", label: "Today", icon: <HomeIcon size={ICON_SIZE} /> }] },
  {
    heading: "Scout the land",
    links: [
      { href: "/map", label: "Map", icon: <MapIcon size={ICON_SIZE} /> },
      { href: "/properties", label: "Properties", icon: <MapPinIcon size={ICON_SIZE} /> },
      { href: "/cameras", label: "Cameras", icon: <CameraIcon size={ICON_SIZE} /> },
      { href: "/stands", label: "Stands", icon: <StandIcon size={ICON_SIZE} /> },
      { href: "/documents", label: "Documents", icon: <FileIcon size={ICON_SIZE} /> },
    ],
  },
  {
    heading: "Plan the hunt",
    links: [
      { href: "/ai", label: "Hunt Plan", icon: <TargetIcon size={ICON_SIZE} /> },
      { href: "/hunt-log", label: "Hunt Log", icon: <ClipboardIcon size={ICON_SIZE} /> },
    ],
  },
];

const FOOTER_LINKS: NavLink[] = [
  { href: "/settings", label: "Settings", icon: <GearIcon size={ICON_SIZE} /> },
];

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
        <span className="di-sidebar-mark" aria-hidden="true">
          <DeerIcon size={22} />
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
                  {link.icon}
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
