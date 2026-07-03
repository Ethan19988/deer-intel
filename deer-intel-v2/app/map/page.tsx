import Link from "next/link";
import type { CSSProperties } from "react";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import PageShell from "@/components/ui/PageShell";
import MapClient from "../../components/MapClient";

export default function MapPage() {
  return (
    <PageShell>
      <Link href="/" className="di-map-page-chrome" style={backLinkStyle}>
        Back to Home
      </Link>

      <Card
        as="section"
        className="di-map-page-chrome"
        variant="elevated"
        style={headerCardStyle}
      >
        <PageHeader
          eyebrow="Property Map"
          title="Deer Intel Map"
          description="Switch layers, use GPS, and mark cameras, stands, bedding, food, water, scrapes, rubs, trails, parking, gates, and sightings."
        />
      </Card>

      <div style={mapWrapStyle}>
        <MapClient />
      </div>
    </PageShell>
  );
}

const backLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  color: "#c6d5c5",
  fontWeight: 700,
  textDecoration: "none",
};

const headerCardStyle: CSSProperties = {
  marginTop: "1rem",
  padding: "1.5rem",
};

const mapWrapStyle: CSSProperties = {
  marginTop: "1.25rem",
};
