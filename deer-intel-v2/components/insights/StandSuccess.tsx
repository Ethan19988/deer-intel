"use client";

import { useMemo, type CSSProperties } from "react";
import {
  BestChip,
  BreakdownTable,
  MetricRow,
  SampleNote,
} from "@/components/insights/StatPrimitives";
import { useDeerIntelStore } from "@/lib/deerIntelStore";
import { buildStandStats, formatRate, type StandStats } from "@/lib/standStats";
import { usePropertyStatsContext } from "@/lib/useInsightStats";

// A stand's success rates, read straight from the store so any screen showing
// a stand can drop it in. `StandSuccessLine` is the one-liner for the stand
// card; `StandSuccessPanel` the compact block inside Stand Intelligence.

export function useStandStats(standId: string, standName: string, propertyId: string): StandStats {
  const state = useDeerIntelStore();
  const ctx = usePropertyStatsContext(propertyId);
  return useMemo(
    () => buildStandStats({ id: standId, name: standName }, state.hunts, ctx),
    [standId, standName, state.hunts, ctx],
  );
}

export function StandSuccessLine({
  standId,
  standName,
  propertyId,
}: {
  standId: string;
  standName: string;
  propertyId: string;
}) {
  const stats = useStandStats(standId, standName, propertyId);
  const { overall } = stats;
  if (overall.sits === 0) return null;

  const parts = [
    `${overall.sits} ${overall.sits === 1 ? "sit" : "sits"}`,
    `${formatRate(overall.deerPerSit)} deer/sit`,
    overall.bucks ? `${formatRate(overall.bucksPerSit)} bucks/sit` : "",
    overall.harvests ? `${overall.harvests} harvest${overall.harvests === 1 ? "" : "s"}` : "",
  ].filter(Boolean);

  return (
    <div style={lineStyle}>
      <span style={lineTextStyle}>{parts.join(" · ")}</span>
      {overall.enough ? (
        <>
          <BestChip label="Best wind" pick={stats.bestWind} />
          <BestChip label="Best time" pick={stats.bestTime} />
        </>
      ) : (
        <span style={thinStyle}>Too few to call</span>
      )}
    </div>
  );
}

export function StandSuccessPanel({
  standId,
  standName,
  propertyId,
}: {
  standId: string;
  standName: string;
  propertyId: string;
}) {
  const stats = useStandStats(standId, standName, propertyId);
  const { overall } = stats;

  if (overall.sits === 0) return null;

  return (
    <div style={panelStyle}>
      <div style={headRowStyle}>
        <p style={titleStyle}>Success Rates</p>
        <SampleNote agg={overall} />
      </div>
      <MetricRow agg={overall} compact />
      {stats.bestWind || stats.bestTime || stats.bestPhase ? (
        <div style={chipRowStyle}>
          <BestChip label="Best wind" pick={stats.bestWind} />
          <BestChip label="Best time" pick={stats.bestTime} />
          <BestChip label="Best rut" pick={stats.bestPhase} />
        </div>
      ) : (
        <p style={hintStyle}>
          {overall.enough
            ? "No wind or time stands out yet — each needs 3+ sits to compare."
            : "Best wind and time show once this stand has 5+ sits."}
        </p>
      )}
      <div style={breakdownGridStyle}>
        <BreakdownTable title="By wind" buckets={stats.byWind} bestKey={stats.bestWind?.key} />
        <BreakdownTable title="By time" buckets={stats.byTime} bestKey={stats.bestTime?.key} />
      </div>
      {stats.missingWind || stats.missingTime ? (
        <p style={hintStyle}>
          {[
            stats.missingWind ? `${stats.missingWind} without a wind` : "",
            stats.missingTime ? `${stats.missingTime} without start time` : "",
          ]
            .filter(Boolean)
            .join(", ")}{" "}
          — not counted in the breakdowns.
        </p>
      ) : null}
    </div>
  );
}

const lineStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "0.45rem",
  marginTop: "0.85rem",
};

const lineTextStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.74rem",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const thinStyle: CSSProperties = {
  ...lineTextStyle,
  color: "var(--warning-text)",
};

const panelStyle: CSSProperties = {
  display: "grid",
  gap: "0.65rem",
  padding: "0.8rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
  minWidth: 0,
};

const headRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "0.5rem",
  flexWrap: "wrap",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontFamily: "var(--font-display), system-ui, sans-serif",
  fontSize: "1.2rem",
  letterSpacing: "0.05em",
};

const chipRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.4rem",
};

const hintStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.82rem",
  lineHeight: 1.45,
};

const breakdownGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
  gap: "0.75rem",
  overflowX: "auto",
};
