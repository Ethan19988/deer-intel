import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  maxWidth?: string;
};

export default function PageShell({
  children,
  maxWidth = "1180px",
}: PageShellProps) {
  return (
    <main className="di-page-shell" style={pageStyle}>
      <div className="di-page-content" style={{ ...contentStyle, maxWidth }}>
        {children}
      </div>
      <nav className="di-mobile-nav" aria-label="Primary">
        {mobileNavLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>
    </main>
  );
}

const mobileNavLinks = [
  { href: "/", label: "Today" },
  { href: "/properties", label: "Land" },
  { href: "/map", label: "Map" },
  { href: "/hunt-log", label: "Hunts" },
];

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: "clamp(1rem, 4vw, 2rem)",
  background: "#050806",
  color: "white",
};

const contentStyle: CSSProperties = {
  width: "100%",
  margin: "0 auto",
};
