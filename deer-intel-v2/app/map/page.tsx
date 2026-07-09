import type { CSSProperties } from "react";
import PageShell from "@/components/ui/PageShell";
import MapClient from "../../components/MapClient";

export default function MapPage() {
  return (
    <PageShell>
      <header className="di-map-page-chrome" style={headerStyle}>
        <p style={eyebrowStyle}>Property Map</p>
        <h1 style={titleStyle}>Map</h1>
      </header>

      <MapClient />
    </PageShell>
  );
}

const headerStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
  marginBottom: "1rem",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.78rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "2rem",
  lineHeight: 1.1,
};
