import type { CSSProperties } from "react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import {
  deerSeenSummary,
  formatHuntDate,
  formatHuntTimeRange,
  huntOutcomeLabel,
  sortHuntsChronologically,
  yesNoLabel,
} from "@/lib/hunts";
import type { HuntLogEntry } from "@/types/hunt";

type HuntLogListProps = {
  hunts: HuntLogEntry[];
  emptyDescription?: string;
  getPropertyName?: (propertyId: string) => string;
};

export default function HuntLogList({
  hunts,
  emptyDescription = "No hunts logged yet.",
  getPropertyName,
}: HuntLogListProps) {
  const chronologicalHunts = sortHuntsChronologically(hunts);

  if (chronologicalHunts.length === 0) {
    return <EmptyState description={emptyDescription} />;
  }

  return (
    <div style={listStyle}>
      {chronologicalHunts.map((hunt) => (
        <Card key={hunt.id} as="article" variant="subtle">
          <div style={headerStyle}>
            <div>
              <p style={eyebrowStyle}>{hunt.standName || "Stand"}</p>
              <h3 style={titleStyle}>{formatHuntDate(hunt.date)}</h3>
              {getPropertyName ? (
                <p style={subtitleStyle}>{getPropertyName(hunt.propertyId)}</p>
              ) : null}
            </div>
            <Badge>{huntOutcomeLabel(hunt)}</Badge>
          </div>

          <div style={detailsGridStyle}>
            <HuntDetail label="Time" value={formatHuntTimeRange(hunt)} />
            <HuntDetail label="Wind" value={hunt.windDirection} />
            <HuntDetail label="Wind Speed" value={hunt.windSpeed} />
            <HuntDetail label="Temperature" value={hunt.temperature} />
            <HuntDetail label="Weather" value={hunt.weather} />
            <HuntDetail label="Moon" value={hunt.moonPhase} />
            <HuntDetail label="Deer Seen" value={deerSeenSummary(hunt)} />
            <HuntDetail
              label="Shot Opportunity"
              value={yesNoLabel(hunt.shotOpportunity)}
            />
            <HuntDetail label="Harvest" value={yesNoLabel(hunt.harvest)} />
          </div>

          {hunt.notes ? (
            <div style={notesStyle}>
              <p style={detailLabelStyle}>Notes</p>
              <p style={detailValueStyle}>{hunt.notes}</p>
            </div>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

function HuntDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={detailLabelStyle}>{label}</p>
      <p style={detailValueStyle}>{value || "Not set"}</p>
    </div>
  );
}

const listStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
  flexWrap: "wrap",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  fontSize: "1.2rem",
  lineHeight: 1.25,
};

const subtitleStyle: CSSProperties = {
  margin: "0.3rem 0 0",
  color: "var(--text-muted)",
  fontSize: "0.95rem",
};

const detailsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: "1rem",
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid var(--border)",
};

const notesStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
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
