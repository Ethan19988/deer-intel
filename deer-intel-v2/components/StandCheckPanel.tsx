import type { CSSProperties } from "react";
import Badge from "@/components/ui/Badge";
import { getAccessScentCheck, type AccessScentStatus } from "@/lib/accessScent";
import {
  getStandPressure,
  localDateKey,
  pickRestedStand,
  type StandPressure,
  type StandPressureLevel,
} from "@/lib/standPressure";
import { getStandWindCheck, type StandWindStatus } from "@/lib/standWind";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";
import type { Stand } from "@/types/stand";

type StandCheckPanelProps = {
  stands: Stand[];
  hunts: HuntLogEntry[];
  pins: MapPin[];
  /** Current wind compass point, e.g. "NW". */
  wind: string | undefined;
  now: Date;
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
// been hunted lately, and whether the walk in blows scent into bedding — plus a
// pick for the most-rested stand that has a good, clean wind.
export default function StandCheckPanel({
  stands,
  hunts,
  pins,
  wind,
  now,
}: StandCheckPanelProps) {
  if (stands.length === 0) return null;

  const today = localDateKey(now);
  const rows = stands.map((stand) => ({
    stand,
    wind: getStandWindCheck(stand, wind),
    pressure: getStandPressure(stand, hunts, today),
    scent: getAccessScentCheck(stand, pins, wind),
  }));

  const pressureById = new Map<string, StandPressure>(
    rows.map((row) => [row.stand.id, row.pressure]),
  );
  // A stand whose walk in blows scent into bedding isn't a real pick, even on
  // a good wind at the tree.
  const pickable = rows
    .filter((row) => row.wind.status === "good" && row.scent.status !== "risk")
    .map((row) => row.stand);
  const pick = pickRestedStand(pickable, pressureById);
  const pickRow = pick ? rows.find((row) => row.stand.id === pick.id) : null;

  // Best sit first, then the rest; burned and wrong-wind stands sink.
  const order = (row: (typeof rows)[number]) =>
    (row.stand.id === pick?.id ? 0 : 10) +
    (row.wind.status === "good" ? 0 : row.wind.status === "avoid" ? 4 : 2) +
    (row.pressure.level === "burned" ? 3 : 0) +
    (row.scent.status === "risk" ? 2 : 0);
  const sorted = [...rows].sort((a, b) => order(a) - order(b));

  return (
    <section style={panelStyle}>
      <div style={headerRowStyle}>
        <span style={eyebrowStyle}>Stand check</span>
        <span style={subtleStyle}>
          {wind ? `${wind} wind now` : "Wind loading"}
        </span>
      </div>

      <p style={pickStyle}>
        {pickRow ? (
          <>
            <strong>Sit {pickRow.stand.name}</strong>
            {` — good wind, ${pickRow.pressure.label.toLowerCase()}`}
            {pickRow.scent.status === "clear" ? ", clean walk in." : "."}
          </>
        ) : wind ? (
          "No rested stand has a clean wind right now."
        ) : (
          "Waiting on today's wind."
        )}
      </p>

      <ul style={listStyle}>
        {sorted.map(({ stand, wind: windCheck, pressure, scent }) => (
          <li key={stand.id} style={rowStyle}>
            <div style={rowHeaderStyle}>
              <span style={standNameStyle}>{stand.name}</span>
            </div>
            <div style={badgeRowStyle}>
              <Badge variant={WIND_VARIANT[windCheck.status]}>
                {windCheck.label}
              </Badge>
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
  marginTop: "1rem",
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

const pickStyle: CSSProperties = {
  margin: "0 0 0.65rem",
  padding: "0.55rem 0.65rem",
  borderRadius: "8px",
  border: "1px solid var(--accent-tint-border)",
  background: "var(--accent-tint)",
  color: "var(--text)",
  fontSize: "0.9rem",
  lineHeight: 1.4,
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
  borderRadius: "8px",
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
