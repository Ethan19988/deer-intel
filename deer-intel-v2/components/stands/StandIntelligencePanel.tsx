import Link from "next/link";
import type { CSSProperties } from "react";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import type { StandIntelligenceSummary } from "@/lib/standIntelligence";

type StandIntelligencePanelProps = {
  propertyId: string;
  summary: StandIntelligenceSummary;
};

export default function StandIntelligencePanel({
  propertyId,
  summary,
}: StandIntelligencePanelProps) {
  return (
    <div style={panelStyle}>
      <div style={recommendationListStyle}>
        {summary.recommendations.map((recommendation) => (
          <div
            key={`${recommendation.title}-${recommendation.detail}`}
            style={recommendationStyle}
          >
            <Badge variant={recommendationTone(recommendation.tone)}>
              {recommendation.title}
            </Badge>
            <p style={mutedTextStyle}>{recommendation.detail}</p>
          </div>
        ))}
      </div>

      {!summary.hasWindData ? (
        <EmptyState
          title="No wind data recorded yet"
          description="Add best winds and avoid winds so this stand is easier to choose."
        />
      ) : null}

      {!summary.hasHuntHistory ? (
        <EmptyState
          title="No hunt history yet"
          description="Log hunts from this stand to track pressure, sightings, shot chances, and harvests."
        />
      ) : null}

      {!summary.hasCameraActivity ? (
        <EmptyState
          title="No nearby camera activity yet"
          description="Camera checks from related property camera sites will help explain deer movement near this stand."
        />
      ) : null}

      <div style={insightGridStyle}>
        <StandInsight label="Best Wind" insight={summary.bestWind} />
        <StandInsight label="Last Hunted" insight={summary.lastHunted} />
        <StandInsight
          label="Recent Deer Activity"
          insight={summary.recentDeerActivity}
        />
        <StandInsight label="Pressure" insight={summary.pressureNotes} />
        <StandInsight label="Access" insight={summary.accessPlan} />
        <StandInsight label="Observation History" insight={summary.successHistory} />
      </div>

      {summary.recentHunts.length > 0 ? (
        <div style={listBlockStyle}>
          <p style={blockTitleStyle}>Recent Hunts</p>
          <div style={itemListStyle}>
            {summary.recentHunts.map((hunt) => (
              <div key={hunt.id} style={itemStyle}>
                <p style={itemTitleStyle}>{hunt.title}</p>
                <p style={mutedTextStyle}>{hunt.detail}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {summary.relatedCameraSites.length > 0 ? (
        <div style={listBlockStyle}>
          <p style={blockTitleStyle}>Related Camera Sites</p>
          <div style={itemListStyle}>
            {summary.relatedCameraSites.map((camera) => (
              <Link
                key={camera.id}
                href={`/properties/${propertyId}/assets/${camera.id}`}
                style={itemLinkStyle}
              >
                <span>
                  <span style={itemTitleStyle}>{camera.name}</span>
                  <span style={statusStyle}>{camera.status}</span>
                </span>
                <span style={mutedTextStyle}>{camera.detail}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StandInsight({
  label,
  insight,
}: {
  label: string;
  insight: StandIntelligenceSummary["bestWind"];
}) {
  return (
    <div>
      <p style={detailLabelStyle}>{label}</p>
      <p style={detailTitleStyle}>{insight.title}</p>
      <p style={mutedTextStyle}>{insight.detail}</p>
    </div>
  );
}

function recommendationTone(tone: StandIntelligenceSummary["recommendations"][number]["tone"]) {
  if (tone === "success") return "success";
  if (tone === "warning") return "warning";

  return "default";
}

const panelStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const recommendationListStyle: CSSProperties = {
  display: "grid",
  gap: "0.65rem",
};

const recommendationStyle: CSSProperties = {
  padding: "0.8rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#070a07",
};

const insightGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "1rem",
};

const listBlockStyle: CSSProperties = {
  paddingTop: "1rem",
  borderTop: "1px solid #1e2a1e",
};

const blockTitleStyle: CSSProperties = {
  margin: 0,
  color: "#f1f5ef",
  fontSize: "0.95rem",
  fontWeight: 850,
};

const itemListStyle: CSSProperties = {
  display: "grid",
  gap: "0.65rem",
  marginTop: "0.75rem",
};

const itemStyle: CSSProperties = {
  padding: "0.75rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#070a07",
};

const itemLinkStyle: CSSProperties = {
  ...itemStyle,
  display: "grid",
  gap: "0.3rem",
  color: "white",
  textDecoration: "none",
};

const itemTitleStyle: CSSProperties = {
  margin: 0,
  color: "#f1f5ef",
  fontWeight: 800,
};

const statusStyle: CSSProperties = {
  marginLeft: "0.5rem",
  color: "#85a984",
  fontSize: "0.82rem",
  fontWeight: 800,
};

const detailLabelStyle: CSSProperties = {
  margin: 0,
  color: "#879486",
  fontSize: "0.78rem",
  fontWeight: 700,
};

const detailTitleStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  color: "#f1f5ef",
  fontSize: "1rem",
  fontWeight: 800,
  lineHeight: 1.25,
};

const mutedTextStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  color: "#b8c2b6",
  lineHeight: 1.5,
};
