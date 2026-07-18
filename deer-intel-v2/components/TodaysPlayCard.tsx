"use client";

import type { CSSProperties } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type { TodaysPlay, MovementRating } from "@/lib/todaysPlay";

const MOVEMENT_VARIANT: Record<MovementRating, "success" | "warning" | "default"> = {
  Prime: "success",
  Good: "success",
  Fair: "warning",
  Slow: "default",
};

export default function TodaysPlayCard({ play }: { play: TodaysPlay }) {
  return (
    <Card as="article" variant="subtle" style={cardStyle}>
      <div style={headRowStyle}>
        <p style={headlineStyle}>{play.headline}</p>
        <Badge variant={MOVEMENT_VARIANT[play.movement]}>{play.movement} movement</Badge>
      </div>

      <div style={metaRowStyle}>
        <span style={metaItemStyle}>
          <span style={metaLabelStyle}>When</span>
          <span style={metaValueStyle}>{play.window}</span>
        </span>
        {play.altStands.length ? (
          <span style={metaItemStyle}>
            <span style={metaLabelStyle}>Also clean</span>
            <span style={metaValueStyle}>{play.altStands.slice(0, 3).join(", ")}</span>
          </span>
        ) : null}
      </div>

      {play.reasons.length ? (
        <ul style={reasonsStyle}>
          {play.reasons.map((r) => (
            <li key={r} style={reasonStyle}>
              {r}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

const cardStyle: CSSProperties = {
  display: "grid",
  gap: "0.7rem",
};

const headRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const headlineStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontSize: "1.25rem",
  fontWeight: 800,
  lineHeight: 1.2,
};

const metaRowStyle: CSSProperties = {
  display: "flex",
  gap: "1.5rem",
  flexWrap: "wrap",
};

const metaItemStyle: CSSProperties = {
  display: "grid",
  gap: "0.1rem",
};

const metaLabelStyle: CSSProperties = {
  color: "var(--accent-text, var(--accent))",
  fontSize: "0.68rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const metaValueStyle: CSSProperties = {
  color: "var(--text)",
  fontSize: "0.95rem",
  fontWeight: 700,
};

const reasonsStyle: CSSProperties = {
  margin: 0,
  paddingLeft: "1.1rem",
  display: "grid",
  gap: "0.3rem",
};

const reasonStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.88rem",
  lineHeight: 1.4,
};
