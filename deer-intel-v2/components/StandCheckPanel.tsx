import Link from "next/link";
import type { CSSProperties } from "react";
import Badge from "@/components/ui/Badge";
import type { AccessScentStatus } from "@/lib/accessScent";
import type { StandCheckResult } from "@/lib/standCheck";
import type { StandPressureLevel } from "@/lib/standPressure";
import type { StandWindStatus } from "@/lib/standWind";

type StandCheckPanelProps = {
  check: StandCheckResult;
  /** Wind the sit is planned against, e.g. "NW". */
  wind: string | undefined;
  /** Which sit that wind is for, e.g. "This evening". */
  whenLabel?: string;
};

const WIND_VARIANT: Record<StandWindStatus, "success" | "warning" | "danger" | "default"> = {
  good: "success",
  marginal: "warning",
  avoid: "danger",
  unknown: "default",
};

const PRESSURE_VARIANT: Record<StandPressureLevel, "success" | "warning" | "danger"> = {
  fresh: "success",
  pressured: "warning",
  burned: "danger",
};

const SCENT_VARIANT: Record<AccessScentStatus, "success" | "danger" | "default"> = {
  clear: "success",
  risk: "danger",
  unknown: "default",
};

// Stand check: for each stand on the active property, the three things that
// decide whether to sit it right now — today's wind at the tree, how hard it's
// been hunted lately, and whether the walk in blows scent into bedding. The
// rows and the pick come from buildStandChecks (shared with the Today verdict).
export default function StandCheckPanel({
  check,
  wind,
  whenLabel = "Now",
}: StandCheckPanelProps) {
  if (check.rows.length === 0) return null;

  const { rows, pick: pickRow } = check;

  return (
    <section style={panelStyle}>
      <div style={headerRowStyle}>
        <span style={eyebrowStyle}>Stand check</span>
        <span style={subtleStyle}>
          {wind ? `${whenLabel}, ${wind} wind` : "Wind loading"}
        </span>
      </div>

      <ul style={listStyle}>
        {rows.map(({ stand, wind: windCheck, pressure, scent }) => (
          <li
            key={stand.id}
            style={{
              ...rowStyle,
              ...(stand.id === pickRow?.stand.id ? pickRowStyle : null),
            }}
          >
            <div style={rowHeaderStyle}>
              <span style={standNameStyle}>{stand.name}</span>
              {stand.id === pickRow?.stand.id ? (
                <span style={pickTagStyle}>Best sit</span>
              ) : null}
            </div>
            <div style={badgeRowStyle}>
              {windCheck.label === "No wind notes" ? (
                // Nothing to grade yet: send them straight to the wind picker.
                <Link href={`/stands#stand-${stand.id}`} style={setWindsLinkStyle}>
                  Set winds
                </Link>
              ) : (
                <Badge variant={WIND_VARIANT[windCheck.status]}>
                  {windCheck.label}
                </Badge>
              )}
              <Badge variant={PRESSURE_VARIANT[pressure.level]}>
                {pressure.label}
              </Badge>
              <Badge variant={SCENT_VARIANT[scent.status]}>{scent.label}</Badge>
            </div>
            {scent.status === "risk" ? (
              <p style={detailStyle}>{scent.detail}</p>
            ) : null}
          </li>
        ))}
      </ul>

      {rows.some((row) => row.scent.status === "unknown" && row.scent.detail) ? (
        <p style={footnoteStyle}>
          Walk-in check needs the stand, a parking or gate pin, and bedding pins
          on the map. It uses wind only, not thermals.
        </p>
      ) : null}
    </section>
  );
}

const panelStyle: CSSProperties = {
  padding: "0.85rem 1rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "0.5rem",
  marginBottom: "0.5rem",
};

const eyebrowStyle: CSSProperties = {
  color: "var(--accent-text)",
  fontSize: "0.72rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const subtleStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.74rem",
  fontWeight: 600,
};

const setWindsLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "32px",
  padding: "0.3rem 0.65rem",
  borderRadius: "var(--radius-sm)",
  border: "1px dashed var(--accent)",
  background: "var(--accent-tint)",
  color: "var(--accent-text)",
  fontSize: "0.8rem",
  fontWeight: 800,
  textDecoration: "none",
};

const pickRowStyle: CSSProperties = {
  borderColor: "var(--accent-tint-border)",
  background: "var(--accent-tint)",
};

const pickTagStyle: CSSProperties = {
  flex: "none",
  padding: "0.2rem 0.5rem",
  borderRadius: "var(--radius-sm)",
  background: "var(--accent)",
  color: "#fff",
  fontSize: "0.72rem",
  fontWeight: 800,
};

const listStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: "0.4rem",
};

const rowStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
  padding: "0.55rem 0.6rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
};

const rowHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.5rem",
  minWidth: 0,
};

const standNameStyle: CSSProperties = {
  overflow: "hidden",
  color: "var(--text)",
  fontSize: "0.92rem",
  fontWeight: 800,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const badgeRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.35rem",
};

const detailStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.8rem",
  lineHeight: 1.4,
};

const footnoteStyle: CSSProperties = {
  margin: "0.6rem 0 0",
  color: "var(--text-muted)",
  fontSize: "0.76rem",
  lineHeight: 1.4,
};
