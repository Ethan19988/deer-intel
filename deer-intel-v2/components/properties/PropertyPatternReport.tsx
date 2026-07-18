"use client";

import type { CSSProperties } from "react";
import Card from "@/components/ui/Card";
import type { PropertyPatternReport as Report } from "@/lib/propertyPatterns";

// Renders the property pattern report: what conditions have actually produced
// deer here, from the hunter's own sits + camera checks.
export default function PropertyPatternReport({ report }: { report: Report }) {
  const rows = [...report.conditionInsights];
  if (report.hottestCamera) rows.push(report.hottestCamera);

  return (
    <Card as="div" variant="subtle">
      <p style={metaStyle}>
        From {report.sits} {report.sits === 1 ? "sit" : "sits"} and {report.checks}{" "}
        {report.checks === 1 ? "camera check" : "camera checks"}
        {report.deerSeen > 0
          ? ` · ${report.bucksSeen} bucks, ${report.deerSeen} deer seen`
          : ""}
      </p>

      {rows.length ? (
        <div style={listStyle}>
          {rows.map((insight) => (
            <div key={insight.label} style={rowStyle}>
              <span style={labelStyle}>{insight.label}</span>
              <span style={valueStyle}>{insight.value}</span>
              <span style={detailStyle}>{insight.detail}</span>
            </div>
          ))}
        </div>
      ) : null}

      {report.message ? <p style={hintStyle}>{report.message}</p> : null}
    </Card>
  );
}

const metaStyle: CSSProperties = {
  margin: "0 0 0.75rem",
  color: "var(--text-muted)",
  fontSize: "0.85rem",
  fontWeight: 600,
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

const valueStyle: CSSProperties = {
  gridArea: "value",
  color: "var(--text)",
  fontSize: "1rem",
  fontWeight: 800,
  lineHeight: 1.25,
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
