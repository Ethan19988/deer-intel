import type { CSSProperties } from "react";
import { buildHuntWindows } from "@/lib/huntPlanner";
import type { ForecastDay } from "@/lib/liveWeather";
import type { Stand } from "@/types/stand";

type HuntWindowsPanelProps = {
  days: ForecastDay[];
  stands: Stand[];
};

// "Best window": the next few days ranked for when + where to sit, from the
// daily wind vs your stands and an incoming front. Prime sits within a good day
// are first and last light. Reads only data already on the dashboard.
export default function HuntWindowsPanel({
  days,
  stands,
}: HuntWindowsPanelProps) {
  if (days.length === 0) return null;

  const windows = buildHuntWindows(days, stands).slice(0, 3);
  const informative = windows.some(
    (window) => window.isFront || window.goodStandNames.length > 0,
  );

  return (
    <section style={panelStyle}>
      <div style={headerRowStyle}>
        <span style={eyebrowStyle}>Best window</span>
        <span style={subtleStyle}>Next {days.length} days · dawn &amp; dusk</span>
      </div>

      <ol style={listStyle}>
        {windows.map((window, index) => (
          <li
            key={window.date}
            style={{ ...rowStyle, ...(index === 0 ? topRowStyle : null) }}
          >
            <div style={dayColStyle}>
              <span style={dayLabelStyle}>{window.dayLabel}</span>
              {window.windCompass ? (
                <span style={windStyle}>{window.windCompass} wind</span>
              ) : null}
            </div>
            <div style={detailColStyle}>
              {window.isFront ? <span style={frontChipStyle}>❄️ Front</span> : null}
              <span style={standsStyle}>
                {window.goodStandNames.length > 0
                  ? window.goodStandNames.join(", ")
                  : stands.length > 0
                    ? "No stand matches this wind"
                    : "Add stands for picks"}
              </span>
            </div>
          </li>
        ))}
      </ol>

      <p style={footnoteStyle}>
        {informative
          ? "Sit the top day at first and last light."
          : "Add stands with best/avoid winds for tailored picks."}
      </p>
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
  marginBottom: "0.6rem",
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

const listStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: "0.4rem",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  padding: "0.5rem 0.6rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface)",
};

const topRowStyle: CSSProperties = {
  borderColor: "var(--accent-tint-border)",
  background: "var(--accent-tint)",
};

const dayColStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
};

const dayLabelStyle: CSSProperties = {
  color: "var(--text)",
  fontSize: "0.92rem",
  fontWeight: 800,
};

const windStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.76rem",
  fontWeight: 600,
};

const detailColStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  minWidth: 0,
  justifyContent: "flex-end",
  flex: 1,
};

const frontChipStyle: CSSProperties = {
  flex: "none",
  padding: "0.15rem 0.4rem",
  borderRadius: "6px",
  border: "1px solid var(--accent-2-tint-border)",
  background: "var(--accent-2-tint)",
  color: "var(--accent-2-text)",
  fontSize: "0.72rem",
  fontWeight: 800,
};

const standsStyle: CSSProperties = {
  overflow: "hidden",
  color: "var(--text)",
  fontSize: "0.82rem",
  fontWeight: 700,
  textAlign: "right",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const footnoteStyle: CSSProperties = {
  margin: "0.6rem 0 0",
  color: "var(--text-muted)",
  fontSize: "0.76rem",
  lineHeight: 1.4,
};
