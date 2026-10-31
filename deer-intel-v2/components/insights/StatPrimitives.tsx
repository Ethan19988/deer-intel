import type { CSSProperties, ReactNode } from "react";
import {
  formatHours,
  formatRate,
  MIN_BUCKET_SITS,
  type BestPick,
  type Bucket,
  type SitAggregate,
} from "@/lib/standStats";

// Small building blocks shared by the stand card, the property Insights tab
// and the season report, so a sit count / rate / sample warning reads the same
// everywhere.

export function MetricRow({ agg, compact = false }: { agg: SitAggregate; compact?: boolean }) {
  const items: Array<[string, string]> = [
    ["Sits", String(agg.sits)],
    ["Hours", agg.timedSits ? formatHours(agg.hours) : "—"],
    ["Deer/sit", formatRate(agg.deerPerSit)],
    ["Bucks/sit", formatRate(agg.bucksPerSit)],
    ["Shots", String(agg.shots)],
    ["Harvest", String(agg.harvests)],
  ];

  return (
    <dl style={compact ? metricGridCompactStyle : metricGridStyle}>
      {items.map(([label, value]) => (
        <div key={label} style={metricStyle}>
          <dt style={metricLabelStyle}>{label}</dt>
          <dd style={compact ? metricValueCompactStyle : metricValueStyle}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SampleNote({ agg }: { agg: SitAggregate }) {
  return (
    <p style={{ ...sampleStyle, color: agg.enough ? "var(--text-muted)" : "var(--warning-text)" }}>
      {agg.sampleLabel}
    </p>
  );
}

export function BestChip({ label, pick }: { label: string; pick: BestPick | null }) {
  if (!pick) return null;
  return (
    <span style={chipStyle} title={pick.detail}>
      <span style={chipLabelStyle}>{label}</span>
      <span style={chipValueStyle}>{pick.label}</span>
      <span style={chipDetailStyle}>{pick.lift.toFixed(1)}×</span>
    </span>
  );
}

/** One breakdown (wind / time / rut) as a compact table; the best row is marked. */
export function BreakdownTable<K extends string>({
  title,
  buckets,
  bestKey,
  emptyText = "Nothing logged yet.",
}: {
  title: string;
  buckets: Bucket<K>[];
  bestKey?: string | null;
  emptyText?: string;
}) {
  return (
    <div style={breakdownStyle}>
      <p style={breakdownTitleStyle}>{title}</p>
      {buckets.length === 0 ? (
        <p style={emptyStyle}>{emptyText}</p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <Th align="left">&nbsp;</Th>
              <Th>Sits</Th>
              <Th>Deer/sit</Th>
              <Th>Bucks/sit</Th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket) => {
              const thin = bucket.agg.sits < MIN_BUCKET_SITS;
              const best = bestKey === bucket.key;
              return (
                <tr
                  key={bucket.key}
                  style={{
                    ...(best ? bestRowStyle : null),
                    color: thin ? "var(--text-faint)" : "var(--text)",
                  }}
                >
                  <Td align="left">
                    {bucket.label}
                    {best ? <span style={bestMarkStyle}> Best</span> : null}
                  </Td>
                  <Td>{bucket.agg.sits}</Td>
                  <Td>{formatRate(bucket.agg.deerPerSit)}</Td>
                  <Td>{formatRate(bucket.agg.bucksPerSit)}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function Th({ children, align = "right" }: { children: ReactNode; align?: "left" | "right" }) {
  return <th style={{ ...thStyle, textAlign: align }}>{children}</th>;
}

export function Td({
  children,
  align = "right",
  style,
}: {
  children: ReactNode;
  align?: "left" | "right";
  style?: CSSProperties;
}) {
  return <td style={{ ...tdStyle, textAlign: align, ...style }}>{children}</td>;
}

const MONO = "var(--font-geist-mono), ui-monospace, monospace";
const DISPLAY = "var(--font-display), system-ui, sans-serif";

export const insightLabelStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontFamily: MONO,
  fontSize: "0.68rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

export const insightHeadingStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontFamily: DISPLAY,
  fontSize: "1.35rem",
  fontWeight: 400,
  letterSpacing: "0.04em",
  lineHeight: 1.1,
};

const metricGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(5.2rem, 1fr))",
  gap: "0.4rem",
  margin: 0,
};

const metricGridCompactStyle: CSSProperties = {
  ...metricGridStyle,
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
};

const metricStyle: CSSProperties = {
  padding: "0.45rem 0.55rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
  minWidth: 0,
};

const metricLabelStyle: CSSProperties = { ...insightLabelStyle };

const metricValueStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  color: "var(--text)",
  fontFamily: DISPLAY,
  fontSize: "1.6rem",
  lineHeight: 1,
  letterSpacing: "0.02em",
  fontVariantNumeric: "tabular-nums",
};

const metricValueCompactStyle: CSSProperties = { ...metricValueStyle, fontSize: "1.3rem" };

const sampleStyle: CSSProperties = {
  margin: 0,
  fontFamily: MONO,
  fontSize: "0.72rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const chipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: "0.4rem",
  padding: "0.3rem 0.55rem",
  border: "1px solid var(--success-border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--success-bg)",
  color: "var(--success-text)",
};

const chipLabelStyle: CSSProperties = {
  fontFamily: MONO,
  fontSize: "0.64rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const chipValueStyle: CSSProperties = {
  fontFamily: DISPLAY,
  fontSize: "1.05rem",
  letterSpacing: "0.04em",
  lineHeight: 1,
};

const chipDetailStyle: CSSProperties = {
  fontFamily: MONO,
  fontSize: "0.7rem",
  opacity: 0.85,
};

const breakdownStyle: CSSProperties = {
  minWidth: 0,
};

const breakdownTitleStyle: CSSProperties = {
  ...insightLabelStyle,
  marginBottom: "0.35rem",
  color: "var(--accent-text)",
};

const emptyStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.85rem",
};

export const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.86rem",
  fontVariantNumeric: "tabular-nums",
};

const thStyle: CSSProperties = {
  padding: "0.3rem 0.4rem",
  borderBottom: "1px solid var(--border-strong)",
  color: "var(--text-faint)",
  fontFamily: MONO,
  fontSize: "0.64rem",
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  padding: "0.35rem 0.4rem",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

const bestRowStyle: CSSProperties = {
  background: "var(--success-bg)",
};

const bestMarkStyle: CSSProperties = {
  color: "var(--success-text)",
  fontFamily: MONO,
  fontSize: "0.62rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};
