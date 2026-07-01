import Link from "next/link";
import type { CSSProperties } from "react";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import PageShell from "@/components/ui/PageShell";
import MapClient from "../../components/MapClient";

export default function MapPage() {
  return (
    <PageShell>
      <Link href="/" style={backLinkStyle}>
        Back to Home
      </Link>

      <Card as="section" variant="elevated" style={headerCardStyle}>
        <PageHeader
          eyebrow="Property Map"
          title="Deer Intel Map"
          description="Tap the map to save cameras, stands, scrapes, rubs, sightings, bedding, food, water, parking, and access routes."
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
