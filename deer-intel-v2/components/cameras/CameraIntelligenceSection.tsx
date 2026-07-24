import Link from "next/link";
import type { CSSProperties } from "react";
import type {
  CameraAttentionItem,
  CameraInsight,
  CameraIntelligenceSummary,
} from "@/lib/cameraIntelligence";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";
import StatCard from "@/components/ui/StatCard";

type CameraIntelligenceSectionProps = {
  propertyId: string;
  propertyName: string;
  summary: CameraIntelligenceSummary;
};

export default function CameraIntelligenceSection({
  propertyId,
  propertyName,
  summary,
}: CameraIntelligenceSectionProps) {
  const addCameraHref = propertyId
    ? `/properties/${propertyId}#camera-sites`
    : "/properties";

  return (
    <Section
      eyebrow="Camera Intelligence"
      title="What Your Cameras Are Telling You"
      action={
        <Link href={addCameraHref} style={primaryLinkStyle} className="di-navbtn">
          Add Camera Site
        </Link>
      }
    >
      {!summary.hasCameraSites ? (
        <EmptyState
          title="No camera sites yet"
          description={`${propertyName} does not have camera sites yet. Add the first site to start building camera intelligence.`}
          action={
            <Link href={addCameraHref} style={primaryLinkStyle} className="di-navbtn">
              Add Camera Site
            </Link>
          }
        />
      ) : (
        <div style={sectionStackStyle}>
          <div style={insightGridStyle}>
            <InsightCard
              label="Most Active Camera Site"
              insight={summary.mostActiveCamera}
              propertyId={propertyId}
            />
            <InsightCard
              label="Most Recent Camera Activity"
              insight={summary.mostRecentActivity}
              propertyId={propertyId}
            />
            <InsightCard
              label="Best Photo Time"
              insight={summary.bestPhotoTime}
              propertyId={propertyId}
            />
            <InsightCard
              label="Recent Mature Buck Activity"
              insight={summary.matureBuckActivity}
              propertyId={propertyId}
            />
          </div>

          <div style={statGridStyle}>
            <StatCard
              label="Bucks"
              value={summary.activityCounts.bucks}
              detail="From checks and photo records"
            />
            <StatCard
              label="Does"
              value={summary.activityCounts.does}
              detail="From checks and photo records"
            />
            <StatCard
              label="Fawns"
              value={summary.activityCounts.fawns}
              detail="From checks and photo records"
            />
          </div>

          {!summary.hasCameraChecks ? (
            <EmptyState
              title="No camera checks yet"
              description="Save camera checks from a camera site workspace to track batteries, SD cards, signal, and wildlife counts."
            />
          ) : null}

          {!summary.hasPhotoRecords ? (
            <EmptyState
              title="No photo records yet"
              description="Add photo records from camera checks to start seeing photo history and time patterns."
            />
          ) : null}

          <div style={attentionGridStyle}>
            <AttentionPanel
              title="Cameras With No Recent Checks"
              emptyDescription="Every saved camera site has a recent check."
              items={summary.camerasWithNoRecentChecks}
              propertyId={propertyId}
            />
            <AttentionPanel
              title="Camera Sites Needing Attention"
              emptyDescription="No camera site needs attention right now."
              items={summary.attentionItems}
              propertyId={propertyId}
            />
          </div>
        </div>
      )}
    </Section>
  );
}

function InsightCard({
  label,
  insight,
  propertyId,
}: {
  label: string;
  insight: CameraInsight;
  propertyId: string;
}) {
  return (
    <Card as="article" variant="subtle">
      <div style={cardHeaderStyle}>
        <p style={eyebrowStyle}>{label}</p>
        {insight.badge ? <Badge>{insight.badge}</Badge> : null}
      </div>
      <h3 style={cardTitleStyle}>{insight.title}</h3>
      <p style={mutedTextStyle}>{insight.detail}</p>
      {insight.cameraId ? (
        <Link
          href={`/properties/${propertyId}/assets/${insight.cameraId}`}
          style={inlineLinkStyle}
        >
          Open Camera Site
        </Link>
      ) : null}
    </Card>
  );
}

function AttentionPanel({
  title,
  emptyDescription,
  items,
  propertyId,
}: {
  title: string;
  emptyDescription: string;
  items: CameraAttentionItem[];
  propertyId: string;
}) {
  return (
    <Card as="section" variant="subtle">
      <h3 style={panelTitleStyle}>{title}</h3>
      {items.length === 0 ? (
        <p style={mutedTextStyle}>{emptyDescription}</p>
      ) : (
        <div style={attentionListStyle}>
          {items.map((item) => (
            <Link
              key={`${item.cameraId}-${item.reason}`}
              href={`/properties/${propertyId}/assets/${item.cameraId}`}
              style={attentionItemStyle}
              className="di-navbtn"
            >
              <span>
                <strong style={attentionNameStyle}>{item.cameraName}</strong>
                <span style={attentionReasonStyle}>{item.reason}</span>
              </span>
              <span style={attentionDetailStyle}>{item.detail}</span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

const sectionStackStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const insightGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
  gap: "1rem",
};

const statGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))",
  gap: "1rem",
};

const attentionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
  gap: "1rem",
};

const cardHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "0.75rem",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.78rem",
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const cardTitleStyle: CSSProperties = {
  margin: "0.8rem 0 0",
  fontSize: "1.35rem",
  lineHeight: 1.2,
};

const mutedTextStyle: CSSProperties = {
  margin: "0.65rem 0 0",
  color: "var(--text-muted)",
  lineHeight: 1.55,
};

const panelTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.15rem",
  lineHeight: 1.25,
};

const attentionListStyle: CSSProperties = {
  display: "grid",
  gap: "0.7rem",
  marginTop: "1rem",
};

const attentionItemStyle: CSSProperties = {
  display: "grid",
  gap: "0.25rem",
  minHeight: "52px",
  padding: "0.85rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface)",
  color: "var(--text)",
  textDecoration: "none",
};

const attentionNameStyle: CSSProperties = {
  color: "var(--text)",
};

const attentionReasonStyle: CSSProperties = {
  marginLeft: "0.5rem",
  color: "var(--warning-text)",
  fontSize: "0.88rem",
  fontWeight: 800,
};

const attentionDetailStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.96rem",
};

const primaryLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.7rem 0.9rem",
  border: "1px solid var(--accent)",
  borderRadius: "8px",
  background: "var(--accent)",
  color: "white",
  fontWeight: 800,
  textDecoration: "none",
};

const inlineLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  marginTop: "1rem",
  color: "var(--accent-text)",
  fontWeight: 800,
  textDecoration: "none",
};
