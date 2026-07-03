"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  HUNTING_MODE_OPTIONS,
  HUNTING_MODE_STORAGE_KEY,
  type HuntingMode,
  isHuntingMode,
} from "@/lib/huntingMode";

type PageShellProps = {
  children: ReactNode;
  maxWidth?: string;
};

export default function PageShell({
  children,
  maxWidth = "1180px",
}: PageShellProps) {
  const [mode, setMode] = useState<HuntingMode>("review");

  useEffect(() => {
    const savedMode = window.localStorage.getItem(HUNTING_MODE_STORAGE_KEY);

    if (isHuntingMode(savedMode)) {
      setMode(savedMode);
    }
  }, []);

  function selectMode(nextMode: HuntingMode) {
    setMode(nextMode);
    window.localStorage.setItem(HUNTING_MODE_STORAGE_KEY, nextMode);
  }

  return (
    <main
      className={`di-page-shell di-mode-${mode}`}
      data-hunting-mode={mode}
      style={pageStyle}
    >
      <div className="di-page-content" style={{ ...contentStyle, maxWidth }}>
        <ModeSelector mode={mode} onSelectMode={selectMode} />
        {mode === "scouting" ? <ScoutingModePanel /> : null}
        {mode === "hunting" ? <HuntingModePanel /> : null}
        <div className="di-main-content">{children}</div>
      </div>

      <nav className="di-mobile-nav" aria-label="Primary">
        {mobileNavLinks[mode].map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>
    </main>
  );
}

function ModeSelector({
  mode,
  onSelectMode,
}: {
  mode: HuntingMode;
  onSelectMode: (mode: HuntingMode) => void;
}) {
  return (
    <section style={modeBarStyle} aria-label="Deer Intel mode">
      <div>
        <p style={modeEyebrowStyle}>Operating Mode</p>
        <p style={modeTextStyle}>
          {HUNTING_MODE_OPTIONS.find((option) => option.id === mode)?.description}
        </p>
      </div>
      <div style={modeButtonGroupStyle}>
        {HUNTING_MODE_OPTIONS.map((option) => {
          const isActive = option.id === mode;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelectMode(option.id)}
              aria-pressed={isActive}
              style={{
                ...modeButtonStyle,
                ...(isActive ? activeModeButtonStyle : null),
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ScoutingModePanel() {
  return (
    <section className="di-scouting-panel" style={modePanelStyle}>
      <div>
        <p style={modeEyebrowStyle}>Scouting Mode</p>
        <h2 style={panelTitleStyle}>Map-first field work</h2>
        <p style={panelTextStyle}>
          Use the map, add pins, check camera sites, and keep moving.
        </p>
      </div>
      <div style={quickActionGridStyle}>
        <ModeAction href="/map" title="Open Map" detail="GPS, pins, layers" />
        <ModeAction
          href="/cameras"
          title="Cameras"
          detail="Sites and checks"
        />
        <ModeAction href="/stands" title="Stands" detail="Wind and access" />
        <ModeAction
          href="/cameras/import"
          title="Import Photos"
          detail="Build history"
        />
      </div>
    </section>
  );
}

function HuntingModePanel() {
  return (
    <section className="di-hunting-essentials" style={modePanelStyle}>
      <div>
        <p style={modeEyebrowStyle}>Hunting Mode</p>
        <h2 style={panelTitleStyle}>Essentials only</h2>
        <p style={panelTextStyle}>
          Editing and management tools are tucked away until you switch back to
          Review or Scouting.
        </p>
      </div>
      <div style={essentialsGridStyle}>
        <EssentialCard title="Hunt Timer" value="Coming Soon" />
        <EssentialCard title="Weather" value="Coming Soon" />
        <EssentialCard title="Wind" value="Coming Soon" />
        <EssentialCard title="Sunrise / Sunset" value="Coming Soon" />
        <EssentialCard title="End Hunt" value="Coming Soon" />
      </div>
      <div style={huntingActionRowStyle}>
        <ModeAction href="/map" title="Open Map" detail="Check position" />
        <ModeAction href="/hunt-log" title="Log Hunt" detail="Save the sit" />
      </div>
    </section>
  );
}

function ModeAction({
  href,
  title,
  detail,
}: {
  href: string;
  title: string;
  detail: string;
}) {
  return (
    <Link href={href} style={modeActionStyle}>
      <span style={modeActionTitleStyle}>{title}</span>
      <span style={modeActionDetailStyle}>{detail}</span>
    </Link>
  );
}

function EssentialCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={essentialCardStyle}>
      <p style={essentialTitleStyle}>{title}</p>
      <p style={essentialValueStyle}>{value}</p>
    </div>
  );
}

const mobileNavLinks: Record<
  HuntingMode,
  Array<{ href: string; label: string }>
> = {
  review: [
    { href: "/", label: "Today" },
    { href: "/properties", label: "Land" },
    { href: "/map", label: "Map" },
    { href: "/hunt-log", label: "Hunts" },
  ],
  scouting: [
    { href: "/map", label: "Map" },
    { href: "/cameras", label: "Cameras" },
    { href: "/stands", label: "Stands" },
    { href: "/ai", label: "Intel" },
  ],
  hunting: [
    { href: "/", label: "Plan" },
    { href: "/map", label: "Map" },
    { href: "/hunt-log", label: "Log" },
    { href: "/ai", label: "Intel" },
  ],
};

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

const modeBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  marginBottom: "1rem",
  padding: "0.75rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0a0f0a",
};

const modeEyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#85a984",
  fontSize: "0.75rem",
  fontWeight: 850,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const modeTextStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  color: "#c6d5c5",
  lineHeight: 1.35,
};

const modeButtonGroupStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "flex-end",
  gap: "0.45rem",
};

const modeButtonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0.65rem 0.8rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0d120d",
  color: "#f1f5ef",
  fontWeight: 850,
  cursor: "pointer",
};

const activeModeButtonStyle: CSSProperties = {
  borderColor: "#3b6843",
  background: "#18351d",
  color: "#c6f0c6",
};

const modePanelStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
  marginBottom: "1rem",
  padding: "1rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0d120d",
};

const panelTitleStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  fontSize: "1.35rem",
  lineHeight: 1.2,
};

const panelTextStyle: CSSProperties = {
  margin: "0.45rem 0 0",
  color: "#b8c2b6",
  lineHeight: 1.5,
};

const quickActionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "0.75rem",
};

const huntingActionRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "0.75rem",
};

const modeActionStyle: CSSProperties = {
  display: "grid",
  minHeight: "72px",
  alignContent: "center",
  gap: "0.2rem",
  padding: "0.9rem",
  border: "1px solid #3b6843",
  borderRadius: "8px",
  background: "#18351d",
  color: "white",
  textDecoration: "none",
};

const modeActionTitleStyle: CSSProperties = {
  fontSize: "1.02rem",
  fontWeight: 850,
};

const modeActionDetailStyle: CSSProperties = {
  color: "#c6d5c5",
  fontSize: "0.9rem",
};

const essentialsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "0.75rem",
};

const essentialCardStyle: CSSProperties = {
  minHeight: "82px",
  padding: "0.9rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#070a07",
};

const essentialTitleStyle: CSSProperties = {
  margin: 0,
  color: "#f1f5ef",
  fontWeight: 850,
};

const essentialValueStyle: CSSProperties = {
  margin: "0.4rem 0 0",
  color: "#d3b66b",
  fontWeight: 800,
};
