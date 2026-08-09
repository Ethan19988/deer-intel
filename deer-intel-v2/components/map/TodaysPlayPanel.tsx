import type { CSSProperties } from "react";
import type { StandWindStatus } from "@/lib/standWind";

export type StandPlay = {
  id: string;
  name: string;
  standType: string;
  status: StandWindStatus;
  label: string;
  accessNote: string;
  assetId: string | null;
};

type TodaysPlayPanelProps = {
  windFromCompass: string;
  plays: StandPlay[];
  onSelect: (assetId: string) => void;
};

// A ranked "where do I sit right now?" list: each stand scored against the live
// wind (good wind first, wrong wind last). Tapping a stand that has a map pin
// flies to it. Purely a read on data the app already has (stands + live wind);
// it never claims a stand is safe on access — that's the route check's job.
export default function TodaysPlayPanel({
  windFromCompass,
  plays,
  onSelect,
}: TodaysPlayPanelProps) {
  if (plays.length === 0) {
    return (
      <p style={emptyStyle}>
        Add stands with best/avoid winds to see today&rsquo;s play ranked by the
        live wind.
      </p>
    );
  }

  return (
    <div style={listStyle}>
      <p style={eyebrowStyle}>
        {windFromCompass
          ? `Ranked for the ${windFromCompass} wind`
          : "Ranked once the live wind loads"}
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
                <span style={nameStyle}>{play.name}</span>
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
  good: { dot: "#2f8f4a", text: "#1f7a37", word: "Good wind" },
  marginal: { dot: "#c98a2b", text: "#a5701f", word: "Off wind" },
  avoid: { dot: "#c0453b", text: "#b23b3b", word: "Wrong wind" },
  unknown: { dot: "#9aa0a6", text: "#6b7280", word: "No read" },
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#566157",
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
  padding: "0.5rem 0.55rem",
  border: "1px solid rgba(17, 23, 17, 0.12)",
  borderRadius: "10px",
  background: "white",
  textAlign: "left",
  cursor: "pointer",
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
  color: "#1b241b",
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
  color: "#566157",
  fontSize: "0.74rem",
  fontWeight: 600,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const emptyStyle: CSSProperties = {
  margin: 0,
  color: "#566157",
  fontSize: "0.82rem",
  fontWeight: 600,
  lineHeight: 1.4,
};
