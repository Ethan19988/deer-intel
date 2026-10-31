"use client";

import { useState, type CSSProperties } from "react";
import {
  BestChip,
  BreakdownTable,
  MetricRow,
  SampleNote,
  Td,
  Th,
  insightLabelStyle,
  tableStyle,
} from "@/components/insights/StatPrimitives";
import {
  formatHours,
  formatRate,
  type PropertyStandStats,
  type StandStats,
} from "@/lib/standStats";

// The fuller stand read for a property: the property roll-up (with its wind /
// time / rut breakdowns) and one row per stand. Tapping a stand row opens its
// own breakdowns underneath. Thin samples are greyed and labelled, never ranked.

export default function PropertyStandTable({ stats }: { stats: PropertyStandStats }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const { property, stands } = stats;
  const open = stands.find((row) => row.standId === openId) ?? null;

  return (
    <div style={wrapStyle}>
      <div style={headRowStyle}>
        <p style={insightLabelStyle}>Whole property</p>
        <SampleNote agg={property.overall} />
      </div>
      <MetricRow agg={property.overall} />
      <div style={chipRowStyle}>
        <BestChip label="Best wind" pick={property.bestWind} />
        <BestChip label="Best time" pick={property.bestTime} />
        <BestChip label="Best rut" pick={property.bestPhase} />
      </div>

      <div style={breakdownGridStyle}>
        <BreakdownTable title="By wind" buckets={property.byWind} bestKey={property.bestWind?.key} />
        <BreakdownTable title="By time of day" buckets={property.byTime} bestKey={property.bestTime?.key} />
        <BreakdownTable title="By rut phase" buckets={property.byPhase} bestKey={property.bestPhase?.key} />
      </div>

      <p style={{ ...insightLabelStyle, marginTop: "0.5rem" }}>By stand — tap a row</p>
      <div style={scrollStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <Th align="left">Stand</Th>
              <Th>Sits</Th>
              <Th>Hours</Th>
              <Th>Deer/sit</Th>
              <Th>Bucks/sit</Th>
              <Th>Shots</Th>
              <Th>Kills</Th>
              <Th align="left">Best wind / time</Th>
            </tr>
          </thead>
          <tbody>
            {stands.map((row) => (
              <StandRow
                key={row.standId}
                row={row}
                active={row.standId === openId}
                onToggle={() => setOpenId(row.standId === openId ? null : row.standId)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {open ? (
        <div style={detailStyle}>
          <div style={headRowStyle}>
            <p style={detailTitleStyle}>{open.standName}</p>
            <SampleNote agg={open.overall} />
          </div>
          <div style={breakdownGridStyle}>
            <BreakdownTable title="By wind" buckets={open.byWind} bestKey={open.bestWind?.key} />
            <BreakdownTable title="By time" buckets={open.byTime} bestKey={open.bestTime?.key} />
            <BreakdownTable title="By rut phase" buckets={open.byPhase} bestKey={open.bestPhase?.key} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StandRow({
  row,
  active,
  onToggle,
}: {
  row: StandStats;
  active: boolean;
  onToggle: () => void;
}) {
  const { overall } = row;
  const thin = !overall.enough;
  const best = [row.bestWind?.label, row.bestTime?.label].filter(Boolean).join(" · ");

  return (
    <tr
      onClick={onToggle}
      style={{
        cursor: "pointer",
        color: thin ? "var(--text-muted)" : "var(--text)",
        background: active ? "var(--surface-3)" : undefined,
      }}
      aria-expanded={active}
    >
      <Td align="left" style={{ fontWeight: 700, whiteSpace: "normal", minWidth: "7rem" }}>
        <button type="button" style={rowButtonStyle} onClick={(event) => { event.stopPropagation(); onToggle(); }}>
          {row.standName}
        </button>
      </Td>
      <Td>{overall.sits}</Td>
      <Td>{overall.timedSits ? formatHours(overall.hours) : "—"}</Td>
      <Td>{overall.sits ? formatRate(overall.deerPerSit) : "—"}</Td>
      <Td>{overall.sits ? formatRate(overall.bucksPerSit) : "—"}</Td>
      <Td>{overall.shots}</Td>
      <Td>{overall.harvests}</Td>
      <Td align="left" style={{ color: best ? "var(--success-text)" : "var(--text-faint)" }}>
        {best || (overall.sits === 0 ? "Not sat" : thin ? "Too few to call" : "No standout")}
      </Td>
    </tr>
  );
}

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  minWidth: 0,
};

const headRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "0.5rem",
  flexWrap: "wrap",
};

const chipRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.4rem",
};

const breakdownGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(230px, 100%), 1fr))",
  gap: "0.9rem",
};

const scrollStyle: CSSProperties = {
  overflowX: "auto",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
};

const detailStyle: CSSProperties = {
  display: "grid",
  gap: "0.65rem",
  padding: "0.8rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
};

const detailTitleStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-display), system-ui, sans-serif",
  fontSize: "1.25rem",
  letterSpacing: "0.04em",
};

const rowButtonStyle: CSSProperties = {
  padding: 0,
  border: "none",
  background: "none",
  color: "inherit",
  font: "inherit",
  textAlign: "left",
  cursor: "pointer",
  minHeight: "32px",
};
