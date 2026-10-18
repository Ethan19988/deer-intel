"use client";

import type { CSSProperties } from "react";
import Card from "@/components/ui/Card";
import type {
  PatternConfidence,
  PatternInsight,
  PropertyPatternReport as Report,
} from "@/lib/propertyPatterns";

// Renders the property pattern report: what conditions have actually produced
// deer here, learned from the hunter's own sits AND trail-cam sightings. Each
// insight is rated by how much data stands behind it. A limited view (dashboard)
// stays compact with the top sit insights; the full view adds the camera read.
export default function PropertyPatternReport({
  report,
  limit,
}: {
  report: Report;
  limit?: number;
}) {
  const huntRows = [...report.conditionInsights];
  if (report.hottestCamera) huntRows.push(report.hottestCamera);

  if (limit != null) {
    const rows = huntRows.slice(0, limit);
    return (
      <Card as="div" variant="subtle">
        <MetaLine report={report} />
        {rows.length ? <InsightList rows={rows} /> : null}
        {report.message ? <p style={hintStyle}>{report.message}</p> : null}
      </Card>
    );
  }

  return (
    <Card as="div" variant="subtle">
      <MetaLine report={report} />

      {huntRows.length ? (
        <>
          <p style={groupHeadingStyle}>From your sits</p>
          <InsightList rows={huntRows} />
        </>
      ) : null}

      {report.sightingInsights.length ? (
        <>
          <p style={groupHeadingStyle}>From your trail cameras</p>
          <InsightList rows={report.sightingInsights} />
        </>
      ) : null}

      {report.message ? <p style={hintStyle}>{report.message}</p> : null}
    </Card>
  );
}

function MetaLine({ report }: { report: Report }) {
  const parts = [
    `${report.sits} ${report.sits === 1 ? "sit" : "sits"}`,
    `${report.checks} ${report.checks === 1 ? "camera check" : "camera checks"}`,
    `${report.sightings} ${report.sightings === 1 ? "sighting" : "sightings"}`,
  ];

  return (
    <p style={metaStyle}>
      From {parts.join(", ")}
      {report.deerSeen > 0
        ? ` · ${report.bucksSeen} bucks, ${report.deerSeen} deer seen`
        : ""}
    </p>
  );
}

function InsightList({ rows }: { rows: PatternInsight[] }) {
  return (
    <div style={listStyle}>
      {rows.map((insight) => (
        <div key={insight.label} style={rowStyle}>
          <span style={labelStyle}>{insight.label}</span>
          <span style={valueRowStyle}>
            <span style={valueStyle}>{insight.value}</span>
            {insight.confidence ? (
              <ConfidenceChip confidence={insight.confidence} />
            ) : null}
          </span>
          <span style={detailStyle}>{insight.detail}</span>
        </div>
      ))}
    </div>
  );
}

function ConfidenceChip({ confidence }: { confidence: PatternConfidence }) {
  return (
    <span style={{ ...chipStyle, ...CHIP_TONE[confidence] }}>
      {CHIP_LABEL[confidence]}
    </span>
  );
}

const CHIP_LABEL: Record<PatternConfidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

const CHIP_TONE: Record<PatternConfidence, CSSProperties> = {
  high: {
    background: "var(--success-bg)",
    borderColor: "var(--success-border)",
    color: "var(--success-text)",
  },
  medium: {
    background: "var(--warning-bg)",
    borderColor: "var(--warning-border)",
    color: "var(--warning-text)",
  },
  low: {
    background: "var(--surface-2)",
    borderColor: "var(--border)",
    color: "var(--text-muted)",
  },
};

const metaStyle: CSSProperties = {
  margin: "0 0 0.75rem",
  color: "var(--text-muted)",
  fontSize: "0.85rem",
  fontWeight: 600,
};

const groupHeadingStyle: CSSProperties = {
  margin: "0.9rem 0 0.5rem",
  color: "var(--text)",
  fontSize: "0.82rem",
  fontWeight: 800,
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: "0.6rem",
};

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(7.5rem, auto) 1fr",
  gridTemplateAreas: '"label value" "label detail"',
  columnGap: "0.75rem",
  rowGap: "0.1rem",
  alignItems: "baseline",
  paddingBottom: "0.55rem",
  borderBottom: "1px solid var(--border, rgba(0,0,0,0.08))",
};

const labelStyle: CSSProperties = {
  gridArea: "label",
  color: "var(--accent-text, var(--accent))",
  fontSize: "0.72rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const valueRowStyle: CSSProperties = {
  gridArea: "value",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "baseline",
  gap: "0.5rem",
};

const valueStyle: CSSProperties = {
  color: "var(--text)",
  fontSize: "1rem",
  fontWeight: 800,
  lineHeight: 1.25,
};

const chipStyle: CSSProperties = {
  alignSelf: "center",
  padding: "0.05rem 0.45rem",
  borderRadius: "999px",
  border: "1px solid",
  fontSize: "0.66rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.02em",
  whiteSpace: "nowrap",
};

const detailStyle: CSSProperties = {
  gridArea: "detail",
  color: "var(--text-muted)",
  fontSize: "0.82rem",
  lineHeight: 1.35,
};

const hintStyle: CSSProperties = {
  margin: "0.5rem 0 0",
  color: "var(--text-muted)",
  fontSize: "0.85rem",
  lineHeight: 1.45,
};
