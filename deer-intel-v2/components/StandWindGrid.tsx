import type { CSSProperties } from "react";
import { buildWindMatrix } from "@/lib/huntPlanner";
import type { ForecastDay } from "@/lib/liveWeather";
import type { StandWindStatus } from "@/lib/standWind";
import type { Stand } from "@/types/stand";

type StandWindGridProps = {
  days: ForecastDay[];
  stands: Stand[];
  /** Column key ("YYYY-MM-DD-AM"/"-PM") of the next sit, highlighted. */
  activeKey?: string;
};

// Color plus a glyph, so the grid reads in glare and for color-blind eyes.
const CELL: Record<StandWindStatus, { glyph: string; label: string; style: CSSProperties }> = {
  good: {
    glyph: "✓",
    label: "Good wind",
    style: { background: "var(--success-bg)", color: "var(--success-text)", borderColor: "var(--success-border)" },
  },
  marginal: {
    glyph: "~",
    label: "Off wind",
    style: { background: "var(--warning-bg)", color: "var(--warning-text)", borderColor: "var(--warning-border)" },
  },
  avoid: {
    glyph: "✕",
    label: "Wrong wind",
    style: { background: "var(--danger-bg)", color: "var(--danger-text)", borderColor: "var(--danger-border)" },
  },
  unknown: {
    glyph: "·",
    label: "No wind notes",
    style: { background: "var(--surface-2)", color: "var(--text-faint)", borderColor: "var(--border)" },
  },
};

// Which stand works on which sit over the next few days: the forecast wind for
// every morning and evening sit, graded against each stand's best/avoid winds.
export default function StandWindGrid({ days, stands, activeKey }: StandWindGridProps) {
  if (days.length === 0 || stands.length === 0) return null;

  const { columns, rows } = buildWindMatrix(days, stands);
  const gridTemplateColumns = `minmax(92px, 1.5fr) repeat(${columns.length}, minmax(32px, 1fr))`;

  return (
    <section style={panelStyle} aria-label="Stand wind outlook">
      <div style={headerRowStyle}>
        <h2 style={titleStyle}>Wind by sit</h2>
        <span style={subtleStyle}>Next {days.length} days</span>
      </div>

      <div style={scrollStyle}>
        <div role="table" style={{ ...gridStyle, gridTemplateColumns }}>
          <div role="row" style={rowContentsStyle}>
            <span role="columnheader" style={cornerStyle} />
            {columns.map((column, index) => (
              <span
                key={column.key}
                role="columnheader"
                style={{
                  ...colHeadStyle,
                  ...(column.key === activeKey ? activeHeadStyle : null),
                }}
              >
                <span style={dayStyle}>
                  {index % 2 === 0 ? column.dayLabel : " "}
                </span>
                <span style={periodStyle}>{column.period}</span>
                <span style={windStyle}>{column.windCompass ?? "—"}</span>
                {column.isFront && column.period === "AM" ? (
                  <span style={frontDotStyle} title="Front passing" aria-label="Front passing" />
                ) : null}
              </span>
            ))}
          </div>

          {rows.map((row) => (
            <div key={row.stand.id} role="row" style={rowContentsStyle}>
              <span role="rowheader" style={standNameStyle}>
                {row.stand.name}
              </span>
              {row.cells.map((status, index) => {
                const cell = CELL[status];
                const column = columns[index];
                return (
                  <span
                    key={column.key}
                    role="cell"
                    aria-label={`${row.stand.name}, ${column.dayLabel} ${column.period}: ${cell.label}`}
                    style={{
                      ...cellStyle,
                      ...cell.style,
                      ...(column.key === activeKey ? activeCellStyle : null),
                    }}
                  >
                    {cell.glyph}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p style={legendStyle}>
        <span style={{ ...legendDotStyle, ...CELL.good.style }}>✓</span> good
        <span style={{ ...legendDotStyle, ...CELL.marginal.style }}>~</span> off
        <span style={{ ...legendDotStyle, ...CELL.avoid.style }}>✕</span> wrong
        <span style={frontLegendStyle} /> front
      </p>
    </section>
  );
}

const panelStyle: CSSProperties = {
  padding: "0.9rem 1rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "0.5rem",
  marginBottom: "0.65rem",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-display), system-ui, sans-serif",
  fontSize: "1.2rem",
  fontWeight: 800,
};

const subtleStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.8rem",
  fontWeight: 600,
};

const scrollStyle: CSSProperties = {
  overflowX: "auto",
  margin: "0 -0.25rem",
  padding: "0 0.25rem",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gap: "4px",
  minWidth: "320px",
};

const rowContentsStyle: CSSProperties = {
  display: "contents",
};

const cornerStyle: CSSProperties = {};

const colHeadStyle: CSSProperties = {
  position: "relative",
  display: "grid",
  justifyItems: "center",
  padding: "0.25rem 0 0.3rem",
  borderRadius: "8px",
  lineHeight: 1.15,
};

const activeHeadStyle: CSSProperties = {
  background: "var(--accent-tint)",
  boxShadow: "inset 0 0 0 1px var(--accent-tint-border)",
};

const dayStyle: CSSProperties = {
  color: "var(--text)",
  fontSize: "0.75rem",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const periodStyle: CSSProperties = {
  color: "var(--text-faint)",
  fontSize: "0.68rem",
  fontWeight: 700,
};

const windStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.72rem",
  fontWeight: 800,
};

const frontDotStyle: CSSProperties = {
  position: "absolute",
  top: "4px",
  right: "2px",
  width: "7px",
  height: "7px",
  borderRadius: "50%",
  background: "var(--accent-2)",
};

// Names wrap to two lines rather than truncating; a stand you can't identify
// in the grid is no use.
const standNameStyle: CSSProperties = {
  alignSelf: "center",
  paddingRight: "0.35rem",
  color: "var(--text)",
  fontSize: "0.82rem",
  fontWeight: 700,
  lineHeight: 1.15,
  overflowWrap: "anywhere",
};

const cellStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  minHeight: "36px",
  border: "1px solid",
  borderRadius: "8px",
  fontSize: "0.95rem",
  fontWeight: 900,
};

const activeCellStyle: CSSProperties = {
  boxShadow: "0 0 0 2px var(--accent)",
};

const legendStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "0.35rem 0.5rem",
  margin: "0.7rem 0 0",
  color: "var(--text-muted)",
  fontSize: "0.78rem",
};

const legendDotStyle: CSSProperties = {
  display: "inline-grid",
  placeItems: "center",
  width: "20px",
  height: "20px",
  border: "1px solid",
  borderRadius: "6px",
  fontSize: "0.7rem",
  fontWeight: 900,
};

const frontLegendStyle: CSSProperties = {
  display: "inline-block",
  width: "8px",
  height: "8px",
  marginLeft: "0.3rem",
  borderRadius: "50%",
  background: "var(--accent-2)",
};
