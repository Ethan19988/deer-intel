import Link from "next/link";
import type { CSSProperties } from "react";
import StandIntelligencePanel from "@/components/stands/StandIntelligencePanel";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import type { StandIntelligenceSummary } from "@/lib/standIntelligence";
import { getStandWindCheck } from "@/lib/standWind";
import type { Stand } from "@/types/stand";

type StandCardProps = {
  stand: Stand;
  intelligence?: StandIntelligenceSummary;
  /** Current wind direction (compass point) for a live "wind today" check. */
  todayWind?: string;
};

const WIND_BADGE_VARIANT = {
  good: "success",
  avoid: "danger",
  marginal: "warning",
} as const;

export default function StandCard({
  stand,
  intelligence,
  todayWind,
}: StandCardProps) {
  const windCheck = getStandWindCheck(stand, todayWind);
  const windVariant =
    windCheck.status in WIND_BADGE_VARIANT
      ? WIND_BADGE_VARIANT[windCheck.status as keyof typeof WIND_BADGE_VARIANT]
      : null;

  return (
    <Card style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>{stand.standType} Stand</p>
          <h3 style={titleStyle}>{stand.name}</h3>
        </div>
        <div style={actionsStyle}>
          {windVariant ? (
            <Badge variant={windVariant}>{windCheck.label}</Badge>
          ) : null}
          <Badge>{stand.standType}</Badge>
          <Link
            href={`/properties/${stand.propertyId}/assets/${stand.id}`}
            style={openLinkStyle}
          >
            Open Stand
          </Link>
        </div>
      </div>

      <div style={detailsGridStyle}>
        <StandDetail label="Best Winds" value={stand.bestWinds} />
        <StandDetail label="Avoid Winds" value={stand.avoidWinds} />
      </div>

      <div style={notesGridStyle}>
        <StandDetail label="Access Route" value={stand.accessRouteNotes} />
        <StandDetail label="Exit Route" value={stand.exitRouteNotes} />
        <StandDetail label="Notes" value={stand.notes} />
      </div>

      {intelligence ? (
        <div style={intelligenceWrapStyle}>
          <CollapsibleSection
            title="Stand Intelligence"
            description="Wind, pressure, hunts, and related camera activity"
            variant="bare"
          >
            <StandIntelligencePanel
              propertyId={stand.propertyId}
              summary={intelligence}
            />
          </CollapsibleSection>
        </div>
      ) : null}
    </Card>
  );
}

function StandDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={detailLabelStyle}>{label}</p>
      <p style={detailValueStyle}>{value || "Not set"}</p>
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: "var(--surface-2)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
  flexWrap: "wrap",
};

const actionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "0.5rem",
  flexWrap: "wrap",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  fontSize: "1.25rem",
  lineHeight: 1.25,
};

const openLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "36px",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.5rem 0.65rem",
  border: "1px solid var(--accent)",
  borderRadius: "8px",
  background: "var(--accent)",
  color: "white",
  fontSize: "0.85rem",
  fontWeight: 700,
  textDecoration: "none",
};

const detailsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "1rem",
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid var(--border)",
};

const notesGridStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid var(--border)",
};

const intelligenceWrapStyle: CSSProperties = {
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid var(--border)",
};

const detailLabelStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontSize: "0.78rem",
  fontWeight: 700,
};

const detailValueStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  color: "var(--text-muted)",
  lineHeight: 1.5,
};
