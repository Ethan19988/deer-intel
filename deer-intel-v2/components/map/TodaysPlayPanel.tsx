import type { CSSProperties } from "react";
import type { StandPlay } from "@/lib/mapPlay";
import type { StandWindStatus } from "@/lib/standWind";

export type { StandPlay } from "@/lib/mapPlay";

type TodaysPlayPanelProps = {
  /**
   * What the list is graded on, e.g. "Tomorrow AM · WNW" (the Today verdict's
   * next sit) or "Forecast · 5 PM" (a timeline window). Empty while loading.
   */
  contextLabel: string;
  plays: StandPlay[];
  onSelect: (assetId: string) => void;
};

// A ranked "where do I sit?" list. With no timeline window picked it is the
// Today verdict's own ranking for the next sit (same wind, pick and order as
// Today and Stands); a picked forecast window ranks on that window's wind.
// Tapping a stand that has a map pin flies to it.
export default function TodaysPlayPanel({
  contextLabel,
  plays,
  onSelect,
}: TodaysPlayPanelProps) {
  if (plays.length === 0) {
    return (
      <p style={emptyStyle}>
        Add stands with best/avoid winds to see today&rsquo;s play ranked for
        your next sit.
      </p>
    );
  }

  return (
    <div style={listStyle}>
      <p style={eyebrowStyle}>
        {contextLabel ? `Ranked for ${contextLabel}` : "Ranked once the forecast loads"}
      </p>

      {plays.map((play) => {
        const tone = STATUS_TONE[play.status];
        const tappable = play.assetId !== null;

        return (
          <button
            key={play.id}
            type="button"
            disabled={!tappable}
            style={{
              ...rowStyle,
              ...(play.isPick ? rowPickStyle : null),
              ...(tappable ? null : rowStaticStyle),
            }}
            onClick={() => play.assetId && onSelect(play.assetId)}
            title={
              tappable ? `Center the map on ${play.name}` : "No map pin yet"
            }
          >
            <span style={{ ...dotStyle, background: tone.dot }} />
            <span style={textColStyle}>
              <span style={nameRowStyle}>
                <span style={nameStyle}>
                  {play.isPick ? <span style={pickTagStyle}>Pick</span> : null}
                  {play.name}
                </span>
                <span style={{ ...statusChipStyle, color: tone.text }}>
                  {tone.word}
                </span>
              </span>
              <span style={metaStyle}>
                {play.standType}
                {" · "}
                {play.label}
                {play.accessNote ? ` · in: ${play.accessNote}` : ""}
              </span>
              {play.caution ? (
                <span style={cautionStyle}>{play.caution}</span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const STATUS_TONE: Record<
  StandWindStatus,
  { dot: string; text: string; word: string }
> = {
  good: { dot: "#2f8f4a", text: "var(--success-text)", word: "Good wind" },
  marginal: { dot: "#c98a2b", text: "var(--warning-text)", word: "Off wind" },
  avoid: { dot: "#c0453b", text: "var(--danger-text)", word: "Wrong wind" },
  unknown: { dot: "#9aa0a6", text: "var(--text-faint)", word: "No read" },
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.72rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
  width: "100%",
  minHeight: "44px",
  padding: "0.5rem 0.55rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
  textAlign: "left",
  cursor: "pointer",
};

const rowPickStyle: CSSProperties = {
  borderColor: "var(--accent)",
};

const pickTagStyle: CSSProperties = {
  marginRight: "0.4rem",
  padding: "0.05rem 0.3rem",
  border: "1px solid var(--accent)",
  borderRadius: "var(--radius-sm)",
  color: "var(--success-text)",
  fontSize: "0.66rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  verticalAlign: "middle",
};

const cautionStyle: CSSProperties = {
  overflow: "hidden",
  color: "var(--warning-text)",
  fontSize: "0.72rem",
  fontWeight: 700,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const rowStaticStyle: CSSProperties = {
  cursor: "default",
  opacity: 0.7,
};

const dotStyle: CSSProperties = {
  flex: "0 0 auto",
  width: "10px",
  height: "10px",
  borderRadius: "999px",
};

const textColStyle: CSSProperties = {
  display: "grid",
  gap: "0.1rem",
  minWidth: 0,
};

const nameRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: "0.5rem",
  justifyContent: "space-between",
};

const nameStyle: CSSProperties = {
  overflow: "hidden",
  color: "var(--text)",
  fontSize: "0.9rem",
  fontWeight: 750,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const statusChipStyle: CSSProperties = {
  flex: "0 0 auto",
  fontSize: "0.72rem",
  fontWeight: 800,
};

const metaStyle: CSSProperties = {
  overflow: "hidden",
  color: "var(--text-muted)",
  fontSize: "0.74rem",
  fontWeight: 600,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const emptyStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.82rem",
  fontWeight: 600,
  lineHeight: 1.4,
};
