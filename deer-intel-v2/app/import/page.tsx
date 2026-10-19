"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { CameraIcon, ClipboardIcon, MapPinIcon, PlusIcon } from "@/components/ui/FieldIcons";
import PageHeader from "@/components/ui/PageHeader";
import PageShell from "@/components/ui/PageShell";

type ImportChoice = {
  href: string;
  title: string;
  detail: string;
  icon: ReactNode;
};

const CHOICES: ImportChoice[] = [
  {
    href: "/cameras/import",
    title: "Trail-cam photos",
    detail:
      "Pick photos or app screenshots. Date, time, weather, moon, and the animal are filled in for you to check.",
    icon: <CameraIcon size={26} />,
  },
  {
    href: "/pins/import",
    title: "Pins from other apps",
    detail:
      "Waypoints from onX, HuntStand, BaseMap, Spartan Forge, Garmin, or Google Earth (GPX, KML, or KMZ).",
    icon: <MapPinIcon size={26} />,
  },
  {
    href: "/documents/import",
    title: "Documents",
    detail: "Leases, permits, licenses, tags, regulations, and printed maps, kept with the property.",
    icon: <ClipboardIcon size={26} />,
  },
];

// One place to bring anything into Deer Intel, instead of three importers
// hidden on different pages.
export default function ImportPage() {
  return (
    <PageShell maxWidth="760px">
      <PageHeader
        eyebrow="Import"
        title="Bring something in"
        description="Everything stays on this device unless you've turned on cloud sync."
        icon={<PlusIcon size={26} />}
      />

      <ul style={listStyle}>
        {CHOICES.map((choice) => (
          <li key={choice.href}>
            <Link href={choice.href} style={cardStyle} className="di-card-lift">
              <span style={iconStyle} aria-hidden="true">
                {choice.icon}
              </span>
              <span style={textStyle}>
                <span style={titleStyle}>{choice.title}</span>
                <span style={detailStyle}>{choice.detail}</span>
              </span>
              <span style={chevronStyle} aria-hidden="true">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}

const listStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  margin: "1rem 0 0",
  padding: 0,
  listStyle: "none",
};

const cardStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.9rem",
  minHeight: "88px",
  padding: "1rem",
  borderRadius: "16px",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  textDecoration: "none",
};

const iconStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "none",
  width: "52px",
  height: "52px",
  borderRadius: "14px",
  background: "var(--accent-tint)",
  border: "1px solid var(--accent-tint-border)",
  color: "var(--accent-text)",
};

const textStyle: CSSProperties = {
  display: "grid",
  gap: "0.2rem",
  flex: 1,
  minWidth: 0,
};

const titleStyle: CSSProperties = {
  fontFamily: "var(--font-display), system-ui, sans-serif",
  fontSize: "1.15rem",
  fontWeight: 800,
};

const detailStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.88rem",
  lineHeight: 1.45,
};

const chevronStyle: CSSProperties = {
  flex: "none",
  color: "var(--text-faint)",
  fontSize: "1.8rem",
  lineHeight: 1,
};
